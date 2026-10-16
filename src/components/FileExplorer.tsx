import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  UploadCloud,
  FolderPlus,
  RefreshCw,
  FolderOpen,
  ArrowUp,
  AlertCircle,
} from 'lucide-react';
import type { FileItemData, ViewMode } from '../types';
import { Breadcrumbs } from './Breadcrumbs';
import { FileItem } from './FileItem';
import { ContextMenu, EmptyAreaContextMenu, type ContextMenuPosition } from './ContextMenu';

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

  // Filter items by search
  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const folders = filteredItems.filter((i) => i.type === 'folder');
  const files = filteredItems.filter((i) => i.type === 'file');

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
