import React, { useEffect, useState, useRef } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize2,
  FileText,
  Video as VideoIcon,
  Image as ImageIcon
} from 'lucide-react';
import type { FileItemData } from '../types';
import { getStreamUrl } from '../services/storageApi';

interface MediaViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeItem: FileItemData | null;
  allItems: FileItemData[];
  onDownload: (item: FileItemData) => void;
}

export function isImageFile(item: FileItemData): boolean {
  if (item.type !== 'file') return false;
  const ext = item.name.split('.').pop()?.toLowerCase() || '';
  return ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'avif'].includes(ext);
}

export function isVideoFile(item: FileItemData): boolean {
  if (item.type !== 'file') return false;
  const ext = item.name.split('.').pop()?.toLowerCase() || '';
  return ['mp4', 'webm', 'mov', 'mkv', 'ogg'].includes(ext);
}

export function isPdfFile(item: FileItemData): boolean {
  if (item.type !== 'file') return false;
  const ext = item.name.split('.').pop()?.toLowerCase() || '';
  return ext === 'pdf';
}

export const MediaViewerModal: React.FC<MediaViewerModalProps> = ({
  isOpen,
  onClose,
  activeItem,
  allItems,
  onDownload,
}) => {
  const [currentItem, setCurrentItem] = useState<FileItemData | null>(activeItem);

  // Sync internal state when activeItem changes
  useEffect(() => {
    setCurrentItem(activeItem);
  }, [activeItem]);

  // Extract all images in current folder for lightbox navigation
  const imageList = allItems.filter(isImageFile);
  const currentImageIndex = currentItem
    ? imageList.findIndex((img) => (img.path || img.name) === (currentItem.path || currentItem.name))
    : -1;

  const isCurrentAnImage = currentItem ? isImageFile(currentItem) : false;
  const isCurrentAVideo = currentItem ? isVideoFile(currentItem) : false;
  const isCurrentAPdf = currentItem ? isPdfFile(currentItem) : false;

  const handlePrevImage = () => {
    if (currentImageIndex > 0) {
      setCurrentItem(imageList[currentImageIndex - 1]);
    } else if (currentImageIndex === 0 && imageList.length > 1) {
      // wrap around
      setCurrentItem(imageList[imageList.length - 1]);
    }
  };

  const handleNextImage = () => {
    if (currentImageIndex !== -1 && currentImageIndex < imageList.length - 1) {
      setCurrentItem(imageList[currentImageIndex + 1]);
    } else if (currentImageIndex === imageList.length - 1 && imageList.length > 1) {
      // wrap around
      setCurrentItem(imageList[0]);
    }
  };

  // Keyboard navigation: Escape to close, Left/Right for images
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && isCurrentAnImage) {
        handlePrevImage();
      } else if (e.key === 'ArrowRight' && isCurrentAnImage) {
        handleNextImage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isCurrentAnImage, currentImageIndex, imageList]);

  // Touch Swipe gestures for mobile lightbox
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const diff = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 45; // pixels
    if (diff > minSwipeDistance) {
      // Swiped Left -> Next
      handleNextImage();
    } else if (diff < -minSwipeDistance) {
      // Swiped Right -> Prev
      handlePrevImage();
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  if (!isOpen || !currentItem) return null;

  const streamUrl = getStreamUrl(currentItem.path || currentItem.name);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 select-none animate-in fade-in duration-150"
      onClick={onClose}
    >
      {/* Container - Stop propagation inside */}
      <div
        className="relative w-full h-full max-w-6xl max-h-[92vh] flex flex-col items-center justify-between pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="w-full flex items-center justify-between px-4 py-3 bg-gray-900/80 backdrop-blur-md text-white rounded-2xl border border-white/10 shadow-lg z-20">
          <div className="flex items-center gap-3 min-w-0 pr-4">
            {isCurrentAnImage && <ImageIcon className="w-5 h-5 text-emerald-400 shrink-0" />}
            {isCurrentAVideo && <VideoIcon className="w-5 h-5 text-violet-400 shrink-0" />}
            {isCurrentAPdf && <FileText className="w-5 h-5 text-red-400 shrink-0" />}
            <span className="text-sm font-semibold truncate max-w-xs sm:max-w-md" title={currentItem.name}>
              {currentItem.name}
            </span>
            {isCurrentAnImage && imageList.length > 1 && (
              <span className="text-xs text-gray-400 shrink-0 bg-white/10 px-2 py-0.5 rounded-full font-mono">
                {currentImageIndex + 1} / {imageList.length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Download Button */}
            <button
              onClick={() => onDownload(currentItem)}
              className="p-2 rounded-xl text-gray-300 hover:text-white bg-white/5 hover:bg-white/15 transition-colors flex items-center gap-1.5 text-xs font-semibold"
              title="Herunterladen"
            >
              <Download className="w-4 h-4 text-blue-400" />
              <span className="hidden sm:inline">Download</span>
            </button>

            {/* Direct Open in new tab */}
            <a
              href={streamUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-xl text-gray-300 hover:text-white bg-white/5 hover:bg-white/15 transition-colors"
              title="In neuem Tab öffnen"
            >
              <Maximize2 className="w-4 h-4" />
            </a>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-300 hover:text-white bg-white/10 hover:bg-red-500/80 hover:text-white transition-colors"
              title="Schließen (Esc)"
              aria-label="Schließen"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center Viewer Area */}
        <div
          className="relative flex-1 w-full flex items-center justify-center my-3 overflow-hidden rounded-2xl bg-black/40 border border-white/5"
          onTouchStart={isCurrentAnImage ? handleTouchStart : undefined}
          onTouchMove={isCurrentAnImage ? handleTouchMove : undefined}
          onTouchEnd={isCurrentAnImage ? handleTouchEnd : undefined}
        >
          {/* IMAGE LIGHTBOX */}
          {isCurrentAnImage && (
            <div className="relative w-full h-full flex items-center justify-center p-2">
              <img
                src={streamUrl}
                alt={currentItem.name}
                className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl transition-all select-none pointer-events-auto"
                draggable={false}
              />

              {/* Prev Button */}
              {imageList.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePrevImage();
                  }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/60 hover:bg-black/90 text-white/80 hover:text-white transition-all backdrop-blur-sm border border-white/10 active:scale-95 shadow-lg"
                  aria-label="Vorheriges Bild"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              )}

              {/* Next Button */}
              {imageList.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNextImage();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/60 hover:bg-black/90 text-white/80 hover:text-white transition-all backdrop-blur-sm border border-white/10 active:scale-95 shadow-lg"
                  aria-label="Nächstes Bild"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              )}
            </div>
          )}

          {/* VIDEO PLAYER MODAL */}
          {isCurrentAVideo && (
            <div className="w-full h-full max-h-[75vh] flex items-center justify-center p-2">
              <video
                key={streamUrl}
                src={streamUrl}
                controls
                autoPlay
                playsInline
                preload="metadata"
                className="max-w-full max-h-[75vh] rounded-xl shadow-2xl bg-black outline-none"
              >
                Dein Browser unterstützt diesen Videoplayer nicht.
              </video>
            </div>
          )}

          {/* PDF VIEWER MODAL */}
          {isCurrentAPdf && (
            <div className="w-full h-full max-h-[78vh] flex flex-col bg-gray-900 rounded-xl overflow-hidden shadow-2xl border border-gray-800">
              <iframe
                key={streamUrl}
                src={`${streamUrl}#toolbar=1&navpanes=0`}
                title={currentItem.name}
                className="w-full h-full border-none rounded-xl bg-white"
              />
            </div>
          )}

          {/* Fallback for other file types */}
          {!isCurrentAnImage && !isCurrentAVideo && !isCurrentAPdf && (
            <div className="flex flex-col items-center justify-center p-8 text-center text-white">
              <FileText className="w-16 h-16 text-gray-400 mb-4" />
              <h3 className="text-lg font-bold">{currentItem.name}</h3>
              <p className="text-sm text-gray-400 mt-1 max-w-md">
                Für dieses Dateiformat steht keine direkte In-Browser-Vorschau zur Verfügung.
              </p>
              <button
                onClick={() => onDownload(currentItem)}
                className="mt-5 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors shadow-lg"
              >
                <Download className="w-4 h-4" />
                <span>Datei herunterladen</span>
              </button>
            </div>
          )}
        </div>

        {/* Bottom Hint Bar */}
        <div className="w-full flex items-center justify-between px-4 py-2 text-[11px] text-gray-400 bg-gray-900/60 backdrop-blur-md rounded-xl border border-white/5">
          <span>{currentItem.path || currentItem.name}</span>
          <div className="flex items-center gap-3">
            {isCurrentAnImage && imageList.length > 1 && (
              <span className="hidden sm:inline">Tipp: Pfeiltasten oder Wischen zum Wechseln</span>
            )}
            <span>Esc zum Schließen</span>
          </div>
        </div>
      </div>
    </div>
  );
};
