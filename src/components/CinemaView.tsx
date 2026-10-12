import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Film,
  Play,
  Info,
  Download,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  X,
  Maximize2,
  Cloud,
  Upload,
  Search,
  Sparkles,
  Clock,
  Layers,
  FileVideo,
  Check
} from 'lucide-react';
import type { FileItemData, UserAccount } from '../types';
import { formatBytes, getStreamUrl, triggerDirectDownload } from '../services/storageApi';
import { isVideoFile } from './MediaViewerModal';

interface CinemaViewProps {
  user: UserAccount;
  items: FileItemData[];
  onBackToFiles: () => void;
  onPlayVideo: (item: FileItemData) => void;
  onDownloadVideo: (item: FileItemData) => void;
  onUploadClick?: () => void;
  darkMode: boolean;
  onScanVideos?: () => Promise<FileItemData[]>;
}

// Format badge determination (HD, 4K, MP4, WEBM, etc.)
function getVideoBadge(item: FileItemData): { quality: string; ext: string } {
  const ext = (item.name.split('.').pop() || 'mp4').toUpperCase();
  // If video is >= 300MB, tag as 4K, else if >= 20MB as HD, else SD
  const sizeMb = item.size / (1024 * 1024);
  let quality = 'HD';
  if (sizeMb >= 250) {
    quality = '4K ULTRA HD';
  } else if (sizeMb < 15) {
    quality = 'HD';
  }
  return { quality, ext };
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

export const CinemaView: React.FC<CinemaViewProps> = ({
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
  const [activeFullscreenVideo, setActiveFullscreenVideo] = useState<FileItemData | null>(null);
  const [useDemoFallback, setUseDemoFallback] = useState(false);

  // Extract all video items from current files
  const userVideos = useMemo(() => {
    return items.filter(isVideoFile);
  }, [items]);

  // If user has no videos, allow showing showcase demo items
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

  // Featured hero video (top / newest video)
  const heroVideo = useMemo(() => {
    if (filteredVideos.length > 0) return filteredVideos[0];
    if (displayVideos.length > 0) return displayVideos[0];
    return null;
  }, [filteredVideos, displayVideos]);

  // Carousel refs for smooth horizontal scrolling
  const recentRowRef = useRef<HTMLDivElement>(null);
  const allRowRef = useRef<HTMLDivElement>(null);

  const scrollRow = (ref: React.RefObject<HTMLDivElement | null>, direction: 'left' | 'right') => {
    if (!ref.current) return;
    const scrollAmount = ref.current.clientWidth * 0.75;
    ref.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  // Keyboard shortcut for closing modals or fullscreen player
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeFullscreenVideo) {
          setActiveFullscreenVideo(null);
        } else if (selectedDetailsVideo) {
          setSelectedDetailsVideo(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFullscreenVideo, selectedDetailsVideo]);

  // Formatted date helper
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
      {/* 1. CINEMA TOP BAR & DISCREET NAVIGATION (ohne schwarzen Verlauf oben) */}
      <header className="sticky top-0 z-40 w-full flex items-center justify-between px-4 sm:px-8 py-3 bg-[#141414] border-b border-white/5 transition-all">
        {/* Left: Video on Demand in place of J.Jonas Cloud with 'by J. Jonas Cloud' directly underneath to the right + Back Button */}
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <button
            onClick={onBackToFiles}
            className="group flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-gray-200 hover:text-white text-xs sm:text-sm font-semibold transition-all border border-white/10 hover:border-white/25 active:scale-95 shadow-sm"
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

      {/* 2. HERO BANNER (FEATURED VIDEO OBEN) */}
      {heroVideo ? (
        <section className="relative w-full h-[55vh] min-h-[380px] max-h-[640px] flex items-end overflow-hidden mb-8 select-none">
          {/* Ambient Video / Artwork Background */}
          <div className="absolute inset-0 bg-[#0a0a0a] overflow-hidden pointer-events-none">
            {/* Cinematic simulated backdrop canvas */}
            <div className="w-full h-full bg-gradient-to-br from-neutral-900 via-neutral-950 to-black relative">
              {/* Subtle movie film vignette and grid pattern */}
              <div
                className="absolute inset-0 opacity-15"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 70% 30%, rgba(229, 9, 20, 0.25) 0%, transparent 60%), radial-gradient(circle at 20% 70%, rgba(229, 9, 20, 0.1) 0%, transparent 50%)',
                }}
              />
              {/* Cinematic movie reel graphic watermark */}
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

            {/* Prominent Action Buttons */}
            <div className="flex flex-wrap items-center gap-3.5">
              {/* 1. Weißer Play-Button ("Abspielen") mit schwarzer Schrift und Play-Icon */}
              <button
                onClick={() => {
                  setActiveFullscreenVideo(heroVideo);
                  onPlayVideo(heroVideo);
                }}
                className="group flex items-center gap-3 px-7 py-3 rounded-xl bg-white hover:bg-gray-100 text-black font-extrabold text-sm sm:text-base transition-all shadow-xl hover:shadow-white/20 active:scale-95 select-none cursor-pointer"
              >
                <Play className="w-5 h-5 fill-black text-black transition-transform group-hover:scale-110" />
                <span>Abspielen</span>
              </button>

              {/* 2. Dezenter grauer Button ("Details / Download") mit Info-Icon */}
              <button
                onClick={() => setSelectedDetailsVideo(heroVideo)}
                className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-white/20 hover:bg-white/30 text-white backdrop-blur-md font-semibold text-sm sm:text-base border border-white/15 hover:border-white/30 transition-all active:scale-95 select-none cursor-pointer"
              >
                <Info className="w-5 h-5 text-gray-200" />
                <span>Details / Download</span>
              </button>
            </div>
          </div>
        </section>
      ) : (
        /* Empty State or Welcome State when 0 videos are detected */
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

      {/* 3. VOD-KARTEN & KARUSSELL-LOOK */}
      {filteredVideos.length > 0 && (
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 space-y-10">
          {/* Section 1: "Zuletzt hinzugefügt" (Horizontal Scrollable Carousel) */}
          <section className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4" style={{ color: '#E50914' }} />
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                  Zuletzt hinzugefügt
                </h2>
                <span className="text-xs font-semibold text-gray-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                  {filteredVideos.length}
                </span>
              </div>

              {/* Carousel navigation controls */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => scrollRow(recentRowRef, 'left')}
                  className="p-2 rounded-full bg-white/5 hover:bg-white/15 text-gray-300 hover:text-white border border-white/10 transition-all active:scale-95"
                  title="Nach links scrollen"
                  aria-label="Nach links scrollen"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => scrollRow(recentRowRef, 'right')}
                  className="p-2 rounded-full bg-white/5 hover:bg-white/15 text-gray-300 hover:text-white border border-white/10 transition-all active:scale-95"
                  title="Nach rechts scrollen"
                  aria-label="Nach rechts scrollen"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Horizontal Scroll Track (Edge-to-edge Durchlauf bis zum Bildschirmrand mit eleganten Fade-Rändern) */}
            <div className="relative -mx-4 sm:-mx-8">
              <div
                ref={recentRowRef}
                className="flex items-stretch gap-4 sm:gap-6 overflow-x-auto overflow-y-visible px-4 sm:px-8 py-4 -my-2 scrollbar-none snap-x snap-mandatory scroll-smooth"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {filteredVideos.map((video) => (
                  <div
                    key={video.path || video.name}
                    className="shrink-0 w-64 sm:w-72 md:w-80 snap-start relative hover:z-20 transition-all duration-300"
                  >
                    <VideoCard
                      video={video}
                      onPlay={() => {
                        setActiveFullscreenVideo(video);
                        onPlayVideo(video);
                      }}
                      onDetails={() => setSelectedDetailsVideo(video)}
                      onDownload={() => onDownloadVideo(video)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Section 2: "Alle Videos" (Sauberes 16:9-Widescreen-Grid) */}
          <section className="space-y-4 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Layers className="w-4 h-4" style={{ color: '#E50914' }} />
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                  Alle Videos & Filme (16:9 Grid)
                </h2>
              </div>
              <span className="text-xs text-gray-400">
                {filteredVideos.length} {filteredVideos.length === 1 ? 'Video' : 'Videos'} verfügbar
              </span>
            </div>

            {/* 16:9 Widescreen Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6 py-2">
              {filteredVideos.map((video) => (
                <div key={`grid-${video.path || video.name}`} className="relative hover:z-20 transition-all duration-300">
                  <VideoCard
                    video={video}
                    onPlay={() => {
                      setActiveFullscreenVideo(video);
                      onPlayVideo(video);
                    }}
                    onDetails={() => setSelectedDetailsVideo(video)}
                    onDownload={() => onDownloadVideo(video)}
                  />
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* 4. BRANDING & FOOTER (UNTEN RECHTS) */}
      <footer className="w-full max-w-7xl mx-auto px-4 sm:px-8 mt-16 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs select-none">
        <div className="flex items-center gap-2 text-gray-500">
          <Film className="w-4 h-4" style={{ color: '#E50914' }} />
          <span>Cinema Mode · Video on Demand Streaming Engine</span>
        </div>

        {/* REQUIRED BRANDING UNTEN RECHTS:
            Rechts unten unter dem Logo soll klein stehen: by J. Jonas Cloud
            Im Dark Mode in transparentem Hellgrau/Weiß (opacity: 0.6).
            Im Light Mode in dezentem Anthrazit (opacity: 0.6).
        */}
        <div
          className={`flex flex-col items-center justify-center font-medium tracking-tight transition-opacity ${
            darkMode
              ? 'text-gray-200'
              : 'text-[#141414] dark:text-gray-200'
          }`}
          style={{ opacity: 0.6 }}
        >
          <Cloud className="w-5 h-5 text-current mb-0.5" />
          <span className="text-[11px] leading-tight">by J. Jonas Cloud</span>
        </div>
      </footer>

      {/* 5. SEPARATER DETAILS / DOWNLOAD MODAL FÜR DAS FEATURED ODER GEWÄHLTE VIDEO */}
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
                className="p-3 rounded-xl border border-white/10"
                style={{ backgroundColor: 'rgba(229, 9, 20, 0.15)', color: '#E50914' }}
              >
                <FileVideo className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-extrabold uppercase tracking-widest block" style={{ color: '#E50914' }}>
                  Video-Details
                </span>
                <h3 className="text-lg font-bold text-white truncate" title={selectedDetailsVideo.name}>
                  {selectedDetailsVideo.name}
                </h3>
              </div>
            </div>

            <div className="space-y-2.5 my-5 text-xs text-gray-300 bg-black/40 p-4 rounded-xl border border-white/5">
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-gray-400">Dateiname:</span>
                <span className="font-mono font-medium text-white truncate max-w-xs">{selectedDetailsVideo.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-gray-400">Dateigröße:</span>
                <span className="font-medium text-white">{formatBytes(selectedDetailsVideo.size)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-gray-400">Format / Codec:</span>
                <span className="font-medium text-gray-200">{getVideoBadge(selectedDetailsVideo).ext} ({getVideoBadge(selectedDetailsVideo).quality})</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-gray-400">Pfad:</span>
                <span className="font-mono text-gray-300 truncate max-w-xs">{selectedDetailsVideo.path || selectedDetailsVideo.name}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-gray-400">Geändert:</span>
                <span className="text-white">{formatDate(selectedDetailsVideo.modified)}</span>
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
                  setActiveFullscreenVideo(vid);
                  onPlayVideo(vid);
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

      {/* 6. RANDLOSER HTML5-PLAYER IM VOLLBILD-OVERLAY MIT AUTOPLAY & SPULFUNKTION */}
      {activeFullscreenVideo && (
        <div
          className="fixed inset-0 z-50 bg-black flex flex-col justify-between animate-in fade-in duration-200"
          onClick={() => setActiveFullscreenVideo(null)}
        >
          {/* Top Floating Controls Bar */}
          <div
            className="w-full flex items-center justify-between p-4 sm:p-6 bg-gradient-to-b from-black/90 via-black/40 to-transparent z-20 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 min-w-0 pr-4">
              <button
                onClick={() => setActiveFullscreenVideo(null)}
                className="p-2 rounded-full bg-white/10 hover:bg-white/25 text-white transition-all mr-1"
                title="Zurück zum Kino-Dashboard"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div className="min-w-0">
                <span className="text-[10px] font-extrabold uppercase tracking-widest block" style={{ color: '#E50914' }}>
                  J.Jonas Cloud Cinema Player
                </span>
                <h2 className="text-sm sm:text-base font-bold text-white truncate max-w-md sm:max-w-xl">
                  {activeFullscreenVideo.name}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onDownloadVideo(activeFullscreenVideo)}
                className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                title="Herunterladen"
              >
                <Download className="w-4 h-4 text-blue-400" />
              </button>

              <button
                onClick={() => setActiveFullscreenVideo(null)}
                className="p-2.5 rounded-full bg-white/10 hover:bg-[#E50914] text-white transition-colors"
                title="Schließen (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* HTML5 Video Streaming Container */}
          <div
            className="flex-1 w-full h-full flex items-center justify-center relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <video
              key={activeFullscreenVideo.path || activeFullscreenVideo.name}
              src={getStreamUrl(activeFullscreenVideo.path || activeFullscreenVideo.name)}
              controls
              autoPlay
              playsInline
              preload="auto"
              className="w-full h-full max-h-[85vh] object-contain outline-none bg-black"
            >
              Dein Browser unterstützt diesen Videostream nicht.
            </video>
          </div>

          {/* Bottom discreet status */}
          <div
            className="p-3 text-center text-[11px] text-gray-500 bg-gradient-to-t from-black via-black/40 to-transparent z-20 flex items-center justify-between px-6"
            onClick={(e) => e.stopPropagation()}
          >
            <span>Tipp: Leertaste für Pause/Play · Pfeiltasten zum Vor- und Zurückspulen</span>
            <div
              className={`flex flex-col items-center justify-center font-medium ${
                darkMode ? 'text-gray-200' : 'text-gray-300'
              }`}
              style={{ opacity: 0.6 }}
            >
              <Cloud className="w-4 h-4 text-current mb-0.5" />
              <span className="text-[10px]">by J. Jonas Cloud</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// VOD 16:9 CARD COMPONENT (CINEMA-STYLE)
interface VideoCardProps {
  video: FileItemData;
  onPlay: () => void;
  onDetails: () => void;
  onDownload: () => void;
}

const VideoCard: React.FC<VideoCardProps> = ({ video, onPlay, onDetails, onDownload }) => {
  const streamUrl = getStreamUrl(video.path || video.name);

  return (
    <div
      onClick={onPlay}
      className="group relative flex flex-col rounded-xl overflow-hidden bg-neutral-900 border border-white/10 hover:border-white/30 transition-all duration-300 ease-out hover:scale-105 hover:z-30 hover:shadow-2xl hover:shadow-black/90 cursor-pointer select-none will-change-transform"
    >
      {/* 16:9 Thumbnail Area with Subtle Overlay */}
      <div className="relative w-full aspect-video bg-neutral-950 overflow-hidden flex items-center justify-center">
        {/* Real video preview / metadata frame */}
        <video
          src={streamUrl}
          preload="metadata"
          muted
          playsInline
          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300"
        />

        {/* Gradient Overlay to dark bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

        {/* Play Button in Center on Hover */}
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-2xl transform scale-90 group-hover:scale-110 opacity-70 group-hover:opacity-100 transition-all duration-300">
            <Play className="w-6 h-6 fill-black translate-x-0.5" />
          </div>
        </div>

        {/* Discrete bottom right Quick Download Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDownload();
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
              onDetails();
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
};
