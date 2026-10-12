import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  HardDrive,
  Users,
  Shield,
  Upload,
  FolderPlus,
  Share2,
  AlertTriangle,
  Database
} from 'lucide-react';
import type { NavigationTab, StorageUsage, UserAccount } from '../types';
import { formatBytes } from '../services/storageApi';
import { LegalLinks } from './LegalLinks';

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  user: UserAccount;
  storageUsage: StorageUsage;
  pendingSharesCount: number;
  maintenanceMode: boolean;
  onUploadClick: () => void;
  onNewFolderClick: () => void;
  onNewSharedFolderClick: () => void;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  user,
  storageUsage,
  pendingSharesCount,
  maintenanceMode,
  onUploadClick,
  onNewFolderClick,
  onNewSharedFolderClick,
  onCloseMobile,
}) => {
  const [showNewDropdown, setShowNewDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNewDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const quotaBytes = user.quota_gb * 1024 * 1024 * 1024;
  const usedBytes = storageUsage.used_bytes;
  const usagePercentage = Math.min(100, Math.round((usedBytes / quotaBytes) * 100) || 0);
  const isHighUsage = usagePercentage >= 90;

  const handleTabClick = (tab: NavigationTab) => {
    onSelectTab(tab);
    if (onCloseMobile) onCloseMobile();
  };

  const isActionsDisabled = maintenanceMode && user.role !== 'master';

  return (
    <aside className="w-64 h-full flex flex-col justify-between p-4 bg-[#f8fafd] dark:bg-gray-950 select-none">
      {/* Upper Area: Google Drive "+ Neu" Button & Navigation */}
      <div className="space-y-4">
        {/* "+ Neu" Google Drive Authentic Pill Button */}
        <div className="relative pt-1 pb-2" ref={dropdownRef}>
          <button
            onClick={() => !isActionsDisabled && setShowNewDropdown(!showNewDropdown)}
            disabled={isActionsDisabled}
            className={`flex items-center gap-3 py-3 px-6 rounded-full font-semibold text-sm transition-all shadow-sm ${
              isActionsDisabled
                ? 'bg-gray-100 dark:bg-gray-900 text-gray-400 dark:text-gray-600 cursor-not-allowed border border-gray-200 dark:border-gray-800'
                : 'bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 hover:shadow-md hover:bg-gray-50/90 dark:hover:bg-gray-800 border border-gray-200/70 dark:border-gray-700 active:scale-98'
            }`}
          >
            <Plus className="w-5 h-5 text-blue-600 dark:text-blue-400 stroke-[2.5]" />
            <span className="text-sm font-semibold tracking-tight">Neu</span>
          </button>

          {/* Dropdown Menu */}
          {showNewDropdown && (
            <div className="absolute left-0 top-full mt-1.5 w-60 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl py-2 z-40 animate-in fade-in zoom-in-95 duration-100">
              <button
                onClick={() => {
                  setShowNewDropdown(false);
                  onNewFolderClick();
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
              >
                <FolderPlus className="w-4 h-4 text-amber-500" />
                <span>Neuer Ordner</span>
              </button>

              <div className="h-px bg-gray-100 dark:bg-gray-800 my-1" />

              <button
                onClick={() => {
                  setShowNewDropdown(false);
                  onUploadClick();
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
              >
                <Upload className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Datei hochladen</span>
              </button>

              <button
                onClick={() => {
                  setShowNewDropdown(false);
                  onNewSharedFolderClick();
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
              >
                <Share2 className="w-4 h-4 text-emerald-500" />
                <span>Neuer geteilter Ordner</span>
              </button>
            </div>
          )}
        </div>

        {/* Navigation Items with Google Drive Pill Active State */}
        <nav className="space-y-1">
          <button
            onClick={() => handleTabClick('my-drive')}
            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-colors ${
              currentTab === 'my-drive'
                ? 'bg-[#c2e7ff] text-[#001d35] dark:bg-blue-950/70 dark:text-blue-200'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-gray-800'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <HardDrive
                className={`w-4 h-4 ${
                  currentTab === 'my-drive'
                    ? 'text-[#001d35] dark:text-blue-300'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              />
              <span>Meine Ablage</span>
            </div>
          </button>

          <button
            onClick={() => handleTabClick('shared')}
            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-colors ${
              currentTab === 'shared'
                ? 'bg-[#c2e7ff] text-[#001d35] dark:bg-blue-950/70 dark:text-blue-200'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-gray-800'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <Users
                className={`w-4 h-4 ${
                  currentTab === 'shared'
                    ? 'text-[#001d35] dark:text-blue-300'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              />
              <span>Geteilter Bereich</span>
            </div>
            {pendingSharesCount > 0 && (
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-600 text-white">
                {pendingSharesCount}
              </span>
            )}
          </button>

          {user.role === 'master' && (
            <button
              onClick={() => handleTabClick('admin')}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-colors ${
                currentTab === 'admin'
                  ? 'bg-purple-100 text-purple-900 dark:bg-purple-950/70 dark:text-purple-200'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-gray-800'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <Shield
                  className={`w-4 h-4 ${
                    currentTab === 'admin'
                      ? 'text-purple-700 dark:text-purple-300'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                />
                <span>Master-Verwaltung</span>
              </div>
            </button>
          )}
        </nav>
      </div>

      {/* Lower Area: Storage Quota Display */}
      <div className="pt-4 border-t border-gray-200/60 dark:border-gray-800/80">
        <div className="px-3 py-3 rounded-2xl bg-white/70 dark:bg-gray-900/60 border border-gray-200/60 dark:border-gray-800">
          <div className="flex items-center justify-between mb-1.5">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
              <Database className="w-3.5 h-3.5 text-gray-400" />
              Speicherplatz
            </span>
            <span
              className={`text-xs font-mono font-bold tabular-nums ${
                isHighUsage ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              {usagePercentage}%
            </span>
          </div>

          <div className="w-full h-1.5 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden mb-2">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isHighUsage ? 'bg-red-600' : 'bg-blue-600'
              }`}
              style={{ width: `${usagePercentage}%` }}
            />
          </div>

          <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono tabular-nums">
            {formatBytes(usedBytes)} von {user.quota_gb} GB belegt
          </p>

          {isHighUsage && (
            <div className="mt-2 flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400 font-medium">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              <span>Speicher fast voll</span>
            </div>
          )}
        </div>

        {/* Rechtliche Pflichtlinks */}
        <div className="mt-3.5 flex justify-center">
          <LegalLinks />
        </div>
      </div>
    </aside>
  );
};
