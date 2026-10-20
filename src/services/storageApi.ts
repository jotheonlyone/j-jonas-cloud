import type { FileItemData, StorageUsage } from '../types';
import { getActiveUser, CURRENT_USER_KEY } from './accountManager';
import { sanitizeUploadFileName, validateItemName } from '../utils/nameSanitizer';
import { auth, getCachedAuthToken, setCachedAuthToken, getAuthToken } from './firebase';

// Feste Konstante gemäß Vorgabe – kein Einstellungsfenster / keine dynamische Überschreibung
export const STORAGE_BASE_URL = 'https://storage.j-jonas.com';

export interface ServerStatus {
  isOnline: boolean;
  latencyMs?: number;
  error?: string;
}

/**
 * 2. Token-Mitsendung bei API-Aufrufen (Fetch / Axios):
 *    - Hole vor jedem Aufruf das aktuelle Token via:
 *      const token = await auth.currentUser.getIdToken();
 *    - Hänge das Token in den Header:
 *      headers: {
 *        'Authorization': `Bearer ${token}`
 *      }
 *
 * 4. Token-Refresh & Session:
 *    - Fange 401-Fehler (Unauthorized) ab: Versuche das Token einmalig mit getIdToken(true) zu aktualisieren und die Anfrage zu wiederholen.
 *      Schlägt dies fehl, leite auf den Login weiter.
 */
