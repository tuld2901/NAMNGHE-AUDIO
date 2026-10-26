import React, { useState } from 'react';
import { Play, Pause, Moon, SkipBack, SkipForward } from 'lucide-react';
import { Track } from '../types';
import { useAudio } from '../context/AudioContext';
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

export const Player: React.FC<PlayerProps> = ({ onOpenStoryDetail }) => {
  const {
    currentTrack,
    currentChapter,
    isPlaying,
    currentTime,
    bufferedTime,
    duration,
    playbackSpeed,
    sleepTimerMinutes,
    sleepTimerSecondsLeft,
    togglePlayPause,
    seekTo,
    setPlaybackSpeed,
    setSleepTimer,
    nextChapter,
    prevChapter,
    setIsScrubbing,
    formatTime,
  } = useAudio();

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
    <div className="sticky bottom-0 left-0 right-0 z-30 w-full bg-[#0e1525] border-t border-slate-800">
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
              <h4 className="font-bold text-white text-sm leading-tight truncate group-hover:text-amber-400 transition">
                {currentTrack.title}
              </h4>
              <p className="text-xs text-slate-400 font-medium truncate mt-0.5">
                Tập {currentChapterIdx > 0 ? currentChapterIdx : 1}/{chaptersCount} •{' '}
                {isPlaying ? 'Đang phát' : 'Tạm dừng'}
              </p>
            </div>
          </div>

          {/* Right Controls: Skip Back + Big Amber Play/Pause + Skip Forward + Speed Menu + Sleep Timer */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Skip Back / Previous Episode */}
            <button
              onClick={prevChapter}
              className="w-9 h-9 rounded-full hover:bg-slate-800/80 active:scale-95 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              title="Tập trước"
            >
              <SkipBack size={18} />
            </button>

            {/* Round Solid Amber Play/Pause Button */}
            <button
              onClick={togglePlayPause}
              className="w-11 h-11 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 active:scale-95 text-slate-950 flex items-center justify-center transition cursor-pointer shadow-lg shadow-amber-500/25"
              title={isPlaying ? 'Tạm dừng' : 'Tiếp tục phát'}
            >
              {isPlaying ? (
                <Pause size={18} className="fill-current text-slate-950" />
              ) : (
                <Play size={18} className="fill-current text-slate-950 ml-0.5" />
              )}
            </button>

            {/* Skip Forward / Next Episode */}
            <button
              onClick={nextChapter}
              className="w-9 h-9 rounded-full hover:bg-slate-800/80 active:scale-95 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
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
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-sm shadow-amber-500/20'
                    : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border-slate-700/70'
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
                  <div className="absolute bottom-full mb-2 right-0 w-44 bg-[#101726] border border-slate-700/80 rounded-2xl shadow-2xl py-1 z-50 animate-fade-in backdrop-blur-md">
                    <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 border-b border-slate-800 uppercase tracking-wider flex items-center justify-between">
                      <span>Tốc độ phát</span>
                      <span className="text-[10px] text-amber-400 font-mono font-bold">{playbackSpeed}×</span>
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
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-800/90 flex items-center justify-between transition cursor-pointer ${
                            isSelected
                              ? 'text-amber-400 font-bold bg-amber-500/10'
                              : 'text-slate-300'
                          }`}
                        >
                          <span>{opt.label}</span>
                          {isSelected && (
                            <span className="text-[11px] text-amber-400 font-bold">✓</span>
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
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                    : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border-slate-700/70'
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
                  <div className="absolute bottom-full mb-2 right-0 w-36 bg-[#101726] border border-slate-700 rounded-2xl shadow-2xl py-1 z-50 animate-fade-in">
                    <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 border-b border-slate-800 uppercase tracking-wider">
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
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-800 flex items-center justify-between cursor-pointer ${
                          sleepTimerMinutes === item.val
                            ? 'text-amber-400 font-bold'
                            : 'text-slate-300'
                        }`}
                      >
                        <span>{item.label}</span>
                        {sleepTimerMinutes === item.val && (
                          <span className="text-[10px] text-amber-400">✓</span>
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
};
