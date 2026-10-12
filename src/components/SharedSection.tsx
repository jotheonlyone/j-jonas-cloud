import React, { useState } from 'react';
import {
  Users,
  Check,
  X,
  Folder,
  ArrowRight,
  Share2,
  Clock,
  UserCheck
} from 'lucide-react';
import type { FolderShare, UserAccount, ViewMode, FileItemData } from '../types';
import { FileExplorer } from './FileExplorer';
import {
  listFiles,
  uploadFile,
  createFolder,
  triggerDirectDownload,
  deleteItem,
  renameItem,
  getStorageUsage
} from '../services/storageApi';
import { useToast } from './Toast';

interface SharedSectionProps {
  user: UserAccount;
  shares: FolderShare[];
  onAcceptShare: (shareId: string) => void;
  onDeclineShare: (shareId: string) => void;
  onRefreshShares: () => void;
  viewMode: ViewMode;
  maintenanceMode: boolean;
  onOpenNewSharedModal: () => void;
  onManageFolderShares?: (folderPath: string, folderName: string) => void;
  onOpenFilePreview?: (item: FileItemData, allItems: FileItemData[]) => void;
}

export const SharedSection: React.FC<SharedSectionProps> = ({
  user,
  shares,
  onAcceptShare,
  onDeclineShare,
  onRefreshShares,
  viewMode,
  maintenanceMode,
  onOpenNewSharedModal,
  onManageFolderShares,
  onOpenFilePreview,
}) => {
  const { addToast } = useToast();
  const [activeFolderShare, setActiveFolderShare] = useState<FolderShare | null>(null);
  const [sharedSubPath, setSharedSubPath] = useState('');
  const [folderItems, setFolderItems] = useState<FileItemData[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [serverError, setServerError] = useState<string | undefined>();

  // Split into pending invitations and accepted shares
  const pendingInvitations = shares.filter(
    (s) => s.invited_user.toLowerCase() === user.username.toLowerCase() && s.status === 'pending'
  );

  const acceptedShares = shares.filter(
    (s) => (s.invited_user.toLowerCase() === user.username.toLowerCase() && s.status === 'accepted') ||
           (s.owner.toLowerCase() === user.username.toLowerCase() && s.status === 'accepted')
  );

  const loadSharedFolderItems = async (share: FolderShare, subPath = '') => {
    setIsLoadingItems(true);
    setServerError(undefined);
    try {
      const fullPath = subPath ? `${share.folder_path}/${subPath}` : share.folder_path;
      const res = await listFiles(share.owner, fullPath);
      setFolderItems(res.items);
      if (res.error) {
        setServerError(res.error);
      }
    } catch (err) {
      addToast('error', 'Fehler beim Laden', 'Geteilter Ordner konnte nicht geöffnet werden.');
    } finally {
      setIsLoadingItems(false);
    }
  };

  const handleOpenSharedFolder = (share: FolderShare) => {
    setActiveFolderShare(share);
    setSharedSubPath('');
    loadSharedFolderItems(share, '');
  };

  const handleNavigateSubPath = (newPath: string) => {
    if (!activeFolderShare) return;
    setSharedSubPath(newPath);
    loadSharedFolderItems(activeFolderShare, newPath);
  };

  const handleUploadToShared = async (files: FileList) => {
    if (!activeFolderShare) return;
    try {
      const ownerUsage = await getStorageUsage(activeFolderShare.owner);
      const ownerQuotaGb = 100;

      const currentDir = sharedSubPath
        ? `${activeFolderShare.folder_path}/${sharedSubPath}`
        : activeFolderShare.folder_path;

      let count = 0;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const res = await uploadFile(file, activeFolderShare.owner, currentDir, ownerUsage.used_bytes, ownerQuotaGb);
        if (!res.success) {
          addToast('error', 'Upload fehlgeschlagen', res.error);
          break;
        }
        count++;
      }
      if (count > 0) {
        addToast('success', 'Hochgeladen', `${count} Datei(en) in den geteilten Ordner geladen.`);
        loadSharedFolderItems(activeFolderShare, sharedSubPath);
      }
    } catch (err) {
      addToast('error', 'Fehler beim Upload');
    }
  };

  const handleCreateSubFolder = async () => {
    if (!activeFolderShare) return;
    const name = window.prompt('Neuer Unterordner-Name:');
    if (!name || !name.trim()) return;
    const currentDir = sharedSubPath
      ? `${activeFolderShare.folder_path}/${sharedSubPath}`
      : activeFolderShare.folder_path;
    const res = await createFolder(activeFolderShare.owner, currentDir, name.trim());
    if (res.success) {
      addToast('success', 'Ordner erstellt');
      loadSharedFolderItems(activeFolderShare, sharedSubPath);
    } else {
      addToast('error', 'Fehler', res.error);
    }
  };

  const handleDeleteItem = async (item: FileItemData) => {
    if (!activeFolderShare) return;
    if (!window.confirm(`Möchtest du "${item.name}" wirklich löschen?`)) return;
    const currentDir = sharedSubPath
      ? `${activeFolderShare.folder_path}/${sharedSubPath}`
      : activeFolderShare.folder_path;
    const res = await deleteItem(activeFolderShare.owner, currentDir, item.name);
    if (res.success) {
      addToast('success', 'Gelöscht', `"${item.name}" wurde entfernt.`);
      loadSharedFolderItems(activeFolderShare, sharedSubPath);
    } else {
      addToast('error', 'Fehler', res.error);
    }
  };

  const handleDownloadItem = async (item: FileItemData) => {
    if (!activeFolderShare) return;
    const currentDir = sharedSubPath
      ? `${activeFolderShare.folder_path}/${sharedSubPath}`
      : activeFolderShare.folder_path;
    const fullItemPath = currentDir ? `${currentDir}/${item.name}` : item.name;
    triggerDirectDownload(activeFolderShare.owner, fullItemPath, item.name);
  };

  const handleRenameItem = async (item: FileItemData) => {
    if (!activeFolderShare) return;
    const newName = window.prompt(`Neuer Name für "${item.name}":`, item.name);
    if (!newName || newName.trim() === item.name) return;
    const currentDir = sharedSubPath
      ? `${activeFolderShare.folder_path}/${sharedSubPath}`
      : activeFolderShare.folder_path;
    const res = await renameItem(activeFolderShare.owner, currentDir, item.name, newName.trim());
    if (res.success) {
      addToast('success', 'Umbenannt', `"${item.name}" wurde zu "${newName.trim()}" umbenannt.`);
      loadSharedFolderItems(activeFolderShare, sharedSubPath);
    } else {
      addToast('error', 'Fehler beim Umbenennen', res.error);
    }
  };

  if (activeFolderShare) {
    return (
      <div className="h-full flex flex-col bg-white dark:bg-gray-900 rounded-2xl shadow-xs border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="bg-[#f0f4f9] dark:bg-gray-800 px-6 py-2.5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-800 dark:text-gray-200">
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>
              Geteilter Ordner <strong>"{activeFolderShare.folder_name}"</strong> (Besitzer:{' '}
              <span className="font-semibold">{activeFolderShare.owner}</span>)
            </span>
          </div>

          <button
            onClick={() => setActiveFolderShare(null)}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            ← Zurück zur Übersicht
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          <FileExplorer
            currentPath={sharedSubPath}
            onNavigatePath={handleNavigateSubPath}
            items={folderItems}
            isLoading={isLoadingItems}
            serverError={serverError}
            viewMode={viewMode}
            onRefresh={() => loadSharedFolderItems(activeFolderShare, sharedSubPath)}
            onUploadFiles={handleUploadToShared}
            onNewFolder={handleCreateSubFolder}
            onOpenFile={(item) => {
              if (item.type === 'folder') {
                const next = sharedSubPath ? `${sharedSubPath}/${item.name}` : item.name;
                handleNavigateSubPath(next);
              } else if (onOpenFilePreview) {
                onOpenFilePreview(item, folderItems);
              } else {
                handleDownloadItem(item);
              }
            }}
            onDownloadFile={handleDownloadItem}
            onDeleteItem={handleDeleteItem}
            onRenameItem={handleRenameItem}
            onManageShares={(item) => {
              if (onManageFolderShares && activeFolderShare) {
                const itemFullPath = sharedSubPath ? `${activeFolderShare.folder_path}/${sharedSubPath}/${item.name}` : `${activeFolderShare.folder_path}/${item.name}`;
                onManageFolderShares(itemFullPath, item.name);
              }
            }}
            rootLabel={activeFolderShare.folder_name}
            isSharedContext={true}
            isActionsDisabled={maintenanceMode && user.role !== 'master'}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-xs border border-gray-200 dark:border-gray-800 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-gray-800">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">
            Geteilter Bereich
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Ordner, die für dich freigegeben wurden oder die du mit anderen teilst.
          </p>
        </div>

        <button
          onClick={onOpenNewSharedModal}
          disabled={maintenanceMode && user.role !== 'master'}
          className="flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors disabled:opacity-50"
        >
          <Share2 className="w-4 h-4" />
          <span>Neuen Ordner teilen</span>
        </button>
      </div>

      {/* Ausstehende Einladungen */}
      {pendingInvitations.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">
              Ausstehende Einladungen ({pendingInvitations.length})
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingInvitations.map((share) => (
              <div
                key={share.id}
                className="p-4 rounded-2xl bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-900/60 shadow-xs flex flex-col justify-between gap-4"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shrink-0">
                    <Folder className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                      {share.folder_name}
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                      Benutzer <span className="font-semibold text-blue-600 dark:text-blue-400">@{share.owner}</span>{' '}
                      möchte diesen Ordner mit dir teilen.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <button
                    onClick={() => onDeclineShare(share.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <X className="w-3.5 h-3.5 text-red-500" />
                    <span>Ablehnen</span>
                  </button>
                  <button
                    onClick={() => onAcceptShare(share.id)}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Annehmen</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Aktive geteilte Ordner */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">
          Geteilte Ordner ({acceptedShares.length})
        </h3>

        {acceptedShares.length === 0 ? (
          <div className="p-12 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 text-center select-none">
            <Users className="w-10 h-10 text-gray-400 mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Noch keine geteilten Ordner
            </h4>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              Sobald jemand einen Ordner mit dir teilt oder du einen deiner Ordner freigibst, findest du ihn hier.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {acceptedShares.map((share) => {
              const isOwner = share.owner.toLowerCase() === user.username.toLowerCase();
              return (
                <div
                  key={share.id}
                  onClick={() => handleOpenSharedFolder(share)}
                  className="group p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200/80 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all cursor-pointer select-none"
                >
                  <div className="flex items-start justify-between">
                    <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-500 group-hover:scale-105 transition-transform">
                      <Folder className="w-6 h-6 fill-amber-500/20" />
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      {isOwner ? 'Von mir' : `@${share.owner}`}
                    </span>
                  </div>

                  <div className="mt-3">
                    <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      {share.folder_name}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                      {isOwner ? `Geteilt mit @${share.invited_user}` : `Geteilt von @${share.owner}`}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs font-semibold">
                    <span className="text-blue-600 dark:text-blue-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                      Ordner öffnen
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>

                    {isOwner && onManageFolderShares && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onManageFolderShares(share.folder_path, share.folder_name);
                        }}
                        className="px-2 py-1 rounded-lg text-[11px] text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors"
                        title="Mitglieder und Freigaben verwalten"
                      >
                        Freigaben verwalten
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
