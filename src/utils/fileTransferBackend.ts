import { hasFolderWritePermission } from './permissions';
import { getSharedFolder, db, normalizeShareDoc } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';

const STORAGE_BASE_URL = 'https://storage.j-jonas.com';

export interface FileActionPayload {
  user?: string;
  actingUser?: string;
  sourcePath: string;
  destinationPath: string;
  sourceOwner?: string;
  targetOwner?: string;
  targetFolderId?: string;
  canWrite?: boolean;
}

/**
 * Validates whether the acting user is authorized to perform write operations (copy/move/paste)
 * into the target destination.
 * 
 * CRITICAL: Checks whether user has write/editor permissions on targetFolderId or target folder,
 * and does NOT reject simply because user is not the owner!
 */
export async function validateTransferAuthorization(
  payload: FileActionPayload
): Promise<{ authorized: boolean; reason?: string }> {
  const actingUser = (payload.actingUser || payload.user || '').trim().toLowerCase();
  const targetOwner = (payload.targetOwner || payload.user || '').trim().toLowerCase();

  if (!actingUser) {
    return { authorized: false, reason: 'Kein Benutzer angegeben.' };
  }

  // 1. If target belongs to the user themselves, owner always has full write permissions
  if (targetOwner && targetOwner === actingUser) {
    return { authorized: true };
  }

  // 2. Check by targetFolderId if provided
  if (payload.targetFolderId) {
    try {
      const snap = await getDoc(doc(db, 'shares', payload.targetFolderId));
      if (snap.exists()) {
        const share = normalizeShareDoc({ ...snap.data(), id: snap.id });
        if (hasFolderWritePermission(share, actingUser)) {
          return { authorized: true };
        }
        return { authorized: false, reason: 'Keine Schreibrechte für diesen geteilten Ordner (nur Leserechte).' };
      }
    } catch (err) {
      console.warn('Error verifying share by targetFolderId:', err);
    }
  }

  // 3. Check by targetOwner and destination folder path
  if (targetOwner && payload.destinationPath) {
    try {
      const rootFolder = payload.destinationPath.trim().replace(/^\/+/, '').split('/')[0];
      if (rootFolder) {
        const share = await getSharedFolder(rootFolder, targetOwner);
        if (share) {
          if (hasFolderWritePermission(share, actingUser)) {
            return { authorized: true };
          }
          return { authorized: false, reason: 'Keine Schreibrechte für diesen geteilten Ordner.' };
        }
      }
    } catch (err) {
      console.warn('Error verifying share by folder path:', err);
    }
  }

  // 4. If payload explicitly confirmed write permissions (e.g., from verified client session)
  if (payload.canWrite === true) {
    return { authorized: true };
  }

  // If user is not the owner and not an invited member with write rights
  return {
    authorized: false,
    reason: `Zugriff verweigert: Nutzer @${actingUser} besitzt keine Schreibrechte für den Zielordner von @${targetOwner}.`,
  };
}

/**
 * Handles the copy or move action on the backend with authorization verification.
 */
export async function handleBackendFileAction(
  action: 'copy' | 'move',
  payload: FileActionPayload
): Promise<{ success: boolean; error?: string; status?: number }> {
  // 1. Verify authorization
  const auth = await validateTransferAuthorization(payload);
  if (!auth.authorized) {
    return {
      success: false,
      error: auth.reason || 'Zugriff verweigert: Keine Schreibrechte.',
      status: 403,
    };
  }

  // 2. Forward authorized action to storage service
  const cleanSource = payload.sourcePath.trim().replace(/^\/+/, '');
  const cleanDest = payload.destinationPath.trim().replace(/^\/+/, '');
  const effectiveTargetOwner = payload.targetOwner || payload.user || '';
  const effectiveSourceOwner = payload.sourceOwner || payload.actingUser || payload.user || '';

  const forwardPayload = {
    user: effectiveTargetOwner,
    owner: effectiveTargetOwner,
    targetOwner: effectiveTargetOwner,
    sourceOwner: effectiveSourceOwner,
    targetUser: effectiveTargetOwner,
    sourceUser: effectiveSourceOwner,
    sourcePath: cleanSource,
    destinationPath: cleanDest,
    source_path: cleanSource,
    destination_path: cleanDest,
    targetFolderId: payload.targetFolderId,
    target_folder_id: payload.targetFolderId,
    actingUser: payload.actingUser || effectiveSourceOwner,
    acting_user: payload.actingUser || effectiveSourceOwner,
    canWrite: true,
    can_write: true,
  };

  try {
    const endpoint = action === 'copy' ? '/copy' : '/move';
    let res = await fetch(`${STORAGE_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(forwardPayload),
    });

    if (!res.ok && (res.status === 404 || res.status === 405)) {
      res = await fetch(`${STORAGE_BASE_URL}/files${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(forwardPayload),
      });
    }

    if (res.ok) {
      return { success: true };
    }

    const errData = await res.json().catch(() => ({}));
    return {
      success: false,
      error: errData.error || errData.message || `${action === 'copy' ? 'Kopieren' : 'Verschieben'} fehlgeschlagen (${res.status})`,
      status: res.status,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Netzwerkfehler bei Dateioperation.',
      status: 500,
    };
  }
}
