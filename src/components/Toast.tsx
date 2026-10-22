import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X, Disc } from 'lucide-react';
import { AudioCoverArt } from './AudioPlayer/AudioCoverArt';

export type ToastType = 'success' | 'error' | 'info' | 'audio';

export interface ToastOptions {
  durationMs?: number;
  dismissOnClickAnywhere?: boolean;
}

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  coverPath?: string;
  currentUser?: string;
  durationMs?: number;
  dismissOnClickAnywhere?: boolean;
}

interface ToastContextType {
  toasts: ToastMessage[];
  addToast: (type: ToastType, title: string, message?: string, options?: ToastOptions) => void;
  addAudioToast: (title: string, message?: string, coverPath?: string, currentUser?: string) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type: ToastType, title: string, message?: string, options?: ToastOptions) => {
      const id = `${Date.now()}_${Math.random()}`;
      const durationMs = options?.durationMs ?? 4500;
      const dismissOnClickAnywhere = Boolean(options?.dismissOnClickAnywhere);

      setToasts((prev) => [
        ...prev,
        { id, type, title, message, durationMs, dismissOnClickAnywhere },
      ]);

      const timerId = setTimeout(() => {
        removeToast(id);
      }, durationMs);

      // Klick irgendwo auf dem Bildschirm schließt den Toast sofort
      if (dismissOnClickAnywhere && typeof window !== 'undefined') {
        const handleGlobalDismiss = () => {
          clearTimeout(timerId);
          removeToast(id);
          window.removeEventListener('click', handleGlobalDismiss, true);
          window.removeEventListener('pointerdown', handleGlobalDismiss, true);
        };
        setTimeout(() => {
          window.addEventListener('click', handleGlobalDismiss, { capture: true, once: true });
          window.addEventListener('pointerdown', handleGlobalDismiss, { capture: true, once: true });
        }, 80);
      }
    },
    [removeToast]
  );

  const addAudioToast = useCallback(
    (title: string, message?: string, coverPath?: string, currentUser?: string) => {
      // Remove any prior audio toast so only the latest track toast is shown
      const id = `audio_${Date.now()}`;
      setToasts((prev) => [
        ...prev.filter((t) => t.type !== 'audio'),
        { id, type: 'audio', title, message, coverPath, currentUser },
      ]);

      setTimeout(() => {
        removeToast(id);
      }, 5000);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, addAudioToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

const ToastContainer: React.FC<{ toasts: ToastMessage[]; onRemove: (id: string) => void }> = ({
  toasts,
  onRemove,
}) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 right-4 sm:right-8 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const isAudio = toast.type === 'audio';
        const hasMessage = Boolean(toast.message);

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex ${
              hasMessage ? 'items-start' : 'items-center'
            } gap-2.5 p-3 sm:px-4 sm:py-2.5 rounded-xl border shadow-lg backdrop-blur-xl transition-all animate-in fade-in slide-in-from-bottom-3 duration-200 ${
              isAudio
                ? 'bg-white/95 dark:bg-gray-900/95 border-blue-200/90 dark:border-blue-800/80 text-gray-900 dark:text-gray-100 ring-1 ring-blue-500/20'
                : toast.type === 'success'
                ? 'bg-white/95 dark:bg-slate-900/95 border-emerald-200 dark:border-emerald-800/60 text-slate-900 dark:text-slate-100'
                : toast.type === 'error'
                ? 'bg-white/95 dark:bg-slate-900/95 border-red-200 dark:border-red-800/60 text-slate-900 dark:text-slate-100'
                : 'bg-white/95 dark:bg-slate-900/95 border-gray-200/90 dark:border-gray-800/90 text-slate-900 dark:text-slate-100'
            }`}
          >
            {/* Visual Icon / Cover */}
            <div className="shrink-0">
              {isAudio ? (
                <div className="relative">
                  <AudioCoverArt
                    filePath={toast.coverPath || ''}
                    currentUser={toast.currentUser || ''}
                    title={toast.title}
                    className="w-10 h-10 rounded-xl shadow-xs"
                    iconClassName="w-5 h-5"
                  />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs">
                    <Disc className="w-2.5 h-2.5 animate-spin-slow" />
                  </div>
                </div>
              ) : (
                <div className={hasMessage ? 'mt-0.5' : 'flex items-center'}>
                  {toast.type === 'success' && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  )}
                  {toast.type === 'error' && (
                    <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                  )}
                  {toast.type === 'info' && (
                    <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  )}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pr-1">
              {isAudio && (
                <span className="text-[10px] uppercase font-bold tracking-wider text-blue-600 dark:text-blue-400 block mb-0.5">
                  Jetzt läuft
                </span>
              )}
              <h4
                className={`text-xs sm:text-sm font-semibold tracking-tight ${
                  hasMessage ? 'leading-snug truncate' : 'leading-normal'
                }`}
                title={toast.title}
              >
                {toast.title}
              </h4>
              {toast.message && (
                <p
                  className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed line-clamp-2"
                  title={toast.message}
                >
                  {toast.message}
                </p>
              )}
            </div>

            {/* Close Button */}
            <button
              onClick={() => onRemove(toast.id)}
              className="shrink-0 p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              aria-label="Schließen"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
