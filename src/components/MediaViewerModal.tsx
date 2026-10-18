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
import { isAudioFile } from '../utils/audioPlayerUtils';
import { StandaloneAudioPlayer } from './AudioPlayer';

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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const viewerContainerRef = useRef<HTMLDivElement | null>(null);

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
  const isCurrentAnAudio = currentItem ? isAudioFile(currentItem) : false;

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
      handleNextImage();
    } else if (diff < -minSwipeDistance) {
      handlePrevImage();
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  // Direct In-Tab Fullscreen Toggle (Opens directly in current tab without external redirection)
  const handleToggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      return;
    }

    const targetElement = (isCurrentAVideo && videoRef.current)
      ? videoRef.current
      : viewerContainerRef.current;

    if (!targetElement) return;

    if (targetElement.requestFullscreen) {
      targetElement.requestFullscreen().catch(() => {});
    } else if ((targetElement as any).webkitRequestFullscreen) {
      (targetElement as any).webkitRequestFullscreen();
    } else if ((targetElement as any).mozRequestFullScreen) {
      (targetElement as any).mozRequestFullScreen();
    } else if ((targetElement as any).msRequestFullscreen) {
      (targetElement as any).msRequestFullscreen();
    }
  };

  if (!isOpen || !currentItem) return null;

  const streamUrl = getStreamUrl(currentItem.path || currentItem.name, currentItem.owner);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      {/* Container - Stop propagation inside */}
      <div
        ref={viewerContainerRef}
        className="relative w-full h-full max-w-6xl max-h-[92vh] flex flex-col items-center justify-between pointer-events-auto bg-transparent"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="w-full flex items-center justify-between px-4 py-3 bg-gray-900/90 backdrop-blur-md text-white rounded-2xl border border-white/10 shadow-lg z-20 shrink-0">
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
              className="p-2 rounded-xl text-gray-300 hover:text-white bg-white/5 hover:bg-white/15 transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
              title="Herunterladen"
            >
              <Download className="w-4 h-4 text-blue-400" />
              <span className="hidden sm:inline">Download</span>
            </button>

            {/* In-Tab Fullscreen Button (Direct Fullscreen in Current Tab) */}
            <button
              type="button"
              onClick={handleToggleFullscreen}
              className="p-2 rounded-xl text-gray-300 hover:text-white bg-white/5 hover:bg-white/15 transition-colors cursor-pointer"
              title="Vollbildmodus (im aktuellen Tab)"
              aria-label="Vollbildmodus"
            >
              <Maximize2 className="w-4 h-4 text-gray-300 hover:text-white" />
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-300 hover:text-white bg-white/10 hover:bg-red-500/80 hover:text-white transition-colors cursor-pointer"
              title="Schließen (Esc)"
              aria-label="Schließen"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center Viewer Area */}
        <div
          className="relative flex-1 w-full flex items-center justify-center my-2.5 overflow-hidden rounded-2xl bg-black/50 border border-white/5 min-h-0"
          onTouchStart={isCurrentAnImage ? handleTouchStart : undefined}
          onTouchMove={isCurrentAnImage ? handleTouchMove : undefined}
          onTouchEnd={isCurrentAnImage ? handleTouchEnd : undefined}
        >
          {/* IMAGE LIGHTBOX */}
          {isCurrentAnImage && (
            <div className="relative w-full h-full flex items-center justify-center p-2 select-none">
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
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/60 hover:bg-black/90 text-white/80 hover:text-white transition-all backdrop-blur-sm border border-white/10 active:scale-95 shadow-lg cursor-pointer"
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/60 hover:bg-black/90 text-white/80 hover:text-white transition-all backdrop-blur-sm border border-white/10 active:scale-95 shadow-lg cursor-pointer"
                  aria-label="Nächstes Bild"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              )}
            </div>
          )}

          {/* VIDEO PLAYER MODAL: Mit sichtbarer nativer Steuerungsleiste (Pause, Play, Scrubbing / Hin- und Herzappen) */}
          {isCurrentAVideo && (
            <div className="w-full h-full flex items-center justify-center p-2 sm:p-3 min-h-0 select-auto">
              <video
                ref={videoRef}
                key={streamUrl}
                src={streamUrl}
                controls
                autoPlay
                playsInline
                preload="auto"
                className="w-auto h-auto max-w-full max-h-[66vh] sm:max-h-[72vh] rounded-xl shadow-2xl bg-black outline-none border border-white/10 block pointer-events-auto"
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

          {/* AUDIO PLAYER */}
          {isCurrentAnAudio && (
            <div className="w-full flex items-center justify-center p-4">
              <StandaloneAudioPlayer
                filePath={currentItem.path || currentItem.name}
                fileName={currentItem.name}
                currentUser={currentItem.owner || 'user'}
                onDownload={() => onDownload(currentItem)}
              />
            </div>
          )}

          {/* Fallback for other file types */}
          {!isCurrentAnImage && !isCurrentAVideo && !isCurrentAPdf && !isCurrentAnAudio && (
            <div className="flex flex-col items-center justify-center p-8 text-center text-white select-none">
              <FileText className="w-16 h-16 text-gray-400 mb-4" />
              <h3 className="text-lg font-bold">{currentItem.name}</h3>
              <p className="text-sm text-gray-400 mt-1 max-w-md">
                Für dieses Dateiformat steht keine direkte In-Browser-Vorschau zur Verfügung.
              </p>
              <button
                onClick={() => onDownload(currentItem)}
                className="mt-5 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors shadow-lg cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Datei herunterladen</span>
              </button>
            </div>
          )}
        </div>

        {/* File Description from metadata if present (only when not video to preserve full video controls visibility) */}
        {currentItem.metadata?.description && !isCurrentAVideo && (
          <div className="w-full mb-2 px-4 py-2.5 rounded-xl bg-gray-900/90 backdrop-blur-md border border-white/10 text-xs text-gray-200 z-20 shrink-0 max-h-24 overflow-y-auto">
            <span className="text-[10px] uppercase font-bold text-blue-400 block mb-0.5">
              Beschreibung
            </span>
            <p className="leading-relaxed whitespace-pre-wrap">{currentItem.metadata.description}</p>
          </div>
        )}

        {/* Bottom Hint Bar */}
        <div className="w-full flex items-center justify-between px-4 py-2 text-[11px] text-gray-400 bg-gray-900/70 backdrop-blur-md rounded-xl border border-white/5 shrink-0 select-none">
          <span className="truncate max-w-xs sm:max-w-md">{currentItem.path || currentItem.name}</span>
          <div className="flex items-center gap-3 shrink-0">
            {isCurrentAnImage && imageList.length > 1 && (
              <span className="hidden sm:inline">Pfeiltasten zum Wechseln</span>
            )}
            <span>Esc zum Schließen</span>
          </div>
        </div>
      </div>
    </div>
  );
};
