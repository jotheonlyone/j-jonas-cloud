import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Maximize,
  Minimize,
  ArrowLeft,
} from 'lucide-react';
import type { FileItemData } from '../types';
import {
  formatBytes,
  getStreamUrl,
  formatCleanTitle,
  type VideoCategory,
} from '../services/storageApi';
import { isTvBackEvent } from './CinemaTvView';

interface CinemaPlayerOverlayProps {
  video: FileItemData;
  allVideos: FileItemData[];
  categories: VideoCategory[];
  currentCategory?: VideoCategory | null;
  onClose: () => void;
  onVideoChange?: (video: FileItemData) => void;
  darkMode?: boolean;
}

/**
 * Next-Video-Logik:
 * - Springe zum nächsten Video innerhalb derselben Kategorie.
 * - Ist es das letzte Video dieser Kategorie, springe wieder zum ersten Video dieser Kategorie (Loop).
 * - Gehört das Video zu keiner Kategorie, wähle ein beliebiges anderes Video.
 */
export function getNextVideo(
  currentVideo: FileItemData,
  currentCategory: VideoCategory | null | undefined,
  allCategories: VideoCategory[],
  allVideos: FileItemData[]
): FileItemData | null {
  const currentKey = currentVideo.path || currentVideo.name;

  // 1. Suche Kategorie, falls nicht explizit übergeben
  let targetCategory = currentCategory;
  if (!targetCategory) {
    targetCategory = allCategories.find((cat) =>
      cat.videos.some((v) => (v.path || v.name) === currentKey)
    ) || null;
  }

  // 2. Innerhalb der Kategorie navigieren
  if (targetCategory && targetCategory.videos.length > 0) {
    const catVideos = targetCategory.videos;
    const currentIndex = catVideos.findIndex((v) => (v.path || v.name) === currentKey);

    if (currentIndex !== -1) {
      if (currentIndex < catVideos.length - 1) {
        return catVideos[currentIndex + 1];
      } else {
        // Letztes Video der Kategorie -> Loop zurück zum ersten Video!
        return catVideos[0];
      }
    }
    // Falls Video in Kategorie-Array nicht auffindbar, erstes Element zurückgeben
    return catVideos[0];
  }

  // 3. Gehört zu keiner Kategorie -> Beliebiges anderes Video wählen
  if (allVideos.length > 1) {
    const allIndex = allVideos.findIndex((v) => (v.path || v.name) === currentKey);
    if (allIndex !== -1) {
      const nextIndex = (allIndex + 1) % allVideos.length;
      return allVideos[nextIndex];
    }
    return allVideos[0];
  } else if (allVideos.length === 1) {
    return allVideos[0];
  }

  return null;
}

