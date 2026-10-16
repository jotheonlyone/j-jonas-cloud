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
import { CinemaPlayerOverlay } from './CinemaPlayerOverlay';

/**
 * Detects whether a keydown event corresponds to the Back / Return button
 * on Android TV remotes, Smart TV web browsers, or desktop keyboards:
 * - e.key === "Escape"
 * - e.key === "Backspace"
 * - e.key === "GoBack" (Android KeyCode 4)
 * - e.key === "BrowserBack"
 * - e.keyCode === 4
 */
export const isTvBackEvent = (e: KeyboardEvent): boolean => {
  const key = e.key;
  const code = e.keyCode || e.which;
  return (
    key === 'Escape' ||
    key === 'Backspace' ||
    key === 'GoBack' ||
    key === 'BrowserBack' ||
    key === 'Back' ||
    key === 'Exit' ||
    key === 'Cancel' ||
    code === 4 ||     // Android KeyEvent.KEYCODE_BACK (Android TV KeyCode 4)
    code === 27 ||    // Escape
    code === 8 ||     // Backspace
    code === 10009 || // Tizen Return
    code === 461 ||   // LG webOS Back
    code === 166      // BrowserBack
  );
};

interface CinemaTvViewProps {
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

interface TvCardItemProps {
  video: FileItemData;
  category?: VideoCategory | null;
  isFocused: boolean;
  onSelect: (video: FileItemData, category?: VideoCategory | null) => void;
  onDetails: (video: FileItemData) => void;
  onHover?: () => void;
  itemRef?: (el: HTMLDivElement | null) => void;
  className?: string;
}

const TvCardItem = React.memo<TvCardItemProps>(
  ({
    video,
    category,
    isFocused,
    onSelect,
    onDetails,
    onHover,
    itemRef,
    className = '',
  }) => {
    const streamUrl = getStreamUrl(video.path || video.name, video.owner);
    const cleanTitle = formatCleanTitle(video.name);

    return (
      <div
        ref={itemRef}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(video, category);
        }}
        onMouseEnter={onHover}
        data-focused={isFocused ? 'true' : undefined}
        className={`group relative flex flex-col rounded-xl overflow-hidden bg-neutral-900 border transition-transform duration-100 ease-out cursor-pointer select-none outline-none will-change-transform ${
          isFocused
            ? 'border-white ring-4 ring-white scale-105 z-30 shadow-2xl shadow-black/90'
            : 'border-white/10 hover:border-white/30 hover:scale-105 hover:z-20 hover:shadow-2xl hover:shadow-black/90'
        } ${className}`}
      >
        {/* 16:9 Thumbnail Area */}
        <div className="relative w-full aspect-video bg-neutral-950 overflow-hidden flex items-center justify-center">
          <video
            src={streamUrl}
            preload="metadata"
            muted
            playsInline
            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-150"
          />

          {/* Gradient Overlay to dark bottom */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none" />

          {/* Play Button in Center on Hover / Focus */}
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div
              className={`w-11 h-11 rounded-full flex items-center justify-center shadow-2xl transition-transform duration-100 ${
                isFocused
                  ? 'bg-white text-black scale-110 opacity-100'
                  : 'bg-white text-black scale-90 group-hover:scale-110 opacity-70 group-hover:opacity-100'
              }`}
            >
              <Play className="w-5 h-5 fill-black translate-x-0.5" />
            </div>
          </div>
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
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDetails(video);
              }}
              className="text-gray-400 hover:text-white flex items-center gap-1 transition-colors hover:underline cursor-pointer"
            >
              <Info className="w-3 h-3" />
              <span>Info</span>
            </button>
          </div>
        </div>
      </div>
    );
  },
  (prev, next) => {
    return (
      prev.isFocused === next.isFocused &&
      (prev.video.path || prev.video.name) === (next.video.path || next.video.name) &&
      prev.category?.id === next.category?.id
    );
  }
);
TvCardItem.displayName = 'TvCardItem';

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
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [currentPlayingCategory, setCurrentPlayingCategory] = useState<VideoCategory | null>(null);
  const [overlayBtnIdx, setOverlayBtnIdx] = useState<number>(1);

  // Selected Category filter for the 16:9 Grid section
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all');

  // Description Pop-up / Info Overlay
  const [descriptionOverlay, setDescriptionOverlay] = useState<{
    video: FileItemData;
    description: string;
    category?: VideoCategory | null;
  } | null>(null);

  // Reload & Refresh trigger
  const [reloadTrigger, setReloadTrigger] = useState<number>(0);
  const [isReloading, setIsReloading] = useState<boolean>(false);

  const handleReload = () => {
    setIsReloading(true);
    setReloadTrigger((prev) => prev + 1);
  };

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
        }
      } catch (err) {
        if (isMounted) {
          setAllUserVideos(items.filter(isVideoFile));
        }
      } finally {
        if (isMounted) {
          setIsLoadingCategories(false);
          setIsReloading(false);
        }
      }
    };

    loadCategories();

    return () => {
      isMounted = false;
    };
  }, [user.username, items, reloadTrigger]);

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

  // Helper to match videos against search query (title, filename, folder path, description)
  const matchesQuery = useCallback((v: FileItemData, query: string) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    const cleanTitle = formatCleanTitle(v.name).toLowerCase();
    const rawName = v.name.toLowerCase();
    const path = (v.path || '').toLowerCase();
    const desc = (v.metadata?.description || '').toLowerCase();
    return cleanTitle.includes(q) || rawName.includes(q) || path.includes(q) || desc.includes(q);
  }, []);

  // Featured rows: "Zuletzt hinzugefügt" is ALWAYS first, followed by folder categories
  const featuredRows = useMemo(() => {
    const rows: VideoCategory[] = [];
    const q = searchQuery.trim().toLowerCase();

    // Row 1: "Zuletzt hinzugefügt"
    const recentFiltered = displayVideos.filter((v) => matchesQuery(v, searchQuery));
    if (recentFiltered.length > 0) {
      rows.push({
        id: 'recent',
        title: 'Zuletzt hinzugefügt',
        folderPath: '',
        videos: recentFiltered,
      });
    }

    // Category rows: if category title matches q, show its videos; or show videos matching q
    if (allFolderCategories.length > 0) {
      if (q) {
        allFolderCategories.forEach((cat) => {
          const catMatches = cat.title.toLowerCase().includes(q);
          const matchingVideos = cat.videos.filter((v) => catMatches || matchesQuery(v, searchQuery));
          if (matchingVideos.length > 0) {
            rows.push({
              ...cat,
              videos: matchingVideos,
            });
          }
        });
      } else {
        const shuffled = [...allFolderCategories].sort(() => 0.5 - Math.random());
        const selectedRandom = shuffled.slice(0, 3);
        rows.push(...selectedRandom);
      }
    }

    return rows;
  }, [displayVideos, allFolderCategories, searchQuery, matchesQuery]);

  // Category filter options for interactive pill bar
  const filterOptions = useMemo(() => {
    const opts: { id: string; label: string }[] = [
      { id: 'all', label: 'Alle Filme' },
      { id: 'recent', label: 'Zuletzt hinzugefügt' },
    ];
    const q = searchQuery.trim().toLowerCase();
    allFolderCategories.forEach((cat) => {
      if (!q || cat.title.toLowerCase().includes(q) || cat.videos.some((v) => matchesQuery(v, searchQuery))) {
        opts.push({ id: cat.id, label: cat.title });
      }
    });
    return opts;
  }, [allFolderCategories, searchQuery, matchesQuery]);

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
    return baseList.filter((v) => matchesQuery(v, searchQuery));
  }, [displayVideos, allFolderCategories, activeCategoryFilter, searchQuery, matchesQuery]);

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

  // TV Search Input State (Erst OK-Klick öffnet die Tastatur)
  const [isEditingSearch, setIsEditingSearch] = useState<boolean>(false);
  const lastKeyTimeRef = useRef<number>(0);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchClearBtnRef = useRef<HTMLButtonElement>(null);
  const headerReloadBtnRef = useRef<HTMLButtonElement>(null);
  const emptyStateBtnRef = useRef<HTMLButtonElement>(null);
  const heroPlayBtnRef = useRef<HTMLButtonElement>(null);
  const heroInfoBtnRef = useRef<HTMLButtonElement>(null);
  const carouselItemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const filterPillRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const gridItemRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Calculate dynamic grid columns for vertical navigation matching Tailwind breakpoints
  const getGridCols = useCallback((): number => {
    if (typeof window === 'undefined') return 4;
    const w = window.innerWidth;
    if (w >= 1280) return 4;
    if (w >= 1024) return 3;
    if (w >= 640) return 2;
    return 1;
  }, []);

  // Butterweiches, entkoppeltes Scrollen per requestAnimationFrame
  const scrollRafRef = useRef<number | null>(null);

  useEffect(() => {
    if (activePlayerVideo || selectedDetailsVideo || descriptionOverlay) return;

    if (scrollRafRef.current) {
      cancelAnimationFrame(scrollRafRef.current);
    }

    scrollRafRef.current = requestAnimationFrame(() => {
      if (focusedZone === 'header') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (focusedZone === 'emptyState') {
        emptyStateBtnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      } else if (focusedZone === 'hero') {
        const btn = heroIndex === 0 ? heroPlayBtnRef.current : heroInfoBtnRef.current;
        btn?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      } else if (focusedZone === 'carousels') {
        const key = `${carouselRowIdx}-${carouselColIdx}`;
        const el = carouselItemRefs.current.get(key);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
      } else if (focusedZone === 'filterBar') {
        const btn = filterPillRefs.current.get(filterBarIdx);
        if (btn) {
          btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
      } else if (focusedZone === 'grid') {
        const el = gridItemRefs.current.get(gridIdx);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
      }
    });

    return () => {
      if (scrollRafRef.current) {
        cancelAnimationFrame(scrollRafRef.current);
      }
    };
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

  // Keep a ref of activePlayerVideo to safely inspect in window popstate handler
  const activePlayerVideoRef = useRef<FileItemData | null>(activePlayerVideo);
  useEffect(() => {
    activePlayerVideoRef.current = activePlayerVideo;
  }, [activePlayerVideo]);

  // -------------------------------------------------------------
  // ANDROID TV REMOTE & BROWSER HISTORY (POPSTATE) TRAP
  // -------------------------------------------------------------
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Push state so there is always a cinema-tv state on history
    window.history.pushState({ tab: 'cinema-tv', tvMode: true }, '', '/cinema/tv');

    const handleTvPopState = () => {
      // a) If video is currently playing in fullscreen player, close player and return to TV tile overview
      if (activePlayerVideoRef.current) {
        setActivePlayerVideo(null);
      } else {
        // b) If in main overview: close any overlays and stay in Cinema/TV mode
        setDescriptionOverlay(null);
        setSelectedDetailsVideo(null);
      }

      // Re-push history entry to strictly prevent jumping back to standard Cloud interface
      window.history.pushState({ tab: 'cinema-tv', tvMode: true }, '', '/cinema/tv');
    };

    window.addEventListener('popstate', handleTvPopState);
    return () => {
      window.removeEventListener('popstate', handleTvPopState);
    };
  }, []);

  // Play a video exclusively in TV fullscreen player (prevent double modal)
  const startPlayback = useCallback((video: FileItemData, category?: VideoCategory | null) => {
    setCurrentPlayingCategory(category || null);
    setActivePlayerVideo(video);
  }, []);

  // Check description and either show Info-Overlay or start playback
  const handleSelectVideo = useCallback(
    async (video: FileItemData, category?: VideoCategory | null) => {
      setOverlayBtnIdx(1);
      if (video.metadata?.description && video.metadata.description.trim()) {
        setDescriptionOverlay({
          video,
          description: video.metadata.description.trim(),
          category,
        });
        return;
      }
      const itemPath = video.path || video.name;
      const itemOwner = video.owner || user.username;
      try {
        const meta = await getFileMetadata(itemPath, itemOwner);
        if (meta.description && meta.description.trim()) {
          setDescriptionOverlay({
            video,
            description: meta.description.trim(),
            category,
          });
        } else {
          startPlayback(video, category);
        }
      } catch {
        startPlayback(video, category);
      }
    },
    [user.username, startPlayback]
  );

  const handleVideoSelect = useCallback(
    (video: FileItemData, category?: VideoCategory | null) => {
      handleSelectVideo(video, category);
    },
    [handleSelectVideo]
  );

  const handleVideoDetails = useCallback((video: FileItemData) => {
    setSelectedDetailsVideo(video);
  }, []);

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

  // Handle D-Pad Keyboard Navigation & Android TV Back Button
  useEffect(() => {
    const handleTvDpad = (e: KeyboardEvent) => {
      const isInputFocused =
        document.activeElement === searchInputRef.current ||
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA';

      // -------------------------------------------------------------
      // 1. GLOBAL BACK BUTTON (Android TV Remote & Keyboard)
      // -------------------------------------------------------------
      if (isTvBackEvent(e)) {
        // If user is editing text in search input, allow normal backspace to delete characters
        if (isEditingSearch && (e.key === 'Backspace' || (e.keyCode || e.which) === 8)) {
          return;
        }

        // Intercept and prevent back navigation from leaving Cinema/TV
        e.preventDefault();
        e.stopPropagation();

        // If search input is active/editing -> close keyboard, blur, but stay on search bar in TV
        if (isEditingSearch || isInputFocused) {
          searchInputRef.current?.blur();
          setIsEditingSearch(false);
          setFocusedZone('header');
          setHeaderFocusIndex(0);
          return;
        }

        // a) If video player is active
        if (activePlayerVideo) {
          setActivePlayerVideo(null);
          return;
        }

        // b) If info description overlay is open -> close it and return to tile overview
        if (descriptionOverlay) {
          setDescriptionOverlay(null);
          return;
        }

        // c) If details modal is open -> close it and return to tile overview
        if (selectedDetailsVideo) {
          setSelectedDetailsVideo(null);
          return;
        }

        // d) If navigating content zones (carousels, filterBar, grid, emptyState) -> return focus to top header
        if (focusedZone !== 'header') {
          setFocusedZone('header');
          setHeaderFocusIndex(0);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }

        return;
      }

      // If description overlay is open, handle its D-pad controls
      if (descriptionOverlay) {
        if (e.key === 'ArrowLeft' || e.keyCode === 37) {
          e.preventDefault();
          setOverlayBtnIdx(0);
        } else if (e.key === 'ArrowRight' || e.keyCode === 39) {
          e.preventDefault();
          setOverlayBtnIdx(1);
        } else if (e.key === 'Enter' || e.keyCode === 13) {
          e.preventDefault();
          if (overlayBtnIdx === 0) {
            setDescriptionOverlay(null);
          } else {
            const vid = descriptionOverlay.video;
            const cat = descriptionOverlay.category;
            setDescriptionOverlay(null);
            startPlayback(vid, cat);
          }
        }
        return;
      }

      // Details modal
      if (selectedDetailsVideo) {
        if (e.key === 'Enter' || e.keyCode === 13) {
          e.preventDefault();
          const vid = selectedDetailsVideo;
          setSelectedDetailsVideo(null);
          startPlayback(vid);
        }
        return;
      }

      if (activePlayerVideo) return;

      // Event throttling for D-Pad navigation keys to prevent event queue buildup
      const isNavKey =
        e.key === 'ArrowUp' ||
        e.key === 'ArrowDown' ||
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight' ||
        e.key === 'Up' ||
        e.key === 'Down' ||
        e.key === 'Left' ||
        e.key === 'Right' ||
        e.keyCode === 38 ||
        e.keyCode === 40 ||
        e.keyCode === 37 ||
        e.keyCode === 39;

      if (!isEditingSearch && isNavKey) {
        const now = performance.now();
        if (now - lastKeyTimeRef.current < 75) {
          e.preventDefault();
          return;
        }
        lastKeyTimeRef.current = now;
      }

      const cols = getGridCols();
      const maxHeaderIdx = searchQuery ? 2 : 1;
      const isUp = e.key === 'ArrowUp' || e.key === 'Up' || e.keyCode === 38;
      const isDown = e.key === 'ArrowDown' || e.key === 'Down' || e.keyCode === 40;
      const isLeft = e.key === 'ArrowLeft' || e.key === 'Left' || e.keyCode === 37;
      const isRight = e.key === 'ArrowRight' || e.key === 'Right' || e.keyCode === 39;
      const isEnter = e.key === 'Enter' || e.keyCode === 13;

      if (isUp) {
        e.preventDefault();
        if (focusedZone === 'grid') {
          if (gridIdx >= cols) {
            // Strictly vertical navigation up inside the same column
            setGridIdx((prev) => prev - cols);
          } else {
            // Reached top row of grid -> navigate up to filterBar
            setFocusedZone('filterBar');
            const targetPill = Math.min(filterOptions.length - 1, gridIdx % cols);
            setFilterBarIdx(Math.max(0, targetPill));
          }
        } else if (focusedZone === 'filterBar') {
          if (featuredRows.length > 0) {
            setFocusedZone('carousels');
            const targetRow = featuredRows.length - 1;
            setCarouselRowIdx(targetRow);
            const maxCol = Math.max(0, (featuredRows[targetRow]?.videos.length || 1) - 1);
            setCarouselColIdx((prev) => Math.min(prev, maxCol));
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
            const maxCol = Math.max(0, (featuredRows[nextRow]?.videos.length || 1) - 1);
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
        return;
      }

      if (isDown) {
        e.preventDefault();
        if (focusedZone === 'header') {
          if (isEditingSearch) {
            searchInputRef.current?.blur();
            setIsEditingSearch(false);
          }
          if (heroVideo) {
            setFocusedZone('hero');
            setHeroIndex(0);
          } else if (!isLoadingCategories && displayVideos.length === 0) {
            setFocusedZone('emptyState');
          } else if (featuredRows.length > 0) {
            setFocusedZone('carousels');
            setCarouselRowIdx(0);
            setCarouselColIdx(0);
          } else if (filterOptions.length > 0) {
            setFocusedZone('filterBar');
            setFilterBarIdx(0);
          } else if (gridVideos.length > 0) {
            setFocusedZone('grid');
            setGridIdx(0);
          }
        } else if (focusedZone === 'hero') {
          if (featuredRows.length > 0) {
            setFocusedZone('carousels');
            setCarouselRowIdx(0);
            setCarouselColIdx(0);
          } else if (filterOptions.length > 0) {
            setFocusedZone('filterBar');
            setFilterBarIdx(0);
          } else if (gridVideos.length > 0) {
            setFocusedZone('grid');
            setGridIdx(0);
          }
        } else if (focusedZone === 'carousels') {
          if (carouselRowIdx < featuredRows.length - 1) {
            const nextRow = carouselRowIdx + 1;
            const maxCol = Math.max(0, (featuredRows[nextRow]?.videos.length || 1) - 1);
            setCarouselRowIdx(nextRow);
            setCarouselColIdx((prev) => Math.min(prev, maxCol));
          } else if (filterOptions.length > 0) {
            setFocusedZone('filterBar');
            setFilterBarIdx(0);
          } else if (gridVideos.length > 0) {
            setFocusedZone('grid');
            setGridIdx(0);
          }
        } else if (focusedZone === 'filterBar') {
          if (gridVideos.length > 0) {
            setFocusedZone('grid');
            const targetCol = Math.min(filterBarIdx, cols - 1, gridVideos.length - 1);
            setGridIdx(Math.max(0, targetCol));
          }
        } else if (focusedZone === 'grid') {
          const total = gridVideos.length;
          if (total === 0) return;
          const targetIdx = gridIdx + cols;
          if (targetIdx < total) {
            // Strictly vertical navigation down inside the same column
            setGridIdx(targetIdx);
          } else {
            // Element directly underneath does not exist. Check if there is an incomplete row below
            const currentRow = Math.floor(gridIdx / cols);
            const lastRow = Math.floor((total - 1) / cols);
            if (currentRow < lastRow) {
              // Jump strictly to the last element of the list, never changing direction arbitrarily
              setGridIdx(total - 1);
            }
          }
        }
        return;
      }

      if (isLeft) {
        if (isEditingSearch) return; // Allow caret movement inside search input when actively editing
        e.preventDefault();
        if (focusedZone === 'header') {
          setHeaderFocusIndex((prev) => Math.max(0, prev - 1));
        } else if (focusedZone === 'hero') {
          setHeroIndex(0);
        } else if (focusedZone === 'carousels') {
          setCarouselColIdx((prev) => Math.max(0, prev - 1));
        } else if (focusedZone === 'filterBar') {
          setFilterBarIdx((prev) => Math.max(0, prev - 1));
        } else if (focusedZone === 'grid') {
          setGridIdx((prev) => Math.max(0, prev - 1));
        }
        return;
      }

      if (isRight) {
        if (isEditingSearch) return; // Allow caret movement inside search input when actively editing
        e.preventDefault();
        if (focusedZone === 'header') {
          setHeaderFocusIndex((prev) => Math.min(maxHeaderIdx, prev + 1));
        } else if (focusedZone === 'hero') {
          setHeroIndex(1);
        } else if (focusedZone === 'carousels') {
          const currentCatVideos = featuredRows[carouselRowIdx]?.videos || [];
          setCarouselColIdx((prev) => Math.min(Math.max(0, currentCatVideos.length - 1), prev + 1));
        } else if (focusedZone === 'filterBar') {
          setFilterBarIdx((prev) => Math.min(filterOptions.length - 1, prev + 1));
        } else if (focusedZone === 'grid') {
          setGridIdx((prev) => Math.min(gridVideos.length - 1, prev + 1));
        }
        return;
      }

      if (isEnter) {
        e.preventDefault();
        if (focusedZone === 'header') {
          if (headerFocusIndex === 0) {
            if (!isEditingSearch) {
              // OK / Enter clicked on visually focused search bar: Activate input and open TV keyboard
              setIsEditingSearch(true);
              setTimeout(() => {
                searchInputRef.current?.focus();
              }, 20);
            } else {
              // Enter while editing search: blur input, close TV keyboard, and move focus to results
              searchInputRef.current?.blur();
              setIsEditingSearch(false);
              if (gridVideos.length > 0) {
                setFocusedZone('grid');
                setGridIdx(0);
              } else if (featuredRows.length > 0 && featuredRows[0].videos.length > 0) {
                setFocusedZone('carousels');
                setCarouselRowIdx(0);
                setCarouselColIdx(0);
              }
            }
          } else if (searchQuery && headerFocusIndex === 1) {
            setSearchQuery('');
            setHeaderFocusIndex(0);
            setIsEditingSearch(false);
          } else {
            handleReload();
          }
        } else if (focusedZone === 'emptyState') {
          setUseDemoFallback((prev) => !prev);
        } else if (focusedZone === 'hero' && heroVideo) {
          if (heroIndex === 0) startPlayback(heroVideo);
          else handleSelectVideo(heroVideo);
        } else if (focusedZone === 'carousels') {
          const curCat = featuredRows[carouselRowIdx];
          if (curCat && curCat.videos[carouselColIdx]) {
            handleSelectVideo(curCat.videos[carouselColIdx], curCat);
          }
        } else if (focusedZone === 'filterBar') {
          const chosen = filterOptions[filterBarIdx];
          if (chosen) {
            setActiveCategoryFilter(chosen.id);
          }
        } else if (focusedZone === 'grid') {
          const vid = gridVideos[gridIdx];
          if (vid) {
            const cat = allFolderCategories.find((c) =>
              c.videos.some((v) => (v.path || v.name) === (vid.path || vid.name))
            );
            handleSelectVideo(vid, cat);
          }
        }
        return;
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
    overlayBtnIdx,
    displayVideos,
    searchQuery,
    useDemoFallback,
    isEditingSearch,
    isLoadingCategories,
    getGridCols,
    startPlayback,
    handleSelectVideo,
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
          {/* Suchleiste: Erst Klick auf OK öffnet Tastatur */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              searchInputRef.current?.blur();
              setIsEditingSearch(false);
              if (gridVideos.length > 0) {
                setFocusedZone('grid');
                setGridIdx(0);
              } else if (featuredRows.length > 0 && featuredRows[0].videos.length > 0) {
                setFocusedZone('carousels');
                setCarouselRowIdx(0);
                setCarouselColIdx(0);
              }
            }}
            className="relative flex-1 max-w-md"
          >
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              readOnly={!isEditingSearch}
              placeholder={isEditingSearch ? "Videos oder Filme suchen..." : (searchQuery || "OK drücken zum Suchen...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClick={() => {
                setFocusedZone('header');
                setHeaderFocusIndex(0);
                setIsEditingSearch(true);
                searchInputRef.current?.focus();
              }}
              onFocus={() => {
                setFocusedZone('header');
                setHeaderFocusIndex(0);
              }}
              onBlur={() => {
                setIsEditingSearch(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  searchInputRef.current?.blur();
                  setIsEditingSearch(false);
                  if (gridVideos.length > 0) {
                    setFocusedZone('grid');
                    setGridIdx(0);
                  } else if (featuredRows.length > 0 && featuredRows[0].videos.length > 0) {
                    setFocusedZone('carousels');
                    setCarouselRowIdx(0);
                    setCarouselColIdx(0);
                  }
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  e.stopPropagation();
                  searchInputRef.current?.blur();
                  setIsEditingSearch(false);
                  if (heroVideo) {
                    setFocusedZone('hero');
                    setHeroIndex(0);
                  } else if (featuredRows.length > 0) {
                    setFocusedZone('carousels');
                    setCarouselRowIdx(0);
                    setCarouselColIdx(0);
                  } else if (gridVideos.length > 0) {
                    setFocusedZone('grid');
                    setGridIdx(0);
                  }
                }
              }}
              className={`w-full pl-10 pr-9 py-2 text-xs sm:text-sm rounded-full text-white placeholder-gray-400 focus:outline-none transition-transform duration-100 shadow-inner cursor-pointer ${
                focusedZone === 'header' && headerFocusIndex === 0
                  ? isEditingSearch
                    ? 'border-[#E50914] ring-4 ring-[#E50914] bg-black/90'
                    : 'border-white ring-4 ring-white bg-black/80 scale-105 shadow-2xl'
                  : 'border border-white/10 bg-white/10 hover:bg-white/15'
              }`}
            />
            {searchQuery && (
              <button
                type="button"
                ref={searchClearBtnRef}
                onClick={() => {
                  setSearchQuery('');
                  setHeaderFocusIndex(0);
                  setIsEditingSearch(false);
                }}
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
          </form>

          {/* Kleiner Reload-Knopf im Header zum Aktualisieren und Prüfen auf neue Dateien */}
          <button
            ref={headerReloadBtnRef}
            onClick={handleReload}
            disabled={isReloading || isLoadingCategories}
            onMouseEnter={() => {
              setFocusedZone('header');
              setHeaderFocusIndex(searchQuery ? 2 : 1);
            }}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all select-none cursor-pointer outline-none shrink-0 ${
              focusedZone === 'header' && headerFocusIndex === (searchQuery ? 2 : 1)
                ? 'bg-white text-black ring-4 ring-white scale-105 shadow-xl font-bold'
                : 'text-gray-300 hover:text-white bg-white/10 hover:bg-white/20 border border-white/10'
            }`}
            title="Auf neue Dateien prüfen und Mediathek neu laden"
            aria-label="Mediathek aktualisieren"
          >
            <RotateCw className={`w-3.5 h-3.5 text-blue-400 ${isReloading || isLoadingCategories ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Aktualisieren</span>
          </button>
        </div>
      </header>

      {/* 2. HERO FEATURED BANNER (IDENTISCHER FADE & BLEND-IN MIT /CINEMA) */}
      {isLoadingCategories ? (
        <div className="w-full h-[45vh] min-h-[340px] max-h-[550px] flex flex-col items-center justify-center gap-3 select-none mb-8">
          <Loader2 className="w-10 h-10 animate-spin text-[#E50914]" />
          <span className="text-xs text-gray-400 font-medium">Mediathek wird geladen...</span>
        </div>
      ) : heroVideo ? (
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
                onClick={(e) => {
                  e.stopPropagation();
                  startPlayback(heroVideo);
                }}
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
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectVideo(heroVideo);
                }}
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
      ) : null}

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

                    return (
                      <TvCardItem
                        key={`tv-card-${category.id}-${video.path || video.name}-${colIdx}`}
                        video={video}
                        category={category}
                        isFocused={isFocused}
                        className="flex-none w-64 sm:w-72 md:w-80 snap-start"
                        itemRef={(el) => {
                          const key = `${rowIdx}-${colIdx}`;
                          if (el) carouselItemRefs.current.set(key, el);
                          else carouselItemRefs.current.delete(key);
                        }}
                        onSelect={handleVideoSelect}
                        onDetails={handleVideoDetails}
                        onHover={() => {
                          setFocusedZone('carousels');
                          setCarouselRowIdx(rowIdx);
                          setCarouselColIdx(colIdx);
                        }}
                      />
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
              {gridVideos.map((video, idx) => {
                const isFocused = focusedZone === 'grid' && gridIdx === idx;
                const cat = allFolderCategories.find((c) =>
                  c.videos.some((v) => (v.path || v.name) === (video.path || video.name))
                );

                return (
                  <TvCardItem
                    key={`tv-grid-${video.path || video.name}-${idx}`}
                    video={video}
                    category={cat}
                    isFocused={isFocused}
                    itemRef={(el) => {
                      if (el) gridItemRefs.current.set(idx, el);
                      else gridItemRefs.current.delete(idx);
                    }}
                    onSelect={handleVideoSelect}
                    onDetails={handleVideoDetails}
                    onHover={() => {
                      setFocusedZone('grid');
                      setGridIdx(idx);
                    }}
                  />
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
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDescriptionOverlay(null);
                }}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  overlayBtnIdx === 0
                    ? 'ring-4 ring-white bg-white text-black font-bold scale-105 shadow-xl'
                    : 'text-gray-300 hover:text-white hover:bg-white/10'
                }`}
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
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-bold text-xs transition-all shadow-lg active:scale-95 cursor-pointer ${
                  overlayBtnIdx === 1 ? 'ring-4 ring-white scale-105 shadow-2xl' : ''
                }`}
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
                type="button"
                onClick={() => setSelectedDetailsVideo(null)}
                className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Schließen"
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
      )}

      {/* 7. FERNBEDIENUNGS-OPTIMIERTER VOLLBILD MEDIA-PLAYER */}
      {activePlayerVideo && (
        <CinemaPlayerOverlay
          video={activePlayerVideo}
          allVideos={displayVideos}
          categories={allFolderCategories}
          currentCategory={currentPlayingCategory}
          onClose={() => setActivePlayerVideo(null)}
          onVideoChange={(v) => setActivePlayerVideo(v)}
          darkMode={darkMode}
        />
      )}
    </div>
  );
};
