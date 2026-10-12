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
  Edit2
} from 'lucide-react';
import type { FileItemData, ViewMode } from '../types';
import { formatBytes } from '../services/storageApi';

interface FileItemProps {
  item: FileItemData;
  viewMode: ViewMode;
  onOpen: (item: FileItemData) => void;
  onDownload: (item: FileItemData) => void;
  onDelete: (item: FileItemData) => void;
  onRename?: (item: FileItemData) => void;
  onShare?: (item: FileItemData) => void;
  isActionsDisabled?: boolean;
}

export function getFileIcon(item: FileItemData) {
  if (item.type === 'folder') {
    return <Folder className="w-8 h-8 text-amber-500 fill-amber-500/20" />;
  }

  const ext = item.name.split('.').pop()?.toLowerCase() || '';

  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) {
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
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) {
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
  isActionsDisabled = false,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  // GRID VIEW
  if (viewMode === 'grid') {
    return (
      <div
        onDoubleClick={() => onOpen(item)}
        className="group relative flex flex-col justify-between p-3.5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200/80 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all cursor-pointer select-none"
      >
        <div className="flex items-start justify-between gap-2">
          <div
            onClick={() => onOpen(item)}
            className="p-2 rounded-xl bg-gray-50 dark:bg-gray-700/60 group-hover:scale-105 transition-transform"
          >
            {getFileIcon(item)}
          </div>

          {/* Context Menu Button */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(!menuOpen);
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

                <button
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

        {/* Name and Meta */}
        <div className="mt-3.5" onClick={() => onOpen(item)}>
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
      </div>
    );
  }

  // LIST VIEW ROW
  return (
    <div
      onDoubleClick={() => onOpen(item)}
      className="group flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-transparent hover:border-gray-200 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-all cursor-pointer select-none"
    >
      <div
        onClick={() => onOpen(item)}
        className="flex items-center gap-3 flex-1 min-w-0 pr-4"
      >
        {getSmallFileIcon(item)}
        <span
          className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
          title={item.name}
        >
          {item.name}
        </span>
      </div>

      <div className="hidden sm:flex items-center gap-6 text-xs text-gray-500 dark:text-gray-400 font-mono tabular-nums shrink-0">
        <span className="w-20 text-right">
          {item.type === 'folder' ? '–' : formatBytes(item.size)}
        </span>
        <span className="w-24 text-right">{formatDate(item.modified)}</span>
      </div>

      {/* Row Menu */}
      <div className="relative shrink-0 ml-3" ref={menuRef}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(!menuOpen);
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

            <button
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
  );
};
