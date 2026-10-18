import React, { useState, useEffect, useCallback, useRef } from 'react';
import type {
  UserAccount,
  NavigationTab,
  ViewMode,
  FileItemData,
  StorageUsage,
  FolderShare,
} from './types';
import {
  getAllUsers,
  updateUserStatus,
  updateUserQuota,
  deleteUser,
  subscribeMaintenanceMode,
  setMaintenanceMode,
  getSharesForInvitedUser,
  getSharesByOwner,
  respondToShare,
} from './services/firebase';
import {
  listFiles,
  getStorageUsage,
  uploadFile,
  triggerDirectDownload,
  deleteItem,
  renameItem,
  copyItem,
  moveItem,
  checkServerStatus,
  type ServerStatus,
  CHUNK_SIZE,
} from './services/storageApi';
import { sanitizeUploadFileName } from './utils/nameSanitizer';
import { UploadProgressWidget, type UploadTaskState } from './components/UploadProgressWidget';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { FileExplorer } from './components/FileExplorer';
import { SharedSection } from './components/SharedSection';
import { MasterDashboard } from './components/MasterDashboard';
import { AuthModal } from './components/AuthModal';
import { NewFolderModal, NewSharedFolderModal } from './components/NewItemModal';
import { ManageFolderSharesModal } from './components/ManageFolderSharesModal';
import { MediaViewerModal, isVideoFile } from './components/MediaViewerModal';
import { CinemaView } from './components/CinemaView';
import { CinemaTvView, isTvBackEvent } from './components/CinemaTvView';
import { CinemaTvAuthModal } from './components/CinemaTvAuthModal';
import { SettingsModal } from './components/SettingsModal';
import { ContactPage } from './components/ContactPage';
import { FileViewerPage } from './components/FileViewerPage';
import { MaintenanceBanner } from './components/MaintenanceBanner';
import { LegalLinks } from './components/LegalLinks';
import { ToastProvider, useToast } from './components/Toast';
import { RenameModal, FileMetadataModal, PublicShareModal } from './components/FileActionModals';
import { PublicShareView } from './components/PublicShareView';
import {
  getActiveUser,
  getSavedAccounts,
  saveAndActivateAccount,
  switchActiveAccount,
  logoutCurrentAccount,
  logoutAllAccounts,
  CURRENT_USER_KEY,
} from './services/accountManager';
import { resolveFolderPath } from './utils/pathResolver';

const DARK_MODE_KEY = 'jjcloud_dark_mode';
const VIEW_MODE_KEY = 'jjcloud_view_mode';
const OPEN_FILES_IN_NEW_TAB_KEY = 'jjcloud_open_files_in_new_tab';

