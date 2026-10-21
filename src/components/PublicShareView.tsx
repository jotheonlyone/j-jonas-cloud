import React, { useState, useEffect } from 'react';
import {
  Cloud,
  Download,
  Eye,
  EyeOff,
  Folder,
  FileText,
  FileCode,
  FileImage,
  FileVideo,
  FileArchive,
  FileAudio,
  File as FileGeneric,
  ArrowLeft,
  Calendar,
  HardDrive,
  Info,
  Check,
  AlertCircle,
  Loader2,
  ExternalLink
} from 'lucide-react';
import type { FileItemData } from '../types';
import {
  getPublicShareStreamUrl,
  getPublicShareDownloadUrl,
  getPublicShareThumbnailUrl,
  getPublicDownloadUrl,
  getPublicStreamUrl,
  getPublicFolderFiles,
  formatBytes,
  formatCleanTitle,
  STORAGE_BASE_URL,
} from '../services/storageApi';
import { getPublicFileShare } from '../services/firebase';

interface PublicShareViewProps {
  darkMode?: boolean;
  onGoToHome?: () => void;
}

export function getPublicFileIcon(filename: string, isFolder = false) {
  if (isFolder) {
    return <Folder className="w-8 h-8 text-amber-500 fill-amber-500/20 shrink-0" />;
  }
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'avif'].includes(ext)) {
    return <FileImage className="w-8 h-8 text-emerald-500 shrink-0" />;
  }
  if (['pdf'].includes(ext)) {
    return <FileText className="w-8 h-8 text-red-500 shrink-0" />;
  }
  if (['mp4', 'mov', 'mkv', 'avi', 'webm', 'm4v', 'ts'].includes(ext)) {
    return <FileVideo className="w-8 h-8 text-violet-500 shrink-0" />;
  }
  if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) {
    return <FileArchive className="w-8 h-8 text-yellow-600 shrink-0" />;
  }
  if (['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac'].includes(ext)) {
    return <FileAudio className="w-8 h-8 text-pink-500 shrink-0" />;
  }
  if (['py', 'js', 'ts', 'tsx', 'jsx', 'json', 'html', 'css', 'md', 'sh'].includes(ext)) {
    return <FileCode className="w-8 h-8 text-blue-500 shrink-0" />;
  }
  return <FileGeneric className="w-8 h-8 text-gray-400 shrink-0" />;
}

