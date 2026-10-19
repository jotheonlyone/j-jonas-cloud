import React, { useState } from 'react';
import { AlertTriangle, WifiOff, RefreshCw } from 'lucide-react';

interface MaintenanceBannerProps {
  isMaintenance: boolean;
  isOffline: boolean;
  isMaster: boolean;
  onDisableMaintenance?: () => void;
  onRetryConnection?: () => Promise<void> | void;
}

export const MaintenanceBanner: React.FC<MaintenanceBannerProps> = ({
  isMaintenance,
  isOffline,
  isMaster,
  onDisableMaintenance,
  onRetryConnection,
}) => {
  const [isChecking, setIsChecking] = useState(false);

  if (!isMaintenance && !isOffline) return null;

  const handleRetry = async () => {
    if (isChecking || !onRetryConnection) return;
    setIsChecking(true);
    try {
      await onRetryConnection();
    } finally {
      setTimeout(() => setIsChecking(false), 600);
    }
  };

  return (
    <div className="maintenance-banner bg-amber-500 text-slate-950 dark:bg-amber-500 dark:text-slate-950 px-4 py-2.5 sm:px-6 shadow-md select-none border-b border-amber-600/50 relative z-40 font-semibold">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs sm:text-sm">
        <div className="flex items-center gap-2.5">
          <div className="p-1 rounded-md bg-black/15 text-slate-950 shrink-0">
            {isMaintenance ? (
              <AlertTriangle className="w-4 h-4 shrink-0 text-slate-950" />
            ) : (
              <WifiOff className="w-4 h-4 shrink-0 text-slate-950" />
            )}
          </div>
          <span className="text-slate-950">
            {isMaintenance ? (
              <>
                <strong className="font-black text-black">Wartungsarbeiten:</strong> Dateizugriff vorübergehend pausiert.
                {!isMaster && ' Uploads, Löschungen und Ordnererstellung sind vorübergehend gesperrt.'}
              </>
            ) : (
              <>
                <strong className="font-black text-black">Server offline:</strong> Keine Verbindung zu https://storage.j-jonas.com. Dateizugriff vorübergehend pausiert.
              </>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isOffline && onRetryConnection && (
            <button
              onClick={handleRetry}
              disabled={isChecking}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/15 hover:bg-black/25 text-slate-950 font-bold text-xs transition-all disabled:opacity-60 active:scale-95 border border-black/20 shadow-xs cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
              <span>{isChecking ? 'Wird geprüft...' : 'Verbindung prüfen'}</span>
            </button>
          )}

          {isMaintenance && isMaster && onDisableMaintenance && (
            <button
              onClick={onDisableMaintenance}
              className="px-3 py-1.5 rounded-lg bg-black text-amber-100 hover:bg-neutral-900 font-bold text-xs shadow-md transition-colors cursor-pointer"
            >
              Wartungsmodus beenden
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