export async function storageFetch(
  input: string | URL,
  init: RequestInit = {},
  isRetry = false
): Promise<Response> {
  let token: string | null = null;

  if (auth.currentUser) {
    try {
      token = await auth.currentUser.getIdToken(isRetry);
      if (token) setCachedAuthToken(token);
    } catch (err) {
      console.warn('Failed getting Firebase ID token:', err);
    }
  }

  // Fallback to cached token if currentUser is not immediately ready
  if (!token) {
    token = getCachedAuthToken();
  }

  const headers = new Headers(init.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(input, {
    ...init,
    headers,
  });

  // 401 Unauthorized handling
  if (response.status === 401) {
    if (!isRetry && auth.currentUser) {
      console.warn('Storage backend returned 401 Unauthorized. Retrying with refreshed ID token...');
      try {
        const refreshedToken = await auth.currentUser.getIdToken(true);
        if (refreshedToken) {
          setCachedAuthToken(refreshedToken);
          return storageFetch(input, init, true);
        }
      } catch (refreshErr) {
        console.error('Failed to refresh Firebase ID token:', refreshErr);
      }
    }

    // Refresh failed or second 401 error: redirect to login
    handleAuthSessionExpired();
  }

  return response;
}

export function handleAuthSessionExpired(): void {
  if (typeof window !== 'undefined') {
    try {
      setCachedAuthToken('');
      localStorage.removeItem(CURRENT_USER_KEY);
      window.dispatchEvent(new CustomEvent('jjcloud:session-expired'));
    } catch {}
  }
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
    const res = await storageFetch(`${STORAGE_BASE_URL}/storage-usage?user=ping_check`, {
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
    const res = await storageFetch(`${STORAGE_BASE_URL}/storage-usage?user=${encodeURIComponent(username)}`, {
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
    const res = await storageFetch(url, {
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
          id: item.id || itemPath || itemName,
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
          metadata:
            item.metadata && typeof item.metadata === 'object'
              ? item.metadata
              : item.description
              ? { description: String(item.description) }
              : undefined,
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

export const CHUNK_SIZE = 50 * 1024 * 1024; // 50 MB

export interface UploadProgressInfo {
  progressPercent: number;
  currentChunk: number;
  totalChunks: number;
  uploadedBytes: number;
  totalBytes: number;
}

export type UploadProgressCallback = (info: UploadProgressInfo) => void;

/**
 * Fallback-Upload für Einzelanfragen (<= 50 MB) an POST /upload
 */
async function uploadSingleDirect(
  file: File,
  owner: string,
  cleanPath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const safeFileName = sanitizeUploadFileName(file.name);
    const formData = new FormData();
    formData.append('user', owner);
    formData.append('path', cleanPath);
    formData.append('file', file, safeFileName);
    formData.append('files', file, safeFileName);
    formData.append('fileName', safeFileName);

    const uploadUrl = `${STORAGE_BASE_URL}/upload?user=${encodeURIComponent(owner)}&path=${encodeURIComponent(cleanPath)}&fileName=${encodeURIComponent(safeFileName)}`;
    const res = await storageFetch(uploadUrl, {
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
 * - Sobald eine Datei größer als 50 MB ist, wird sie in 50-MB-Stücke via file.slice() zerlegt.
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
  const safeFileName = sanitizeUploadFileName(file.name);

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunkBlob = file.slice(start, end);

    const formData = new FormData();
    formData.append('user', owner);
    formData.append('path', cleanPath);
    formData.append('fileName', safeFileName);
    formData.append('chunkIndex', String(chunkIndex));
    formData.append('totalChunks', String(totalChunks));
    formData.append('chunk', chunkBlob, safeFileName);

    const queryParams = new URLSearchParams({
      user: owner,
      path: cleanPath,
      fileName: safeFileName,
      chunkIndex: String(chunkIndex),
      totalChunks: String(totalChunks),
    });

    const url = `${STORAGE_BASE_URL}/upload-chunk?${queryParams.toString()}`;

    try {
      const res = await storageFetch(url, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        // Fallback für Dateien <= 50 MB auf älteren Serverversionen
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
 * Dateien > 50 MB laufen automatisch über Chunked Upload (50 MB Chunks).
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

  // Sobald eine Datei größer als 50 MB ist (oder generell für zuverlässigen Upload):
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
    let res = await storageFetch(`${STORAGE_BASE_URL}/folders?${queryParams}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // 2. Fallback: POST /mkdir
    if (!res.ok && (res.status === 404 || res.status === 405)) {
      res = await storageFetch(`${STORAGE_BASE_URL}/mkdir?${queryParams}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    // 3. Fallback: POST /create-folder (Legacy)
    if (!res.ok && (res.status === 404 || res.status === 405)) {
      res = await storageFetch(`${STORAGE_BASE_URL}/create-folder`, {
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
 * GET /stream?user=<username>&path=<relative_path>&token=<token>
 * Liefert die direkte Streaming-/Vorschau-URL mit CORS und Range-Unterstützung.
 * Hängt das Token als URL-Parameter an: /stream?user=${user}&path=${encodeURIComponent(path)}&token=${encodeURIComponent(token)}
 */
export function getStreamUrl(itemPath: string, user?: string, explicitToken?: string): string {
  if (!itemPath) return '';
  if (itemPath.startsWith('blob:')) {
    return itemPath;
  }
  const token = explicitToken || getCachedAuthToken();
  const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';

  if (itemPath.startsWith('http://') || itemPath.startsWith('https://')) {
    if (token && itemPath.includes('storage.j-jonas.com') && !itemPath.includes('token=')) {
      const sep = itemPath.includes('?') ? '&' : '?';
      return `${itemPath}${sep}token=${encodeURIComponent(token)}`;
    }
    return itemPath;
  }

  const clean = itemPath.replace(/^\/+/, '');
  const username = (user || getActiveUser()?.username || '').trim();
  const userParam = username ? `user=${encodeURIComponent(username)}&` : '';

  return `${STORAGE_BASE_URL}/stream?${userParam}path=${encodeURIComponent(clean)}&file=${encodeURIComponent(clean)}${tokenParam}`;
}

/**
 * Liefert die direkte URL zum serverseitig generierten Video-Vorschaubild (FFmpeg / WebP).
 * GET /thumbnail?user=${user}&path=${encodeURIComponent(path)}&token=${encodeURIComponent(token)}
 */
export function getThumbnailUrl(item: FileItemData | string, user?: string, explicitToken?: string): string {
  if (!item) return '';

  const activeUsername = getActiveUser()?.username || '';
  let filePath = '';
  let itemOwner = '';

  const token = explicitToken || getCachedAuthToken();
  const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';

  if (typeof item === 'string') {
    if (item.startsWith('data:') || item.startsWith('blob:')) {
      return item;
    }
    if (item.startsWith('http://') || item.startsWith('https://')) {
      if (token && item.includes('storage.j-jonas.com') && !item.includes('token=')) {
        const sep = item.includes('?') ? '&' : '?';
        return `${item}${sep}token=${encodeURIComponent(token)}`;
      }
      return item;
    }
    filePath = item;
    itemOwner = user || activeUsername;
  } else {
    filePath = item.path || item.name || '';
    itemOwner = item.owner || user || activeUsername;
  }

  // Sicherstellen, dass der relative Pfad sauber und ohne führende Slashes ist
  const cleanPath = filePath.replace(/^\/+/, '').trim();
  if (!cleanPath) return '';

  // Sicherstellen, dass currentUser niemals leer oder undefined ist
  const currentUser = (itemOwner || activeUsername || user || 'user').trim() || 'user';

  return `${STORAGE_BASE_URL}/thumbnail?user=${encodeURIComponent(currentUser)}&path=${encodeURIComponent(cleanPath)}${tokenParam}`;
}

/**
 * GET /download?user=<owner>&path=<relative_path>&download=true&token=<token>
 * Direkter Download im Browser mit Token.
 */
export async function triggerDirectDownload(owner: string, filePath: string, filename: string): Promise<void> {
  const cleanPath = filePath.trim().replace(/^\/+/, '');
  const username = (owner || getActiveUser()?.username || '').trim();
  const userParam = username ? `user=${encodeURIComponent(username)}&` : '';
  const token = await getAuthToken();
  const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
  const downloadUrl = `${STORAGE_BASE_URL}/download?${userParam}path=${encodeURIComponent(cleanPath)}&download=true${tokenParam}`;

  const a = document.createElement('a');
  a.href = downloadUrl;
  a.setAttribute('download', filename || cleanPath.split('/').pop() || 'download');
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
    const res = await storageFetch(`${STORAGE_BASE_URL}/delete-user?user=${encodeURIComponent(username)}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      return { success: true };
    }

    // 2. Fallback to /delete root item
    const fallbackRes = await storageFetch(
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
    let res = await storageFetch(`${STORAGE_BASE_URL}/delete?${queryParams}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      return { success: true };
    }

    // 2. Fallback: DELETE /files
    if (res.status === 404 || res.status === 405) {
      res = await storageFetch(`${STORAGE_BASE_URL}/files?${queryParams}`, {
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
    let res = await storageFetch(`${STORAGE_BASE_URL}/rename?${queryParams}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      return { success: true };
    }

    // 2. Fallback: PUT /rename
    if (res.status === 404 || res.status === 405) {
      res = await storageFetch(`${STORAGE_BASE_URL}/rename?${queryParams}`, {
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

export interface FileTransferOptions {
  sourceOwner?: string;
  targetOwner?: string;
  targetFolderId?: string;
  actingUser?: string;
  canWrite?: boolean;
}

/**
 * POST /api/files/copy or POST /copy
 * Supports options for sourceOwner, targetOwner, targetFolderId, actingUser, and canWrite.
 */
export async function copyItem(
  user: string,
  sourcePath: string,
  destinationPath: string,
  options?: FileTransferOptions
): Promise<{ success: boolean; error?: string }> {
  const cleanSource = sourcePath.trim().replace(/^\/+/, '');
  const cleanDest = destinationPath.trim().replace(/^\/+/, '');
  const targetOwner = options?.targetOwner || user.trim();
  const sourceOwner = options?.sourceOwner || user.trim();
  const actingUser = options?.actingUser || user.trim();

  // 1. Try local full-stack endpoint /api/files/copy with authorization check
  try {
    const localRes = await storageFetch('/api/files/copy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: targetOwner,
        sourcePath: cleanSource,
        destinationPath: cleanDest,
        sourceOwner,
        targetOwner,
        targetFolderId: options?.targetFolderId,
        actingUser,
        canWrite: options?.canWrite ?? true,
      }),
    });
    if (localRes.ok) {
      const data = await localRes.json().catch(() => ({}));
      if (data.success !== false) {
        return { success: true };
      }
    } else if (localRes.status === 403) {
      const errData = await localRes.json().catch(() => ({}));
      return {
        success: false,
        error: errData.error || 'Zugriff verweigert: Keine Schreibrechte auf den Zielordner.',
      };
    }
  } catch {
    // Local route fallback
  }

  // 2. Direct remote backend POST /copy (or /files/copy)
  try {
    const payload = {
      user: targetOwner,
      owner: targetOwner,
      targetUser: targetOwner,
      targetOwner,
      sourceUser: sourceOwner,
      sourceOwner,
      sourcePath: cleanSource,
      destinationPath: cleanDest,
      source_path: cleanSource,
      destination_path: cleanDest,
      targetFolderId: options?.targetFolderId,
      target_folder_id: options?.targetFolderId,
      actingUser,
      acting_user: actingUser,
      canWrite: options?.canWrite ?? true,
      can_write: options?.canWrite ?? true,
    };

    let res = await storageFetch(`${STORAGE_BASE_URL}/copy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok && (res.status === 404 || res.status === 405)) {
      res = await storageFetch(`${STORAGE_BASE_URL}/files/copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    if (res.ok) {
      return { success: true };
    }

    // 3. Fallback for cross-user copy: download source stream and upload to target
    if (sourceOwner.toLowerCase() !== targetOwner.toLowerCase()) {
      try {
        const streamUrl = getStreamUrl(cleanSource, sourceOwner);
        const fileRes = await storageFetch(streamUrl);
        if (fileRes.ok) {
          const blob = await fileRes.blob();
          const fileName = cleanDest.split('/').pop() || cleanSource.split('/').pop() || 'file';
          const targetDir = cleanDest.includes('/') ? cleanDest.substring(0, cleanDest.lastIndexOf('/')) : '';
          const fileObj = new File([blob], fileName, { type: blob.type });
          const uploadRes = await uploadFile(fileObj, targetOwner, targetDir, 0, 999999);
          if (uploadRes.success) {
            return { success: true };
          }
        }
      } catch (streamErr) {
        console.warn('Fallback stream copy failed:', streamErr);
      }
    }

    const errData = await res.json().catch(() => ({}));
    return {
      success: false,
      error: errData.error || errData.message || `Kopieren fehlgeschlagen (${res.status})`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Netzwerkfehler beim Kopieren.',
    };
  }
}

/**
 * POST /api/files/move or POST /move
 * Supports options for sourceOwner, targetOwner, targetFolderId, actingUser, and canWrite.
 */
export async function moveItem(
  user: string,
  sourcePath: string,
  destinationPath: string,
  options?: FileTransferOptions
): Promise<{ success: boolean; error?: string }> {
  const cleanSource = sourcePath.trim().replace(/^\/+/, '');
  const cleanDest = destinationPath.trim().replace(/^\/+/, '');
  const targetOwner = options?.targetOwner || user.trim();
  const sourceOwner = options?.sourceOwner || user.trim();
  const actingUser = options?.actingUser || user.trim();

  // 1. Try local full-stack endpoint /api/files/move with authorization check
  try {
    const localRes = await storageFetch('/api/files/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: targetOwner,
        sourcePath: cleanSource,
        destinationPath: cleanDest,
        sourceOwner,
        targetOwner,
        targetFolderId: options?.targetFolderId,
        actingUser,
        canWrite: options?.canWrite ?? true,
      }),
    });
    if (localRes.ok) {
      const data = await localRes.json().catch(() => ({}));
      if (data.success !== false) {
        return { success: true };
      }
    } else if (localRes.status === 403) {
      const errData = await localRes.json().catch(() => ({}));
      return {
        success: false,
        error: errData.error || 'Zugriff verweigert: Keine Schreibrechte auf den Zielordner.',
      };
    }
  } catch {
    // Local route fallback
  }

  // 2. Direct remote backend POST /move (or /files/move)
  try {
    const payload = {
      user: targetOwner,
      owner: targetOwner,
      targetUser: targetOwner,
      targetOwner,
      sourceUser: sourceOwner,
      sourceOwner,
      sourcePath: cleanSource,
      destinationPath: cleanDest,
      source_path: cleanSource,
      destination_path: cleanDest,
      targetFolderId: options?.targetFolderId,
      target_folder_id: options?.targetFolderId,
      actingUser,
      acting_user: actingUser,
      canWrite: options?.canWrite ?? true,
      can_write: options?.canWrite ?? true,
    };

    let res = await storageFetch(`${STORAGE_BASE_URL}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok && (res.status === 404 || res.status === 405)) {
      res = await storageFetch(`${STORAGE_BASE_URL}/files/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    if (res.ok) {
      return { success: true };
    }

    // 3. Fallback for cross-user move: copy then delete source
    if (sourceOwner.toLowerCase() !== targetOwner.toLowerCase()) {
      try {
        const streamUrl = getStreamUrl(cleanSource, sourceOwner);
        const fileRes = await storageFetch(streamUrl);
        if (fileRes.ok) {
          const blob = await fileRes.blob();
          const fileName = cleanDest.split('/').pop() || cleanSource.split('/').pop() || 'file';
          const targetDir = cleanDest.includes('/') ? cleanDest.substring(0, cleanDest.lastIndexOf('/')) : '';
          const fileObj = new File([blob], fileName, { type: blob.type });
          const uploadRes = await uploadFile(fileObj, targetOwner, targetDir, 0, 999999);
          if (uploadRes.success) {
            const delDir = cleanSource.includes('/') ? cleanSource.substring(0, cleanSource.lastIndexOf('/')) : '';
            const delName = cleanSource.split('/').pop() || cleanSource;
            await deleteItem(sourceOwner, delDir, delName).catch(() => {});
            return { success: true };
          }
        }
      } catch (streamErr) {
        console.warn('Fallback stream move failed:', streamErr);
      }
    }

    const errData = await res.json().catch(() => ({}));
    return {
      success: false,
      error: errData.error || errData.message || `Verschieben fehlgeschlagen (${res.status})`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Netzwerkfehler beim Verschieben.',
    };
  }
}

/**
 * GET /metadata?user=<owner>&path=relativer/pfad/datei.ext
 * Erwartete Antwort: { metadata: { description: "..." } } oder { description: "..." }
 */
export async function getFileMetadata(
  relativePath: string,
  user?: string
): Promise<{ description: string; metadata?: any; error?: string }> {
  const cleanPath = relativePath.trim().replace(/^\/+/, '');
  const username = (user || getActiveUser()?.username || '').trim();
  const userParam = username ? `user=${encodeURIComponent(username)}&` : '';

  try {
    const res = await storageFetch(`${STORAGE_BASE_URL}/metadata?${userParam}path=${encodeURIComponent(cleanPath)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (res.ok) {
      const data = await res.json();
      const desc =
        typeof data?.metadata?.description === 'string'
          ? data.metadata.description
          : typeof data?.description === 'string'
          ? data.description
          : '';
      return { description: desc, metadata: data?.metadata || data };
    }
    return { description: '' };
  } catch {
    return { description: '' };
  }
}

/**
 * POST /set-metadata
 * Request-Body (JSON):
 * {
 *   "user": ownerOrUser,
 *   "path": filePath,
 *   "metadata": {
 *     "description": "Hier steht die Beschreibung"
 *   }
 * }
 */
export async function setFileMetadata(
  relativePath: string,
  description: string,
  user?: string
): Promise<{ success: boolean; error?: string }> {
  const cleanPath = relativePath.trim().replace(/^\/+/, '');
  const username = (user || getActiveUser()?.username || '').trim();

  try {
    const payload = {
      user: username,
      path: cleanPath,
      metadata: {
        description: description.trim(),
      },
      // Root-Feld zur zusätzlichen Kompatibilität
      description: description.trim(),
    };

    const res = await storageFetch(`${STORAGE_BASE_URL}/set-metadata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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
 * Liefert die direkte öffentliche Streaming-/Vorschau-URL:
 * GET /stream?user={username}&path={encodedPath} bzw. /public/{username}/{encodedPath}
 */
export function getPublicStreamUrl(username: string, relativePath: string): string {
  const cleanPath = relativePath.trim().replace(/^\/+/, '');
  return `${STORAGE_BASE_URL}/stream?user=${encodeURIComponent(username)}&path=${encodeURIComponent(cleanPath)}`;
}

/**
 * Liefert die direkte öffentliche Download-URL:
 * GET /download?user={username}&path={encodedPath}&download=true
 */
export function getPublicDownloadUrl(username: string, relativePath: string): string {
  const cleanPath = relativePath.trim().replace(/^\/+/, '');
  return `${STORAGE_BASE_URL}/download?user=${encodeURIComponent(username)}&path=${encodeURIComponent(cleanPath)}&download=true`;
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
    const res = await storageFetch(
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

