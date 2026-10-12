import React, { useState } from 'react';
import { User, Lock, X, Check, AlertCircle, KeyRound, UserCheck, Eye, EyeOff } from 'lucide-react';
import { changePassword, changeUsername } from '../services/firebase';
import { useToast } from './Toast';
import type { UserAccount } from '../types';

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserAccount;
  onUserUpdated: (updatedUser: UserAccount) => void;
}

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({
  isOpen,
  onClose,
  user,
  onUserUpdated,
}) => {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'password' | 'username'>('password');

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Username state
  const [newUsername, setNewUsername] = useState(user.username);
  const [isUsernameSubmitting, setIsUsernameSubmitting] = useState(false);
  const [usernameError, setUsernameError] = useState('');

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

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUsernameError('');

    const trimmed = newUsername.trim().toLowerCase();
    if (trimmed === user.username.toLowerCase()) {
      setUsernameError('Der neue Benutzername ist identisch mit dem aktuellen.');
      return;
    }
    if (trimmed.length < 3) {
      setUsernameError('Der Benutzername muss mindestens 3 Zeichen lang sein.');
      return;
    }

    setIsUsernameSubmitting(true);
    try {
      const res = await changeUsername(user.username, trimmed);
      if (res.success && res.user) {
        addToast(
          'success',
          'Benutzername geändert',
          `Dein Benutzername wurde zu "@${res.user.username}" geändert.`
        );
        onUserUpdated(res.user);
        onClose();
      } else {
        setUsernameError(res.error || 'Fehler beim Ändern des Benutzernamens.');
        addToast('error', 'Fehler', res.error || 'Benutzername konnte nicht geändert werden.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unerwarteter Fehler.';
      setUsernameError(msg);
    } finally {
      setIsUsernameSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs select-none">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl p-6 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-gray-900 dark:text-gray-100">
                Kontoeinstellungen
              </h3>
              <p className="text-xs text-gray-500">Angemeldet als @{user.username}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1 mt-4">
          <button
            type="button"
            onClick={() => setActiveTab('password')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'password'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Passwort ändern</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('username')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'username'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Benutzername</span>
          </button>
        </div>

        {/* Tab 1: Password Change */}
        {activeTab === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="mt-4 space-y-3.5">
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
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
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
                  placeholder="Neues Passwort"
                  className="w-full pl-9 pr-9 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-gray-800"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
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
                  placeholder="Passwort bestätigen"
                  className="w-full pl-9 pr-9 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-gray-800"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={isPasswordSubmitting}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors disabled:opacity-50"
              >
                {isPasswordSubmitting ? 'Wird gespeichert...' : 'Passwort aktualisieren'}
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Username Change */}
        {activeTab === 'username' && (
          <form onSubmit={handleUsernameSubmit} className="mt-4 space-y-3.5">
            {usernameError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-start gap-2 text-xs text-red-700 dark:text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{usernameError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Aktueller Benutzername
              </label>
              <p className="text-xs font-mono px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                @{user.username}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Neuer Benutzername
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Benutzername"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-gray-800"
                />
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                Wird in Firestore auf Verfügbarkeit überprüft.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={isUsernameSubmitting}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors disabled:opacity-50"
              >
                {isUsernameSubmitting ? 'Wird geprüft...' : 'Benutzername ändern'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
