import React, { useState } from 'react';
import {
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronDown,
  ChevronUp,
  FileVideo,
  File as FileIcon,
  Loader2,
} from 'lucide-react';
import { formatBytes } from '../services/storageApi';

export interface UploadTaskState {
  id: string;
  fileName: string;
  fileSize: number;
  currentChunk: number;
  totalChunks: number;
  progressPercent: number;
  uploadedBytes: number;
  status: 'uploading' | 'completed' | 'error';
  errorMessage?: string;
  fileIndex?: number;
  totalFiles?: number;
}

interface UploadProgressWidgetProps {
  task: UploadTaskState | null;
  onClose?: () => void;
}

export const UploadProgressWidget: React.FC<UploadProgressWidgetProps> = ({ task, onClose }) => {
  const [isMinimized, setIsMinimized] = useState(false);

  if (!task) return null;

  const isVideo = /\.(mp4|mkv|mov|webm|avi|m4v|ts)$/i.test(task.fileName);
  const isMultiFile = (task.totalFiles ?? 1) > 1;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 max-w-sm w-[92vw] sm:w-96 rounded-2xl shadow-2xl border border-gray-200/90 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md overflow-hidden transition-all duration-300 font-sans animate-in slide-in-from-bottom-4"
      role="status"
      aria-live="polite"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50/80 dark:bg-gray-850/80 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2.5 min-w-0 pr-2">
          {task.status === 'uploading' && (
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shrink-0">
              <UploadCloud className="w-4 h-4 animate-bounce" />
            </div>
          )}
          {task.status === 'completed' && (
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          )}
          {task.status === 'error' && (
            <div className="p-1.5 rounded-lg bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
          )}

          <div className="min-w-0">
            <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">
              {task.status === 'uploading' && (isMultiFile ? `Upload (${task.fileIndex}/${task.totalFiles})` : 'Wird hochgeladen...')}
              {task.status === 'completed' && 'Upload abgeschlossen'}
              {task.status === 'error' && 'Upload fehlgeschlagen'}
            </h4>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">
              {task.status === 'uploading' && `${task.progressPercent}% abgeschlossen`}
              {task.status === 'completed' && '100% · Gespeichert'}
              {task.status === 'error' && 'Fehler aufgetreten'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200/60 dark:hover:bg-gray-800 transition-colors"
            title={isMinimized ? 'Maximieren' : 'Minimieren'}
            aria-label={isMinimized ? 'Maximieren' : 'Minimieren'}
          >
            {isMinimized ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200/60 dark:hover:bg-gray-800 transition-colors"
              title="Schließen"
              aria-label="Schließen"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Body: Only visible when not minimized */}
      {!isMinimized && (
        <div className="p-4 space-y-3">
          {/* File details */}
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 shrink-0">
              {isVideo ? <FileVideo className="w-4 h-4 text-violet-500" /> : <FileIcon className="w-4 h-4 text-blue-500" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate" title={task.fileName}>
                {task.fileName}
              </p>
              <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                <span>{formatBytes(task.fileSize)}</span>
                {task.totalChunks > 1 && (
                  <>
                    <span>·</span>
                    <span className="text-blue-600 dark:text-blue-400 font-medium">
                      Chunk {task.currentChunk} / {task.totalChunks} (20 MB Chunks)
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden relative">
              <div
                className={`h-full transition-all duration-300 ease-out rounded-full ${
                  task.status === 'completed'
                    ? 'bg-emerald-500'
                    : task.status === 'error'
                    ? 'bg-red-500'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-500'
                }`}
                style={{ width: `${task.progressPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 font-mono">
              <span>
                {task.status === 'uploading' && (
                  <span className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                    <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                    {task.uploadedBytes > 0
                      ? `${formatBytes(task.uploadedBytes)} von ${formatBytes(task.fileSize)}`
                      : 'Wird vorbereitet...'}
                  </span>
                )}
                {task.status === 'completed' && <span className="text-emerald-600 font-medium">Vollständig hochgeladen</span>}
                {task.status === 'error' && <span className="text-red-500 font-medium">{task.errorMessage || 'Fehler'}</span>}
              </span>
              <span className="font-bold text-gray-700 dark:text-gray-200 tabular-nums">
                {task.progressPercent}%
              </span>
            </div>
          </div>

          {/* Cloudflare Tunnel optimization note */}
          {task.totalChunks > 1 && task.status === 'uploading' && (
            <p className="text-[10px] text-gray-400 dark:text-gray-500 italic">
              Optimiert für Cloudflare-Tunnel: Upload wird in 20-MB-Stücken übertragen.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
