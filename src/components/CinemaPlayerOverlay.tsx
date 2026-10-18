import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Maximize,
  Minimize,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import type { FileItemData } from '../types';
import {
  formatBytes,
  getStreamUrl,
  formatCleanTitle,
  type VideoCategory,
} from '../services/storageApi';
import { isTvBackEvent } from './CinemaTvView';
import { parseVideoDescription } from '../utils/videoMetadataParser';

interface CinemaPlayerOverlayProps {
  video: FileItemData;
  allVideos: FileItemData[];
  categories: VideoCategory[];
  currentCategory?: VideoCategory | null;
  onClose: () => void;
  onVideoChange?: (video: FileItemData) => void;
  darkMode?: boolean;
  isTvMode?: boolean;
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
    targetCategory =
      allCategories.find((cat) =>
        cat.videos.some((v) => (v.path || v.name) === currentKey)
      ) || null;
  }

  // 2. Innerhalb der Kategorie navigieren
  if (targetCategory && targetCategory.videos.length > 0) {
    const catVideos = targetCategory.videos;
    const currentIndex = catVideos.findIndex(
      (v) => (v.path || v.name) === currentKey
    );

    if (currentIndex !== -1) {
      if (currentIndex < catVideos.length - 1) {
        return catVideos[currentIndex + 1];
      } else {
        // Letztes Video der Kategorie -> Loop zurück zum ersten Video!
        return catVideos[0];
      }
    }
    return catVideos[0];
  }

  // 3. Gehört zu keiner Kategorie -> Beliebiges anderes Video wählen
  if (allVideos.length > 1) {
    const allIndex = allVideos.findIndex(
      (v) => (v.path || v.name) === currentKey
    );
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
  isTvMode = false,
}) => {
  const [activeVideo, setActiveVideo] = useState<FileItemData>(video);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Robuster Lade- & Pufferzustand mit Timeout-Fallback (bleibt niemals hängen)
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const videoLoadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startLoadingTimeout = useCallback(() => {
    setIsVideoLoading(true);
    if (videoLoadingTimeoutRef.current) clearTimeout(videoLoadingTimeoutRef.current);
    // Robuster Fallback: Spinner verschwindet nach maximal 4 Sekunden garantiert
    videoLoadingTimeoutRef.current = setTimeout(() => {
      setIsVideoLoading(false);
    }, 4000);
  }, []);

  const finishLoading = useCallback(() => {
    setIsVideoLoading(false);
    if (videoLoadingTimeoutRef.current) {
      clearTimeout(videoLoadingTimeoutRef.current);
      videoLoadingTimeoutRef.current = null;
    }
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (videoLoadingTimeoutRef.current) clearTimeout(videoLoadingTimeoutRef.current);
    };
  }, []);

  // OSD Sichtbarkeit (5s Timer) & Großer Pausentitel (5s Timer bei Pause)
  const [showOsd, setShowOsd] = useState(true);
  const [showPausedBigTitle, setShowPausedBigTitle] = useState(false);
  const osdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pausedTitleTimerRef = useRef<NodeJS.Timeout | null>(null);

  // HUD Toast Feedback (-10s / +10s / Play / Pause / Neustart / Nächstes Video)
  const [hudFeedback, setHudFeedback] = useState<string | null>(null);
  const hudTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * TV-Fernbedienungs-Fokus auf der Steuerungsleiste (NUR im TV-Modus aktiv):
   * null = Fokus im Videobereich
   * 0 = Play / Pause
   * 1 = Neustart (Restart)
   * 2 = Nächstes Video (Next)
   * 3 = Vollbild (Fullscreen)
   */
  const [focusedControlIdx, setFocusedControlIdx] = useState<number | null>(null);

  // Synchronisiere Video bei Prop-Wechsel
  useEffect(() => {
    setActiveVideo(video);
    startLoadingTimeout();
  }, [video, startLoadingTimeout]);

  const triggerHud = (text: string) => {
    setHudFeedback(text);
    if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    hudTimerRef.current = setTimeout(() => {
      setHudFeedback(null);
    }, 1500);
  };

  /**
   * OSD & Inaktivitäts-Steuerung für BEIDE Modi:
   * 1. Während Play: Nach genau 5 Sekunden Inaktivität alle Knöpfe & Fortschrittsleiste ausblenden.
   *    Auch wenn ein Knopf im TV-Modus fokussiert ist (mit weißem Rahmen), verschwindet die Leiste nach 5s!
   *    Bei neuer Bewegung/Taste sofort wieder einblenden.
   * 2. Bei Pause: Die Steuerleiste und Buttons bleiben sichtbar (blenden nicht aus).
   *    Zusätzlich: Wenn nach 5 Sekunden Pause keine Taste gedrückt wird,
   *    wird der Titel links mittig mit tiefschwarzem Blend eingeblendet.
   */
  const resetActivityTimers = useCallback(() => {
    // Bei Nutzeraktivität OSD sofort einblenden
    setShowOsd(true);
    if (osdTimerRef.current) {
      clearTimeout(osdTimerRef.current);
      osdTimerRef.current = null;
    }

    // Pausentitel bei Nutzeraktivität sofort ausblenden
    setShowPausedBigTitle(false);
    if (pausedTitleTimerRef.current) {
      clearTimeout(pausedTitleTimerRef.current);
      pausedTitleTimerRef.current = null;
    }

    if (isPlaying) {
      // Während der Wiedergabe: nach genau 5 Sekunden sanft ausblenden
      // (auch im TV-Modus, wenn gerade ein Knopf mit weißer Umrandung fokussiert ist!)
      osdTimerRef.current = setTimeout(() => {
        setShowOsd(false);
        setFocusedControlIdx(null);
        // Eventuell aktiven HTML-Button-Fokus aufheben, damit keine weiße Umrandung stehen bleibt
        (document.activeElement as HTMLElement)?.blur();
      }, 5000);
    } else {
      // Bei Pause: Steuerleiste bleibt sichtbar.
      // Nach genau 5 Sekunden Inaktivität bei Pause den großen Titel links mittig einblenden
      pausedTitleTimerRef.current = setTimeout(() => {
        setShowPausedBigTitle(true);
      }, 5000);
    }
  }, [isPlaying]);

  // Wenn sich isPlaying ändert (Play / Pause Umschaltung), Timer neu anstoßen
  useEffect(() => {
    resetActivityTimers();
    return () => {
      if (osdTimerRef.current) clearTimeout(osdTimerRef.current);
      if (pausedTitleTimerRef.current) clearTimeout(pausedTitleTimerRef.current);
    };
  }, [isPlaying, resetActivityTimers]);

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
    resetActivityTimers();
  }, [resetActivityTimers]);

  const skipTime = useCallback(
    (seconds: number) => {
      if (!videoRef.current) return;
      const newTime = Math.max(
        0,
        Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + seconds)
      );
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
      triggerHud(seconds > 0 ? `+${seconds}s Vor` : `${seconds}s Zurück`);
      resetActivityTimers();
    },
    [resetActivityTimers]
  );

  const restartVideo = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = 0;
    setCurrentTime(0);
    videoRef.current.play().catch(() => {});
    setIsPlaying(true);
    triggerHud('Neustart');
    resetActivityTimers();
  }, [resetActivityTimers]);

  const handleNextVideo = useCallback(() => {
    const next = getNextVideo(activeVideo, currentCategory, categories, allVideos);
    if (next) {
      setActiveVideo(next);
      onVideoChange?.(next);
      triggerHud(`Nächstes Video: ${formatCleanTitle(next.name)}`);
      setCurrentTime(0);
      setIsPlaying(true);
    }
    resetActivityTimers();
  }, [activeVideo, currentCategory, categories, allVideos, onVideoChange, resetActivityTimers]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
    resetActivityTimers();
  }, [resetActivityTimers]);

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

  // TASTATUR- & FERNBEDIENUNGSSTEUERUNG
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Android TV Remote Back / Escape / Backspace / GoBack / KeyCode 4
      if (isTvBackEvent(e)) {
        e.preventDefault();
        e.stopPropagation();
        handleClosePlayer();
        return;
      }

      // Pfeil nach oben: Leiste und Knöpfe SOFORT und direkt verschwinden lassen
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setFocusedControlIdx(null);
        setShowOsd(false);
        (document.activeElement as HTMLElement)?.blur();
        if (osdTimerRef.current) {
          clearTimeout(osdTimerRef.current);
          osdTimerRef.current = null;
        }
        return;
      }

      // Bei allen anderen Tasten: OSD einblenden und Aktivitäts-Timer neu anstoßen
      resetActivityTimers();

      switch (e.key) {
        case ' ':
          e.preventDefault();
          e.stopPropagation();
          togglePlayPause();
          break;

        case 'Enter': {
          e.preventDefault();
          e.stopPropagation();
          if (isTvMode) {
            // Im TV-Modus: OK-Taste führt die fokussierte Steueraktion aus
            if (focusedControlIdx === null || focusedControlIdx === 0) {
              togglePlayPause();
            } else if (focusedControlIdx === 1) {
              restartVideo();
            } else if (focusedControlIdx === 2) {
              handleNextVideo();
            } else if (focusedControlIdx === 3) {
              toggleFullscreen();
            }
          } else {
            // Im Desktop-Modus: Enter pausiert/startet
            togglePlayPause();
          }
          break;
        }

        // Pfeil nach unten: Im TV-Modus Fokus zur Steuerungsleiste
        case 'ArrowDown': {
          if (isTvMode) {
            e.preventDefault();
            e.stopPropagation();
            setShowOsd(true);
            if (focusedControlIdx === null) {
              setFocusedControlIdx(0); // Startet auf dem Play-Button
            }
          }
          break;
        }

        // Pfeil links: Spult 10 Sekunden zurück ODER steuert TV-Buttons an
        case 'ArrowLeft': {
          e.preventDefault();
          e.stopPropagation();
          if (isTvMode && focusedControlIdx !== null) {
            setFocusedControlIdx((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
          } else {
            skipTime(-10);
          }
          break;
        }

        // Pfeil rechts: Spult 10 Sekunden vor ODER steuert TV-Buttons an
        case 'ArrowRight': {
          e.preventDefault();
          e.stopPropagation();
          if (isTvMode && focusedControlIdx !== null) {
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
    isTvMode,
    focusedControlIdx,
    togglePlayPause,
    restartVideo,
    handleNextVideo,
    toggleFullscreen,
    skipTime,
    handleClosePlayer,
    resetActivityTimers,
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
  const cleanTitle = formatCleanTitle(activeVideo.name);
  const parsedMeta = parseVideoDescription(activeVideo.metadata?.description);

  return (
    <div
      ref={containerRef}
      onMouseMove={resetActivityTimers}
      onClick={resetActivityTimers}
      className={`fixed inset-0 z-50 bg-black flex items-center justify-center select-none overflow-hidden font-sans ${
        !showOsd && isPlaying ? 'cursor-none' : 'cursor-default'
      }`}
    >
      {/* HTML5 Video Element */}
      <video
        key={streamUrl}
        ref={videoRef}
        src={streamUrl}
        autoPlay
        playsInline
        onLoadStart={startLoadingTimeout}
        onWaiting={startLoadingTimeout}
        onLoadedData={finishLoading}
        onCanPlay={finishLoading}
        onPlaying={finishLoading}
        onError={() => {
          finishLoading();
          triggerHud('Video-Wiedergabe nicht möglich');
        }}
        onTimeUpdate={() => {
          if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
        }}
        onLoadedMetadata={() => {
          if (videoRef.current) {
            setDuration(videoRef.current.duration);
            videoRef.current.play().catch(() => {});
          }
        }}
        onPlay={() => {
          setIsPlaying(true);
          finishLoading();
          resetActivityTimers();
        }}
        onPause={() => {
          setIsPlaying(false);
          resetActivityTimers();
        }}
        onEnded={handleNextVideo}
        onClick={(e) => {
          e.stopPropagation();
          resetActivityTimers();
          if (isTvMode) {
            // Im TV-Modus pausiert Klick auf Video
            togglePlayPause();
          } else {
            // Im Desktop-Modus standardmäßig NICHT pausieren bei Klick auf Videobereich
          }
        }}
        className={`w-full h-full object-contain ${
          isTvMode ? 'cursor-pointer' : 'cursor-default'
        }`}
      />

      {/* Robuster Ladebildschirm / Spinner beim Video-Wechsel & Puffern */}
      {isVideoLoading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 pointer-events-none backdrop-blur-xs select-none animate-in fade-in duration-150">
          <Loader2 className="w-12 h-12 text-[#E50914] animate-spin mb-3" />
          <span className="text-sm font-bold text-white/90 tracking-wide">Video wird geladen...</span>
        </div>
      )}

      {/* HUD Quick Notification Pill */}
      {hudFeedback && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 px-6 py-3 rounded-2xl bg-black/85 text-white font-bold text-base sm:text-xl border border-white/20 shadow-2xl backdrop-blur-md pointer-events-none animate-in fade-in zoom-in-95 duration-100 max-w-md text-center truncate">
          {hudFeedback}
        </div>
      )}

      {/* GROSSER PAUSENTITEL LINKS MITTIG (Mit tiefschwarzem Blend von links für perfekte Lesbarkeit) */}
      {!isPlaying && showPausedBigTitle && (
        <div className="absolute inset-0 z-25 pointer-events-none select-none flex items-center animate-in fade-in duration-700">
          {/* Tiefschwarzer Verlauf / Blend von links nach rechts für extremen Kontrast */}
          <div className="absolute inset-y-0 left-0 w-full sm:w-4/5 md:w-3/5 lg:w-1/2 bg-gradient-to-r from-black/95 via-black/85 to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30 pointer-events-none" />

          {/* Text-Inhalt links mittig */}
          <div className="relative z-10 px-8 sm:px-16 md:px-24 max-w-2xl sm:max-w-3xl animate-in fade-in slide-in-from-left-6 duration-700">
            <div className="flex items-center gap-2 mb-2 sm:mb-3">
              <span className="px-2.5 py-0.5 rounded-md bg-[#E50914] text-white text-[10px] sm:text-xs font-black uppercase tracking-wider shadow-lg">
                Angehalten
              </span>
              {currentCategory?.title && (
                <span className="text-xs sm:text-sm font-semibold text-gray-300 drop-shadow">
                  {currentCategory.title}
                </span>
              )}
            </div>
            <h1
              className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-tight line-clamp-2"
              style={{
                textShadow: '0 4px 24px rgba(0,0,0,0.9), 0 2px 6px rgba(0,0,0,0.8)',
              }}
            >
              {cleanTitle}
            </h1>
            {parsedMeta.description && (
              <p
                className="mt-2 sm:mt-3 text-xs sm:text-base text-gray-200 line-clamp-3 max-w-xl font-medium leading-relaxed"
                style={{
                  textShadow: '0 2px 10px rgba(0,0,0,0.9)',
                }}
              >
                {parsedMeta.description}
              </p>
            )}
          </div>
        </div>
      )}

      {/* TOP BAR OSD (Zurück-Button, Titel & Dateigröße) */}
      <div
        className={`absolute top-0 inset-x-0 z-30 p-4 sm:p-6 bg-gradient-to-b from-black/90 via-black/50 to-transparent flex items-center justify-between transition-all duration-500 ${
          showOsd
            ? 'opacity-100 pointer-events-auto translate-y-0 visible'
            : 'opacity-0 pointer-events-none -translate-y-4 invisible'
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
              {cleanTitle}
            </h2>
            <p className="text-[11px] text-gray-400">
              {formatBytes(activeVideo.size)}
            </p>
          </div>
        </div>
      </div>

      {/* BOTTOM CONTROLS BAR OSD (Fortschrittsleiste & Steuerung) */}
      <div
        className={`absolute bottom-0 inset-x-0 z-30 p-4 sm:p-8 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex flex-col gap-3.5 transition-all duration-500 ${
          showOsd
            ? 'opacity-100 pointer-events-auto translate-y-0 visible'
            : 'opacity-0 pointer-events-none translate-y-4 invisible'
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
              resetActivityTimers();
            }
          }}
          className="relative w-full h-2 sm:h-2.5 bg-white/20 rounded-full cursor-pointer overflow-hidden group hover:h-3.5 transition-all"
        >
          <div
            className="h-full rounded-full transition-all duration-100"
            style={{ width: `${progressPercent}%`, backgroundColor: '#E50914' }}
          />
        </div>

        {/* Playback Controls Row:
            - Wenn isTvMode === true: Große TV-Buttons mit D-Pad Fokus und weißer Umrandung
            - Wenn isTvMode === false: Schlanke, dezente Desktop-Controls ohne überdimensionierte TV-Rahmen
        */}
        <div className="flex items-center justify-between text-white pt-1">
          <div className="flex items-center gap-3 sm:gap-4">
            {/* 1. Play / Pause Button */}
            {isTvMode ? (
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
                {isPlaying ? (
                  <Pause className="w-5 h-5 sm:w-6 sm:h-6" />
                ) : (
                  <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={togglePlayPause}
                className="p-2 sm:p-2.5 rounded-xl bg-white/10 hover:bg-white/20 hover:scale-105 active:scale-95 text-white transition-all cursor-pointer flex items-center justify-center shadow-sm"
                title={isPlaying ? 'Pause (Leertaste)' : 'Wiedergabe (Leertaste)'}
                aria-label={isPlaying ? 'Pause' : 'Wiedergabe'}
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 sm:w-5 sm:h-5" />
                ) : (
                  <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                )}
              </button>
            )}

            {/* 2. Neustart / Restart Button */}
            {isTvMode ? (
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
            ) : (
              <button
                type="button"
                onClick={restartVideo}
                className="p-2 sm:p-2.5 rounded-xl bg-white/10 hover:bg-white/20 hover:scale-105 active:scale-95 text-gray-200 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                title="Von Anfang an abspielen (Neustart / R)"
                aria-label="Neustart"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="text-xs font-semibold hidden sm:inline">Neustart</span>
              </button>
            )}

            {/* 3. Nächstes Video / Next Button */}
            {isTvMode ? (
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
            ) : (
              <button
                type="button"
                onClick={handleNextVideo}
                className="p-2 sm:p-2.5 rounded-xl bg-white/10 hover:bg-white/20 hover:scale-105 active:scale-95 text-gray-200 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                title="Nächstes Video in dieser Kategorie (N)"
                aria-label="Nächstes Video"
              >
                <SkipForward className="w-4 h-4" />
                <span className="text-xs font-semibold hidden sm:inline">Nächstes Video</span>
              </button>
            )}

            {/* Time Indicator */}
            <span className="text-xs sm:text-sm font-mono text-gray-300 ml-1 sm:ml-2 select-none">
              {formatPlayerTime(currentTime)} / {formatPlayerTime(duration)}
            </span>
          </div>

          {/* 4. Vollbild Button */}
          <div className="flex items-center gap-3">
            {isTvMode ? (
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
            ) : (
              <button
                type="button"
                onClick={toggleFullscreen}
                className="p-2 sm:p-2.5 rounded-xl bg-white/10 hover:bg-white/20 hover:scale-105 active:scale-95 text-gray-200 hover:text-white transition-all cursor-pointer flex items-center justify-center shadow-sm"
                title="Vollbild umschalten (F)"
                aria-label="Vollbild"
              >
                {isFullscreen ? (
                  <Minimize className="w-4 h-4 sm:w-5 sm:h-5" />
                ) : (
                  <Maximize className="w-4 h-4 sm:w-5 sm:h-5" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
