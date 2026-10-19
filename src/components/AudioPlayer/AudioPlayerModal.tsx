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
  ChevronDown,
  X,
  ListMusic,
  Loader2,
  Volume2,
  Volume1,
  VolumeX,
} from 'lucide-react';
import { useAudioPlayer } from '../../context/AudioPlayerContext';
import { parseAudioTitle } from '../../utils/audioPlayerUtils';
import { AudioCoverArt } from './AudioCoverArt';
import { AudioScrubber } from './AudioScrubber';

export const AudioPlayerModal: React.FC = () => {
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
    isMobile,
    isMobileModalOpen,
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
    closeMobileModal,
    playTrack,
    closePlayer,
  } = useAudioPlayer();

  const [showQueue, setShowQueue] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  // Per user requirement: the big modal is ONLY for mobile devices
  if (!isMobile || !isMobileModalOpen || !currentTrack) {
    return null;
  }

  const { cleanTitle, ext, trackNumber, artistHint } = parseAudioTitle(currentTrack.name);
  const trackPath = currentTrack.path || currentTrack.name;
  const trackOwner = currentTrack.owner || currentUser;
  const speedOptions = [0.75, 1, 1.25, 1.5, 2];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-950/95 backdrop-blur-2xl text-white animate-in slide-in-from-bottom duration-300 select-none overflow-hidden overscroll-contain">
      {/* HUD Toast */}
      {keyboardFeedback && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-3.5 py-1.5 rounded-full bg-blue-600/95 text-white text-xs font-semibold shadow-xl border border-white/20 animate-in fade-in zoom-in-95 pointer-events-none">
          {keyboardFeedback}
        </div>
      )}

      {/* Top Mobile App Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
        <button
          type="button"
          onClick={closeMobileModal}
          className="p-2 -ml-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
          title="Schließen & Minimieren"
        >
          <ChevronDown className="w-6 h-6" />
        </button>

        <div className="text-center min-w-0 px-2 flex-1">
          <p className="text-[10px] uppercase font-bold tracking-widest text-blue-400">
            {playlist.length > 1 ? `Playlist (${playlist.length} Titel)` : 'Aktuelle Wiedergabe'}
          </p>
          <p className="text-xs font-medium text-white/80 truncate">
            {currentTrack.owner ? `Ablage von @${currentTrack.owner}` : 'J.Jonas Audio'}
          </p>
        </div>

        <div className="flex items-center gap-1 -mr-1">
          <button
            type="button"
            onClick={() => setShowQueue(!showQueue)}
            className={`p-2 rounded-full transition-all cursor-pointer ${
              showQueue
                ? 'bg-blue-600 text-white'
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
            title="Playlist anzeigen"
          >
            <ListMusic className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => {
              closeMobileModal();
              closePlayer();
            }}
            className="p-2 rounded-full text-white/60 hover:text-red-400 hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
            title="Player beenden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Container: Switch between Track View and Queue List */}
      <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col justify-between max-w-md mx-auto w-full">
        {showQueue ? (
          /* PLAYLIST QUEUE VIEW */
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ListMusic className="w-4 h-4 text-blue-400" />
                <span>Wiedergabeliste ({playlist.length})</span>
              </h3>
              <button
                type="button"
                onClick={toggleShuffle}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                  isShuffle
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                <Shuffle className="w-3 h-3" />
                <span>Shuffle {isShuffle ? 'AN' : 'AUS'}</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-white/5 py-2 space-y-1">
              {playlist.map((item, idx) => {
                const isCurrent =
                  (item.path || item.name) === (currentTrack.path || currentTrack.name);
                const info = parseAudioTitle(item.name);
                return (
                  <div
                    key={item.id || item.path || item.name}
                    onClick={() => playTrack(item, playlist, item.owner || currentUser)}
                    className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all active:scale-[0.99] ${
                      isCurrent
                        ? 'bg-blue-600/30 border border-blue-500/40 text-blue-300 font-semibold'
                        : 'hover:bg-white/5 text-white/90'
                    }`}
                  >
                    <div className="w-6 text-center text-xs font-mono text-white/40 shrink-0">
                      {isCurrent ? (
                        <div className="flex items-end justify-center gap-0.5 h-3">
                          <span className="w-0.5 bg-blue-400 h-3 animate-pulse" />
                          <span className="w-0.5 bg-blue-400 h-2 animate-bounce" />
                          <span className="w-0.5 bg-blue-400 h-3 animate-pulse" />
                        </div>
                      ) : (
                        idx + 1
                      )}
                    </div>

                    <AudioCoverArt
                      filePath={item.path || item.name}
                      currentUser={item.owner || currentUser}
                      title={info.cleanTitle}
                      className="w-10 h-10 rounded-lg shrink-0"
                      iconClassName="w-5 h-5"
                    />

                    <div className="min-w-0 flex-1">
                      <p className={`text-xs truncate ${isCurrent ? 'text-blue-300 font-bold' : 'text-white'}`}>
                        {info.cleanTitle}
                      </p>
                      <p className="text-[10px] text-white/50 truncate">
                        {info.artistHint || (item.owner ? `@${item.owner}` : 'Audio')}
                      </p>
                    </div>

                    {isCurrent && isPlaying && (
                      <span className="text-[10px] bg-blue-500 text-white font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                        Läuft
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setShowQueue(false)}
              className="mt-2 w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold text-center transition-colors"
            >
              Zurück zum Player
            </button>
          </div>
        ) : (
          /* FULL TRACK VIEW */
          <div className="flex-1 flex flex-col justify-around py-2">
            {/* Big Album Art with ambient glow */}
            <div className="relative mx-auto my-2 w-56 h-56 sm:w-64 sm:h-64 flex items-center justify-center">
              <div className="absolute inset-0 rounded-3xl bg-blue-500/20 blur-2xl -z-10 animate-pulse" />
              <AudioCoverArt
                filePath={trackPath}
                currentUser={trackOwner}
                title={cleanTitle}
                className="w-full h-full rounded-3xl shadow-2xl border border-white/10 overflow-hidden"
                iconClassName="w-24 h-24"
              />
            </div>

            {/* Song Meta */}
            <div className="text-center px-4 my-2">
              <div className="flex items-center justify-center gap-2 mb-1">
                {trackNumber && (
                  <span className="text-xs font-mono text-blue-400 font-bold">
                    #{trackNumber}
                  </span>
                )}
                <span className="font-mono text-[10px] uppercase font-bold text-blue-300 bg-blue-500/20 px-2 py-0.5 rounded-full border border-blue-400/20">
                  {ext || 'AUDIO'}
                </span>
              </div>
              <h2 className="text-lg font-bold text-white line-clamp-2 leading-tight">
                {cleanTitle}
              </h2>
              <p className="text-xs text-white/60 mt-1 truncate">
                {artistHint || (currentTrack.owner ? `@${currentTrack.owner}` : 'J.Jonas Cloud Music')}
              </p>
            </div>

            {/* Timeline Scrubber */}
            <div className="w-full px-2 my-2">
              <AudioScrubber
                currentTime={currentTime}
                duration={duration}
                bufferedPercent={bufferedPercent}
                onSeek={seek}
              />
            </div>

            {/* Main Playback Transport */}
            <div className="flex items-center justify-between gap-1 px-2 my-2">
              {/* Spotify-style Smart Shuffle */}
              <button
                type="button"
                onClick={toggleShuffle}
                className={`p-3 rounded-full transition-all cursor-pointer active:scale-90 ${
                  isShuffle
                    ? 'text-emerald-400 bg-emerald-500/20 ring-1 ring-emerald-400/30'
                    : 'text-white/60 hover:text-white'
                }`}
                title={isShuffle ? 'Spotify-Shuffle ist AKTIV' : 'Shuffle einschalten'}
              >
                <Shuffle className="w-5 h-5" />
              </button>

              {/* Prev */}
              <button
                type="button"
                onClick={prevTrack}
                disabled={playlist.length <= 1}
                className="p-3 rounded-full text-white/80 hover:text-white active:scale-90 transition-all disabled:opacity-30 cursor-pointer"
                title="Vorheriger Titel"
              >
                <SkipBack className="w-6 h-6" />
              </button>

              {/* -5s Jump */}
              <button
                type="button"
                onClick={() => jumpSeconds(-5)}
                className="p-2.5 rounded-full text-white/70 hover:text-white active:scale-90 transition-all cursor-pointer relative"
                title="5s zurück"
              >
                <RotateCcw className="w-5 h-5" />
                <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold mt-0.5">5</span>
              </button>

              {/* Play / Pause Primary Big Button */}
              <button
                type="button"
                onClick={togglePlay}
                className="p-5 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-95 text-white shadow-xl shadow-blue-500/30 transition-all cursor-pointer"
                title={isPlaying ? 'Pause' : 'Abspielen'}
              >
                {isLoading ? (
                  <Loader2 className="w-8 h-8 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-8 h-8 fill-white" />
                ) : (
                  <Play className="w-8 h-8 fill-white ml-1" />
                )}
              </button>

              {/* +5s Jump */}
              <button
                type="button"
                onClick={() => jumpSeconds(5)}
                className="p-2.5 rounded-full text-white/70 hover:text-white active:scale-90 transition-all cursor-pointer relative"
                title="5s vor"
              >
                <RotateCw className="w-5 h-5" />
                <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold mt-0.5">5</span>
              </button>

              {/* Next */}
              <button
                type="button"
                onClick={nextTrack}
                disabled={playlist.length <= 1}
                className="p-3 rounded-full text-white/80 hover:text-white active:scale-90 transition-all disabled:opacity-30 cursor-pointer"
                title="Nächster Titel"
              >
                <SkipForward className="w-6 h-6" />
              </button>

              {/* Repeat Mode */}
              <button
                type="button"
                onClick={cycleRepeatMode}
                className={`p-3 rounded-full transition-all cursor-pointer active:scale-90 ${
                  repeatMode !== 'off'
                    ? 'text-blue-400 bg-blue-500/20 ring-1 ring-blue-400/30'
                    : 'text-white/60 hover:text-white'
                }`}
                title="Wiederholungsmodus ändern"
              >
                {repeatMode === 'one' ? (
                  <Repeat1 className="w-5 h-5" />
                ) : (
                  <Repeat className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* Bottom Controls: Speed & Volume */}
            <div className="flex items-center justify-between gap-4 pt-3 border-t border-white/10 px-2">
              {/* Playback speed selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                  className="px-3 py-1.5 rounded-xl bg-white/10 text-white font-mono text-xs font-semibold hover:bg-white/20 transition-colors"
                >
                  {playbackRate}x Tempo
                </button>
                {showSpeedMenu && (
                  <div className="absolute bottom-full mb-2 left-0 bg-gray-900 border border-white/20 rounded-xl shadow-2xl py-1 text-xs z-50 min-w-[90px]">
                    {speedOptions.map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => {
                          setPlaybackRate(rate);
                          setShowSpeedMenu(false);
                        }}
                        className={`w-full px-3 py-1.5 text-left font-mono ${
                          playbackRate === rate
                            ? 'bg-blue-600 text-white font-bold'
                            : 'text-white/80 hover:bg-white/10'
                        }`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Volume Slider */}
              <div className="flex items-center gap-2 flex-1 max-w-[180px]">
                <button
                  type="button"
                  onClick={toggleMute}
                  className="p-1.5 text-white/70 hover:text-white"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4 text-red-400" />
                  ) : volume < 0.5 ? (
                    <Volume1 className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-full accent-blue-500 h-1.5 bg-white/20 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
