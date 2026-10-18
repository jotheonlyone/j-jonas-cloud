import React, { useRef, useState } from 'react';
import { Volume2, Volume1, VolumeX } from 'lucide-react';

interface AudioVolumeControlProps {
  volume: number;
  isMuted: boolean;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
  compact?: boolean;
}

export const AudioVolumeControl: React.FC<AudioVolumeControlProps> = ({
  volume,
  isMuted,
  onVolumeChange,
  onToggleMute,
  compact = false,
}) => {
  const barRef = useRef<HTMLDivElement | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const effectiveVol = isMuted ? 0 : volume;
  const volPercent = Math.round(effectiveVol * 100);

  const handleSliderClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clampedX = Math.max(0, Math.min(clickX, rect.width));
    const newVol = clampedX / rect.width;
    onVolumeChange(newVol);
    if (isMuted) onToggleMute();
  };

  const handleSliderDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!barRef.current) return;

    const updateVol = (event: MouseEvent) => {
      if (!barRef.current) return;
      const rect = barRef.current.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const clampedX = Math.max(0, Math.min(clickX, rect.width));
      onVolumeChange(clampedX / rect.width);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', updateVol);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', updateVol);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const getIcon = () => {
    if (isMuted || effectiveVol === 0) {
      return <VolumeX className="w-4 h-4 text-red-500" />;
    }
    if (effectiveVol < 0.5) {
      return <Volume1 className="w-4 h-4 text-gray-600 dark:text-gray-300" />;
    }
    return <Volume2 className="w-4 h-4 text-gray-600 dark:text-gray-300" />;
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="flex items-center gap-1.5 select-none"
    >
      {/* Mute Toggle Button */}
      <button
        type="button"
        onClick={onToggleMute}
        className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
        title={isMuted ? 'Stummschaltung aufheben (M)' : 'Stummschalten (M)'}
        aria-label={isMuted ? 'Stummschaltung aufheben' : 'Stummschalten'}
      >
        {getIcon()}
      </button>

      {/* Volume Slider Bar */}
      <div
        ref={barRef}
        onClick={handleSliderClick}
        onMouseDown={handleSliderDrag}
        className={`relative py-2 flex items-center cursor-pointer group ${
          compact ? 'w-16' : 'w-20 sm:w-24'
        }`}
        title={`Lautstärke: ${volPercent}%`}
      >
        <div className="w-full h-1.5 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden relative">
          <div
            style={{ width: `${volPercent}%` }}
            className={`h-full rounded-full transition-all duration-75 ${
              isMuted
                ? 'bg-gray-400 dark:bg-gray-600'
                : 'bg-blue-600 dark:bg-blue-500 group-hover:bg-blue-700'
            }`}
          />
        </div>

        {/* Thumb handle */}
        <div
          style={{ left: `${volPercent}%` }}
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white dark:bg-slate-200 shadow-sm border border-gray-300 dark:border-gray-600 transition-transform ${
            isHovered ? 'scale-100 opacity-100' : 'scale-75 opacity-70'
          }`}
        />
      </div>
    </div>
  );
};
