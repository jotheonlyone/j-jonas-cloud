import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Film,
  Play,
  Info,
  Download,
  ArrowLeft,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Layers,
  Loader2,
  Calendar,
} from 'lucide-react';
import type { FileItemData, UserAccount } from '../types';
import {
  formatBytes,
  getStreamUrl,
  formatCleanTitle,
  getFileMetadata,
  listFiles,
  type VideoCategory,
} from '../services/storageApi';
import { isVideoFile } from './MediaViewerModal';
import { isTvBackEvent } from './CinemaTvView';
import { CinemaPlayerOverlay } from './CinemaPlayerOverlay';
import {
  parseVideoDescription,
  sortVideosByTagDate,
  enrichVideosWithMetadata,
  type ParsedVideoMetadata,
} from '../utils/videoMetadataParser';

interface CinemaViewProps {
  user: UserAccount;
  items: FileItemData[];
  onBackToFiles: () => void;
  onPlayVideo: (item: FileItemData) => void;
  onDownloadVideo?: (item: FileItemData) => void;
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
    metadata: {
      description: '/front /24.12.2026 Eine faszinierende Reise durch die Geheimnisse des Universums und ferne Galaxien.',
    },
  },
  {
    name: 'Neon_City_Nightfall_Cinematic.webm',
    type: 'file',
    size: 145 * 1024 * 1024,
    modified: new Date(Date.now() - 3600000 * 24).toISOString(),
    mime_type: 'video/webm',
    path: 'Videos/Neon_City_Nightfall_Cinematic.webm',
    metadata: {
      description: '/front /18.11.2026 Atemberaubende Cyberpunk-Aufnahmen einer futuristischen Metropole bei Nacht.',
    },
  },
  {
    name: 'Alpine_Glacier_Drone_Reel.mp4',
    type: 'file',
    size: 280 * 1024 * 1024,
    modified: new Date(Date.now() - 3600000 * 48).toISOString(),
    mime_type: 'video/mp4',
    path: 'Videos/Alpine_Glacier_Drone_Reel.mp4',
    metadata: {
      description: '/15.08.2026 Spektakuläre 4K-Drohnenflüge über schneebedeckte Alpengipfel und schimmernde Gletscher.',
    },
  },
  {
    name: 'Deep_Ocean_4K_Nature.mp4',
    type: 'file',
    size: 512 * 1024 * 1024,
    modified: new Date(Date.now() - 3600000 * 72).toISOString(),
    mime_type: 'video/mp4',
    path: 'Videos/Deep_Ocean_4K_Nature.mp4',
    metadata: {
      description: '/01.06.2026 Erkundung der unberührten Tiefsee und ihrer leuchtenden Meeresbewohner.',
    },
  },
];

