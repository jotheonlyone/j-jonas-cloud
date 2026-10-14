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
  Search,
  Sparkles,
  Layers,
  ChevronLeft,
  ChevronRight,
  Loader2
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
  darkMode,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDetailsVideo, setSelectedDetailsVideo] = useState<FileItemData | null>(null);
  const [detailsDescription, setDetailsDescription] = useState<string>('');
  const [activePlayerVideo, setActivePlayerVideo] = useState<FileItemData | null>(null);
  const [useDemoFallback, setUseDemoFallback] = useState(() => user.username === 'demo_gast');

  // Dynamic directory categories
  const [allFolderCategories, setAllFolderCategories] = useState<VideoCategory[]>([]);
  const [allUserVideos, setAllUserVideos] = useState<FileItemData[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);

  // Selected Category filter for the 16:9 Grid section
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all');

  // Description Pop-up / Info Overlay
  const [descriptionOverlay, setDescriptionOverlay] = useState<{
    video: FileItemData;
    description: string;
  } | null>(null);

  // Fetch dynamic categories from the account's directory structure
  useEffect(() => {
    let isMounted = true;
    const loadCategories = async () => {
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
                videos: subVideos,
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

        mergedVideos.sort(
          (a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime()
        );

        if (isMounted) {
          setAllFolderCategories(loadedCategories);
          setAllUserVideos(mergedVideos.length > 0 ? mergedVideos : items.filter(isVideoFile));
          setIsLoadingCategories(false);
        }
      } catch (err) {
        if (isMounted) {
          setAllUserVideos(items.filter(isVideoFile));
          setIsLoadingCategories(false);
        }
      }
    };

    loadCategories();

    return () => {
      isMounted = false;
    };
  }, [user.username, items]);

  // Fallback demo clips if library is empty
  const displayVideos = useMemo(() => {
    if (allUserVideos.length > 0) return allUserVideos;
    if (useDemoFallback) return DEMO_CINEMA_VIDEOS;
    return [];
  }, [allUserVideos, useDemoFallback]);

  // Hero Video (featured top video)
  const heroVideo = useMemo(() => {
    if (displayVideos.length > 0) return displayVideos[0];
    return null;
  }, [displayVideos]);

  // Featured rows: "Zuletzt hinzugefügt" is ALWAYS first, followed by 2 or 3 randomly selected folder categories
  const featuredRows = useMemo(() => {
    const rows: VideoCategory[] = [];

    // Row 1: Always "Zuletzt hinzugefügt"
    rows.push({
      id: 'recent',
      title: 'Zuletzt hinzugefügt',
      folderPath: '',
      videos: displayVideos,
    });

    // Pick 2-3 random categories from folder structures
    if (allFolderCategories.length > 0) {
      const shuffled = [...allFolderCategories].sort(() => 0.5 - Math.random());
      const selectedRandom = shuffled.slice(0, 3);
      rows.push(...selectedRandom);
    }

    return rows;
  }, [displayVideos, allFolderCategories]);

  // Category filter options for interactive pill bar
  const filterOptions = useMemo(() => {
    const opts: { id: string; label: string }[] = [
      { id: 'all', label: 'Alle Filme' },
      { id: 'recent', label: 'Zuletzt hinzugefügt' },
    ];
    allFolderCategories.forEach((cat) => {
      opts.push({ id: cat.id, label: cat.title });
    });
    return opts;
  }, [allFolderCategories]);

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

    if (!searchQuery.trim()) return baseList;
    const q = searchQuery.toLowerCase();
    return baseList.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        formatCleanTitle(v.name).toLowerCase().includes(q)
    );
  }, [displayVideos, allFolderCategories, activeCategoryFilter, searchQuery]);

  // -------------------------------------------------------------
  // D-PAD & FERNBEDIENUNGS-STEUERUNG
  // Zones: 'header' | 'hero' | 'emptyState' | 'carousels' | 'filterBar' | 'grid'
  // -------------------------------------------------------------
  type TvZone = 'header' | 'hero' | 'emptyState' | 'carousels' | 'filterBar' | 'grid';
  const [focusedZone, setFocusedZone] = useState<TvZone>(heroVideo ? 'hero' : 'header');
  const [headerFocusIndex, setHeaderFocusIndex] = useState<number>(0); // 0 = Search input, 1 = Clear (if query) / Demo button, 2 = Demo button
  const [heroIndex, setHeroIndex] = useState<number>(0);
  const [carouselRowIdx, setCarouselRowIdx] = useState<number>(0);
  const [carouselColIdx, setCarouselColIdx] = useState<number>(0);
  const [filterBarIdx, setFilterBarIdx] = useState<number>(0);
  const [gridIdx, setGridIdx] = useState<number>(0);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchClearBtnRef = useRef<HTMLButtonElement>(null);
  const headerDemoBtnRef = useRef<HTMLButtonElement>(null);
  const emptyStateBtnRef = useRef<HTMLButtonElement>(null);
  const heroPlayBtnRef = useRef<HTMLButtonElement>(null);
  const heroInfoBtnRef = useRef<HTMLButtonElement>(null);
  const carouselItemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const filterPillRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const gridItemRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Calculate dynamic grid columns for vertical navigation
  const getGridCols = (): number => {
    if (typeof window === 'undefined') return 3;
    const w = window.innerWidth;
    if (w >= 1280) return 4;
    if (w >= 1024) return 3;
    if (w >= 640) return 2;
    return 1;
  };

  // Scroll focused element into view smoothly
  useEffect(() => {
    if (activePlayerVideo || selectedDetailsVideo || descriptionOverlay) return;

    if (focusedZone === 'header') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (headerFocusIndex === 0) {
        searchInputRef.current?.focus();
      } else {
        searchInputRef.current?.blur();
      }
    } else if (focusedZone === 'emptyState') {
      emptyStateBtnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (focusedZone === 'hero') {
      if (heroIndex === 0)
        heroPlayBtnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      else
        heroInfoBtnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else if (focusedZone === 'carousels') {
      const key = `${carouselRowIdx}-${carouselColIdx}`;
      const el = carouselItemRefs.current.get(key);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    } else if (focusedZone === 'filterBar') {
      const btn = filterPillRefs.current.get(filterBarIdx);
      if (btn) {
        btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    } else if (focusedZone === 'grid') {
      const el = gridItemRefs.current.get(gridIdx);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [
    focusedZone,
    heroIndex,
    carouselRowIdx,
    carouselColIdx,
    filterBarIdx,
    gridIdx,
    activePlayerVideo,
    selectedDetailsVideo,
    descriptionOverlay,
  ]);

  // Play a video
  const startPlayback = (video: FileItemData) => {
    setActivePlayerVideo(video);
    onPlayVideo(video);
  };

  // Check description and either show Info-Overlay or start playback
  const handleSelectVideo = async (video: FileItemData) => {
    const itemPath = video.path || video.name;
    try {
      const meta = await getFileMetadata(itemPath);
      if (meta.description && meta.description.trim()) {
        setDescriptionOverlay({
          video,
          description: meta.description.trim(),
        });
      } else {
        startPlayback(video);
      }
    } catch {
      startPlayback(video);
    }
  };

  // Load details description when details modal opens
  useEffect(() => {
    if (!selectedDetailsVideo) {
      setDetailsDescription('');
      return;
    }
    const itemPath = selectedDetailsVideo.path || selectedDetailsVideo.name;
    getFileMetadata(itemPath)
      .then((meta) => setDetailsDescription(meta.description || ''))
      .catch(() => setDetailsDescription(''));
  }, [selectedDetailsVideo]);

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

  // Handle D-Pad Keyboard Navigation
  useEffect(() => {
    const handleTvDpad = (e: KeyboardEvent) => {
      if (descriptionOverlay) {
        if (e.key === 'Enter') {
          e.preventDefault();
          const vid = descriptionOverlay.video;
          setDescriptionOverlay(null);
          startPlayback(vid);
        } else if (e.key === 'Escape' || e.key === 'Backspace') {
          e.preventDefault();
          setDescriptionOverlay(null);
        }
        return;
      }

      if (selectedDetailsVideo) {
        if (e.key === 'Enter') {
          e.preventDefault();
          const vid = selectedDetailsVideo;
          setSelectedDetailsVideo(null);
          startPlayback(vid);
        } else if (e.key === 'Escape' || e.key === 'Backspace') {
          e.preventDefault();
          setSelectedDetailsVideo(null);
        }
        return;
      }

      if (activePlayerVideo) return;

      const cols = getGridCols();
      const maxHeaderIdx = searchQuery ? 2 : 1;

      switch (e.key) {
        case 'ArrowUp': {
          e.preventDefault();
          if (focusedZone === 'grid') {
            if (gridIdx < cols) {
              setFocusedZone('filterBar');
            } else {
              setGridIdx((prev) => Math.max(0, prev - cols));
            }
          } else if (focusedZone === 'filterBar') {
            if (featuredRows.length > 0) {
              setFocusedZone('carousels');
              setCarouselRowIdx(featuredRows.length - 1);
              setCarouselColIdx(0);
            } else if (heroVideo) {
              setFocusedZone('hero');
              setHeroIndex(0);
            } else {
              setFocusedZone('header');
              setHeaderFocusIndex(0);
            }
          } else if (focusedZone === 'carousels') {
            if (carouselRowIdx > 0) {
              const nextRow = carouselRowIdx - 1;
              const maxCol = (featuredRows[nextRow]?.videos.length || 1) - 1;
              setCarouselRowIdx(nextRow);
              setCarouselColIdx((prev) => Math.min(prev, maxCol));
            } else {
              if (heroVideo) {
                setFocusedZone('hero');
                setHeroIndex(0);
              } else {
                setFocusedZone('header');
                setHeaderFocusIndex(0);
              }
            }
          } else if (focusedZone === 'hero') {
            setFocusedZone('header');
            setHeaderFocusIndex(0);
          } else if (focusedZone === 'emptyState') {
            setFocusedZone('header');
            setHeaderFocusIndex(0);
          }
          break;
        }

        case 'ArrowDown': {
          e.preventDefault();
          if (focusedZone === 'header') {
            searchInputRef.current?.blur();
            if (heroVideo) {
              setFocusedZone('hero');
              setHeroIndex(0);
            } else if (displayVideos.length === 0) {
              setFocusedZone('emptyState');
            } else if (featuredRows.length > 0) {
              setFocusedZone('carousels');
              setCarouselRowIdx(0);
              setCarouselColIdx(0);
            } else {
              setFocusedZone('filterBar');
              setFilterBarIdx(0);
            }
          } else if (focusedZone === 'hero') {
            if (featuredRows.length > 0) {
              setFocusedZone('carousels');
              setCarouselRowIdx(0);
              setCarouselColIdx(0);
            } else {
              setFocusedZone('filterBar');
            }
          } else if (focusedZone === 'carousels') {
            if (carouselRowIdx < featuredRows.length - 1) {
              const nextRow = carouselRowIdx + 1;
              const maxCol = (featuredRows[nextRow]?.videos.length || 1) - 1;
              setCarouselRowIdx(nextRow);
              setCarouselColIdx((prev) => Math.min(prev, maxCol));
            } else {
              setFocusedZone('filterBar');
            }
          } else if (focusedZone === 'filterBar') {
            if (gridVideos.length > 0) {
              setFocusedZone('grid');
              setGridIdx(0);
            }
          } else if (focusedZone === 'grid') {
            if (gridIdx + cols < gridVideos.length) {
              setGridIdx((prev) => prev + cols);
            }
          }
          break;
        }

        case 'ArrowLeft': {
          e.preventDefault();
          if (focusedZone === 'header') {
            setHeaderFocusIndex((prev) => {
              const next = Math.max(0, prev - 1);
              if (next === 0) searchInputRef.current?.focus();
              return next;
            });
          } else if (focusedZone === 'hero') {
            setHeroIndex(0);
          } else if (focusedZone === 'carousels') {
            setCarouselColIdx((prev) => Math.max(0, prev - 1));
          } else if (focusedZone === 'filterBar') {
            setFilterBarIdx((prev) => Math.max(0, prev - 1));
          } else if (focusedZone === 'grid') {
            setGridIdx((prev) => Math.max(0, prev - 1));
          }
          break;
        }

        case 'ArrowRight': {
          e.preventDefault();
          if (focusedZone === 'header') {
            searchInputRef.current?.blur();
            setHeaderFocusIndex((prev) => Math.min(maxHeaderIdx, prev + 1));
          } else if (focusedZone === 'hero') {
            setHeroIndex(1);
          } else if (focusedZone === 'carousels') {
            const currentCatVideos = featuredRows[carouselRowIdx]?.videos || [];
            setCarouselColIdx((prev) => Math.min(currentCatVideos.length - 1, prev + 1));
          } else if (focusedZone === 'filterBar') {
            setFilterBarIdx((prev) => Math.min(filterOptions.length - 1, prev + 1));
          } else if (focusedZone === 'grid') {
            setGridIdx((prev) => Math.min(gridVideos.length - 1, prev + 1));
          }
          break;
        }

        case 'Enter': {
          e.preventDefault();
          if (focusedZone === 'header') {
            if (headerFocusIndex === 0) {
              searchInputRef.current?.focus();
            } else if (searchQuery && headerFocusIndex === 1) {
              setSearchQuery('');
              setHeaderFocusIndex(0);
              searchInputRef.current?.focus();
            } else {
              setUseDemoFallback((prev) => !prev);
            }
          } else if (focusedZone === 'emptyState') {
            setUseDemoFallback((prev) => !prev);
          } else if (focusedZone === 'hero' && heroVideo) {
            if (heroIndex === 0) startPlayback(heroVideo);
            else handleSelectVideo(heroVideo);
          } else if (focusedZone === 'carousels') {
            const curCat = featuredRows[carouselRowIdx];
            if (curCat && curCat.videos[carouselColIdx]) {
              handleSelectVideo(curCat.videos[carouselColIdx]);
            }
          } else if (focusedZone === 'filterBar') {
            const chosen = filterOptions[filterBarIdx];
            if (chosen) {
              setActiveCategoryFilter(chosen.id);
            }
          } else if (focusedZone === 'grid') {
            const vid = gridVideos[gridIdx];
            if (vid) {
              handleSelectVideo(vid);
            }
          }
          break;
        }

        case 'Escape':
        case 'Backspace': {
          if (focusedZone !== 'header') {
            e.preventDefault();
            setFocusedZone('header');
            setHeaderFocusIndex(0);
          }
          break;
        }
      }
    };

    window.addEventListener('keydown', handleTvDpad);
    return () => window.removeEventListener('keydown', handleTvDpad);
  }, [
    focusedZone,
    headerFocusIndex,
    heroIndex,
    carouselRowIdx,
    carouselColIdx,
    filterBarIdx,
    gridIdx,
    heroVideo,
    featuredRows,
    filterOptions,
    gridVideos,
    activePlayerVideo,
    selectedDetailsVideo,
    descriptionOverlay,
    displayVideos,
    searchQuery,
    useDemoFallback,
  ]);

  return (
    <div className="relative w-full min-h-screen bg-[#141414] text-white flex flex-col font-sans selection:bg-[#E50914] selection:text-white pb-16 overflow-x-hidden">
      {/* 1. TOP HEADER (1:1 mit Cinema abgestimmt, ohne Zurück-Knopf im TV-Modus) */}
      <header className="sticky top-0 z-40 w-full flex items-center justify-between px-4 sm:px-8 py-3 bg-[#141414] border-b border-white/5 transition-all">
        {/* Left: Branding */}
        <div className="flex items-center gap-3 sm:gap-6 min-w-0">
          {/* Clean Red Logo: Mattes Kräftiges Rot (#E50914) */}
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

        {/* Right: Controls mit Suchleiste & Demo-Modus Button */}
        <div className="flex items-center gap-3 flex-1 max-w-2xl ml-4 sm:ml-8 justify-end">
          {/* Suchleiste */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Videos, Filme oder Kategorien suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                setFocusedZone('header');
                setHeaderFocusIndex(0);
              }}
              className={`w-full pl-10 pr-9 py-2 text-xs sm:text-sm rounded-full bg-white/10 text-white placeholder-gray-400 focus:outline-none transition-all shadow-inner ${
                focusedZone === 'header' && headerFocusIndex === 0
                  ? 'border-[#E50914] ring-2 ring-[#E50914] bg-black/70'
                  : 'border border-white/10 hover:bg-white/15'
              }`}
            />
            {searchQuery && (
              <button
                ref={searchClearBtnRef}
                onClick={() => setSearchQuery('')}
                onMouseEnter={() => {
                  setFocusedZone('header');
                  setHeaderFocusIndex(1);
                }}
                className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-white transition-all cursor-pointer ${
                  focusedZone === 'header' && headerFocusIndex === 1
                    ? 'ring-2 ring-white text-white bg-white/20'
                    : ''
                }`}
                title="Suche zurücksetzen"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Demo-Modus Schnellknopf im Header */}
          <button
            ref={headerDemoBtnRef}
            onClick={() => setUseDemoFallback(!useDemoFallback)}
            onMouseEnter={() => {
              setFocusedZone('header');
              setHeaderFocusIndex(searchQuery ? 2 : 1);
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all select-none cursor-pointer outline-none shrink-0 ${
              focusedZone === 'header' && headerFocusIndex === (searchQuery ? 2 : 1)
                ? 'bg-white text-black ring-4 ring-white scale-105 shadow-xl font-bold'
                : useDemoFallback
                ? 'bg-[#E50914]/25 text-[#E50914] border border-[#E50914]/50'
                : 'text-gray-300 hover:text-white bg-white/10 hover:bg-white/20 border border-white/10'
            }`}
            title="Demo-Videos umschalten"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">
              {useDemoFallback ? 'Demo-Videos aktiv' : 'Demo-Modus'}
            </span>
          </button>
        </div>
      </header>

      {/* 2. HERO FEATURED BANNER (IDENTISCHER FADE & BLEND-IN MIT /CINEMA) */}
      {heroVideo ? (
        <section className="relative w-full h-[55vh] min-h-[380px] max-h-[640px] flex items-end overflow-hidden mb-8 select-none">
          {/* Ambient Video Background */}
          <div className="absolute inset-0 bg-[#0a0a0a] overflow-hidden pointer-events-none">
            <video
              src={getStreamUrl(heroVideo.path || heroVideo.name, heroVideo.owner)}
              className="w-full h-full object-cover opacity-60"
              preload="metadata"
              muted
              playsInline
            />

            {/* Gradient Overlay to #141414 (Identischer weicher Fade & Blend-In) */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/70 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#141414] via-[#141414]/50 to-transparent" />
          </div>

          {/* Hero Content Information */}
          <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-8 pb-10 flex flex-col justify-end">
            <div className="flex items-center gap-2 mb-2 text-xs sm:text-sm text-gray-300 font-medium select-none">
              <span>Hinzugefügt am {new Date(heroVideo.modified).toLocaleDateString('de-DE')}</span>
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
                onClick={() => handleSelectVideo(heroVideo)}
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
                <span>Details / Beschreibung</span>
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
            Lade MP4-, WEBM- oder MOV-Dateien in Ordner deiner J.Jonas Cloud hoch, um sie hier anzusehen.
          </p>

          <button
            ref={emptyStateBtnRef}
            onClick={() => setUseDemoFallback(!useDemoFallback)}
            onMouseEnter={() => setFocusedZone('emptyState')}
            className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold border transition-all active:scale-95 outline-none cursor-pointer ${
              focusedZone === 'emptyState'
                ? 'bg-white text-black ring-4 ring-white scale-105 shadow-2xl border-white'
                : 'bg-white/10 hover:bg-white/20 text-gray-200 border-white/10'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            {useDemoFallback ? 'Demo-Videos ausblenden' : 'Demo-Trailerschau aktivieren'}
          </button>
        </div>
      )}

      {/* 3. HORIZONTAL SCROLLING ROWS: "ZULETZT HINZUGEFÜGT" + 2-3 ZUFÄLLIGE ORDNERKATEGORIEN (DURCHLAUF BIS ZUM RAND) */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 space-y-10">
        {featuredRows.map((category, rowIdx) => {
          const rowElementId = `tv-row-${category.id}`;
          return (
            <section key={`tv-feat-row-${category.id}`} className="space-y-3">
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

                {/* Carousel controls */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => scrollRow(rowElementId, 'left')}
                    className="p-2 rounded-full bg-white/5 hover:bg-white/15 text-gray-300 hover:text-white border border-white/10 transition-all active:scale-95"
                    title="Nach links scrollen"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => scrollRow(rowElementId, 'right')}
                    className="p-2 rounded-full bg-white/5 hover:bg-white/15 text-gray-300 hover:text-white border border-white/10 transition-all active:scale-95"
                    title="Nach rechts scrollen"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Horizontal Scroll Track (Bis zum Bildschirmrand: -mx-4 sm:-mx-8 px-4 sm:px-8) */}
              <div className="relative -mx-4 sm:-mx-8">
                <div
                  id={rowElementId}
                  className="flex items-stretch gap-4 sm:gap-6 overflow-x-auto overflow-y-visible px-4 sm:px-8 py-4 -my-2 scrollbar-none snap-x snap-mandatory scroll-smooth"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  {category.videos.map((video, colIdx) => {
                    const isFocused =
                      focusedZone === 'carousels' &&
                      carouselRowIdx === rowIdx &&
                      carouselColIdx === colIdx;
                    const streamUrl = getStreamUrl(video.path || video.name, video.owner);
                    const cleanTitle = formatCleanTitle(video.name);

                    return (
                      <div
                        key={`tv-card-${category.id}-${video.path || video.name}-${colIdx}`}
                        ref={(el) => {
                          const key = `${rowIdx}-${colIdx}`;
                          if (el) carouselItemRefs.current.set(key, el);
                          else carouselItemRefs.current.delete(key);
                        }}
                        onClick={() => {
                          setFocusedZone('carousels');
                          setCarouselRowIdx(rowIdx);
                          setCarouselColIdx(colIdx);
                          handleSelectVideo(video);
                        }}
                        onMouseEnter={() => {
                          setFocusedZone('carousels');
                          setCarouselRowIdx(rowIdx);
                          setCarouselColIdx(colIdx);
                        }}
                        className={`group relative flex-none w-64 sm:w-72 md:w-80 rounded-xl overflow-hidden bg-neutral-900 border transition-all duration-300 ease-out cursor-pointer select-none outline-none snap-start will-change-transform ${
                          isFocused
                            ? 'border-white ring-4 ring-white scale-105 z-30 shadow-2xl shadow-black/90'
                            : 'border-white/10 hover:border-white/30 hover:scale-105 hover:z-20 hover:shadow-2xl hover:shadow-black/90'
                        }`}
                      >
                        {/* 16:9 Thumbnail Area */}
                        <div className="relative w-full aspect-video bg-neutral-950 overflow-hidden flex items-center justify-center">
                          <video
                            src={streamUrl}
                            preload="metadata"
                            muted
                            playsInline
                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300"
                          />

                          {/* Gradient Overlay to dark bottom */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none" />

                          {/* Play Button in Center on Hover / Focus */}
                          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                            <div
                              className={`w-11 h-11 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 ${
                                isFocused
                                  ? 'bg-white text-black scale-110 opacity-100'
                                  : 'bg-white text-black scale-90 group-hover:scale-110 opacity-70 group-hover:opacity-100'
                              }`}
                            >
                              <Play className="w-5 h-5 fill-black translate-x-0.5" />
                            </div>
                          </div>

                          {/* Quick Download Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDownloadVideo(video);
                            }}
                            className="absolute bottom-2.5 right-2.5 p-2 rounded-full bg-black/70 hover:bg-[#E50914] text-white/80 hover:text-white backdrop-blur-sm border border-white/15 opacity-0 group-hover:opacity-100 transition-all duration-200 z-20 hover:scale-110"
                            title="Video herunterladen"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Title & metadata */}
                        <div className="p-3 bg-neutral-900/95 flex flex-col justify-between">
                          <h3
                            className="text-xs sm:text-sm font-semibold text-white group-hover:text-gray-200 transition-colors truncate mb-1"
                            title={cleanTitle}
                          >
                            {cleanTitle}
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
            </section>
          );
        })}

        {/* 4. UNTERER BEREICH: LEICHT ANKLICKBARE KATEGORIEN-LEISTE FÜR FERNSEHER + 16:9 GRID */}
        <section className="relative z-30 space-y-6 pt-6 border-t border-white/10">
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

            {/* Leicht anklickbare / per Fernbedienung steuerbare Kategorien-Leiste: Ganz oben im Layout (z-40/z-50), ohne Clipping, ohne Balken-Überlappung */}
            <div className="relative z-40 flex flex-wrap items-center gap-3 py-3 px-1 overflow-visible">
              {filterOptions.map((opt, pillIdx) => {
                const isFocused = focusedZone === 'filterBar' && filterBarIdx === pillIdx;
                const isSelected = activeCategoryFilter === opt.id;

                return (
                  <button
                    key={`tv-pill-${opt.id}`}
                    ref={(el) => {
                      if (el) filterPillRefs.current.set(pillIdx, el);
                      else filterPillRefs.current.delete(pillIdx);
                    }}
                    onClick={() => {
                      setFocusedZone('filterBar');
                      setFilterBarIdx(pillIdx);
                      setActiveCategoryFilter(opt.id);
                    }}
                    onMouseEnter={() => {
                      setFocusedZone('filterBar');
                      setFilterBarIdx(pillIdx);
                    }}
                    className={`relative px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 shrink-0 cursor-pointer outline-none select-none ${
                      isFocused
                        ? 'z-50 ring-4 ring-white scale-105 shadow-2xl shadow-black/80'
                        : isSelected
                        ? 'z-30 text-white shadow-lg'
                        : 'z-20 hover:z-30 text-gray-200 bg-white/10 hover:bg-white/20 border border-white/15 hover:border-white/30'
                    }`}
                    style={isSelected ? { backgroundColor: '#E50914', borderColor: '#E50914' } : {}}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 16:9 Widescreen Grid (Fernbedienungs-optimiert) */}
          {gridVideos.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              Keine Filme in dieser Kategorie gefunden.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6 py-2">
              {gridVideos.map((video, idx) => {
                const isFocused = focusedZone === 'grid' && gridIdx === idx;
                const streamUrl = getStreamUrl(video.path || video.name, video.owner);
                const cleanTitle = formatCleanTitle(video.name);

                return (
                  <div
                    key={`tv-grid-${video.path || video.name}-${idx}`}
                    ref={(el) => {
                      if (el) gridItemRefs.current.set(idx, el);
                      else gridItemRefs.current.delete(idx);
                    }}
                    onClick={() => {
                      setFocusedZone('grid');
                      setGridIdx(idx);
                      handleSelectVideo(video);
                    }}
                    onMouseEnter={() => {
                      setFocusedZone('grid');
                      setGridIdx(idx);
                    }}
                    className={`group relative flex flex-col rounded-xl overflow-hidden bg-neutral-900 border transition-all duration-300 ease-out cursor-pointer select-none outline-none will-change-transform ${
                      isFocused
                        ? 'border-white ring-4 ring-white scale-105 z-30 shadow-2xl shadow-black/90'
                        : 'border-white/10 hover:border-white/30 hover:scale-105 hover:z-20 hover:shadow-2xl hover:shadow-black/90'
                    }`}
                  >
                    {/* 16:9 Thumbnail Area */}
                    <div className="relative w-full aspect-video bg-neutral-950 overflow-hidden flex items-center justify-center">
                      <video
                        src={streamUrl}
                        preload="metadata"
                        muted
                        playsInline
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300"
                      />

                      {/* Gradient Overlay to dark bottom */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none" />

                      {/* Play Button in Center on Hover / Focus */}
                      <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                        <div
                          className={`w-11 h-11 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 ${
                            isFocused
                              ? 'bg-white text-black scale-110 opacity-100'
                              : 'bg-white text-black scale-90 group-hover:scale-110 opacity-70 group-hover:opacity-100'
                          }`}
                        >
                          <Play className="w-5 h-5 fill-black translate-x-0.5" />
                        </div>
                      </div>

                      {/* Quick Download Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDownloadVideo(video);
                        }}
                        className="absolute bottom-2.5 right-2.5 p-2 rounded-full bg-black/70 hover:bg-[#E50914] text-white/80 hover:text-white backdrop-blur-sm border border-white/15 opacity-0 group-hover:opacity-100 transition-all duration-200 z-20 hover:scale-110"
                        title="Video herunterladen"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Title & metadata */}
                    <div className="p-3 bg-neutral-900/95 flex flex-col justify-between">
                      <h3
                        className="text-xs sm:text-sm font-semibold text-white group-hover:text-gray-200 transition-colors truncate mb-1"
                        title={cleanTitle}
                      >
                        {cleanTitle}
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
          )}
        </section>
      </div>

      {/* 5. BESCHREIBUNGS-POP-UP / INFO-OVERLAY */}
      {descriptionOverlay && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150"
          onClick={() => setDescriptionOverlay(null)}
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
                onClick={() => setDescriptionOverlay(null)}
                className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Description Text */}
            <div className="p-4 rounded-2xl bg-black/50 border border-white/5 text-gray-300 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
              {descriptionOverlay.description}
            </div>

            {/* Meta tags */}
            <div className="flex items-center justify-between text-xs text-gray-400 pt-1">
              <span>Dateigröße: {formatBytes(descriptionOverlay.video.size)}</span>
              <span>Geändert: {new Date(descriptionOverlay.video.modified).toLocaleDateString('de-DE')}</span>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                onClick={() => setDescriptionOverlay(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                Schließen
              </button>
              <button
                onClick={() => {
                  const v = descriptionOverlay.video;
                  setDescriptionOverlay(null);
                  startPlayback(v);
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-bold text-xs transition-colors shadow-lg active:scale-95"
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
      {selectedDetailsVideo && (
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

            {/* Optional Description if saved */}
            {detailsDescription && (
              <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 text-xs text-gray-300 leading-relaxed whitespace-pre-wrap max-h-36 overflow-y-auto">
                <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                  Beschreibung
                </span>
                {detailsDescription}
              </div>
            )}

            <div className="space-y-1.5 text-xs text-gray-300">
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
                onClick={() => {
                  onDownloadVideo(selectedDetailsVideo);
                  setSelectedDetailsVideo(null);
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Herunterladen
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

      {/* 7. FERNBEDIENUNGS-OPTIMIERTER VOLLBILD MEDIA-PLAYER */}
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
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
    resetOsdTimer();
  }, [resetOsdTimer]);

  // Fernbedienungs-Tastensteuerung im Player
  useEffect(() => {
    const handlePlayerKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case ' ':
        case 'Enter':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skipTime(-10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          skipTime(10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          changeVolume(0.05);
          break;
        case 'ArrowDown':
          e.preventDefault();
          changeVolume(-0.05);
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          toggleMute();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'Escape':
        case 'Backspace':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handlePlayerKeyDown);
    return () => window.removeEventListener('keydown', handlePlayerKeyDown);
  }, [togglePlayPause, skipTime, changeVolume, toggleMute, toggleFullscreen, onClose]);

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
  const streamUrl = getStreamUrl(video.path || video.name, video.owner);

  return (
    <div
      ref={containerRef}
      onMouseMove={resetOsdTimer}
      onClick={resetOsdTimer}
      className="fixed inset-0 z-50 bg-black flex items-center justify-center select-none overflow-hidden"
    >
      <video
        ref={videoRef}
        src={streamUrl}
        autoPlay
        playsInline
        onTimeUpdate={() => {
          if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
        }}
        onLoadedMetadata={() => {
          if (videoRef.current) setDuration(videoRef.current.duration);
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onClick={togglePlayPause}
        className="w-full h-full object-contain cursor-pointer"
      />

      {/* HUD Quick Notification Pill */}
      {hudFeedback && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 px-6 py-3 rounded-2xl bg-black/85 text-white font-bold text-lg sm:text-xl border border-white/20 shadow-2xl backdrop-blur-md pointer-events-none animate-in fade-in zoom-in-95 duration-100">
          {hudFeedback}
        </div>
      )}

      {/* Top Bar OSD */}
      <div
        className={`absolute top-0 inset-x-0 z-30 p-4 sm:p-6 bg-gradient-to-b from-black/90 via-black/50 to-transparent flex items-center justify-between transition-opacity duration-300 ${
          showOsd ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 sm:p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Wiedergabe schließen (Esc)"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">
              {formatCleanTitle(video.name)}
            </h2>
            <p className="text-[11px] text-gray-400">
              {formatBytes(video.size)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onDownload}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Herunterladen"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Schließen"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Bottom Controls Bar OSD */}
      <div
        className={`absolute bottom-0 inset-x-0 z-30 p-4 sm:p-8 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex flex-col gap-3 transition-opacity duration-300 ${
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

        {/* Playback Controls Row */}
        <div className="flex items-center justify-between text-white pt-1">
          <div className="flex items-center gap-4 sm:gap-6">
            <button
              onClick={togglePlayPause}
              className="p-2.5 rounded-full hover:bg-white/15 text-white transition-transform active:scale-95"
            >
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 fill-white" />}
            </button>

            <button
              onClick={() => skipTime(-10)}
              className="p-2 rounded-full hover:bg-white/15 text-gray-300 hover:text-white transition-colors"
              title="-10 Sekunden"
            >
              <RotateCcw className="w-5 h-5" />
            </button>

            <button
              onClick={() => skipTime(10)}
              className="p-2 rounded-full hover:bg-white/15 text-gray-300 hover:text-white transition-colors"
              title="+10 Sekunden"
            >
              <RotateCw className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleMute}
                className="p-2 rounded-full hover:bg-white/15 text-gray-300 hover:text-white transition-colors"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setVolume(val);
                  if (videoRef.current) {
                    videoRef.current.volume = val;
                    videoRef.current.muted = val === 0;
                  }
                  setIsMuted(val === 0);
                }}
                className="w-16 sm:w-24 accent-[#E50914] cursor-pointer"
              />
            </div>

            <span className="text-xs sm:text-sm font-mono text-gray-300">
              {formatPlayerTime(currentTime)} / {formatPlayerTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-full hover:bg-white/15 text-gray-300 hover:text-white transition-colors"
              title="Vollbild umschalten (F)"
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
