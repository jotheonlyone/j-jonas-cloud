import { useEffect, useRef, useState, useCallback } from 'react';
import type { FileItemData } from '../types';
import { listFiles } from '../services/storageApi';
import { getAudioStreamUrl } from '../utils/audioPlayerUtils';

interface UseFrutigerAmbienceProps {
  isActive: boolean;
  username: string;
  isExternalMediaPlaying: boolean;
}

interface AmbienceState {
  isSearching: boolean;
  tracks: FileItemData[];
  currentTrackIndex: number;
  isPlaying: boolean;
  isMuted: boolean;
}

/**
 * Normalizes a filename to compare with target ambience track names
 */
function isTrackOne(name: string): boolean {
  const normalized = name.toLowerCase().replace(/\s+/g, ' ').trim();
  return normalized === 'aquatic ambience.mp3';
}

function isTrackTwo(name: string): boolean {
  const normalized = name.toLowerCase().replace(/\s+/g, ' ').trim();
  return (
    normalized === 'slowed reverb - aquatic ambience.mp3' ||
    normalized === 'slowed  reverb - aquatic ambience.mp3' ||
    (normalized.includes('slowed') && normalized.includes('aquatic ambience') && normalized.endsWith('.mp3'))
  );
}

/**
 * Recursively scans the user's storage for the two ambience tracks.
 * Returns found tracks ordered: [track1, track2] or whichever was found.
 */
async function searchAmbienceFiles(username: string): Promise<FileItemData[]> {
  if (!username) return [];

  let track1: FileItemData | null = null;
  let track2: FileItemData | null = null;

  const queue: string[] = [''];
  const visited = new Set<string>();
  let foldersChecked = 0;
  const MAX_FOLDERS = 40;

  while (queue.length > 0 && foldersChecked < MAX_FOLDERS) {
    const currentFolder = queue.shift()!;
    if (visited.has(currentFolder)) continue;
    visited.add(currentFolder);
    foldersChecked++;

    try {
      const { items } = await listFiles(username, currentFolder);
      if (!items || items.length === 0) continue;

      for (const item of items) {
        if (item.type === 'folder') {
          const subPath = item.path || (currentFolder ? `${currentFolder}/${item.name}` : item.name);
          if (!visited.has(subPath)) {
            queue.push(subPath);
          }
        } else if (item.type === 'file') {
          if (!track1 && isTrackOne(item.name)) {
            track1 = item;
          } else if (!track2 && isTrackTwo(item.name)) {
            track2 = item;
          }
        }
      }

      // Early exit if both found
      if (track1 && track2) break;
    } catch {
      // Continue silently on folder access errors
    }
  }

  const result: FileItemData[] = [];
  if (track1) result.push(track1);
  if (track2) result.push(track2);
  return result;
}

