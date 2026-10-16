import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  FolderOpen,
  Eye,
  Download,
  Edit2,
  FileText,
  Trash2,
  Link as LinkIcon,
  ExternalLink,
  Copy,
  Scissors,
  Clipboard,
  FolderPlus,
  UploadCloud,
  RefreshCw,
  Share2,
} from 'lucide-react';
import type { FileItemData } from '../types';

export interface ContextMenuPosition {
  x: number;
  y: number;
  item: FileItemData;
  triggerRect?: DOMRect;
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
  onCopy?: (item: FileItemData) => void;
  onCut?: (item: FileItemData) => void;
  onShare?: (item: FileItemData) => void;
  onManageShares?: (item: FileItemData) => void;
  onPasteIntoFolder?: (targetFolder: FileItemData) => void;
  canPasteIntoFolder?: boolean;
  clipboardAction?: 'copy' | 'cut';
  clipboardItemName?: string;
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
  onCopy,
  onCut,
  onShare,
  onManageShares,
  onPasteIntoFolder,
  canPasteIntoFolder = false,
  clipboardAction,
  clipboardItemName,
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

    // Global scroll listener: ignores any scrolls that originate inside the context menu itself
    const handleScroll = (e: Event) => {
      if (menuRef.current && (e.target === menuRef.current || menuRef.current.contains(e.target as Node))) {
        return;
      }
      onClose();
    };

    // Global wheel listener: if wheel event is inside menu, stop propagation so it doesn't trigger parent scrolls
    const handleWheel = (e: WheelEvent) => {
      if (menuRef.current && (e.target === menuRef.current || menuRef.current.contains(e.target as Node))) {
        e.stopPropagation();
      }
    };

    // Isolate native events directly on the menu element to prevent event bubbling
    const menuEl = menuRef.current;
    const stopPropagation = (e: Event) => {
      e.stopPropagation();
    };

