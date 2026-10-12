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
  checkServerStatus,
  type ServerStatus,
} from './services/storageApi';
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
import { CinemaTvView } from './components/CinemaTvView';
import { AccountSettingsModal } from './components/AccountSettingsModal';
import { MaintenanceBanner } from './components/MaintenanceBanner';
import { LegalLinks } from './components/LegalLinks';
import { ToastProvider, useToast } from './components/Toast';

const CURRENT_USER_KEY = 'jjcloud_session_user';
const DARK_MODE_KEY = 'jjcloud_dark_mode';
const VIEW_MODE_KEY = 'jjcloud_view_mode';

function MainApp() {
  const { addToast } = useToast();

  // User session
  const [user, setUser] = useState<UserAccount | null>(() => {
    try {
      const raw = localStorage.getItem(CURRENT_USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

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

  // UI state
  const [currentTab, setCurrentTab] = useState<NavigationTab>(getTabFromUrl);
  const [currentPath, setCurrentPath] = useState<string>('');

  // Synchronize browser history and path
  const navigateToTab = useCallback((tab: NavigationTab, replace = false) => {
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

  // Listen to browser Back/Forward (popstate)
  useEffect(() => {
    const handlePopState = () => {
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
    // Initial check on mount: If path was /vod or /tv, rewrite to canonical path
    if (typeof window !== 'undefined') {
      const path = window.location.pathname.toLowerCase().replace(/\/+$/, '');
      if (path === '/vod') {
        window.history.replaceState({ tab: 'cinema' }, '', '/cinema');
      } else if (path === '/tv') {
        window.history.replaceState({ tab: 'cinema-tv' }, '', '/cinema/tv');
      }
    }

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
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

  // Manage Shares Modal state
  const [manageSharesFolder, setManageSharesFolder] = useState<{ path: string; name: string } | null>(null);

  // Media Viewer Modal state
  const [viewerItem, setViewerItem] = useState<FileItemData | null>(null);
  const [viewerItemsList, setViewerItemsList] = useState<FileItemData[]>([]);

  // Discovered videos across directories for Cinema mode
  const [allCinemaVideos, setAllCinemaVideos] = useState<FileItemData[]>([]);

  // File upload input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scan for videos across directories when cinema mode is entered
  useEffect(() => {
    if (!user || currentTab !== 'cinema') return;
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
      invited.forEach((s) => map.set(s.id, s));
      owned.forEach((s) => map.set(s.id, s));
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
    }
  }, [user, currentPath, currentTab, loadDirectoryFiles]);

  const handleLoginSuccess = (loggedInUser: UserAccount) => {
    setUser(loggedInUser);
    setCurrentPath('');
    setCurrentTab('my-drive');
    addToast('success', 'Angemeldet', `Willkommen zurück, @${loggedInUser.username}!`);
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentPath('');
    setItems([]);
    addToast('info', 'Abgemeldet', 'Erfolgreich abgemeldet.');
  };

  // Upload handler with quota check
  const handleUploadFiles = async (files: FileList) => {
    if (!user) return;
    if (maintenanceMode && user.role !== 'master') {
      addToast('error', 'Wartungsmodus', 'Uploads sind während der Wartungsarbeiten deaktiviert.');
      return;
    }

    let successCount = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const res = await uploadFile(file, user.username, currentPath, storageUsage.used_bytes, user.quota_gb);
      if (!res.success) {
        addToast('error', 'Upload fehlgeschlagen', res.error);
        break;
      }
      successCount++;
    }

    if (successCount > 0) {
      addToast('success', 'Upload abgeschlossen', `${successCount} Datei(en) erfolgreich hochgeladen.`);
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
  const handleRenameItem = async (item: FileItemData) => {
    if (!user) return;
    if (maintenanceMode && user.role !== 'master') {
      addToast('error', 'Wartungsmodus', 'Aktion im Wartungsmodus pausiert.');
      return;
    }

    const newName = window.prompt(`Neuer Name für "${item.name}":`, item.name);
    if (!newName || newName.trim() === item.name) return;

    const res = await renameItem(user.username, currentPath, item.name, newName.trim());
    if (res.success) {
      addToast('success', 'Umbenannt', `"${item.name}" wurde zu "${newName.trim()}" umbenannt.`);
      loadDirectoryFiles(user.username, currentPath);
    } else {
      addToast('error', 'Fehler beim Umbenennen', res.error);
    }
  };

  // Download item handler
  const handleDownloadItem = async (item: FileItemData) => {
    if (!user) return;
    const fullItemPath = item.path || (currentPath ? `${currentPath}/${item.name}` : item.name);
    triggerDirectDownload(user.username, fullItemPath, item.name);
  };

  // Open item (files open preview modal, folders navigate)
  const handleOpenItem = (item: FileItemData) => {
    if (item.type === 'folder') {
      const nextPath = currentPath ? `${currentPath}/${item.name}` : item.name;
      setCurrentPath(nextPath);
    } else {
      setViewerItem(item);
      setViewerItemsList(items);
    }
  };

  // Share handlers
  const handleAcceptShare = async (shareId: string) => {
    await respondToShare(shareId, 'accepted');
    addToast('success', 'Einladung angenommen', 'Der Ordner wurde zum Geteilten Bereich hinzugefügt.');
    if (user) loadShares(user.username);
  };

  const handleDeclineShare = async (shareId: string) => {
    await respondToShare(shareId, 'declined');
    addToast('info', 'Einladung abgelehnt');
    if (user) loadShares(user.username);
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
    ? shares.filter(
        (s) => s.invited_user.toLowerCase() === user.username.toLowerCase() && s.status === 'pending'
      ).length
    : 0;

  if (!user) {
    return (
      <AuthModal
        onSuccess={handleLoginSuccess}
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
      />
    );
  }

  const isActionsDisabled = maintenanceMode && user.role !== 'master';
  const isCinemaMode = currentTab === 'cinema' || currentTab === 'cinema-tv';

  return (
    <div className={`h-full flex flex-col ${isCinemaMode ? 'bg-[#141414] text-white' : 'bg-[#f8fafd] dark:bg-gray-950 text-gray-900 dark:text-gray-100'} overflow-hidden font-sans`}>
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
        <div className="fixed inset-0 z-50 bg-[#141414] overflow-y-auto">
          <CinemaTvView
            user={user}
            items={allCinemaVideos.length > 0 ? allCinemaVideos : items}
            onBackToFiles={() => navigateToTab('my-drive')}
            onPlayVideo={(item) => {
              setViewerItem(item);
              setViewerItemsList(allCinemaVideos.length > 0 ? allCinemaVideos : items);
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
            onPlayVideo={(item) => {
              setViewerItem(item);
              setViewerItemsList(allCinemaVideos.length > 0 ? allCinemaVideos : items);
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
            onLogout={handleLogout}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            darkMode={darkMode}
            onToggleDarkMode={toggleDarkMode}
            serverStatus={serverStatus}
            onRefreshServerStatus={handleRetryConnection}
            onOpenSettings={() => setShowAccountSettingsModal(true)}
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
                  onDownloadFile={handleDownloadItem}
                  onDeleteItem={handleDeleteItem}
                  onRenameItem={handleRenameItem}
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
                  onManageFolderShares={(fPath, fName) => {
                    setManageSharesFolder({ path: fPath, name: fName });
                  }}
                  onOpenFilePreview={(item, allItems) => {
                    setViewerItem(item);
                    setViewerItemsList(allItems);
                  }}
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
        isOpen={Boolean(viewerItem)}
        onClose={() => setViewerItem(null)}
        activeItem={viewerItem}
        allItems={viewerItemsList}
        onDownload={handleDownloadItem}
      />

      {/* Manage Folder Shares Modal: Multiple users, delete shares, add new user */}
      {manageSharesFolder && (
        <ManageFolderSharesModal
          isOpen={Boolean(manageSharesFolder)}
          onClose={() => setManageSharesFolder(null)}
          folderPath={manageSharesFolder.path}
          folderName={manageSharesFolder.name}
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

      {/* Account Settings Modal */}
      <AccountSettingsModal
        isOpen={showAccountSettingsModal}
        onClose={() => setShowAccountSettingsModal(false)}
        user={user}
        onUserUpdated={handleUserUpdated}
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
