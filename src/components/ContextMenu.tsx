import React, { useEffect, useRef } from 'react';
import {
  FolderOpen,
  Eye,
  Download,
  Edit2,
  FileText,
  Share2,
  Trash2,
  Link as LinkIcon,
  ExternalLink
} from 'lucide-react';
import type { FileItemData } from '../types';

export interface ContextMenuPosition {
  x: number;
  y: number;
  item: FileItemData;
}

interface ContextMenuProps {
  position: ContextMenuPosition | null;
  onClose: () => void;
  onOpen: (item: FileItemData) => void;
  onOpenInNewTab?: (item: FileItemData) => void;
  onDownload: (item: FileItemData) => void;
  onRename: (item: FileItemData) => void;
  onMetadata: (item: FileItemData) => void;
  onPublicShare: (item: FileItemData) => void;
  onDelete: (item: FileItemData) => void;
  isActionsDisabled?: boolean;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  position,
  onClose,
  onOpen,
  onOpenInNewTab,
  onDownload,
  onRename,
  onMetadata,
  onPublicShare,
  onDelete,
  isActionsDisabled = false,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!position) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const handleScroll = () => {
      onClose();
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [position, onClose]);

  if (!position) return null;

  const { x, y, item } = position;

  // Viewport bounds detection
  const menuWidth = 220;
  const menuHeight = 260;
  const padding = 12;

  const adjustedX = Math.min(
    Math.max(padding, x),
    (typeof window !== 'undefined' ? window.innerWidth : 800) - menuWidth - padding
  );
  const adjustedY = Math.min(
    Math.max(padding, y),
    (typeof window !== 'undefined' ? window.innerHeight : 600) - menuHeight - padding
  );

  return (
    <div
      ref={menuRef}
      style={{ left: `${adjustedX}px`, top: `${adjustedY}px` }}
      className="fixed z-50 w-56 rounded-2xl bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border border-gray-200/80 dark:border-gray-800 shadow-2xl py-1.5 text-xs text-gray-700 dark:text-gray-200 animate-in fade-in zoom-in-95 duration-100 select-none divide-y divide-gray-100 dark:divide-gray-800/80"
    >
      {/* Header item summary */}
      <div className="px-3.5 py-2">
        <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{item.name}</p>
        <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">
          {item.type === 'folder' ? 'Ordner' : 'Datei'}
        </p>
      </div>

      {/* Primary Actions */}
      <div className="py-1">
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpen(item);
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400 text-left transition-colors font-medium"
        >
          {item.type === 'folder' ? (
            <FolderOpen className="w-4 h-4 text-amber-500" />
          ) : (
            <Eye className="w-4 h-4 text-blue-500" />
          )}
          <span>{item.type === 'folder' ? 'Öffnen' : 'Vorschau / Öffnen'}</span>
        </button>

        {item.type === 'file' && onOpenInNewTab && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenInNewTab(item);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:text-purple-600 dark:hover:text-purple-400 text-left transition-colors font-medium cursor-pointer"
          >
            <ExternalLink className="w-4 h-4 text-purple-500" />
            <span>In neuem Tab öffnen</span>
          </button>
        )}

        {item.type === 'file' && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onDownload(item);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 text-left transition-colors font-medium cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-500" />
            <span>Herunterladen</span>
          </button>
        )}
      </div>

      {/* Editing & Metadata Actions */}
      <div className="py-1">
        <button
          type="button"
          onClick={() => {
            onClose();
            onRename(item);
          }}
          disabled={isActionsDisabled}
          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 text-left transition-colors font-medium disabled:opacity-50"
        >
          <Edit2 className="w-4 h-4 text-indigo-500" />
          <span>Umbenennen</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onClose();
            onMetadata(item);
          }}
          disabled={isActionsDisabled}
          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 text-left transition-colors font-medium disabled:opacity-50"
        >
          <FileText className="w-4 h-4 text-teal-500" />
          <span>Details / Beschreibung</span>
        </button>
      </div>

      {/* Sharing & Delete Actions */}
      <div className="py-1">
        <button
          type="button"
          onClick={() => {
            onClose();
            onPublicShare(item);
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-600 dark:hover:text-emerald-400 text-left transition-colors font-medium"
        >
          <LinkIcon className="w-4 h-4 text-emerald-500" />
          <span>Öffentlichen Link teilen</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onClose();
            onDelete(item);
          }}
          disabled={isActionsDisabled}
          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 text-left transition-colors font-medium disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4 text-red-500" />
          <span>Löschen</span>
        </button>
      </div>
    </div>
  );
};
