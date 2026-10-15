import React, { useState, useEffect, useRef } from 'react';
import {
  Download,
  X,
  Lock,
  ShieldAlert,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  FileText,
  Copy,
  Check,
  Music,
  ExternalLink,
  Sun,
  Moon,
  ArrowLeft
} from 'lucide-react';
import { getActiveUser } from '../services/accountManager';
import { getStreamUrl, triggerDirectDownload, getFileMetadata } from '../services/storageApi';
import { isImageFile, isVideoFile, isPdfFile } from './MediaViewerModal';
import { getSmallFileIcon } from './FileItem';

export function isAudioFile(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma', 'opus'].includes(ext);
}

export function isTextFile(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return [
    'txt', 'md', 'json', 'js', 'ts', 'tsx', 'jsx', 'html', 'css',
    'py', 'sh', 'log', 'csv', 'xml', 'yaml', 'yml', 'env', 'ini',
    'sql', 'conf', 'rtf'
  ].includes(ext);
}

interface FileViewerPageProps {
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export const FileViewerPage: React.FC<FileViewerPageProps> = ({
  darkMode = true,
  onToggleDarkMode,
}) => {
  const [activeUser, setActiveUser] = useState(() => getActiveUser());
  const [copiedText, setCopiedText] = useState(false);

  // Parse Query Parameters
  const [fileParams, setFileParams] = useState<{
    path: string;
    name: string;
    owner: string;
    sessionRef: string;
  }>(() => {
    if (typeof window === 'undefined') {
      return { path: '', name: 'Datei', owner: '', sessionRef: '' };
    }
    const params = new URLSearchParams(window.location.search);
    const p = params.get('path') || '';
    const n = params.get('name') || p.split('/').filter(Boolean).pop() || 'Datei';
    const o = params.get('owner') || (getActiveUser()?.username || '');
    const s = params.get('session_ref') || '';
    return { path: p, name: n, owner: o, sessionRef: s };
  });

  // Listen for storage changes in case of session updates
  useEffect(() => {
    const handleStorage = () => {
      setActiveUser(getActiveUser());
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Update page title
  useEffect(() => {
    if (fileParams.name) {
      document.title = `${fileParams.name} – J.Jonas Cloud Vorschau`;
    }
  }, [fileParams.name]);

  // Image Zoom & Pan State
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Text content loading state
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isTextLoading, setIsTextLoading] = useState(false);
  const [textError, setTextError] = useState<string | null>(null);

  const { path, name, owner } = fileParams;
  const streamUrl = path ? getStreamUrl(path, owner) : '';

  const [description, setDescription] = useState<string>('');
  useEffect(() => {
    if (path) {
      getFileMetadata(path, owner)
        .then((res) => {
          if (res.description) setDescription(res.description);
        })
        .catch(() => {});
    }
  }, [path, owner]);

  const isImg = isImageFile({ name, type: 'file' } as any);
  const isVid = isVideoFile({ name, type: 'file' } as any);
  const isPdf = isPdfFile({ name, type: 'file' } as any);
  const isAud = isAudioFile(name);
  const isTxt = isTextFile(name);

  // Load text file content if applicable
  useEffect(() => {
    if (isTxt && streamUrl && activeUser) {
      setIsTextLoading(true);
      setTextError(null);
      fetch(streamUrl)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.text();
        })
        .then((text) => {
          setTextContent(text);
          setIsTextLoading(false);
        })
        .catch((err) => {
          setTextError('Dateiinhalt konnte nicht geladen werden.');
          setIsTextLoading(false);
        });
    }
  }, [isTxt, streamUrl, activeUser]);

  // Zoom handlers for image
  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 4));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.25));
  const handleResetZoom = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel <= 1) return;
    setIsPanning(true);
    panStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning || zoomLevel <= 1) return;
    setPanOffset({
      x: e.clientX - panStartRef.current.x,
      y: e.clientY - panStartRef.current.y,
    });
  };

  const handleMouseUp = () => setIsPanning(false);

  // Download handler
  const handleDownload = () => {
    if (!path) return;
    triggerDirectDownload(owner || activeUser?.username || '', path, name);
  };

  // Close tab handler
  const handleCloseTab = () => {
    if (window.opener) {
      window.close();
    } else {
      // If window.close() is blocked because it was not opened by a script, navigate to root
      window.location.href = '/';
    }
  };

  const handleCopyText = () => {
    if (!textContent) return;
    navigator.clipboard.writeText(textContent);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  // SECURITY CHECK: Unauthorized view
  if (!activeUser || activeUser.status !== 'active') {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-4 ${darkMode ? 'bg-gray-950 text-gray-100' : 'bg-gray-50 text-gray-900'} font-sans select-none`}>
        <div className="w-full max-w-md p-8 rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50 flex items-center justify-center text-red-600 dark:text-red-400">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold mb-2">Zugriff verweigert</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
            Diese Dateivorschau erfordert eine aktive, autorisierte Sitzung in der J.Jonas Cloud.
            Bitte melden Sie sich in Ihrem Konto an, um auf diese Datei zuzugreifen.
          </p>
          <a
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-all shadow-md hover:shadow-lg"
          >
            <Lock className="w-4 h-4" />
            <span>Zur Anmeldung</span>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen w-screen flex flex-col ${darkMode ? 'bg-[#0f1115] text-gray-100' : 'bg-gray-100 text-gray-900'} overflow-hidden select-none font-sans`}>
      {/* TOP HEADER BAR */}
      <header className="h-14 px-4 sm:px-6 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-200/80 dark:border-gray-800 flex items-center justify-between gap-4 z-30 shrink-0">
        {/* Left: Brand & File title */}
        <div className="flex items-center gap-3 min-w-0">
          <a
            href="/"
            className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors text-xs font-semibold shrink-0"
            title="Zurück zur Ablage"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">J.Jonas Cloud</span>
          </a>

          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1 rounded-lg bg-gray-100 dark:bg-gray-800 shrink-0">
              {getSmallFileIcon({ name, type: 'file' } as any)}
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold truncate text-gray-900 dark:text-gray-100" title={name}>
                {name}
              </h1>
              {path && (
                <p className="text-[11px] text-gray-400 truncate hidden md:block">
                  {path} {owner && `(Besitzer: @${owner})`}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Zoom controls for images (in header for small screens) */}
          {isImg && (
            <div className="hidden sm:flex items-center bg-gray-100 dark:bg-gray-800 rounded-xl p-0.5 border border-gray-200 dark:border-gray-700 text-xs mr-2">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 0.25}
                className="p-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 transition-colors disabled:opacity-40 cursor-pointer"
                title="Verkleinern"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                className="px-2 py-1 font-mono font-semibold text-[11px] text-gray-700 dark:text-gray-200 hover:text-blue-500 cursor-pointer"
                title="100% Zoom"
              >
                {Math.round(zoomLevel * 100)}%
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoomLevel >= 4}
                className="p-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 transition-colors disabled:opacity-40 cursor-pointer"
                title="Vergrößern"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                className="p-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 transition-colors cursor-pointer"
                title="Zurücksetzen"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Copy button for text */}
          {isTxt && textContent && (
            <button
              type="button"
              onClick={handleCopyText}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors cursor-pointer"
              title="Inhalt kopieren"
            >
              {copiedText ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copiedText ? 'Kopiert' : 'Kopieren'}</span>
            </button>
          )}

          {/* Theme Toggle */}
          {onToggleDarkMode && (
            <button
              type="button"
              onClick={onToggleDarkMode}
              className="p-2 rounded-xl text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              title={darkMode ? 'Heller Modus' : 'Dunkler Modus'}
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>
          )}

          {/* Download Button */}
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer"
            title="Datei herunterladen"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Herunterladen</span>
          </button>

          {/* Close Tab Button */}
          <button
            type="button"
            onClick={handleCloseTab}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-red-500 hover:text-white dark:hover:bg-red-600 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
            title="Tab schließen"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">Tab schließen</span>
          </button>
        </div>
      </header>

      {/* Description banner if metadata exists */}
      {description && (
        <div className="px-4 sm:px-6 py-2 bg-blue-50/90 dark:bg-blue-950/40 border-b border-blue-100 dark:border-blue-900/50 text-xs text-blue-950 dark:text-blue-200 flex items-center gap-2 shrink-0 z-20">
          <span className="font-bold uppercase tracking-wider text-[10px] text-blue-600 dark:text-blue-400 shrink-0">
            Beschreibung:
          </span>
          <span className="truncate">{description}</span>
        </div>
      )}

      {/* VIEWER CONTENT AREA */}
      <main className="flex-1 overflow-hidden relative flex items-center justify-center p-3 sm:p-6">
        {/* 1. IMAGE VIEWER */}
        {isImg && (
          <div
            className="w-full h-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing select-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <img
              src={streamUrl}
              alt={name}
              draggable={false}
              style={{
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
                transition: isPanning ? 'none' : 'transform 0.15s ease-out',
              }}
              className="max-h-[88vh] max-w-[92vw] object-contain rounded-xl shadow-2xl pointer-events-auto"
            />

            {/* Mobile floating zoom buttons */}
            <div className="sm:hidden absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/70 backdrop-blur-md text-white p-1 rounded-2xl border border-white/10 shadow-lg">
              <button
                type="button"
                onClick={handleZoomOut}
                className="p-2 rounded-xl hover:bg-white/10"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                className="px-2 text-xs font-mono font-bold"
              >
                {Math.round(zoomLevel * 100)}%
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                className="p-2 rounded-xl hover:bg-white/10"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* 2. VIDEO PLAYER */}
        {isVid && (
          <div className="w-full h-full max-w-5xl max-h-[85vh] flex items-center justify-center">
            <video
              src={streamUrl}
              controls
              autoPlay
              playsInline
              className="w-full h-full max-h-[85vh] rounded-2xl shadow-2xl bg-black outline-none border border-white/10 object-contain"
            >
              Ihr Browser unterstützt dieses Videoformat nicht.
            </video>
          </div>
        )}

        {/* 3. PDF VIEWER */}
        {isPdf && (
          <div className="w-full h-full max-w-6xl max-h-[92vh] rounded-2xl overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-800 bg-white">
            <iframe
              src={`${streamUrl}#toolbar=1&navpanes=0`}
              title={name}
              className="w-full h-full border-none"
            />
          </div>
        )}

        {/* 4. TEXT / CODE VIEWER */}
        {isTxt && (
          <div className="w-full h-full max-w-5xl max-h-[88vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700/80 flex items-center justify-between text-xs text-gray-500">
              <span className="font-mono">{name}</span>
              <span>{textContent ? `${textContent.split('\n').length} Zeilen` : 'Wird geladen...'}</span>
            </div>
            <div className="flex-1 overflow-auto p-4 sm:p-6 font-mono text-xs leading-relaxed">
              {isTextLoading ? (
                <div className="h-full flex items-center justify-center text-gray-400">
                  <span>Inhalt wird geladen...</span>
                </div>
              ) : textError ? (
                <div className="h-full flex items-center justify-center text-red-500">
                  <span>{textError}</span>
                </div>
              ) : (
                <pre className="whitespace-pre-wrap break-words text-gray-800 dark:text-gray-200">
                  {textContent}
                </pre>
              )}
            </div>
          </div>
        )}

        {/* 5. AUDIO PLAYER */}
        {isAud && (
          <div className="w-full max-w-md p-8 rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-pink-50 dark:bg-pink-950/40 border border-pink-200 dark:border-pink-900/50 flex items-center justify-center text-pink-500 shadow-inner">
              <Music className="w-10 h-10" />
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1 truncate">
              {name}
            </h3>
            <p className="text-xs text-gray-500 mb-6 truncate">{path}</p>
            <audio src={streamUrl} controls autoPlay className="w-full mb-4" />
          </div>
        )}

        {/* 6. FALLBACK DOWNLOAD CARD */}
        {!isImg && !isVid && !isPdf && !isTxt && !isAud && (
          <div className="w-full max-w-md p-8 rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 flex items-center justify-center text-blue-500 shadow-inner">
              <FileText className="w-10 h-10" />
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1 truncate">
              {name}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 truncate">
              Pfad: {path}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed mb-6">
              Für diesen Dateityp ist keine direkte In-Browser-Vorschau verfügbar.
              Sie können die Datei herunterladen und lokal öffnen.
            </p>
            <button
              type="button"
              onClick={handleDownload}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-all shadow-md cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Datei herunterladen</span>
            </button>
          </div>
        )}
      </main>
    </div>
  );
};