export const CinemaView: React.FC<CinemaViewProps> = ({
  user,
  items,
  onBackToFiles,
  onPlayVideo,
  onDownloadVideo,
  darkMode,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDetailsVideo, setSelectedDetailsVideo] = useState<FileItemData | null>(null);
  const [detailsDescription, setDetailsDescription] = useState<string>('');
  const [activeFullscreenVideo, setActiveFullscreenVideo] = useState<FileItemData | null>(null);
  const [useDemoFallback, setUseDemoFallback] = useState(false);

  // Dynamic directory categories
  const [allFolderCategories, setAllFolderCategories] = useState<VideoCategory[]>([]);
  const [allUserVideos, setAllUserVideos] = useState<FileItemData[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [currentPlayingCategory, setCurrentPlayingCategory] = useState<VideoCategory | null>(null);

  // Selected Category filter for the 16:9 Grid section
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all');

  // Description Pop-up / Info Overlay
  const [descriptionOverlay, setDescriptionOverlay] = useState<{
    video: FileItemData;
    description: string;
    parsedMeta?: ParsedVideoMetadata;
    category?: VideoCategory | null;
  } | null>(null);

  // Load directory structure from server
  useEffect(() => {
    let isMounted = true;
    const scanLibrary = async () => {
      setIsLoadingCategories(true);
      try {
        const { items: rootItems } = await listFiles(user.username, '');
        if (!isMounted) return;

        const directVideos = rootItems.filter(isVideoFile);
        const folderList = rootItems.filter((i) => i.type === 'folder');

        const loadedCategories: VideoCategory[] = [];
        const mergedVideos: FileItemData[] = [...directVideos];

        for (const folder of folderList) {
          try {
            const { items: subItems } = await listFiles(user.username, folder.name);
            if (!isMounted) return;
            const subVideos = subItems.filter(isVideoFile);
            if (subVideos.length > 0) {
              loadedCategories.push({
                id: folder.name,
                title: formatCleanTitle(folder.name),
                folderPath: folder.name,
                videos: sortVideosByTagDate(subVideos),
              });
              subVideos.forEach((sv) => {
                if (!mergedVideos.some((x) => (x.path || x.name) === (sv.path || sv.name))) {
                  mergedVideos.push(sv);
                }
              });
            }
          } catch {
            // Skip folder if error
          }
        }

        const initialSorted = sortVideosByTagDate(
          mergedVideos.length > 0 ? mergedVideos : items.filter(isVideoFile)
        );

        if (isMounted) {
          setAllFolderCategories(loadedCategories);
          setAllUserVideos(initialSorted);
          setIsLoadingCategories(false);
        }

        // Asynchronously enrich with server metadata descriptions for tags (/front, /DD.MM.YYYY)
        enrichVideosWithMetadata(initialSorted, user.username)
          .then((enriched) => {
            if (!isMounted) return;
            const reSorted = sortVideosByTagDate(enriched);
            setAllUserVideos(reSorted);
            setAllFolderCategories((prevCats) =>
              prevCats.map((cat) => ({
                ...cat,
                videos: sortVideosByTagDate(
                  cat.videos.map((cv) => {
                    const match = enriched.find((e) => (e.path || e.name) === (cv.path || cv.name));
                    return match || cv;
                  })
                ),
              }))
            );
          })
          .catch(() => {});
      } catch (err) {
        if (isMounted) {
          setAllUserVideos(sortVideosByTagDate(items.filter(isVideoFile)));
          setIsLoadingCategories(false);
        }
      }
    };

    scanLibrary();

    return () => {
      isMounted = false;
    };
  }, [user.username, items]);

  // Fallback demo clips if library is empty
  const displayVideos = useMemo(() => {
    if (allUserVideos.length > 0) return sortVideosByTagDate(allUserVideos);
    if (useDemoFallback) return sortVideosByTagDate(DEMO_CINEMA_VIDEOS);
    return [];
  }, [allUserVideos, useDemoFallback]);

  // Hero Video (/front rotation & fallback):
  // Alle Videos mit /front sind Hero-Kandidaten. Bei mehreren wechseln sich diese ab.
  const [heroIndex, setHeroIndex] = useState(() => Math.floor(Math.random() * 100));

  const frontVideos = useMemo(() => {
    return displayVideos.filter((v) => parseVideoDescription(v.metadata?.description).isFront);
  }, [displayVideos]);

  // Rotation alle 12 Sekunden, wenn mehrere /front Hero-Kandidaten existieren
  useEffect(() => {
    if (frontVideos.length <= 1) return;
    const interval = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % frontVideos.length);
    }, 12000);
    return () => clearInterval(interval);
  }, [frontVideos.length]);

  const heroVideo = useMemo(() => {
    if (frontVideos.length > 0) {
      return frontVideos[heroIndex % frontVideos.length];
    }
    if (displayVideos.length > 0) return displayVideos[0];
    return null;
  }, [frontVideos, heroIndex, displayVideos]);

  // Helper: test if video matches search query (title, filename, category path, description)
  const matchesQuery = useCallback((v: FileItemData, query: string) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    const cleanTitle = formatCleanTitle(v.name).toLowerCase();
    const rawName = v.name.toLowerCase();
    const path = (v.path || '').toLowerCase();
    const desc = (v.metadata?.description || '').toLowerCase();
    return cleanTitle.includes(q) || rawName.includes(q) || path.includes(q) || desc.includes(q);
  }, []);

  // Featured rows: "Zuletzt hinzugefügt" is ALWAYS first, followed by 2 or 3 randomly selected folder categories
  const featuredRows = useMemo(() => {
    const rows: VideoCategory[] = [];
    const q = searchQuery.trim().toLowerCase();

    // Row 1: "Zuletzt hinzugefügt" chronologisch nach Tag-Datum sortiert
    const recentFiltered = sortVideosByTagDate(
      displayVideos.filter((v) => matchesQuery(v, searchQuery))
    );
    if (recentFiltered.length > 0) {
      rows.push({
        id: 'recent',
        title: 'Zuletzt hinzugefügt',
        folderPath: '',
        videos: recentFiltered,
      });
    }

    // Category rows: chronologisch sortiert nach Tag-Datum (/DD.MM.YYYY)
    if (allFolderCategories.length > 0) {
      if (q) {
        allFolderCategories.forEach((cat) => {
          const catMatches = cat.title.toLowerCase().includes(q);
          const matchingVideos = sortVideosByTagDate(
            cat.videos.filter((v) => catMatches || matchesQuery(v, searchQuery))
          );
          if (matchingVideos.length > 0) {
            rows.push({
              ...cat,
              videos: matchingVideos,
            });
          }
        });
      } else {
        const shuffled = [...allFolderCategories].sort(() => 0.5 - Math.random());
        const selectedRandom = shuffled.slice(0, 3).map((c) => ({
          ...c,
          videos: sortVideosByTagDate(c.videos),
        }));
        rows.push(...selectedRandom);
      }
    }

    return rows;
  }, [displayVideos, allFolderCategories, searchQuery, matchesQuery]);

  // Videos displayed in the 16:9 Grid section based on active category filter and search query
  const gridVideos = useMemo(() => {
    let baseList = displayVideos;

    if (activeCategoryFilter === 'recent') {
      baseList = displayVideos;
    } else if (activeCategoryFilter !== 'all') {
      const targetCategory = allFolderCategories.find((c) => c.id === activeCategoryFilter);
      if (targetCategory) {
        baseList = targetCategory.videos;
      }
    }

    if (!searchQuery.trim()) return sortVideosByTagDate(baseList);
    const filtered = baseList.filter((v) => matchesQuery(v, searchQuery));
    return sortVideosByTagDate(filtered);
  }, [displayVideos, allFolderCategories, activeCategoryFilter, searchQuery, matchesQuery]);

  // Play a video exclusively in Cinema fullscreen player (prevent double modal)
  const startPlayback = (video: FileItemData, category?: VideoCategory | null) => {
    setCurrentPlayingCategory(category || null);
    setActiveFullscreenVideo(video);
  };

  // Check description and either show Info-Overlay or start playback
  const handleSelectVideo = async (video: FileItemData, category?: VideoCategory | null) => {
    if (video.metadata?.description && video.metadata.description.trim()) {
      const parsed = parseVideoDescription(video.metadata.description);
      setDescriptionOverlay({
        video,
        description: parsed.description,
        parsedMeta: parsed,
        category,
      });
      return;
    }
    const itemPath = video.path || video.name;
    const itemOwner = video.owner || user.username;
    try {
      const meta = await getFileMetadata(itemPath, itemOwner);
      if (meta.description && meta.description.trim()) {
        const parsed = parseVideoDescription(meta.description);
        setDescriptionOverlay({
          video,
          description: parsed.description,
          parsedMeta: parsed,
          category,
        });
      } else {
        startPlayback(video, category);
      }
    } catch {
      startPlayback(video, category);
    }
  };

  // Load details description when details modal opens
  useEffect(() => {
    if (!selectedDetailsVideo) {
      setDetailsDescription('');
      return;
    }
    const immediateDesc = selectedDetailsVideo.metadata?.description || '';
    setDetailsDescription(immediateDesc);
    const itemPath = selectedDetailsVideo.path || selectedDetailsVideo.name;
    const itemOwner = selectedDetailsVideo.owner || user.username;
    getFileMetadata(itemPath, itemOwner)
      .then((meta) => {
        if (meta.description) setDetailsDescription(meta.description);
      })
      .catch(() => {});
  }, [selectedDetailsVideo, user.username]);

  // Carousel scroll handler
  const scrollRow = (elementId: string, direction: 'left' | 'right') => {
    const el = document.getElementById(elementId);
    if (!el) return;
    const scrollAmount = el.clientWidth * 0.75;
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  // Keyboard shortcut for closing modals or fullscreen player
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTvBackEvent(e)) {
        e.preventDefault();
        e.stopPropagation();
        if (descriptionOverlay) {
          setDescriptionOverlay(null);
        } else if (activeFullscreenVideo) {
          setActiveFullscreenVideo(null);
        } else if (selectedDetailsVideo) {
          setSelectedDetailsVideo(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFullscreenVideo, selectedDetailsVideo, descriptionOverlay]);

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
      {/* 1. CINEMA TOP BAR & DISCREET NAVIGATION */}
      <header className="sticky top-0 z-40 w-full flex items-center justify-between px-4 sm:px-8 py-3 bg-[#141414] border-b border-white/5 transition-all">
        {/* Left: Video on Demand in place of J.Jonas Cloud with 'by J. Jonas Cloud' directly underneath */}
        <div className="flex items-center gap-3 sm:gap-6 min-w-0">
          <button
            onClick={onBackToFiles}
            className="group flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-200 hover:text-white text-xs sm:text-sm font-semibold transition-all border border-white/10 hover:border-white/25 active:scale-95 shadow-sm"
            title="Zurück zur Cloud-Dateiansicht"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span className="hidden xs:inline">Zurück zur Ablage</span>
          </button>

          {/* Logo-Gruppe:
              - Mattes, kräftiges Rot (#E50914) in fetter serifenloser Schrift
              - Direkt unter dem Logo im Header, rechts darunter: by J.Jonas Cloud
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
            <span className="text-[10px] sm:text-[11px] font-medium text-gray-400 tracking-normal select-none self-end mt-0.5">
              by J.Jonas Cloud
            </span>
          </div>
        </div>

        {/* Right: Größeres, prominentes Suchfeld (ohne Upload-Button) */}
        <div className="flex-1 max-w-xl ml-4 sm:ml-8">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              (document.activeElement as HTMLElement)?.blur();
            }}
            className="relative"
          >
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Videos, Filme oder Kategorien suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2 text-xs sm:text-sm rounded-full bg-white/10 hover:bg-white/15 focus:bg-black/60 focus:ring-1 focus:ring-[#E50914] border border-white/10 focus:border-[#E50914] text-white placeholder-gray-400 focus:outline-none transition-all shadow-inner"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white cursor-pointer"
                title="Suche zurücksetzen"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>
        </div>
      </header>

      {/* 2. HERO BANNER: IDENTISCHER FADE & BLEND-IN MIT DER SEITE */}
      {isLoadingCategories ? (
        <div className="w-full h-[45vh] min-h-[340px] max-h-[550px] flex flex-col items-center justify-center gap-3 select-none mb-8">
          <Loader2 className="w-10 h-10 animate-spin text-[#E50914]" />
          <span className="text-xs text-gray-400 font-medium">Mediathek wird geladen...</span>
        </div>
      ) : heroVideo ? (
        <section className="relative w-full h-[55vh] min-h-[380px] max-h-[640px] flex items-end overflow-hidden mb-8 select-none">
          {/* Ambient Video / Artwork Background */}
          <div className="absolute inset-0 bg-[#0a0a0a] overflow-hidden pointer-events-none">
            {/* Live Video Preview Frame */}
            <video
              src={getStreamUrl(heroVideo.path || heroVideo.name, heroVideo.owner)}
              className="w-full h-full object-cover opacity-60"
              preload="metadata"
              muted
              playsInline
            />

            {/* Gradient Overlay to #141414 (Weicher Fade & Blend-In) */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/70 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#141414] via-[#141414]/50 to-transparent" />
          </div>

          {/* Hero Content Information */}
          <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-8 pb-10 flex flex-col justify-end">
            <div className="flex flex-wrap items-center gap-2.5 mb-2 text-xs sm:text-sm text-gray-300 font-medium select-none">
              {parseVideoDescription(heroVideo.metadata?.description).rawDateString ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#E50914] text-white shadow-md">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{parseVideoDescription(heroVideo.metadata?.description).rawDateString}</span>
                </span>
              ) : (
                <span>Hinzugefügt am {formatDate(heroVideo.modified)}</span>
              )}
              {frontVideos.length > 1 && (
                <span className="text-[11px] font-semibold text-gray-300 bg-white/10 px-2 py-0.5 rounded-full border border-white/15">
                  Highlight {(heroIndex % frontVideos.length) + 1} / {frontVideos.length}
                </span>
              )}
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
              {formatCleanTitle(heroVideo.name)}
            </h1>

            {/* Prominent Action Buttons */}
            <div className="flex flex-wrap items-center gap-3.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startPlayback(heroVideo);
                }}
                className="group flex items-center gap-3 px-7 py-3 rounded-xl bg-white hover:bg-gray-100 text-black font-extrabold text-sm sm:text-base transition-all shadow-xl hover:shadow-white/20 active:scale-95 select-none cursor-pointer"
              >
                <Play className="w-5 h-5 fill-black text-black transition-transform group-hover:scale-110" />
                <span>Abspielen</span>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectVideo(heroVideo);
                }}
                className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-white/20 hover:bg-white/30 text-white backdrop-blur-md font-semibold text-sm sm:text-base border border-white/15 hover:border-white/30 transition-all active:scale-95 select-none cursor-pointer"
              >
                <Info className="w-5 h-5 text-gray-200" />
                <span>Details / Beschreibung</span>
              </button>
            </div>
          </div>
        </section>
      ) : !isLoadingCategories && displayVideos.length === 0 ? (
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
            Lade MP4-, WEBM- oder MOV-Dateien in Ordner deiner J.Jonas Cloud hoch, um sie hier als Filmkategorien anzusehen.
          </p>

          <button
            onClick={() => setUseDemoFallback(!useDemoFallback)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-gray-200 text-sm font-semibold border border-white/10 transition-all active:scale-95 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            {useDemoFallback ? 'Demo-Videos ausblenden' : 'Demo-Trailerschau aktivieren'}
          </button>
        </div>
      ) : null}

      {/* 3. HORIZONTAL SCROLLING ROWS: "ZULETZT HINZUGEFÜGT" + 2-3 ZUFÄLLIGE ORDNERKATEGORIEN (DURCHLAUF BIS ZUM RAND) */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 space-y-10">
        {featuredRows.map((category) => {
          const rowElementId = `cinema-row-${category.id}`;
          return (
            <section key={`feat-row-${category.id}`} className="space-y-3">
              {/* Row Header (Ohne Ordner-Symbole, saubere Filmkategorie) */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg sm:text-2xl font-black tracking-tight text-white">
                    {category.title}
                  </h2>
                  <span className="text-xs font-semibold text-gray-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                    {category.videos.length}
                  </span>
                </div>

                {/* Carousel navigation controls */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => scrollRow(rowElementId, 'left')}
                    className="p-2 rounded-full bg-white/5 hover:bg-white/15 text-gray-300 hover:text-white border border-white/10 transition-all active:scale-95"
                    title="Nach links scrollen"
                    aria-label="Nach links scrollen"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => scrollRow(rowElementId, 'right')}
                    className="p-2 rounded-full bg-white/5 hover:bg-white/15 text-gray-300 hover:text-white border border-white/10 transition-all active:scale-95"
                    title="Nach rechts scrollen"
                    aria-label="Nach rechts scrollen"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Horizontal Scroll Track: Bis zum Bildschirmrand (-mx-4 sm:-mx-8 px-4 sm:px-8) ohne störende Ränder */}
              <div className="relative -mx-4 sm:-mx-8">
                <div
                  id={rowElementId}
                  className="flex items-stretch gap-4 sm:gap-6 overflow-x-auto overflow-y-visible px-4 sm:px-8 py-4 -my-2 scrollbar-none snap-x snap-mandatory scroll-smooth"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  {category.videos.map((video) => (
                    <div
                      key={`card-${category.id}-${video.path || video.name}`}
                      className="shrink-0 w-64 sm:w-72 md:w-80 snap-start relative hover:z-20 transition-all duration-300"
                    >
                      <VideoCard
                        video={video}
                        onPlay={() => handleSelectVideo(video, category)}
                        onDetails={() => setSelectedDetailsVideo(video)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </section>
          );
        })}

        {/* 4. UNTERER BEREICH: LEICHT ANKLICKBARE KATEGORIEN-LEISTE + 16:9 GRID */}
        <section className="space-y-6 pt-6 border-t border-white/10">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Layers className="w-5 h-5" style={{ color: '#E50914' }} />
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  Alle Videos & Filme
                </h2>
              </div>
              <span className="text-xs text-gray-400">
                {gridVideos.length} {gridVideos.length === 1 ? 'Film' : 'Filme'}
              </span>
            </div>

            {/* Leicht anklickbare Kategorien-Buttons: Ganz oben im Layout (z-30/z-40), ohne Clipping oder Scrollbalken */}
            <div className="relative z-30 flex flex-wrap items-center gap-3 py-3 px-1 overflow-visible">
              <button
                onClick={() => setActiveCategoryFilter('all')}
                className={`relative px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 cursor-pointer ${
                  activeCategoryFilter === 'all'
                    ? 'z-40 text-white shadow-md'
                    : 'z-20 hover:z-30 bg-white/5 hover:bg-white/15 text-gray-300 border border-white/10'
                }`}
                style={activeCategoryFilter === 'all' ? { backgroundColor: '#E50914', borderColor: '#E50914' } : {}}
              >
                Alle Filme
              </button>

              <button
                onClick={() => setActiveCategoryFilter('recent')}
                className={`relative px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 cursor-pointer ${
                  activeCategoryFilter === 'recent'
                    ? 'z-40 text-white shadow-md'
                    : 'z-20 hover:z-30 bg-white/5 hover:bg-white/15 text-gray-300 border border-white/10'
                }`}
                style={activeCategoryFilter === 'recent' ? { backgroundColor: '#E50914', borderColor: '#E50914' } : {}}
              >
                Zuletzt hinzugefügt
              </button>

              {allFolderCategories.map((cat) => (
                <button
                  key={`filter-pill-${cat.id}`}
                  onClick={() => setActiveCategoryFilter(cat.id)}
                  className={`relative px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 cursor-pointer ${
                    activeCategoryFilter === cat.id
                      ? 'z-40 text-white shadow-md'
                      : 'z-20 hover:z-30 bg-white/5 hover:bg-white/15 text-gray-300 border border-white/10'
                  }`}
                  style={activeCategoryFilter === cat.id ? { backgroundColor: '#E50914', borderColor: '#E50914' } : {}}
                >
                  {cat.title}
                </button>
              ))}
            </div>
          </div>

          {/* 16:9 Widescreen Grid */}
          {gridVideos.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm flex flex-col items-center justify-center gap-3">
              <Search className="w-8 h-8 text-gray-500 opacity-60" />
              <p className="font-semibold text-gray-300">
                {searchQuery
                  ? `Keine Videos gefunden für "${searchQuery}"`
                  : 'Keine Filme in dieser Kategorie gefunden.'}
              </p>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold cursor-pointer transition-colors"
                >
                  Suche zurücksetzen
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6 py-2">
              {gridVideos.map((video) => (
                <div
                  key={`grid-${video.path || video.name}`}
                  className="relative hover:z-20 transition-all duration-300"
                >
                  <VideoCard
                    video={video}
                    onPlay={() => {
                      const cat = allFolderCategories.find((c) =>
                        c.videos.some((v) => (v.path || v.name) === (video.path || video.name))
                      );
                      handleSelectVideo(video, cat);
                    }}
                    onDetails={() => setSelectedDetailsVideo(video)}
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* 5. BESCHREIBUNGS-POP-UP / INFO-OVERLAY (Beim Anwählen einer Filmkachel) */}
      {descriptionOverlay && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDescriptionOverlay(null);
          }}
        >
          <div
            className="relative w-full max-w-lg bg-neutral-900 border border-white/20 rounded-3xl p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/10">
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#E50914]">
                  Filmbeschreibung & Details
                </span>
                <h3 className="text-lg sm:text-xl font-bold text-white truncate mt-0.5">
                  {formatCleanTitle(descriptionOverlay.video.name)}
                </h3>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDescriptionOverlay(null);
                }}
                className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Schließen"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tag Date Badge if present */}
            {descriptionOverlay.parsedMeta?.rawDateString && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E50914]/20 border border-[#E50914]/40 text-[#ff4d58] text-xs font-bold w-fit shadow-xs">
                <Calendar className="w-3.5 h-3.5" />
                <span>Erscheinungsdatum: {descriptionOverlay.parsedMeta.rawDateString}</span>
              </div>
            )}

            {/* Description Text (Tags cleanly stripped) */}
            {descriptionOverlay.description ? (
              <div className="p-4 rounded-2xl bg-black/50 border border-white/5 text-gray-300 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
                {descriptionOverlay.description}
              </div>
            ) : null}

            {/* Meta tags */}
            <div className="flex items-center justify-between text-xs text-gray-400 pt-1">
              <span>Dateigröße: {formatBytes(descriptionOverlay.video.size)}</span>
              <span>Geändert: {formatDate(descriptionOverlay.video.modified)}</span>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDescriptionOverlay(null);
                }}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                Schließen
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const v = descriptionOverlay.video;
                  const cat = descriptionOverlay.category;
                  setDescriptionOverlay(null);
                  startPlayback(v, cat);
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-bold text-xs transition-colors shadow-lg active:scale-95 cursor-pointer"
                style={{ backgroundColor: '#E50914' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = '#B80710')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = '#E50914')}
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Film abspielen</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. DETAILS MODAL */}
      {selectedDetailsVideo && (() => {
        const detailsParsed = parseVideoDescription(detailsDescription);
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setSelectedDetailsVideo(null)}
          >
            <div
              className="relative w-full max-w-lg bg-neutral-900 border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 pb-3 border-b border-white/10">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#E50914]">
                    Filmdetails
                  </span>
                  <h3 className="text-lg sm:text-xl font-bold text-white leading-snug">
                    {formatCleanTitle(selectedDetailsVideo.name)}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedDetailsVideo(null)}
                  className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Video preview thumbnail */}
              <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-white/10">
                <video
                  src={getStreamUrl(selectedDetailsVideo.path || selectedDetailsVideo.name, selectedDetailsVideo.owner)}
                  preload="metadata"
                  controls
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Optional Description if saved (clean without tags) */}
              {detailsParsed.description && (
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 text-xs text-gray-300 leading-relaxed whitespace-pre-wrap max-h-36 overflow-y-auto">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                    Beschreibung
                  </span>
                  {detailsParsed.description}
                </div>
              )}

              <div className="space-y-1.5 text-xs text-gray-300">
                {/* Formatted Date Tag Badge */}
                {detailsParsed.rawDateString && (
                  <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                    <span className="text-gray-400 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#E50914]" />
                      <span>Erscheinungsdatum:</span>
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#E50914]/20 text-[#ff4d58] border border-[#E50914]/40">
                      {detailsParsed.rawDateString}
                    </span>
                  </div>
                )}
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-gray-500">Dateiname:</span>
                  <span className="font-mono text-gray-200 truncate max-w-[260px]">{selectedDetailsVideo.name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-gray-500">Dateigröße:</span>
                  <span className="font-semibold text-white">{formatBytes(selectedDetailsVideo.size)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-gray-500">Pfad:</span>
                  <span className="font-mono text-gray-200 truncate max-w-[260px]">
                    {selectedDetailsVideo.path || selectedDetailsVideo.name}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500">Hinzugefügt am:</span>
                  <span>{new Date(selectedDetailsVideo.modified).toLocaleString('de-DE')}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setSelectedDetailsVideo(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  Schließen
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const vid = selectedDetailsVideo;
                    setSelectedDetailsVideo(null);
                    startPlayback(vid);
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-bold text-xs transition-colors active:scale-95 cursor-pointer"
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
        );
      })()}

      {/* 7. FULLSCREEN MEDIA PLAYER MIT NEXT-VIDEO & TV-STEUERUNG */}
      {activeFullscreenVideo && (
        <CinemaPlayerOverlay
          video={activeFullscreenVideo}
          allVideos={displayVideos}
          categories={allFolderCategories}
          currentCategory={currentPlayingCategory}
          onClose={() => setActiveFullscreenVideo(null)}
          onVideoChange={(v) => setActiveFullscreenVideo(v)}
          darkMode={darkMode}
        />
      )}
    </div>
  );
};

