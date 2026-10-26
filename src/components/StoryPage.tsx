import React, { useState, useEffect } from 'react';
import { Play, Pause, Moon } from 'lucide-react';
import { Track, Chapter } from '../types';
import { useAudio } from '../context/AudioContext';
import { BrandIcon } from './BrandIcon';
import { formatPlayCount, getTrackActiveListeners, getTrackPlayCount } from '../services/stats';

interface StoryPageProps {
  track: Track;
  onSelectChapter: (track: Track, chapter: Chapter) => void;
  onBackToHome: () => void;
}

export const StoryPage: React.FC<StoryPageProps> = ({
  track,
  onSelectChapter,
  onBackToHome,
}) => {
  const [isSleepOpen, setIsSleepOpen] = useState<boolean>(false);

  const {
    currentTrack,
    currentChapter,
    isPlaying,
    duration,
    formatTime,
    sleepTimerMinutes,
    sleepTimerSecondsLeft,
    togglePlayPause,
    setSleepTimer,
  } = useAudio();

  const chapters: Chapter[] = React.useMemo(
    () =>
      track.chapters && track.chapters.length > 0
        ? track.chapters
        : [{ id: 1, title: track.title, duration: '25:00', mp3_url: track.mp3_url }],
    [track.chapters, track.title, track.mp3_url]
  );

  // Tự động nhận diện thời lượng các tập nếu dữ liệu chưa có sẵn
  const [probedDurations, setProbedDurations] = useState<Record<string | number, string>>({});

  useEffect(() => {
    chapters.forEach((ch, idx) => {
      const key = ch.id ?? idx;
      if (ch.duration && ch.duration.trim() && ch.duration !== 'Audio Full' && ch.duration !== 'Chưa gắn') {
        return;
      }
      if (!ch.mp3_url) return;

      const audio = new Audio();
      audio.preload = 'metadata';
      audio.onloadedmetadata = () => {
        const secs = audio.duration;
        if (secs > 0 && isFinite(secs)) {
          const s = Math.floor(secs);
          const hrs = Math.floor(s / 3600);
          const mins = Math.floor((s % 3600) / 60);
          const rem = s % 60;
          const formatted = hrs > 0
            ? `${hrs}:${mins < 10 ? '0' : ''}${mins}:${rem < 10 ? '0' : ''}${rem}`
            : `${mins < 10 ? '0' : ''}${mins}:${rem < 10 ? '0' : ''}${rem}`;
          setProbedDurations((prev) => ({ ...prev, [key]: formatted }));
        }
      };
      audio.src = ch.mp3_url;
    });
  }, [chapters]);

  const isCurrentStoryActive = currentTrack?.id === track.id;

  const handleMainPlayClick = () => {
    if (isCurrentStoryActive && isPlaying) {
      togglePlayPause();
    } else {
      const targetChapter = (isCurrentStoryActive && currentChapter) ? currentChapter : chapters[0];
      onSelectChapter(track, targetChapter);
    }
  };

  return (
    <article 
      itemScope 
      itemType="https://schema.org/AudioObject"
      className="max-w-4xl mx-auto px-4 sm:px-6 py-4 space-y-5 pb-10 animate-fade-in"
    >
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button
          onClick={onBackToHome}
          className="text-slate-400 hover:text-white text-xs sm:text-sm font-medium flex items-center gap-1 cursor-pointer transition select-none"
        >
          <span>← Quay lại</span>
        </button>

        {/* SEO Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="text-xs text-slate-400 font-medium hidden sm:block">
          <ol className="flex items-center gap-1.5 flex-wrap" itemScope itemType="https://schema.org/BreadcrumbList">
            <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
              <button
                onClick={onBackToHome}
                className="hover:text-amber-400 transition cursor-pointer"
              >
                <span itemProp="name">Trang chủ</span>
              </button>
              <meta itemProp="position" content="1" />
            </li>
            <span className="text-slate-600">/</span>
            <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
              <span itemProp="name" className="text-slate-300 font-semibold">{track.category || 'Audio'}</span>
              <meta itemProp="position" content="2" />
            </li>
            <span className="text-slate-600">/</span>
            <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem" className="truncate max-w-[200px] md:max-w-xs">
              <span itemProp="name" className="text-amber-400 font-bold truncate">{track.title}</span>
              <meta itemProp="position" content="3" />
            </li>
          </ol>
        </nav>
      </div>

      {/* Main Modern Dark Story Card */}
      <div className="bg-gradient-to-b from-[#131b2e] to-[#0d1322] rounded-3xl p-5 sm:p-6 border border-slate-800/90 shadow-2xl space-y-4">
        {/* Audio Banner Canvas (Image-free graphic) */}
        <div className="relative w-full aspect-[16/9] sm:aspect-[2/1] rounded-2xl bg-gradient-to-br from-[#1c2742] via-[#101728] to-[#090e18] border border-slate-700/60 flex items-center justify-center p-4 overflow-hidden shadow-inner">
          {/* Circular striped audio emblem */}
          <div
            className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-transform ${
              isCurrentStoryActive && isPlaying ? 'scale-105' : ''
            }`}
          >
            <BrandIcon size={64} />
          </div>

          {/* Duration badge */}
          <span className="absolute bottom-2.5 right-2.5 bg-slate-900/80 text-slate-300 font-mono text-[11px] px-2.5 py-0.5 rounded-md border border-slate-700/60 backdrop-blur-xs">
            {chapters[0]?.duration || '29:05'}
          </span>
        </div>

        {/* Story Title */}
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-snug">
          {track.title}
        </h1>

        {/* Metadata line */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <span className="px-2 py-0.5 rounded-md bg-slate-800/90 text-amber-400 font-mono text-[11px] font-medium border border-slate-700/60">
            Audio Full
          </span>
          <span className="text-slate-400 font-mono">
            🎧 {formatPlayCount(getTrackPlayCount(track))}
          </span>
          {getTrackActiveListeners(track) > 0 && (
            <span className="text-emerald-400 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
              <span>{getTrackActiveListeners(track)} đang nghe</span>
            </span>
          )}
        </div>

        {/* Release Date & Author */}
        <p className="text-xs text-slate-400 font-mono flex items-center gap-2">
          <span>{track.created_at ? new Date(track.created_at).toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' }) : '23 tháng 10, 2026'}</span>
          <span>•</span>
          <span className="text-slate-300">Tác giả: {track.author || 'Phú Bà Audio'}</span>
        </p>

        {/* Primary and Secondary CTA Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            onClick={handleMainPlayClick}
            className="w-full h-12 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-slate-950 font-bold text-sm sm:text-base px-3 sm:px-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition cursor-pointer select-none whitespace-nowrap"
          >
            {isCurrentStoryActive && isPlaying ? (
              <>
                <Pause size={18} className="fill-current text-slate-950 shrink-0" />
                <span className="whitespace-nowrap">Tạm dừng</span>
              </>
            ) : (
              <>
                <Play size={18} className="fill-current text-slate-950 ml-0.5 shrink-0" />
                <span className="whitespace-nowrap">Nghe ngay</span>
              </>
            )}
          </button>

          <div className="relative">
            <button
              onClick={() => setIsSleepOpen(!isSleepOpen)}
              className={`w-full h-12 px-3 sm:px-4 rounded-2xl font-medium text-sm sm:text-base flex items-center justify-center gap-2 border transition cursor-pointer select-none whitespace-nowrap ${
                sleepTimerMinutes
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                  : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border-slate-700/80'
              }`}
            >
              <Moon size={16} className="shrink-0" />
              <span className="whitespace-nowrap">
                {sleepTimerSecondsLeft !== null
                  ? `${Math.floor(sleepTimerSecondsLeft / 60)}p`
                  : 'Hẹn giờ'}
              </span>
            </button>

            {isSleepOpen && (
              <div className="absolute top-full mt-2 right-0 w-36 bg-[#101726] border border-slate-700 rounded-xl shadow-2xl py-1 z-30 animate-fade-in">
                {[
                  { label: 'Tắt hẹn giờ', val: null },
                  { label: 'Sau 15 phút', val: 15 },
                  { label: 'Sau 30 phút', val: 30 },
                  { label: 'Sau 45 phút', val: 45 },
                  { label: 'Sau 60 phút', val: 60 },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setSleepTimer(item.val);
                      setIsSleepOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-800 flex items-center justify-between cursor-pointer ${
                      sleepTimerMinutes === item.val
                        ? 'text-amber-400 font-bold'
                        : 'text-slate-300'
                    }`}
                  >
                    <span>{item.label}</span>
                    {sleepTimerMinutes === item.val && <span className="text-[10px] text-amber-400">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section: Danh sách tập (N) */}
      <div className="space-y-3 pt-1">
        <h2 className="text-base font-bold text-white">
          Danh sách tập ({chapters.length})
        </h2>

        <div className="space-y-2.5">
          {chapters.map((ch, idx) => {
            const isThisActive =
              isCurrentStoryActive && currentChapter?.id === ch.id;
            const isThisPlaying = isThisActive && isPlaying;

            return (
              <div
                key={ch.id || idx}
                onClick={() => onSelectChapter(track, ch)}
                className={`p-3.5 sm:p-4 rounded-2xl flex items-center justify-between transition cursor-pointer select-none ${
                  isThisActive
                    ? 'border border-amber-500/60 bg-gradient-to-r from-amber-950/40 via-[#18233a] to-[#101726] text-white shadow-md'
                    : 'border border-slate-800/90 bg-[#101726]/80 hover:bg-slate-800/80 text-slate-200'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span
                    className={`font-black text-base w-5 pt-0.5 shrink-0 ${
                      isThisActive ? 'text-amber-400' : 'text-slate-500'
                    }`}
                  >
                    {idx + 1}
                  </span>

                  <div className="min-w-0">
                    <h3
                      className={`text-sm leading-snug truncate ${
                        isThisActive ? 'font-bold text-amber-400' : 'font-semibold text-slate-200'
                      }`}
                    >
                      {ch.title || track.title}
                    </h3>
                    <span
                      className={`text-xs font-mono block mt-0.5 ${
                        isThisActive ? 'text-amber-300/80' : 'text-slate-400'
                      }`}
                    >
                      {isThisActive && duration > 0
                        ? formatTime(duration)
                        : (ch.duration && ch.duration.trim() && ch.duration !== 'Audio Full' && ch.duration !== 'Chưa gắn'
                            ? ch.duration.trim()
                            : (probedDurations[ch.id ?? idx] || '25:00'))}
                    </span>
                  </div>
                </div>

                {/* Right: Soundwave icon for active episode or subtle indicator */}
                <div className="shrink-0 pl-2">
                  {isThisPlaying ? (
                    <div className="flex items-end gap-1 h-4">
                      <span className="w-1 bg-amber-400 rounded-full animate-wave-1 h-3"></span>
                      <span className="w-1 bg-amber-400 rounded-full animate-wave-2 h-4"></span>
                      <span className="w-1 bg-amber-400 rounded-full animate-wave-3 h-2.5"></span>
                    </div>
                  ) : isThisActive ? (
                    <div className="flex items-end gap-1 h-4">
                      <span className="w-1 bg-amber-400 rounded-full h-2"></span>
                      <span className="w-1 bg-amber-400 rounded-full h-3.5"></span>
                      <span className="w-1 bg-amber-400 rounded-full h-1.5"></span>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section: Giới thiệu truyện audio */}
      <div className="space-y-2 pt-1 p-4 rounded-2xl bg-gradient-to-b from-[#101726]/80 to-[#0c121e]/80 border border-slate-800/80">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <span>Giới thiệu truyện audio</span>
          <span className="text-xs text-amber-400 font-normal">({track.category || 'Audio'})</span>
        </h2>
        <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
          {track.description || 'Nội dung truyện audio đang được cập nhật...'}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 pt-1 border-t border-slate-800/60 font-medium">
          <span>Tác giả: <strong className="text-slate-200">{track.author || 'Đang cập nhật'}</strong></span>
          <span>Giọng đọc: <strong className="text-slate-200">{track.narrator || 'Phú Bà Audio'}</strong></span>
          <span>Thể loại: <strong className="text-amber-400">{track.category || 'Truyện Audio'}</strong></span>
        </div>
      </div>
    </article>
  );
};
