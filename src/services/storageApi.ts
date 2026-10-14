import type { FileItemData, StorageUsage } from '../types';
import { getActiveUser } from './accountManager';

// Feste Konstante gemäß Vorgabe – kein Einstellungsfenster / keine dynamische Überschreibung
export const STORAGE_BASE_URL = 'https://storage.j-jonas.com';

export interface ServerStatus {
  isOnline: boolean;
  latencyMs?: number;
  error?: string;
}

/**
 * Prüft die Erreichbarkeit des Mini-PC FastAPI / Express Backends (https://storage.j-jonas.com).
 * Es werden keine Fake-Daten erzeugt.
 */
export async function checkServerStatus(): Promise<ServerStatus> {
  const start = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch(`${STORAGE_BASE_URL}/storage-usage?user=ping_check`, {
      method: 'GET',
      mode: 'cors',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const latency = Math.round(performance.now() - start);

    if (res.ok || res.status === 200 || res.status === 404 || res.status === 422) {
      return {
        isOnline: true,
        latencyMs: latency,
      };
    }
    return {
      isOnline: false,
      error: `Server antwortete mit Status ${res.status}`,
    };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    return {
      isOnline: false,
      error: 'Keine Verbindung zu https://storage.j-jonas.com',
    };
  }
}

/**
 * GET /storage-usage?user=<username>
 * Liefert { status, user, usedBytes, usedGB, limitBytes, limitGB } direkt vom Mini-PC Server.
 */
export async function getStorageUsage(username: string): Promise<StorageUsage> {
  try {
    const res = await fetch(`${STORAGE_BASE_URL}/storage-usage?user=${encodeURIComponent(username)}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      const used_bytes = Number(data.usedBytes ?? data.used_bytes ?? 0);
      const used_gb = Number(
        data.usedGB !== undefined
          ? data.usedGB
          : data.used_gb !== undefined
          ? data.used_gb
          : (used_bytes / (1024 * 1024 * 1024)).toFixed(2)
      );
      const limit_gb = Number(data.limitGB ?? data.limit_gb ?? 1000);
      return { used_bytes, used_gb, limit_gb };
    }
  } catch (err) {
    // Kein Fallback-Mock: Server nicht erreichbar
  }
  return { used_bytes: 0, used_gb: 0, limit_gb: 1000 };
}

/**
 * GET /files?user=<owner>&path=<relative_path>
 * Liefert die Liste aller echten Dateien und Ordner.
 * Das Backend liefert { files: [...], currentPath: ... }.
 */
export async function listFiles(owner: string, relativePath = ''): Promise<{ items: FileItemData[]; error?: string }> {
  const cleanPath = relativePath.trim().replace(/^\/+|\/+$/g, '') || '.';

  try {
    const url = `${STORAGE_BASE_URL}/files?user=${encodeURIComponent(owner)}&path=${encodeURIComponent(cleanPath)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (res.ok) {
      const data = await res.json();
      const rawList = Array.isArray(data)
        ? data
        : Array.isArray(data?.files)
        ? data.files
        : [];

      const normalizedCleanPath = cleanPath === '.' ? '' : cleanPath;

      const mapped: FileItemData[] = rawList.map((item: any) => {
        const itemName = String(item.name || '');
        const itemPath =
          item.path ||
          (normalizedCleanPath ? `${normalizedCleanPath}/${itemName}` : itemName);
        const isFolder =
          item.isDirectory === true ||
          item.type === 'folder' ||
          item.is_dir === true;

        return {
          name: itemName,
          type: isFolder ? 'folder' : 'file',
          size: Number(item.size || 0),
          modified:
            item.updatedAt ||
            item.updated_at ||
            item.modified ||
            item.createdAt ||
            new Date().toISOString(),
          mime_type:
            item.type && item.type !== 'folder'
              ? item.type
              : item.mime_type || item.content_type,
          path: itemPath,
          owner: owner || undefined,
        };
      });

      mapped.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      return { items: mapped };
    }

    if (res.status === 404) {
      return { items: [] };
    }

    return { items: [], error: `Server antwortete mit Fehler (Status ${res.status})` };
  } catch (err: unknown) {
    return {
      items: [],
      error: 'Speicher-Server (https://storage.j-jonas.com) ist derzeit nicht erreichbar.',
    };
  }
}

export const CHUNK_SIZE = 20 * 1024 * 1024; // 20 MB

export interface UploadProgressInfo {
  progressPercent: number;
  currentChunk: number;
  totalChunks: number;
  uploadedBytes: number;
  totalBytes: number;
}

export type UploadProgressCallback = (info: UploadProgressInfo) => void;

/**
 * Fallback-Upload für Einzelanfragen (<= 20 MB) an POST /upload
 */
async function uploadSingleDirect(
  file: File,
  owner: string,
  cleanPath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const formData = new FormData();
    formData.append('user', owner);
    formData.append('path', cleanPath);
    formData.append('file', file);
    formData.append('files', file);

    const uploadUrl = `${STORAGE_BASE_URL}/upload?user=${encodeURIComponent(owner)}&path=${encodeURIComponent(cleanPath)}`;
    const res = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      return { success: true };
    }
    const errText = await res.text().catch(() => '');
    return { success: false, error: errText || `Upload fehlgeschlagen (Status ${res.status})` };
  } catch (err: unknown) {
    return {
      success: false,
      error: 'Upload fehlgeschlagen: Keine Verbindung zum Server (https://storage.j-jonas.com).',
    };
  }
}

/**
 * Sequenzieller Chunked Upload:
 * - Sobald eine Datei größer als 20 MB ist, wird sie in 20-MB-Stücke via file.slice() zerlegt.
 * - Chunks werden nacheinander (sequenziell per await) an POST /upload-chunk gesendet.
 * - Übergibt sowohl als URL-Query-Parameter als auch in FormData:
 *   user, path, fileName, chunkIndex, totalChunks und chunk.
 * - Berechnet den Ladebalken via Math.round(((chunkIndex + 1) / totalChunks) * 100).
 */
export async function uploadFileInChunks(
  file: File,
  owner: string,
  relativePath: string,
  onProgress?: UploadProgressCallback
): Promise<{ success: boolean; error?: string }> {
  const cleanPath = relativePath.trim().replace(/^\/+|\/+$/g, '') || '.';
  const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunkBlob = file.slice(start, end);

    const formData = new FormData();
    formData.append('user', owner);
    formData.append('path', cleanPath);
    formData.append('fileName', file.name);
    formData.append('chunkIndex', String(chunkIndex));
    formData.append('totalChunks', String(totalChunks));
    formData.append('chunk', chunkBlob, file.name);

    const queryParams = new URLSearchParams({
      user: owner,
      path: cleanPath,
      fileName: file.name,
      chunkIndex: String(chunkIndex),
      totalChunks: String(totalChunks),
    });

    const url = `${STORAGE_BASE_URL}/upload-chunk?${queryParams.toString()}`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        // Fallback für Dateien <= 20 MB auf älteren Serverversionen
        if (chunkIndex === 0 && totalChunks === 1 && (res.status === 404 || res.status === 405)) {
          const fallbackRes = await uploadSingleDirect(file, owner, cleanPath);
          if (fallbackRes.success && onProgress) {
            onProgress({
              progressPercent: 100,
              currentChunk: 1,
              totalChunks: 1,
              uploadedBytes: file.size,
              totalBytes: file.size,
            });
          }
          return fallbackRes;
        }

        const errJson = await res.json().catch(() => null);
        const errMsg = errJson?.error || `HTTP ${res.status}`;
        return {
          success: false,
          error: `Upload-Fehler bei Chunk ${chunkIndex + 1}/${totalChunks}: ${errMsg}`,
        };
      }

      // Flüssige Ladebalken-Berechnung gemäß Spezifikation:
      // Math.round(((chunkIndex + 1) / totalChunks) * 100)
      const progressPercent = Math.round(((chunkIndex + 1) / totalChunks) * 100);
      if (onProgress) {
        onProgress({
          progressPercent,
          currentChunk: chunkIndex + 1,
          totalChunks,
          uploadedBytes: end,
          totalBytes: file.size,
        });
      }
    } catch (err: unknown) {
      return {
        success: false,
        error: `Verbindungsabbruch bei Chunk ${chunkIndex + 1}/${totalChunks}: https://storage.j-jonas.com nicht erreichbar.`,
      };
    }
  }

  return { success: true };
}