export function useFrutigerAmbience({
  isActive,
  username,
  isExternalMediaPlaying,
}: UseFrutigerAmbienceProps) {
  const [state, setState] = useState<AmbienceState>({
    isSearching: false,
    tracks: [],
    currentTrackIndex: 0,
    isPlaying: false,
    isMuted: false,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tracksRef = useRef<FileItemData[]>([]);
  const currentIndexRef = useRef(0);
  const isPlayingRef = useRef(false);
  const wasPlayingBeforeExternalRef = useRef(false);

  // Initialize or destroy audio element
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const audio = new Audio();
    audio.preload = 'auto';
    audio.volume = 0.28; // Soft default volume
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, []);

  // Search files when active and username available
  useEffect(() => {
    if (!isActive || !username) {
      tracksRef.current = [];
      currentIndexRef.current = 0;
      setState((prev) => ({
        ...prev,
        tracks: [],
        currentTrackIndex: 0,
        isPlaying: false,
        isSearching: false,
      }));
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      return;
    }

    let isMounted = true;
    setState((prev) => ({ ...prev, isSearching: true }));

    searchAmbienceFiles(username).then((foundTracks) => {
      if (!isMounted) return;
      tracksRef.current = foundTracks;
      currentIndexRef.current = 0;
      setState((prev) => ({
        ...prev,
        tracks: foundTracks,
        currentTrackIndex: 0,
        isSearching: false,
      }));
    });

    return () => {
      isMounted = false;
    };
  }, [isActive, username]);

  // Play next or loop current
  const playCurrentIndex = useCallback(
    (index: number) => {
      const audio = audioRef.current;
      const tracks = tracksRef.current;
      if (!audio || tracks.length === 0 || !isActive) return;

      const safeIndex = (index + tracks.length) % tracks.length;
      currentIndexRef.current = safeIndex;
      const track = tracks[safeIndex];
      const streamUrl = getAudioStreamUrl(track.path || track.name, username);

      audio.src = streamUrl;
      audio.loop = tracks.length === 1;

      if (!isExternalMediaPlaying) {
        audio
          .play()
          .then(() => {
            isPlayingRef.current = true;
            setState((prev) => ({
              ...prev,
              currentTrackIndex: safeIndex,
              isPlaying: true,
            }));
          })
          .catch(() => {
            // Autoplay policy or network error handled silently
            isPlayingRef.current = false;
            setState((prev) => ({ ...prev, isPlaying: false }));
          });
      }
    },
    [isActive, username, isExternalMediaPlaying]
  );

  // Audio event listeners (ended -> advance in playlist)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      const tracks = tracksRef.current;
      if (tracks.length > 1) {
        const nextIndex = (currentIndexRef.current + 1) % tracks.length;
        playCurrentIndex(nextIndex);
      }
    };

    const handlePlay = () => {
      isPlayingRef.current = true;
      setState((prev) => ({ ...prev, isPlaying: true }));
    };

    const handlePause = () => {
      isPlayingRef.current = false;
      setState((prev) => ({ ...prev, isPlaying: false }));
    };

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, [playCurrentIndex]);

  // Trigger initial play once tracks are loaded and active
  useEffect(() => {
    if (isActive && state.tracks.length > 0 && !isExternalMediaPlaying) {
      if (!isPlayingRef.current) {
        playCurrentIndex(currentIndexRef.current);
      }
    } else if (!isActive) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      isPlayingRef.current = false;
    }
  }, [isActive, state.tracks, playCurrentIndex, isExternalMediaPlaying]);

  // Handle external media playing (auto-pause / auto-resume)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !isActive) return;

    if (isExternalMediaPlaying) {
      if (isPlayingRef.current) {
        wasPlayingBeforeExternalRef.current = true;
        audio.pause();
      }
    } else {
      // External media finished/paused: resume if it was playing before or if active
      if (wasPlayingBeforeExternalRef.current && state.tracks.length > 0) {
        wasPlayingBeforeExternalRef.current = false;
        audio
          .play()
          .then(() => {
            isPlayingRef.current = true;
            setState((prev) => ({ ...prev, isPlaying: true }));
          })
          .catch(() => {
            // silent catch
          });
      }
    }
  }, [isExternalMediaPlaying, isActive, state.tracks.length]);

  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleTimeUpdate = () => {
      if (audio.duration > 0) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };
    audio.addEventListener('timeupdate', handleTimeUpdate);
    return () => audio.removeEventListener('timeupdate', handleTimeUpdate);
  }, []);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextMuted = !audio.muted;
    audio.muted = nextMuted;
    setState((prev) => ({ ...prev, isMuted: nextMuted }));
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlayingRef.current) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
  }, []);

  return {
    tracks: state.tracks,
    currentTrack: state.tracks[state.currentTrackIndex] || null,
    isPlaying: state.isPlaying,
    isMuted: state.isMuted,
    isSearching: state.isSearching,
    progressPercent: progress,
    toggleMute,
    togglePlay,
  };
}
