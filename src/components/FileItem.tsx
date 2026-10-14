import React, { useState, useRef, useEffect } from 'react';
import {
  Folder,
  FileText,
  FileCode,
  FileImage,
  FileVideo,
  FileArchive,
  FileAudio,
  File as FileGeneric,
  MoreVertical,
  Download,
  Trash2,
  Share2,
  Edit2,
  Link as LinkIcon,
  Info
} from 'lucide-react';
import type { FileItemData, ViewMode } from '../types';
import { formatBytes, getStreamUrl } from '../services/storageApi';
import { isImageFile, isVideoFile, isPdfFile } from './MediaViewerModal';

interface FileItemProps {
  item: FileItemData;
  viewMode: ViewMode;
  onOpen: (item: FileItemData) => void;
  onDownload: (item: FileItemData) => void;
  onDelete: (item: FileItemData) => void;
  onRename?: (item: FileItemData) => void;
  onShare?: (item: FileItemData) => void;
  onManageShares?: (item: FileItemData) => void;
  onContextMenu?: (item: FileItemData, x: number, y: number) => void;
  onMetadata?: (item: FileItemData) => void;
  onPublicShare?: (item: FileItemData) => void;
  isActionsDisabled?: boolean;
}

export function getFileIcon(item: FileItemData) {
  if (item.type === 'folder') {
    return <Folder className="w-8 h-8 text-amber-500 fill-amber-500/20" />;
  }

  const ext = item.name.split('.').pop()?.toLowerCase() || '';

  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'avif'].includes(ext)) {
    return <FileImage className="w-8 h-8 text-emerald-500" />;
  }
  if (['pdf'].includes(ext)) {
    return <FileText className="w-8 h-8 text-red-500" />;
  }
  if (['mp4', 'mov', 'mkv', 'avi', 'webm'].includes(ext)) {
    return <FileVideo className="w-8 h-8 text-violet-500" />;
  }
  if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) {
    return <FileArchive className="w-8 h-8 text-yellow-600" />;
  }
  if (['mp3', 'wav', 'flac', 'ogg', 'm4a'].includes(ext)) {
    return <FileAudio className="w-8 h-8 text-pink-500" />;
  }
  if (['py', 'js', 'ts', 'tsx', 'jsx', 'json', 'html', 'css', 'md', 'sh'].includes(ext)) {
    return <FileCode className="w-8 h-8 text-blue-500" />;
  }

  return <FileGeneric className="w-8 h-8 text-gray-400" />;
}

export function getSmallFileIcon(item: FileItemData) {
  if (item.type === 'folder') {
    return <Folder className="w-5 h-5 text-amber-500 fill-amber-500/20 shrink-0" />;
  }
  const ext = item.name.split('.').pop()?.toLowerCase() || '';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'avif'].includes(ext)) {
    return <FileImage className="w-5 h-5 text-emerald-500 shrink-0" />;
  }
  if (['pdf'].includes(ext)) {
    return <FileText className="w-5 h-5 text-red-500 shrink-0" />;
  }
  if (['mp4', 'mov', 'mkv', 'avi', 'webm'].includes(ext)) {
    return <FileVideo className="w-5 h-5 text-violet-500 shrink-0" />;
  }
  if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) {
    return <FileArchive className="w-5 h-5 text-yellow-600 shrink-0" />;
  }
  if (['mp3', 'wav', 'flac', 'ogg', 'm4a'].includes(ext)) {
    return <FileAudio className="w-5 h-5 text-pink-500 shrink-0" />;
  }
  if (['py', 'js', 'ts', 'tsx', 'jsx', 'json', 'html', 'css', 'md', 'sh'].includes(ext)) {
    return <FileCode className="w-5 h-5 text-blue-500 shrink-0" />;
  }
  return <FileGeneric className="w-5 h-5 text-gray-400 shrink-0" />;
}

