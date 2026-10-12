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
    <div className="bg-amber-500 text-amber-950 px-4 py-2.5 sm:px-6 shadow-xs select-none border-b border-amber-600/30">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs sm:text-sm font-medium">
        <div className="flex items-center gap-2.5">
          <div className="p-1 rounded-md bg-amber-600/30 text-amber-950">
            {isMaintenance ? (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            ) : (
              <WifiOff className="w-4 h-4 shrink-0" />
            )}
          </div>
          <span>
            {isMaintenance ? (
              <>
                <strong>Wartungsarbeiten:</strong> Dateizugriff vorübergehend pausiert.
                {!isMaster && ' Uploads, Löschungen und Ordnererstellung sind vorübergehend gesperrt.'}
              </>
            ) : (
              <>
                <strong>Server offline:</strong> Keine Verbindung zu https://storage.j-jonas.com. Dateizugriff vorübergehend pausiert.
              </>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isOffline && onRetryConnection && (
            <button
              onClick={handleRetry}
              disabled={isChecking}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-600/30 hover:bg-amber-600/40 text-amber-950 font-semibold text-xs transition-colors disabled:opacity-60 active:scale-95"
            >
              <RefreshCw className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`} />
              <span>{isChecking ? 'Wird geprüft...' : 'Verbindung prüfen'}</span>
            </button>
          )}

          {isMaintenance && isMaster && onDisableMaintenance && (
            <button
              onClick={onDisableMaintenance}
              className="px-3 py-1 rounded-lg bg-amber-950 text-amber-100 hover:bg-black font-semibold text-xs shadow-xs transition-colors"
            >
              Wartungsmodus beenden
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
