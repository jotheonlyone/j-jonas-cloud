import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Loader2,
  Volume2,
  Volume1,
  VolumeX,
} from 'lucide-react';
import { getAudioStreamUrl, parseAudioTitle } from '../../utils/audioPlayerUtils';
import { AudioCoverArt } from './AudioCoverArt';
import { AudioScrubber } from './AudioScrubber';
import { AudioVolumeControl } from './AudioVolumeControl';

interface StandaloneAudioPlayerProps {
  filePath: string;
  fileName: string;
  currentUser: string;
  onDownload?: () => void;
}

export const StandaloneAudioPlayer: React.FC<StandaloneAudioPlayerProps> = ({
  filePath,
  fileName,
  currentUser,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedPercent, setBufferedPercent] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [keyboardFeedback, setKeyboardFeedback] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { cleanTitle, ext, artistHint } = parseAudioTitle(fileName);
  const streamUrl = getAudioStreamUrl(filePath, currentUser);

  const showFeedback = useCallback((text: string) => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setKeyboardFeedback(text);
    feedbackTimerRef.current = setTimeout(() => {
      setKeyboardFeedback(null);
    }, 1500);
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().then(() => {
        setIsPlaying(true);
        showFeedback('Wiedergabe');
      }).catch(() => {});
    } else {
      audio.pause();
      setIsPlaying(false);
      showFeedback('Pause');
    }
  }, [showFeedback]);

  const seek = useCallback((targetSeconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const dur = audio.duration || 0;
    const clamped = Math.max(0, Math.min(targetSeconds, dur));
    audio.currentTime = clamped;
    setCurrentTime(clamped);
  }, []);

  const jumpSeconds = useCallback((delta: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const newTime = Math.max(0, Math.min((audio.currentTime || 0) + delta, audio.duration || 0));
    audio.currentTime = newTime;
    setCurrentTime(newTime);
    showFeedback(delta > 0 ? `+${delta}s vor` : `${delta}s zurück`);
  }, [showFeedback]);

  const handleVolumeChange = (newVol: number) => {
    const clamped = Math.max(0, Math.min(1, newVol));
    setVolume(clamped);
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : clamped;
    }
  };

  const handleToggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev;
      if (audioRef.current) {
        audioRef.current.volume = next ? 0 : volume;
      }
      showFeedback(next ? 'Ton aus' : `Ton an (${Math.round(volume * 100)}%)`);
      return next;
    });
  };

  // Setup Audio Events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = isMuted ? 0 : volume;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (audio.duration > 0 && audio.buffered.length > 0) {
        const bufferedEnd = audio.buffered.end(audio.buffered.length - 1);
        setBufferedPercent(Math.min(100, Math.round((bufferedEnd / audio.duration) * 100)));
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
      setIsLoading(false);
    };

    const handleWaiting = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      audio.currentTime = 0;
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('durationchange', handleLoadedMetadata);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    // Auto-play when ready
    audio.play().catch(() => {});

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('durationchange', handleLoadedMetadata);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [streamUrl]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

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
        handleVolumeChange(volume + 0.05);
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        handleVolumeChange(volume - 0.05);
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        handleToggleMute();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, jumpSeconds, volume, isMuted]);

  return (
    <div className="relative w-full max-w-lg p-6 sm:p-8 rounded-3xl bg-white dark:bg-gray-900 border border-gray-200/90 dark:border-gray-800 shadow-2xl flex flex-col items-center select-none animate-in zoom-in-95 duration-150">
      {/* Hidden native audio element */}
      <audio ref={audioRef} src={streamUrl} preload="auto" />

      {/* Keyboard Feedback HUD */}
      {keyboardFeedback && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gray-900/90 dark:bg-black/90 text-white text-xs font-semibold shadow-lg backdrop-blur-md border border-white/10 flex items-center gap-1.5 pointer-events-none">
          <span>{keyboardFeedback}</span>
        </div>
      )}

      {/* Album Cover Art */}
      <div className="relative my-2 sm:my-4 flex items-center justify-center">
        <div className="absolute inset-0 bg-blue-500/20 dark:bg-indigo-500/25 blur-3xl rounded-full scale-110 pointer-events-none" />
        <AudioCoverArt
          filePath={filePath}
          currentUser={currentUser}
          title={cleanTitle}
          className="relative w-48 h-48 sm:w-56 sm:h-56 rounded-3xl shadow-2xl border border-white/20 dark:border-white/10"
          iconClassName="w-16 h-16"
        />
      </div>

      {/* Track Title & Artist */}
      <div className="text-center w-full max-w-sm mt-3 mb-4">
        <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 truncate" title={fileName}>
          {cleanTitle}
        </h2>
        <div className="flex items-center justify-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
          <span className="truncate">{artistHint || (currentUser ? `@${currentUser}` : 'J.Jonas Audio')}</span>
          {ext && (
            <>
              <span>·</span>
              <span className="font-mono text-blue-600 dark:text-blue-400 font-bold uppercase">{ext}</span>
            </>
          )}
        </div>
      </div>

      {/* Timeline Scrubber */}
      <div className="w-full my-2">
        <AudioScrubber
          currentTime={currentTime}
          duration={duration}
          bufferedPercent={bufferedPercent}
          onSeek={seek}
          compact={false}
        />
      </div>

      {/* Transport Controls */}
      <div className="flex items-center justify-center gap-4 my-2">
        {/* Jump -5s */}
        <button
          type="button"
          onClick={() => jumpSeconds(-5)}
          className="p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer relative"
          title="5s zurück (Pfeil links)"
        >
          <RotateCcw className="w-5 h-5" />
          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold mt-0.5">5</span>
        </button>

        {/* Play / Pause */}
        <button
          type="button"
          onClick={togglePlay}
          className="p-4 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-xl active:scale-95 transition-transform cursor-pointer flex items-center justify-center"
          title={isPlaying ? 'Pause (Leertaste)' : 'Abspielen (Leertaste)'}
        >
          {isLoading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-6 h-6 fill-white" />
          ) : (
            <Play className="w-6 h-6 fill-white ml-0.5" />
          )}
        </button>

        {/* Jump +5s */}
        <button
          type="button"
          onClick={() => jumpSeconds(5)}
          className="p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer relative"
          title="5s vor (Pfeil rechts)"
        >
          <RotateCw className="w-5 h-5" />
          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold mt-0.5">5</span>
        </button>
      </div>

      {/* Volume Bar */}
      <div className="w-full max-w-xs flex items-center justify-center mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
        <AudioVolumeControl
          volume={volume}
          isMuted={isMuted}
          onVolumeChange={handleVolumeChange}
          onToggleMute={handleToggleMute}
        />
      </div>
    </div>
  );
};