export const FileItem: React.FC<FileItemProps> = ({
  item,
  viewMode,
  onOpen,
  onDownload,
  onDelete,
  onRename,
  onShare,
  onManageShares,
  onContextMenu,
  onMetadata,
  onPublicShare,
  isActionsDisabled = false,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Mobile Long-Press Detection
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const isLongPressTriggeredRef = useRef(false);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return '–';
    }
  };

  const isImg = isImageFile(item);
  const isVid = isVideoFile(item);
  const isPdf = isPdfFile(item);
  const streamUrl = getStreamUrl(item.path || item.name);

  // Touch handlers for mobile long-press (500ms)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    isLongPressTriggeredRef.current = false;

    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      if (onContextMenu && touchStartPosRef.current) {
        onContextMenu(item, touchStartPosRef.current.x, touchStartPosRef.current.y);
      }
    }, 500);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPosRef.current || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
    if (dx > 10 || dy > 10) {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
  };

  // Desktop Right-Click
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onContextMenu) {
      onContextMenu(item, e.clientX, e.clientY);
    }
  };

  // Single click handler:
  const handleItemClick = (e: React.MouseEvent) => {
    if (isLongPressTriggeredRef.current) {
      isLongPressTriggeredRef.current = false;
      return;
    }
    onOpen(item);
  };

  const handleDownloadClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDownload(item);
  };

  // GRID VIEW
  if (viewMode === 'grid') {
    return (
      <div
        onClick={handleItemClick}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="group relative flex flex-col justify-between p-3 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200/80 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all cursor-pointer select-none"
      >
        {/* Top bar in card: Thumbnail / Icon + Context menu */}
        <div className="flex items-start justify-between gap-2">
          {/* Visual Presentation: Image Thumbnail or Icon / Badge */}
          {isImg && !imgError ? (
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-gray-100 dark:bg-gray-700 overflow-hidden shrink-0 border border-gray-200/60 dark:border-gray-600/50 flex items-center justify-center group-hover:scale-105 transition-transform">
              <img
                src={streamUrl}
                alt={item.name}
                loading="lazy"
                onError={() => setImgError(true)}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-700/60 group-hover:scale-105 transition-transform flex items-center justify-center">
              {getFileIcon(item)}
            </div>
          )}

          {/* Type Badge for Videos & PDFs */}
          <div className="flex items-center gap-1.5">
            {isVid && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
                VIDEO
              </span>
            )}
            {isPdf && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-800">
                PDF
              </span>
            )}

            {/* Context Menu Button */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onContextMenu) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    onContextMenu(item, rect.left, rect.bottom + 4);
                  } else {
                    setMenuOpen(!menuOpen);
                  }
                }}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 opacity-80 group-hover:opacity-100 transition-opacity"
                aria-label="Optionen"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100">
                  {item.type === 'file' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        onDownload(item);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 text-left transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-blue-500" />
                      <span>Herunterladen</span>
                    </button>
                  )}

                  {onRename && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        onRename(item);
                      }}
                      disabled={isActionsDisabled}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 text-left transition-colors disabled:opacity-50"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-gray-500" />
                      <span>Umbenennen</span>
                    </button>
                  )}

                  {item.type === 'folder' && onShare && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        onShare(item);
                      }}
                      disabled={isActionsDisabled}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 text-left transition-colors disabled:opacity-50"
                    >
                      <Share2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Ordner teilen</span>
                    </button>
                  )}

                  {item.type === 'folder' && onManageShares && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        onManageShares(item);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 text-left transition-colors"
                    >
                      <Share2 className="w-3.5 h-3.5 text-blue-500" />
                      <span>Freigaben verwalten</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onDelete(item);
                    }}
                    disabled={isActionsDisabled}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 text-left transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Löschen</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Name and Meta + Bottom Right Download Button */}
        <div className="mt-3 flex items-end justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4
              className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
              title={item.name}
            >
              {item.name}
            </h4>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500 dark:text-gray-400 font-mono tabular-nums">
              <span>{item.type === 'folder' ? 'Ordner' : formatBytes(item.size)}</span>
              <span>·</span>
              <span>{formatDate(item.modified)}</span>
            </div>
          </div>

          {/* Subtle Download Button at bottom-right of tile (per user specification) */}
          {item.type === 'file' && (
            <button
              type="button"
              onClick={handleDownloadClick}
              title={`"${item.name}" herunterladen`}
              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 bg-gray-50 dark:bg-gray-700/60 hover:bg-blue-50 dark:hover:bg-blue-950/50 border border-gray-200/60 dark:border-gray-700 transition-colors shrink-0 shadow-xs active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // LIST VIEW ROW
  return (
    <div
      onClick={handleItemClick}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="group flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-transparent hover:border-gray-200 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-all cursor-pointer select-none"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0 pr-4">
        {/* Thumbnail in list view for images, otherwise small icon */}
        {isImg && !imgError ? (
          <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 overflow-hidden shrink-0 border border-gray-200/60 dark:border-gray-600/50 flex items-center justify-center">
            <img
              src={streamUrl}
              alt={item.name}
              loading="lazy"
              onError={() => setImgError(true)}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          getSmallFileIcon(item)
        )}

        <span
          className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
          title={item.name}
        >
          {item.name}
        </span>

        {/* Badges */}
        {isVid && (
          <span className="hidden sm:inline-block text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-300">
            VIDEO
          </span>
        )}
        {isPdf && (
          <span className="hidden sm:inline-block text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-300">
            PDF
          </span>
        )}
      </div>

      <div className="hidden sm:flex items-center gap-6 text-xs text-gray-500 dark:text-gray-400 font-mono tabular-nums shrink-0">
        <span className="w-20 text-right">
          {item.type === 'folder' ? '–' : formatBytes(item.size)}
        </span>
        <span className="w-24 text-right">{formatDate(item.modified)}</span>
      </div>

      {/* Action buttons on the far right */}
      <div className="flex items-center gap-1 shrink-0 ml-3">
        {/* Subtle Download Button at row far-right (per user specification) */}
        {item.type === 'file' && (
          <button
            type="button"
            onClick={handleDownloadClick}
            title={`"${item.name}" herunterladen`}
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Row Context Menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onContextMenu) {
                const rect = e.currentTarget.getBoundingClientRect();
                onContextMenu(item, rect.left, rect.bottom + 4);
              } else {
                setMenuOpen(!menuOpen);
              }
            }}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-700 transition-colors"
            aria-label="Optionen"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100">
              {item.type === 'file' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onDownload(item);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 text-left transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-blue-500" />
                  <span>Herunterladen</span>
                </button>
              )}

              {onRename && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onRename(item);
                  }}
                  disabled={isActionsDisabled}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 text-left transition-colors disabled:opacity-50"
                >
                  <Edit2 className="w-3.5 h-3.5 text-gray-500" />
                  <span>Umbenennen</span>
                </button>
              )}

              {item.type === 'folder' && onShare && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onShare(item);
                  }}
                  disabled={isActionsDisabled}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 text-left transition-colors disabled:opacity-50"
                >
                  <Share2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Ordner teilen</span>
                </button>
              )}

              {item.type === 'folder' && onManageShares && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onManageShares(item);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 text-left transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5 text-blue-500" />
                  <span>Freigaben verwalten</span>
                </button>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onDelete(item);
                }}
                disabled={isActionsDisabled}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 text-left transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Löschen</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