/**
 * POST /upload oder POST /upload-chunk
 * Multipart-Formdata mit Datei, user (Ordner-Besitzer) und path.
 * Quota-Prüfung vor dem Senden!
 * Dateien > 20 MB laufen automatisch über Chunked Upload (20 MB Chunks).
 */
export async function uploadFile(
  file: File,
  owner: string,
  relativePath: string,
  currentUsageBytes: number,
  quotaGb: number,
  onProgress?: UploadProgressCallback
): Promise<{ success: boolean; error?: string }> {
  const quotaBytes = quotaGb * 1024 * 1024 * 1024;
  if (currentUsageBytes + file.size > quotaBytes) {
    const quotaFormatted = `${quotaGb} GB`;
    return {
      success: false,
      error: `Speicherplatzlimit (${quotaFormatted}) würde durch diese Datei (${(file.size / (1024 * 1024)).toFixed(1)} MB) überschritten werden!`,
    };
  }

  const cleanPath = relativePath.trim().replace(/^\/+|\/+$/g, '') || '.';

  // Sobald eine Datei größer als 20 MB ist (oder generell für zuverlässigen Upload):
  // Chunked Upload via POST /upload-chunk
  return uploadFileInChunks(file, owner, cleanPath, onProgress);
}

/**
 * POST /folders oder POST /mkdir
 * JSON / Query: { user: string, path: string, name: string, folderName: string }
 */
