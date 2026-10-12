import React, { useState } from 'react';
import {
  Search,
  LayoutGrid,
  List,
  Sun,
  Moon,
  LogOut,
  Shield,
  User as UserIcon,
  Menu,
  X,
  Settings,
  Film
} from 'lucide-react';
import type { UserAccount, ViewMode, NavigationTab } from '../types';
import type { ServerStatus } from '../services/storageApi';

interface HeaderProps {
  user: UserAccount | null;
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

        {/* Dark Mode */}
        <button
          onClick={onToggleDarkMode}
          className="p-2 rounded-full text-gray-600 dark:text-gray-400 hover:bg-gray-200/60 dark:hover:bg-gray-800 transition-colors"
          title={darkMode ? 'Heller Modus' : 'Dunkler Modus'}
        >
          {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* User Profile Avatar & Menu */}
        {user ? (
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2 p-0.5 rounded-full hover:ring-2 hover:ring-blue-500/40 transition-all focus:outline-none"
              aria-label="Profilmenü"
            >
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs uppercase flex items-center justify-center shadow-xs">
                {user.username.slice(0, 2)}
              </div>
            </button>

            {showProfileMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowProfileMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2.5 font-bold text-sm text-gray-900 dark:text-gray-100">
                      <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center uppercase">
                        {user.username.slice(0, 2)}
                      </div>
                      <div className="truncate">
                        <div className="truncate">@{user.username}</div>
                        <div className="text-[11px] font-normal text-gray-500 flex items-center gap-1">
                          {user.role === 'master' ? (
                            <span className="text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1">
                              <Shield className="w-3 h-3" /> Master-Account
                            </span>
                          ) : (
                            <span>{user.quota_gb} GB Speicherplatz</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="px-1.5 py-1.5 space-y-0.5">
                    {/* Cinema / Video on Demand Button in Profile Dropdown */}
                    {onSelectTab && (
                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          onSelectTab('cinema');
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-[#E50914] dark:hover:text-[#E50914] rounded-xl text-left transition-colors group"
                      >
                        <div className="flex items-center gap-2.5">
                          <Film className="w-4 h-4 text-[#E50914] group-hover:scale-110 transition-transform" />
                          <span>Cinema (Video on Demand)</span>
                        </div>
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-[#E50914]/10 text-[#E50914]">
                          VOD
                        </span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        onOpenSettings();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-left transition-colors"
                    >
                      <Settings className="w-4 h-4 text-gray-500" />
                      <span>Kontoeinstellungen</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl text-left transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Abmelden</span>
                    </button>
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
