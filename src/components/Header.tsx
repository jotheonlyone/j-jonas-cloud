import React, { useState } from 'react';
import {
  Search,
  LayoutGrid,
  List,
  LogOut,
  Shield,
  User as UserIcon,
  Menu,
  X,
  Settings,
  Film,
  UserPlus,
  CheckCircle2,
  Users,
  ChevronRight
} from 'lucide-react';
import type { UserAccount, ViewMode, NavigationTab } from '../types';
import type { ServerStatus } from '../services/storageApi';

interface HeaderProps {
  user: UserAccount | null;
  savedAccounts?: UserAccount[];
  onSwitchAccount?: (targetUser: UserAccount) => void;
  onAddAccount?: () => void;
  onLogoutCurrentAccount?: () => void;
  onLogoutAllAccounts?: () => void;
  onLogout: () => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  searchTerm: string;
  onSearchChange: (val: string) => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  serverStatus: ServerStatus | null;
  onRefreshServerStatus?: () => void;
  onOpenSettings: () => void;
  onToggleMobileMenu?: () => void;
  onLogoClick?: () => void;
  currentTab?: NavigationTab;
  onSelectTab?: (tab: NavigationTab) => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  savedAccounts = [],
  onSwitchAccount,
  onAddAccount,
  onLogoutCurrentAccount,
  onLogoutAllAccounts,
  onLogout,
  viewMode,
  onViewModeChange,
  searchTerm,
  onSearchChange,
  darkMode,
  onToggleDarkMode,
  serverStatus,
  onRefreshServerStatus,
  onOpenSettings,
  onToggleMobileMenu,
  onLogoClick,
  currentTab,
  onSelectTab,
}) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 px-4 sm:px-6 py-2.5 bg-[#f8fafd] dark:bg-gray-950 border-b border-gray-200/70 dark:border-gray-800">
      {/* Left: Mobile Trigger & Required Brand Logo */}
      <div className="flex items-center gap-3">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-2 rounded-full text-gray-600 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-200/60 dark:hover:bg-gray-800 transition-colors"
            aria-label="Menü öffnen"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div
          onClick={onLogoClick}
          className="flex items-center gap-2 select-none cursor-pointer"
          style={{
            fontFamily:
              'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          }}
        >
          <span
            className="font-black tracking-tight text-2xl md:text-3xl text-blue-600 hover:text-blue-700 dark:text-blue-500 dark:hover:text-blue-400 transition-colors"
            style={{
              filter: 'drop-shadow(0 4px 12px rgba(37, 99, 235, 0.25))',
            }}
          >
            J.Jonas Cloud
          </span>
        </div>
      </div>

      {/* Center: Google Drive Search Bar */}
      {user && (
        <div className="flex-1 max-w-2xl mx-2 hidden sm:block">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 transition-colors" />
            <input
              type="text"
              placeholder="In J.Jonas Cloud suchen..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-11 pr-10 py-2.5 text-sm rounded-full bg-[#e9eef6] dark:bg-gray-800/90 border border-transparent dark:border-gray-700/60 focus:border-blue-500/40 focus:bg-white dark:focus:bg-gray-800 focus:shadow-md focus:outline-none transition-all placeholder:text-gray-500 dark:placeholder:text-gray-400 text-gray-900 dark:text-gray-100"
            />
            {searchTerm && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* View Switcher (Grid / List) */}
        {user && (
          <div className="flex items-center bg-gray-200/60 dark:bg-gray-800 rounded-full p-0.5">
            <button
              onClick={() => onViewModeChange('grid')}
              className={`p-1.5 rounded-full transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
              title="Rasteransicht"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => onViewModeChange('list')}
              className={`p-1.5 rounded-full transition-colors ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
              title="Listenansicht"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        )}


        {/* User Profile Avatar & Menu */}
        {user ? (
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2 p-0.5 rounded-full hover:ring-2 hover:ring-blue-500/40 transition-all focus:outline-none cursor-pointer"
              aria-label="Profilmenü und Konten-Wechsler"
              title={`Angemeldet als @${user.username}`}
            >
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs uppercase flex items-center justify-center shadow-xs ring-2 ring-white dark:ring-gray-900">
                {user.username.slice(0, 2)}
              </div>
            </button>

            {showProfileMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowProfileMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100 divide-y divide-gray-100 dark:divide-gray-800 select-none">
                  {/* 1. Aktuelles aktives Konto */}
                  <div className="p-3">
                    <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 flex items-start justify-between gap-2.5">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold text-sm uppercase flex items-center justify-center shadow-xs shrink-0 mt-0.5">
                          {user.username.slice(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-gray-900 dark:text-gray-100 truncate">
                            @{user.username}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1 truncate">
                            {user.role === 'master' ? (
                              <span className="text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1">
                                <Shield className="w-3.5 h-3.5 shrink-0" /> Master-Admin
                              </span>
                            ) : (
                              <span>{user.quota_gb} GB Speicher</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Aktiv-Markierung mit Häkchen */}
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-950/70 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800 shrink-0">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        Aktiv
                      </span>
                    </div>
                  </div>

                  {/* 2. Liste weiterer gespeicherter Konten (Schnellwechsel ohne Passwort) */}
                  {(() => {
                    const otherAccounts = savedAccounts.filter(
                      (acc) => acc.username.toLowerCase() !== user.username.toLowerCase()
                    );
                    if (otherAccounts.length === 0) return null;

                    return (
                      <div className="p-2 space-y-1">
                        <div className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                          Gespeicherte Konten ({otherAccounts.length})
                        </div>
                        {otherAccounts.map((acc) => (
                          <button
                            key={acc.username}
                            type="button"
                            onClick={() => {
                              setShowProfileMenu(false);
                              if (onSwitchAccount) {
                                onSwitchAccount(acc);
                              }
                            }}
                            className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left group cursor-pointer"
                            title={`Zu @${acc.username} wechseln`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold text-xs uppercase flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                {acc.username.slice(0, 2)}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                                  @{acc.username}
                                </div>
                                <div className="text-[11px] text-gray-400 dark:text-gray-500 truncate">
                                  {acc.role === 'master' ? 'Master-Admin' : `${acc.quota_gb} GB`}
                                </div>
                              </div>
                            </div>
                            <span className="text-xs font-semibold text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              Wechseln
                              <ChevronRight className="w-3.5 h-3.5" />
                            </span>
                          </button>
                        ))}
                      </div>
                    );
                  })()}

                  {/* 3. Button: Weiteres Konto hinzufügen */}
                  <div className="p-1.5 space-y-0.5">
                    {onAddAccount && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowProfileMenu(false);
                          onAddAccount();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-xl text-left transition-colors cursor-pointer"
                      >
                        <UserPlus className="w-4 h-4 shrink-0" />
                        <span>Weiteres Konto hinzufügen</span>
                      </button>
                    )}

                    {onSelectTab && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowProfileMenu(false);
                          onSelectTab('cinema');
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-[#E50914] dark:hover:text-[#E50914] rounded-xl text-left transition-colors group cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <Film className="w-4 h-4 text-[#E50914] group-hover:scale-110 transition-transform shrink-0" />
                          <span>Cinema (Video on Demand)</span>
                        </div>
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-[#E50914]/10 text-[#E50914]">
                          VOD
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        onOpenSettings();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-left transition-colors cursor-pointer"
                    >
                      <Settings className="w-4 h-4 text-gray-500 shrink-0" />
                      <span>Einstellungen</span>
                    </button>
                  </div>

                  {/* 4. Abmelde-Optionen */}
                  <div className="p-1.5 space-y-0.5">
                    {/* Button: Vom aktuellen Konto abmelden */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        if (onLogoutCurrentAccount) {
                          onLogoutCurrentAccount();
                        } else {
                          onLogout();
                        }
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl text-left transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 shrink-0" />
                      <span>Vom aktuellen Konto abmelden</span>
                    </button>

                    {/* Button: Von allen Konten abmelden (wenn mehrere Konten hinterlegt sind) */}
                    {savedAccounts.length > 1 && onLogoutAllAccounts && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowProfileMenu(false);
                          onLogoutAllAccounts();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-left transition-colors cursor-pointer"
                      >
                        <Users className="w-4 h-4 shrink-0" />
                        <span>Von allen Konten abmelden ({savedAccounts.length})</span>
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>
    </header>
  );
};
