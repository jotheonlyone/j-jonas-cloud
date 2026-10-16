import type { FileItemData } from '../types';

/**
 * Resolves a safe, absolute target path for folder navigation.
 * Guarantees that duplicate path segments (e.g. /ordnerA/ordnerA)
 * caused by rapid double-clicks or concurrent events are prevented,
 * and resolves paths accurately using folder.id or folder.path when available.
 */
export function resolveFolderPath(currentPath: string, folder: FileItemData): string {
  const cleanCurrent = (currentPath || '').trim().replace(/^\/+|\/+$/g, '');
  const currentSegments = cleanCurrent ? cleanCurrent.split('/').filter(Boolean) : [];

  const folderIdentifier = (folder.id || folder.path || folder.name || '').trim().replace(/^\/+|\/+$/g, '');
  const folderName = (folder.name || '').trim().replace(/^\/+|\/+$/g, '');

  if (!folderName) {
    return cleanCurrent;
  }

  // 1. If we are already in a folder with this exact name at the tail of the current path:
  // e.g. currentPath = "ordnerA" and user clicked "ordnerA" again before state settled
  if (currentSegments.length > 0 && currentSegments[currentSegments.length - 1] === folderName) {
    return cleanCurrent;
  }

  // 2. Check if folder.id / folder.path is already an absolute path from the root
  let candidateSegments: string[];
  if (folderIdentifier && folderIdentifier.endsWith(folderName) && folderIdentifier.includes('/')) {
    candidateSegments = folderIdentifier.split('/').filter(Boolean);
  } else {
    candidateSegments = cleanCurrent ? [...currentSegments, folderName] : [folderName];
  }

  // 3. Deduplication of consecutive identical folder segments
  const deduplicated: string[] = [];
  for (let i = 0; i < candidateSegments.length; i++) {
    const seg = candidateSegments[i];
    if (deduplicated.length > 0 && seg === deduplicated[deduplicated.length - 1]) {
      continue;
    }
    deduplicated.push(seg);
  }

  return deduplicated.join('/');
}
