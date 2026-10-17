import type { FileItemData } from '../types';
import { getFileMetadata } from '../services/storageApi';

export interface ParsedVideoMetadata {
  description: string;
  isFront: boolean;
  date: Date | null;
  rawDateString: string | null;
}

// In-memory cache for loaded file descriptions to avoid redundant network round-trips
const descriptionCache = new Map<string, string>();

/**
 * Parses a video description for special control tags:
 * 1. `/front`: Identifies hero / highlight candidate videos.
 * 2. `/DD.MM.YYYY` (e.g. `/16.10.2026`): Date tag for chronological ordering and badges.
 *
 * Strips these control tags completely from the returned user-facing description.
 *
 * @param rawDescription The raw description text stored on the server.
 * @returns Cleaned description and extracted metadata flags.
 */
export function parseVideoDescription(rawDescription?: string | null): ParsedVideoMetadata {
  if (!rawDescription || typeof rawDescription !== 'string') {
    return {
      description: '',
      isFront: false,
      date: null,
      rawDateString: null,
    };
  }

  let text = rawDescription;
  let isFront = false;
  let date: Date | null = null;
  let rawDateString: string | null = null;

  // 1. Check for /front tag (case-insensitive)
  // Matches /front, /FRONT, /Front at word boundaries
  const frontRegex = /(?:^|\s)\/front(?=\s|$|[.,;:!?/]|\b)/gi;
  if (frontRegex.test(text)) {
    isFront = true;
    text = text.replace(frontRegex, ' ');
  }

  // 2. Check for date tag /DD.MM.YYYY (e.g., /16.10.2026 or /05.04.2025)
  const dateRegex = /(?:^|\s)\/(\d{1,2})\.(\d{1,2})\.(\d{4})(?=\s|$|[.,;:!?/]|\b)/g;
  const match = dateRegex.exec(text);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1; // 0-based month index in JavaScript
    const year = parseInt(match[3], 10);
    const parsedDate = new Date(year, month, day);

    // Validate real calendar date (avoid 31.02, 99.99, etc.)
    if (
      !isNaN(parsedDate.getTime()) &&
      parsedDate.getDate() === day &&
      parsedDate.getMonth() === month &&
      parsedDate.getFullYear() === year
    ) {
      date = parsedDate;
      const formattedDay = day.toString().padStart(2, '0');
      const formattedMonth = (month + 1).toString().padStart(2, '0');
      rawDateString = `${formattedDay}.${formattedMonth}.${year}`;
    }

    text = text.replace(dateRegex, ' ');
  }

  // 3. Clean up extra whitespace and line breaks left behind by removed tags
  const cleanDescription = text
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();

  return {
    description: cleanDescription,
    isFront,
    date,
    rawDateString,
  };
}

/**
 * Sorts video items chronologically by their /DD.MM.YYYY tag date:
 * - Videos with parsed tag dates are sorted newest first.
 * - Videos without tag dates appear afterwards, sorted by their file modification timestamp.
 */
export function sortVideosByTagDate(videos: FileItemData[]): FileItemData[] {
  return [...videos].sort((a, b) => {
    const metaA = parseVideoDescription(a.metadata?.description);
    const metaB = parseVideoDescription(b.metadata?.description);

    // Both have a /DD.MM.YYYY date -> newest date first
    if (metaA.date && metaB.date) {
      const diff = metaB.date.getTime() - metaA.date.getTime();
      if (diff !== 0) return diff;
    }

    // Video with date ranks before video without date
    if (metaA.date && !metaB.date) return -1;
    if (!metaA.date && metaB.date) return 1;

    // Both have no date (or identical date) -> fallback to file modified date descending
    const timeA = new Date(a.modified).getTime() || 0;
    const timeB = new Date(b.modified).getTime() || 0;
    return timeB - timeA;
  });
}

/**
 * Enriches a list of videos with metadata from the server if not already present.
 * Uses cache and controlled concurrency to avoid overloading the API.
 */
export async function enrichVideosWithMetadata(
  videos: FileItemData[],
  username: string
): Promise<FileItemData[]> {
  const needsFetch = videos.filter((v) => {
    const key = `${v.owner || username}:${v.path || v.name}`;
    return !v.metadata?.description && !descriptionCache.has(key);
  });

  if (needsFetch.length > 0) {
    // Concurrently fetch metadata with a concurrency limit of 6
    const limit = 6;
    const queue = [...needsFetch];

    const worker = async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) break;
        const itemPath = item.path || item.name;
        const itemOwner = item.owner || username;
        const key = `${itemOwner}:${itemPath}`;
        try {
          const res = await getFileMetadata(itemPath, itemOwner);
          if (res.description) {
            descriptionCache.set(key, res.description);
          }
        } catch {
          // Ignore individual fetch errors
        }
      }
    };

    const workers = Array.from({ length: Math.min(limit, needsFetch.length) }, () => worker());
    await Promise.all(workers);
  }

  // Return videos with metadata assigned from cache or existing metadata
  return videos.map((v) => {
    const key = `${v.owner || username}:${v.path || v.name}`;
    const cachedDesc = descriptionCache.get(key);
    if (cachedDesc && (!v.metadata || !v.metadata.description)) {
      return {
        ...v,
        metadata: {
          ...(v.metadata || {}),
          description: cachedDesc,
        },
      };
    }
    return v;
  });
}