export const PublicShareView: React.FC<PublicShareViewProps> = ({
  darkMode = false,
  onGoToHome,
}) => {
  const [shareId, setShareId] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [filePath, setFilePath] = useState<string>('');
  const [createdAt, setCreatedAt] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isFolder, setIsFolder] = useState(false);
  const [folderFiles, setFolderFiles] = useState<FileItemData[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [thumbError, setThumbError] = useState(false);

  // Parse URL: /share/:shareId bzw. /share/:username/:path*
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const pathname = window.location.pathname.replace(/\/+$/, '');
    const segments = pathname.replace(/^\/+/, '').split('/').filter(Boolean);

    let isMounted = true;
    setIsLoading(true);
    setErrorMessage(null);

    const loadPublicShare = async () => {
      // 1. Moderne Einzelfreigabe mit unerratbarer ID: /share/:shareId
      if (segments[0]?.toLowerCase() === 'share' && segments.length === 2) {
        const sId = decodeURIComponent(segments[1]);
        setShareId(sId);

        try {
          // Aus separater Firestore-Sammlung 'public_shares' laden
          const shareDoc = await getPublicFileShare(sId);
          if (!isMounted) return;

          if (shareDoc) {
            setUsername(shareDoc.owner);
            setFilePath(shareDoc.file_path);
            setCreatedAt(shareDoc.created_at);
            setIsLoading(false);
            return;
          }

          // Fallback: Direkte HEAD-Prüfung gegen Backend https://storage.j-jonas.com/public-share/:shareId
          const headUrl = getPublicShareStreamUrl(sId);
          const headRes = await fetch(headUrl, { method: 'HEAD' });
          if (!isMounted) return;

          if (headRes.ok || headRes.status === 206 || headRes.status === 200) {
            const cd = headRes.headers.get('Content-Disposition') || '';
            const matchName = cd.match(/filename=["']?([^"']+)["']?/i);
            const inferredName = matchName ? matchName[1] : `Datei_${sId.slice(0, 8)}`;
            setFilePath(inferredName);
            setIsLoading(false);
            return;
          }

          setErrorMessage('Die Freigabe existiert nicht oder wurde entfernt.');
          setIsLoading(false);
        } catch (err) {
          if (isMounted) {
            setErrorMessage('Freigabelink nicht gefunden oder Server offline.');
            setIsLoading(false);
          }
        }
        return;
      }

      // 2. Legacy-URL / Ordnerfreigabe: /share/:username/:path*
      if (segments[0]?.toLowerCase() === 'share' && segments.length > 2) {
        const user = decodeURIComponent(segments[1]);
        const rawPath = segments.slice(2).map(decodeURIComponent).join('/');
        setUsername(user);
        setFilePath(rawPath);

        try {
          const folderRes = await getPublicFolderFiles(user, rawPath);
          if (!isMounted) return;

          if (folderRes.isFolder) {
            setIsFolder(true);
            setFolderFiles(folderRes.items);
            setIsLoading(false);
            return;
          }

          setIsFolder(false);
          setIsLoading(false);
        } catch {
          if (isMounted) {
            setErrorMessage('Datei oder Ordner konnte nicht geladen werden.');
            setIsLoading(false);
          }
        }
        return;
      }

      setErrorMessage('Ungültige Freigabe-URL.');
      setIsLoading(false);
    };

    loadPublicShare();

    return () => {
      isMounted = false;
    };
  }, []);

  const fileName = filePath.split('/').pop() || filePath || 'Freigegebene Datei';
  const cleanPath = filePath.trim().replace(/^\/+/, '');

  // URLs gemäß Vorgaben für unerratbare shareId (ohne Auth-Header und ohne ?token=):
  // Anzeigen / Streamen: https://storage.j-jonas.com/public-share/:shareId
  // Download: https://storage.j-jonas.com/public-share/:shareId?download=true
  // Vorschaubild (Thumbnail): https://storage.j-jonas.com/public-share/:shareId?thumb=true
  const streamUrl = shareId
    ? getPublicShareStreamUrl(shareId)
    : (username && filePath ? getPublicStreamUrl(username, cleanPath) : '');

  const downloadUrl = shareId
    ? getPublicShareDownloadUrl(shareId)
    : (username && filePath ? getPublicDownloadUrl(username, cleanPath) : '');

  const thumbnailUrl = shareId
    ? getPublicShareThumbnailUrl(shareId)
    : '';

  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const isVideo = ['mp4', 'webm', 'ogg', 'mov', 'mkv', 'm4v', 'ts'].includes(ext);
  const isAudio = ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext);
  const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'avif', 'bmp'].includes(ext);
  const isPdf = ext === 'pdf';
  const isPreviewable = isVideo || isAudio || isImage || isPdf;

  const handleDownload = () => {
    if (!downloadUrl) return;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.setAttribute('download', fileName);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafd] dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors font-sans selection:bg-blue-500 selection:text-white">
      {/* Top Header */}
      <header className="h-16 border-b border-gray-200/80 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-base sm:text-lg tracking-tight text-gray-900 dark:text-white">
              J.Jonas Cloud
            </span>
            <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800">
              Öffentliche Freigabe
            </span>
          </div>
        </div>

        {onGoToHome && (
          <button
            onClick={onGoToHome}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Zur Cloud-Anmeldung</span>
          </button>
        )}
      </header>

      {/* Main Content View */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center text-center p-8">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600 dark:text-blue-400 mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
              Freigabe wird geladen...
            </p>
          </div>
        ) : errorMessage ? (
          <div className="max-w-md w-full p-8 rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              Freigabelink nicht gefunden
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
              {errorMessage} Bitte überprüfe den Link oder wende dich an die Person, die die Datei geteilt hat.
            </p>
            {onGoToHome && (
              <button
                onClick={onGoToHome}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all"
              >
                Zur Startseite
              </button>
            )}
          </div>
        ) : isFolder ? (
          /* ========================================================================= */
          /* FOLDER CONTENT VIEW (Legacy)                                              */
          /* ========================================================================= */
          <div className="w-full max-w-4xl bg-white dark:bg-gray-900 rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-xl overflow-hidden animate-in fade-in duration-200">
            <div className="p-6 sm:p-8 bg-linear-to-b from-blue-50/50 to-transparent dark:from-blue-950/20 dark:to-transparent border-b border-gray-100 dark:border-gray-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/60 flex items-center justify-center shrink-0">
                    <Folder className="w-7 h-7 text-amber-500 fill-amber-500/20" />
                  </div>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                      {fileName || 'Geteilter Ordner'}
                    </h1>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Freigegeben von <span className="font-semibold text-gray-700 dark:text-gray-300">@{username}</span> • {folderFiles.length} {folderFiles.length === 1 ? 'Element' : 'Elemente'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-6">
              {folderFiles.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">
                  Dieser Ordner ist leer.
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800/80">
                  {folderFiles.map((file) => (
                    <div
                      key={file.name}
                      className="py-3 px-3 flex items-center justify-between gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-xl transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {getPublicFileIcon(file.name, file.type === 'folder')}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                            {file.name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {file.type === 'folder' ? 'Ordner' : formatBytes(file.size)}
                          </p>
                        </div>
                      </div>

                      {file.type === 'file' && (
                        <a
                          href={`${STORAGE_BASE_URL}/download?user=${encodeURIComponent(username)}&path=${encodeURIComponent(file.path || (filePath ? `${filePath}/${file.name}` : file.name))}&download=true`}
                          download={file.name}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-gray-800 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 text-gray-700 dark:text-gray-300 transition-colors shadow-2xs shrink-0"
                          title="Herunterladen"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Herunterladen</span>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* SINGLE FILE DOWNLOAD & PREVIEW (Öffentliche Freigabe mit unerratbarer ID) */
          /* ========================================================================= */
          <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Top decorative badge with thumbnail or icon */}
            <div className="p-6 sm:p-8 flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-3xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200/60 dark:border-gray-700/60 flex items-center justify-center mb-5 shadow-xs overflow-hidden relative">
                {thumbnailUrl && !thumbError && (isImage || isVideo) ? (
                  <img
                    src={thumbnailUrl}
                    alt={fileName}
                    className="w-full h-full object-cover"
                    onError={() => setThumbError(true)}
                  />
                ) : (
                  getPublicFileIcon(fileName)
                )}
              </div>

              <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white break-all leading-snug">
                {fileName}
              </h1>

              {/* Beautified Title for movies/videos */}
              {isVideo && formatCleanTitle(fileName) !== fileName && (
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mt-1">
                  "{formatCleanTitle(fileName)}"
                </p>
              )}

              <div className="flex flex-wrap items-center justify-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
                {username && (
                  <span>
                    Freigegeben von <span className="font-semibold text-gray-700 dark:text-gray-300">@{username}</span>
                  </span>
                )}
                {createdAt && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-mono text-[11px]">
                      <Calendar className="w-3 h-3 text-gray-400" />
                      {new Date(createdAt).toLocaleDateString('de-DE')}
                    </span>
                  </>
                )}
              </div>

              {/* Action Buttons */}
              <div className="w-full mt-6 flex flex-col sm:flex-row items-center gap-3">
                <a
                  href={downloadUrl}
                  download={fileName}
                  className="w-full flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-semibold text-sm transition-all shadow-md shadow-blue-500/20"
                >
                  <Download className="w-4 h-4" />
                  <span>Jetzt Herunterladen</span>
                </a>

                {isPreviewable && (
                  <button
                    type="button"
                    onClick={() => setShowPreview(!showPreview)}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-98 text-gray-800 dark:text-gray-200 font-semibold text-sm transition-all"
                  >
                    {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    <span>{showPreview ? 'Vorschau schließen' : 'Vorschau'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Embedded Live Preview */}
            {showPreview && isPreviewable && (
              <div className="border-t border-gray-100 dark:border-gray-800 bg-black/95 p-4 sm:p-6 animate-in fade-in duration-150">
                {isVideo && (
                  <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black flex items-center justify-center shadow-lg">
                    <video
                      src={streamUrl}
                      poster={thumbnailUrl || undefined}
                      controls
                      playsInline
                      autoPlay
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}

                {isAudio && (
                  <div className="p-4 bg-gray-900 rounded-2xl">
                    <audio
                      src={streamUrl}
                      controls
                      autoPlay
                      className="w-full"
                    />
                  </div>
                )}

                {isImage && (
                  <div className="max-h-[480px] rounded-2xl overflow-hidden flex items-center justify-center bg-black">
                    <img
                      src={streamUrl}
                      alt={fileName}
                      className="max-h-[480px] w-full object-contain rounded-2xl"
                    />
                  </div>
                )}

                {isPdf && (
                  <iframe
                    src={streamUrl}
                    title={fileName}
                    className="w-full h-96 rounded-2xl border-0 bg-white"
                  />
                )}
              </div>
            )}

            {/* Bottom minimal footer */}
            <div className="px-6 py-3.5 bg-gray-50/70 dark:bg-gray-800/40 border-t border-gray-100 dark:border-gray-800 text-center">
              <span className="text-[11px] text-gray-400">
                Sicher bereitgestellt von <span className="font-semibold text-gray-600 dark:text-gray-300">J.Jonas Cloud</span>
              </span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
