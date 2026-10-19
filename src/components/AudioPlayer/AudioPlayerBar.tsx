import React, { useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  RotateCw,
  Repeat,
  Repeat1,
  Shuffle,
  Minimize2,
  Maximize2,
  X,
  Loader2,
  Music,
  ChevronDown,
} from 'lucide-react';
import { useAudioPlayer } from '../../context/AudioPlayerContext';
import { parseAudioTitle } from '../../utils/audioPlayerUtils';
import { AudioScrubber } from './AudioScrubber';
import { AudioVolumeControl } from './AudioVolumeControl';
import { AudioCoverArt } from './AudioCoverArt';

export const AudioPlayerBar: React.FC = () => {
  const {
    currentTrack,
    playlist,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    bufferedPercent,
    volume,
    isMuted,
    isPlayerVisible,
    isMinimized,
    isMobile,
    isShuffle,
    repeatMode,
    playbackRate,
    currentUser,
    keyboardFeedback,
    togglePlay,
    seek,
    jumpSeconds,
    nextTrack,
    prevTrack,
    setVolume,
    toggleMute,
    cycleRepeatMode,
    toggleShuffle,
    setPlaybackRate,
    setIsMinimized,
    openMobileModal,
    pauseAutoMinimizeTimer,
    resumeAutoMinimizeTimer,
    resetAutoMinimizeTimer,
    closePlayer,
  } = useAudioPlayer();

  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  if (!isPlayerVisible || !currentTrack) {
    return null;
  }

  const { cleanTitle, ext, trackNumber, artistHint } = parseAudioTitle(currentTrack.name);
  const trackPath = currentTrack.path || currentTrack.name;
  const trackOwner = currentTrack.owner || currentUser;
  const speedOptions = [0.75, 1, 1.25, 1.5, 2];

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  // --------------------------------------------------------------------------
  // 1. MINIMIZED FLOATING MUSIC NOTE WIDGET (Unten Rechts im Bild)
  // --------------------------------------------------------------------------
  if (isMinimized) {
    return (
      <div className="audio-player-bar fixed bottom-5 right-5 z-40 select-none animate-in fade-in zoom-in-95 duration-200">
        {keyboardFeedback && (
          <div className="absolute -top-9 right-0 px-2.5 py-0.5 rounded-full bg-gray-900/90 dark:bg-black/90 text-white text-[11px] font-semibold shadow-lg backdrop-blur-md border border-white/10 pointer-events-none whitespace-nowrap">
            {keyboardFeedback}
          </div>
        )}

        <div
          onClick={() => setIsMinimized(false)}
          className="group relative flex items-center gap-2 p-2.5 sm:p-3 rounded-full bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/90 dark:border-gray-800 shadow-2xl hover:shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer ring-2 ring-blue-500/20"
          title={`"${cleanTitle}" wird abgespielt (Klicken zum Vergrößern)`}
        >
          {/* Circular Progress Ring around Music Icon */}
          <div className="relative w-10 h-10 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 36 36">
              <path
                className="text-gray-200 dark:text-gray-800"
                strokeWidth="2.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-blue-600 dark:text-blue-500 transition-all duration-200"
                strokeDasharray={`${progressPercent}, 100`}
                strokeWidth="2.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>

            {/* Pulsing Music Note Icon */}
            <div className="absolute inset-0 flex items-center justify-center text-blue-600 dark:text-blue-400">
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              ) : isPlaying ? (
                <div className="flex items-end gap-0.5 h-3">
                  <span className="w-0.5 bg-blue-600 dark:bg-blue-400 h-3 animate-pulse" />
                  <span className="w-0.5 bg-blue-600 dark:bg-blue-400 h-2 animate-bounce" />
                  <span className="w-0.5 bg-blue-600 dark:bg-blue-400 h-3 animate-pulse" />
                </div>
              ) : (
                <Music className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              )}
            </div>
          </div>

          {/* Collapsed Details on hover */}
          <div className="hidden group-hover:flex items-center gap-2 pr-2 animate-in fade-in duration-150">
            <div className="max-w-[130px] min-w-0">
              <p className="text-xs font-bold text-gray-800 dark:text-gray-100 truncate">
                {cleanTitle}
              </p>
              <p className="text-[10px] text-gray-400 truncate">Klicken zum Öffnen</p>
            </div>

            {/* Quick Play/Pause without expanding */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              className="p-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-xs cursor-pointer"
              title={isPlaying ? 'Pause' : 'Abspielen'}
            >
              {isPlaying ? <Pause className="w-3 h-3 fill-white" /> : <Play className="w-3 h-3 fill-white ml-0.5" />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // 2. EXPANDED FLOATING PLAYER BAR (Unten am Bildschirmrand)
  // --------------------------------------------------------------------------
  return (
    <div
      onMouseEnter={pauseAutoMinimizeTimer}
      onMouseLeave={resumeAutoMinimizeTimer}
      onClick={resetAutoMinimizeTimer}
      className="audio-player-bar fixed bottom-3 left-3 right-3 sm:left-6 sm:right-6 md:left-auto md:right-8 md:w-[720px] lg:w-[820px] xl:w-[900px] z-40 max-w-full animate-in slide-in-from-bottom-5 duration-200"
    >
      {/* Keyboard Shortcut HUD Toast */}
      {keyboardFeedback && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gray-900/90 dark:bg-black/90 text-white text-xs font-semibold shadow-lg backdrop-blur-md border border-white/10 animate-in fade-in zoom-in-95 duration-100 flex items-center gap-1.5 select-none pointer-events-none">
          <span>{keyboardFeedback}</span>
        </div>
      )}

      {/* Main Floating Bar Shell */}
      <div className="relative bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/90 dark:border-gray-800 shadow-2xl rounded-2xl p-2.5 sm:p-3 flex flex-col gap-1.5 select-none transition-colors">
        {/* DESKTOP / TABLET LAYOUT */}
        <div className="hidden sm:flex items-center justify-between gap-4">
          {/* Left: Album Cover & Track Title */}
          <div className="flex items-center gap-3 min-w-0 flex-1 max-w-[260px]">
            <div className="relative shrink-0">
              <AudioCoverArt
                filePath={trackPath}
                currentUser={trackOwner}
                title={cleanTitle}
                className="w-12 h-12 rounded-xl shadow-xs"
                iconClassName="w-6 h-6"
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                {trackNumber && (
                  <span className="text-[10px] font-mono text-gray-400 shrink-0">
                    #{trackNumber}
                  </span>
                )}
                <h4
                  className="text-xs sm:text-sm font-bold text-gray-900 dark:text-gray-100 truncate"
                  title={currentTrack.name}
                >
                  {cleanTitle}
                </h4>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                <span className="truncate">{artistHint || (currentTrack.owner ? `@${currentTrack.owner}` : 'J.Jonas Audio')}</span>
                {ext && (
                  <>
                    <span>·</span>
                    <span className="font-mono text-[9px] uppercase font-bold text-blue-600 dark:text-blue-400">
                      {ext}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Center: Controls & Scrubber */}
          <div className="flex-1 max-w-md flex flex-col items-center">
            {/* Control Buttons */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Spotify-style Smart Shuffle */}
              <button
                type="button"
                onClick={toggleShuffle}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer relative ${
                  isShuffle
                    ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50'
                    : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
                title={isShuffle ? 'Spotify-Shuffle: Aktiv (keine Wiederholungen)' : 'Zufallswiedergabe aktivieren'}
              >
                <Shuffle className="w-3.5 h-3.5" />
                {isShuffle && (
                  <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-600 dark:bg-blue-400" />
                )}
              </button>

              {/* Previous Track */}
              <button
                type="button"
                onClick={prevTrack}
                disabled={playlist.length <= 1}
                className="p-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-40 cursor-pointer"
                title="Vorheriger Titel"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              {/* Jump -5s */}
              <button
                type="button"
                onClick={() => jumpSeconds(-5)}
                className="p-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer relative"
                title="5 Sekunden zurück (Pfeil links)"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold mt-0.5">5</span>
              </button>

              {/* Play / Pause Primary Button */}
              <button
                type="button"
                onClick={togglePlay}
                className="p-2.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-md active:scale-95 transition-transform cursor-pointer flex items-center justify-center mx-1"
                title={isPlaying ? 'Pause (Leertaste)' : 'Abspielen (Leertaste)'}
                aria-label={isPlaying ? 'Pause' : 'Abspielen'}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : isPlaying ? (
                  <Pause className="w-4 h-4 fill-white text-white" />
                ) : (
                  <Play className="w-4 h-4 fill-white text-white ml-0.5" />
                )}
              </button>

              {/* Jump +5s */}
              <button
                type="button"
                onClick={() => jumpSeconds(5)}
                className="p-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer relative"
                title="5 Sekunden vor (Pfeil rechts)"
              >
                <RotateCw className="w-4 h-4" />
                <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold mt-0.5">5</span>
              </button>

              {/* Next Track */}
              <button
                type="button"
                onClick={nextTrack}
                disabled={playlist.length <= 1}
                className="p-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-40 cursor-pointer"
                title="Nächster Titel"
              >
                <SkipForward className="w-4 h-4" />
              </button>

              {/* Repeat Mode */}
              <button
                type="button"
                onClick={cycleRepeatMode}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer relative ${
                  repeatMode !== 'off'
                    ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50'
                    : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
                title={
                  repeatMode === 'one'
                    ? 'Wiederholung: Aktueller Titel'
                    : repeatMode === 'all'
                    ? 'Wiederholung: Alle Titel'
                    : 'Wiederholung: Aus'
                }
              >
                {repeatMode === 'one' ? (
                  <Repeat1 className="w-3.5 h-3.5" />
                ) : (
                  <Repeat className="w-3.5 h-3.5" />
                )}
                {repeatMode !== 'off' && (
                  <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-600 dark:bg-blue-400" />
                )}
              </button>
            </div>

            {/* Scrubber Timeline */}
            <div className="w-full mt-0.5">
              <AudioScrubber
                currentTime={currentTime}
                duration={duration}
                bufferedPercent={bufferedPercent}
                onSeek={seek}
                compact={true}
              />
            </div>
          </div>

          {/* Right: Volume & Minimize Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Speed Selector Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                className="px-2 py-1 rounded-lg text-xs font-mono font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                title="Wiedergabegeschwindigkeit"
              >
                {playbackRate}x
              </button>
              {showSpeedMenu && (
                <div className="absolute bottom-full mb-1 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl py-1 text-xs z-50 min-w-[70px]">
                  {speedOptions.map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => {
                        setPlaybackRate(rate);
                        setShowSpeedMenu(false);
                      }}
                      className={`w-full px-3 py-1 text-left font-mono transition-colors ${
                        playbackRate === rate
                          ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Volume Control */}
            <AudioVolumeControl
              volume={volume}
              isMuted={isMuted}
              onVolumeChange={setVolume}
              onToggleMute={toggleMute}
              compact={true}
            />

            {/* MINIMIZE OR EXPAND BUTTON: On mobile opens the big full menu; On desktop minimizes to music note */}
            {isMobile ? (
              <button
                type="button"
                onClick={openMobileModal}
                className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                title="Großes Menü / Vollbildplayer öffnen"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsMinimized(true)}
                className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                title="Player verkleinern (zur Musiknote minimieren)"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            )}

            {/* Close / Stop Player */}
            <button
              type="button"
              onClick={closePlayer}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
              title="Player beenden"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* MOBILE COMPACT VIEW (< 640px) */}
        <div className="sm:hidden flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <div
              onClick={openMobileModal}
              className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer hover:opacity-90 active:scale-[0.98] transition-all"
              title="Tippen für großes Player-Menü"
            >
              <AudioCoverArt
                filePath={trackPath}
                currentUser={trackOwner}
                title={cleanTitle}
                className="w-10 h-10 rounded-lg shadow-xs"
                iconClassName="w-5 h-5"
              />
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">
                  {cleanTitle}
                </h4>
                <p className="text-[10px] text-gray-400 truncate">
                  {artistHint || (currentTrack.owner ? `@${currentTrack.owner}` : 'J.Jonas Audio')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {/* Jump -5s */}
              <button
                type="button"
                onClick={() => jumpSeconds(-5)}
                className="p-1.5 rounded-lg text-gray-600 dark:text-gray-300"
                title="5s zurück"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              {/* Play / Pause */}
              <button
                type="button"
                onClick={togglePlay}
                className="p-2 rounded-full bg-blue-600 text-white shadow-md active:scale-95"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-4 h-4 fill-white" />
                ) : (
                  <Play className="w-4 h-4 fill-white ml-0.5" />
                )}
              </button>

              {/* Jump +5s */}
              <button
                type="button"
                onClick={() => jumpSeconds(5)}
                className="p-1.5 rounded-lg text-gray-600 dark:text-gray-300"
                title="5s vor"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              {/* Großes Menü öffnen auf dem Handy */}
              <button
                type="button"
                onClick={openMobileModal}
                className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer"
                title="Großes Menü öffnen"
              >
                <Maximize2 className="w-4 h-4" />
              </button>

              {/* Close */}
              <button
                type="button"
                onClick={closePlayer}
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Scrubber bar on mobile */}
          <AudioScrubber
            currentTime={currentTime}
            duration={duration}
            bufferedPercent={bufferedPercent}
            onSeek={seek}
            compact={true}
          />
        </div>
      </div>
    </div>
  );
};