export async function createFolder(
  owner: string,
  relativePath: string,
  folderNameRaw: string
): Promise<{ success: boolean; error?: string }> {
  const folder_name = folderNameRaw.trim();
  if (!folder_name) {
    return { success: false, error: 'Ordnername darf nicht leer sein.' };
  }
  if (/[\\/:*?"<>|]/.test(folder_name)) {
    return { success: false, error: 'Ungültige Sonderzeichen im Ordnernamen.' };
  }

  const cleanPath = relativePath.trim().replace(/^\/+|\/+$/g, '') || '.';

  try {
    const payload = {
      user: owner,
      path: cleanPath,
      name: folder_name,
      folderName: folder_name,
      folder_name,
    };

    const queryParams = `user=${encodeURIComponent(owner)}&path=${encodeURIComponent(cleanPath)}&name=${encodeURIComponent(folder_name)}`;

    // 1. Primär: POST /folders (Mini-PC Backend)
    let res = await fetch(`${STORAGE_BASE_URL}/folders?${queryParams}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // 2. Fallback: POST /mkdir
    if (!res.ok && (res.status === 404 || res.status === 405)) {
      res = await fetch(`${STORAGE_BASE_URL}/mkdir?${queryParams}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    // 3. Fallback: POST /create-folder (Legacy)
    if (!res.ok && (res.status === 404 || res.status === 405)) {
      res = await fetch(`${STORAGE_BASE_URL}/create-folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    if (res.ok) {
      return { success: true };
    }
    const errText = await res.text().catch(() => '');
    return { success: false, error: errText || `Ordner konnte nicht erstellt werden (${res.status})` };
  } catch (err: unknown) {
    return {
      success: false,
      error: 'Verbindungsfehler: Ordnererstellung auf https://storage.j-jonas.com fehlgeschlagen.',
    };
  }
}

/**
 * GET /stream?user=<username>&path=<relative_path>&file=<relative_path>
 * Liefert die direkte Streaming-/Vorschau-URL mit CORS und Range-Unterstützung
 */
export function getStreamUrl(itemPath: string, user?: string): string {
  if (!itemPath) return '';
  if (itemPath.startsWith('http://') || itemPath.startsWith('https://') || itemPath.startsWith('blob:')) {
    return itemPath;
  }
  const clean = itemPath.replace(/^\/+/, '');
  const username = (user || getActiveUser()?.username || '').trim();
  const userParam = username ? `user=${encodeURIComponent(username)}&` : '';

  return `${STORAGE_BASE_URL}/stream?${userParam}path=${encodeURIComponent(clean)}&file=${encodeURIComponent(clean)}`;
}

/**
 * GET /download?user=<owner>&path=<relative_path>&file=<relative_path>
 * Direkter Download im Browser.
 */
export function triggerDirectDownload(owner: string, filePath: string, filename: string): void {
  const cleanPath = filePath.trim().replace(/^\/+/, '');
  const username = (owner || getActiveUser()?.username || '').trim();
  const userParam = username ? `user=${encodeURIComponent(username)}&` : '';
  const downloadUrl = `${STORAGE_BASE_URL}/download?${userParam}path=${encodeURIComponent(cleanPath)}&file=${encodeURIComponent(cleanPath)}`;

  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = filename || cleanPath.split('/').pop() || 'download';
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * DELETE /delete-user?user=<username>
 * Löscht das gesamte Verzeichnis des Nutzers vom Server.
 */
export async function deleteUserServerDirectory(username: string): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Try /delete-user endpoint
    const res = await fetch(`${STORAGE_BASE_URL}/delete-user?user=${encodeURIComponent(username)}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      return { success: true };
    }

    // 2. Fallback to /delete root item
    const fallbackRes = await fetch(
      `${STORAGE_BASE_URL}/delete?user=${encodeURIComponent(username)}&item=&path=`,
      { method: 'DELETE' }
    );

    if (fallbackRes.ok) {
      return { success: true };
    }

    const err = await res.text().catch(() => '');
    return {
      success: false,
      error: err || `Server antwortete mit Fehler (Status ${res.status})`,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: 'Keine Verbindung zu https://storage.j-jonas.com',
    };
  }
}

/**
 * DELETE /delete?user=<owner>&item=<relative_path>&path=<relative_path>
 * Löscht eine Datei oder einen Ordner auf dem Server.
 */
export async function deleteItem(
  owner: string,
  relativePath: string,
  itemName: string
): Promise<{ success: boolean; error?: string }> {
  const cleanPath = relativePath.trim().replace(/^\/+|\/+$/g, '');
  const itemFullPath = cleanPath ? `${cleanPath}/${itemName}` : itemName;

  try {
    const queryParams = `user=${encodeURIComponent(owner)}&item=${encodeURIComponent(itemFullPath)}&path=${encodeURIComponent(itemFullPath)}`;
    const payload = {
      user: owner,
      item: itemFullPath,
      path: itemFullPath,
    };

    // 1. DELETE /delete mit Query-Parametern und Body
    let res = await fetch(`${STORAGE_BASE_URL}/delete?${queryParams}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      return { success: true };
    }

    // 2. Fallback: DELETE /files
    if (res.status === 404 || res.status === 405) {
      res = await fetch(`${STORAGE_BASE_URL}/files?${queryParams}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        return { success: true };
      }
    }

    const errText = await res.text().catch(() => '');
    return { success: false, error: errText || `Löschen fehlgeschlagen (Status ${res.status})` };
  } catch (err: unknown) {
    return {
      success: false,
      error: 'Verbindungsfehler: Element konnte auf dem Server nicht gelöscht werden.',
    };
  }
}

/**
 * POST /rename oder PUT /rename
 * Parameter: user, old_path / oldPath, new_name / newName, new_path / newPath
 */
export async function renameItem(
  owner: string,
  relativePath: string,
  oldName: string,
  newName: string
): Promise<{ success: boolean; error?: string }> {
  const cleanPath = relativePath.trim().replace(/^\/+|\/+$/g, '');
  const oldPath = cleanPath ? `${cleanPath}/${oldName}` : oldName;
  const newPath = cleanPath ? `${cleanPath}/${newName}` : newName;

  try {
    const payload = {
      user: owner,
      old_path: oldPath,
      oldPath: oldPath,
      new_name: newName,
      newName: newName,
      new_path: newPath,
      newPath: newPath,
      path: oldPath,
      name: newName,
    };

    const queryParams = `user=${encodeURIComponent(owner)}`;

    // 1. POST /rename
    let res = await fetch(`${STORAGE_BASE_URL}/rename?${queryParams}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      return { success: true };
    }

    // 2. Fallback: PUT /rename
    if (res.status === 404 || res.status === 405) {
      res = await fetch(`${STORAGE_BASE_URL}/rename?${queryParams}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        return { success: true };
      }
    }

    const err = await res.text().catch(() => '');
    return { success: false, error: err || `Umbenennen fehlgeschlagen (${res.status})` };
  } catch {
    return {
      success: false,
      error: 'Umbenennen fehlgeschlagen: Der Server unterstützt diesen Endpunkt nicht oder ist offline.',
    };
  }
}

/**
 * GET /metadata?path=relativer/pfad/datei.ext
 * Erwartete Antwort: { description: "..." }
 */
export async function getFileMetadata(
  relativePath: string
): Promise<{ description: string; error?: string }> {
  const cleanPath = relativePath.trim().replace(/^\/+/, '');
  try {
    const res = await fetch(`${STORAGE_BASE_URL}/metadata?path=${encodeURIComponent(cleanPath)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (res.ok) {
      const data = await res.json();
      return { description: typeof data?.description === 'string' ? data.description : '' };
    }
    return { description: '' };
  } catch {
    return { description: '' };
  }
}

/**
 * POST /set-metadata
 * JSON: { "path": "relativer/pfad/datei.ext", "description": "Text..." }
 */
export async function setFileMetadata(
  relativePath: string,
  description: string
): Promise<{ success: boolean; error?: string }> {
  const cleanPath = relativePath.trim().replace(/^\/+/, '');
  try {
    const res = await fetch(`${STORAGE_BASE_URL}/set-metadata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: cleanPath,
        description: description.trim(),
      }),
    });

    if (res.ok) {
      return { success: true };
    }
    const err = await res.text().catch(() => '');
    return { success: false, error: err || `Metadaten konnten nicht gespeichert werden (${res.status})` };
  } catch {
    return {
      success: false,
      error: 'Verbindungsfehler: Metadaten konnten nicht an den Server übertragen werden.',
    };
  }
}

