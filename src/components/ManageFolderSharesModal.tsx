import React, { useState, useEffect } from 'react';
import {
  Users,
  X,
  UserPlus,
  Trash2,
  AlertCircle,
  CheckCircle,
  Clock,
  Plus,
  Loader2,
  ShieldAlert
} from 'lucide-react';
import type { FolderShare, UserAccount } from '../types';
import {
  getSharesForFolder,
  createFolderShare,
  deleteFolderShare
} from '../services/firebase';
import { useToast } from './Toast';

interface ManageFolderSharesModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderPath: string;
  folderName: string;
  currentUser: UserAccount;
  onSharesUpdated: () => void;
}

export const ManageFolderSharesModal: React.FC<ManageFolderSharesModalProps> = ({
  isOpen,
  onClose,
  folderPath,
  folderName,
  currentUser,
  onSharesUpdated,
}) => {
  const { addToast } = useToast();
  const [shares, setShares] = useState<FolderShare[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [deletingShareId, setDeletingShareId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch current shares for this folder
  const loadFolderMembers = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const list = await getSharesForFolder(folderPath, currentUser.username);
      setShares(list);
    } catch (err) {
      setErrorMsg('Fehler beim Laden der Mitgliederliste.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && folderPath) {
      loadFolderMembers();
      setNewUsername('');
      setErrorMsg('');
    }
  }, [isOpen, folderPath, currentUser.username]);

  if (!isOpen) return null;

  // Add a new user to the folder
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const target = newUsername.trim().toLowerCase();
    if (!target) return;

    if (target === currentUser.username.toLowerCase()) {
      setErrorMsg('Du bist bereits der Besitzer dieses Ordners.');
      return;
    }

    // Check if user already has an invitation or access
    const alreadyInvited = shares.some(
      (s) => s.invited_user.toLowerCase() === target
    );
    if (alreadyInvited) {
      setErrorMsg(`@${target} ist bereits für diesen Ordner freigegeben oder eingeladen.`);
      return;
    }

    setIsAdding(true);
    try {
      const res = await createFolderShare(
        folderPath,
        folderName,
        currentUser.username,
        target
      );

      if (res.success) {
        addToast(
          'success',
          'Benutzer hinzugefügt',
          `@${target} wurde erfolgreich zum Ordner "${folderName}" eingeladen.`
        );
        setNewUsername('');
        await loadFolderMembers();
        onSharesUpdated();
      } else {
        setErrorMsg(res.error || 'Fehler beim Hinzufügen des Benutzers.');
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unerwarteter Fehler.');
    } finally {
      setIsAdding(false);
    }
  };

  // Remove member / revoke share
  const handleRemoveMember = async (share: FolderShare) => {
    if (
      !window.confirm(
        `Möchtest du den Zugriff für @${share.invited_user} auf diesen Ordner wirklich entfernen?`
      )
    ) {
      return;
    }

    setDeletingShareId(share.id);
    try {
      await deleteFolderShare(share.id);
      addToast(
        'info',
        'Freigabe entfernt',
        `Zugriff für @${share.invited_user} wurde widerrufen.`
      );
      await loadFolderMembers();
      onSharesUpdated();
    } catch (err) {
      addToast('error', 'Fehler beim Entfernen der Freigabe');
    } finally {
      setDeletingShareId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs select-none">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl p-6 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100 font-bold text-base">
            <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span>Freigaben verwalten – "{folderName}"</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
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

        {/* Add Person Form */}
        <form onSubmit={handleAddUser} className="mt-4 shrink-0">
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
            Weitere Person hinzufügen
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <UserPlus className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Benutzername eingeben..."
                className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={isAdding || !newUsername.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors disabled:opacity-50 shrink-0"
            >
              {isAdding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              <span>Person hinzufügen</span>
            </button>
          </div>
        </form>

        {/* Current Members List */}
        <div className="mt-5 flex-1 min-h-[160px] overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Personen mit Zugriff ({shares.length + 1})
            </h4>
          </div>

          <div className="space-y-2">
            {/* Owner Item (Always first) */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200/60 dark:border-gray-700/60">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold text-xs uppercase">
                  {currentUser.username.slice(0, 2)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100">
                      @{currentUser.username}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                      Eigentümer
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">
                    Voller Zugriff & Speicherkontingent
                  </span>
                </div>
              </div>
            </div>

            {/* List of Invited Members */}
            {isLoading ? (
              <div className="py-8 flex items-center justify-center text-xs text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                <span>Mitglieder werden geladen...</span>
              </div>
            ) : shares.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-400">
                Dieser Ordner ist derzeit mit keinen weiteren Personen geteilt.
              </div>
            ) : (
              shares.map((share) => (
                <div
                  key={share.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200/80 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs uppercase">
                      {share.invited_user.slice(0, 2)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100">
                          @{share.invited_user}
                        </span>
                        {share.status === 'accepted' ? (
                          <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
                            <CheckCircle className="w-2.5 h-2.5" />
                            <span>Aktiv</span>
                          </span>
                        ) : share.status === 'pending' ? (
                          <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60">
                            <Clock className="w-2.5 h-2.5" />
                            <span>Ausstehend</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400">
                            Abgelehnt
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-gray-400 font-mono">
                        Eingeladen am {new Date(share.created_at).toLocaleDateString('de-DE')}
                      </span>
                    </div>
                  </div>

                  {/* Remove Button (Only for folder owner) */}
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(share)}
                    disabled={deletingShareId === share.id}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors disabled:opacity-50"
                    title={`Zugriff für @${share.invited_user} entfernen`}
                  >
                    {deletingShareId === share.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end pt-4 border-t border-gray-100 dark:border-gray-800 mt-4 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 transition-colors"
          >
            Fertig
          </button>
        </div>
      </div>
    </div>
  );
};
