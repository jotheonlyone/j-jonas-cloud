import type { FileItemData } from '../types';
import { STORAGE_BASE_URL } from '../services/storageApi';

export const AUDIO_EXTENSIONS = ['mp3', 'wav', 'flac', 'm4a', 'ogg', 'aac', 'opus', 'wma'] as const;

/**
 * Checks whether a given file name or item represents a supported audio format (MP3, WAV, FLAC, M4A, OGG, etc.)
 */
export function isAudioFile(itemOrName: FileItemData | string | null | undefined): boolean {
  if (!itemOrName) return false;
  const name = typeof itemOrName === 'string' ? itemOrName : itemOrName.name || '';
  if (typeof itemOrName !== 'string' && itemOrName.type === 'folder') return false;
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return (AUDIO_EXTENSIONS as readonly string[]).includes(ext);
}

/**
 * Returns the exact streaming URL per specification:
 * https://storage.j-jonas.com/stream?user=${currentUser}&path=${encodeURIComponent(filePath)}
 */
export function getAudioStreamUrl(filePath: string, currentUser: string): string {
  const cleanPath = filePath.replace(/^\/+/, '').trim();
  const cleanUser = (currentUser || 'user').trim();
  return `${STORAGE_BASE_URL}/stream?user=${encodeURIComponent(cleanUser)}&path=${encodeURIComponent(cleanPath)}`;
}

/**
 * Returns the album cover URL per specification:
 * https://storage.j-jonas.com/thumbnail?user=${currentUser}&path=${encodeURIComponent(filePath)}
 */
export function getAudioCoverUrl(filePath: string, currentUser: string): string {
  const cleanPath = filePath.replace(/^\/+/, '').trim();
  const cleanUser = (currentUser || 'user').trim();
  return `${STORAGE_BASE_URL}/thumbnail?user=${encodeURIComponent(cleanUser)}&path=${encodeURIComponent(cleanPath)}`;
}

/**
 * Formats time in seconds to mm:ss or hh:mm:ss with tabular numerals support
 */
export function formatAudioTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) {
    return '0:00';
  }
  const totalSeconds = Math.floor(seconds);
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  const paddedSecs = secs < 10 ? `0${secs}` : `${secs}`;

  if (hrs > 0) {
    const paddedMins = mins < 10 ? `0${mins}` : `${mins}`;
    return `${hrs}:${paddedMins}:${paddedSecs}`;
  }
  return `${mins}:${paddedSecs}`;
}

/**
 * Cleans track filenames into human-readable song titles and extracts metadata hints
 */
export function parseAudioTitle(filename: string): {
  cleanTitle: string;
  ext: string;
  trackNumber?: string;
  artistHint?: string;
} {
  if (!filename) return { cleanTitle: 'Unbekannter Titel', ext: '' };

  const lastDot = filename.lastIndexOf('.');
  const ext = lastDot > 0 ? filename.slice(lastDot + 1).toUpperCase() : '';
  const baseName = lastDot > 0 ? filename.slice(0, lastDot) : filename;

  // Check for track numbers like "01 - Title" or "01. Title" or "1. Title"
  let clean = baseName;
  let trackNum: string | undefined;

  const trackMatch = clean.match(/^(\d{1,3})\s*[-._\s]\s*(.+)$/);
  if (trackMatch) {
    trackNum = trackMatch[1];
    clean = trackMatch[2];
  }

  // Check for Artist - Title
  let artistHint: string | undefined;
  if (clean.includes(' - ')) {
    const parts = clean.split(' - ');
    if (parts.length >= 2) {
      artistHint = parts[0].replace(/[_\-]+/g, ' ').trim();
      clean = parts.slice(1).join(' - ');
    }
  }

  // Replace underscores and multiple dashes with spaces
  clean = clean.replace(/[_\-]+/g, ' ').trim();

  // If still empty, fallback to baseName
  if (!clean) clean = baseName;

  return {
    cleanTitle: clean,
    ext,
    trackNumber: trackNum,
    artistHint,
  };
}
