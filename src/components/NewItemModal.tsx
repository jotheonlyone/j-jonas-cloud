import React, { useState, useEffect } from 'react';
import { FolderPlus, Share2, X, User, AlertCircle, Plus, Trash2, Users, Loader2, WifiOff, AlertTriangle } from 'lucide-react';
import { createFolderShare } from '../services/firebase';
import { createFolder, checkServerStatus } from '../services/storageApi';
import { validateItemName, filterNameInput } from '../utils/nameSanitizer';
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
  const [inputWarning, setInputWarning] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFolderName('');
      setInputWarning(null);
      checkServerStatus().then(s => setServerOnline(s.isOnline)).catch(() => setServerOnline(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleInputChange = (val: string) => {
    const filtered = filterNameInput(val);
    setFolderName(filtered.value);
    if (filtered.hasError) {
      setInputWarning(filtered.error || 'Ungültiges Zeichen blockiert.');
    } else {
      setInputWarning(null);
    }
  };

  const validation = validateItemName(folderName);
  const isSubmitDisabled =
    isSubmitting ||
    serverOnline === false ||
    !folderName.trim() ||
    !validation.valid ||
    Boolean(inputWarning);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.valid) {
      setInputWarning(validation.error || 'Ungültiger Ordnername.');
      return;
    }

    setIsSubmitting(true);
    const status = await checkServerStatus();
    if (!status.isOnline) {
      setIsSubmitting(false);
      setServerOnline(false);
      addToast('error', 'Server offline', 'Verbindung zu https://storage.j-jonas.com nicht möglich. Ordnererstellung gesperrt.');
      return;
    }

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

        {serverOnline === false && (
          <div className="mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-200">
            <WifiOff className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <span>Speicher-Server (storage.j-jonas.com) ist offline. Das Anlegen von Ordnern ist derzeit gesperrt.</span>
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
              autoFocus
              value={folderName}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="z. B. Meine Dokumente"
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-gray-800"
            />
            {inputWarning && (
              <div className="mt-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-300">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
                <span>{inputWarning}</span>
              </div>
            )}
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
              className="px-3.5 py-2 text-xs font-semibold rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isSubmitDisabled}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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
  const [folderWarning, setFolderWarning] = useState<string | null>(null);
  // Multi-user list: begins with one input field
  const [targetUsers, setTargetUsers] = useState<string[]>(['']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isServerChecking, setIsServerChecking] = useState(false);
  const [isServerOnline, setIsServerOnline] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleFolderNameChange = (val: string) => {
    const filtered = filterNameInput(val);
    setFolderName(filtered.value);
    if (filtered.hasError) {
      setFolderWarning(filtered.error || 'Ungültiges Zeichen blockiert.');
    } else {
      setFolderWarning(null);
    }
  };

  // Reset and check server when opened
  useEffect(() => {
    if (isOpen) {
      setFolderName(existingFolderName || '');
      setFolderWarning(null);
      setTargetUsers(['']);
      setErrorMsg('');
      setIsSubmitting(false);
      setIsServerChecking(true);
      checkServerStatus()
        .then((s) => {
          setIsServerOnline(s.isOnline);
          setIsServerChecking(false);
          if (!s.isOnline) {
            setErrorMsg('Speicher-Server (storage.j-jonas.com) ist offline. Das Erstellen von geteilten Ordnern ist derzeit gesperrt.');
          }
        })
        .catch(() => {
          setIsServerOnline(false);
          setIsServerChecking(false);
          setErrorMsg('Speicher-Server (storage.j-jonas.com) ist offline. Das Erstellen von geteilten Ordnern ist derzeit gesperrt.');
        });
    }
  }, [isOpen, existingFolderName]);

  if (!isOpen) return null;

  const handleUserChange = (index: number, value: string) => {
    setTargetUsers((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleAddUserField = () => {
    setTargetUsers((prev) => [...prev, '']);
  };

  const handleRemoveUserField = (index: number) => {
    setTargetUsers((prev) => {
      if (prev.length <= 1) return [''];
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmedFolder = folderName.trim();
    if (!trimmedFolder) {
      setErrorMsg('Bitte einen Ordnernamen angeben.');
      return;
    }

    // Filter empty inputs and deduplicate
    const cleanedUsers: string[] = [];
    const seen = new Set<string>();

    for (const u of targetUsers) {
      const norm = u.trim().toLowerCase();
      if (norm && !seen.has(norm)) {
        seen.add(norm);
        cleanedUsers.push(norm);
      }
    }

    if (cleanedUsers.length === 0) {
      setErrorMsg('Bitte mindestens einen gültigen Benutzernamen angeben.');
      return;
    }

    // Don't allow sharing with yourself
    if (cleanedUsers.includes((user.username || '').toLowerCase())) {
      setErrorMsg('Du kannst einen Ordner nicht mit deinem eigenen Account teilen.');
      return;
    }

    // 1. Serversperre: Active connection to storage.j-jonas.com is strictly required!
    const serverStatus = await checkServerStatus();
    if (!serverStatus.isOnline) {
      setIsServerOnline(false);
      setErrorMsg('Speicher-Server (storage.j-jonas.com) ist offline. Geteilte Ordner können nur erstellt werden, wenn eine aktive Verbindung zum Server besteht.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (!existingFolderName) {
        const createRes = await createFolder(user.username, currentPath, trimmedFolder);
        if (!createRes.success) {
          setErrorMsg(createRes.error || 'Speicher-Server nicht erreichbar. Ordnererstellung fehlgeschlagen.');
          setIsSubmitting(false);
          return;
        }
      }

      const folderPath = currentPath ? `${currentPath}/${trimmedFolder}` : trimmedFolder;

      let successCount = 0;
      const failedUsers: string[] = [];

      // Send invitations sequentially into the single shared folder document
      for (const targetUsername of cleanedUsers) {
        const res = await createFolderShare(
          folderPath,
          trimmedFolder,
          user.username,
          targetUsername
        );
        if (res.success) {
          successCount++;
        } else {
          failedUsers.push(`@${targetUsername} (${res.error || 'Fehler'})`);
        }
      }

      if (successCount > 0) {
        addToast(
          'success',
          'Freigabe-Einladungen versendet',
          `Einladung für "${trimmedFolder}" erfolgreich an ${successCount} Person(en) versendet.`
        );
      }

      if (failedUsers.length > 0) {
        setErrorMsg(`Einige Einladungen konnten nicht gesendet werden: ${failedUsers.join(', ')}`);
        if (successCount > 0) {
          onSuccess();
        }
        return;
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unerwarteter Fehler beim Teilen.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs select-none">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl p-6 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100 font-bold text-base">
            <Share2 className="w-5 h-5 text-emerald-500" />
            <span>Neuer geteilter Ordner</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error notification */}
        {errorMsg && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-start gap-2 text-xs text-red-700 dark:text-red-300 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Serversperre Notice when offline */}
        {isServerOnline === false && (
          <div className="mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-200 shrink-0">
            <WifiOff className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block">Serversperre aktiv</span>
              <span>
                Verbindung zu https://storage.j-jonas.com fehlt. Das Erstellen und Teilen von Ordnern ist erst bei aktivem Speicher-Server möglich.
              </span>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 overflow-y-auto pr-1 flex-1">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Ordnername
            </label>
            <input
              type="text"
              required
              disabled={Boolean(existingFolderName)}
              value={folderName}
              onChange={(e) => handleFolderNameChange(e.target.value)}
              placeholder="Ordnername"
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-70"
            />
            {folderWarning && (
              <div className="mt-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-300">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
                <span>{folderWarning}</span>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                Personen einladen ({targetUsers.length})
              </label>
            </div>

            {/* List of dynamic input fields */}
            <div className="space-y-2 max-h-48 overflow-y-auto pr-0.5">
              {targetUsers.map((userName, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      autoFocus={index === 0}
                      value={userName}
                      onChange={(e) => handleUserChange(index, e.target.value)}
                      placeholder={index === 0 ? "Erster Benutzername" : "Weiterer Benutzername"}
                      className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Remove button if more than 1 field */}
                  {targetUsers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveUserField(index)}
                      className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors shrink-0"
                      title="Eingabefeld entfernen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* "+ Weitere Person hinzufügen" Button */}
            <button
              type="button"
              onClick={handleAddUserField}
              className="mt-2.5 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Weitere Person hinzufügen</span>
            </button>
            <p className="text-[11px] text-gray-500 mt-1">
              Duplikate und leere Felder werden vor dem Absenden automatisch herausgefiltert.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-xs text-blue-800 dark:text-blue-300 border border-blue-100 dark:border-blue-900/50">
            <strong>Speicher-Regel:</strong> Alle Dateien, die in diesen geteilten Ordner geladen werden,
            belasten ausschließlich dein persönliches Speicherkontingent ({user.quota_gb} GB).
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={
                isSubmitting ||
                isServerOnline === false ||
                isServerChecking ||
                !folderName.trim() ||
                !validateItemName(folderName).valid ||
                Boolean(folderWarning) ||
                targetUsers.every((u) => !u.trim())
              }
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isSubmitting ? 'Wird geprüft...' : 'Freigeben & Einladen'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