export const CinemaPlayerOverlay: React.FC<CinemaPlayerOverlayProps> = ({
  video,
  allVideos,
  categories,
  currentCategory,
  onClose,
  onVideoChange,
}) => {
  const [activeVideo, setActiveVideo] = useState<FileItemData>(video);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // OSD Sichtbarkeit
  const [showOsd, setShowOsd] = useState(true);
  const osdTimerRef = useRef<NodeJS.Timeout | null>(null);

  // HUD Toast Feedback (-10s / +10s / Play / Pause / Neustart / Nächstes Video)
  const [hudFeedback, setHudFeedback] = useState<string | null>(null);
  const hudTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Fernbedienungs-Fokus auf der Steuerungsleiste:
   * null = Fokus im Videobereich (Pfeil Links/Rechts spult 10 Sekunden)
   * 0 = Play / Pause
   * 1 = Neustart (Restart)
   * 2 = Nächstes Video (Next)
   * 3 = Vollbild (Fullscreen)
   */
  const [focusedControlIdx, setFocusedControlIdx] = useState<number | null>(null);

  // Synchronisiere Video bei Prop-Wechsel
  useEffect(() => {
    setActiveVideo(video);
  }, [video]);

  const triggerHud = (text: string) => {
    setHudFeedback(text);
    if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    hudTimerRef.current = setTimeout(() => {
      setHudFeedback(null);
    }, 1500);
  };

  const resetOsdTimer = useCallback(() => {
    setShowOsd(true);
    if (osdTimerRef.current) clearTimeout(osdTimerRef.current);
    // Solange ein Button auf der Steuerungsleiste aktiv fokussiert ist, OSD nicht ausblenden
    if (focusedControlIdx !== null) return;

    osdTimerRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowOsd(false);
      }
    }, 4000);
  }, [isPlaying, focusedControlIdx]);

  useEffect(() => {
    if (!isPlaying || focusedControlIdx !== null) {
      setShowOsd(true);
      if (osdTimerRef.current) clearTimeout(osdTimerRef.current);
    } else {
      resetOsdTimer();
    }
  }, [isPlaying, focusedControlIdx, resetOsdTimer]);

  const togglePlayPause = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
      triggerHud('Wiedergabe');
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      triggerHud('Pause');
    }
    resetOsdTimer();
  }, [resetOsdTimer]);

  const skipTime = useCallback((seconds: number) => {
    if (!videoRef.current) return;
    const newTime = Math.max(0, Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + seconds));
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    triggerHud(seconds > 0 ? `+${seconds}s Vor` : `${seconds}s Zurück`);
    resetOsdTimer();
  }, [resetOsdTimer]);

  const restartVideo = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = 0;
    setCurrentTime(0);
    videoRef.current.play().catch(() => {});
    setIsPlaying(true);
    triggerHud('Neustart');
    resetOsdTimer();
  }, [resetOsdTimer]);

  const handleNextVideo = useCallback(() => {
    const next = getNextVideo(activeVideo, currentCategory, categories, allVideos);
    if (next) {
      setActiveVideo(next);
      onVideoChange?.(next);
      triggerHud(`Nächstes Video: ${formatCleanTitle(next.name)}`);
      setCurrentTime(0);
      setIsPlaying(true);
    }
    resetOsdTimer();
  }, [activeVideo, currentCategory, categories, allVideos, onVideoChange, resetOsdTimer]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
    resetOsdTimer();
  }, [resetOsdTimer]);

  const handleClosePlayer = useCallback(() => {
    if (videoRef.current) {
      try {
        videoRef.current.pause();
      } catch {}
    }
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    onClose();
  }, [onClose]);

  useEffect(() => {
    return () => {
      if (videoRef.current) {
        try {
          videoRef.current.pause();
        } catch {}
      }
    };
  }, []);

  // FERNBEDIENUNGS- & TASTATURSTEUERUNG
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Android TV Remote Back / Escape / Backspace / GoBack / KeyCode 4
      if (isTvBackEvent(e)) {
        e.preventDefault();
        e.stopPropagation();
        handleClosePlayer();
        return;
      }

      switch (e.key) {
        case ' ':
        case 'Enter': {
          e.preventDefault();
          e.stopPropagation();
          if (focusedControlIdx === null) {
            togglePlayPause();
          } else if (focusedControlIdx === 0) {
            togglePlayPause();
          } else if (focusedControlIdx === 1) {
            restartVideo();
          } else if (focusedControlIdx === 2) {
            handleNextVideo();
          } else if (focusedControlIdx === 3) {
            toggleFullscreen();
          }
          break;
        }

        // Pfeil nach unten: Navigiert zur Steuerungsleiste
        case 'ArrowDown': {
          e.preventDefault();
          e.stopPropagation();
          setShowOsd(true);
          if (focusedControlIdx === null) {
            setFocusedControlIdx(0); // Startet auf dem Play-Button
          }
          break;
        }

        // Pfeil nach oben: Navigiert von der Steuerungsleiste zurück ins Video
        case 'ArrowUp': {
          e.preventDefault();
          e.stopPropagation();
          if (focusedControlIdx !== null) {
            setFocusedControlIdx(null);
            resetOsdTimer();
          }
          break;
        }

        // Pfeil links: Spult 10 Sekunden zurück ODER steuert Buttons an
        case 'ArrowLeft': {
          e.preventDefault();
          e.stopPropagation();
          if (focusedControlIdx !== null) {
            setFocusedControlIdx((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
          } else {
            skipTime(-10);
          }
          break;
        }

        // Pfeil rechts: Spult 10 Sekunden vor ODER steuert Buttons an
        case 'ArrowRight': {
          e.preventDefault();
          e.stopPropagation();
          if (focusedControlIdx !== null) {
            setFocusedControlIdx((prev) => (prev !== null && prev < 3 ? prev + 1 : 3));
          } else {
            skipTime(10);
          }
          break;
        }

        case 'f':
        case 'F': {
          e.preventDefault();
          e.stopPropagation();
          toggleFullscreen();
          break;
        }

        case 'n':
        case 'N': {
          e.preventDefault();
          e.stopPropagation();
          handleNextVideo();
          break;
        }

        case 'r':
        case 'R': {
          e.preventDefault();
          e.stopPropagation();
          restartVideo();
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [
    focusedControlIdx,
    togglePlayPause,
    restartVideo,
    handleNextVideo,
    toggleFullscreen,
    skipTime,
    handleClosePlayer,
    resetOsdTimer,
  ]);

  const formatPlayerTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const streamUrl = getStreamUrl(activeVideo.path || activeVideo.name, activeVideo.owner);

  return (
    <div
      ref={containerRef}
      onMouseMove={resetOsdTimer}
      onClick={resetOsdTimer}
      className="fixed inset-0 z-50 bg-black flex items-center justify-center select-none overflow-hidden font-sans"
    >
      <video
        key={streamUrl}
        ref={videoRef}
        src={streamUrl}
        autoPlay
        playsInline
        onTimeUpdate={() => {
          if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
        }}
        onLoadedMetadata={() => {
          if (videoRef.current) {
            setDuration(videoRef.current.duration);
            videoRef.current.play().catch(() => {});
          }
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={handleNextVideo}
        onClick={togglePlayPause}
        className="w-full h-full object-contain cursor-pointer"
      />

      {/* HUD Quick Notification Pill */}
      {hudFeedback && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 px-6 py-3 rounded-2xl bg-black/85 text-white font-bold text-base sm:text-xl border border-white/20 shadow-2xl backdrop-blur-md pointer-events-none animate-in fade-in zoom-in-95 duration-100 max-w-md text-center truncate">
          {hudFeedback}
        </div>
      )}

      {/* TOP BAR OSD (Ohne X-Button, ohne Download-Button, ausschließlich Zurück-Button) */}
      <div
        className={`absolute top-0 inset-x-0 z-30 p-4 sm:p-6 bg-gradient-to-b from-black/90 via-black/50 to-transparent flex items-center justify-between transition-opacity duration-300 ${
          showOsd ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={handleClosePlayer}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs sm:text-sm transition-all border border-white/10 cursor-pointer active:scale-95"
            title="Zurück zur Übersicht (Esc / Zurück-Taste)"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden xs:inline">Zurück</span>
          </button>
          <div className="min-w-0 pr-4">
            <h2 className="text-sm sm:text-base font-bold text-white tracking-wide truncate">
              {formatCleanTitle(activeVideo.name)}
            </h2>
            <p className="text-[11px] text-gray-400">
              {formatBytes(activeVideo.size)}
            </p>
          </div>
        </div>
      </div>

      {/* BOTTOM CONTROLS BAR OSD (Play, Restart, Next, Vollbild) */}
      <div
        className={`absolute bottom-0 inset-x-0 z-30 p-4 sm:p-8 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex flex-col gap-3.5 transition-opacity duration-300 ${
          showOsd ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Progress Bar */}
        <div
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            if (videoRef.current && duration) {
              const newTime = pos * duration;
              videoRef.current.currentTime = newTime;
              setCurrentTime(newTime);
            }
          }}
          className="relative w-full h-2 sm:h-2.5 bg-white/20 rounded-full cursor-pointer overflow-hidden group hover:h-3.5 transition-all"
        >
          <div
            className="h-full rounded-full transition-all duration-100"
            style={{ width: `${progressPercent}%`, backgroundColor: '#E50914' }}
          />
        </div>

        {/* Playback Controls Row: Play, Restart, Next, Vollbild */}
        <div className="flex items-center justify-between text-white pt-1">
          <div className="flex items-center gap-3 sm:gap-5">
            {/* 1. Play / Pause Button (Index 0) */}
            <button
              type="button"
              onClick={togglePlayPause}
              onMouseEnter={() => setFocusedControlIdx(0)}
              className={`p-3 rounded-xl transition-all duration-150 cursor-pointer outline-none ${
                focusedControlIdx === 0
                  ? 'bg-white text-black ring-4 ring-white scale-110 shadow-2xl font-bold'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
              title={isPlaying ? 'Pause (Leertaste / OK)' : 'Wiedergabe (Leertaste / OK)'}
              aria-label={isPlaying ? 'Pause' : 'Wiedergabe'}
            >
              {isPlaying ? <Pause className="w-5 h-5 sm:w-6 sm:h-6" /> : <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />}
            </button>

            {/* 2. Neustart / Restart Button (Index 1) */}
            <button
              type="button"
              onClick={restartVideo}
              onMouseEnter={() => setFocusedControlIdx(1)}
              className={`p-3 rounded-xl transition-all duration-150 cursor-pointer outline-none flex items-center gap-2 ${
                focusedControlIdx === 1
                  ? 'bg-white text-black ring-4 ring-white scale-110 shadow-2xl font-bold'
                  : 'bg-white/10 hover:bg-white/20 text-gray-200 hover:text-white'
              }`}
              title="Von Anfang an abspielen (Neustart / R)"
              aria-label="Neustart"
            >
              <RotateCcw className="w-5 h-5" />
              <span className="text-xs font-semibold hidden md:inline">Neustart</span>
            </button>

            {/* 3. Nächstes Video / Next Button (Index 2) */}
            <button
              type="button"
              onClick={handleNextVideo}
              onMouseEnter={() => setFocusedControlIdx(2)}
              className={`p-3 rounded-xl transition-all duration-150 cursor-pointer outline-none flex items-center gap-2 ${
                focusedControlIdx === 2
                  ? 'bg-white text-black ring-4 ring-white scale-110 shadow-2xl font-bold'
                  : 'bg-white/10 hover:bg-white/20 text-gray-200 hover:text-white'
              }`}
              title="Nächstes Video in dieser Kategorie (N)"
              aria-label="Nächstes Video"
            >
              <SkipForward className="w-5 h-5" />
              <span className="text-xs font-semibold hidden md:inline">Nächstes Video</span>
            </button>

            {/* Time Indicator */}
            <span className="text-xs sm:text-sm font-mono text-gray-300 ml-2 select-none">
              {formatPlayerTime(currentTime)} / {formatPlayerTime(duration)}
            </span>
          </div>

          {/* 4. Vollbild Button (Index 3) */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleFullscreen}
              onMouseEnter={() => setFocusedControlIdx(3)}
              className={`p-3 rounded-xl transition-all duration-150 cursor-pointer outline-none ${
                focusedControlIdx === 3
                  ? 'bg-white text-black ring-4 ring-white scale-110 shadow-2xl font-bold'
                  : 'bg-white/10 hover:bg-white/20 text-gray-200 hover:text-white'
              }`}
              title="Vollbild umschalten (F)"
              aria-label="Vollbild"
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
