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
  Eye,
  EyeOff,
  UserCog,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import type { FolderShare, SharedMember, UserAccount } from '../types';
import {
  getSharedFolder,
  createFolderShare,
  deleteFolderShareMember,
  updateMemberPermissions
} from '../services/firebase';
import { checkServerStatus } from '../services/storageApi';
import { useToast } from './Toast';

interface ManageFolderSharesModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderPath: string;
  folderName: string;
  folderOwner?: string;
  currentUser: UserAccount;
  onSharesUpdated: () => void;
}

export const ManageFolderSharesModal: React.FC<ManageFolderSharesModalProps> = ({
  isOpen,
  onClose,
  folderPath,
  folderName,
  folderOwner,
  currentUser,
  onSharesUpdated,
}) => {
  const { addToast } = useToast();
  const [folderShare, setFolderShare] = useState<FolderShare | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newCanSeeMembers, setNewCanSeeMembers] = useState(true);
  const [newCanManageMembers, setNewCanManageMembers] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [deletingMember, setDeletingMember] = useState<string | null>(null);
  const [updatingMember, setUpdatingMember] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const actualOwner = (folderOwner || currentUser.username).trim().toLowerCase();
  const isOwner = actualOwner === currentUser.username.trim().toLowerCase();

  // Load the folder's shared data
  const loadFolderMembers = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const share = await getSharedFolder(folderPath, actualOwner);
      setFolderShare(share);
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
      setNewCanSeeMembers(true);
      setNewCanManageMembers(false);
      setErrorMsg('');
    }
  }, [isOpen, folderPath, actualOwner]);

  if (!isOpen) return null;

  const currentMember = folderShare?.shared_with?.find(
    (m) => m?.username && m.username.toLowerCase() === (currentUser.username || '').trim().toLowerCase()
  );
  const canSeeMembers = isOwner || (currentMember?.can_see_members ?? false);
  const canManageMembers = isOwner || (currentMember?.can_manage_members ?? false);

  // Add new member
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!canManageMembers) {
      setErrorMsg('Du hast keine Berechtigung, Personen hinzuzufügen.');
      return;
    }

    const target = newUsername.trim().toLowerCase();
    if (!target) return;

    if (target === actualOwner) {
      setErrorMsg(`@${target} ist bereits der Eigentümer dieses Ordners.`);
      return;
    }

    if (folderShare?.shared_with?.some((m) => m?.username && m.username.toLowerCase() === target)) {
      setErrorMsg(`@${target} ist bereits für diesen Ordner freigegeben oder eingeladen.`);
      return;
    }

    // Check server connection
    const serverStatus = await checkServerStatus();
    if (!serverStatus.isOnline) {
      setErrorMsg('Speicher-Server (storage.j-jonas.com) ist offline. Personen können nur bei aktiver Verbindung hinzugefügt werden.');
      return;
    }

    // Enforce dependency: canManage requires canSee
    const finalCanSee = newCanSeeMembers;
    const finalCanManage = finalCanSee ? newCanManageMembers : false;

    setIsAdding(true);
    try {
      const res = await createFolderShare(
        folderPath,
        folderName,
        actualOwner,
        target,
        {
          can_see_members: finalCanSee,
          can_manage_members: finalCanManage,
        }
      );

      if (res.success && res.share) {
        addToast(
          'success',
          'Person hinzugefügt',
          `@${target} wurde erfolgreich zum geteilten Ordner eingeladen.`
        );
        setNewUsername('');
        setNewCanSeeMembers(true);
        setNewCanManageMembers(false);
        setFolderShare(res.share);
        onSharesUpdated();
      } else {
        setErrorMsg(res.error || 'Fehler beim Hinzufügen der Person.');
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unerwarteter Fehler.');
    } finally {
      setIsAdding(false);
    }
  };

  // Toggle permission for an existing member
  const handleToggleMemberPermission = async (
    member: SharedMember,
    permissionKey: 'can_see_members' | 'can_manage_members',
    newValue: boolean
  ) => {
    if (!canManageMembers) return;

    let updatedCanSee = member.can_see_members;
    let updatedCanManage = member.can_manage_members;

    if (permissionKey === 'can_see_members') {
      updatedCanSee = newValue;
      // WICHTIGE ABHÄNGIGKEIT: Schalter 2 kann NUR aktiviert werden, wenn Schalter 1 aktiv ist!
      // Wird Schalter 1 deaktiviert, schaltet sich Schalter 2 automatisch mit aus und wird gesperrt.
      if (!newValue) {
        updatedCanManage = false;
      }
    } else if (permissionKey === 'can_manage_members') {
      if (!updatedCanSee && newValue) {
        // Cannot activate manage without seeing members
        return;
      }
      updatedCanManage = newValue;
    }

    // Optimistic UI update
    setUpdatingMember(member.username);
    setFolderShare((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        shared_with: prev.shared_with.map((m) =>
          m.username === member.username
            ? { ...m, can_see_members: updatedCanSee, can_manage_members: updatedCanManage }
            : m
        ),
      };
    });

    try {
      const res = await updateMemberPermissions(
        folderPath,
        actualOwner,
        member.username,
        {
          can_see_members: updatedCanSee,
          can_manage_members: updatedCanManage,
        }
      );

      if (res.success && res.share) {
        setFolderShare(res.share);
        onSharesUpdated();
      } else {
        addToast('error', 'Fehler', res.error || 'Berechtigungen konnten nicht aktualisiert werden.');
        await loadFolderMembers();
      }
    } catch {
      addToast('error', 'Fehler beim Aktualisieren der Berechtigungen');
      await loadFolderMembers();
    } finally {
      setUpdatingMember(null);
    }
  };

  // Remove member
  const handleRemoveMember = async (memberUsername: string) => {
    if (!canManageMembers) return;

    if (
      !window.confirm(
        `Möchtest du den Zugriff für @${memberUsername} auf diesen Ordner wirklich entfernen?`
      )
    ) {
      return;
    }

    setDeletingMember(memberUsername);
    try {
      await deleteFolderShareMember(folderPath, actualOwner, memberUsername);
      addToast(
        'info',
        'Freigabe entfernt',
        `Zugriff für @${memberUsername} wurde widerrufen.`
      );
      await loadFolderMembers();
      onSharesUpdated();
    } catch {
      addToast('error', 'Fehler beim Entfernen der Freigabe');
    } finally {
      setDeletingMember(null);
    }
  };

  const membersList = (folderShare?.shared_with || []).filter(
    (m) => m && typeof m.username === 'string' && m.username.trim().length > 0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs select-none">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl p-5 sm:p-6 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100 font-bold text-base min-w-0">
            <Users className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="truncate">
              {canManageMembers ? 'Freigaben & Rechte verwalten' : 'Mitgliederliste'} – "{folderName}"
            </span>
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
          <div className="mt-3 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-start gap-2 text-xs text-red-700 dark:text-red-300 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 1. Add Person Form (Nur für Owner oder Mitglieder mit can_manage_members) */}
        {canManageMembers ? (
          <form onSubmit={handleAddUser} className="mt-4 p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200/70 dark:border-gray-700/60 shrink-0 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-gray-800 dark:text-gray-200">
                Person zum Ordner hinzufügen
              </label>
              <span className="text-[10px] text-gray-500 dark:text-gray-400">
                Eigener Speicherplatz beim Eigentümer (@{actualOwner})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <UserPlus className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Benutzername eingeben..."
                  className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={isAdding || !newUsername.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
              >
                {isAdding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>Einladen</span>
              </button>
            </div>

            {/* Berechtigungs-Schalter für die neue Einladung */}
            <div className="pt-2 border-t border-gray-200/60 dark:border-gray-700/60 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {/* Schalter 1: Darf Mitgliederliste sehen */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={newCanSeeMembers}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setNewCanSeeMembers(checked);
                    // Dependency: If switch 1 is turned off, switch 2 must turn off as well!
                    if (!checked) {
                      setNewCanManageMembers(false);
                    }
                  }}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                />
                <span className="text-gray-700 dark:text-gray-300 text-[11px] font-medium">
                  Darf Mitgliederliste sehen
                </span>
              </label>

              {/* Schalter 2: Darf Personen hinzufügen/entfernen (Gesperrt wenn Schalter 1 inaktiv) */}
              <label
                className={`flex items-center gap-2 select-none ${
                  newCanSeeMembers ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={newCanManageMembers}
                  disabled={!newCanSeeMembers}
                  onChange={(e) => {
                    if (newCanSeeMembers) {
                      setNewCanManageMembers(e.target.checked);
                    }
                  }}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                />
                <span className="text-gray-700 dark:text-gray-300 text-[11px] font-medium">
                  Darf Personen verwalten
                </span>
              </label>
            </div>
          </form>
        ) : (
          /* Hinweis für Nutzer mit reinem Leserecht */
          <div className="mt-3 p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 flex items-center gap-2.5 text-xs text-blue-800 dark:text-blue-300">
            <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>Du hast Leserechte für die Mitgliederliste dieses geteilten Ordners.</span>
          </div>
        )}

        {/* 2. Mitgliederliste */}
        <div className="mt-4 flex-1 min-h-[160px] overflow-y-auto pr-1">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Personen mit Zugriff ({membersList.length + 1})
            </h4>
          </div>

          <div className="space-y-2.5">
            {/* Eigentümer (immer ganz oben) */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200/60 dark:border-gray-700/60">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                  {actualOwner.slice(0, 2)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100">
                      @{actualOwner}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                      Eigentümer
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">
                    Physischer Speicherort & volle Administrationsrechte
                  </span>
                </div>
              </div>
            </div>

            {/* Eingeladene Mitglieder */}
            {isLoading ? (
              <div className="py-8 flex items-center justify-center text-xs text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                <span>Mitglieder werden geladen...</span>
              </div>
            ) : membersList.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-400">
                Dieser Ordner ist aktuell mit keinen weiteren Personen geteilt.
              </div>
            ) : (
              membersList.map((member) => (
                <div
                  key={member.username}
                  className="p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200/80 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all flex flex-col gap-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                        {member.username.slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                            @{member.username}
                          </span>
                          {member.status === 'accepted' ? (
                            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
                              <CheckCircle className="w-2.5 h-2.5" />
                              <span>Aktiv</span>
                            </span>
                          ) : member.status === 'pending' ? (
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
                        <span className="text-[10px] text-gray-400 font-mono">
                          Hinzugefügt am {new Date(member.added_at).toLocaleDateString('de-DE')}
                        </span>
                      </div>
                    </div>

                    {/* Entfernen Button (Nur für Nutzer mit can_manage_members) */}
                    {canManageMembers && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member.username)}
                        disabled={deletingMember === member.username}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
                        title={`Zugriff für @${member.username} entfernen`}
                      >
                        {deletingMember === member.username ? (
                          <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* 2 Schalter / Toggles für Berechtigungen */}
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-750 flex flex-wrap items-center gap-3 text-xs bg-gray-50/50 dark:bg-gray-850/40 p-2 rounded-lg">
                    {/* Schalter 1: Darf Mitgliederliste sehen */}
                    <div className="flex items-center gap-2">
                      {canManageMembers ? (
                        <label className="relative inline-flex items-center cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={member.can_see_members}
                            disabled={updatingMember === member.username}
                            onChange={(e) =>
                              handleToggleMemberPermission(
                                member,
                                'can_see_members',
                                e.target.checked
                              )
                            }
                            className="sr-only peer"
                          />
                          <div className="w-7 h-4 bg-gray-300 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
                          <span className="ml-1.5 text-[11px] font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                            {member.can_see_members ? (
                              <Eye className="w-3 h-3 text-blue-500" />
                            ) : (
                              <EyeOff className="w-3 h-3 text-gray-400" />
                            )}
                            <span>Mitgliederliste sehen</span>
                          </span>
                        </label>
                      ) : (
                        <span className="text-[11px] text-gray-600 dark:text-gray-400 flex items-center gap-1">
                          {member.can_see_members ? (
                            <>
                              <Eye className="w-3 h-3 text-blue-500" />
                              <span className="font-semibold text-blue-600 dark:text-blue-400">Sieht Mitgliederliste</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3 h-3 text-gray-400" />
                              <span>Keine Mitglieder-Sicht</span>
                            </>
                          )}
                        </span>
                      )}
                    </div>

                    {/* Schalter 2: Darf Personen hinzufügen/entfernen */}
                    <div className="flex items-center gap-2">
                      {canManageMembers ? (
                        <label
                          className={`relative inline-flex items-center select-none ${
                            member.can_see_members
                              ? 'cursor-pointer'
                              : 'cursor-not-allowed opacity-40'
                          }`}
                          title={
                            !member.can_see_members
                              ? 'Schalter 2 setzt zwingend Schalter 1 („Mitgliederliste sehen“) voraus.'
                              : ''
                          }
                        >
                          <input
                            type="checkbox"
                            checked={member.can_manage_members}
                            disabled={!member.can_see_members || updatingMember === member.username}
                            onChange={(e) => {
                              if (member.can_see_members) {
                                handleToggleMemberPermission(
                                  member,
                                  'can_manage_members',
                                  e.target.checked
                                );
                              }
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-7 h-4 bg-gray-300 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
                          <span className="ml-1.5 text-[11px] font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                            <UserCog className={`w-3 h-3 ${member.can_manage_members ? 'text-indigo-500' : 'text-gray-400'}`} />
                            <span>Personen verwalten</span>
                          </span>
                        </label>
                      ) : (
                        <span className="text-[11px] text-gray-600 dark:text-gray-400 flex items-center gap-1">
                          <UserCog className={`w-3 h-3 ${member.can_manage_members ? 'text-indigo-500' : 'text-gray-400'}`} />
                          {member.can_manage_members ? (
                            <span className="font-semibold text-indigo-600 dark:text-indigo-400">Darf verwalten</span>
                          ) : (
                            <span>Keine Verwaltung</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800 mt-4 shrink-0">
          <span className="text-[11px] text-gray-400">
            {canManageMembers ? 'Berechtigungs-Änderungen gelten sofort.' : 'Ansichtsmodus.'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 transition-colors cursor-pointer"
          >
            Fertig
          </button>
        </div>
      </div>
    </div>
  );
};
