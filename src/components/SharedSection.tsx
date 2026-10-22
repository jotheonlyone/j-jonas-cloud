import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { getConcreteSharedFolderPath, resolveSharedSubPath } from '../utils/pathResolver';
import {
  Users,
  Check,
  X,
  Folder,
  ArrowRight,
  Share2,
  Clock,
  UserCheck,
  ShieldCheck,
  Eye,
  MoreVertical,
  Edit2,
  Trash2,
  FolderOpen,
  LogOut,
  AlertTriangle,
  Clipboard,
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
  getStorageUsage,
  CHUNK_SIZE
} from '../services/storageApi';
import type { UploadTaskState } from './UploadProgressWidget';
import {
  deleteFolderShare,
  deleteFolderShareMember,
  leaveSharedFolder,
  renameSharedFolder,
  getSharedFolder,
  isValidFolderShareDoc,
  getShareStatusForUser,
  cleanUsername
} from '../services/firebase';
import { useToast } from './Toast';
import { hasFolderWritePermission } from '../utils/permissions';

interface SharedSectionProps {
  user: UserAccount;
  shares: FolderShare[];
  onAcceptShare: (shareId: string) => void;
  onDeclineShare: (shareId: string) => void;
  onRefreshShares: () => void;
  viewMode: ViewMode;
  maintenanceMode: boolean;
  onOpenNewSharedModal: () => void;
  onManageFolderShares?: (folderPath: string, folderName: string, folderOwner?: string) => void;
  onOpenFilePreview?: (item: FileItemData, allItems: FileItemData[]) => void;
  onUploadTaskChange?: (updater: UploadTaskState | null | ((prev: UploadTaskState | null) => UploadTaskState | null)) => void;
  clipboard?: { action: 'copy' | 'cut'; item: FileItemData; sourcePath: string; sourceOwner?: string } | null;
  onCopyItem?: (item: FileItemData) => void;
  onCutItem?: (item: FileItemData) => void;
  onPaste?: (targetShare?: FolderShare, subPath?: string) => Promise<void>;
  onTriggerFileInput?: () => void;
  onPlayFolderAsPlaylist?: (folder: FileItemData) => void;
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
  onUploadTaskChange,
  clipboard = null,
  onCopyItem,
  onCutItem,
  onPaste,
  onTriggerFileInput,
  onPlayFolderAsPlaylist,
}) => {
  const { addToast } = useToast();
  const [activeFolderShare, setActiveFolderShare] = useState<FolderShare | null>(null);
  const [sharedSubPath, setSharedSubPath] = useState('');
  const [folderItems, setFolderItems] = useState<FileItemData[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [serverError, setServerError] = useState<string | undefined>();

  // 1. Ausstehende Einladungen: Ordner, bei denen der Nutzer in accepted_by oder shared_with auf 'pending' steht
  // Bereich isolieren: Ignoriere Dokumente, die keinen gültigen folder_name oder keine shared_users besitzen
  const pendingInvitations = useMemo(() => {
    const userNorm = cleanUsername(user?.username || '');
    if (!userNorm) return [];
    return shares.filter((s) => {
      if (!s || !isValidFolderShareDoc(s)) return false;
      // Besitzer sieht keine ausstehenden Einladungen für seine eigenen Ordner
      if (cleanUsername(s.owner || '') === userNorm) return false;

      // Wurde der Nutzer eingeladen?
      const isInvited = (Array.isArray(s.shared_with) && s.shared_with.some(m => m?.username && cleanUsername(m.username) === userNorm))
        || (s.invited_user && cleanUsername(s.invited_user) === userNorm);
      if (!isInvited) return false;

      // Status ermitteln: Zuerst accepted_by?.[user], dann Fallback shared_with / status
      const userStatus = getShareStatusForUser(s, userNorm);
      return userStatus === 'pending';
    });
  }, [shares, user?.username]);

  // 2. Aktive geteilte Ordner:
  // - Bereich isolieren: Ignoriere Dokumente, die keinen gültigen folder_name oder keine shared_users besitzen
  // - Jeder Ordner existiert GENAU EINMAL (keine doppelten Ordner mehr für verschiedene Personen)
  // - Besitzer sieht alle seine geteilten Ordner
  // - Eingeladene Personen sehen den Ordner, sobald ihr Status 'accepted' oder 'active' ist
  const acceptedShares = useMemo(() => {
    const userNorm = cleanUsername(user?.username || '');
    if (!userNorm) return [];
    const list = shares.filter((s) => {
      if (!s || !isValidFolderShareDoc(s)) return false;
      const isOwner = cleanUsername(s.owner || '') === userNorm;
      if (isOwner) return true;

      // Eingeladener Nutzer prüfen:
      const isInvited = (Array.isArray(s.shared_with) && s.shared_with.some(m => m?.username && cleanUsername(m.username) === userNorm))
        || (s.invited_user && cleanUsername(s.invited_user) === userNorm);
      if (!isInvited) return false;

      // Status ermitteln: Zuerst accepted_by?.[user], dann Fallback shared_with / status
      const userStatus = getShareStatusForUser(s, userNorm);
      return userStatus === 'accepted' || userStatus === 'active';
    });

    const uniqueMap = new Map<string, FolderShare>();
    list.forEach((s) => {
      const key = `${cleanUsername(s.owner || '')}::${s.folder_path || ''}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, s);
      }
    });
    return Array.from(uniqueMap.values());
  }, [shares, user?.username]);

  const loadSharedFolderItems = async (share: FolderShare, subPath = '') => {
    setIsLoadingItems(true);
    setServerError(undefined);
    try {
      const fullPath = getConcreteSharedFolderPath(share.folder_path, share.folder_name, subPath);
      if (!fullPath || fullPath === '.') {
        setServerError('Ungültiger Ordnerpfad für geteilten Ordner.');
        setFolderItems([]);
        return;
      }
      const res = await listFiles(share.owner, fullPath);
      const itemsWithOwner = (res.items || []).map((it) => ({
        ...it,
        owner: share.owner,
        path: it.path || (fullPath ? `${fullPath}/${it.name}` : it.name),
      }));
      setFolderItems(itemsWithOwner);
      if (res.error) {
        setServerError(res.error);
      }
    } catch (err) {
      addToast('error', 'Fehler beim Laden', 'Geteilter Ordner konnte nicht geöffnet werden.');
    } finally {
      setIsLoadingItems(false);
    }
  };

  const handleOpenSharedFolder = async (share: FolderShare) => {
    setActiveFolderShare(share);
    setSharedSubPath('');
    loadSharedFolderItems(share, '');
    // Asynchronously fetch fresh share document to ensure permissions & member statuses are up to date
    try {
      const fresh = await getSharedFolder(share.folder_path, share.owner);
      if (fresh) {
        setActiveFolderShare(fresh);
      }
    } catch {}
  };

  const isNavigatingSharedRef = useRef(false);
  const lastSharedFolderClickRef = useRef<{ id: string; time: number } | null>(null);

  useEffect(() => {
    if (!isLoadingItems) {
      isNavigatingSharedRef.current = false;
    }
  }, [isLoadingItems]);

  const handleNavigateSubPath = (newPath: string) => {
    if (!activeFolderShare) return;
    setSharedSubPath(newPath);
    loadSharedFolderItems(activeFolderShare, newPath);
  };

  const handleUploadToShared = async (files: FileList) => {
    if (!activeFolderShare) return;
    try {
      const ownerUsage = await getStorageUsage(activeFolderShare.owner);
      const ownerQuotaGb = 1000;

      const currentDir = getConcreteSharedFolderPath(
        activeFolderShare.folder_path,
        activeFolderShare.folder_name,
        sharedSubPath
      );

      let count = 0;
      const totalFiles = files.length;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const initialTotalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
        onUploadTaskChange?.({
          id: `shared_${Date.now()}_${i}`,
          fileName: file.name,
          fileSize: file.size,
          currentChunk: 0,
          totalChunks: initialTotalChunks,
          progressPercent: 0,
          uploadedBytes: 0,
          status: 'uploading',
          fileIndex: i + 1,
          totalFiles,
        });

        const res = await uploadFile(
          file,
          activeFolderShare.owner,
          currentDir,
          ownerUsage.used_bytes,
          ownerQuotaGb,
          (info) => {
            onUploadTaskChange?.((prev) =>
              prev
                ? {
                    ...prev,
                    currentChunk: info.currentChunk,
                    totalChunks: info.totalChunks,
                    progressPercent: info.progressPercent,
                    uploadedBytes: info.uploadedBytes,
                  }
                : null
            );
          }
        );

        if (!res.success) {
          onUploadTaskChange?.((prev) =>
            prev
              ? {
                  ...prev,
                  status: 'error',
                  errorMessage: res.error,
                }
              : null
          );
          addToast('error', 'Upload fehlgeschlagen', res.error);
          break;
        }
        count++;
      }
      if (count === totalFiles && totalFiles > 0) {
        onUploadTaskChange?.((prev) =>
          prev
            ? {
                ...prev,
                status: 'completed',
                progressPercent: 100,
              }
            : null
        );
        setTimeout(() => {
          onUploadTaskChange?.((prev) => (prev?.status === 'completed' ? null : prev));
        }, 4000);
        addToast('success', 'Hochgeladen', `${count} Datei(en) in den geteilten Ordner geladen.`);
        loadSharedFolderItems(activeFolderShare, sharedSubPath);
      } else if (count > 0) {
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
    const currentDir = getConcreteSharedFolderPath(
      activeFolderShare.folder_path,
      activeFolderShare.folder_name,
      sharedSubPath
    );
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
    const currentDir = getConcreteSharedFolderPath(
      activeFolderShare.folder_path,
      activeFolderShare.folder_name,
      sharedSubPath
    );
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
    const currentDir = getConcreteSharedFolderPath(
      activeFolderShare.folder_path,
      activeFolderShare.folder_name,
      sharedSubPath
    );
    const fullItemPath = currentDir ? `${currentDir}/${item.name}` : item.name;
    triggerDirectDownload(activeFolderShare.owner, fullItemPath, item.name);
  };

  const handleRenameItem = async (item: FileItemData) => {
    if (!activeFolderShare) return;
    const newName = window.prompt(`Neuer Name für "${item.name}":`, item.name);
    if (!newName || newName.trim() === item.name) return;
    const currentDir = getConcreteSharedFolderPath(
      activeFolderShare.folder_path,
      activeFolderShare.folder_name,
      sharedSubPath
    );
    const res = await renameItem(activeFolderShare.owner, currentDir, item.name, newName.trim());
    if (res.success) {
      addToast('success', 'Umbenannt', `"${item.name}" wurde zu "${newName.trim()}" umbenannt.`);
      loadSharedFolderItems(activeFolderShare, sharedSubPath);
    } else {
      addToast('error', 'Fehler beim Umbenennen', res.error);
    }
  };

  // State für Kontextmenü (Rechtsklick) bei geteilten Ordnern
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    share: FolderShare;
  } | null>(null);

  // Schließe Kontextmenü bei Klick, Scroll oder Escape
  useEffect(() => {
    if (!contextMenu) return;
    const handleClose = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    window.addEventListener('click', handleClose);
    window.addEventListener('scroll', handleClose, true);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('scroll', handleClose, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu]);

  // State für "Ordner verlassen & entfernen" Bestätigungsmodal (Member)
  const [leaveConfirmShare, setLeaveConfirmShare] = useState<FolderShare | null>(null);
  const [isLeavingShare, setIsLeavingShare] = useState(false);

  // State für "Freigabe beenden / Ordner löschen" Bestätigungsmodal (Owner)
  const [deleteConfirmShare, setDeleteConfirmShare] = useState<FolderShare | null>(null);
  const [deleteFilesOnDisk, setDeleteFilesOnDisk] = useState(false);
  const [isDeletingShare, setIsDeletingShare] = useState(false);

  // Öffnet je nach Rolle das passende Bestätigungs-Modal
  const handleDeleteSharedFolder = (share: FolderShare) => {
    const isOwner = share.owner.toLowerCase() === user.username.toLowerCase();
    if (isOwner) {
      setDeleteFilesOnDisk(false);
      setDeleteConfirmShare(share);
    } else {
      setLeaveConfirmShare(share);
    }
  };

  // Bestätigtes Verlassen des geteilten Ordners (Member)
  const handleConfirmLeaveShare = async () => {
    if (!leaveConfirmShare) return;
    const share = leaveConfirmShare;
    setIsLeavingShare(true);
    try {
      const res = await leaveSharedFolder(
        share.id,
        share.folder_path,
        share.owner,
        user.username
      );

      if (res) {
        addToast(
          'success',
          'Ordner verlassen',
          `Der geteilte Ordner "${share.folder_name}" wurde erfolgreich aus deiner Ablage entfernt.`
        );
      } else {
        addToast(
          'error',
          'Fehler beim Verlassen',
          'Der geteilte Ordner konnte nicht entfernt werden.'
        );
      }

      if (activeFolderShare?.id === share.id) {
        setActiveFolderShare(null);
      }
      setLeaveConfirmShare(null);
      onRefreshShares();
    } catch (err: any) {
      addToast('error', 'Fehler', err?.message || 'Ablage konnte nicht entfernt werden.');
    } finally {
      setIsLeavingShare(false);
    }
  };

  // Bestätigtes Beenden der Freigabe / Löschen (Owner)
  const handleConfirmDeleteShare = async () => {
    if (!deleteConfirmShare) return;
    const share = deleteConfirmShare;
    setIsDeletingShare(true);
    try {
      await deleteFolderShare(share.id);
      if (deleteFilesOnDisk) {
        try {
          await deleteItem(share.owner, '', share.folder_name);
        } catch (itemErr) {
          console.warn('Physical delete on disk skipped/failed (offline):', itemErr);
        }
      }
      addToast('success', 'Gelöscht', `Geteilter Ordner "${share.folder_name}" wurde entfernt.`);
      if (activeFolderShare?.id === share.id) {
        setActiveFolderShare(null);
      }
      setDeleteConfirmShare(null);
      setDeleteFilesOnDisk(false);
      onRefreshShares();
    } catch (err: any) {
      addToast('error', 'Fehler', err?.message || 'Fehler beim Löschen des Ordners.');
    } finally {
      setIsDeletingShare(false);
    }
  };

  // Geteilten Ordner umbenennen
  const handleRenameSharedFolder = async (share: FolderShare) => {
    const newName = window.prompt(`Neuer Name für geteilten Ordner "${share.folder_name}":`, share.folder_name);
    if (!newName || !newName.trim() || newName.trim() === share.folder_name) return;

    const trimmed = newName.trim();
    const isOwner = (share.owner?.toLowerCase() || '') === (user.username || '').toLowerCase();
    if (isOwner) {
      await renameItem(share.owner, '', share.folder_name, trimmed).catch(() => {});
      await renameSharedFolder(share.id, trimmed, trimmed);
    } else {
      await renameSharedFolder(share.id, trimmed);
    }

    addToast('success', 'Umbenannt', `Ordner wurde in "${trimmed}" umbenannt.`);
    if (activeFolderShare?.id === share.id) {
      setActiveFolderShare((prev) => (prev ? { ...prev, folder_name: trimmed } : null));
    }
    onRefreshShares();
  };

  const openFolderContextMenu = (e: React.MouseEvent, share: FolderShare) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      share,
    });
  };

  // 3. Wenn ein geteilter Ordner geöffnet ist:
  // Überprüfe Berechtigungen des aktuellen Benutzers für diesen Ordner
  if (activeFolderShare) {
    const userNorm = (user.username || '').toLowerCase();
    const activeIsOwner = (activeFolderShare.owner?.toLowerCase() || '') === userNorm;
    const activeCurrentMember = activeFolderShare.shared_with?.find(
      (m) => m?.username && m.username.toLowerCase() === userNorm
    );
    const activeCanSeeMembers = activeIsOwner || (activeCurrentMember?.can_see_members ?? false);
    const activeCanManageMembers = activeIsOwner || (activeCurrentMember?.can_manage_members ?? false);
    const activeCanWrite = activeIsOwner || hasFolderWritePermission(activeFolderShare, user.username);

    return (
      <div className="h-full flex flex-col bg-white dark:bg-gray-900 rounded-2xl shadow-xs border border-gray-200 dark:border-gray-800 overflow-hidden">
        {/* Header des geöffneten geteilten Ordners */}
        <div className="bg-[#f0f4f9] dark:bg-gray-800 px-4 sm:px-6 py-2.5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-gray-800 dark:text-gray-200 min-w-0">
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="truncate">
              Geteilter Ordner <strong>"{activeFolderShare.folder_name}"</strong> (Besitzer:{' '}
              <span className="font-semibold">@{activeFolderShare.owner}</span>)
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* PRÜFUNG can_see_members: Zeige den Button für "Mitglieder anzeigen / verwalten" nur, wenn dieses Recht True ist (oder Nutzer der Owner ist) */}
            {activeCanSeeMembers && onManageFolderShares && (
              <button
                type="button"
                onClick={() => {
                  const concretePath = getConcreteSharedFolderPath(
                    activeFolderShare.folder_path,
                    activeFolderShare.folder_name
                  );
                  onManageFolderShares(
                    concretePath,
                    activeFolderShare.folder_name,
                    activeFolderShare.owner
                  );
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 shadow-2xs transition-colors cursor-pointer"
                title={
                  activeCanManageMembers
                    ? 'Personen hinzufügen/entfernen & Rechte verwalten'
                    : 'Mitgliederliste dieses Ordners ansehen'
                }
              >
                <Users className="w-3.5 h-3.5 text-blue-500" />
                <span>
                  {activeCanManageMembers ? 'Freigaben & Rechte' : 'Mitglieder'}
                  {activeFolderShare.shared_with ? ` (${activeFolderShare.shared_with.length + 1})` : ''}
                </span>
              </button>
            )}

            <button
              onClick={() => setActiveFolderShare(null)}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              ← Zurück zur Übersicht
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <FileExplorer
            currentPath={sharedSubPath}
            onNavigatePath={handleNavigateSubPath}
            items={folderItems}
            isLoading={isLoadingItems}
            serverError={serverError}
            viewMode={viewMode}
            onRefresh={async () => {
              loadSharedFolderItems(activeFolderShare, sharedSubPath);
              try {
                const fresh = await getSharedFolder(activeFolderShare.folder_path, activeFolderShare.owner);
                if (fresh) {
                  setActiveFolderShare(fresh);
                }
              } catch {}
            }}
            onUploadFiles={handleUploadToShared}
            onNewFolder={handleCreateSubFolder}
            onOpenFile={(item) => {
              if (item.type === 'folder') {
                const now = Date.now();
                const folderKey = item.id || item.path || item.name;

                if (isLoadingItems || isNavigatingSharedRef.current) {
                  return;
                }

                if (
                  lastSharedFolderClickRef.current &&
                  lastSharedFolderClickRef.current.id === folderKey &&
                  now - lastSharedFolderClickRef.current.time < 350
                ) {
                  return;
                }

                const next = resolveSharedSubPath(
                  activeFolderShare.folder_path,
                  activeFolderShare.folder_name,
                  sharedSubPath,
                  item
                );
                if (next === sharedSubPath) {
                  return;
                }

                lastSharedFolderClickRef.current = { id: folderKey, time: now };
                isNavigatingSharedRef.current = true;
                setTimeout(() => {
                  isNavigatingSharedRef.current = false;
                }, 400);

                handleNavigateSubPath(next);
              } else if (onOpenFilePreview) {
                const currentDir = getConcreteSharedFolderPath(
                  activeFolderShare.folder_path,
                  activeFolderShare.folder_name,
                  sharedSubPath
                );
                const fullItemPath = item.path || (currentDir ? `${currentDir}/${item.name}` : item.name);
                const itemWithOwner: FileItemData = {
                  ...item,
                  owner: activeFolderShare.owner,
                  path: fullItemPath,
                };
                onOpenFilePreview(
                  itemWithOwner,
                  folderItems.map((fi) => ({
                    ...fi,
                    owner: activeFolderShare.owner,
                    path: fi.path || (currentDir ? `${currentDir}/${fi.name}` : fi.name),
                  }))
                );
              } else {
                handleDownloadItem(item);
              }
            }}
            onOpenInNewTab={(item) => {
              const currentDir = getConcreteSharedFolderPath(
                activeFolderShare.folder_path,
                activeFolderShare.folder_name,
                sharedSubPath
              );
              const fullPath = `${currentDir}/${item.name}`;
              const tempSessionId = `s_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
              const searchParams = new URLSearchParams({
                path: fullPath,
                name: item.name,
                session_ref: tempSessionId,
                owner: activeFolderShare.owner,
              });
              window.open(`/view?${searchParams.toString()}`, '_blank');
            }}
            onDownloadFile={handleDownloadItem}
            onDeleteItem={handleDeleteItem}
            onRenameItem={handleRenameItem}
            onManageShares={
              activeCanManageMembers && onManageFolderShares
                ? (item) => {
                    const currentDir = getConcreteSharedFolderPath(
                      activeFolderShare.folder_path,
                      activeFolderShare.folder_name,
                      sharedSubPath
                    );
                    const itemFullPath = `${currentDir}/${item.name}`;
                    onManageFolderShares(itemFullPath, item.name, activeFolderShare.owner);
                  }
                : undefined
            }
            rootLabel={activeFolderShare.folder_name}
            isSharedContext={true}
            isActionsDisabled={(maintenanceMode && user.role !== 'master') || !activeCanWrite}
            clipboard={clipboard}
            onCopyItem={onCopyItem}
            onCutItem={activeCanWrite ? onCutItem : undefined}
            onPaste={activeCanWrite && onPaste ? (sub) => onPaste(activeFolderShare, sub ?? sharedSubPath) : undefined}
            onUploadClick={activeCanWrite ? onTriggerFileInput : undefined}
            onPlayFolderAsPlaylist={onPlayFolderAsPlaylist}
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
          className="flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
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
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5 text-red-500" />
                    <span>Ablehnen</span>
                  </button>

                  <button
                    onClick={() => onAcceptShare(share.id)}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer"
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

      {/* Aktive geteilte Ordner (JEDER ORDNER NUR GENAU EINMAL) */}
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
              const userNorm = (user.username || '').toLowerCase();
              const isOwner = (share.owner?.toLowerCase() || '') === userNorm;
              const member = share.shared_with?.find(
                (m) => m?.username && m.username.toLowerCase() === userNorm
              );
              const canSeeMembers = isOwner || (member?.can_see_members ?? false);
              const canManageMembers = isOwner || (member?.can_manage_members ?? false);

              let subtitle = '';
              if (isOwner) {
                const memberUsernames = (share.shared_with || [])
                  .filter((m) => m && m.username)
                  .map((m) => `@${m.username}`);
                if (!memberUsernames || memberUsernames.length === 0) {
                  subtitle = 'Noch keine Personen eingeladen';
                } else if (memberUsernames.length <= 2) {
                  subtitle = `Geteilt mit ${memberUsernames.join(', ')}`;
                } else {
                  subtitle = `Geteilt mit ${memberUsernames[0]} und ${memberUsernames.length - 1} weiteren`;
                }
              } else {
                subtitle = `Geteilt von @${share.owner || 'Unbekannt'}`;
              }

              return (
                <div
                  key={share.id}
                  onClick={() => handleOpenSharedFolder(share)}
                  onContextMenu={(e) => openFolderContextMenu(e, share)}
                  className="group relative p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200/80 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all cursor-pointer select-none"
                  title="Linksklick zum Öffnen, Rechtsklick für Menü (Löschen, Umbenennen, Freigaben)"
                >
                  <div className="flex items-start justify-between">
                    <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-500 group-hover:scale-105 transition-transform">
                      <Folder className="w-6 h-6 fill-amber-500/20" />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                        {isOwner ? 'Von mir' : `@${share.owner}`}
                      </span>

                      {/* 3-Punkte Menü-Button für touch/klick Zugang */}
                      <button
                        type="button"
                        onClick={(e) => openFolderContextMenu(e, share)}
                        className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                        title="Ordner-Optionen (Rechtsklick)"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3">
                    <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      {share.folder_name}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate" title={subtitle}>
                      {subtitle}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs font-semibold">
                    <span className="text-blue-600 dark:text-blue-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                      Ordner öffnen
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>

                    <div className="flex items-center gap-1.5">
                      {/* PRÜFUNG can_see_members: Zeige Button nur, wenn can_see_members oder isOwner */}
                      {canSeeMembers && onManageFolderShares && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onManageFolderShares(share.folder_path, share.folder_name, share.owner);
                          }}
                          className="px-2 py-1 rounded-lg text-[11px] text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors cursor-pointer"
                          title={canManageMembers ? 'Personen & Berechtigungen verwalten' : 'Mitgliederliste ansehen'}
                        >
                          {canManageMembers ? 'Freigaben' : 'Mitglieder'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* KONTEXTMENÜ FÜR GETEILTE ORDNER (RECHTSKLICK & 3-PUNKTE-BUTTON) */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-50 cursor-default"
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu(null);
            }}
          />
          <div
            style={{
              left: `${Math.min(Math.max(12, contextMenu.x), (typeof window !== 'undefined' ? window.innerWidth : 800) - 240)}px`,
              top: `${Math.min(Math.max(12, contextMenu.y), (typeof window !== 'undefined' ? window.innerHeight : 600) - 250)}px`,
            }}
            className="fixed z-50 w-56 rounded-2xl bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border border-gray-200/80 dark:border-gray-800 shadow-2xl py-1 text-xs text-gray-700 dark:text-gray-200 animate-in fade-in zoom-in-95 duration-100 select-none divide-y divide-gray-100 dark:divide-gray-800/80 max-h-[85vh] overflow-y-auto slim-scrollbar overscroll-contain"
          >
            {/* Kopfzeile Kontextmenü */}
            <div className="px-3 py-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <Folder className="w-4 h-4 text-amber-500 fill-amber-500/20 shrink-0" />
                <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {contextMenu.share.folder_name}
                </p>
              </div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5 truncate">
                {contextMenu.share.owner.toLowerCase() === user.username.toLowerCase()
                  ? 'Mein geteilter Ordner'
                  : `Geteilt von @${contextMenu.share.owner}`}
              </p>
            </div>

            {/* Aktionen */}
            <div className="py-0.5">
              <button
                type="button"
                onClick={() => {
                  const sh = contextMenu.share;
                  setContextMenu(null);
                  handleOpenSharedFolder(sh);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400 text-left transition-colors font-medium cursor-pointer"
              >
                <FolderOpen className="w-4 h-4 text-amber-500" />
                <span>Ordner öffnen</span>
              </button>

              {/* Berechtigungsprüfung für Einfügen / Hierhin kopieren / Hierhin verschieben */}
              {clipboard && onPaste && hasFolderWritePermission(contextMenu.share, user.username) && !(maintenanceMode && user.role !== 'master') && (
                <button
                  type="button"
                  onClick={() => {
                    const sh = contextMenu.share;
                    setContextMenu(null);
                    onPaste(sh, '');
                  }}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400 text-left transition-colors font-medium cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Clipboard className="w-4 h-4 text-blue-500 shrink-0" />
                    <span className="truncate">
                      {clipboard.action === 'cut' ? 'Hierhin verschieben' : 'Hierhin kopieren'}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono ml-2 shrink-0 truncate max-w-[80px]">
                    {clipboard.item.name}
                  </span>
                </button>
              )}

              {(((contextMenu.share.owner?.toLowerCase() || '') === (user.username || '').toLowerCase()) ||
                contextMenu.share.shared_with?.find(
                  (m) => m?.username && m.username.toLowerCase() === (user.username || '').toLowerCase()
                )?.can_see_members) &&
                onManageFolderShares && (
                  <button
                    type="button"
                    onClick={() => {
                      const sh = contextMenu.share;
                      setContextMenu(null);
                      onManageFolderShares(sh.folder_path, sh.folder_name, sh.owner);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 text-left transition-colors font-medium cursor-pointer"
                  >
                    <Users className="w-4 h-4 text-blue-500" />
                    <span>
                      {((contextMenu.share.owner?.toLowerCase() || '') === (user.username || '').toLowerCase()) ||
                       contextMenu.share.shared_with?.find((m) => m?.username && m.username.toLowerCase() === (user.username || '').toLowerCase())?.can_manage_members
                        ? 'Freigaben & Rechte'
                        : 'Mitglieder ansehen'}
                    </span>
                  </button>
                )}

              <button
                type="button"
                onClick={() => {
                  const sh = contextMenu.share;
                  setContextMenu(null);
                  handleRenameSharedFolder(sh);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 text-left transition-colors font-medium cursor-pointer"
              >
                <Edit2 className="w-4 h-4 text-indigo-500" />
                <span>Umbenennen</span>
              </button>
            </div>

            {/* Löschen / Freigabe beenden / Verlassen & entfernen */}
            <div className="py-0.5">
              <button
                type="button"
                onClick={() => {
                  const sh = contextMenu.share;
                  setContextMenu(null);
                  handleDeleteSharedFolder(sh);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 text-left transition-colors font-medium cursor-pointer"
              >
                {(contextMenu.share.owner?.toLowerCase() || '') === (user.username || '').toLowerCase() ? (
                  <>
                    <Trash2 className="w-4 h-4 text-red-500" />
                    <span>Löschen / Freigabe beenden</span>
                  </>
                ) : (
                  <>
                    <LogOut className="w-4 h-4 text-red-500" />
                    <span>Verlassen & entfernen</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {/* POP-UP WARNMELDUNG: Geteilten Ordner verlassen (Member) */}
      {leaveConfirmShare && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => !isLeavingShare && setLeaveConfirmShare(null)}
        >
          <div
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 text-gray-900 dark:text-gray-100 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Icon + Title */}
            <div className="flex items-start gap-3.5 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
                <LogOut className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  Möchten Sie den Ordner wirklich verlassen?
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Geteilter Ordner von <span className="font-semibold text-gray-700 dark:text-gray-300">@{leaveConfirmShare.owner}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => !isLeavingShare && setLeaveConfirmShare(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Ordner Badge */}
            <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200/80 dark:border-gray-700/60 mb-3 flex items-center gap-3">
              <Folder className="w-5 h-5 text-amber-500 fill-amber-500/20 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate text-gray-900 dark:text-gray-100">
                  {leaveConfirmShare.folder_name}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  Pfad: {leaveConfirmShare.folder_path}
                </div>
              </div>
            </div>

            {/* Subtext Warnmeldung */}
            <div className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed mb-6 space-y-1.5">
              <p>
                Der Ordner wird aus Ihrer Ablage entfernt.
              </p>
              <p className="text-gray-500 dark:text-gray-400">
                Sie haben danach keinen Zugriff mehr auf die darin enthaltenen Dateien und Ordner. Ein erneuter Zugriff ist nur möglich, wenn der Besitzer <span className="font-semibold">@{leaveConfirmShare.owner}</span> Sie wieder einlädt.
              </p>
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setLeaveConfirmShare(null)}
                disabled={isLeavingShare}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer disabled:opacity-50"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleConfirmLeaveShare}
                disabled={isLeavingShare}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{isLeavingShare ? 'Wird entfernt...' : 'Verlassen & entfernen'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POP-UP: Freigabe beenden / Ordner löschen (Owner) */}
      {deleteConfirmShare && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => !isDeletingShare && setDeleteConfirmShare(null)}
        >
          <div
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 text-gray-900 dark:text-gray-100 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  Freigabe beenden?
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Ordner: <span className="font-semibold text-gray-700 dark:text-gray-300">"{deleteConfirmShare.folder_name}"</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => !isDeletingShare && setDeleteConfirmShare(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
              Die Freigabe wird für alle eingeladenen Personen beendet. Mitglieder verlieren sofort den Zugriff auf diesen Ordner.
            </div>

            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 mb-6 cursor-pointer">
              <input
                type="checkbox"
                checked={deleteFilesOnDisk}
                onChange={(e) => setDeleteFilesOnDisk(e.target.checked)}
                className="mt-0.5 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
              />
              <span className="text-xs text-gray-700 dark:text-gray-300">
                Ordner auch physisch von meinem Server-Speicher löschen
              </span>
            </label>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setDeleteConfirmShare(null)}
                disabled={isDeletingShare}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer disabled:opacity-50"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteShare}
                disabled={isDeletingShare}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingShare ? 'Wird gelöscht...' : 'Freigabe beenden'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
