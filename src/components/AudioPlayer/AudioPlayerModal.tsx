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
  X,
  Download,
  Loader2,
  ListMusic,
  Music,
  Check,
  Disc,
} from 'lucide-react';
import { useAudioPlayer } from '../../context/AudioPlayerContext';
import { parseAudioTitle } from '../../utils/audioPlayerUtils';
import { formatBytes, triggerDirectDownload } from '../../services/storageApi';
import { AudioScrubber } from './AudioScrubber';
import { AudioVolumeControl } from './AudioVolumeControl';
import { AudioCoverArt } from './AudioCoverArt';

export const AudioPlayerModal: React.FC = () => {
  const {
    currentTrack,
    playlist,
    currentIndex,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    bufferedPercent,
    volume,
    isMuted,
    isExpanded,
    isShuffle,
    repeatMode,
    playbackRate,
    currentUser,
    playTrack,
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
    setIsExpanded,
    closePlayer,
  } = useAudioPlayer();

  const [playlistSearch, setPlaylistSearch] = useState('');
  const [showPlaylistTab, setShowPlaylistTab] = useState(true);

  if (!isExpanded || !currentTrack) {
    return null;
  }

  const { cleanTitle, ext, trackNumber, artistHint } = parseAudioTitle(currentTrack.name);
  const trackPath = currentTrack.path || currentTrack.name;
  const trackOwner = currentTrack.owner || currentUser;

  const handleDownload = () => {
    triggerDirectDownload(trackOwner, trackPath, currentTrack.name);
  };

  const filteredPlaylist = playlist.filter((item) =>
    item.name.toLowerCase().includes(playlistSearch.toLowerCase())
  );

  const speedOptions = [0.75, 1, 1.25, 1.5, 2];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 select-none"
      onClick={() => setIsExpanded(false)}
    >
      <div
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col md:flex-row bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl border border-gray-200/90 dark:border-gray-800 shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-150 pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Actions (Mobile & Desktop) */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          {/* Download Current Song */}
          <button
            type="button"
            onClick={handleDownload}
            className="p-2 rounded-xl text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            title="Titel herunterladen"
          >
            <Download className="w-4 h-4 text-blue-500" />
          </button>

          {/* Minimize back to Floating Bar */}
          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            className="p-2 rounded-xl text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            title="Minimieren (Esc)"
          >
            <Minimize2 className="w-4 h-4" />
          </button>

          {/* Close / Stop */}
          <button
            type="button"
            onClick={closePlayer}
            className="p-2 rounded-xl text-gray-500 hover:text-red-500 bg-gray-100 dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
            title="Player beenden"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* LEFT SECTION: MAIN PLAYER DECK */}
        <div className="flex-1 p-6 sm:p-8 flex flex-col items-center justify-between overflow-y-auto">
          {/* Top Label */}
          <div className="w-full flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 mb-4">
            <div className="flex items-center gap-2">
              <Disc className="w-4 h-4 text-blue-500 animate-spin-slow" />
              <span className="font-semibold uppercase tracking-wider text-[11px] text-gray-600 dark:text-gray-300">
                J.Jonas Audio
              </span>
            </div>
          </div>

          {/* Album Cover with Ambient Blur */}
          <div className="relative my-2 sm:my-4 flex items-center justify-center">
            {/* Ambient Background Glow */}
            <div className="absolute inset-0 bg-blue-500/20 dark:bg-indigo-500/25 blur-3xl rounded-full scale-110 pointer-events-none" />

            <AudioCoverArt
              filePath={trackPath}
              currentUser={trackOwner}
              title={cleanTitle}
              className="relative w-48 h-48 sm:w-64 sm:h-64 rounded-3xl shadow-2xl border border-white/20 dark:border-white/10 group"
              iconClassName="w-20 h-20"
            />
          </div>

          {/* Title & Metadata */}
          <div className="text-center w-full max-w-md my-3">
            <h2
              className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 truncate"
              title={currentTrack.name}
            >
              {cleanTitle}
            </h2>

            <div className="flex items-center justify-center gap-2 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              <span className="truncate">
                {artistHint || (currentTrack.owner ? `@${currentTrack.owner}` : 'Unbekannter Interpret')}
              </span>
              <span>·</span>
              <span className="font-mono text-blue-600 dark:text-blue-400 font-bold uppercase">
                {ext || 'AUDIO'}
              </span>
              {currentTrack.size > 0 && (
                <>
                  <span>·</span>
                  <span className="font-mono">{formatBytes(currentTrack.size)}</span>
                </>
              )}
            </div>
          </div>

          {/* Interactive Timeline Scrubber */}
          <div className="w-full max-w-md my-2">
            <AudioScrubber
              currentTime={currentTime}
              duration={duration}
              bufferedPercent={bufferedPercent}
              onSeek={seek}
              compact={false}
            />
          </div>

          {/* Main Playback Transport Controls */}
          <div className="flex items-center justify-center gap-3 sm:gap-4 my-2">
            {/* Shuffle */}
            <button
              type="button"
              onClick={toggleShuffle}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                isShuffle
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60'
                  : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
              title={isShuffle ? 'Zufallswiedergabe: Ein' : 'Zufallswiedergabe: Aus'}
            >
              <Shuffle className="w-4 h-4" />
            </button>

            {/* Previous Track */}
            <button
              type="button"
              onClick={prevTrack}
              disabled={playlist.length <= 1}
              className="p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-40 cursor-pointer"
              title="Vorheriger Titel"
            >
              <SkipBack className="w-5 h-5" />
            </button>

            {/* Jump -5s */}
            <button
              type="button"
              onClick={() => jumpSeconds(-5)}
              className="p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer relative"
              title="5s zurück (Pfeil links)"
            >
              <RotateCcw className="w-5 h-5" />
              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold mt-0.5">5</span>
            </button>

            {/* Primary Play / Pause Button */}
            <button
              type="button"
              onClick={togglePlay}
              className="p-4 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-xl active:scale-95 transition-transform cursor-pointer flex items-center justify-center"
              title={isPlaying ? 'Pause (Leertaste)' : 'Abspielen (Leertaste)'}
            >
              {isLoading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-6 h-6 fill-white" />
              ) : (
                <Play className="w-6 h-6 fill-white ml-0.5" />
              )}
            </button>

            {/* Jump +5s */}
            <button
              type="button"
              onClick={() => jumpSeconds(5)}
              className="p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer relative"
              title="5s vor (Pfeil rechts)"
            >
              <RotateCw className="w-5 h-5" />
              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold mt-0.5">5</span>
            </button>

            {/* Next Track */}
            <button
              type="button"
              onClick={nextTrack}
              disabled={playlist.length <= 1}
              className="p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-40 cursor-pointer"
              title="Nächster Titel"
            >
              <SkipForward className="w-5 h-5" />
            </button>

            {/* Repeat Mode */}
            <button
              type="button"
              onClick={cycleRepeatMode}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                repeatMode !== 'off'
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60'
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
                <Repeat1 className="w-4 h-4" />
              ) : (
                <Repeat className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Bottom Deck Secondary Controls: Volume & Speed */}
          <div className="w-full max-w-md flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
            {/* Speed Buttons */}
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800/80 p-1 rounded-xl">
              {speedOptions.map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => setPlaybackRate(rate)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-mono transition-colors ${
                    playbackRate === rate
                      ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 font-bold shadow-xs'
                      : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>

            {/* Volume Control */}
            <AudioVolumeControl
              volume={volume}
              isMuted={isMuted}
              onVolumeChange={setVolume}
              onToggleMute={toggleMute}
            />
          </div>
        </div>

        {/* RIGHT SECTION: UP NEXT / PLAYLIST DRAWER */}
        <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950/40 p-4 sm:p-6 flex flex-col max-h-72 md:max-h-none">
          <div className="flex items-center justify-between pb-3 border-b border-gray-200/60 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <ListMusic className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                Wiedergabeliste ({playlist.length})
              </h3>
            </div>
          </div>

          {/* Search inside playlist if > 4 items */}
          {playlist.length > 4 && (
            <div className="my-2.5">
              <input
                type="text"
                placeholder="In Liste suchen..."
                value={playlistSearch}
                onChange={(e) => setPlaylistSearch(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Playlist Tracks List */}
          <div className="flex-1 overflow-y-auto space-y-1 pr-1 mt-2 slim-scrollbar">
            {filteredPlaylist.map((item, idx) => {
              const isCurrent = (item.path || item.name) === (currentTrack.path || currentTrack.name);
              const { cleanTitle: itemTitle, ext: itemExt } = parseAudioTitle(item.name);

              return (
                <div
                  key={item.id || item.path || item.name}
                  onClick={() => playTrack(item, playlist, item.owner || trackOwner)}
                  className={`flex items-center gap-2.5 p-2 rounded-xl text-left transition-colors cursor-pointer ${
                    isCurrent
                      ? 'bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800/80'
                      : 'hover:bg-white dark:hover:bg-gray-800/60 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {/* Thumbnail / Animated Equalizer */}
                  <div className="relative w-8 h-8 rounded-lg overflow-hidden shrink-0 flex items-center justify-center bg-gray-200 dark:bg-gray-800">
                    <AudioCoverArt
                      filePath={item.path || item.name}
                      currentUser={item.owner || trackOwner}
                      title={itemTitle}
                      className="w-full h-full rounded-lg"
                      iconClassName="w-4 h-4"
                    />
                    {isCurrent && (
                      <div className="absolute inset-0 bg-blue-600/70 flex items-center justify-center">
                        {isPlaying ? (
                          <div className="flex items-end gap-0.5 h-3">
                            <span className="w-0.5 bg-white h-3 animate-pulse" />
                            <span className="w-0.5 bg-white h-2 animate-bounce" />
                            <span className="w-0.5 bg-white h-3 animate-pulse" />
                          </div>
                        ) : (
                          <Pause className="w-3.5 h-3.5 text-white fill-white" />
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-xs truncate font-semibold ${
                        isCurrent
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-gray-800 dark:text-gray-200'
                      }`}
                    >
                      {itemTitle}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                      <span>{itemExt}</span>
                      {item.size > 0 && (
                        <>
                          <span>·</span>
                          <span>{formatBytes(item.size)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
