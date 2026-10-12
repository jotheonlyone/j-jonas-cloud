import React, { useState } from 'react';
import { FolderPlus, Share2, X, User, AlertCircle } from 'lucide-react';
import { createFolderShare } from '../services/firebase';
import { createFolder } from '../services/storageApi';
import { useToast } from './Toast';
import type { UserAccount } from '../types';

interface NewFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  owner: string;
  currentPath: string;
}

export const NewFolderModal: React.FC<NewFolderModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  owner,
  currentPath,
}) => {
  const { addToast } = useToast();
  const [folderName, setFolderName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) return;

    setIsSubmitting(true);
    const res = await createFolder(owner, currentPath, folderName.trim());
    setIsSubmitting(false);

    if (res.success) {
      addToast('success', 'Ordner erstellt', `Ordner "${folderName.trim()}" wurde erfolgreich angelegt.`);
      setFolderName('');
      onSuccess();
      onClose();
    } else {
      addToast('error', 'Fehler beim Erstellen', res.error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs select-none">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl p-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100 font-bold text-base">
            <FolderPlus className="w-5 h-5 text-amber-500" />
            <span>Neuer Ordner</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Ordnername
            </label>
            <input
              type="text"
              required
              autoFocus
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="Ordnername"
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-gray-800"
            />
            {currentPath && (
              <p className="text-[11px] text-gray-400 mt-1 font-mono">
                Wird erstellt in: /{currentPath}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !folderName.trim()}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Wird erstellt...' : 'Erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface NewSharedFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user: UserAccount;
  currentPath: string;
  existingFolderName?: string;
}

export const NewSharedFolderModal: React.FC<NewSharedFolderModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  user,
  currentPath,
  existingFolderName = '',
}) => {
  const { addToast } = useToast();
  const [folderName, setFolderName] = useState(existingFolderName || '');
  const [targetUsername, setTargetUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmedFolder = folderName.trim();
    const trimmedTarget = targetUsername.trim().toLowerCase();

    if (!trimmedFolder) {
      setErrorMsg('Bitte einen Ordnernamen angeben.');
      return;
    }
    if (!trimmedTarget) {
      setErrorMsg('Bitte den Ziel-Benutzernamen angeben.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (!existingFolderName) {
        await createFolder(user.username, currentPath, trimmedFolder);
      }

      const folderPath = currentPath ? `${currentPath}/${trimmedFolder}` : trimmedFolder;

      const shareRes = await createFolderShare(
        folderPath,
        trimmedFolder,
        user.username,
        trimmedTarget
      );

      if (shareRes.success) {
        addToast(
          'success',
          'Freigabe-Einladung versendet',
          `Einladung für Ordner "${trimmedFolder}" an @${trimmedTarget} gesendet.`
        );
        onSuccess();
        onClose();
      } else {
        setErrorMsg(shareRes.error || 'Fehler beim Erstellen der Freigabe.');
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Fehler aufgetreten.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs select-none">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl p-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100 font-bold text-base">
            <Share2 className="w-5 h-5 text-emerald-500" />
            <span>Neuer geteilter Ordner</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-start gap-2 text-xs text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Ordnername
            </label>
            <input
              type="text"
              required
              disabled={Boolean(existingFolderName)}
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="Ordnername"
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-70"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Ziel-Benutzername
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                required
                autoFocus
                value={targetUsername}
                onChange={(e) => setTargetUsername(e.target.value)}
                placeholder="Benutzername"
                className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              Wird in Firestore auf Existenz und Freischaltung geprüft.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-xs text-blue-800 dark:text-blue-300 border border-blue-100 dark:border-blue-900/50">
            <strong>Speicher-Regel:</strong> Alle Dateien, die in diesen geteilten Ordner geladen werden,
            belasten ausschließlich dein persönliches Speicherkontingent ({user.quota_gb} GB).
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !folderName.trim() || !targetUsername.trim()}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Wird geprüft...' : 'Freigeben & Einladen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