// VOD 16:9 CARD COMPONENT
interface VideoCardProps {
  video: FileItemData;
  onPlay: () => void;
  onDetails: () => void;
}

const VideoCard: React.FC<VideoCardProps> = ({ video, onPlay, onDetails }) => {
  const streamUrl = getStreamUrl(video.path || video.name, video.owner);
  const tagMeta = parseVideoDescription(video.metadata?.description);

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onPlay();
      }}
      className="group relative flex flex-col rounded-xl overflow-hidden bg-neutral-900 border border-white/10 hover:border-white/30 transition-all duration-300 ease-out hover:scale-105 hover:z-30 hover:shadow-2xl hover:shadow-black/90 cursor-pointer select-none will-change-transform"
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

        {/* Highlight Date Tag Badge on Card Thumbnail */}
        {tagMeta.rawDateString && (
          <div className="absolute top-2 left-2 z-20 flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md border border-[#E50914]/40 text-[#ff4d58] text-[10px] font-bold shadow-md pointer-events-none">
            <Calendar className="w-2.5 h-2.5" />
            <span>{tagMeta.rawDateString}</span>
          </div>
        )}

        {/* Play Button in Center on Hover */}
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-2xl transform scale-90 group-hover:scale-110 opacity-70 group-hover:opacity-100 transition-all duration-300">
            <Play className="w-6 h-6 fill-black translate-x-0.5" />
          </div>
        </div>
      </div>

      {/* Info beneath Thumbnail: White Title & Discrete File Size */}
      <div className="p-3 bg-neutral-900/90 flex flex-col justify-between">
        <h3
          className="text-xs sm:text-sm font-semibold text-white group-hover:text-gray-200 transition-colors truncate mb-1"
          title={video.name}
        >
          {formatCleanTitle(video.name)}
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
