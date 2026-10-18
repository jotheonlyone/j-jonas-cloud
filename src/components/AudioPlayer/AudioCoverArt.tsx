import React, { useState, useEffect } from 'react';
import { Music } from 'lucide-react';
import { getAudioCoverUrl } from '../../utils/audioPlayerUtils';

interface AudioCoverArtProps {
  filePath?: string;
  currentUser?: string;
  title?: string;
  className?: string;
  iconClassName?: string;
}

export const AudioCoverArt: React.FC<AudioCoverArtProps> = ({
  filePath = '',
  currentUser = '',
  title = '',
  className = 'w-12 h-12 rounded-xl',
  iconClassName = 'w-6 h-6',
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const coverUrl = filePath ? getAudioCoverUrl(filePath, currentUser) : '';

  // Reset error state when path or user changes
  useEffect(() => {
    setHasError(false);
    setIsLoading(true);
  }, [filePath, currentUser]);

  if (!coverUrl || hasError) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-blue-500/15 via-indigo-500/15 to-purple-500/15 dark:from-blue-500/20 dark:via-indigo-500/20 dark:to-purple-500/20 border border-indigo-200/50 dark:border-indigo-800/40 text-indigo-600 dark:text-indigo-400 shrink-0 select-none ${className}`}
        title={title || 'Audio Cover'}
      >
        <Music className={iconClassName} />
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200/60 dark:border-gray-700/60 shrink-0 select-none ${className}`}
    >
      {/* Loading Skeleton */}
      {isLoading && (
        <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse flex items-center justify-center">
          <Music className={`${iconClassName} opacity-30 text-gray-400`} />
        </div>
      )}

      {/* Image with fallback onError (HTTP 404 handler) */}
      <img
        src={coverUrl}
        alt={title || 'Album Cover'}
        loading="lazy"
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
          setHasError(true);
        }}
        className={`w-full h-full object-cover transition-opacity duration-200 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        }`}
      />
    </div>
  );
};
