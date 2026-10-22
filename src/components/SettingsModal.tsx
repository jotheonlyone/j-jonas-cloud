import React, { useState } from 'react';
import {
  User,
  Lock,
  X,
  AlertCircle,
  KeyRound,
  UserCheck,
  Eye,
  EyeOff,
  Settings,
  Sliders,
  ExternalLink,
  Sun,
  Moon,
  LayoutGrid,
  List,
  HardDrive,
  Server,
  ShieldCheck,
  Check
} from 'lucide-react';
import { changePassword } from '../services/firebase';
import { useToast } from './Toast';
import type { UserAccount, ViewMode, StorageUsage } from '../types';
import type { ServerStatus } from '../services/storageApi';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserAccount;
  onUserUpdated: (updatedUser: UserAccount) => void;
  openFilesInNewTab: boolean;
  onToggleOpenFilesInNewTab: (val: boolean) => void;
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  storageUsage?: StorageUsage;
  serverStatus?: ServerStatus | null;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  user,
  onUserUpdated,
  openFilesInNewTab,
  onToggleOpenFilesInNewTab,
  darkMode,
  onToggleDarkMode,
  viewMode,
  onViewModeChange,
  storageUsage,
  serverStatus,
}) => {
  const { addToast } = useToast();

  // Top-level Category Tab: 'general' vs 'account'
  const [activeCategory, setActiveCategory] = useState<'general' | 'account'>('general');

  // Account sub-tab: 'password' vs 'username'
  const [accountSubTab, setAccountSubTab] = useState<'password' | 'username'>('password');

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  if (!isOpen) return null;

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (!currentPassword) {
      setPasswordError('Bitte gib dein aktuelles Passwort ein.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('Das neue Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Die neuen Passwörter stimmen nicht überein.');
      return;
    }

    setIsPasswordSubmitting(true);
    try {
      const res = await changePassword(user.username, currentPassword, newPassword);
      if (res.success && res.user) {
        addToast('success', 'Passwort geändert', 'Dein Passwort wurde erfolgreich aktualisiert.');
        onUserUpdated(res.user);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        onClose();
      } else {
        setPasswordError(res.error || 'Fehler beim Ändern des Passworts.');
        addToast('error', 'Fehler', res.error || 'Passwortänderung fehlgeschlagen.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unerwarteter Fehler.';
      setPasswordError(msg);
    } finally {
      setIsPasswordSubmitting(false);
    }
  };

  const usedGb = storageUsage?.used_gb ?? 0;
  const totalQuotaGb = user.quota_gb || 25;
  const usagePercent = Math.min(Math.round((usedGb / totalQuotaGb) * 100), 100);

  return (
    <div className="no-aero-scope fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none animate-in fade-in duration-150">
      <div className="settings-modal no-aero-scope w-full max-w-lg rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl p-6 animate-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-gray-900 dark:text-gray-100">
                Einstellungen
              </h3>
              <p className="text-xs text-gray-500">Angemeldet als @{user.username}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="normal-btn p-1.5 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top-Level Tabs: "Allgemein" & "Kontoeinstellungen" */}
        <div className="flex rounded-2xl bg-gray-100 dark:bg-gray-800/80 p-1.5 mt-4 shrink-0 border border-gray-200/50 dark:border-gray-700/50">
          <button
            type="button"
            onClick={() => setActiveCategory('general')}
            className={`normal-btn flex-1 py-2 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeCategory === 'general'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Allgemein</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('account')}
            className={`normal-btn flex-1 py-2 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeCategory === 'account'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Kontoeinstellungen</span>
          </button>
        </div>

        {/* Body content with scroll */}
        <div className="flex-1 overflow-y-auto mt-4 pr-1 space-y-4">
          {/* TAB 1: ALLGEMEIN */}
          {activeCategory === 'general' && (
            <div className="space-y-4">
              {/* Option: Dateien standardmäßig in neuem Tab öffnen */}
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200/80 dark:border-gray-700/80">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5">
                      <ExternalLink className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100">
                        Dateien standardmäßig in neuem Tab öffnen
                      </h4>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                        Ein Klick oder Doppelklick auf eine Datei öffnet diese direkt in einem neuen, fokussierten Vorschau-Tab im Browser (anstelle des In-App-Overlays).
                      </p>
                      <span className="inline-block mt-2 text-[10px] font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                        {openFilesInNewTab ? 'Aktiviert (Neuer Tab)' : 'Deaktiviert (In-App-Modal)'}
                      </span>
                    </div>
                  </div>

                  {/* Toggle Switch Button */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={openFilesInNewTab}
                    onClick={() => onToggleOpenFilesInNewTab(!openFilesInNewTab)}
                    className={`normal-btn relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      openFilesInNewTab ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        openFilesInNewTab ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Erscheinungsbild & Theme */}
              {onToggleDarkMode && (
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200/80 dark:border-gray-700/80">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-500 shrink-0">
                        {darkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100">
                          Erscheinungsbild
                        </h4>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                          Wechsel zwischen hellem und dunklem Design
                        </p>
                      </div>
                    </div>

                    <div className="flex rounded-xl bg-gray-200 dark:bg-gray-700 p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => darkMode && onToggleDarkMode()}
                        className={`normal-btn flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                          !darkMode ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        <Sun className="w-3.5 h-3.5 text-amber-500" />
                        <span>Hell</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => !darkMode && onToggleDarkMode()}
                        className={`normal-btn flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                          darkMode ? 'bg-gray-800 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        <Moon className="w-3.5 h-3.5 text-blue-400" />
                        <span>Dunkel</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Ansichtsmodus */}
              {onViewModeChange && viewMode && (
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200/80 dark:border-gray-700/80">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-500 shrink-0">
                        <LayoutGrid className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100">
                          Dateiansicht
                        </h4>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                          Kachel- oder Listenlayout für Ordner und Dateien
                        </p>
                      </div>
                    </div>

                    <div className="flex rounded-xl bg-gray-200 dark:bg-gray-700 p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => onViewModeChange('grid')}
                        className={`normal-btn flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                          viewMode === 'grid' ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-xs' : 'text-gray-500'
                        }`}
                      >
                        <LayoutGrid className="w-3.5 h-3.5" />
                        <span>Kacheln</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onViewModeChange('list')}
                        className={`normal-btn flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                          viewMode === 'list' ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-xs' : 'text-gray-500'
                        }`}
                      >
                        <List className="w-3.5 h-3.5" />
                        <span>Liste</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Speicherserver-Info */}
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200/80 dark:border-gray-700/80">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-500 shrink-0">
                      <Server className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100">
                        Speicherserver
                      </h4>
                      <p className="text-[11px] font-mono text-gray-400">https://storage.j-jonas.com</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        serverStatus?.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                      }`}
                    />
                    <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-300">
                      {serverStatus?.isOnline
                        ? `Online (${serverStatus.latencyMs ?? 0} ms)`
                        : 'Offline'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: KONTOEINSTELLUNGEN */}
          {activeCategory === 'account' && (
            <div className="space-y-4">
              {/* Account Quota & Info Card */}
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200/80 dark:border-gray-700/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-500 shrink-0">
                      <HardDrive className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100">
                        Speicherplatz & Quota
                      </h4>
                      <p className="text-[11px] text-gray-500">
                        Rolle: <span className="font-semibold capitalize">{user.role}</span> · Status:{' '}
                        <span className="text-emerald-500 font-semibold">{user.status}</span>
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                    {usagePercent}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      usagePercent > 90 ? 'bg-red-500' : usagePercent > 75 ? 'bg-amber-500' : 'bg-blue-600'
                    }`}
                    style={{ width: `${Math.max(usagePercent, 2)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-gray-500">
                  <span>{usedGb.toFixed(2)} GB belegt</span>
                  <span>{totalQuotaGb} GB Gesamt</span>
                </div>
              </div>

              {/* Sub-Tabs: Passwort vs Benutzername */}
              <div className="flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1">
                <button
                  type="button"
                  onClick={() => setAccountSubTab('password')}
                  className={`normal-btn flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                    accountSubTab === 'password'
                      ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Passwort ändern</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAccountSubTab('username')}
                  className={`normal-btn flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                    accountSubTab === 'username'
                      ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Benutzername</span>
                </button>
              </div>

              {/* Form 1: Password Change */}
              {accountSubTab === 'password' && (
                <form onSubmit={handlePasswordSubmit} className="space-y-3 pt-1">
                  {passwordError && (
                    <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-start gap-2 text-xs text-red-700 dark:text-red-300">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{passwordError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Aktuelles Passwort
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        required
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Aktuelles Passwort"
                        className="w-full pl-9 pr-9 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-gray-800"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="normal-btn absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                      >
                        {showCurrentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Neues Passwort
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Mindestens 6 Zeichen"
                        className="w-full pl-9 pr-9 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-gray-800"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="normal-btn absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                      >
                        {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Passwort bestätigen
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Neues Passwort wiederholen"
                        className="w-full pl-9 pr-9 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-gray-800"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="normal-btn absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                      >
                        {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <button
                      type="submit"
                      disabled={isPasswordSubmitting}
                      className="normal-btn px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {isPasswordSubmitting ? 'Wird gespeichert...' : 'Passwort aktualisieren'}
                    </button>
                  </div>
                </form>
              )}

              {/* Form 2: Username View (readOnly / disabled) */}
              {accountSubTab === 'username' && (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Benutzername
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        readOnly
                        disabled
                        value={user.username}
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-mono cursor-not-allowed select-none focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 flex items-start gap-2.5 text-xs text-blue-700 dark:text-blue-300">
                    <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="font-semibold">Benutzername ist unveränderlich</p>
                      <p className="text-[11px] text-blue-600/90 dark:text-blue-400/90">
                        Benutzernamen sind fest an die Domain (@cloud.j-jonas.com) und das Benutzerverzeichnis gebunden und können nicht geändert werden.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Backwards-compatible export
export { SettingsModal as AccountSettingsModal };