/**
 * Liefert die direkte öffentliche Download-/Stream-URL:
 * GET /public/{username}/{path}
 */
export function getPublicDownloadUrl(username: string, relativePath: string): string {
  const cleanPath = relativePath.trim().replace(/^\/+/, '');
  return `${STORAGE_BASE_URL}/public/${encodeURIComponent(username)}/${cleanPath}`;
}

/**
 * Ruft den öffentlichen Ordnerinhalt ab:
 * GET /public-files/{username}/{path}
 */
export async function getPublicFolderFiles(
  username: string,
  relativePath: string
): Promise<{ isFolder: boolean; items: FileItemData[]; error?: string }> {
  const cleanPath = relativePath.trim().replace(/^\/+|\/+$/g, '');
  try {
    const res = await fetch(
      `${STORAGE_BASE_URL}/public-files/${encodeURIComponent(username)}/${cleanPath ? encodeURIComponent(cleanPath) : ''}`,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
      }
    );

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        const mapped: FileItemData[] = data.map((item: any) => {
          const itemName = String(item.name || item.filename || 'Datei');
          const itemPath = item.path || (cleanPath ? `${cleanPath}/${itemName}` : itemName);
          return {
            name: itemName,
            type: item.type === 'folder' || item.is_dir ? 'folder' : 'file',
            size: Number(item.size || 0),
            modified: item.modified || item.updated_at || new Date().toISOString(),
            mime_type: item.mime_type || item.content_type,
            path: itemPath,
          };
        });
        return { isFolder: true, items: mapped };
      }
    }
    return { isFolder: false, items: [] };
  } catch {
    return { isFolder: false, items: [] };
  }
}

/**
 * Automatische Titel-Verschönerung:
 * Bei Videodateien die Dateiendung (.mp4, .mkv, .webm etc.) ausblenden,
 * Unterstriche (_) und Bindestriche (-) durch Leerzeichen ersetzen und
 * Wörter mit großem Anfangsbuchstaben formatieren (z. B. "der-beste-film.mp4" -> "Der Beste Film").
 */
export function formatCleanTitle(filename: string): string {
  if (!filename) return '';
  // Dateiendung entfernen
  const withoutExt = filename.replace(/\.(mp4|mkv|webm|avi|mov|m4v|flv|wmv|ts|3gp|m4a|mp3)$/i, '')
    .replace(/\.[a-zA-Z0-9]{2,4}$/, '');

  // Unterstriche und Bindestriche durch Leerzeichen ersetzen
  const withSpaces = withoutExt.replace(/[_\-]+/g, ' ').trim();
  if (!withSpaces) return filename;

  // Wörter mit großem Anfangsbuchstaben formatieren
  return withSpaces
    .split(/\s+/)
    .map((word) => {
      if (!word) return '';
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

export interface VideoCategory {
  id: string;
  title: string;
  folderPath: string;
  videos: FileItemData[];
}

// Format bytes
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

