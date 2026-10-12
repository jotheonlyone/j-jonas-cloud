import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Film,
  Play,
  Pause,
  Info,
  Download,
  ArrowLeft,
  X,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Cloud,
  Upload,
  Search,
  Sparkles,
  Layers
} from 'lucide-react';
import type { FileItemData, UserAccount } from '../types';
import { formatBytes, getStreamUrl } from '../services/storageApi';
import { isVideoFile } from './MediaViewerModal';

interface CinemaTvViewProps {
  user: UserAccount;
  items: FileItemData[];
  onBackToFiles: () => void;
  onPlayVideo: (item: FileItemData) => void;
  onDownloadVideo: (item: FileItemData) => void;
  onUploadClick?: () => void;
  darkMode?: boolean;
}

// Built-in cinematic demo showcase clips if the user's library is empty
const DEMO_CINEMA_VIDEOS: FileItemData[] = [
  {
    name: 'Cosmos_Horizon_Documentary.mp4',
    type: 'file',
    size: 420 * 1024 * 1024,
    modified: new Date(Date.now() - 3600000 * 4).toISOString(),
    mime_type: 'video/mp4',
    path: 'Videos/Cosmos_Horizon_Documentary.mp4',
  },
  {
    name: 'Neon_City_Nightfall_Cinematic.webm',
    type: 'file',
    size: 145 * 1024 * 1024,
    modified: new Date(Date.now() - 3600000 * 24).toISOString(),
    mime_type: 'video/webm',
    path: 'Videos/Neon_City_Nightfall_Cinematic.webm',
  },
  {
    name: 'Alpine_Glacier_Drone_Reel.mp4',
    type: 'file',
    size: 280 * 1024 * 1024,
    modified: new Date(Date.now() - 3600000 * 48).toISOString(),
    mime_type: 'video/mp4',
    path: 'Videos/Alpine_Glacier_Drone_Reel.mp4',
  },
  {
    name: 'Deep_Ocean_4K_Nature.mp4',
    type: 'file',
    size: 512 * 1024 * 1024,
    modified: new Date(Date.now() - 3600000 * 72).toISOString(),
    mime_type: 'video/mp4',
    path: 'Videos/Deep_Ocean_4K_Nature.mp4',
  },
];

