import React, { useState, useEffect } from 'react';
import { Play, Pause, Moon } from 'lucide-react';
import { Track, Chapter } from '../types';
import { useAudio } from '../context/AudioContext';
import { BrandIcon } from './BrandIcon';
import { formatPlayCount, getTrackPlayCount } from '../services/stats';

interface StoryPageProps {
  track: Track;
  allTracks?: Track[];
  onSelectChapter: (track: Track, chapter: Chapter) => void;
  onSelectStory?: (track: Track) => void;
  onBackToHome: () => void;
}

export const StoryPage: React.FC<StoryPageProps> = React.memo(({
  track,
  allTracks = [],
  onSelectChapter,
  onSelectStory,
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

  // Danh sách "Có lẽ bạn sẽ thích": Loại bỏ trang audio đang mở (track.id) và audio đang phát (currentTrack?.id)
  const recommendedTracks = React.useMemo(() => {
    const getCatSet = (t: Track) => {
      const list =
        Array.isArray(t.categories) && t.categories.length > 0
          ? t.categories
          : (t.category || '')
              .split(/[,;|]+/)
              .map((s) => s.trim().toLowerCase())
              .filter(Boolean);
      return new Set(list.map((s) => s.toLowerCase()));
    };
    const currentCats = getCatSet(track);
    const hasSharedCategory = (item: Track) => {
      for (const c of getCatSet(item)) {
        if (currentCats.has(c)) return 1;
      }
      return 0;
    };

    const filtered = allTracks.filter(
      (item) => item.id !== track.id && (!currentTrack || item.id !== currentTrack.id)
    );
    // Ưu tiên có chung thể loại lên trước, sau đó sắp xếp theo lượt nghe thực tế
    return [...filtered].sort((a, b) => {
      const aSameCat = hasSharedCategory(a);
      const bSameCat = hasSharedCategory(b);
      if (aSameCat !== bSameCat) return bSameCat - aSameCat;
      return getTrackPlayCount(b) - getTrackPlayCount(a);
    });
  }, [allTracks, track, currentTrack]);

  // Tự động nhận diện thời lượng các tập nếu dữ liệu chưa có sẵn (giới hạn tối đa 3 probe và dọn dẹp bộ nhớ khi unmount)
  const [probedDurations, setProbedDurations] = useState<Record<string | number, string>>({});

  useEffect(() => {
    const createdAudios: HTMLAudioElement[] = [];
    let probeCount = 0;

    chapters.forEach((ch, idx) => {
      const key = ch.id ?? idx;
      if (ch.duration && ch.duration.trim() && ch.duration !== 'Audio Full' && ch.duration !== 'Chưa gắn') {
        return;
      }
      // File trên server (/uploads/) đã được server tính sẵn thời lượng, không tạo Audio ngầm gây tốn băng thông
      if (!ch.mp3_url || ch.mp3_url.includes('/uploads/') || probeCount >= 2) return;
      probeCount++;

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
        audio.src = '';
      };
      audio.src = ch.mp3_url;
      createdAudios.push(audio);
    });

    return () => {
      createdAudios.forEach((a) => {
        try {
          a.onloadedmetadata = null;
          a.src = '';
        } catch {}
      });
    };
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
          className="text-slate-600 dark:text-[#b3b3b3] hover:text-slate-900 dark:hover:text-white text-xs sm:text-sm font-medium flex items-center gap-1 cursor-pointer transition select-none"
        >
          <span>← Quay lại</span>
        </button>

        {/* SEO Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="text-xs text-slate-500 dark:text-[#b3b3b3] font-medium hidden sm:block">
          <ol className="flex items-center gap-1.5 flex-wrap" itemScope itemType="https://schema.org/BreadcrumbList">
            <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
              <button
                onClick={onBackToHome}
                className="hover:text-[#16a34a] dark:hover:text-[#1ed760] transition cursor-pointer"
              >
                <span itemProp="name">Trang chủ</span>
              </button>
              <meta itemProp="position" content="1" />
            </li>
            <span className="text-slate-300 dark:text-[#535353]">/</span>
            <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
              <span itemProp="name" className="text-slate-900 dark:text-white font-semibold">{track.category || 'Audio'}</span>
              <meta itemProp="position" content="2" />
            </li>
            <span className="text-slate-300 dark:text-[#535353]">/</span>
            <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem" className="truncate max-w-[200px] md:max-w-xs">
              <span itemProp="name" className="text-[#16a34a] dark:text-[#1ed760] font-bold truncate">{track.title}</span>
              <meta itemProp="position" content="3" />
            </li>
          </ol>
        </nav>
      </div>

      {/* Main Story Card */}
      <div className="bg-gradient-to-b from-white to-slate-50 dark:from-[#181818] dark:to-[#121212] rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-[#282828] shadow-lg dark:shadow-2xl space-y-4 transition-colors duration-200">
        {/* Audio Banner Canvas (Image-free graphic) */}
        <div className="relative w-full aspect-[16/9] sm:aspect-[2/1] rounded-2xl bg-gradient-to-br from-[#1db954]/20 via-emerald-50/60 to-slate-100 dark:from-[#1db954]/20 dark:via-[#181818] dark:to-[#121212] border border-slate-200 dark:border-[#282828] flex items-center justify-center p-4 overflow-hidden shadow-inner">
          {/* Circular striped audio emblem */}
          <div
            className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-transform ${
              isCurrentStoryActive && isPlaying ? 'scale-105' : ''
            }`}
          >
            <BrandIcon size={64} />
          </div>

          {/* Duration badge */}
          <span className="absolute bottom-2.5 right-2.5 bg-white/90 dark:bg-[#000000]/80 text-slate-700 dark:text-[#b3b3b3] font-mono text-[11px] px-2.5 py-0.5 rounded-md border border-slate-200 dark:border-[#333333] backdrop-blur-xs">
            {chapters[0]?.duration || '29:05'}
          </span>
        </div>

        {/* Story Title */}
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-snug">
          {track.title}
        </h1>

        {/* Metadata line */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-[#242424] text-[#15803d] dark:text-[#1ed760] font-mono text-[11px] font-medium border border-emerald-200 dark:border-[#333333]">
            Audio Full
          </span>
          {getTrackPlayCount(track) > 0 && (
            <span className="text-slate-600 dark:text-[#b3b3b3] font-mono">
              🎧 {formatPlayCount(getTrackPlayCount(track))}
            </span>
          )}
        </div>

        {/* Release Date & Author */}
        <p className="text-xs text-slate-500 dark:text-[#b3b3b3] font-mono flex items-center gap-2">
          <span>{track.created_at ? new Date(track.created_at).toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' }) : '23 tháng 10, 2026'}</span>
          <span>•</span>
          <span className="text-slate-900 dark:text-white font-medium">Tác giả: {track.author || 'Phú Bà Audio'}</span>
        </p>

        {/* Primary and Secondary CTA Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            onClick={handleMainPlayClick}
            className="w-full h-12 bg-[#1ed760] hover:bg-[#1db954] hover:scale-[1.02] active:scale-95 text-black font-bold text-sm sm:text-base px-3 sm:px-4 rounded-full flex items-center justify-center gap-2 shadow-lg shadow-[#1ed760]/20 transition cursor-pointer select-none whitespace-nowrap"
          >
            {isCurrentStoryActive && isPlaying ? (
              <>
                <Pause size={18} className="fill-current text-black shrink-0" />
                <span className="whitespace-nowrap">Tạm dừng</span>
              </>
            ) : (
              <>
                <Play size={18} className="fill-current text-black ml-0.5 shrink-0" />
                <span className="whitespace-nowrap">Nghe ngay</span>
              </>
            )}
          </button>

          <div className="relative">
            <button
              onClick={() => setIsSleepOpen(!isSleepOpen)}
              className={`w-full h-12 px-3 sm:px-4 rounded-full font-medium text-sm sm:text-base flex items-center justify-center gap-2 border transition cursor-pointer select-none whitespace-nowrap ${
                sleepTimerMinutes
                  ? 'bg-[#1db954]/15 dark:bg-[#1db954]/20 text-[#15803d] dark:text-[#1ed760] border-[#1db954]/40'
                  : 'bg-slate-100 hover:bg-slate-200/80 dark:bg-[#242424] dark:hover:bg-[#282828] text-slate-800 dark:text-white border-slate-300 dark:border-[#333333]'
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
              <div className="absolute top-full mt-2 right-0 w-36 bg-white dark:bg-[#282828] border border-slate-200 dark:border-[#3e3e3e] rounded-2xl shadow-xl dark:shadow-2xl py-1 z-30 animate-fade-in">
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
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-[#333333] flex items-center justify-between cursor-pointer ${
                      sleepTimerMinutes === item.val
                        ? 'text-[#16a34a] dark:text-[#1ed760] font-bold'
                        : 'text-slate-700 dark:text-white'
                    }`}
                  >
                    <span>{item.label}</span>
                    {sleepTimerMinutes === item.val && <span className="text-[10px] text-[#16a34a] dark:text-[#1ed760]">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section: Danh sách tập (N) */}
      <div className="space-y-3 pt-1">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          Danh sách tập ({chapters.length})
        </h2>

        <div className="space-y-2">
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
                    ? 'border border-[#1db954] bg-emerald-50/40 dark:bg-[#181818] text-slate-900 dark:text-white shadow-sm dark:shadow-md'
                    : 'border border-slate-200 dark:border-[#282828] bg-white dark:bg-[#181818] hover:bg-slate-50 dark:hover:bg-[#222222] text-slate-600 dark:text-[#b3b3b3]'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span
                    className={`font-black text-base w-5 pt-0.5 shrink-0 ${
                      isThisActive ? 'text-[#16a34a] dark:text-[#1ed760]' : 'text-slate-400 dark:text-[#727272]'
                    }`}
                  >
                    {idx + 1}
                  </span>

                  <div className="min-w-0">
                    <h3
                      className={`text-sm leading-snug truncate ${
                        isThisActive ? 'font-bold text-[#16a34a] dark:text-[#1ed760]' : 'font-semibold text-slate-900 dark:text-white'
                      }`}
                    >
                      {ch.title || track.title}
                    </h3>
                    <span
                      className={`text-xs font-mono block mt-0.5 ${
                        isThisActive ? 'text-[#16a34a]/80 dark:text-[#1ed760]/80' : 'text-slate-500 dark:text-[#727272]'
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
                      <span className="w-1 bg-[#16a34a] dark:bg-[#1ed760] rounded-full animate-wave-1 h-3"></span>
                      <span className="w-1 bg-[#16a34a] dark:bg-[#1ed760] rounded-full animate-wave-2 h-4"></span>
                      <span className="w-1 bg-[#16a34a] dark:bg-[#1ed760] rounded-full animate-wave-3 h-2.5"></span>
                    </div>
                  ) : isThisActive ? (
                    <div className="flex items-end gap-1 h-4">
                      <span className="w-1 bg-[#16a34a] dark:bg-[#1ed760] rounded-full h-2"></span>
                      <span className="w-1 bg-[#16a34a] dark:bg-[#1ed760] rounded-full h-3.5"></span>
                      <span className="w-1 bg-[#16a34a] dark:bg-[#1ed760] rounded-full h-1.5"></span>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section: Giới thiệu truyện audio */}
      <div className="space-y-2 pt-1 p-4 rounded-2xl bg-white dark:bg-[#181818] border border-slate-200 dark:border-[#282828] shadow-xs">
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <span>Giới thiệu truyện audio</span>
          <span className="text-xs text-[#16a34a] dark:text-[#1ed760] font-normal">({track.category || 'Audio'})</span>
        </h2>
        <p className="text-sm text-slate-600 dark:text-[#b3b3b3] leading-relaxed whitespace-pre-line">
          {track.description || 'Nội dung truyện audio đang được cập nhật...'}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-[#727272] pt-2 border-t border-slate-200 dark:border-[#282828] font-medium">
          <span>Tác giả: <strong className="text-slate-900 dark:text-white">{track.author || 'Đang cập nhật'}</strong></span>
          <span>Giọng đọc: <strong className="text-slate-900 dark:text-white">{track.narrator || 'Phú Bà Audio'}</strong></span>
          <span>Thể loại: <strong className="text-[#16a34a] dark:text-[#1ed760]">{track.category || 'Truyện Audio'}</strong></span>
        </div>
      </div>

      {/* Section: Có lẽ bạn sẽ thích (Không bao gồm audio đang phát hoặc trang audio đang mở) */}
      {recommendedTracks.length > 0 && (
        <section className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Có lẽ bạn sẽ thích
            </h2>
            <span className="text-xs text-slate-500 dark:text-[#b3b3b3]">
              {recommendedTracks.length} bộ truyện
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recommendedTracks.map((item) => {
              const epCount = item.chapters?.length || 1;
              const firstDur = item.chapters?.[0]?.duration || '25:00';

              return (
                <div
                  key={item.id}
                  onClick={() => onSelectStory?.(item)}
                  className="group p-3.5 rounded-2xl border border-slate-200 dark:border-[#282828] bg-white dark:bg-[#181818] hover:bg-slate-50 dark:hover:bg-[#222222] hover:border-slate-300 dark:hover:border-[#383838] shadow-xs transition flex items-center gap-3.5 cursor-pointer select-none"
                >
                  {/* Left Emblem */}
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1db954]/20 via-emerald-50 to-slate-100 dark:from-[#1db954]/20 dark:via-[#181818] dark:to-[#121212] border border-slate-200 dark:border-[#282828] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <BrandIcon size={32} />
                  </div>

                  {/* Story Details */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-[#242424] text-[#15803d] dark:text-[#1ed760] text-[10px] font-medium border border-emerald-200 dark:border-[#333333] shrink-0">
                        {item.category || 'Audio'}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-[#b3b3b3] font-mono truncate">
                        {epCount > 1 ? `${epCount} tập` : firstDur}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#16a34a] dark:group-hover:text-[#1ed760] transition truncate">
                      {item.title}
                    </h3>

                    <div className="flex items-center gap-2.5 text-[11px] text-slate-500 dark:text-[#b3b3b3] font-mono">
                      <span className="truncate max-w-[120px] font-sans text-slate-500 dark:text-[#727272]">{item.author || 'Phú Bà Audio'}</span>
                      {getTrackPlayCount(item) > 0 && (
                        <>
                          <span>•</span>
                          <span>🎧 {formatPlayCount(getTrackPlayCount(item))}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right Play Icon */}
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#282828] group-hover:bg-[#1ed760] text-slate-600 dark:text-[#b3b3b3] group-hover:text-black flex items-center justify-center shrink-0 transition">
                    <Play size={14} className="fill-current ml-0.5" />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </article>
  );
});


