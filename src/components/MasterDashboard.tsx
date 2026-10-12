import React, { useState } from 'react';
import {
  Shield,
  UserCheck,
  UserX,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Users,
  HardDrive,
  Check,
  X
} from 'lucide-react';
import type { UserAccount } from '../types';
import { deleteUserServerDirectory } from '../services/storageApi';
import { useToast } from './Toast';

const PRESET_QUOTAS = [25, 50, 100, 250, 500, 1000];

interface MasterDashboardProps {
  users: UserAccount[];
  maintenanceMode: boolean;
  onToggleMaintenance: (enabled: boolean) => void;
  onApproveUser: (username: string, quota: number) => void;
  onRejectUser: (username: string) => void;
  onUpdateUserQuota: (username: string, quota: number) => void;
  onDeleteUser: (username: string) => void;
  onRefreshUsers: () => void;
}

export const MasterDashboard: React.FC<MasterDashboardProps> = ({
  users,
  maintenanceMode,
  onToggleMaintenance,
  onApproveUser,
  onRejectUser,
  onUpdateUserQuota,
  onDeleteUser,
  onRefreshUsers,
}) => {
  const { addToast } = useToast();

  // Quota selection for pending users
  const [pendingQuotas, setPendingQuotas] = useState<Record<string, number>>({});
  const [customQuotaMode, setCustomQuotaMode] = useState<Record<string, boolean>>({});
  const [customQuotaValue, setCustomQuotaValue] = useState<Record<string, number>>({});

  // Warning Modal state for server offline / failed physical delete
  const [deleteWarningModal, setDeleteWarningModal] = useState<{
    isOpen: boolean;
    username: string;
    actionType: 'delete' | 'reject';
    serverErrorMessage?: string;
  } | null>(null);

  const [isDeletingUser, setIsDeletingUser] = useState(false);

  const pendingUsers = users.filter((u) => u.status === 'pending');
  const activeUsers = users.filter((u) => u.status === 'active');

  const handleApprove = (username: string) => {
    const quota = customQuotaMode[username]
      ? customQuotaValue[username] || 100
      : pendingQuotas[username] || 100;
    onApproveUser(username, quota);
  };

  /**
   * Physische Löschung + Schutz
   */
  const initiateUserDeletion = async (username: string, actionType: 'delete' | 'reject') => {
    setIsDeletingUser(true);
    try {
      // 1. Wenn Wartungsmodus an ist, direkt Warnung anzeigen
      if (maintenanceMode) {
        setDeleteWarningModal({
          isOpen: true,
          username,
          actionType,
          serverErrorMessage: 'Wartungsmodus ist aktiv. Dateizugriff auf dem Server ist pausiert.',
        });
        return;
      }

      // 2. DELETE-Request an Backend senden (/media/ssd/users/<username>/)
      const res = await deleteUserServerDirectory(username);

      if (res.success) {
        // Physische Löschung erfolgreich -> Datenbank löschen
        if (actionType === 'delete') {
          onDeleteUser(username);
          addToast('success', 'Gelöscht', `@${username} und physische Server-Dateien wurden entfernt.`);
        } else {
          onRejectUser(username);
          addToast('info', 'Abgelehnt', `Registrierung von @${username} wurde abgelehnt und entfernt.`);
        }
      } else {
        // DELETE-Request fehlgeschlagen oder Server offline:
        // NICHT stillschweigend löschen, sondern Warndialog anzeigen!
        setDeleteWarningModal({
          isOpen: true,
          username,
          actionType,
          serverErrorMessage: res.error,
        });
      }
    } catch (err: unknown) {
      setDeleteWarningModal({
        isOpen: true,
        username,
        actionType,
        serverErrorMessage: 'Verbindung zu https://storage.j-jonas.com unterbrochen.',
      });
    } finally {
      setIsDeletingUser(false);
    }
  };

  // Bestätigung der Löschung trotz Server-Fehler
  const confirmForceDelete = () => {
    if (!deleteWarningModal) return;
    const { username, actionType } = deleteWarningModal;
    setDeleteWarningModal(null);

    if (actionType === 'delete') {
      onDeleteUser(username);
      addToast('info', 'Konto gelöscht', `@${username} in der Datenbank gelöscht (physische Dateien verblieben auf Server).`);
    } else {
      onRejectUser(username);
      addToast('info', 'Registrierung gelöscht', `@${username} wurde aus der Datenbank entfernt.`);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-xs border border-gray-200 dark:border-gray-800 space-y-6">
      {/* Title & Stats */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-gray-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
              <Shield className="w-5 h-5" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">
              Master Administration
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Zentrale Benutzerverwaltung, Quota-Zuweisung und Steuerung des globalen Wartungsmodus.
          </p>
        </div>

        <button
          onClick={onRefreshUsers}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Aktualisieren</span>
        </button>
      </div>

      {/* Global Maintenance Mode Card */}
      <div className="p-5 rounded-2xl bg-gray-50 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <AlertTriangle className={`w-5 h-5 ${maintenanceMode ? 'text-amber-500' : 'text-gray-400'}`} />
              <h3 className="font-bold text-sm sm:text-base text-gray-900 dark:text-gray-100">
                Globaler Wartungsmodus (Firestore)
              </h3>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 max-w-xl">
              Im Wartungsmodus wird für alle normalen Benutzer ein Warnbanner eingeblendet und
              Schreibvorgänge (Uploads, Ordnererstellung, Löschen) werden pausiert. Master-Administratoren behalten vollen Zugriff.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`text-xs font-semibold ${
                maintenanceMode
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {maintenanceMode ? 'Aktiv (Wartung)' : 'Inaktiv (Normalbetrieb)'}
            </span>
            <button
              onClick={() => onToggleMaintenance(!maintenanceMode)}
              className="transition-transform active:scale-95 focus:outline-none"
              title="Wartungsmodus umschalten"
            >
              {maintenanceMode ? (
                <ToggleRight className="w-10 h-10 text-amber-500" />
              ) : (
                <ToggleLeft className="w-10 h-10 text-gray-400 dark:text-gray-600" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 1. Ausstehende Registrierungen */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-500" />
            <h3 className="font-bold text-sm sm:text-base text-gray-900 dark:text-gray-100">
              Ausstehende Nutzerregistrierungen ({pendingUsers.length})
            </h3>
          </div>
        </div>

        {pendingUsers.length === 0 ? (
          <div className="p-6 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 text-center">
            <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-1.5 opacity-80" />
            <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">
              Keine ausstehenden Registrierungen vorhanden.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 uppercase font-semibold border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3">Benutzername</th>
                  <th className="px-4 py-3">Registriert am</th>
                  <th className="px-4 py-3">Initiale Quota</th>
                  <th className="px-4 py-3 text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 bg-white dark:bg-gray-800/60">
                {pendingUsers.map((pUser) => {
                  const isCustom = customQuotaMode[pUser.username];
                  const quotaVal = isCustom
                    ? customQuotaValue[pUser.username] || 100
                    : pendingQuotas[pUser.username] || 100;

                  return (
                    <tr key={pUser.username} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">
                        @{pUser.username}
                      </td>
                      <td className="px-4 py-3 text-gray-500 font-mono">
                        {new Date(pUser.createdAt).toLocaleDateString('de-DE')}
                      </td>
                      <td className="px-4 py-3">
                        {isCustom ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={1}
                              max={10000}
                              value={quotaVal}
                              onChange={(e) =>
                                setCustomQuotaValue({
                                  ...customQuotaValue,
                                  [pUser.username]: Math.max(1, Number(e.target.value)),
                                })
                              }
                              className="w-20 px-2 py-1 text-xs font-mono rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500"
                            />
                            <span className="text-gray-500">GB</span>
                            <button
                              type="button"
                              onClick={() =>
                                setCustomQuotaMode({
                                  ...customQuotaMode,
                                  [pUser.username]: false,
                                })
                              }
                              className="p-1 rounded text-gray-400 hover:text-gray-600"
                              title="Zurück zu Optionen"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <select
                            value={quotaVal}
                            onChange={(e) => {
                              if (e.target.value === 'custom') {
                                setCustomQuotaMode({
                                  ...customQuotaMode,
                                  [pUser.username]: true,
                                });
                                setCustomQuotaValue({
                                  ...customQuotaValue,
                                  [pUser.username]: quotaVal,
                                });
                              } else {
                                setPendingQuotas({
                                  ...pendingQuotas,
                                  [pUser.username]: Number(e.target.value),
                                });
                              }
                            }}
                            className="px-2.5 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 font-mono text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500"
                          >
                            {PRESET_QUOTAS.map((q) => (
                              <option key={q} value={q} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                                {q} GB
                              </option>
                            ))}
                            <option value="custom" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">Benutzerdefiniert...</option>
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => initiateUserDeletion(pUser.username, 'reject')}
                            disabled={isDeletingUser}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors disabled:opacity-50"
                          >
                            <UserX className="w-3.5 h-3.5" />
                            <span>Ablehnen</span>
                          </button>
                          <button
                            onClick={() => handleApprove(pUser.username)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Freischalten ({quotaVal} GB)</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 2. Aktive Benutzer & Quota-Verwaltung */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <h3 className="font-bold text-sm sm:text-base text-gray-900 dark:text-gray-100">
              Aktive Benutzer & Quota-Verwaltung ({activeUsers.length})
            </h3>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 uppercase font-semibold border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3">Benutzername</th>
                <th className="px-4 py-3">Rolle</th>
                <th className="px-4 py-3">Speicher-Limit (Quota)</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 bg-white dark:bg-gray-800/60">
              {activeUsers.map((aUser) => {
                const isMaster = aUser.role === 'master';
                const isCustom = customQuotaMode[aUser.username];

                return (
                  <tr key={aUser.username} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">
                      @{aUser.username}
                    </td>
                    <td className="px-4 py-3">
                      {isMaster ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-purple-600 dark:text-purple-400">
                          <Shield className="w-3.5 h-3.5" /> Master
                        </span>
                      ) : (
                        <span className="text-gray-500">Standard</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isCustom ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={1}
                            max={50000}
                            defaultValue={aUser.quota_gb}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const val = Number((e.target as HTMLInputElement).value);
                                if (val > 0) {
                                  onUpdateUserQuota(aUser.username, val);
                                  setCustomQuotaMode({
                                    ...customQuotaMode,
                                    [aUser.username]: false,
                                  });
                                }
                              }
                            }}
                            className="w-20 px-2 py-1 text-xs font-mono rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500"
                          />
                          <span className="text-gray-500">GB</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              const input = e.currentTarget.previousElementSibling?.previousElementSibling as HTMLInputElement;
                              const val = Number(input?.value || aUser.quota_gb);
                              if (val > 0) {
                                onUpdateUserQuota(aUser.username, val);
                                setCustomQuotaMode({
                                  ...customQuotaMode,
                                  [aUser.username]: false,
                                });
                              }
                            }}
                            className="p-1 rounded text-emerald-600 hover:text-emerald-700"
                            title="Speichern"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setCustomQuotaMode({
                                ...customQuotaMode,
                                [aUser.username]: false,
                              })
                            }
                            className="p-1 rounded text-gray-400 hover:text-gray-600"
                            title="Abbrechen"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <select
                            value={PRESET_QUOTAS.includes(aUser.quota_gb) ? aUser.quota_gb : 'custom'}
                            onChange={(e) => {
                              if (e.target.value === 'custom') {
                                setCustomQuotaMode({
                                  ...customQuotaMode,
                                  [aUser.username]: true,
                                });
                              } else {
                                onUpdateUserQuota(aUser.username, Number(e.target.value));
                              }
                            }}
                            className="px-2.5 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 font-mono text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500"
                          >
                            {PRESET_QUOTAS.map((q) => (
                              <option key={q} value={q} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                                {q} GB
                              </option>
                            ))}
                            {!PRESET_QUOTAS.includes(aUser.quota_gb) && (
                              <option value="custom" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">{aUser.quota_gb} GB (Individuell)</option>
                            )}
                            <option value="custom" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">Benutzerdefiniert...</option>
                          </select>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Aktiv
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!isMaster ? (
                        <button
                          onClick={() => initiateUserDeletion(aUser.username, 'delete')}
                          disabled={isDeletingUser}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors disabled:opacity-50"
                          title="Benutzer löschen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="text-gray-400 text-[11px]">–</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Warndialog Modal bei Offline- oder fehlgeschlagener physischer Löschung */}
      {deleteWarningModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl p-6">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-gray-900 dark:text-gray-100">
                  Keine Verbindung zum Speicher-Server
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-2 leading-relaxed">
                  Die physischen Dateien des Nutzers <strong>@{deleteWarningModal.username}</strong> auf der Festplatte{' '}
                  (<code>/media/ssd/users/{deleteWarningModal.username}/</code>) konnten nicht gelöscht werden.
                </p>
                {deleteWarningModal.serverErrorMessage && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400/90 bg-amber-50 dark:bg-amber-950/40 p-2 rounded-lg mt-2 font-mono">
                    Grund: {deleteWarningModal.serverErrorMessage}
                  </p>
                )}
                <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 mt-3">
                  Möchtest du das Konto in der Datenbank trotzdem löschen?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-6 pt-3 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setDeleteWarningModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={confirmForceDelete}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-700 shadow-xs transition-colors"
              >
                Trotzdem löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
