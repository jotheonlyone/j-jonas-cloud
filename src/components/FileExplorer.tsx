import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  UploadCloud,
  FolderPlus,
  RefreshCw,
  FolderOpen,
  ArrowUp,
  AlertCircle,
  Play,
  Pause,
  Shuffle,
  Disc,
  Music,
  MoreVertical,
} from 'lucide-react';
import type { FileItemData, ViewMode } from '../types';
import { Breadcrumbs } from './Breadcrumbs';
import { FileItem } from './FileItem';
import { ContextMenu, EmptyAreaContextMenu, type ContextMenuPosition } from './ContextMenu';
import { isAudioFile, parseAudioTitle } from '../utils/audioPlayerUtils';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { AudioCoverArt } from './AudioPlayer/AudioCoverArt';
import { formatBytes } from '../services/storageApi';

interface FileExplorerProps {
  currentPath: string;
  onNavigatePath: (newPath: string) => void;
  items: FileItemData[];
  isLoading: boolean;
  serverError?: string;
  viewMode: ViewMode;
  onRefresh: () => void;
  onUploadFiles: (files: FileList) => void;
  onNewFolder: () => void;
  onOpenFile: (item: FileItemData) => void;
  onOpenInNewTab?: (item: FileItemData) => void;
  onDownloadFile: (item: FileItemData) => void;
  onDeleteItem: (item: FileItemData) => void;
  onRenameItem?: (item: FileItemData) => void;
  onMetadataItem?: (item: FileItemData) => void;
  onPublicShareItem?: (item: FileItemData) => void;
  onShareFolder?: (item: FileItemData) => void;
  onManageShares?: (item: FileItemData) => void;
  onPlayFolderAsPlaylist?: (folder: FileItemData) => void;
  searchTerm?: string;
  isActionsDisabled?: boolean;
  rootLabel?: string;
  isSharedContext?: boolean;
  clipboard?: { action: 'copy' | 'cut'; item: FileItemData; sourcePath: string; sourceOwner?: string } | null;
  onCopyItem?: (item: FileItemData) => void;
  onCutItem?: (item: FileItemData) => void;
  onPaste?: (targetSubPath?: string) => void;
  onUploadClick?: () => void;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  currentPath,
  onNavigatePath,
  items,
  isLoading,
  serverError,
  viewMode,
  onRefresh,
  onUploadFiles,
  onNewFolder,
  onOpenFile,
  onOpenInNewTab,
  onDownloadFile,
  onDeleteItem,
  onRenameItem,
  onMetadataItem,
  onPublicShareItem,
  onShareFolder,
  onManageShares,
  onPlayFolderAsPlaylist,
  searchTerm = '',
  isActionsDisabled = false,
  rootLabel = 'Meine Ablage',
  isSharedContext = false,
  clipboard = null,
  onCopyItem,
  onCutItem,
  onPaste,
  onUploadClick,
}) => {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuPosition | null>(null);
  const [emptyContextMenu, setEmptyContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [selectedItem, setSelectedItem] = useState<FileItemData | null>(null);

  // Keyboard Shortcuts: Strg+C (Kopieren), Strg+X (Ausschneiden), Strg+V (Einfügen)
  useEffect(() => {
    const handleExplorerKeyDown = (e: KeyboardEvent) => {
      // Ignore when user is typing inside an input or textarea
      const isInput =
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA';
      if (isInput) return;

      if (e.ctrlKey || e.metaKey) {
        if ((e.key === 'c' || e.key === 'C') && selectedItem && onCopyItem) {
          e.preventDefault();
          onCopyItem(selectedItem);
        } else if ((e.key === 'x' || e.key === 'X') && selectedItem && onCutItem && !isActionsDisabled) {
          e.preventDefault();
          onCutItem(selectedItem);
        } else if ((e.key === 'v' || e.key === 'V') && clipboard && onPaste && !isActionsDisabled) {
          e.preventDefault();
          onPaste();
        }
      }
    };

    window.addEventListener('keydown', handleExplorerKeyDown);
    return () => window.removeEventListener('keydown', handleExplorerKeyDown);
  }, [selectedItem, clipboard, onCopyItem, onCutItem, onPaste, isActionsDisabled]);

  // Audio Player Context for global Shuffle and current track state
  const { isShuffle, toggleShuffle, currentTrack, isPlaying } = useAudioPlayer();

  // Filter items by search
  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const folders = filteredItems.filter((i) => i.type === 'folder');
  const files = filteredItems.filter((i) => i.type === 'file');
  const audioFiles = files.filter(isAudioFile);
  const nonAudioFiles = files.filter((f) => !isAudioFile(f));
  const isMusicFolder = Boolean(currentPath) && audioFiles.length > 0;
  const currentFolderName = currentPath ? currentPath.split('/').filter(Boolean).pop() : rootLabel;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isActionsDisabled) {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (!isActionsDisabled && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUploadFiles(e.dataTransfer.files);
    }
  };

  // Local navigation lock to prevent accidental double-click / rapid tap duplication
  const isNavigatingLocalRef = useRef(false);
  const lastFolderClickRef = useRef<{ id: string; time: number } | null>(null);

  useEffect(() => {
    if (!isLoading) {
      isNavigatingLocalRef.current = false;
    }
  }, [isLoading]);

  const handleSafeOpenFile = useCallback((it: FileItemData) => {
    if (it.type === 'folder') {
      const now = Date.now();
      const folderKey = it.id || it.path || it.name;

      if (isLoading || isNavigatingLocalRef.current) {
        return;
      }

      if (
        lastFolderClickRef.current &&
        lastFolderClickRef.current.id === folderKey &&
        now - lastFolderClickRef.current.time < 350
      ) {
        return;
      }

      lastFolderClickRef.current = { id: folderKey, time: now };
      isNavigatingLocalRef.current = true;
      setTimeout(() => {
        isNavigatingLocalRef.current = false;
      }, 400);
    }

    setSelectedItem(it);
    onOpenFile(it);
  }, [isLoading, onOpenFile]);

  const navigateUp = () => {
    if (!currentPath) return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    onNavigatePath(parts.join('/'));
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (!target.closest('[data-file-item="true"]')) {
          setSelectedItem(null);
        }
      }}
      onContextMenu={(e) => {
        // If clicking on empty space (not a file item, button or input)
        const target = e.target as HTMLElement;
        const isItem =
          target.closest('[data-file-item="true"]') ||
          target.closest('button') ||
          target.closest('input');
        if (!isItem) {
          e.preventDefault();
          setContextMenu(null);
          setEmptyContextMenu({ x: e.clientX, y: e.clientY });
        }
      }}
      className={`relative flex-1 flex flex-col h-full bg-white dark:bg-gray-900 rounded-2xl shadow-xs border border-gray-200 dark:border-gray-800 p-4 sm:p-6 transition-colors overflow-hidden ${
        isDraggingOver ? 'ring-2 ring-blue-500 ring-inset bg-blue-50/20 dark:bg-blue-950/20' : ''
      }`}
    >
      {/* Top Header inside Explorer: Breadcrumbs & Refresh */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          {currentPath && (
            <button
              onClick={navigateUp}
              className="p-1.5 rounded-full text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              title="Übergeordneter Ordner"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          )}
          <Breadcrumbs
            currentPath={currentPath}
            rootLabel={rootLabel}
            onNavigate={onNavigatePath}
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Playlist and Shuffle Buttons: ONLY inside folders, NEVER on the start page */}
          {Boolean(currentPath) && audioFiles.length > 0 && (
            <>
              {/* Shuffle button prominent at top */}
              <button
                type="button"
                onClick={() => {
                  toggleShuffle();
                  if (!isPlaying) {
                    onOpenFile(audioFiles[0]);
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 cursor-pointer shrink-0 border ${
                  isShuffle
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-xs ring-2 ring-emerald-400/30'
                    : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700'
                }`}
                title={isShuffle ? 'Shuffle-Modus ist AKTIV (klicken zum Ausschalten)' : 'Shuffle-Modus aktivieren'}
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Shuffle: {isShuffle ? 'AN' : 'AUS'}</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenFile(audioFiles[0])}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
                title={`Alle ${audioFiles.length} Musiktitel als Playlist abspielen`}
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span className="hidden sm:inline">Playlist starten</span>
                <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded-full font-mono">{audioFiles.length}</span>
              </button>
            </>
          )}

          <button
            onClick={onRefresh}
            className="p-1.5 rounded-full text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            title="Aktualisieren"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Drag Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-4 z-20 flex flex-col items-center justify-center rounded-2xl bg-blue-50/95 dark:bg-gray-900/95 backdrop-blur-xs border-2 border-dashed border-blue-500 pointer-events-none">
          <UploadCloud className="w-14 h-14 text-blue-600 dark:text-blue-400 animate-bounce mb-2" />
          <p className="text-base font-bold text-gray-800 dark:text-gray-100">
            Dateien hier ablegen zum Hochladen
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            in {currentPath ? `"${currentPath}"` : rootLabel}
          </p>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto pt-4">
        {isLoading && items.length === 0 ? (
          // Skeleton Loader
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="h-28 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse"
                />
              ))}
            </div>
            <div className="space-y-2 pt-2">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-12 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse"
                />
              ))}
            </div>
          </div>
        ) : filteredItems.length === 0 ? (
          // Empty State
          <div className="h-full min-h-[380px] flex flex-col items-center justify-center text-center p-8 select-none">
            <div className="w-24 h-24 rounded-full bg-blue-50/80 dark:bg-blue-950/40 text-blue-500 dark:text-blue-400 flex items-center justify-center mb-5 shadow-xs">
              <svg
                className="w-12 h-12 stroke-[1.4]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
                <path d="M2 10h20" />
              </svg>
            </div>

            <h3 className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-200">
              {searchTerm ? 'Keine passenden Dateien gefunden' : 'Hier sind noch keine Dateien vorhanden'}
            </h3>

            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 max-w-sm mt-1.5 leading-relaxed">
              {searchTerm
                ? `Keine Suchergebnisse für "${searchTerm}".`
                : "Klicke auf '+ Neu', um deine ersten Dateien oder Ordner hochzuladen."}
            </p>

            {!searchTerm && !isActionsDisabled && (
              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={onNewFolder}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 transition-all shadow-xs cursor-pointer"
                >
                  <FolderPlus className="w-4 h-4 text-amber-500" />
                  <span>Neuer Ordner</span>
                </button>

                <label className="flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-sm transition-all active:scale-95">
                  <UploadCloud className="w-4 h-4" />
                  <span>Dateien hochladen</span>
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        onUploadFiles(e.target.files);
                      }
                    }}
                  />
                </label>
              </div>
            )}
          </div>
        ) : (
          // Populated Files & Folders View
          <div className="space-y-6 pb-12">
            {isMusicFolder ? (
              // ================================================================
              // SPOTIFY-STYLE PLAYLIST VIEW (inside folders with music)
              // ================================================================
              <div className="space-y-6">
                {/* 1. Prominent Playlist Header Banner */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600/15 via-indigo-600/10 to-purple-600/15 dark:from-blue-950/50 dark:via-indigo-950/40 dark:to-purple-950/50 border border-blue-200/80 dark:border-blue-900/60 p-4 sm:p-6 shadow-sm backdrop-blur-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                    {/* Left: Artwork / Cover & Info */}
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="relative w-16 h-16 sm:w-22 sm:h-22 rounded-2xl overflow-hidden shadow-lg bg-gradient-to-br from-blue-600 to-indigo-700 shrink-0 flex items-center justify-center text-white ring-2 ring-white/40 dark:ring-white/10">
                        {audioFiles.length > 0 ? (
                          <AudioCoverArt
                            filePath={audioFiles[0].path || audioFiles[0].name}
                            currentUser={audioFiles[0].owner}
                            title={audioFiles[0].name}
                            className="w-full h-full object-cover"
                            iconClassName="w-10 h-10"
                          />
                        ) : (
                          <Disc className="w-10 h-10 text-white/80 animate-spin-slow" />
                        )}
                        {isPlaying && currentTrack && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <div className="flex items-end gap-1 h-5">
                              <span className="w-1 bg-white h-3 animate-pulse rounded-full" />
                              <span className="w-1 bg-white h-5 animate-bounce rounded-full" />
                              <span className="w-1 bg-white h-4 animate-pulse rounded-full" />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-600 text-white shadow-xs">
                            <Disc className="w-3.5 h-3.5" />
                            Playlist
                          </span>
                          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                            {audioFiles.length} {audioFiles.length === 1 ? 'Musiktitel' : 'Musiktitel'}
                          </span>
                          {nonAudioFiles.length > 0 && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              • {nonAudioFiles.length} weitere Datei(en)
                            </span>
                          )}
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white truncate tracking-tight">
                          {currentFolderName}
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                          Alle Musiktitel in diesem Ordner direkt als Playlist abspielen
                        </p>
                      </div>
                    </div>

                    {/* Right: Big Play and Big Shuffle Buttons */}
                    <div className="flex items-center flex-wrap gap-3 shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-gray-200/50 dark:border-gray-800/60">
                      {/* Prominent Shuffle Button */}
                      <button
                        type="button"
                        onClick={() => {
                          toggleShuffle();
                          if (!isPlaying && audioFiles.length > 0) {
                            onOpenFile(audioFiles[0]);
                          }
                        }}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all shadow-sm active:scale-95 cursor-pointer border ${
                          isShuffle
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 shadow-emerald-600/30 ring-2 ring-emerald-400/40'
                            : 'bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-700'
                        }`}
                        title={
                          isShuffle
                            ? 'Shuffle ist AKTIV: Titel werden in intelligenter Zufallsreihenfolge abgespielt (kein Song doppelt hintereinander)'
                            : 'Shuffle ist AUS: Klicken zum Einschalten der Zufallswiedergabe'
                        }
                      >
                        <Shuffle className={`w-4 h-4 ${isShuffle ? 'stroke-[2.5]' : ''}`} />
                        <span>Shuffle-Modus: {isShuffle ? 'AN' : 'AUS'}</span>
                      </button>

                      {/* Play Playlist Button */}
                      <button
                        type="button"
                        onClick={() => {
                          if (audioFiles.length > 0) {
                            onOpenFile(audioFiles[0]);
                          }
                        }}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
                        title="Playlist starten"
                      >
                        <Play className="w-4 h-4 fill-white" />
                        <span>Playlist starten</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Subfolders in playlist folder if any exist */}
                {folders.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                      Unterordner ({folders.length})
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {folders.map((item) => (
                        <div
                          key={item.name}
                          data-file-item="true"
                          onClick={() => setSelectedItem(item)}
                        >
                          <FileItem
                            item={item}
                            viewMode="grid"
                            isSelected={selectedItem?.name === item.name}
                            isCut={clipboard?.action === 'cut' && clipboard?.item.name === item.name}
                            onOpen={handleSafeOpenFile}
                            onDownload={onDownloadFile}
                            onDelete={onDeleteItem}
                            onRename={onRenameItem}
                            onShare={onShareFolder}
                            onManageShares={onManageShares}
                            onContextMenu={(it, x, y, rect) => {
                              setSelectedItem(it);
                              setEmptyContextMenu(null);
                              setContextMenu({ item: it, x, y, triggerRect: rect });
                            }}
                            onMetadata={onMetadataItem}
                            onPublicShare={onPublicShareItem}
                            isActionsDisabled={isActionsDisabled}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Songs Listed Vertically Underneath Each Other (Spotify Table Style) */}
                <div>
                  <div className="flex items-center justify-between mb-2 px-1">
                    <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Music className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      Titel in dieser Playlist ({audioFiles.length})
                    </h4>
                    <span className="text-[11px] text-gray-400">Tippen oder Doppelklick zum Abspielen</span>
                  </div>

                  {/* Table Header */}
                  <div className="flex items-center justify-between px-3 py-2 text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-800 select-none">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="w-6 text-center">#</span>
                      <span>Titel</span>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <span className="w-16 text-right hidden sm:inline">Größe</span>
                      <span className="w-8"></span>
                    </div>
                  </div>

                  {/* Songs Rows */}
                  <div className="divide-y divide-gray-100 dark:divide-gray-800/60 mt-1">
                    {audioFiles.map((item, index) => {
                      const isCurrent =
                        currentTrack &&
                        (currentTrack.path || currentTrack.name) === (item.path || item.name);
                      const isCurrentPlaying = isCurrent && isPlaying;
                      const { cleanTitle, artistHint, ext } = parseAudioTitle(item.name);

                      return (
                        <div
                          key={item.name}
                          data-file-item="true"
                          onClick={() => setSelectedItem(item)}
                          onDoubleClick={() => onOpenFile(item)}
                          className={`group flex items-center justify-between px-3 py-2.5 rounded-xl transition-all select-none cursor-pointer ${
                            isCurrent
                              ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold ring-1 ring-blue-500/20'
                              : selectedItem?.name === item.name
                              ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 text-gray-800 dark:text-gray-200'
                          }`}
                        >
                          {/* Left: # Index or Sound wave, Cover Art, Title & Artist */}
                          <div
                            className="flex items-center gap-3 min-w-0 flex-1"
                            onClick={() => onOpenFile(item)}
                          >
                            <div className="w-6 flex items-center justify-center shrink-0">
                              {isCurrentPlaying ? (
                                <div className="flex items-end gap-0.5 h-3.5">
                                  <span className="w-0.5 bg-blue-600 dark:bg-blue-400 h-2 animate-bounce" />
                                  <span className="w-0.5 bg-blue-600 dark:bg-blue-400 h-3.5 animate-pulse" />
                                  <span className="w-0.5 bg-blue-600 dark:bg-blue-400 h-2.5 animate-bounce" />
                                </div>
                              ) : (
                                <>
                                  <span className="text-xs text-gray-400 group-hover:hidden font-mono">
                                    {index + 1}
                                  </span>
                                  <Play className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 hidden group-hover:block fill-blue-600" />
                                </>
                              )}
                            </div>

                            <AudioCoverArt
                              filePath={item.path || item.name}
                              currentUser={item.owner}
                              title={item.name}
                              className="w-9 h-9 rounded-lg shadow-2xs shrink-0"
                              iconClassName="w-4 h-4"
                            />

                            <div className="min-w-0 flex-1 pr-2">
                              <p className={`text-xs sm:text-sm font-semibold truncate ${
                                isCurrent ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'
                              }`}>
                                {cleanTitle}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-400">
                                <span className="uppercase text-[9px] font-bold px-1.5 py-0.2 rounded bg-gray-100 dark:bg-gray-800 text-gray-500">
                                  {ext}
                                </span>
                                <span className="truncate">
                                  {artistHint || (item.owner ? `@${item.owner}` : 'Audio')}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Right: File Size & 3-Dots Menu */}
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-xs text-gray-400 hidden sm:inline w-16 text-right font-mono">
                              {formatBytes(item.size)}
                            </span>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedItem(item);
                                const rect = e.currentTarget.getBoundingClientRect();
                                setContextMenu({
                                  item,
                                  x: rect.right,
                                  y: rect.bottom,
                                  triggerRect: rect,
                                });
                              }}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/60 dark:hover:bg-gray-700/60 transition-colors cursor-pointer"
                              title="Weitere Aktionen"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Non-Audio Files Section ("Wo die Musikdateien angezeigt werden, zeigt das auch andere Dateien im Ordner an, die eben nicht") */}
                {nonAudioFiles.length > 0 && (
                  <div className="pt-6 border-t border-gray-100 dark:border-gray-800">
                    <div className="mb-3">
                      <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Weitere Dateien im Ordner ({nonAudioFiles.length})
                      </h4>
                      <p className="text-[11px] text-gray-400">
                        Dateien in diesem Ordner, die keine Musikdateien sind (Bilder, Dokumente, Videos, etc.)
                      </p>
                    </div>

                    {viewMode === 'grid' ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {nonAudioFiles.map((item) => (
                          <div
                            key={item.name}
                            data-file-item="true"
                            onClick={() => setSelectedItem(item)}
                          >
                            <FileItem
                              item={item}
                              viewMode="grid"
                              isSelected={selectedItem?.name === item.name}
                              isCut={clipboard?.action === 'cut' && clipboard?.item.name === item.name}
                              onOpen={(it) => {
                                setSelectedItem(it);
                                onOpenFile(it);
                              }}
                              onDownload={onDownloadFile}
                              onDelete={onDeleteItem}
                              onRename={onRenameItem}
                              onContextMenu={(it, x, y, rect) => {
                                setSelectedItem(it);
                                setEmptyContextMenu(null);
                                setContextMenu({ item: it, x, y, triggerRect: rect });
                              }}
                              onMetadata={onMetadataItem}
                              onPublicShare={onPublicShareItem}
                              isActionsDisabled={isActionsDisabled}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {nonAudioFiles.map((item) => (
                          <div
                            key={item.name}
                            data-file-item="true"
                            onClick={() => setSelectedItem(item)}
                          >
                            <FileItem
                              item={item}
                              viewMode="list"
                              isSelected={selectedItem?.name === item.name}
                              isCut={clipboard?.action === 'cut' && clipboard?.item.name === item.name}
                              onOpen={(it) => {
                                setSelectedItem(it);
                                onOpenFile(it);
                              }}
                              onDownload={onDownloadFile}
                              onDelete={onDeleteItem}
                              onRename={onRenameItem}
                              onContextMenu={(it, x, y, rect) => {
                                setSelectedItem(it);
                                setEmptyContextMenu(null);
                                setContextMenu({ item: it, x, y, triggerRect: rect });
                              }}
                              onMetadata={onMetadataItem}
                              onPublicShare={onPublicShareItem}
                              isActionsDisabled={isActionsDisabled}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              // ================================================================
              // STANDARD VIEW (Normal Folders & Root/Start Page)
              // ================================================================
              <>
                {/* Folders Section */}
                {folders.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                      Ordner ({folders.length})
                    </h4>
                    {viewMode === 'grid' ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {folders.map((item) => (
                          <div
                            key={item.name}
                            data-file-item="true"
                            onClick={() => setSelectedItem(item)}
                          >
                            <FileItem
                              item={item}
                              viewMode="grid"
                              isSelected={selectedItem?.name === item.name}
                              isCut={clipboard?.action === 'cut' && clipboard?.item.name === item.name}
                              onOpen={handleSafeOpenFile}
                              onDownload={onDownloadFile}
                              onDelete={onDeleteItem}
                              onRename={onRenameItem}
                              onShare={onShareFolder}
                              onManageShares={onManageShares}
                              onContextMenu={(it, x, y, rect) => {
                                setSelectedItem(it);
                                setEmptyContextMenu(null);
                                setContextMenu({ item: it, x, y, triggerRect: rect });
                              }}
                              onMetadata={onMetadataItem}
                              onPublicShare={onPublicShareItem}
                              isActionsDisabled={isActionsDisabled}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {folders.map((item) => (
                          <div
                            key={item.name}
                            data-file-item="true"
                            onClick={() => setSelectedItem(item)}
                          >
                            <FileItem
                              item={item}
                              viewMode="list"
                              isSelected={selectedItem?.name === item.name}
                              isCut={clipboard?.action === 'cut' && clipboard?.item.name === item.name}
                              onOpen={handleSafeOpenFile}
                              onDownload={onDownloadFile}
                              onDelete={onDeleteItem}
                              onRename={onRenameItem}
                              onShare={onShareFolder}
                              onManageShares={onManageShares}
                              onContextMenu={(it, x, y, rect) => {
                                setSelectedItem(it);
                                setEmptyContextMenu(null);
                                setContextMenu({ item: it, x, y, triggerRect: rect });
                              }}
                              onMetadata={onMetadataItem}
                              onPublicShare={onPublicShareItem}
                              isActionsDisabled={isActionsDisabled}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Files Section */}
                {files.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                      Dateien ({files.length})
                    </h4>

                    {viewMode === 'grid' ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {files.map((item) => (
                          <div
                            key={item.name}
                            data-file-item="true"
                            onClick={() => setSelectedItem(item)}
                          >
                            <FileItem
                              item={item}
                              viewMode="grid"
                              isSelected={selectedItem?.name === item.name}
                              isCut={clipboard?.action === 'cut' && clipboard?.item.name === item.name}
                              onOpen={(it) => {
                                setSelectedItem(it);
                                onOpenFile(it);
                              }}
                              onDownload={onDownloadFile}
                              onDelete={onDeleteItem}
                              onRename={onRenameItem}
                              onContextMenu={(it, x, y, rect) => {
                                setSelectedItem(it);
                                setEmptyContextMenu(null);
                                setContextMenu({ item: it, x, y, triggerRect: rect });
                              }}
                              onMetadata={onMetadataItem}
                              onPublicShare={onPublicShareItem}
                              isActionsDisabled={isActionsDisabled}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between px-3.5 py-1.5 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-800">
                          <span>Name</span>
                          <div className="hidden sm:flex items-center gap-6">
                            <span className="w-20 text-right">Größe</span>
                            <span className="w-24 text-right">Geändert</span>
                          </div>
                          <span className="w-6"></span>
                        </div>

                        {files.map((item) => (
                          <div
                            key={item.name}
                            data-file-item="true"
                            onClick={() => setSelectedItem(item)}
                          >
                            <FileItem
                              item={item}
                              viewMode="list"
                              isSelected={selectedItem?.name === item.name}
                              isCut={clipboard?.action === 'cut' && clipboard?.item.name === item.name}
                              onOpen={(it) => {
                                setSelectedItem(it);
                                onOpenFile(it);
                              }}
                              onDownload={onDownloadFile}
                              onDelete={onDeleteItem}
                              onRename={onRenameItem}
                              onContextMenu={(it, x, y, rect) => {
                                setSelectedItem(it);
                                setEmptyContextMenu(null);
                                setContextMenu({ item: it, x, y, triggerRect: rect });
                              }}
                              onMetadata={onMetadataItem}
                              onPublicShare={onPublicShareItem}
                              isActionsDisabled={isActionsDisabled}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Custom Context Menu for Items */}
      <ContextMenu
        position={contextMenu}
        onClose={() => setContextMenu(null)}
        onOpen={(it) => handleSafeOpenFile(it)}
        onOpenInNewTab={onOpenInNewTab}
        onDownload={(it) => onDownloadFile(it)}
        onRename={(it) => onRenameItem?.(it)}
        onMetadata={(it) => onMetadataItem?.(it)}
        onPublicShare={(it) => onPublicShareItem?.(it)}
        onDelete={(it) => onDeleteItem(it)}
        onCopy={(it) => onCopyItem?.(it)}
        onCut={(it) => onCutItem?.(it)}
        onShare={(it) => onShareFolder?.(it)}
        onManageShares={(it) => onManageShares?.(it)}
        onPlayFolderAsPlaylist={onPlayFolderAsPlaylist}
        onPasteIntoFolder={(targetFolder) => {
          if (onPaste) {
            const nextSub = currentPath ? `${currentPath}/${targetFolder.name}` : targetFolder.name;
            onPaste(nextSub);
          }
        }}
        canPasteIntoFolder={Boolean(clipboard && onPaste && !isActionsDisabled)}
        clipboardAction={clipboard?.action}
        clipboardItemName={clipboard?.item.name}
        isActionsDisabled={isActionsDisabled}
      />

      {/* Empty Area Context Menu */}
      <EmptyAreaContextMenu
        position={emptyContextMenu}
        onClose={() => setEmptyContextMenu(null)}
        onPaste={() => onPaste?.()}
        canPaste={Boolean(clipboard)}
        clipboardItemName={clipboard?.item.name}
        clipboardAction={clipboard?.action}
        onNewFolder={onNewFolder}
        onUploadClick={() => onUploadClick ? onUploadClick() : undefined}
        onRefresh={onRefresh}
        isActionsDisabled={isActionsDisabled}
      />
    </div>
  );
};
