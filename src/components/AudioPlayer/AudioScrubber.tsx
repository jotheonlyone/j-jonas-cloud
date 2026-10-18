import React, { useState, useRef, useCallback } from 'react';
import { formatAudioTime } from '../../utils/audioPlayerUtils';

interface AudioScrubberProps {
  currentTime: number;
  duration: number;
  bufferedPercent: number;
  onSeek: (seconds: number) => void;
  className?: string;
  showTimes?: boolean;
  compact?: boolean;
}

export const AudioScrubber: React.FC<AudioScrubberProps> = ({
  currentTime,
  duration,
  bufferedPercent,
  onSeek,
  className = '',
  showTimes = true,
  compact = false,
}) => {
  const barRef = useRef<HTMLDivElement | null>(null);
  const [isHovering, setIsHovering] = useState<boolean>(false);
  const [hoverTime, setHoverTime] = useState<number>(0);
  const [hoverPositionPercent, setHoverPositionPercent] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragTime, setDragTime] = useState<number | null>(null);

  const effectiveTime = dragTime !== null ? dragTime : currentTime;
  const progressPercent =
    duration > 0 ? Math.min(100, Math.max(0, (effectiveTime / duration) * 100)) : 0;

  const calculateTimeFromEvent = useCallback(
    (e: React.MouseEvent | MouseEvent | React.TouchEvent | TouchEvent): number => {
      if (!barRef.current || duration <= 0) return 0;
      const rect = barRef.current.getBoundingClientRect();
      const clientX =
        'touches' in e && e.touches.length > 0
          ? e.touches[0].clientX
          : 'clientX' in e
          ? (e as MouseEvent).clientX
          : 0;

      const clickX = clientX - rect.left;
      const clampedX = Math.max(0, Math.min(clickX, rect.width));
      const percentage = clampedX / rect.width;
      return percentage * duration;
    },
    [duration]
  );

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!barRef.current || duration <= 0) return;
    const rect = barRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clampedX = Math.max(0, Math.min(clickX, rect.width));
    const percent = (clampedX / rect.width) * 100;
    const time = (clampedX / rect.width) * duration;

    setHoverPositionPercent(percent);
    setHoverTime(time);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const targetTime = calculateTimeFromEvent(e);
    setIsDragging(true);
    setDragTime(targetTime);

    const handleWindowMouseMove = (moveEvent: MouseEvent) => {
      const newTime = calculateTimeFromEvent(moveEvent);
      setDragTime(newTime);
    };

    const handleWindowMouseUp = (upEvent: MouseEvent) => {
      const finalTime = calculateTimeFromEvent(upEvent);
      setIsDragging(false);
      setDragTime(null);
      onSeek(finalTime);

      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const targetTime = calculateTimeFromEvent(e);
    setIsDragging(true);
    setDragTime(targetTime);

    const handleWindowTouchMove = (moveEvent: TouchEvent) => {
      const newTime = calculateTimeFromEvent(moveEvent);
      setDragTime(newTime);
    };

    const handleWindowTouchEnd = (endEvent: TouchEvent) => {
      const finalTime = calculateTimeFromEvent(endEvent);
      setIsDragging(false);
      setDragTime(null);
      onSeek(finalTime);

      window.removeEventListener('touchmove', handleWindowTouchMove);
      window.removeEventListener('touchend', handleWindowTouchEnd);
    };

    window.addEventListener('touchmove', handleWindowTouchMove);
    window.addEventListener('touchend', handleWindowTouchEnd);
  };

  return (
    <div className={`flex items-center gap-2.5 w-full select-none ${className}`}>
      {/* Current Time Display */}
      {showTimes && (
        <span
          className={`font-mono text-gray-500 dark:text-gray-400 tabular-nums shrink-0 text-right ${
            compact ? 'text-[11px] w-9' : 'text-xs w-11'
          }`}
        >
          {formatAudioTime(effectiveTime)}
        </span>
      )}

      {/* Interactive Bar Container */}
      <div
        ref={barRef}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        className="relative flex-1 py-2 cursor-pointer group flex items-center touch-none"
      >
        {/* Background Track */}
        <div className="relative w-full h-1.5 sm:h-2 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden transition-all group-hover:h-2 sm:group-hover:h-2.5">
          {/* Buffered Progress Bar */}
          <div
            style={{ width: `${bufferedPercent}%` }}
            className="absolute left-0 top-0 bottom-0 bg-gray-300/80 dark:bg-gray-700/80 rounded-full transition-all duration-300"
          />

          {/* Played Progress Bar */}
          <div
            style={{ width: `${progressPercent}%` }}
            className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-400 rounded-full"
          />
        </div>

        {/* Scrubber Thumb */}
        <div
          style={{ left: `${progressPercent}%` }}
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-white dark:bg-slate-100 border-2 border-blue-600 dark:border-indigo-500 shadow-md transition-transform duration-75 ${
            isHovering || isDragging ? 'scale-100 opacity-100' : 'scale-0 sm:scale-75 opacity-0 sm:opacity-90'
          }`}
        />

        {/* Hover Time Tooltip */}
        {isHovering && duration > 0 && !isDragging && (
          <div
            style={{ left: `${hoverPositionPercent}%` }}
            className="absolute -top-7 -translate-x-1/2 px-1.5 py-0.5 rounded-md bg-gray-900/90 dark:bg-black/90 text-white text-[10px] font-mono tabular-nums pointer-events-none shadow-md border border-white/10 z-10 whitespace-nowrap"
          >
            {formatAudioTime(hoverTime)}
          </div>
        )}
      </div>

      {/* Total Duration Display */}
      {showTimes && (
        <span
          className={`font-mono text-gray-400 dark:text-gray-500 tabular-nums shrink-0 ${
            compact ? 'text-[11px] w-9' : 'text-xs w-11'
          }`}
        >
          {formatAudioTime(duration)}
        </span>
      )}
    </div>
  );
};