function MainApp() {
  const { addToast } = useToast();

  // Multi-account persistent session
  const [user, setUser] = useState<UserAccount | null>(() => getActiveUser());
  const [savedAccounts, setSavedAccounts] = useState<UserAccount[]>(() => getSavedAccounts());
  const [showAddAccountModal, setShowAddAccountModal] = useState<boolean>(false);

  // Dark Mode: Auto-detects device mode if no explicit user override exists
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(DARK_MODE_KEY);
      if (saved !== null) return saved === 'true';
      return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  // Helper to parse path from current URL pathname
  const getTabFromUrl = (): NavigationTab => {
    if (typeof window === 'undefined') return 'my-drive';
    const path = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
    if (path === '/cinema/tv' || path === '/tv') {
      return 'cinema-tv';
    }
    if (path === '/cinema' || path === '/vod') {
      return 'cinema';
    }
    return 'my-drive';
  };

  // Check if current URL matches contact/help page routes
  const isContactPath = (path: string): boolean => {
    const clean = path.toLowerCase().replace(/\/+$/, '') || '/';
    return (
      clean === '/kontakt' ||
      clean === '/hilfe' ||
      clean === '/support' ||
      clean === '/help' ||
      clean === '/contact' ||
      clean === '/kundenservice' ||
      clean === '/anfrage'
    );
  };

  // UI state
  const [isContactRoute, setIsContactRoute] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return isContactPath(window.location.pathname);
  });
  const [isShareRoute, setIsShareRoute] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.location.pathname.toLowerCase().startsWith('/share');
  });
  const [isViewRoute, setIsViewRoute] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
    const search = window.location.search.toLowerCase();
    return path === '/view' || path.startsWith('/view/') || search.includes('view=');
  });

  const [openFilesInNewTab, setOpenFilesInNewTab] = useState<boolean>(() => {
    try {
      return localStorage.getItem(OPEN_FILES_IN_NEW_TAB_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleOpenFilesInNewTab = (val: boolean) => {
    setOpenFilesInNewTab(val);
    try {
      localStorage.setItem(OPEN_FILES_IN_NEW_TAB_KEY, String(val));
    } catch {}
  };

  const [currentTab, setCurrentTab] = useState<NavigationTab>(getTabFromUrl);
  const isCinemaMode = currentTab === 'cinema';
  const isTvMode = currentTab === 'cinema-tv';
  const [currentPath, setCurrentPath] = useState<string>('');

  // Synchronize browser history and path
  const navigateToTab = useCallback((tab: NavigationTab, replace = false) => {
    setIsShareRoute(false);
    setIsContactRoute(false);
    setCurrentTab(tab);
    if (typeof window !== 'undefined') {
      const currentUrlPath = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
      let targetUrlPath = '/';
      if (tab === 'cinema-tv') targetUrlPath = '/cinema/tv';
      else if (tab === 'cinema') targetUrlPath = '/cinema';

      if (currentUrlPath !== targetUrlPath) {
        if (replace) {
          window.history.replaceState({ tab }, '', targetUrlPath);
        } else {
          window.history.pushState({ tab }, '', targetUrlPath);
        }
      }
    }
  }, []);

  // Keep currentTab in a ref so event listeners (popstate) always read current value
  const currentTabRef = useRef<NavigationTab>(currentTab);
  useEffect(() => {
    currentTabRef.current = currentTab;
  }, [currentTab]);

  // Listen to browser Back/Forward (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const isContact = typeof window !== 'undefined' && isContactPath(window.location.pathname);
      setIsContactRoute(isContact);
      if (isContact) {
        if (window.location.pathname.toLowerCase().replace(/\/+$/, '') !== '/kontakt') {
          window.history.replaceState({ contact: true }, '', '/kontakt');
        }
        return;
      }

      const isShare = typeof window !== 'undefined' && window.location.pathname.toLowerCase().startsWith('/share');
      setIsShareRoute(isShare);
      if (isShare) return;

      // When currently in Cinema/TV mode, prevent Android TV / browser back from exiting to standard Cloud
      if (currentTabRef.current === 'cinema-tv') {
        if (typeof window !== 'undefined') {
          window.history.pushState({ tab: 'cinema-tv', tvMode: true }, '', '/cinema/tv');
        }
        setCurrentTab('cinema-tv');
        return;
      }

      const tab = getTabFromUrl();
      setCurrentTab(tab);
      // Canonicalize /vod to /cinema, and /tv to /cinema/tv in address bar
      if (typeof window !== 'undefined') {
        const path = window.location.pathname.toLowerCase().replace(/\/+$/, '');
        if (path === '/vod') {
          window.history.replaceState({ tab: 'cinema' }, '', '/cinema');
        } else if (path === '/tv') {
          window.history.replaceState({ tab: 'cinema-tv' }, '', '/cinema/tv');
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    // Initial check on mount: If path was /vod or /tv or contact route, rewrite to canonical path
    if (typeof window !== 'undefined') {
      const path = window.location.pathname.toLowerCase().replace(/\/+$/, '');
      if (isContactPath(path)) {
        if (path !== '/kontakt') {
          window.history.replaceState({ contact: true }, '', '/kontakt');
        }
      } else if (path === '/vod') {
        window.history.replaceState({ tab: 'cinema' }, '', '/cinema');
      } else if (path === '/tv') {
        window.history.replaceState({ tab: 'cinema-tv' }, '', '/cinema/tv');
      }
    }

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Global keydown trap when in cinema-tv mode to prevent Android TV remote back from exiting to normal cloud
  useEffect(() => {
    if (currentTab !== 'cinema-tv') return;

    const handleGlobalTvBackKey = (e: KeyboardEvent) => {
      const isInputActive =
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA';

      if (isInputActive && (e.key === 'Backspace' || (e.keyCode || e.which) === 8)) {
        return;
      }

      if (isTvBackEvent(e)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener('keydown', handleGlobalTvBackKey);
    return () => window.removeEventListener('keydown', handleGlobalTvBackKey);
  }, [currentTab]);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      return (localStorage.getItem(VIEW_MODE_KEY) as ViewMode) || 'grid';
    } catch {
      return 'grid';
    }
  });
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Storage and Backend data
  const [items, setItems] = useState<FileItemData[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [serverError, setServerError] = useState<string | undefined>();
  const [storageUsage, setStorageUsage] = useState<StorageUsage>({ used_bytes: 0, used_gb: 0 });
  const [shares, setShares] = useState<FolderShare[]>([]);
  const [allUsers, setAllUsers] = useState<UserAccount[]>([]);
  const [maintenanceMode, setMaintenanceState] = useState<boolean>(false);
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);

  // Modals
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [showNewSharedModal, setShowNewSharedModal] = useState(false);
  const [showAccountSettingsModal, setShowAccountSettingsModal] = useState(false);
  const [folderToShare, setFolderToShare] = useState<FileItemData | null>(null);
  const [itemToRename, setItemToRename] = useState<FileItemData | null>(null);
  const [itemForMetadata, setItemForMetadata] = useState<FileItemData | null>(null);
  const [itemForPublicShare, setItemForPublicShare] = useState<FileItemData | null>(null);

  // Manage Shares Modal state
  const [manageSharesFolder, setManageSharesFolder] = useState<{ path: string; name: string; owner?: string } | null>(null);

  // Media Viewer Modal state
  const [viewerItem, setViewerItem] = useState<FileItemData | null>(null);
  const [viewerItemsList, setViewerItemsList] = useState<FileItemData[]>([]);

  // Discovered videos across directories for Cinema mode
  const [allCinemaVideos, setAllCinemaVideos] = useState<FileItemData[]>([]);

  // File upload input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active chunked upload task state
  const [uploadTask, setUploadTask] = useState<UploadTaskState | null>(null);

  // Scan for videos across directories when cinema mode is entered
  useEffect(() => {
    if (!user || (currentTab !== 'cinema' && currentTab !== 'cinema-tv')) return;
    let isMounted = true;
    const scanAllVideos = async () => {
      try {
        const { items: rootItems } = await listFiles(user.username, '');
        if (!isMounted) return;
        const directVideos = rootItems.filter(isVideoFile);
        const folderList = rootItems.filter((i) => i.type === 'folder');
        const subVideos: FileItemData[] = [];
        for (const f of folderList.slice(0, 10)) {
          const { items: subItems } = await listFiles(user.username, f.name);
          if (!isMounted) return;
          subVideos.push(...subItems.filter(isVideoFile));
        }
        const merged = [...directVideos, ...subVideos];
        if (merged.length > 0) {
          setAllCinemaVideos(merged);
        }
      } catch (err) {
        console.warn('Cinema video scan error:', err);
      }
    };
    scanAllVideos();
    return () => {
      isMounted = false;
    };
  }, [user, currentTab]);

  // Dark mode effect: Synchronizes DOM classes with darkMode state
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
    }
  }, [darkMode]);

  // Real-time synchronization with device White/Dark mode if user hasn't explicitly set a preference
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleDeviceThemeChange = (e: MediaQueryListEvent) => {
      const saved = localStorage.getItem(DARK_MODE_KEY);
      if (saved === null) {
        setDarkMode(e.matches);
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleDeviceThemeChange);
      return () => mediaQuery.removeEventListener('change', handleDeviceThemeChange);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleDeviceThemeChange);
      return () => mediaQuery.removeListener(handleDeviceThemeChange);
    }
  }, []);

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem(DARK_MODE_KEY, String(next));
      return next;
    });
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  };

  // Subscribe to maintenance mode
  useEffect(() => {
    const unsubscribe = subscribeMaintenanceMode((isMaint) => {
      setMaintenanceState(isMaint);
    });
    return () => unsubscribe();
  }, []);

  // Periodic server status ping
  const refreshServerPing = useCallback(async () => {
    const status = await checkServerStatus();
    setServerStatus(status);
  }, []);

  useEffect(() => {
    refreshServerPing();
    const interval = setInterval(refreshServerPing, 45000);
    return () => clearInterval(interval);
  }, [refreshServerPing]);

  // Load storage usage directly from server
  const loadUsage = useCallback(async (username: string) => {
    try {
      const usage = await getStorageUsage(username);
      setStorageUsage(usage);
    } catch (err) {
      console.warn('Failed loading usage', err);
    }
  }, []);

  // Load files strictly from server
  const loadDirectoryFiles = useCallback(async (username: string, path: string) => {
    setIsLoadingItems(true);
    setServerError(undefined);
    try {
      const res = await listFiles(username, path);
      setItems(res.items);
      if (res.error) {
        setServerError(res.error);
      }
    } catch (err) {
      setServerError('Verbindung zum Speicher-Server unterbrochen.');
      setItems([]);
    } finally {
      setIsLoadingItems(false);
    }
  }, []);

  // Retry server connection & refresh current directory and quota
  const handleRetryConnection = useCallback(async () => {
    const status = await checkServerStatus();
    setServerStatus(status);
    if (user) {
      await Promise.allSettled([
        loadDirectoryFiles(user.username, currentPath),
        loadUsage(user.username),
      ]);
    }
    if (status.isOnline) {
      addToast('success', 'Verbindung hergestellt', `Speicherserver ist online (${status.latencyMs ?? 0} ms Latenz).`);
    } else {
      addToast('error', 'Server nicht erreichbar', 'Der Speicherserver unter https://storage.j-jonas.com antwortet nicht.');
    }
  }, [user, currentPath, loadDirectoryFiles, loadUsage, addToast]);

  // Load shares
  const loadShares = useCallback(async (username: string) => {
    try {
      const [invited, owned] = await Promise.all([
        getSharesForInvitedUser(username),
        getSharesByOwner(username),
      ]);
      const map = new Map<string, FolderShare>();
      (invited || []).filter(Boolean).forEach((s) => {
        if (s && s.id) map.set(s.id, s);
      });
      (owned || []).filter(Boolean).forEach((s) => {
        if (s && s.id) map.set(s.id, s);
      });
      setShares(Array.from(map.values()));
    } catch (err) {
      console.warn('Failed to load shares', err);
    }
  }, []);

  // Load admin users
  const loadAdminUsers = useCallback(async () => {
    try {
      const usersList = await getAllUsers();
      setAllUsers(usersList);
    } catch (err) {
      console.warn('Failed to load users for master', err);
    }
  }, []);

  useEffect(() => {
    if (user) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
      loadUsage(user.username);
      loadShares(user.username);
      if (user.role === 'master') {
        loadAdminUsers();
      }
    } else {
      localStorage.removeItem(CURRENT_USER_KEY);
    }
  }, [user, loadUsage, loadShares, loadAdminUsers]);

  useEffect(() => {
    if (user && currentTab === 'my-drive') {
      loadDirectoryFiles(user.username, currentPath);
    } else if (user && currentTab === 'shared') {
      loadShares(user.username);
    }
  }, [user, currentPath, currentTab, loadDirectoryFiles, loadShares]);

  const handleLoginSuccess = (loggedInUser: UserAccount, targetTabOverride?: NavigationTab) => {
    const updatedAccounts = saveAndActivateAccount(loggedInUser);
    setSavedAccounts(updatedAccounts);
    setUser(loggedInUser);
    setCurrentPath('');

    const urlTab = getTabFromUrl();
    const destinationTab: NavigationTab =
      targetTabOverride ||
      (currentTab === 'cinema-tv' || urlTab === 'cinema-tv'
        ? 'cinema-tv'
        : currentTab === 'cinema' || urlTab === 'cinema'
        ? 'cinema'
        : 'my-drive');

    navigateToTab(destinationTab, true);
    setShowAddAccountModal(false);
    addToast('success', 'Angemeldet', `Willkommen zurück, @${loggedInUser.username}!`);
  };

  const handleSwitchAccount = (targetUser: UserAccount) => {
    const switched = switchActiveAccount(targetUser.username);
    if (switched) {
      setUser(switched);
      setCurrentPath('');
      setItems([]);
      loadDirectoryFiles(switched.username, '');
      loadUsage(switched.username);
      loadShares(switched.username);
      addToast('success', 'Konto gewechselt', `Jetzt aktiv: @${switched.username}`);
    }
  };

  const handleLogoutCurrentAccount = () => {
    if (!user) return;
    const { remainingAccounts, nextUser } = logoutCurrentAccount(user.username);
    setSavedAccounts(remainingAccounts);
    setCurrentPath('');
    setItems([]);
    if (nextUser) {
      setUser(nextUser);
      loadDirectoryFiles(nextUser.username, '');
      loadUsage(nextUser.username);
      loadShares(nextUser.username);
      addToast('info', 'Konto abgemeldet', `Zu @${nextUser.username} gewechselt.`);
    } else {
      setUser(null);
      addToast('info', 'Abgemeldet', 'Erfolgreich abgemeldet.');
    }
  };

  const handleLogoutAllAccounts = () => {
    logoutAllAccounts();
    setUser(null);
    setSavedAccounts([]);
    setCurrentPath('');
    setItems([]);
    addToast('info', 'Abgemeldet', 'Von allen Konten abgemeldet.');
  };

  // Upload handler with quota check and chunked upload tracking
  const handleUploadFiles = async (files: FileList) => {
    if (!user) return;
    if (maintenanceMode && user.role !== 'master') {
      addToast('error', 'Wartungsmodus', 'Uploads sind während der Wartungsarbeiten deaktiviert.');
      return;
    }

    const totalFiles = files.length;
    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const safeName = sanitizeUploadFileName(file.name);
      const initialTotalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
      setUploadTask({
        id: `upload_${Date.now()}_${i}`,
        fileName: safeName,
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
        user.username,
        currentPath,
        storageUsage.used_bytes,
        user.quota_gb,
        (info) => {
          setUploadTask((prev) =>
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
        setUploadTask((prev) =>
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
      successCount++;
    }

    if (successCount === totalFiles && totalFiles > 0) {
      setUploadTask((prev) =>
        prev
          ? {
              ...prev,
              status: 'completed',
              progressPercent: 100,
            }
          : null
      );
      setTimeout(() => {
        setUploadTask((prev) => (prev?.status === 'completed' ? null : prev));
      }, 4000);
      addToast('success', 'Upload abgeschlossen', `${successCount} Datei(en) erfolgreich hochgeladen.`);
      loadDirectoryFiles(user.username, currentPath);
      loadUsage(user.username);
    } else if (successCount > 0) {
      loadDirectoryFiles(user.username, currentPath);
      loadUsage(user.username);
    }
  };

  const handleTriggerFileInput = () => {
    if (maintenanceMode && user?.role !== 'master') {
      addToast('error', 'Wartungsmodus', 'Uploads sind vorübergehend deaktiviert.');
      return;
    }
    fileInputRef.current?.click();
  };

  // Delete item handler
  const handleDeleteItem = async (item: FileItemData) => {
    if (!user) return;
    if (maintenanceMode && user.role !== 'master') {
      addToast('error', 'Wartungsmodus', 'Löschungen sind während der Wartungsarbeiten deaktiviert.');
      return;
    }

    if (!window.confirm(`Möchtest du "${item.name}" wirklich löschen?`)) {
      return;
    }

    const res = await deleteItem(user.username, currentPath, item.name);
    if (res.success) {
      addToast('success', 'Gelöscht', `"${item.name}" wurde entfernt.`);
      loadDirectoryFiles(user.username, currentPath);
      loadUsage(user.username);
    } else {
      addToast('error', 'Fehler beim Löschen', res.error);
    }
  };

  // Rename item handler
  const handleRenameItem = (item: FileItemData) => {
    if (!user) return;
    if (maintenanceMode && user.role !== 'master') {
      addToast('error', 'Wartungsmodus', 'Aktion im Wartungsmodus pausiert.');
      return;
    }
    setItemToRename(item);
  };

  // Clipboard state for Copy / Cut / Paste
  const [clipboard, setClipboard] = useState<{
    action: 'copy' | 'cut';
    item: FileItemData;
    sourcePath: string;
    sourceOwner?: string;
  } | null>(null);

  const handleCopyItem = (item: FileItemData, customSourcePath?: string) => {
    const itemPath = customSourcePath || item.path || (currentPath ? `${currentPath}/${item.name}` : item.name);
    setClipboard({
      action: 'copy',
      item,
      sourcePath: itemPath,
      sourceOwner: item.owner || user?.username,
    });
    addToast('info', 'In Zwischenablage kopiert', `"${item.name}" kopiert. Füge es per Rechtsklick ("Einfügen") oder Strg+V ein.`);
  };

  const handleCutItem = (item: FileItemData, customSourcePath?: string) => {
    if (maintenanceMode && user?.role !== 'master') {
      addToast('error', 'Wartungsmodus', 'Aktion im Wartungsmodus pausiert.');
      return;
    }
    const itemPath = customSourcePath || item.path || (currentPath ? `${currentPath}/${item.name}` : item.name);
    setClipboard({
      action: 'cut',
      item,
      sourcePath: itemPath,
      sourceOwner: item.owner || user?.username,
    });
    addToast('info', 'Ausgeschnitten', `"${item.name}" ausgeschnitten. Füge es per Rechtsklick ("Einfügen") oder Strg+V ein.`);
  };

  const handlePasteItem = async (
    customDestPath?: string,
    customDestOwner?: string,
    targetFolderId?: string
  ) => {
    if (!user || !clipboard) return;
    if (maintenanceMode && user.role !== 'master') {
      addToast('error', 'Wartungsmodus', 'Einfügen ist während der Wartungsarbeiten deaktiviert.');
      return;
    }

    const effectiveDestOwner = customDestOwner || user.username;
    const effectiveSourceOwner = clipboard.sourceOwner || user.username;

    const baseDestDir = (customDestPath !== undefined ? customDestPath : currentPath).trim().replace(/^\/+|\/+$/g, '');
    const cleanSourcePath = clipboard.sourcePath.trim().replace(/^\/+/, '');
    const destPath = (baseDestDir ? `${baseDestDir}/${clipboard.item.name}` : clipboard.item.name).replace(/^\/+/, '');

    let targetDestPath = destPath;
    if (
      clipboard.action === 'copy' &&
      cleanSourcePath === destPath &&
      effectiveSourceOwner.toLowerCase() === effectiveDestOwner.toLowerCase()
    ) {
      const lastDot = clipboard.item.name.lastIndexOf('.');
      if (clipboard.item.type === 'file' && lastDot > 0) {
        const base = clipboard.item.name.slice(0, lastDot);
        const ext = clipboard.item.name.slice(lastDot);
        targetDestPath = baseDestDir ? `${baseDestDir}/${base} - Kopie${ext}` : `${base} - Kopie${ext}`;
      } else {
        targetDestPath = baseDestDir ? `${baseDestDir}/${clipboard.item.name} - Kopie` : `${clipboard.item.name} - Kopie`;
      }
    }

    const transferOptions = {
      sourceOwner: effectiveSourceOwner,
      targetOwner: effectiveDestOwner,
      targetFolderId,
      actingUser: user.username,
      canWrite: true,
    };

    try {
      if (clipboard.action === 'copy') {
        const res = await copyItem(effectiveDestOwner, cleanSourcePath, targetDestPath, transferOptions);
        if (res.success) {
          addToast('success', 'Datei kopiert', `"${clipboard.item.name}" wurde erfolgreich kopiert.`);
          if (currentTab === 'my-drive') {
            loadDirectoryFiles(user.username, currentPath);
          }
          loadUsage(user.username);
        } else {
          addToast('error', 'Kopieren fehlgeschlagen', res.error || 'Aktion fehlgeschlagen.');
        }
      } else {
        const res = await moveItem(effectiveDestOwner, cleanSourcePath, targetDestPath, transferOptions);
        if (res.success) {
          addToast('success', 'Datei verschoben', `"${clipboard.item.name}" wurde erfolgreich verschoben.`);
          setClipboard(null);
          if (currentTab === 'my-drive') {
            loadDirectoryFiles(user.username, currentPath);
          }
          loadUsage(user.username);
        } else {
          addToast('error', 'Verschieben fehlgeschlagen', res.error || 'Aktion fehlgeschlagen.');
        }
      }
    } catch (err: any) {
      addToast('error', 'Fehler', err.message || 'Unerwarteter Fehler beim Einfügen.');
    }
  };

  // Download item handler
  const handleDownloadItem = async (item: FileItemData) => {
    if (!user) return;
    const downloadOwner = item.owner || user.username;
    const fullItemPath = item.path || (currentPath ? `${currentPath}/${item.name}` : item.name);
    triggerDirectDownload(downloadOwner, fullItemPath, item.name);
  };

  // Open file in dedicated tab
  const handleOpenFileInNewTab = useCallback((item: FileItemData, customOwner?: string) => {
    const fullPath = item.path || (currentPath ? `${currentPath}/${item.name}` : item.name);
    const tempSessionId = `s_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const effectiveOwner = customOwner || item.owner || user?.username;
    const searchParams = new URLSearchParams({
      path: fullPath,
      name: item.name,
      session_ref: tempSessionId,
      ...(effectiveOwner ? { owner: effectiveOwner } : {}),
    });
    window.open(`/view?${searchParams.toString()}`, '_blank');
  }, [currentPath, user]);

  // Navigation lock & State-Schutz against duplicate folder triggers
  const [isNavigating, setIsNavigating] = useState(false);
  const isNavigatingRef = useRef(false);
  const lastFolderClickRef = useRef<{ id: string; time: number } | null>(null);

  // Sync navigation lock with file loading completion
  useEffect(() => {
    if (!isLoadingItems) {
      isNavigatingRef.current = false;
      setIsNavigating(false);
    }
  }, [isLoadingItems]);

  // Open folder handler with navigation lock, debouncing, and absolute path validation
  const handleOpenFolder = useCallback((folder: FileItemData) => {
    const now = Date.now();
    const folderKey = folder.id || folder.path || folder.name;

    // 1. State-Schutz: Ignore further clicks if currently navigating or loading items
    if (isNavigatingRef.current || isLoadingItems) {
      return;
    }

    // 2. Debouncing: Ignore rapid duplicate clicks on the same folder within 350ms
    if (
      lastFolderClickRef.current &&
      lastFolderClickRef.current.id === folderKey &&
      now - lastFolderClickRef.current.time < 350
    ) {
      return;
    }

    // 3. Absolute path resolution & duplicate prevention
    const nextPath = resolveFolderPath(currentPath, folder);
    if (nextPath === currentPath) {
      return;
    }

    lastFolderClickRef.current = { id: folderKey, time: now };
    isNavigatingRef.current = true;
    setIsNavigating(true);

    setCurrentPath(nextPath);

    // Timeout fallback to release lock if loading settles
    setTimeout(() => {
      isNavigatingRef.current = false;
      setIsNavigating(false);
    }, 400);
  }, [currentPath, isLoadingItems]);

  // Open item (files open preview modal or new tab according to setting, folders navigate)
  const handleOpenItem = useCallback((item: FileItemData) => {
    // In Cinema or Cinema/TV mode, standard preview modal must not be opened
    if (isCinemaMode || isTvMode) {
      return;
    }
    if (item.type === 'folder') {
      handleOpenFolder(item);
    } else {
      if (openFilesInNewTab) {
        handleOpenFileInNewTab(item);
      } else {
        setViewerItem(item);
        setViewerItemsList(items);
      }
    }
  }, [isCinemaMode, isTvMode, handleOpenFolder, openFilesInNewTab, handleOpenFileInNewTab, items]);

  // Share handlers
  const handleAcceptShare = async (shareId: string) => {
    if (!user) return;
    await respondToShare(shareId, 'accepted', user.username);
    addToast('success', 'Einladung angenommen', 'Der Ordner wurde zum Geteilten Bereich hinzugefügt.');
    await loadShares(user.username);
  };

  const handleDeclineShare = async (shareId: string) => {
    if (!user) return;
    await respondToShare(shareId, 'declined', user.username);
    addToast('info', 'Einladung abgelehnt');
    await loadShares(user.username);
  };


  // Admin handlers
  const handleToggleMaintenance = async (enabled: boolean) => {
    await setMaintenanceMode(enabled);
    setMaintenanceState(enabled);
    addToast(
      enabled ? 'error' : 'success',
      enabled ? 'Wartungsmodus aktiviert' : 'Wartungsmodus deaktiviert',
      enabled
        ? 'Alle Schreibvorgänge sind für normale Nutzer pausiert.'
        : 'Normalbetrieb wiederhergestellt.'
    );
  };

  const handleApproveUser = async (username: string, quota: number) => {
    await updateUserStatus(username, 'active', quota);
    addToast('success', 'Benutzer freigeschaltet', `@${username} ist jetzt aktiv mit ${quota} GB Quota.`);
    loadAdminUsers();
  };

  const handleRejectUser = async (username: string) => {
    await deleteUser(username);
    loadAdminUsers();
  };

  const handleUpdateUserQuota = async (username: string, quota: number) => {
    await updateUserQuota(username, quota);
    addToast('success', 'Quota aktualisiert', `Speicherlimit für @${username} auf ${quota} GB geändert.`);
    loadAdminUsers();
    // Falls Master sein eigenes Quota ändert, lokalen Session-State ebenfalls anpassen
    if (user && user.username.toLowerCase() === username.toLowerCase()) {
      const updated = { ...user, quota_gb: quota };
      setUser(updated);
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updated));
    }
  };

  const handleDeleteUserAccount = async (username: string) => {
    await deleteUser(username);
    loadAdminUsers();
  };

  const handleUserUpdated = (updatedUser: UserAccount) => {
    setUser(updatedUser);
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedUser));
  };

  const pendingSharesCount = user
    ? shares.filter((s) => {
        if (!s) return false;
        const userNorm = (user.username || '').toLowerCase();
        if (s.invited_user && s.invited_user?.toLowerCase() === userNorm && s.status === 'pending') {
          return true;
        }
        return Array.isArray(s.shared_with) && s.shared_with.some(
          (m) => m?.username && m.username?.toLowerCase() === userNorm && m.status === 'pending'
        );
      }).length
    : 0;


  // Dedicated Contact Page (/kontakt, /hilfe, /support, /help, etc.)
  if (isContactRoute) {
    return (
      <ContactPage
        user={user}
        darkMode={darkMode}
        onBack={() => {
          setIsContactRoute(false);
          if (typeof window !== 'undefined') {
            if (window.history.length > 1) {
              window.history.back();
            } else {
              window.history.pushState({}, '', '/');
            }
          }
        }}
      />
    );
  }

  if (isViewRoute) {
    return (
      <FileViewerPage
        darkMode={darkMode}
      />
    );
  }

  if (isShareRoute) {
    return (
      <PublicShareView
        darkMode={darkMode}
        onGoToHome={() => {
          if (typeof window !== 'undefined') {
            window.history.pushState({}, '', '/');
          }
          setIsShareRoute(false);
          setCurrentTab('my-drive');
        }}
      />
    );
  }

  if (!user) {
    if (currentTab === 'cinema-tv') {
      return (
        <CinemaTvAuthModal
          onSuccess={(u) => handleLoginSuccess(u, 'cinema-tv')}
          onStartDemo={() => {
            const demoUser: UserAccount = {
              username: 'demo_gast',
              passwordHash: 'demo_guest_hash',
              salt: 'demo_guest_salt',
              role: 'user',
              status: 'active',
              quota_gb: 100,
              createdAt: new Date().toISOString(),
            };
            handleLoginSuccess(demoUser, 'cinema-tv');
          }}
        />
      );
    }

    return (
      <AuthModal
        onSuccess={handleLoginSuccess}
        darkMode={darkMode}
      />
    );
  }

  const isActionsDisabled = maintenanceMode && user.role !== 'master';
  const isAnyCinemaMode = isCinemaMode || isTvMode;

  return (
    <div className={`h-full flex flex-col ${isAnyCinemaMode ? 'bg-[#141414] text-white' : 'bg-[#f8fafd] dark:bg-gray-950 text-gray-900 dark:text-gray-100'} overflow-hidden font-sans`}>
      <input
        type="file"
        ref={fileInputRef}
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleUploadFiles(e.target.files);
            e.target.value = '';
          }
        }}
      />

      {/* FULL-SCREEN CINEMA / TV MODE: Replaces entire standard Jonas Cloud interface */}
      {currentTab === 'cinema-tv' ? (
        <div className="fixed inset-0 z-50 bg-[#141414] overflow-hidden">
          <CinemaTvView
            user={user}
            items={allCinemaVideos.length > 0 ? allCinemaVideos : items}
            onBackToFiles={() => navigateToTab('my-drive')}
            onPlayVideo={(_item) => {
              // Exklusiver Vollbild-Player in CinemaTvView aktiv - Standard Cloud-Modal blockiert
            }}
            onDownloadVideo={handleDownloadItem}
            onUploadClick={handleTriggerFileInput}
            darkMode={darkMode}
          />
        </div>
      ) : currentTab === 'cinema' ? (
        <div className="fixed inset-0 z-50 bg-[#141414] overflow-y-auto">
          <CinemaView
            user={user}
            items={allCinemaVideos.length > 0 ? allCinemaVideos : items}
            onBackToFiles={() => navigateToTab('my-drive')}
            onPlayVideo={(_item) => {
              // Exklusiver Vollbild-Player in CinemaView aktiv - Standard Cloud-Modal blockiert
            }}
            onDownloadVideo={handleDownloadItem}
            onUploadClick={handleTriggerFileInput}
            darkMode={darkMode}
          />
        </div>
      ) : (
        <>
          {/* Global Maintenance & Server Offline Warning Banner */}
          <MaintenanceBanner
            isMaintenance={maintenanceMode}
            isOffline={serverStatus?.isOnline === false}
            isMaster={user.role === 'master'}
            onDisableMaintenance={() => handleToggleMaintenance(false)}
            onRetryConnection={handleRetryConnection}
          />

          {/* Top Header */}
          <Header
            user={user}
            savedAccounts={savedAccounts}
            onSwitchAccount={handleSwitchAccount}
            onAddAccount={() => setShowAddAccountModal(true)}
            onLogoutCurrentAccount={handleLogoutCurrentAccount}
            onLogoutAllAccounts={handleLogoutAllAccounts}
            onLogout={handleLogoutCurrentAccount}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            darkMode={darkMode}
            onToggleDarkMode={toggleDarkMode}
            serverStatus={serverStatus}
            onRefreshServerStatus={handleRetryConnection}
            onOpenSettings={() => setShowAccountSettingsModal(true)}
            onOpenHelp={() => {
              setIsContactRoute(true);
              if (typeof window !== 'undefined') {
                window.history.pushState({ contact: true }, '', '/kontakt');
              }
            }}
            onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
            onLogoClick={() => {
              navigateToTab('my-drive');
              setCurrentPath('');
            }}
            currentTab={currentTab}
            onSelectTab={(tab) => {
              navigateToTab(tab);
              if (tab === 'my-drive') setCurrentPath('');
            }}
          />

          {/* Body: Sidebar + Main Content Card */}
          <div className="flex-1 flex overflow-hidden relative">
            {/* Desktop Sidebar */}
            <div className="hidden md:block shrink-0">
              <Sidebar
                currentTab={currentTab}
                onSelectTab={(tab) => {
                  navigateToTab(tab);
                  if (tab === 'my-drive') setCurrentPath('');
                }}
                user={user}
                storageUsage={storageUsage}
                pendingSharesCount={pendingSharesCount}
                maintenanceMode={maintenanceMode}
                onUploadClick={handleTriggerFileInput}
                onNewFolderClick={() => setShowNewFolderModal(true)}
                onNewSharedFolderClick={() => setShowNewSharedModal(true)}
              />
            </div>

            {/* Mobile Sidebar Overlay */}
            {mobileMenuOpen && (
              <div className="fixed inset-0 z-40 md:hidden flex">
                <div
                  className="fixed inset-0 bg-black/50 backdrop-blur-xs"
                  onClick={() => setMobileMenuOpen(false)}
                />
                <div className="relative z-50 w-72 h-full bg-[#f8fafd] dark:bg-gray-950 shadow-2xl">
                  <Sidebar
                    currentTab={currentTab}
                    onSelectTab={(tab) => {
                      navigateToTab(tab);
                      if (tab === 'my-drive') setCurrentPath('');
                      setMobileMenuOpen(false);
                    }}
                    user={user}
                    storageUsage={storageUsage}
                    pendingSharesCount={pendingSharesCount}
                    maintenanceMode={maintenanceMode}
                    onUploadClick={() => {
                      setMobileMenuOpen(false);
                      handleTriggerFileInput();
                    }}
                    onNewFolderClick={() => {
                      setMobileMenuOpen(false);
                      setShowNewFolderModal(true);
                    }}
                    onNewSharedFolderClick={() => {
                      setMobileMenuOpen(false);
                      setShowNewSharedModal(true);
                    }}
                    onCloseMobile={() => setMobileMenuOpen(false)}
                  />
                </div>
              </div>
            )}

            {/* Main Workspace View: Google Drive White Rounded Card Container */}
            <main className="flex-1 overflow-hidden p-2 sm:p-3 sm:pl-0 flex flex-col">
              {currentTab === 'my-drive' && (
                <FileExplorer
                  currentPath={currentPath}
                  onNavigatePath={setCurrentPath}
                  items={items}
                  isLoading={isLoadingItems}
                  serverError={serverError}
                  viewMode={viewMode}
                  onRefresh={() => {
                    loadDirectoryFiles(user.username, currentPath);
                    loadUsage(user.username);
                  }}
                  onUploadFiles={handleUploadFiles}
                  onNewFolder={() => setShowNewFolderModal(true)}
                  onOpenFile={handleOpenItem}
                  onOpenInNewTab={handleOpenFileInNewTab}
                  onDownloadFile={handleDownloadItem}
                  onDeleteItem={handleDeleteItem}
                  onRenameItem={handleRenameItem}
                  onMetadataItem={(item) => setItemForMetadata(item)}
                  onPublicShareItem={(item) => setItemForPublicShare(item)}
                  onShareFolder={(item) => {
                    setFolderToShare(item);
                    setShowNewSharedModal(true);
                  }}
                  onManageShares={(item) => {
                    const itemPath = item.path || (currentPath ? `${currentPath}/${item.name}` : item.name);
                    setManageSharesFolder({ path: itemPath, name: item.name });
                  }}
                  searchTerm={searchTerm}
                  isActionsDisabled={isActionsDisabled}
                  rootLabel="Meine Ablage"
                  clipboard={clipboard}
                  onCopyItem={handleCopyItem}
                  onCutItem={handleCutItem}
                  onPaste={handlePasteItem}
                  onUploadClick={handleTriggerFileInput}
                />
              )}

              {currentTab === 'shared' && (
                <SharedSection
                  user={user}
                  shares={shares}
                  onAcceptShare={handleAcceptShare}
                  onDeclineShare={handleDeclineShare}
                  onRefreshShares={() => loadShares(user.username)}
                  viewMode={viewMode}
                  maintenanceMode={maintenanceMode}
                  onOpenNewSharedModal={() => setShowNewSharedModal(true)}
                  onManageFolderShares={(fPath, fName, fOwner) => {
                    setManageSharesFolder({ path: fPath, name: fName, owner: fOwner });
                  }}
                  onOpenFilePreview={(item, allItems) => {
                    if (openFilesInNewTab) {
                      handleOpenFileInNewTab(item, item.owner);
                    } else {
                      setViewerItem(item);
                      setViewerItemsList(allItems);
                    }
                  }}
                  onUploadTaskChange={setUploadTask}
                  clipboard={clipboard}
                  onCopyItem={handleCopyItem}
                  onCutItem={handleCutItem}
                  onPaste={async (targetShare, subPath) => {
                    if (targetShare) {
                      const fullTargetDir = subPath
                        ? `${targetShare.folder_path}/${subPath}`
                        : targetShare.folder_path;
                      await handlePasteItem(fullTargetDir, targetShare.owner, targetShare.id);
                    } else {
                      await handlePasteItem();
                    }
                  }}
                  onTriggerFileInput={handleTriggerFileInput}
                />
              )}

              {currentTab === 'admin' && user.role === 'master' && (
                <MasterDashboard
                  users={allUsers}
                  maintenanceMode={maintenanceMode}
                  onToggleMaintenance={handleToggleMaintenance}
                  onApproveUser={handleApproveUser}
                  onRejectUser={handleRejectUser}
                  onUpdateUserQuota={handleUpdateUserQuota}
                  onDeleteUser={handleDeleteUserAccount}
                  onRefreshUsers={loadAdminUsers}
                />
              )}
            </main>
          </div>

          {/* Mobile Footer Legal Links */}
          <footer className="md:hidden py-2 px-4 flex justify-center bg-[#f8fafd] dark:bg-gray-950 border-t border-gray-200/50 dark:border-gray-800/60 shrink-0">
            <LegalLinks />
          </footer>
        </>
      )}

      {/* Media Viewer Modal: Lightbox, Video Player, PDF Viewer */}
      <MediaViewerModal
        isOpen={Boolean(viewerItem) && !isCinemaMode && !isTvMode}
        onClose={() => setViewerItem(null)}
        activeItem={viewerItem}
        allItems={viewerItemsList}
        onDownload={handleDownloadItem}
      />

      {/* Manage Folder Shares Modal: Multiple users, delete shares, add new user, permission toggles */}
      {manageSharesFolder && (
        <ManageFolderSharesModal
          isOpen={Boolean(manageSharesFolder)}
          onClose={() => setManageSharesFolder(null)}
          folderPath={manageSharesFolder.path}
          folderName={manageSharesFolder.name}
          folderOwner={manageSharesFolder.owner}
          currentUser={user}
          onSharesUpdated={() => loadShares(user.username)}
        />
      )}

      {/* New Folder Modal */}
      <NewFolderModal
        isOpen={showNewFolderModal}
        onClose={() => setShowNewFolderModal(false)}
        onSuccess={() => {
          loadDirectoryFiles(user.username, currentPath);
        }}
        owner={user.username}
        currentPath={currentPath}
      />

      {/* New Shared Folder Modal */}
      <NewSharedFolderModal
        isOpen={showNewSharedModal}
        onClose={() => {
          setShowNewSharedModal(false);
          setFolderToShare(null);
        }}
        onSuccess={() => {
          loadShares(user.username);
          loadDirectoryFiles(user.username, currentPath);
        }}
        user={user}
        currentPath={currentPath}
        existingFolderName={folderToShare?.name}
      />

      {/* Central Settings Modal (Allgemein & Kontoeinstellungen) */}
      <SettingsModal
        isOpen={showAccountSettingsModal}
        onClose={() => setShowAccountSettingsModal(false)}
        user={user}
        onUserUpdated={handleUserUpdated}
        openFilesInNewTab={openFilesInNewTab}
        onToggleOpenFilesInNewTab={handleToggleOpenFilesInNewTab}
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        storageUsage={storageUsage}
        serverStatus={serverStatus}
      />

      {/* Rename Item Modal */}
      <RenameModal
        isOpen={Boolean(itemToRename)}
        item={itemToRename}
        currentPath={currentPath}
        username={user.username}
        onClose={() => setItemToRename(null)}
        onSuccess={(oldName, newName) => {
          addToast('success', 'Umbenannt', `"${oldName}" wurde zu "${newName}" umbenannt.`);
          loadDirectoryFiles(user.username, currentPath);
          loadUsage(user.username);
        }}
      />

      {/* Details & Description Modal */}
      <FileMetadataModal
        isOpen={Boolean(itemForMetadata)}
        item={itemForMetadata}
        currentPath={currentPath}
        username={user.username}
        onClose={() => setItemForMetadata(null)}
        onSaved={() => {
          addToast('success', 'Beschreibung gespeichert', 'Metadaten wurden auf dem Server hinterlegt.');
          loadDirectoryFiles(user.username, currentPath);
        }}
      />

      {/* Public Share Modal */}
      <PublicShareModal
        isOpen={Boolean(itemForPublicShare)}
        item={itemForPublicShare}
        currentPath={currentPath}
        username={user.username}
        onClose={() => setItemForPublicShare(null)}
      />

      {/* Add Account Modal (Multi-Account Switcher) */}
      {user && showAddAccountModal && (
        <AuthModal
          onSuccess={handleLoginSuccess}
          darkMode={darkMode}
          onClose={() => setShowAddAccountModal(false)}
          isAddAccountMode={true}
        />
      )}

      {/* Floating Chunked Upload Progress Widget */}
      <UploadProgressWidget
        task={uploadTask}
        onClose={() => setUploadTask(null)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <MainApp />
    </ToastProvider>
  );
}
