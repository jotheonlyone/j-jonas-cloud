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

/**
 * Resolves the concrete base path for a shared folder.
 * Ensures that guests never query '.' or an empty path, and handles subPaths without segment doubling.
 */
export function getConcreteSharedFolderPath(
  folderPath?: string,
  folderName?: string,
  subPath = ''
): string {
  const base = (folderPath || folderName || '').trim().replace(/^\/+|\/+$/g, '');
  const concreteBase = (!base || base === '.') ? (folderName || '').trim().replace(/^\/+|\/+$/g, '') : base;

  const cleanSub = (subPath || '').trim().replace(/^\/+|\/+$/g, '');
  if (!cleanSub || cleanSub === '.') {
    return concreteBase;
  }
  if (!concreteBase) {
    return cleanSub;
  }
  if (cleanSub === concreteBase) {
    return concreteBase;
  }
  if (cleanSub.startsWith(concreteBase + '/')) {
    return cleanSub;
  }
  return `${concreteBase}/${cleanSub}`;
}

/**
 * Resolves the relative subpath when navigating inside a shared folder.
 * Keeps breadcrumbs and currentPath relative to the shared folder root,
 * and avoids duplicating the shared folder's base name.
 */
export function resolveSharedSubPath(
  folderPath?: string,
  folderName?: string,
  currentSubPath = '',
  clickedItem?: { name: string; path?: string }
): string {
  if (!clickedItem) return '';
  const base = (folderPath || folderName || '').trim().replace(/^\/+|\/+$/g, '');
  const concreteBase = (!base || base === '.') ? (folderName || '').trim().replace(/^\/+|\/+$/g, '') : base;
  const itemName = (clickedItem.name || '').trim().replace(/^\/+|\/+$/g, '');

  if (!itemName) return currentSubPath;

  const itemPath = (clickedItem.path || '').trim().replace(/^\/+|\/+$/g, '');
  if (itemPath && concreteBase) {
    if (itemPath === concreteBase) {
      return '';
    }
    if (itemPath.startsWith(concreteBase + '/')) {
      return itemPath.slice(concreteBase.length + 1);
    }
  }

  const cleanCurrent = (currentSubPath || '').trim().replace(/^\/+|\/+$/g, '');
  const currentSegments = cleanCurrent ? cleanCurrent.split('/').filter(Boolean) : [];
  if (currentSegments.length > 0 && currentSegments[currentSegments.length - 1] === itemName) {
    return cleanCurrent;
  }
  return cleanCurrent ? `${cleanCurrent}/${itemName}` : itemName;
}
