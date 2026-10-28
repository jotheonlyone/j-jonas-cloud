import React, { useState, useEffect } from 'react';
import { X, Check, Copy, ExternalLink, FileText, Edit2, Share2, Info, Loader2, AlertTriangle, Trash2 } from 'lucide-react';
import type { FileItemData } from '../types';
import {
  renameItem,
  getFileMetadata,
  setFileMetadata,
  formatBytes,
  formatCleanTitle,
} from '../services/storageApi';
import { validateItemName, filterNameInput } from '../utils/nameSanitizer';
import { createPublicFileShare, deletePublicFileShare } from '../services/firebase';

// -------------------------------------------------------------
// 1. RENAME MODAL
// -------------------------------------------------------------
interface RenameModalProps {
  isOpen: boolean;
  item: FileItemData | null;
  currentPath: string;
  username: string;
  onClose: () => void;
  onSuccess: (oldName: string, newName: string) => void;
}

export const RenameModal: React.FC<RenameModalProps> = ({
  isOpen,
  item,
  currentPath,
  username,
  onClose,
  onSuccess,
}) => {
  const isFile = item?.type === 'file';
  const lastDot = isFile && item ? item.name.lastIndexOf('.') : -1;
  const fileExt = lastDot > 0 && item ? item.name.slice(lastDot) : '';
  const initialBase = lastDot > 0 && item ? item.name.slice(0, lastDot) : (item?.name || '');

  const [baseName, setBaseName] = useState(initialBase);
  const [inputWarning, setInputWarning] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      const isF = item.type === 'file';
      const dotIdx = isF ? item.name.lastIndexOf('.') : -1;
      const base = dotIdx > 0 ? item.name.slice(0, dotIdx) : item.name;
      setBaseName(base);
      setInputWarning(null);
      setError(null);
    }
  }, [item]);

  if (!isOpen || !item) return null;

  const handleInputChange = (val: string) => {
    const filtered = filterNameInput(val);
    setBaseName(filtered.value);
    if (filtered.hasError) {
      setInputWarning(filtered.error || 'Ungültiges Zeichen blockiert.');
    } else {
      setInputWarning(null);
    }
  };

  const validation = validateItemName(baseName);
  const isSubmitDisabled = isLoading || !baseName.trim() || !validation.valid || Boolean(inputWarning);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.valid) {
      setError(validation.error || 'Ungültiger Name.');
      return;
    }

    const finalNewName = fileExt ? `${baseName.trim()}${fileExt}` : baseName.trim();
    if (finalNewName === item.name) {
      onClose();
      return;
    }

    setIsLoading(true);
    setError(null);

    const targetOwner = item.owner || username;
    const res = await renameItem(targetOwner, currentPath, item.name, finalNewName);

    setIsLoading(false);
    if (res.success) {
      onSuccess(item.name, finalNewName);
      onClose();
    } else {
      setError(res.error || 'Fehler beim Umbenennen.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 select-none">
      <div
        className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-6 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100 font-semibold text-base">
            <Edit2 className="w-5 h-5 text-blue-500" />
            <span>{item.type === 'folder' ? 'Ordner umbenennen' : 'Datei umbenennen'}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                {isFile ? 'Dateiname (ohne Endung)' : 'Neuer Ordnername'}
              </label>
              {isFile && fileExt && (
                <span className="text-[11px] text-gray-400 dark:text-gray-500">
                  Dateiendung geschützt: <code className="font-mono text-blue-600 dark:text-blue-400 font-bold">{fileExt}</code>
                </span>
              )}
            </div>

            {isFile && fileExt ? (
              <div className="flex items-center">
                <input
                  type="text"
                  value={baseName}
                  onChange={(e) => handleInputChange(e.target.value)}
                  autoFocus
                  className="flex-1 px-3.5 py-2.5 rounded-l-xl border border-r-0 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-all shadow-xs"
                  placeholder="Dateiname..."
                />
                <span
                  className="px-3.5 py-2.5 bg-gray-100 dark:bg-gray-800/90 text-gray-600 dark:text-gray-400 font-mono text-sm border border-l-0 border-gray-300 dark:border-gray-700 rounded-r-xl select-none shrink-0"
                  title="Dateiendung ist geschützt und bleibt unverändert"
                >
                  {fileExt}
                </span>
              </div>
            ) : (
              <input
                type="text"
                value={baseName}
                onChange={(e) => handleInputChange(e.target.value)}
                autoFocus
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-all shadow-xs"
                placeholder="Name eingeben..."
              />
            )}

            {inputWarning && (
              <div className="mt-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-300">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
                <span>{inputWarning}</span>
              </div>
            )}
          </div>

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 p-2.5 rounded-lg border border-red-200 dark:border-red-800/60">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isSubmitDisabled}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Speichern</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// 2. FILE METADATA & DESCRIPTION MODAL
// -------------------------------------------------------------
interface FileMetadataModalProps {
  isOpen: boolean;
  item: FileItemData | null;
  currentPath: string;
  username?: string;
  onClose: () => void;
  onSaved?: (description: string) => void;
}

export const FileMetadataModal: React.FC<FileMetadataModalProps> = ({
  isOpen,
  item,
  currentPath,
  username,
  onClose,
  onSaved,
}) => {
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const relativePath = item ? (item.path || (currentPath ? `${currentPath}/${item.name}` : item.name)) : '';
  const effectiveUser = item?.owner || username || '';

  useEffect(() => {
    if (!isOpen || !item) return;
    let isMounted = true;
    const initialDesc = item.metadata?.description || '';
    setDescription(initialDesc);
    setIsLoading(!initialDesc);
    setStatusMessage(null);

    getFileMetadata(relativePath, effectiveUser)
      .then((data) => {
        if (isMounted) {
          if (data.description || !initialDesc) {
            setDescription(data.description || '');
          }
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, item, relativePath, effectiveUser]);

  if (!isOpen || !item) return null;

  const handleSave = async () => {
    setIsSaving(true);
    setStatusMessage(null);

    const res = await setFileMetadata(relativePath, description, effectiveUser);
    setIsSaving(false);

    if (res.success) {
      if (item) {
        item.metadata = { ...(item.metadata || {}), description };
      }
      setStatusMessage({ type: 'success', text: 'Beschreibung erfolgreich gespeichert.' });
      if (onSaved) onSaved(description);
      setTimeout(() => {
        onClose();
      }, 900);
    } else {
      setStatusMessage({
        type: 'error',
        text: res.error || 'Speichern der Beschreibung fehlgeschlagen.',
      });
    }
  };

  const formattedDate = () => {
    try {
      return new Date(item.modified).toLocaleString('de-DE');
    } catch {
      return item.modified;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-6 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100 font-semibold text-base">
            <Info className="w-5 h-5 text-blue-500" />
            <span>Details & Beschreibung</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* File Quick Info */}
        <div className="mt-4 p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800 space-y-1.5 text-xs text-gray-600 dark:text-gray-300">
          <div className="flex justify-between">
            <span className="text-gray-400">Name:</span>
            <span className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-[280px]">
              {item.name}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Pfad:</span>
            <span className="font-mono text-[11px] text-gray-700 dark:text-gray-300 truncate max-w-[280px]">
              {relativePath || '/'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Größe:</span>
            <span className="font-medium">{item.type === 'folder' ? 'Ordner' : formatBytes(item.size)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Geändert am:</span>
            <span>{formattedDate()}</span>
          </div>
        </div>

        {/* Description textarea */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              Beschreibung
            </label>
            {isLoading && (
              <span className="flex items-center gap-1 text-[11px] text-blue-500">
                <Loader2 className="w-3 h-3 animate-spin" /> Wird geladen...
              </span>
            )}
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isLoading || isSaving}
            rows={4}
            placeholder="Optionale Notiz oder Filmbeschreibung eingeben (wird auch im Cinema-Modus angezeigt)..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-all shadow-xs resize-y disabled:opacity-60"
          />
        </div>

        {statusMessage && (
          <div
            className={`mt-3 p-2.5 rounded-xl text-xs font-medium ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
            }`}
          >
            {statusMessage.text}
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-4 mt-2 border-t border-gray-100 dark:border-gray-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Schließen
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isLoading || isSaving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-xs disabled:opacity-60"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Speichern</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// 3. PUBLIC SHARE MODAL
// Format: https://cloud.j-jonas.com/share/:shareId
// -------------------------------------------------------------
interface PublicShareModalProps {
  isOpen: boolean;
  item: FileItemData | null;
  currentPath: string;
  username: string;
  onClose: () => void;
}

export const PublicShareModal: React.FC<PublicShareModalProps> = ({
  isOpen,
  item,
  currentPath,
  username,
  onClose,
}) => {
  const [shareId, setShareId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const rawPath = item ? (item.path || (currentPath ? `${currentPath}/${item.name}` : item.name)) : '';
  const cleanPath = rawPath.trim().replace(/^\/+/, '');

  useEffect(() => {
    if (!isOpen || !item) {
      setShareId('');
      setIsLoading(true);
      setIsDeleting(false);
      setError(null);
      setStatusMessage(null);
      setCopied(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setIsDeleting(false);
    setError(null);
    setStatusMessage(null);
    setCopied(false);

    const initShare = async () => {
      try {
        const res = await createPublicFileShare(username, cleanPath);
        if (isMounted) {
          setShareId(res.shareId);
          setIsLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || 'Fehler beim Laden/Erstellen der Freigabe-ID.');
          setIsLoading(false);
        }
      }
    };

    initShare();

    return () => {
      isMounted = false;
    };
  }, [isOpen, item, username, cleanPath]);

  if (!isOpen || !item) return null;

  const shareUrl = shareId ? `https://cloud.j-jonas.com/share/${shareId}` : '';
  const localTestUrl = shareId ? `/share/${shareId}` : '';

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const ta = document.createElement('textarea');
        ta.value = shareUrl;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  const handleDeleteShare = async () => {
    if (!shareId || isDeleting) return;

    setIsDeleting(true);
    setError(null);
    setStatusMessage(null);

    try {
      // Dokument dieser Freigabe aus der Firestore-Kollektion public_shares per deleteDoc() löschen
      await deletePublicFileShare(shareId);
      // Link sofort aus der Ansicht entfernen & lokaler Zustand zurücksetzen
      setShareId('');
      setCopied(false);
      setStatusMessage({
        type: 'success',
        text: 'Öffentliche Freigabe aufgehoben',
      });
    } catch (err: any) {
      console.error('Fehler beim Löschen des Freigabelinks:', err);
      setError(err?.message || 'Fehler beim Beenden der öffentlichen Freigabe.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateShare = async () => {
    if (isLoading || isDeleting) return;

    setIsLoading(true);
    setError(null);
    setStatusMessage(null);

    try {
      const res = await createPublicFileShare(username, cleanPath);
      setShareId(res.shareId);
      setStatusMessage({
        type: 'success',
        text: 'Neuer Freigabelink erfolgreich erstellt.',
      });
    } catch (err: any) {
      setError(err?.message || 'Fehler beim Erstellen der Freigabe.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-6 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100 font-semibold text-base">
            <Share2 className="w-5 h-5 text-emerald-500" />
            <span>Öffentlichen Link teilen</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
            Über diesen öffentlichen Link kann jede Person die Datei{' '}
            <strong>"{item.name}"</strong> ohne Cloud-Login oder Passwort ansehen und herunterladen.
          </p>

          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1.5">
              Generierter Freigabelink (unerratbare ID)
            </label>

            {shareId ? (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={isLoading ? 'Freigabe-ID wird in Firestore geladen...' : shareUrl}
                    onFocus={(e) => e.target.select()}
                    className="flex-1 font-mono text-xs px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 select-all focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleCopy}
                    disabled={isLoading || !shareUrl}
                    className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-white transition-all shadow-xs disabled:opacity-50 shrink-0 ${
                      copied
                        ? 'bg-emerald-600 hover:bg-emerald-700 ring-2 ring-emerald-400'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : copied ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    <span>{copied ? 'Kopiert!' : 'Kopieren'}</span>
                  </button>
                </div>

                {/* Lösch-Button bei aktivem Link anzeigen: direkt unter dem Kopieren-Feld in dezentem Rot/Outline-Stil */}
                <div className="flex items-center justify-between pt-0.5">
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Öffentlicher Link aktiv</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDeleteShare}
                    disabled={isDeleting}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 bg-red-50/60 hover:bg-red-100/70 dark:bg-red-950/20 dark:hover:bg-red-950/40 border border-red-200 dark:border-red-900/60 hover:border-red-300 dark:hover:border-red-800 transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
                    title="Diesen Freigabelink löschen und die Freigabe beenden"
                  >
                    {isDeleting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    <span>{isDeleting ? 'Wird beendet...' : 'Freigabe beenden'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    disabled
                    value=""
                    placeholder="Keine aktive Freigabe vorhanden"
                    className="flex-1 font-mono text-xs px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-100/70 dark:bg-gray-800/40 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                  />
                  <button
                    type="button"
                    onClick={handleCreateShare}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-xs disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Share2 className="w-4 h-4" />
                    )}
                    <span>{isLoading ? 'Wird erstellt...' : 'Link erstellen'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {statusMessage && (
            <div
              className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium border animate-in fade-in duration-150 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <Check className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs font-medium border border-red-200 dark:border-red-800">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {copied && !statusMessage && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-medium border border-emerald-200 dark:border-emerald-800 animate-in fade-in">
              <Check className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>Link wurde in die Zwischenablage kopiert!</span>
            </div>
          )}

          <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/40 text-amber-800 dark:text-amber-300 text-xs leading-relaxed">
            <strong>Hinweis:</strong> Externe Besucher benötigen kein Passwort oder Token. Wird die Freigabe beendet, verliert dieser Link sofort seine Gültigkeit.
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
            {shareId ? (
              <a
                href={localTestUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Link im Browser testen</span>
              </a>
            ) : <span />}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Fertig
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

