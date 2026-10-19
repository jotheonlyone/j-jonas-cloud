import React, { useMemo, useState, useEffect } from 'react';
import { Volume2, VolumeX, Music, Play, Pause } from 'lucide-react';
import type { FileItemData } from '../types';

interface FrutigerAeroBackgroundProps {
  currentTrack: FileItemData | null;
  isPlaying: boolean;
  isMuted: boolean;
  progressPercent?: number;
  onToggleMute: () => void;
  onTogglePlay?: () => void;
  isMainPlayerVisible?: boolean;
}

interface BubbleConfig {
  id: number;
  size: number;
  left: number;
  delay: number;
  duration: number;
  drift: number;
  opacity: number;
}

export const FrutigerAeroBackground: React.FC<FrutigerAeroBackgroundProps> = ({
  currentTrack,
  isPlaying,
  isMuted,
  progressPercent = 0,
  onToggleMute,
  onTogglePlay,
  isMainPlayerVisible = false,
}) => {
  // Pre-generate stable bubbles
  const bubbles: BubbleConfig[] = useMemo(() => {
    const list: BubbleConfig[] = [];
    const count = 18;
    for (let i = 0; i < count; i++) {
      list.push({
        id: i,
        size: Math.floor(24 + (i % 5) * 16 + (i * 7) % 20), // 24px to 80px
        left: ((i * 17) % 94) + 3, // distribute 3% to 97%
        delay: (i * 1.8) % 14,
        duration: 12 + ((i * 3) % 10), // 12s - 22s float time
        drift: ((i % 3) - 1) * 35, // -35px to +35px sway
        opacity: 0.35 + (i % 4) * 0.15,
      });
    }
    return list;
  }, []);

  // Windows 7 Aero Balloon Notification on song start
  const [showStartToast, setShowStartToast] = useState(false);

  useEffect(() => {
    if (currentTrack && isPlaying) {
      setShowStartToast(true);
      const timer = setTimeout(() => {
        setShowStartToast(false);
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [currentTrack?.name, isPlaying]);

  const cleanTrackName = currentTrack
    ? currentTrack.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
    : '';

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none frutiger-aero-backdrop">
      {/* 1. Base vibrant sky and aquatic atmosphere gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#1b6cb8] via-[#48b2eb] to-[#8ee4af] opacity-90 transition-opacity duration-1000" />

      {/* 2. Soft rolling hill / aquatic horizon glow at the bottom */}
      <div
        className="absolute -bottom-24 -left-1/4 -right-1/4 h-[55vh] rounded-[100%] bg-gradient-to-t from-[#2ea458]/70 via-[#44c489]/50 to-transparent blur-2xl"
        style={{ transform: 'rotate(-1deg)' }}
      />
      <div
        className="absolute -bottom-36 -left-1/3 -right-1/3 h-[45vh] rounded-[100%] bg-gradient-to-t from-[#1b8fa8]/60 via-[#42d1ec]/40 to-transparent blur-3xl"
        style={{ transform: 'rotate(2deg)' }}
      />

      {/* 3. Aero Sunburst / Aurora light rays */}
      <div
        className="absolute -top-32 -left-32 w-[900px] h-[900px] rounded-full pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgba(255, 255, 255, 0.45) 0%, rgba(162, 230, 255, 0.3) 30%, rgba(94, 203, 255, 0.1) 60%, transparent 75%)',
          filter: 'blur(30px)',
        }}
      />
      <div
        className="absolute top-0 right-1/4 w-[600px] h-[400px] pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at top, rgba(255, 255, 255, 0.35) 0%, rgba(135, 240, 210, 0.18) 40%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />

      {/* 4. Organic animated Frutiger Aero water bubbles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {bubbles.map((b) => (
          <div
            key={b.id}
            className="absolute rounded-full aero-glass-bubble pointer-events-none"
            style={{
              width: `${b.size}px`,
              height: `${b.size}px`,
              left: `${b.left}%`,
              bottom: '-100px',
              opacity: b.opacity,
              animation: `aeroBubbleFloat ${b.duration}s infinite linear`,
              animationDelay: `${b.delay}s`,
              transform: `translateX(${b.drift}px)`,
            }}
          >
            {/* Primary specular highlight crescent */}
            <div className="absolute top-[12%] left-[15%] w-[35%] h-[30%] rounded-full bg-white/80 blur-[0.6px] -rotate-45" />
            {/* Secondary bottom rim caustic reflection */}
            <div className="absolute bottom-[10%] right-[15%] w-[45%] h-[20%] rounded-full bg-white/40 blur-[1px] rotate-12" />
          </div>
        ))}
      </div>

      {/* 5. Frutiger Aero Corner Music Widget (Unten rechts im Bildschirm) */}
      {currentTrack && !isMainPlayerVisible && (
        <div className="fixed bottom-5 right-5 z-40 pointer-events-auto select-none animate-in fade-in zoom-in-95 duration-300">
          {/* Windows 7 Aero Style Start Balloon Notification */}
          {showStartToast && (
            <div className="absolute -top-12 right-0 px-3 py-1.5 rounded-full bg-white/90 dark:bg-slate-900/90 text-sky-950 dark:text-sky-100 text-xs font-bold shadow-xl backdrop-blur-xl border border-white/80 dark:border-sky-400/40 pointer-events-none whitespace-nowrap animate-in slide-in-from-bottom-2 fade-in duration-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping" />
              <span>🎵 {cleanTrackName} gestartet</span>
            </div>
          )}

          {/* Floating Aero Glass Orb / Pill Widget */}
          <div
            className="group relative flex items-center gap-2.5 p-2 sm:p-2.5 rounded-full bg-white/85 dark:bg-slate-900/85 backdrop-blur-2xl border border-white/90 dark:border-sky-400/30 shadow-2xl hover:shadow-sky-400/30 hover:scale-105 active:scale-95 transition-all cursor-pointer ring-2 ring-sky-400/30"
            title={`"${cleanTrackName}" (Aquatic Ambience · Frutiger Aero)`}
          >
            {/* Circular Progress & Glass Ring around Music Icon */}
            <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
              <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 36 36">
                <path
                  className="text-sky-200/50 dark:text-slate-800"
                  strokeWidth="2.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-sky-500 transition-all duration-300"
                  strokeDasharray={`${progressPercent}, 100`}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                {isPlaying && !isMuted ? (
                  <div className="flex items-end gap-0.5 h-3">
                    <span className="w-0.5 bg-sky-500 h-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-0.5 bg-sky-500 h-2/3 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-0.5 bg-sky-500 h-4/5 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                ) : (
                  <Music className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                )}
              </div>
            </div>

            {/* Expanded details on hover / view */}
            <div className="hidden group-hover:flex items-center gap-2 pr-2 animate-in fade-in duration-150">
              <div className="max-w-[150px] min-w-0">
                <p className="text-xs font-bold text-sky-950 dark:text-sky-100 truncate capitalize">
                  {cleanTrackName}
                </p>
                <p className="text-[10px] text-sky-700/80 dark:text-sky-300/80 truncate">
                  Aquatic Ambience
                </p>
              </div>

              {/* Play / Pause Toggle Button */}
              {onTogglePlay && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTogglePlay();
                  }}
                  className="p-1.5 rounded-full text-white shadow-xs cursor-pointer aero-gloss-btn flex items-center justify-center"
                  title={isPlaying ? 'Pause' : 'Abspielen'}
                >
                  {isPlaying ? (
                    <Pause className="w-3 h-3 fill-white" />
                  ) : (
                    <Play className="w-3 h-3 fill-white ml-0.5" />
                  )}
                </button>
              )}

              {/* Mute Toggle Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleMute();
                }}
                className="p-1.5 rounded-full hover:bg-sky-100/50 dark:hover:bg-slate-800 transition-colors cursor-pointer text-sky-800 dark:text-sky-200"
                title={isMuted ? 'Stummschaltung aufheben' : 'Stummschalten'}
              >
                {isMuted ? (
                  <VolumeX className="w-3.5 h-3.5 text-red-500" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
