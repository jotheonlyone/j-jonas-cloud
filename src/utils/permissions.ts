import type { FolderShare, SharedMember } from '../types';

/**
 * Checks whether a given user has write/editor permissions on a shared folder.
 * 
 * Rules:
 * 1. Owner always has full read & write permissions.
 * 2. Members in `shared_with` who have status 'accepted' have write/editor permissions,
 *    UNLESS explicitly set to `role === 'viewer'` or `can_write === false` / `canWrite === false`.
 * 3. Legacy single invited_user with status 'accepted' also has write permissions unless viewer.
 */
export function hasFolderWritePermission(
  share: FolderShare | null | undefined,
  username: string | null | undefined
): boolean {
  if (!share || !username) return false;
  const userNorm = username.trim().toLowerCase();

  // 1. Owner check
  if ((share.owner || '').trim().toLowerCase() === userNorm) {
    return true;
  }

  // 2. Members array check
  if (Array.isArray(share.shared_with)) {
    const member = share.shared_with.find(
      (m: SharedMember) => m && m.username && m.username.trim().toLowerCase() === userNorm
    );
    if (member) {
      // Must not be pending or declined
      if (member.status && member.status !== 'accepted') {
        return false;
      }
      // Check explicit viewer role
      if (member.role === 'viewer') {
        return false;
      }
      // Check explicit can_write / canWrite flags if specified
      if (member.can_write === false || member.canWrite === false) {
        return false;
      }
      return true;
    }
  }

  // 3. Legacy share compatibility
  const rawInvited = (share.invited_user || '').trim().toLowerCase();
  if (rawInvited === userNorm) {
    if (share.status && share.status !== 'accepted') {
      return false;
    }
    const sAny: any = share;
    if (sAny.role === 'viewer') {
      return false;
    }
    if (sAny.can_write === false || sAny.canWrite === false) {
      return false;
    }
    return true;
  }

  return false;
}

/**
 * Verifies if user can perform write actions (Upload, Create Folder, Delete, Paste, Move, Rename)
 * in the current target context.
 */
export function canWriteInContext(params: {
  isSharedContext: boolean;
  activeShare?: FolderShare | null;
  targetOwner?: string;
  currentUser: string;
  maintenanceMode?: boolean;
  userRole?: string;
}): boolean {
  const { isSharedContext, activeShare, targetOwner, currentUser, maintenanceMode, userRole } = params;

  // Maintenance mode blocks write operations for non-master users
  if (maintenanceMode && userRole !== 'master') {
    return false;
  }

  const userNorm = currentUser.trim().toLowerCase();

  // If inside a shared folder
  if (isSharedContext && activeShare) {
    return hasFolderWritePermission(activeShare, currentUser);
  }

  // If targeting another user's storage directly
  if (targetOwner && targetOwner.trim().toLowerCase() !== userNorm) {
    if (activeShare) {
      return hasFolderWritePermission(activeShare, currentUser);
    }
    // If no activeShare was passed, user cannot write to another's root unless permission exists
    return false;
  }

  // In personal storage, user always has write permissions
  return true;
}
