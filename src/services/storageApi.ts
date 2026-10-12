import type { FileItemData, StorageUsage } from '../types';

// Feste Konstante gemäß Vorgabe – kein Einstellungsfenster / keine dynamische Überschreibung
export const STORAGE_BASE_URL = 'https://storage.j-jonas.com';

export interface ServerStatus {
  isOnline: boolean;
  latencyMs?: number;
  error?: string;
}

/**
 * Prüft die Erreichbarkeit des Mini-PC FastAPI Backends (https://storage.j-jonas.com).
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
 * Liefert { used_bytes: number, used_gb: number } direkt vom Server.
 */
export async function getStorageUsage(username: string): Promise<StorageUsage> {
  try {
    const res = await fetch(`${STORAGE_BASE_URL}/storage-usage?user=${encodeURIComponent(username)}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      const used_bytes = Number(data.used_bytes || 0);
      const used_gb = Number(
        data.used_gb !== undefined ? data.used_gb : (used_bytes / (1024 * 1024 * 1024)).toFixed(2)
      );
      return { used_bytes, used_gb };
    }
  } catch (err) {
    // Kein Fallback-Mock: Server nicht erreichbar
  }
  return { used_bytes: 0, used_gb: 0 };
}

/**
 * GET /files?user=<owner>&path=<relative_path>
 * Liefert die Liste aller echten Dateien und Ordner.
 * Wenn keine Dateien auf dem Server liegen oder Server offline ist, wird ein leeres Array geliefert.
 */
export async function listFiles(owner: string, relativePath = ''): Promise<{ items: FileItemData[]; error?: string }> {
  const cleanPath = relativePath.trim().replace(/^\/+|\/+$/g, '');

  try {
    const url = `${STORAGE_BASE_URL}/files?user=${encodeURIComponent(owner)}&path=${encodeURIComponent(cleanPath)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        const mapped: FileItemData[] = data.map((item: any) => ({
          name: String(item.name),
          type: item.type === 'folder' || item.is_dir ? 'folder' : 'file',
          size: Number(item.size || 0),
          modified: item.modified || item.updated_at || new Date().toISOString(),
          mime_type: item.mime_type || item.content_type,
        }));

        mapped.sort((a, b) => {
          if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

        return { items: mapped };
      }
      return { items: [] };
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

/**
 * POST /upload
 * Multipart-Formdata mit Datei, user (Ordner-Besitzer) und path.
 * Quota-Prüfung vor dem Senden!
 */
export async function uploadFile(
  file: File,
  owner: string,
  relativePath: string,
  currentUsageBytes: number,
  quotaGb: number
): Promise<{ success: boolean; error?: string }> {
  const quotaBytes = quotaGb * 1024 * 1024 * 1024;
  if (currentUsageBytes + file.size > quotaBytes) {
    const quotaFormatted = `${quotaGb} GB`;
    return {
      success: false,
      error: `Speicherplatzlimit (${quotaFormatted}) würde durch diese Datei (${(file.size / (1024 * 1024)).toFixed(1)} MB) überschritten werden!`,
    };
  }

  const cleanPath = relativePath.trim().replace(/^\/+|\/+$/g, '');

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('user', owner);
    formData.append('path', cleanPath);

    const res = await fetch(`${STORAGE_BASE_URL}/upload`, {
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
 * POST /create-folder
 * JSON: { user: string, path: string, folder_name: string }
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

  const cleanPath = relativePath.trim().replace(/^\/+|\/+$/g, '');

  try {
    const res = await fetch(`${STORAGE_BASE_URL}/create-folder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: owner,
        path: cleanPath,
        folder_name,
      }),
    });

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
 * GET /download?user=<owner>&file=<relative_path>
 * Direkter Download im Browser.
 */
export function triggerDirectDownload(owner: string, filePath: string, filename: string): void {
  const cleanPath = filePath.trim().replace(/^\/+/, '');
  const downloadUrl = `${STORAGE_BASE_URL}/download?user=${encodeURIComponent(owner)}&file=${encodeURIComponent(cleanPath)}`;

  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = filename;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * DELETE /delete-user?user=<username>
 * Löscht das gesamte physische Verzeichnis des Nutzers (/media/ssd/users/<username>/) vom Server.
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
      `${STORAGE_BASE_URL}/delete?user=${encodeURIComponent(username)}&item=`,
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
 * DELETE /delete?user=<owner>&item=<relative_path>
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
    const res = await fetch(
      `${STORAGE_BASE_URL}/delete?user=${encodeURIComponent(owner)}&item=${encodeURIComponent(itemFullPath)}`,
      {
        method: 'DELETE',
      }
    );

    if (res.ok) {
      return { success: true };
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
 * POST /rename
 * Falls der Server Umbenennung unterstützt, sonst Meldung.
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
    const res = await fetch(`${STORAGE_BASE_URL}/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: owner,
        old_path: oldPath,
        new_path: newPath,
      }),
    });

    if (res.ok) {
      return { success: true };
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

// Format bytes
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