export const CinemaTvView: React.FC<CinemaTvViewProps> = ({
  user,
  items,
  onBackToFiles,
  onPlayVideo,
  onDownloadVideo,
  onUploadClick,
  darkMode,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDetailsVideo, setSelectedDetailsVideo] = useState<FileItemData | null>(null);
  const [activePlayerVideo, setActivePlayerVideo] = useState<FileItemData | null>(null);
  const [useDemoFallback, setUseDemoFallback] = useState(false);

  // Extract all video items from current files
  const userVideos = useMemo(() => {
    return items.filter(isVideoFile);
  }, [items]);

  const displayVideos = useMemo(() => {
    if (userVideos.length > 0) return userVideos;
    if (useDemoFallback) return DEMO_CINEMA_VIDEOS;
    return [];
  }, [userVideos, useDemoFallback]);

  // Filtered by search query
  const filteredVideos = useMemo(() => {
    if (!searchQuery.trim()) return displayVideos;
    const q = searchQuery.toLowerCase();
    return displayVideos.filter((v) => v.name.toLowerCase().includes(q));
  }, [displayVideos, searchQuery]);

  // Hero Video (featured video top)
  const heroVideo = useMemo(() => {
    if (filteredVideos.length > 0) return filteredVideos[0];
    if (displayVideos.length > 0) return displayVideos[0];
    return null;
  }, [filteredVideos, displayVideos]);

  // -------------------------------------------------------------
  // D-PAD & FERNBEDIENUNGS-STEUERUNG (Keine extra auffälligen Boxen)
  // Zones: 'header' | 'hero' | 'grid'
  // Header: 0 = Back button
  // Hero: 0 = Play button, 1 = Details button
  // Grid: 0 to filteredVideos.length - 1
  // -------------------------------------------------------------
  const [focusedZone, setFocusedZone] = useState<'header' | 'hero' | 'grid'>(
    heroVideo ? 'hero' : 'header'
  );
  const [heroIndex, setHeroIndex] = useState<number>(0);
  const [gridIndex, setGridIndex] = useState<number>(0);

  const backBtnRef = useRef<HTMLButtonElement>(null);
  const heroPlayBtnRef = useRef<HTMLButtonElement>(null);
  const heroInfoBtnRef = useRef<HTMLButtonElement>(null);
  const gridItemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Calculate dynamic columns for vertical navigation (no horizontal scroll)
  const getGridCols = (): number => {
    if (typeof window === 'undefined') return 3;
    const w = window.innerWidth;
    if (w >= 1280) return 4;
    if (w >= 1024) return 3;
    if (w >= 640) return 2;
    return 1;
  };

  // Auto-scroll the focused element into view smoothly
  useEffect(() => {
    if (activePlayerVideo || selectedDetailsVideo) return;

    if (focusedZone === 'header') {
      backBtnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else if (focusedZone === 'hero') {
      if (heroIndex === 0) heroPlayBtnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      else heroInfoBtnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else if (focusedZone === 'grid') {
      const el = gridItemRefs.current[gridIndex];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [focusedZone, heroIndex, gridIndex, activePlayerVideo, selectedDetailsVideo]);

  // Handle D-Pad Keys
  useEffect(() => {
    const handleTvDpad = (e: KeyboardEvent) => {
      if (activePlayerVideo || selectedDetailsVideo) return;

      const cols = getGridCols();

      switch (e.key) {
        case 'ArrowUp': {
          e.preventDefault();
          if (focusedZone === 'grid') {
            if (gridIndex < cols) {
              if (heroVideo) {
                setFocusedZone('hero');
                setHeroIndex(0);
              } else {
                setFocusedZone('header');
              }
            } else {
              setGridIndex((prev) => Math.max(0, prev - cols));
            }
          } else if (focusedZone === 'hero') {
            setFocusedZone('header');
          }
          break;
        }

        case 'ArrowDown': {
          e.preventDefault();
          if (focusedZone === 'header') {
            if (heroVideo) {
              setFocusedZone('hero');
              setHeroIndex(0);
            } else if (filteredVideos.length > 0) {
              setFocusedZone('grid');
              setGridIndex(0);
            }
          } else if (focusedZone === 'hero') {
            if (filteredVideos.length > 0) {
              setFocusedZone('grid');
              setGridIndex(0);
            }
          } else if (focusedZone === 'grid') {
            setGridIndex((prev) => Math.min(filteredVideos.length - 1, prev + cols));
          }
          break;
        }

        case 'ArrowLeft': {
          e.preventDefault();
          if (focusedZone === 'hero') {
            setHeroIndex((prev) => (prev > 0 ? prev - 1 : 0));
          } else if (focusedZone === 'grid') {
            setGridIndex((prev) => (prev > 0 ? prev - 1 : 0));
          }
          break;
        }

        case 'ArrowRight': {
          e.preventDefault();
          if (focusedZone === 'hero') {
            setHeroIndex((prev) => (prev < 1 ? prev + 1 : 1));
          } else if (focusedZone === 'grid') {
            setGridIndex((prev) => Math.min(filteredVideos.length - 1, prev + 1));
          }
          break;
        }

        case 'Enter': {
          e.preventDefault();
          if (focusedZone === 'header') {
            onBackToFiles();
          } else if (focusedZone === 'hero' && heroVideo) {
            if (heroIndex === 0) {
              startPlayback(heroVideo);
            } else {
              setSelectedDetailsVideo(heroVideo);
            }
          } else if (focusedZone === 'grid' && filteredVideos[gridIndex]) {
            startPlayback(filteredVideos[gridIndex]);
          }
          break;
        }

        case 'Escape':
        case 'Backspace': {
          e.preventDefault();
          onBackToFiles();
          break;
        }
      }
    };

    window.addEventListener('keydown', handleTvDpad);
    return () => window.removeEventListener('keydown', handleTvDpad);
  }, [
    focusedZone,
    heroIndex,
    gridIndex,
    heroVideo,
    filteredVideos,
    activePlayerVideo,
    selectedDetailsVideo,
    onBackToFiles,
  ]);

  const startPlayback = (video: FileItemData) => {
    setActivePlayerVideo(video);
    onPlayVideo(video);
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Unbekannt';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="relative w-full min-h-screen bg-[#141414] text-white flex flex-col font-sans selection:bg-[#E50914] selection:text-white pb-16 overflow-x-hidden">
      {/* 1. CINEMA HEADER (1:1 EXAKT GLEICH WIE /cinema) */}
      <header className="sticky top-0 z-40 w-full flex items-center justify-between px-4 sm:px-8 py-3 bg-[#141414] border-b border-white/5 transition-all">
        {/* Left: Video on Demand in place of J.Jonas Cloud with 'by J. Jonas Cloud' directly underneath to the right + Back Button */}
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <button
            ref={backBtnRef}
            onClick={onBackToFiles}
            onMouseEnter={() => setFocusedZone('header')}
            className={`group flex items-center gap-2 px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all border active:scale-95 shadow-sm outline-none ${
              focusedZone === 'header'
                ? 'bg-white text-black border-white ring-2 ring-white'
                : 'bg-white/10 hover:bg-white/20 text-gray-200 hover:text-white border-white/10 hover:border-white/25'
            }`}
            title="Zurück zur Cloud-Dateiansicht"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span className="hidden xs:inline">Zurück</span>
          </button>

          {/* Logo-Gruppe:
              - Mattes, kräftiges Rot (#E50914) in fetter, geradliniger serifenloser Schrift
              - Direkt unter dem Logo im Header, rechts darunter, in Grau, klein: by J. Jonas Cloud
          */}
          <div className="flex flex-col select-none min-w-0 leading-tight">
            <span
              className="font-black tracking-tight text-xl sm:text-2xl md:text-3xl select-none leading-none"
              style={{
                color: '#E50914',
                fontFamily:
                  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
              }}
            >
              Video on Demand
            </span>
            <span className="text-[10px] sm:text-[11px] font-medium text-gray-400/80 tracking-normal select-none self-end mt-0.5">
              by J. Jonas Cloud
            </span>
          </div>
        </div>

        {/* Center: Search inside Cinema */}
        <div className="flex-1 max-w-md mx-3 hidden md:block">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Videos und Filme suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2 text-xs sm:text-sm rounded-full bg-white/10 hover:bg-white/15 focus:bg-black/60 focus:ring-1 focus:ring-[#E50914] border border-white/10 focus:border-[#E50914] text-white placeholder-gray-400 focus:outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Right: Upload Action */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {onUploadClick && (
            <button
              onClick={onUploadClick}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/15 transition-all active:scale-95 shadow-sm"
              title="Neues Video hochladen"
            >
              <Upload className="w-3.5 h-3.5 text-gray-300" />
              <span className="hidden sm:inline">Video hochladen</span>
            </button>
          )}
        </div>
      </header>

      {/* 2. HERO BANNER (1:1 EXAKT GLEICH WIE /cinema) */}
      {heroVideo ? (
        <section className="relative w-full h-[55vh] min-h-[380px] max-h-[640px] flex items-end overflow-hidden mb-8 select-none">
          {/* Ambient Video / Artwork Background */}
          <div className="absolute inset-0 bg-[#0a0a0a] overflow-hidden pointer-events-none">
            <div className="w-full h-full bg-gradient-to-br from-neutral-900 via-neutral-950 to-black relative">
              <div
                className="absolute inset-0 opacity-15"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 70% 30%, rgba(229, 9, 20, 0.25) 0%, transparent 60%), radial-gradient(circle at 20% 70%, rgba(229, 9, 20, 0.1) 0%, transparent 50%)',
                }}
              />
              <div className="absolute right-8 bottom-12 opacity-10 flex items-center justify-center pointer-events-none">
                <Film className="w-96 h-96 text-white" />
              </div>
            </div>

            {/* Gradient Overlay to #141414 (Vignette) */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/70 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#141414] via-[#141414]/50 to-transparent" />
          </div>

          {/* Hero Content Information */}
          <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-8 pb-10 flex flex-col justify-end">
            {/* Minimalist Sub-meta: Date and File Size */}
            <div className="flex items-center gap-2 mb-2 text-xs sm:text-sm text-gray-300 font-medium select-none">
              <span>Hinzugefügt am {formatDate(heroVideo.modified)}</span>
              <span className="text-gray-500">·</span>
              <span>{formatBytes(heroVideo.size)}</span>
            </div>

            {/* Title with soft shadow */}
            <h1
              className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-white drop-shadow-xl max-w-3xl line-clamp-2 leading-tight mb-6"
              style={{
                textShadow: '0 4px 20px rgba(0, 0, 0, 0.8)',
              }}
            >
              {heroVideo.name.replace(/\.[^/.]+$/, '').replace(/[_.-]+/g, ' ')}
            </h1>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3.5">
              <button
                ref={heroPlayBtnRef}
                onClick={() => startPlayback(heroVideo)}
                onMouseEnter={() => {
                  setFocusedZone('hero');
                  setHeroIndex(0);
                }}
                className={`group flex items-center gap-3 px-7 py-3 rounded-xl font-extrabold text-sm sm:text-base transition-all shadow-xl active:scale-95 select-none cursor-pointer outline-none ${
                  focusedZone === 'hero' && heroIndex === 0
                    ? 'bg-white text-black ring-4 ring-white shadow-white/30 scale-105'
                    : 'bg-white hover:bg-gray-100 text-black hover:shadow-white/20'
                }`}
              >
                <Play className="w-5 h-5 fill-black text-black transition-transform group-hover:scale-110" />
                <span>Abspielen</span>
              </button>

              <button
                ref={heroInfoBtnRef}
                onClick={() => setSelectedDetailsVideo(heroVideo)}
                onMouseEnter={() => {
                  setFocusedZone('hero');
                  setHeroIndex(1);
                }}
                className={`flex items-center gap-2.5 px-6 py-3 rounded-xl backdrop-blur-md font-semibold text-sm sm:text-base transition-all active:scale-95 select-none cursor-pointer outline-none ${
                  focusedZone === 'hero' && heroIndex === 1
                    ? 'bg-white/30 text-white border-2 border-white ring-2 ring-white scale-105'
                    : 'bg-white/20 hover:bg-white/30 text-white border border-white/15 hover:border-white/30'
                }`}
              >
                <Info className="w-5 h-5 text-gray-200" />
                <span>Details / Download</span>
              </button>
            </div>
          </div>
        </section>
      ) : (
        /* Empty State */
        <div className="w-full max-w-4xl mx-auto my-12 px-6 py-12 rounded-3xl bg-neutral-900/60 border border-white/10 text-center shadow-2xl">
          <div
            className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center border border-white/10"
            style={{ backgroundColor: 'rgba(229, 9, 20, 0.1)', color: '#E50914' }}
          >
            <Film className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Noch keine Videos in der Cloud</h2>
          <p className="text-sm text-gray-400 max-w-md mx-auto mb-6">
            Lade MP4-, WEBM- oder MOV-Dateien in deine J.Jonas Cloud hoch, um sie hier im VOD-Streaming-Modus abzuspielen.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            {onUploadClick && (
              <button
                onClick={onUploadClick}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-bold text-sm transition-colors active:scale-95"
                style={{ backgroundColor: '#E50914' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = '#B80710')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = '#E50914')}
              >
                <Upload className="w-4 h-4" />
                Video jetzt hochladen
              </button>
            )}
            <button
              onClick={() => setUseDemoFallback(!useDemoFallback)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-gray-200 text-sm font-semibold border border-white/10 transition-all active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              {useDemoFallback ? 'Demo-Videos ausblenden' : 'Demo-Trailerschau aktivieren'}
            </button>
          </div>
        </div>
      )}

      {/* 3. 16:9 RESPONSIVES WIDESCREEN-GRID (OHNE HORIZONTALES SCROLLEN) */}
      {filteredVideos.length > 0 && (
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-2.5">
              <Layers className="w-4 h-4" style={{ color: '#E50914' }} />
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                Alle Videos & Filme (16:9)
              </h2>
            </div>
            <span className="text-xs text-gray-400">
              {filteredVideos.length} {filteredVideos.length === 1 ? 'Video' : 'Videos'} verfügbar
            </span>
          </div>

          {/* 16:9 Grid (Vertical Scrolling Only, Fernseher-optimiert & per D-Pad / Pfeiltasten navigierbar) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6 py-2">
            {filteredVideos.map((video, idx) => {
              const isFocused = focusedZone === 'grid' && gridIndex === idx;
              const streamUrl = getStreamUrl(video.path || video.name);

              return (
                <div
                  key={`tv-grid-${video.path || video.name}-${idx}`}
                  ref={(el) => {
                    gridItemRefs.current[idx] = el;
                  }}
                  onClick={() => {
                    setFocusedZone('grid');
                    setGridIndex(idx);
                    startPlayback(video);
                  }}
                  onMouseEnter={() => {
                    setFocusedZone('grid');
                    setGridIndex(idx);
                  }}
                  className={`group relative flex flex-col rounded-xl overflow-hidden bg-neutral-900 border transition-all duration-300 ease-out cursor-pointer select-none outline-none ${
                    isFocused
                      ? 'border-white ring-4 ring-white scale-105 z-30 shadow-2xl shadow-black/90'
                      : 'border-white/10 hover:border-white/30 hover:scale-105 hover:z-20 hover:shadow-2xl hover:shadow-black/90'
                  }`}
                >
                  {/* 16:9 Thumbnail Area with Subtle Overlay */}
                  <div className="relative w-full aspect-video bg-neutral-950 overflow-hidden flex items-center justify-center">
                    <video
                      src={streamUrl}
                      preload="metadata"
                      muted
                      playsInline
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300"
                    />

                    {/* Gradient Overlay to dark bottom */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

                    {/* Play Button in Center on Hover / Focus */}
                    <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 ${
                          isFocused
                            ? 'bg-white text-black scale-110 opacity-100'
                            : 'bg-white text-black scale-90 group-hover:scale-110 opacity-70 group-hover:opacity-100'
                        }`}
                      >
                        <Play className="w-6 h-6 fill-black translate-x-0.5" />
                      </div>
                    </div>

                    {/* Discrete bottom right Quick Download Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDownloadVideo(video);
                      }}
                      className="absolute bottom-2.5 right-2.5 p-2 rounded-full bg-black/70 hover:bg-[#E50914] text-white/80 hover:text-white backdrop-blur-sm border border-white/15 opacity-0 group-hover:opacity-100 transition-all duration-200 z-20 hover:scale-110"
                      title="Video direkt herunterladen"
                      aria-label="Video herunterladen"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Info beneath Thumbnail: White Title & Discrete File Size */}
                  <div className="p-3 bg-neutral-900/90 flex flex-col justify-between">
                    <h3
                      className="text-xs sm:text-sm font-semibold text-white group-hover:text-gray-200 transition-colors truncate mb-1"
                      title={video.name}
                    >
                      {video.name.replace(/\.[^/.]+$/, '').replace(/[_.-]+/g, ' ')}
                    </h3>

                    <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1 border-t border-white/5">
                      <span>{formatBytes(video.size)}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDetailsVideo(video);
                        }}
                        className="text-gray-400 hover:text-white flex items-center gap-1 transition-colors hover:underline"
                      >
                        <Info className="w-3 h-3" />
                        <span>Info</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. BRANDING & FOOTER (1:1 EXAKT GLEICH WIE /cinema) */}
      <footer className="w-full max-w-7xl mx-auto px-4 sm:px-8 mt-16 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs select-none">
        <div className="flex items-center gap-2 text-gray-500">
          <Film className="w-4 h-4" style={{ color: '#E50914' }} />
          <span>Cinema Mode · Video on Demand Streaming Engine</span>
        </div>

        <div
          className={`flex flex-col items-center justify-center font-medium tracking-tight transition-opacity ${
            darkMode ? 'text-gray-200' : 'text-[#141414] dark:text-gray-200'
          }`}
          style={{ opacity: 0.6 }}
        >
          <Cloud className="w-5 h-5 text-current mb-0.5" />
          <span className="text-[11px] leading-tight">by J. Jonas Cloud</span>
        </div>
      </footer>

      {/* 5. DETAILS MODAL */}
      {selectedDetailsVideo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
          onClick={() => setSelectedDetailsVideo(null)}
        >
          <div
            className="relative w-full max-w-lg rounded-2xl bg-neutral-900 border border-white/15 p-6 shadow-2xl text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedDetailsVideo(null)}
              className="absolute right-4 top-4 p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Schließen"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center border border-white/10"
                style={{ backgroundColor: 'rgba(229, 9, 20, 0.1)', color: '#E50914' }}
              >
                <Film className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">Video-Details</h3>
                <p className="text-xs text-gray-400">Metadaten und Download</p>
              </div>
            </div>

            <div className="space-y-3 bg-black/40 p-4 rounded-xl border border-white/5 mb-5 text-xs sm:text-sm">
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-gray-400">Dateiname:</span>
                <span className="font-semibold text-white truncate max-w-[260px]">
                  {selectedDetailsVideo.name}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-gray-400">Dateigröße:</span>
                <span className="font-mono text-gray-200">
                  {formatBytes(selectedDetailsVideo.size)}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-gray-400">Datum:</span>
                <span className="text-gray-200">
                  {formatDate(selectedDetailsVideo.modified)}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-gray-400">Format:</span>
                <span className="font-mono text-gray-300 uppercase">
                  {selectedDetailsVideo.name.split('.').pop() || 'MP4'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  onDownloadVideo(selectedDetailsVideo);
                  setSelectedDetailsVideo(null);
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs border border-white/10 transition-colors"
              >
                <Download className="w-4 h-4 text-blue-400" />
                Datei herunterladen
              </button>

              <button
                onClick={() => {
                  const vid = selectedDetailsVideo;
                  setSelectedDetailsVideo(null);
                  startPlayback(vid);
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-bold text-xs transition-colors active:scale-95"
                style={{ backgroundColor: '#E50914' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = '#B80710')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = '#E50914')}
              >
                <Play className="w-4 h-4 fill-white" />
                Jetzt abspielen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. FERNBEDIENUNGS-OPTIMIERTER VOLLBILD MEDIA-PLAYER */}
      {activePlayerVideo && (
        <TvMediaPlayerOverlay
          video={activePlayerVideo}
          onClose={() => setActivePlayerVideo(null)}
          onDownload={() => onDownloadVideo(activePlayerVideo)}
          darkMode={darkMode}
        />
      )}
    </div>
  );
};

// -------------------------------------------------------------
// FERNBEDIENUNGS-OPTIMIERTER VOLLBILD MEDIA-PLAYER
// (Gleiches Styling wie Cinema Player + Direkte Steuerung per Fernbedienung:
//  Play/Pause mit Space/Enter/OK, Vor/Zurückspringen mit Links/Rechts,
//  Lautstärke mit Oben/Unten, Esc/Backspace zum Schließen)
// -------------------------------------------------------------
interface TvMediaPlayerOverlayProps {
  video: FileItemData;
  onClose: () => void;
  onDownload: () => void;
  darkMode?: boolean;
}

const TvMediaPlayerOverlay: React.FC<TvMediaPlayerOverlayProps> = ({
  video,
  onClose,
  onDownload,
  darkMode,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // OSD timeout (Overlay blendet sich nach Inaktivität aus)
  const [showOsd, setShowOsd] = useState(true);
  const osdTimerRef = useRef<NodeJS.Timeout | null>(null);

  // HUD feedback toast (-10s / +10s / Play / Pause)
  const [hudFeedback, setHudFeedback] = useState<string | null>(null);
  const hudTimerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerHud = (text: string) => {
    setHudFeedback(text);
    if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    hudTimerRef.current = setTimeout(() => {
      setHudFeedback(null);
    }, 1200);
  };

  const resetOsdTimer = useCallback(() => {
    setShowOsd(true);
    if (osdTimerRef.current) clearTimeout(osdTimerRef.current);
    osdTimerRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowOsd(false);
      }
    }, 3500);
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) {
      setShowOsd(true);
      if (osdTimerRef.current) clearTimeout(osdTimerRef.current);
    } else {
      resetOsdTimer();
    }
  }, [isPlaying, resetOsdTimer]);

  const togglePlayPause = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
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

  const changeVolume = useCallback((delta: number) => {
    if (!videoRef.current) return;
    const newVol = Math.max(0, Math.min(1, videoRef.current.volume + delta));
    videoRef.current.volume = newVol;
    setVolume(newVol);
    if (newVol > 0 && isMuted) {
      videoRef.current.muted = false;
      setIsMuted(false);
    }
    triggerHud(`Lautstärke: ${Math.round(newVol * 100)}%`);
    resetOsdTimer();
  }, [isMuted, resetOsdTimer]);

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    const nextMuted = !videoRef.current.muted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
    triggerHud(nextMuted ? 'Stumm' : 'Ton an');
    resetOsdTimer();
  }, [resetOsdTimer]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
    resetOsdTimer();
  }, [resetOsdTimer]);

  // Fernbedienungs-Tastensteuerung im Player
  useEffect(() => {
    const handlePlayerKeys = (e: KeyboardEvent) => {
      resetOsdTimer();

      switch (e.key) {
        case ' ':
        case 'k':
        case 'K':
        case 'MediaPlayPause':
        case 'Enter': {
          e.preventDefault();
          togglePlayPause();
          break;
        }

        case 'ArrowLeft': {
          e.preventDefault();
          skipTime(-10);
          break;
        }

        case 'ArrowRight': {
          e.preventDefault();
          skipTime(10);
          break;
        }

        case 'ArrowUp': {
          e.preventDefault();
          changeVolume(0.1);
          break;
        }

        case 'ArrowDown': {
          e.preventDefault();
          changeVolume(-0.1);
          break;
        }

        case 'm':
        case 'M': {
          e.preventDefault();
          toggleMute();
          break;
        }

        case 'f':
        case 'F': {
          e.preventDefault();
          toggleFullscreen();
          break;
        }

        case 'Escape':
        case 'Backspace': {
          e.preventDefault();
          onClose();
          break;
        }
      }
    };

    window.addEventListener('keydown', handlePlayerKeys);
    return () => window.removeEventListener('keydown', handlePlayerKeys);
  }, [
    togglePlayPause,
    skipTime,
    changeVolume,
    toggleMute,
    toggleFullscreen,
    onClose,
    resetOsdTimer,
  ]);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const streamUrl = getStreamUrl(video.path || video.name);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black flex flex-col justify-between animate-in fade-in duration-200 select-none"
      onMouseMove={resetOsdTimer}
      onClick={togglePlayPause}
    >
      {/* Top Floating Controls Bar */}
      <div
        className={`w-full flex items-center justify-between p-4 sm:p-6 bg-gradient-to-b from-black/90 via-black/40 to-transparent z-20 text-white transition-opacity duration-300 ${
          showOsd ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 min-w-0 pr-4">
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/25 text-white transition-all mr-1"
            title="Zurück (Esc)"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            <span
              className="text-[10px] font-extrabold uppercase tracking-widest block"
              style={{ color: '#E50914' }}
            >
              J.Jonas Cloud Cinema Player
            </span>
            <h2 className="text-sm sm:text-base font-bold text-white truncate max-w-md sm:max-w-xl">
              {video.name}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onDownload}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Herunterladen"
          >
            <Download className="w-4 h-4 text-blue-400" />
          </button>

          <button
            onClick={onClose}
            className="p-2.5 rounded-full bg-white/10 hover:bg-[#E50914] text-white transition-colors"
            title="Schließen (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Video Player Element */}
      <div className="flex-1 w-full h-full flex items-center justify-center relative overflow-hidden bg-black">
        <video
          ref={videoRef}
          src={streamUrl}
          autoPlay
          playsInline
          className="w-full h-full max-h-[85vh] object-contain outline-none bg-black"
          onTimeUpdate={() => {
            if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
          }}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              setDuration(videoRef.current.duration);
              setIsPlaying(!videoRef.current.paused);
            }
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => {
            setIsPlaying(false);
            setShowOsd(true);
          }}
        >
          Dein Browser unterstützt diesen Videostream nicht.
        </video>

        {/* HUD Feedback Toast (-10s / +10s / Lautstärke) */}
        {hudFeedback && (
          <div className="absolute z-40 px-6 py-3 rounded-2xl bg-black/80 border border-white/20 text-white text-xl font-black shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
            {hudFeedback}
          </div>
        )}
      </div>

      {/* Bottom Controls Overlay */}
      <div
        className={`w-full px-6 sm:px-10 py-4 bg-gradient-to-t from-black via-black/60 to-transparent z-20 flex flex-col gap-2 transition-opacity duration-300 ${
          showOsd ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress Bar */}
        <div className="w-full flex items-center gap-3">
          <span className="text-xs font-mono font-medium text-gray-300 min-w-[50px]">
            {formatTime(currentTime)}
          </span>

          <div
            className="flex-1 relative h-2 bg-white/20 hover:h-3 rounded-full overflow-hidden cursor-pointer transition-all"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pos = (e.clientX - rect.left) / rect.width;
              if (videoRef.current && duration > 0) {
                const newT = pos * duration;
                videoRef.current.currentTime = newT;
                setCurrentTime(newT);
              }
            }}
          >
            <div
              className="h-full rounded-full transition-all duration-100"
              style={{
                width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                backgroundColor: '#E50914',
              }}
            />
          </div>

          <span className="text-xs font-mono font-medium text-gray-400 min-w-[50px] text-right">
            {formatTime(duration)}
          </span>
        </div>

        {/* Action Controls & Discreet Hints */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => skipTime(-10)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95"
              title="10s zurück (◄)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={togglePlayPause}
              className="p-2.5 rounded-full text-white transition-all active:scale-95 shadow-md"
              style={{ backgroundColor: '#E50914' }}
              title="Wiedergabe / Pause"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-white" />
              ) : (
                <Play className="w-5 h-5 fill-white translate-x-0.5" />
              )}
            </button>

            <button
              onClick={() => skipTime(10)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95"
              title="10s vor (►)"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          <div className="text-[11px] text-gray-500 hidden sm:block">
            Tipp: Leertaste/Enter für Pause/Play · Pfeiltasten zum Vor- und Zurückspulen
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Stummschalten (M)"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-red-400" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>

            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Vollbild (F)"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
