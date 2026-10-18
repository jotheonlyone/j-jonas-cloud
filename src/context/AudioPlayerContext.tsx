import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import type { FileItemData } from '../types';
import {
  getAudioStreamUrl,
  isAudioFile,
} from '../utils/audioPlayerUtils';

export type RepeatMode = 'off' | 'all' | 'one';

export interface AudioPlayerContextType {
  currentTrack: FileItemData | null;
  playlist: FileItemData[];
  currentIndex: number;
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  bufferedPercent: number;
  volume: number;
  isMuted: boolean;
  isPlayerVisible: boolean;
  isExpanded: boolean;
  isShuffle: boolean;
  repeatMode: RepeatMode;
  playbackRate: number;
  currentUser: string;
  keyboardFeedback: string | null;

  // Actions
  playTrack: (track: FileItemData, trackList?: FileItemData[], userOwner?: string) => void;
  pause: () => void;
  resume: () => void;
  togglePlay: () => void;
  seek: (seconds: number) => void;
  jumpSeconds: (delta: number) => void;
  nextTrack: () => void;
  prevTrack: () => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  setRepeatMode: (mode: RepeatMode) => void;
  cycleRepeatMode: () => void;
  toggleShuffle: () => void;
  setPlaybackRate: (rate: number) => void;
  setIsExpanded: (expanded: boolean) => void;
  toggleExpanded: () => void;
  closePlayer: () => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextType | null>(null);

const AUDIO_VOLUME_KEY = 'jjcloud_audio_volume';
const AUDIO_MUTED_KEY = 'jjcloud_audio_muted';

interface AudioPlayerProviderProps {
  children: ReactNode;
  defaultUser?: string;
}

export const AudioPlayerProvider: React.FC<AudioPlayerProviderProps> = ({
  children,
  defaultUser = 'user',
}) => {
  const [currentTrack, setCurrentTrack] = useState<FileItemData | null>(null);
  const [playlist, setPlaylist] = useState<FileItemData[]>([]);
  const [currentUser, setCurrentUser] = useState<string>(defaultUser);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [bufferedPercent, setBufferedPercent] = useState<number>(0);
  const [isPlayerVisible, setIsPlayerVisible] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('all');
  const [playbackRate, setPlaybackRateState] = useState<number>(1);
  const [keyboardFeedback, setKeyboardFeedback] = useState<string | null>(null);
  const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Volume state with persistence
  const [volume, setVolumeState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(AUDIO_VOLUME_KEY);
      if (saved !== null) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val >= 0 && val <= 1) return val;
      }
    } catch {}
    return 0.85;
  });

  const [isMuted, setIsMuted] = useState<boolean>(() => {
    try {
      return localStorage.getItem(AUDIO_MUTED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  // Native HTML5 <audio> instance maintained in a persistent ref
  const audioRef = useRef<HTMLAudioElement | null>(null);
  if (!audioRef.current && typeof Audio !== 'undefined') {
    audioRef.current = new Audio();
    audioRef.current.preload = 'auto';
  }

  // Update default user if changed from props
  useEffect(() => {
    if (defaultUser) {
      setCurrentUser(defaultUser);
    }
  }, [defaultUser]);

  // Temporary HUD feedback when shortcuts are pressed
  const showFeedback = useCallback((text: string) => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setKeyboardFeedback(text);
    feedbackTimerRef.current = setTimeout(() => {
      setKeyboardFeedback(null);
    }, 1500);
  }, []);

  // Compute current index in playlist
  const currentIndex = currentTrack
    ? playlist.findIndex(
        (t) => (t.path || t.name) === (currentTrack.path || currentTrack.name)
      )
    : -1;

  // Set Volume helper
  const setVolume = useCallback((newVol: number) => {
    const clamped = Math.max(0, Math.min(1, newVol));
    setVolumeState(clamped);
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : clamped;
    }
    try {
      localStorage.setItem(AUDIO_VOLUME_KEY, String(clamped));
    } catch {}
  }, [isMuted]);

  // Toggle Mute
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (audioRef.current) {
        audioRef.current.volume = next ? 0 : volume;
      }
      try {
        localStorage.setItem(AUDIO_MUTED_KEY, String(next));
      } catch {}
      showFeedback(next ? 'Ton aus' : `Ton an (${Math.round(volume * 100)}%)`);
      return next;
    });
  }, [volume, showFeedback]);

  // Set Playback Speed (0.75x to 2x)
  const setPlaybackRate = useCallback((rate: number) => {
    setPlaybackRateState(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
    showFeedback(`Geschwindigkeit: ${rate}x`);
  }, [showFeedback]);

  // Cycle repeat modes: off -> all -> one
  const cycleRepeatMode = useCallback(() => {
    setRepeatMode((prev) => {
      let next: RepeatMode;
      if (prev === 'off') next = 'all';
      else if (prev === 'all') next = 'one';
      else next = 'off';

      const label =
        next === 'one'
          ? 'Titel wiederholen'
          : next === 'all'
          ? 'Alle wiederholen'
          : 'Wiederholung aus';
      showFeedback(label);
      return next;
    });
  }, [showFeedback]);

  // Toggle shuffle
  const toggleShuffle = useCallback(() => {
    setIsShuffle((prev) => {
      const next = !prev;
      showFeedback(next ? 'Zufallswiedergabe an' : 'Zufallswiedergabe aus');
      return next;
    });
  }, [showFeedback]);

  // Seek to specific time (seconds)
  const seek = useCallback((targetSeconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const dur = audio.duration || 0;
    const clamped = Math.max(0, Math.min(targetSeconds, dur));
    audio.currentTime = clamped;
    setCurrentTime(clamped);
  }, []);

  // Jump forward or backward by delta seconds (+5 or -5)
  const jumpSeconds = useCallback((delta: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const newTime = Math.max(0, Math.min((audio.currentTime || 0) + delta, audio.duration || 0));
    audio.currentTime = newTime;
    setCurrentTime(newTime);
    showFeedback(delta > 0 ? `+${delta}s vor` : `${delta}s zurück`);
  }, [showFeedback]);

  // Play next track
  const nextTrack = useCallback(() => {
    if (playlist.length === 0) return;

    if (repeatMode === 'one' && currentTrack) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
      return;
    }

    let nextIdx = 0;
    if (isShuffle && playlist.length > 1) {
      let randIdx = currentIndex;
      while (randIdx === currentIndex) {
        randIdx = Math.floor(Math.random() * playlist.length);
      }
      nextIdx = randIdx;
    } else {
      nextIdx = currentIndex + 1;
      if (nextIdx >= playlist.length) {
        if (repeatMode === 'off') {
          setIsPlaying(false);
          return;
        }
        nextIdx = 0; // Loop to start
      }
    }

    const next = playlist[nextIdx];
    if (next) {
      const owner = next.owner || currentUser;
      playTrackInternal(next, playlist, owner);
    }
  }, [playlist, currentIndex, isShuffle, repeatMode, currentTrack, currentUser]);

  // Play previous track
  const prevTrack = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || playlist.length === 0) return;

    // If more than 3 seconds in, restart current track
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      setCurrentTime(0);
      return;
    }

    let prevIdx = currentIndex - 1;
    if (prevIdx < 0) {
      prevIdx = playlist.length - 1;
    }
    const prev = playlist[prevIdx];
    if (prev) {
      const owner = prev.owner || currentUser;
      playTrackInternal(prev, playlist, owner);
    }
  }, [playlist, currentIndex, currentUser]);

  // Internal play track function
  const playTrackInternal = (
    track: FileItemData,
    trackList: FileItemData[],
    ownerUser: string
  ) => {
    const audio = audioRef.current;
    if (!audio) return;

    const streamPath = track.path || track.name;
    const streamUser = track.owner || ownerUser || currentUser || 'user';
    const streamUrl = getAudioStreamUrl(streamPath, streamUser);

    setCurrentTrack(track);
    setCurrentUser(streamUser);
    setIsPlayerVisible(true);
    setIsLoading(true);
    setCurrentTime(0);
    setDuration(0);

    // Filter tracklist to only audio files
    const validList = (trackList && trackList.length > 0 ? trackList : [track]).filter(
      (item) => isAudioFile(item.name)
    );
    // Ensure current track is in playlist
    if (!validList.some((t) => (t.path || t.name) === (track.path || track.name))) {
      validList.unshift(track);
    }
    setPlaylist(validList);

    audio.src = streamUrl;
    audio.playbackRate = playbackRate;
    audio.volume = isMuted ? 0 : volume;

    audio
      .play()
      .then(() => {
        setIsPlaying(true);
        setIsLoading(false);
      })
      .catch((err) => {
        console.warn('Audio play request interrupted or failed:', err);
        setIsLoading(false);
      });
  };

  // Public playTrack
  const playTrack = useCallback(
    (track: FileItemData, trackList?: FileItemData[], userOwner?: string) => {
      const effectiveOwner = userOwner || track.owner || currentUser || 'user';
      playTrackInternal(track, trackList || [track], effectiveOwner);
    },
    [currentUser, playbackRate, isMuted, volume]
  );

  // Pause
  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      showFeedback('Pause');
    }
  }, [showFeedback]);

  // Resume
  const resume = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        showFeedback('Wiedergabe');
      }).catch(() => {});
    }
  }, [showFeedback]);

  // Toggle Play / Pause
  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      resume();
    }
  }, [isPlaying, pause, resume]);

  // Close / Dismiss Player completely
  const closePlayer = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    setIsPlaying(false);
    setIsPlayerVisible(false);
    setIsExpanded(false);
    setCurrentTrack(null);
    setCurrentTime(0);
  }, []);

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  // Synchronize audio element event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);

      // Calculate buffered progress
      if (audio.duration > 0 && audio.buffered.length > 0) {
        const bufferedEnd = audio.buffered.end(audio.buffered.length - 1);
        setBufferedPercent(Math.min(100, Math.round((bufferedEnd / audio.duration) * 100)));
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
      setIsLoading(false);
    };

    const handleWaiting = () => {
      setIsLoading(true);
    };

    const handleCanPlay = () => {
      setIsLoading(false);
    };

    const handleEnded = () => {
      nextTrack();
    };

    const handlePlay = () => {
      setIsPlaying(true);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleError = () => {
      setIsLoading(false);
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('durationchange', handleLoadedMetadata);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('durationchange', handleLoadedMetadata);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('error', handleError);
    };
  }, [nextTrack]);

  // Global Keyboard Shortcuts (Space for Play/Pause, ArrowLeft/Right for 5s jumps)
  useEffect(() => {
    if (!isPlayerVisible || !currentTrack) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing in an input, textarea, or contentEditable element
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('[contenteditable="true"]');

      if (isInput) return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        jumpSeconds(-5);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        jumpSeconds(5);
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        setVolume(volume + 0.05);
        showFeedback(`Lautstärke: ${Math.round(Math.min(1, volume + 0.05) * 100)}%`);
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        setVolume(volume - 0.05);
        showFeedback(`Lautstärke: ${Math.round(Math.max(0, volume - 0.05) * 100)}%`);
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        toggleMute();
      } else if (e.code === 'Escape') {
        if (isExpanded) {
          e.preventDefault();
          setIsExpanded(false);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isPlayerVisible, currentTrack, togglePlay, jumpSeconds, volume, setVolume, toggleMute, isExpanded, showFeedback]);

  return (
    <AudioPlayerContext.Provider
      value={{
        currentTrack,
        playlist,
        currentIndex,
        isPlaying,
        isLoading,
        currentTime,
        duration,
        bufferedPercent,
        volume,
        isMuted,
        isPlayerVisible,
        isExpanded,
        isShuffle,
        repeatMode,
        playbackRate,
        currentUser,
        keyboardFeedback,
        playTrack,
        pause,
        resume,
        togglePlay,
        seek,
        jumpSeconds,
        nextTrack,
        prevTrack,
        setVolume,
        toggleMute,
        setRepeatMode,
        cycleRepeatMode,
        toggleShuffle,
        setPlaybackRate,
        setIsExpanded,
        toggleExpanded,
        closePlayer,
      }}
    >
      {children}
    </AudioPlayerContext.Provider>
  );
};

export function useAudioPlayer(): AudioPlayerContextType {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error('useAudioPlayer must be used within an AudioPlayerProvider');
  }
  return context;
}