    if (menuEl) {
      menuEl.addEventListener('wheel', stopPropagation, { passive: true });
      menuEl.addEventListener('scroll', stopPropagation, { passive: true });
      menuEl.addEventListener('touchmove', stopPropagation, { passive: true });
    }

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('wheel', handleWheel, { passive: true, capture: true });

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('wheel', handleWheel, true);
      if (menuEl) {
        menuEl.removeEventListener('wheel', stopPropagation);
        menuEl.removeEventListener('scroll', stopPropagation);
        menuEl.removeEventListener('touchmove', stopPropagation);
      }
    };
  }, [position, onClose]);

  if (!position || typeof document === 'undefined') return null;

  const { x, y, item, triggerRect } = position;

  // Viewport-aware dynamic placement using fixed portal
  const menuWidth = 236;
  const padding = 12;

  const winWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const winHeight = typeof window !== 'undefined' ? window.innerHeight : 768;

  const triggerTop = triggerRect ? triggerRect.top : y;
  const triggerBottom = triggerRect ? triggerRect.bottom : y;
  const spaceBelow = winHeight - triggerBottom - padding;
  const spaceAbove = triggerTop - padding;

  // Smart placement: flip upward if near bottom edge (space below < 320px and more room above, or critically low below)
  const flipUpward = (spaceBelow < 320 && spaceAbove > spaceBelow) || spaceBelow < 180;

  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 9999,
    width: `${menuWidth}px`,
  };

  if (flipUpward) {
    const bottomPos = winHeight - triggerTop + 4;
    menuStyle.bottom = `${Math.max(padding, bottomPos)}px`;
    menuStyle.maxHeight = `${Math.min(winHeight * 0.85, Math.max(160, spaceAbove - 8))}px`;
    menuStyle.transformOrigin = 'bottom';
  } else {
    const topPos = triggerBottom + 4;
    menuStyle.top = `${Math.max(padding, topPos)}px`;
    menuStyle.maxHeight = `${Math.min(winHeight * 0.85, Math.max(160, spaceBelow - 8))}px`;
    menuStyle.transformOrigin = 'top';
  }

  // Horizontal position: align to the right of trigger button if provided
  let leftPos = x;
  if (triggerRect) {
    leftPos = triggerRect.right - menuWidth;
  }
  // Clamp inside screen bounds
  menuStyle.left = `${Math.min(Math.max(padding, leftPos), winWidth - menuWidth - padding)}px`;

  return createPortal(
    <div
      ref={menuRef}
      style={menuStyle}
      onWheel={(e) => e.stopPropagation()}
      onScroll={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      className="fixed z-[9999] rounded-2xl bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border border-gray-200/90 dark:border-gray-800 shadow-2xl py-1 text-xs text-gray-700 dark:text-gray-200 animate-in fade-in zoom-in-95 duration-100 select-none divide-y divide-gray-100 dark:divide-gray-800/80 overflow-y-auto max-h-[85vh] slim-scrollbar overscroll-contain"
    >
      {/* Header item summary */}
      <div className="px-3 py-1.5">
        <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{item.name}</p>
        <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">
          {item.type === 'folder' ? 'Ordner' : 'Datei'}
        </p>
      </div>

      {/* Primary Actions: Open & Download */}
      <div className="py-0.5">
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpen(item);
          }}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400 text-left transition-colors font-medium cursor-pointer"
        >
          {item.type === 'folder' ? (
            <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
          ) : (
            <Eye className="w-4 h-4 text-blue-500 shrink-0" />
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
            className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:text-purple-600 dark:hover:text-purple-400 text-left transition-colors font-medium cursor-pointer"
          >
            <ExternalLink className="w-4 h-4 text-purple-500 shrink-0" />
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
            className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 text-left transition-colors font-medium cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Herunterladen</span>
          </button>
        )}
      </div>

      {/* Clipboard Actions: Copy & Cut & Paste into Folder */}
      <div className="py-0.5">
        {item.type === 'folder' && onPasteIntoFolder && canPasteIntoFolder && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onPasteIntoFolder(item);
            }}
            disabled={isActionsDisabled}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400 text-left transition-colors font-medium disabled:opacity-50 cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Clipboard className="w-4 h-4 text-blue-500 shrink-0" />
              <span className="truncate">
                {clipboardAction === 'cut' ? 'Hierhin verschieben' : 'Hierhin kopieren'}
                {clipboardItemName ? ` (${clipboardItemName})` : ''}
              </span>
            </div>
          </button>
        )}

        {onCopy && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onCopy(item);
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 text-left transition-colors font-medium cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Copy className="w-4 h-4 text-blue-500 shrink-0" />
              <span>Kopieren</span>
            </div>
            <span className="text-[10px] text-gray-400 font-mono">Strg+C</span>
          </button>
        )}

        {onCut && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onCut(item);
            }}
            disabled={isActionsDisabled}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 text-left transition-colors font-medium disabled:opacity-50 cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Scissors className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Ausschneiden</span>
            </div>
            <span className="text-[10px] text-gray-400 font-mono">Strg+X</span>
          </button>
        )}
      </div>

      {/* Editing & Metadata Actions */}
      <div className="py-0.5">
        <button
          type="button"
          onClick={() => {
            onClose();
            onRename(item);
          }}
          disabled={isActionsDisabled}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 text-left transition-colors font-medium disabled:opacity-50 cursor-pointer"
        >
          <Edit2 className="w-4 h-4 text-indigo-500 shrink-0" />
          <span>Umbenennen</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onClose();
            onMetadata(item);
          }}
          disabled={isActionsDisabled}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 text-left transition-colors font-medium disabled:opacity-50 cursor-pointer"
        >
          <FileText className="w-4 h-4 text-teal-500 shrink-0" />
          <span>Details / Beschreibung</span>
        </button>
      </div>

      {/* Folder Share Actions (if folder) */}
      {item.type === 'folder' && (onShare || onManageShares) && (
        <div className="py-0.5">
          {onShare && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onShare(item);
              }}
              disabled={isActionsDisabled}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-left transition-colors font-medium disabled:opacity-50 cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Ordner teilen</span>
            </button>
          )}

          {onManageShares && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onManageShares(item);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400 text-left transition-colors font-medium cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-blue-500 shrink-0" />
              <span>Freigaben verwalten</span>
            </button>
          )}
        </div>
      )}

      {/* Sharing & Delete Actions */}
      <div className="py-0.5">
        <button
          type="button"
          onClick={() => {
            onClose();
            onPublicShare(item);
          }}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-600 dark:hover:text-emerald-400 text-left transition-colors font-medium cursor-pointer"
        >
          <LinkIcon className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>Öffentlichen Link teilen</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onClose();
            onDelete(item);
          }}
          disabled={isActionsDisabled}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 text-left transition-colors font-medium disabled:opacity-50 cursor-pointer"
        >
          <Trash2 className="w-4 h-4 text-red-500 shrink-0" />
          <span>Löschen</span>
        </button>
      </div>
    </div>,
    document.body
  );
};

// -------------------------------------------------------------
// EMPTY AREA CONTEXT MENU (Rechtsklick ins Leere)
// -------------------------------------------------------------
export interface EmptyAreaContextMenuProps {
  position: { x: number; y: number } | null;
  onClose: () => void;
  onPaste: () => void;
  canPaste: boolean;
  clipboardItemName?: string;
  clipboardAction?: 'copy' | 'cut';
  onNewFolder: () => void;
  onUploadClick: () => void;
  onRefresh: () => void;
  isActionsDisabled?: boolean;
}

