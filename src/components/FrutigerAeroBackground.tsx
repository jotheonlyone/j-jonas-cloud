import React, { useMemo } from 'react';
import { Volume2, VolumeX, Waves } from 'lucide-react';
import type { FileItemData } from '../types';

interface FrutigerAeroBackgroundProps {
  currentTrack: FileItemData | null;
  isPlaying: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
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
  onToggleMute,
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

      {/* 5. Minimalist Aero Ambience Audio Status Badge (only when a track exists) */}
      {currentTrack && (
        <div className="fixed bottom-4 left-4 z-40 pointer-events-auto transition-all duration-300">
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-white/70 dark:border-white/20 shadow-lg shadow-sky-900/10 text-xs text-sky-950 dark:text-sky-100 group">
            <Waves className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0 animate-pulse" />
            <div className="flex items-center gap-1.5 min-w-0 max-w-[200px] sm:max-w-[260px]">
              <span className="font-semibold truncate">
                {currentTrack.name.replace(/\.[^/.]+$/, '')}
              </span>
              {isPlaying && !isMuted && (
                <span className="flex gap-0.5 items-end h-2.5 shrink-0">
                  <span className="w-0.5 h-full bg-sky-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-0.5 h-2/3 bg-sky-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-0.5 h-4/5 bg-sky-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onToggleMute}
              className="p-1 rounded-full hover:bg-white/50 dark:hover:bg-white/20 transition-colors cursor-pointer text-sky-700 dark:text-sky-200"
              title={isMuted ? 'Ambience stummschaltung aufheben' : 'Ambience stummschalten'}
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-500" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
