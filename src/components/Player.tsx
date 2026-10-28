import React, { useState } from 'react';
import { Play, Pause, Moon, SkipBack, SkipForward } from 'lucide-react';
import { Track } from '../types';
import { useAudio, useAudioTime } from '../context/AudioContext';
import { AudioScrubber } from './AudioScrubber';
import { SoundWaveIcon } from './BrandIcon';

interface PlayerProps {
  onOpenStoryDetail?: (track: Track) => void;
}

const SPEED_OPTIONS = [
  { label: '0.5×', value: 0.5 },
  { label: '0.75×', value: 0.75 },
  { label: '1.0× (mặc định)', value: 1.0 },
  { label: '1.25×', value: 1.25 },
  { label: '1.5×', value: 1.5 },
  { label: '1.75×', value: 1.75 },
  { label: '2.0×', value: 2.0 },
];

export const Player: React.FC<PlayerProps> = React.memo(({ onOpenStoryDetail }) => {
  const {
    currentTrack,
    currentChapter,
    isPlaying,
    playbackSpeed,
    sleepTimerMinutes,
    togglePlayPause,
    seekTo,
    setPlaybackSpeed,
    setSleepTimer,
    nextChapter,
    prevChapter,
    setIsScrubbing,
    formatTime,
  } = useAudio();

  const { currentTime, bufferedTime, duration } = useAudioTime();

  const [isSpeedMenuOpen, setIsSpeedMenuOpen] = useState<boolean>(false);
  const [isSleepMenuOpen, setIsSleepMenuOpen] = useState<boolean>(false);

  if (!currentTrack) {
    return null;
  }

  const handleSetSleep = (mins: number | null) => {
    setSleepTimer(mins);
    setIsSleepMenuOpen(false);
  };

  const chaptersCount = currentTrack.chapters?.length || 1;
  const currentChapterIdx = currentTrack.chapters
    ? currentTrack.chapters.findIndex((c) => c.id === currentChapter?.id) + 1
    : 1;

  return (
    <div className="sticky bottom-0 left-0 right-0 z-30 w-full bg-[#000000] border-t border-[#282828]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 space-y-1.5">
        {/* Top row: Story info + Responsive Playback Controls */}
        <div className="flex items-center justify-between gap-3 sm:gap-6">
          {/* Left: Soundwave + Track Title & Episode Subtitle */}
          <div
            onClick={() => onOpenStoryDetail && onOpenStoryDetail(currentTrack)}
            className="flex items-center gap-2.5 min-w-0 flex-1 max-w-sm sm:max-w-md cursor-pointer select-none group"
          >
            <div className="shrink-0 flex items-center justify-center w-6">
              <SoundWaveIcon isPlaying={isPlaying} />
            </div>

            <div className="min-w-0">
              <h4 className="font-bold text-white text-sm leading-tight truncate group-hover:text-[#1ed760] transition">
                {currentTrack.title}
              </h4>
              <p className="text-xs text-[#b3b3b3] font-medium truncate mt-0.5">
                Tập {currentChapterIdx > 0 ? currentChapterIdx : 1}/{chaptersCount} •{' '}
                {isPlaying ? 'Đang phát' : 'Tạm dừng'}
              </p>
            </div>
          </div>

          {/* Right Controls: Skip Back + Big Spotify Green Play/Pause + Skip Forward + Speed Menu + Sleep Timer */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Skip Back / Previous Episode */}
            <button
              onClick={prevChapter}
              className="w-9 h-9 rounded-full hover:bg-[#282828] active:scale-95 text-[#b3b3b3] hover:text-white flex items-center justify-center transition cursor-pointer"
              title="Tập trước"
            >
              <SkipBack size={18} />
            </button>

            {/* Round Solid Spotify Green Play/Pause Button */}
            <button
              onClick={togglePlayPause}
              className="w-11 h-11 rounded-full bg-[#1ed760] hover:bg-[#1db954] hover:scale-105 active:scale-95 text-black flex items-center justify-center transition cursor-pointer shadow-lg shadow-[#1ed760]/20"
              title={isPlaying ? 'Tạm dừng' : 'Tiếp tục phát'}
            >
              {isPlaying ? (
                <Pause size={18} className="fill-current text-black" />
              ) : (
                <Play size={18} className="fill-current text-black ml-0.5" />
              )}
            </button>

            {/* Skip Forward / Next Episode */}
            <button
              onClick={nextChapter}
              className="w-9 h-9 rounded-full hover:bg-[#282828] active:scale-95 text-[#b3b3b3] hover:text-white flex items-center justify-center transition cursor-pointer"
              title="Tập kế tiếp"
            >
              <SkipForward size={18} />
            </button>

            {/* Speed Dropdown Menu */}
            <div className="relative">
              <button
                onClick={() => {
                  setIsSpeedMenuOpen(!isSpeedMenuOpen);
                  setIsSleepMenuOpen(false);
                }}
                className={`h-9 px-2.5 sm:px-3 rounded-full text-xs font-semibold font-mono flex items-center gap-1 transition cursor-pointer border active:scale-95 ${
                  isSpeedMenuOpen
                    ? 'bg-[#1db954]/20 text-[#1ed760] border-[#1ed760]/40 shadow-sm shadow-[#1ed760]/20'
                    : 'bg-[#242424] hover:bg-[#2a2a2a] text-[#b3b3b3] hover:text-white border-[#333333]'
                }`}
                title="Tốc độ phát: Bấm để chọn danh sách"
              >
                <span>{playbackSpeed}×</span>
              </button>

              {isSpeedMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsSpeedMenuOpen(false)}
                  />
                  <div className="absolute bottom-full mb-2 right-0 w-44 bg-[#282828] border border-[#3e3e3e] rounded-2xl shadow-2xl py-1 z-50 animate-fade-in backdrop-blur-md">
                    <div className="px-3 py-1.5 text-[11px] font-bold text-[#b3b3b3] border-b border-[#333333] uppercase tracking-wider flex items-center justify-between">
                      <span>Tốc độ phát</span>
                      <span className="text-[10px] text-[#1ed760] font-mono font-bold">{playbackSpeed}×</span>
                    </div>
                    {SPEED_OPTIONS.map((opt) => {
                      const isSelected = playbackSpeed === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => {
                            setPlaybackSpeed(opt.value);
                            setIsSpeedMenuOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-[#333333] flex items-center justify-between transition cursor-pointer ${
                            isSelected
                              ? 'text-[#1ed760] font-bold bg-[#1db954]/15'
                              : 'text-white'
                          }`}
                        >
                          <span>{opt.label}</span>
                          {isSelected && (
                            <span className="text-[11px] text-[#1ed760] font-bold">✓</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Sleep Timer Button */}
            <div className="relative">
              <button
                onClick={() => {
                  setIsSleepMenuOpen(!isSleepMenuOpen);
                  setIsSpeedMenuOpen(false);
                }}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition cursor-pointer border active:scale-95 ${
                  sleepTimerMinutes
                    ? 'bg-[#1db954]/20 text-[#1ed760] border-[#1ed760]/40'
                    : 'bg-[#242424] hover:bg-[#2a2a2a] text-[#b3b3b3] hover:text-white border-[#333333]'
                }`}
                title="Hẹn giờ tắt"
              >
                <Moon size={15} />
              </button>

              {isSleepMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsSleepMenuOpen(false)}
                  />
                  <div className="absolute bottom-full mb-2 right-0 w-36 bg-[#282828] border border-[#3e3e3e] rounded-2xl shadow-2xl py-1 z-50 animate-fade-in">
                    <div className="px-3 py-1.5 text-[11px] font-bold text-[#b3b3b3] border-b border-[#333333] uppercase tracking-wider">
                      Hẹn giờ tắt
                    </div>
                    {[
                      { label: 'Tắt hẹn giờ', val: null },
                      { label: '15 phút', val: 15 },
                      { label: '30 phút', val: 30 },
                      { label: '45 phút', val: 45 },
                      { label: '60 phút', val: 60 },
                    ].map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSetSleep(item.val)}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[#333333] flex items-center justify-between cursor-pointer ${
                          sleepTimerMinutes === item.val
                            ? 'text-[#1ed760] font-bold'
                            : 'text-white'
                        }`}
                      >
                        <span>{item.label}</span>
                        {sleepTimerMinutes === item.val && (
                          <span className="text-[10px] text-[#1ed760]">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Bottom row: Interactive Scrubber with Elapsed & Remaining Time */}
        <div className="pt-0.5">
          <AudioScrubber
            currentTime={currentTime}
            bufferedTime={bufferedTime}
            duration={duration}
            onSeek={seekTo}
            formatTime={formatTime}
            size="sm"
            showTimeLabels={true}
            onScrubbingChange={setIsScrubbing}
          />
        </div>
      </div>
    </div>
  );
});