export const EmptyAreaContextMenu: React.FC<EmptyAreaContextMenuProps> = ({
  position,
  onClose,
  onPaste,
  canPaste,
  clipboardItemName,
  clipboardAction,
  onNewFolder,
  onUploadClick,
  onRefresh,
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

    // Global scroll listener: ignores any scrolls that originate inside the context menu itself
    const handleScroll = (e: Event) => {
      if (menuRef.current && (e.target === menuRef.current || menuRef.current.contains(e.target as Node))) {
        return;
      }
      onClose();
    };

    // Global wheel listener
    const handleWheel = (e: WheelEvent) => {
      if (menuRef.current && (e.target === menuRef.current || menuRef.current.contains(e.target as Node))) {
        e.stopPropagation();
      }
    };

    const menuEl = menuRef.current;
    const stopPropagation = (e: Event) => {
      e.stopPropagation();
    };

    if (menuEl) {
      menuEl.addEventListener('wheel', stopPropagation, { passive: true });
      menuEl.addEventListener('scroll', stopPropagation, { passive: true });
      menuEl.addEventListener('touchmove', stopPropagation, { passive: true });
    }

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('wheel', handleWheel, { passive: true, capture: true });

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('wheel', handleWheel, true);
      if (menuEl) {
        menuEl.removeEventListener('wheel', stopPropagation);
        menuEl.removeEventListener('scroll', stopPropagation);
        menuEl.removeEventListener('touchmove', stopPropagation);
      }
    };
  }, [position, onClose]);

  if (!position || typeof document === 'undefined') return null;

  const { x, y } = position;
  const menuWidth = 236;
  const padding = 12;

  const winWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const winHeight = typeof window !== 'undefined' ? window.innerHeight : 768;

  const spaceBelow = winHeight - y - padding;
  const spaceAbove = y - padding;

  const flipUpward = (spaceBelow < 220 && spaceAbove > spaceBelow) || spaceBelow < 140;

  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 9999,
    width: `${menuWidth}px`,
  };

  if (flipUpward) {
    const bottomPos = winHeight - y + 4;
    menuStyle.bottom = `${Math.max(padding, bottomPos)}px`;
    menuStyle.maxHeight = `${Math.min(winHeight * 0.85, Math.max(160, spaceAbove - 8))}px`;
    menuStyle.transformOrigin = 'bottom';
  } else {
    menuStyle.top = `${Math.max(padding, y + 4)}px`;
    menuStyle.maxHeight = `${Math.min(winHeight * 0.85, Math.max(160, spaceBelow - 8))}px`;
    menuStyle.transformOrigin = 'top';
  }

  menuStyle.left = `${Math.min(Math.max(padding, x), winWidth - menuWidth - padding)}px`;

  return createPortal(
    <div
      ref={menuRef}
      style={menuStyle}
      onWheel={(e) => e.stopPropagation()}
      onScroll={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      className="fixed z-[9999] rounded-2xl bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border border-gray-200/90 dark:border-gray-800 shadow-2xl py-1 text-xs text-gray-700 dark:text-gray-200 animate-in fade-in zoom-in-95 duration-100 select-none divide-y divide-gray-100 dark:divide-gray-800/80 overflow-y-auto max-h-[85vh] slim-scrollbar overscroll-contain"
    >
      <div className="py-0.5">
        <button
          type="button"
          onClick={() => {
            if (canPaste && !isActionsDisabled) {
              onClose();
              onPaste();
            }
          }}
          disabled={!canPaste || isActionsDisabled}
          className={`w-full flex items-center justify-between px-3 py-1.5 text-left transition-colors font-medium ${
            canPaste && !isActionsDisabled
              ? 'hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer'
              : 'opacity-40 cursor-not-allowed text-gray-400'
          }`}
        >
          <div className="flex items-center gap-2.5 truncate">
            <Clipboard className="w-4 h-4 text-blue-500 shrink-0" />
            <span className="truncate">
              {clipboardAction === 'cut' ? 'Hierhin verschieben' : clipboardAction === 'copy' ? 'Hierhin kopieren' : 'Einfügen'}
              {clipboardItemName ? ` (${clipboardItemName})` : ''}
            </span>
          </div>
          <span className="text-[10px] text-gray-400 font-mono ml-2 shrink-0">Strg+V</span>
        </button>
      </div>

      <div className="py-0.5">
        <button
          type="button"
          onClick={() => {
            onClose();
            onNewFolder();
          }}
          disabled={isActionsDisabled}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 text-left transition-colors font-medium disabled:opacity-50 cursor-pointer"
        >
          <FolderPlus className="w-4 h-4 text-amber-500 shrink-0" />
          <span>Neuer Ordner</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onClose();
            onUploadClick();
          }}
          disabled={isActionsDisabled}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 text-left transition-colors font-medium disabled:opacity-50 cursor-pointer"
        >
          <UploadCloud className="w-4 h-4 text-blue-500 shrink-0" />
          <span>Dateien hochladen</span>
        </button>
      </div>

      <div className="py-0.5">
        <button
          type="button"
          onClick={() => {
            onClose();
            onRefresh();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 text-left transition-colors font-medium cursor-pointer"
        >
          <RefreshCw className="w-4 h-4 text-gray-500 shrink-0" />
          <span>Aktualisieren</span>
        </button>
      </div>
    </div>,
    document.body
  );
};
