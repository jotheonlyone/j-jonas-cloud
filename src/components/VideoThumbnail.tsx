import React, { useState } from 'react';
import { Film } from 'lucide-react';
import type { FileItemData } from '../types';
import { getThumbnailUrl } from '../services/storageApi';

export interface VideoThumbnailProps {
  video: FileItemData;
  alt?: string;
  className?: string;
  placeholderClassName?: string;
  iconClassName?: string;
  loading?: 'lazy' | 'eager';
}

/**
 * Universelle Video-Vorschaubild-Komponente:
 * - Ruft serverseitig generierte Thumbnails (FFmpeg / WebP) direkt per <img> ab
 * - Verwendet loading="lazy" für performantes Laden
 * - Zeigt ein neutrales Video-Icon/Placeholder bei 404 (onError) oder während des Ladevorgangs
 * - Enthält kein clientseitiges <video>- oder <canvas>-Rendering
 */
export const VideoThumbnail: React.FC<VideoThumbnailProps> = ({
  video,
  alt,
  className = 'w-full h-full object-cover',
  placeholderClassName = 'w-full h-full flex items-center justify-center bg-neutral-950',
  iconClassName = 'w-10 h-10 text-white/30',
  loading = 'lazy',
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const thumbUrl = getThumbnailUrl(video);
  const cleanTitle = alt || video.name;

  if (hasError || !thumbUrl) {
    return (
      <div className={placeholderClassName} aria-label={cleanTitle} role="img">
        <Film className={iconClassName} />
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Neutraler Platzhalter / Video-Icon während das Bild lädt */}
      {!isLoaded && (
        <div className={`absolute inset-0 ${placeholderClassName}`} aria-hidden="true">
          <Film className={iconClassName} />
        </div>
      )}

      {/* Direktes Bild-Tag über Server-URL mit Lazy Loading und Fehlerbehandlung */}
      <img
        src={thumbUrl}
        alt={cleanTitle}
        loading={loading}
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200`}
      />
    </div>
  );
};
