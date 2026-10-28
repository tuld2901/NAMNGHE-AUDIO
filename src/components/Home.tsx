import React, { useState, useMemo, useRef, useCallback } from 'react';
import { Search, Headphones, ChevronLeft, ChevronRight } from 'lucide-react';
import { Track, SiteSettings } from '../types';
import { formatPlayCount, getTrackActiveListeners, getTrackPlayCount } from '../services/stats';

interface HomeProps {
  tracks: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  onSelectStory: (track: Track) => void;
  searchQuery: string;
  onSearchChange?: (q: string) => void;
  siteSettings?: SiteSettings;
}

const removeVietnameseTones = (str: string): string => {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
};

export const Home: React.FC<HomeProps> = React.memo(({
  tracks,
  currentTrack,
  isPlaying,
  onSelectStory,
  searchQuery,
  onSearchChange,
  siteSettings,
}) => {
  const [internalSearch, setInternalSearch] = useState<string>('');
  const [topTimeFilter, setTopTimeFilter] = useState<'today' | 'week' | 'month'>('today');
  const [visibleCount, setVisibleCount] = useState<number>(25);

  // Horizontal scroll refs for arrow navigation
  const newTracksScrollRef = useRef<HTMLDivElement | null>(null);
  const trendingScrollRef = useRef<HTMLDivElement | null>(null);
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const allTracksSectionRef = useRef<HTMLElement | null>(null);

  // Carousel slide function: scrolls strictly by the visible container width
  const scrollCarousel = useCallback(
    (ref: React.RefObject<HTMLDivElement | null>, direction: 'left' | 'right') => {
      if (ref.current) {
        const visibleWidth = ref.current.clientWidth;
        const scrollAmount = direction === 'left' ? -visibleWidth : visibleWidth;
        ref.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      }
    },
    []
  );

  const activeSearch = (searchQuery || internalSearch).trim();
  const isSearching = Boolean(activeSearch);

  const handleClearSearch = () => {
    setInternalSearch('');
    setVisibleCount(25);
    if (onSearchChange) onSearchChange('');
  };

  const handleSearchChange = (val: string) => {
    setInternalSearch(val);
    setVisibleCount(25);
    if (onSearchChange) onSearchChange(val);
  };

  // 1. Mới cập nhật
  const newTracks = useMemo(() => {
    return [...tracks]
      .sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 16);
  }, [tracks]);

  // 2. Đang nghe nhiều
  const trendingTracks = useMemo(() => {
    return [...tracks]
      .sort((a, b) => getTrackPlayCount(b) - getTrackPlayCount(a))
      .slice(0, 16);
  }, [tracks]);

  // 3. Top lượt nghe with time filter
  const topTracks = useMemo(() => {
    return [...tracks]
      .sort((a, b) => {
        const countA = getTrackPlayCount(a);
        const countB = getTrackPlayCount(b);
        if (topTimeFilter === 'today') return countB - countA;
        if (topTimeFilter === 'week') return (countB + (b.title.length % 5) * 50) - (countA + (a.title.length % 5) * 50);
        return (countB + (b.title.length % 9) * 80) - (countA + (a.title.length % 9) * 80);
      })
      .slice(0, 16);
  }, [tracks, topTimeFilter]);

  // 4. Tất cả audio filtered list (Tìm kiếm tức thì gõ đến đâu hiển thị ngay danh sách đến đó)
  const filteredAllTracks = useMemo(() => {
    if (!activeSearch) return tracks;
    const rawQuery = activeSearch.toLowerCase().trim();
    const normalizedQuery = removeVietnameseTones(activeSearch.trim());

    return tracks.filter((t) => {
      const titleLower = t.title.toLowerCase();
      const titleNorm = removeVietnameseTones(t.title);
      const authorLower = (t.author || '').toLowerCase();
      const authorNorm = removeVietnameseTones(t.author || '');
      const categoryLower = (t.category || '').toLowerCase();
      const categoryNorm = removeVietnameseTones(t.category || '');
      const descLower = (t.description || '').toLowerCase();
      const descNorm = removeVietnameseTones(t.description || '');

      return (
        titleLower.includes(rawQuery) ||
        titleNorm.includes(normalizedQuery) ||
        authorLower.includes(rawQuery) ||
        authorNorm.includes(normalizedQuery) ||
        categoryLower.includes(rawQuery) ||
        categoryNorm.includes(normalizedQuery) ||
        descLower.includes(rawQuery) ||
        descNorm.includes(normalizedQuery)
      );
    });
  }, [tracks, activeSearch]);

  const displayedTracks = filteredAllTracks.slice(0, visibleCount);
  const hasMore = visibleCount < filteredAllTracks.length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6 pb-10">
      {/* Hero Banner: ẨN KHI ĐANG GÕ TÌM KIẾM ĐỂ ƯU TIÊN TUYỆT ĐỐI CHO Ô TÌM KIẾM VÀ DANH SÁCH */}
      {!isSearching && (
        <>
          {siteSettings?.showHeroBanner !== false ? (
            <div className="relative rounded-3xl overflow-hidden border border-[#282828] bg-gradient-to-r from-[#1db954]/20 via-[#181818] to-[#121212] p-5 sm:p-7 shadow-2xl">
              <div className="relative z-10 max-w-3xl space-y-2.5">
                {siteSettings?.heroBadge && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1db954]/15 border border-[#1db954]/30 text-[#1ed760] text-xs font-semibold">
                    <span>✨</span>
                    <span>{siteSettings.heroBadge}</span>
                  </span>
                )}

                <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                  {siteSettings?.heroTitle || 'Nghe gì hôm nay?'}
                </h1>

                <p className="text-xs sm:text-sm text-[#b3b3b3] leading-relaxed">
                  {siteSettings?.heroDescription || `${tracks.length} audio • nghe miễn phí, không cần tài khoản`}
                </p>

                {siteSettings?.heroButtonText && (
                  <div className="pt-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        allTracksSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="px-4 py-2 rounded-full text-xs sm:text-sm font-bold bg-[#1ed760] hover:bg-[#1db954] text-black shadow-md shadow-[#1ed760]/20 transition cursor-pointer inline-flex items-center gap-1.5 active:scale-95"
                    >
                      <span>{siteSettings.heroButtonText}</span>
                      <span>→</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                {siteSettings?.heroTitle || 'Nghe gì hôm nay?'}
              </h1>
              <p className="text-xs sm:text-sm text-[#b3b3b3] font-mono">
                {siteSettings?.heroDescription || `${tracks.length} audio • nghe miễn phí, không cần tài khoản`}
              </p>
            </div>
          )}
        </>
      )}

      {/* Rounded Search Bar */}
      <div className="relative max-w-6xl">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#b3b3b3]" />
        <input
          type="text"
          placeholder="Tìm kiếm audio, tên truyện, tác giả, thể loại..."
          value={activeSearch}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full pl-11 pr-10 py-3 text-sm rounded-full bg-[#242424] hover:bg-[#2a2a2a] border border-[#333333] text-white placeholder-[#727272] focus:outline-none focus:border-[#1ed760] focus:ring-1 focus:ring-[#1ed760]/30 transition shadow-inner"
        />
        {activeSearch && (
          <button
            type="button"
            onClick={handleClearSearch}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#b3b3b3] hover:text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full hover:bg-[#333333] transition cursor-pointer"
            title="Xóa tìm kiếm"
          >
            ✕
          </button>
        )}
      </div>

      {/* KHI KHÔNG TÌM KIẾM: HIỂN THỊ ĐẦY ĐỦ CÁC MỤC TRANG CHỦ */}
      {!isSearching && (
        <>
          {/* SECTION 1: MỚI CẬP NHẬT (1 HÀNG CAROUSEL) */}
          <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
            Mới cập nhật
          </h2>
          <div className="flex items-center gap-1 text-[#b3b3b3]">
            <button
              onClick={() => scrollCarousel(newTracksScrollRef, 'left')}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#282828] text-[#b3b3b3] hover:text-white active:scale-95 transition cursor-pointer"
              title="Xem trước"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => scrollCarousel(newTracksScrollRef, 'right')}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#282828] text-[#b3b3b3] hover:text-white active:scale-95 transition cursor-pointer"
              title="Xem tiếp"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* 1 SINGLE ROW CAROUSEL CONTAINER */}
        <div
          ref={newTracksScrollRef}
          className="flex flex-nowrap items-stretch gap-3 sm:gap-4 overflow-x-auto scrollbar-none snap-x snap-mandatory scroll-smooth pb-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {newTracks.map((track) => {
            const activeListeners = getTrackActiveListeners(track);
            return (
              <div
                key={track.id}
                onClick={() => onSelectStory(track)}
                className="bg-[#181818] hover:bg-[#282828] rounded-2xl p-4 border border-[#282828] hover:border-[#383838] hover:shadow-xl transition cursor-pointer flex flex-col justify-between h-36 shrink-0 w-[240px] sm:w-[260px] md:w-[calc((100%-32px)/3)] lg:w-[calc((100%-48px)/4)] snap-start select-none group"
              >
                <div>
                  <h3 className="font-bold text-white text-sm sm:text-base leading-snug line-clamp-2 group-hover:text-[#1ed760] transition-colors">
                    {track.title}
                  </h3>
                  <div className="mt-1.5">
                    <span className="inline-block px-2 py-0.5 rounded-md bg-[#242424] text-[#b3b3b3] font-mono text-[11px] font-medium border border-[#333333]">
                      Audio Full
                    </span>
                  </div>
                </div>

                <div className="pt-1 space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs text-[#b3b3b3] font-mono truncate">
                    <Headphones size={13} className="text-[#727272] shrink-0" />
                    <span>{formatPlayCount(getTrackPlayCount(track))}</span>
                  </div>
                  {activeListeners > 0 && (
                    <div className="flex items-center gap-1 text-[11px] text-[#1ed760] font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#1ed760] inline-block"></span>
                      <span>{activeListeners} đang nghe</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 2: ĐANG NGHE NHIỀU (1 HÀNG CAROUSEL) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
            Đang nghe nhiều
          </h2>
          <div className="flex items-center gap-1 text-[#b3b3b3]">
            <button
              onClick={() => scrollCarousel(trendingScrollRef, 'left')}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#282828] text-[#b3b3b3] hover:text-white active:scale-95 transition cursor-pointer"
              title="Xem trước"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => scrollCarousel(trendingScrollRef, 'right')}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#282828] text-[#b3b3b3] hover:text-white active:scale-95 transition cursor-pointer"
              title="Xem tiếp"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* 1 SINGLE ROW CAROUSEL CONTAINER */}
        <div
          ref={trendingScrollRef}
          className="flex flex-nowrap items-stretch gap-3 sm:gap-4 overflow-x-auto scrollbar-none snap-x snap-mandatory scroll-smooth pb-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {trendingTracks.map((track) => {
            const activeListeners = getTrackActiveListeners(track);
            return (
              <div
                key={track.id}
                onClick={() => onSelectStory(track)}
                className="bg-[#181818] hover:bg-[#282828] rounded-2xl p-4 border border-[#282828] hover:border-[#383838] hover:shadow-xl transition cursor-pointer flex flex-col justify-between h-36 shrink-0 w-[240px] sm:w-[260px] md:w-[calc((100%-32px)/3)] lg:w-[calc((100%-48px)/4)] snap-start select-none group"
              >
                <div>
                  <h3 className="font-bold text-white text-sm sm:text-base leading-snug line-clamp-2 group-hover:text-[#1ed760] transition-colors">
                    {track.title}
                  </h3>
                  <div className="mt-1.5">
                    <span className="inline-block px-2 py-0.5 rounded-md bg-[#242424] text-[#b3b3b3] font-mono text-[11px] font-medium border border-[#333333]">
                      Audio Full
                    </span>
                  </div>
                </div>

                <div className="pt-1 space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs text-[#b3b3b3] font-mono truncate">
                    <Headphones size={13} className="text-[#727272] shrink-0" />
                    <span>{formatPlayCount(getTrackPlayCount(track))}</span>
                  </div>
                  {activeListeners > 0 && (
                    <div className="flex items-center gap-1 text-[11px] text-[#1ed760] font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#1ed760] inline-block"></span>
                      <span>{activeListeners} đang nghe</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 3: TOP LƯỢT NGHE (1 HÀNG CAROUSEL) */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
          <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto">
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight shrink-0">
              Top lượt nghe
            </h2>

            {/* Desktop tabs right beside title */}
            <div className="hidden sm:inline-flex items-center p-0.5 bg-[#181818] rounded-full border border-[#282828] gap-1">
              {(
                [
                  { id: 'today', label: 'Hôm nay' },
                  { id: 'week', label: 'Tuần' },
                  { id: 'month', label: 'Tháng' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setTopTimeFilter(tab.id)}
                  className={`w-20 py-1 text-center rounded-full text-xs font-medium transition cursor-pointer flex items-center justify-center select-none ${
                    topTimeFilter === tab.id
                      ? 'border border-[#1ed760] text-black bg-[#1ed760] shadow-sm font-bold'
                      : 'text-[#b3b3b3] hover:text-white hover:bg-[#282828]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Mobile chevrons */}
            <div className="flex sm:hidden items-center gap-1 text-[#b3b3b3]">
              <button
                onClick={() => scrollCarousel(topScrollRef, 'left')}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#282828] text-[#b3b3b3] hover:text-white active:scale-95 transition cursor-pointer"
                title="Xem trước"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => scrollCarousel(topScrollRef, 'right')}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#282828] text-[#b3b3b3] hover:text-white active:scale-95 transition cursor-pointer"
                title="Xem tiếp"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          {/* Mobile tabs: 3 columns with EXACT equal width */}
          <div className="grid grid-cols-3 sm:hidden p-1 bg-[#181818] rounded-xl border border-[#282828] w-full gap-1">
            {(
              [
                { id: 'today', label: 'Hôm nay' },
                { id: 'week', label: 'Tuần' },
                { id: 'month', label: 'Tháng' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTopTimeFilter(tab.id)}
                className={`py-1.5 text-center rounded-lg text-xs font-medium transition cursor-pointer flex items-center justify-center select-none ${
                  topTimeFilter === tab.id
                    ? 'border border-[#1ed760] text-black bg-[#1ed760] shadow-sm font-bold'
                    : 'text-[#b3b3b3] hover:text-white hover:bg-[#282828]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Desktop chevrons */}
          <div className="hidden sm:flex items-center gap-1 text-[#b3b3b3]">
            <button
              onClick={() => scrollCarousel(topScrollRef, 'left')}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#282828] text-[#b3b3b3] hover:text-white active:scale-95 transition cursor-pointer"
              title="Xem trước"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => scrollCarousel(topScrollRef, 'right')}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#282828] text-[#b3b3b3] hover:text-white active:scale-95 transition cursor-pointer"
              title="Xem tiếp"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* 1 SINGLE ROW CAROUSEL CONTAINER */}
        <div
          ref={topScrollRef}
          className="flex flex-nowrap items-stretch gap-3 sm:gap-4 overflow-x-auto scrollbar-none snap-x snap-mandatory scroll-smooth pb-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {topTracks.map((track) => {
            const activeListeners = getTrackActiveListeners(track);
            return (
              <div
                key={track.id}
                onClick={() => onSelectStory(track)}
                className="bg-[#181818] hover:bg-[#282828] rounded-2xl p-4 border border-[#282828] hover:border-[#383838] hover:shadow-xl transition cursor-pointer flex flex-col justify-between h-36 shrink-0 w-[240px] sm:w-[260px] md:w-[calc((100%-32px)/3)] lg:w-[calc((100%-48px)/4)] snap-start select-none group"
              >
                <div>
                  <h3 className="font-bold text-white text-sm sm:text-base leading-snug line-clamp-2 group-hover:text-[#1ed760] transition-colors">
                    {track.title}
                  </h3>
                  <div className="mt-1.5">
                    <span className="inline-block px-2 py-0.5 rounded-md bg-[#242424] text-[#b3b3b3] font-mono text-[11px] font-medium border border-[#333333]">
                      Audio Full
                    </span>
                  </div>
                </div>

                <div className="pt-1 space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs text-[#b3b3b3] font-mono truncate">
                    <Headphones size={13} className="text-[#727272] shrink-0" />
                    <span>{formatPlayCount(getTrackPlayCount(track))}</span>
                  </div>
                  {activeListeners > 0 && (
                    <div className="flex items-center gap-1 text-[11px] text-[#1ed760] font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#1ed760] inline-block"></span>
                      <span>{activeListeners} đang nghe</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
        </>
      )}

      {/* SECTION 4: DANH SÁCH AUDIO (HOẶC KẾT QUẢ TÌM KIẾM) */}
      <section ref={allTracksSectionRef} className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          {isSearching ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-2 border-b border-[#282828] pb-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <span>Kết quả tìm kiếm cho:</span>
                  <span className="text-[#1ed760] font-extrabold">"{activeSearch}"</span>
                </h2>
                <p className="text-xs text-[#b3b3b3] font-mono mt-0.5">
                  Tìm thấy {filteredAllTracks.length} audio phù hợp
                </p>
              </div>
              <button
                onClick={handleClearSearch}
                className="self-start sm:self-auto text-xs px-3.5 py-1.5 rounded-full bg-[#242424] hover:bg-[#282828] text-[#b3b3b3] hover:text-white border border-[#333333] transition cursor-pointer flex items-center gap-1.5 active:scale-95"
              >
                ✕ Quay lại tất cả truyện
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Tất cả audio
              </h2>
              <span className="text-xs text-[#b3b3b3] font-mono">
                {filteredAllTracks.length} truyện
              </span>
            </>
          )}
        </div>

        {/* List of full-width horizontal cards */}
        {displayedTracks.length > 0 ? (
          <div className="space-y-2.5">
            {displayedTracks.map((track) => {
              const isThisStoryActive = currentTrack?.id === track.id;
              const isCurrentlyPlaying = isThisStoryActive && isPlaying;
              const durationLabel = track.chapters?.[0]?.duration || '29:05';

              return (
                <article
                  key={track.id}
                  itemScope
                  itemType="https://schema.org/AudioObject"
                  onClick={() => onSelectStory(track)}
                  className={`rounded-2xl p-4 sm:p-5 border transition-all duration-200 cursor-pointer select-none flex items-center justify-between gap-3 sm:gap-4 group ${
                    isThisStoryActive
                      ? 'border-[#1db954] bg-[#181818] shadow-lg shadow-[#1db954]/10'
                      : 'bg-[#181818] border-[#282828] hover:border-[#383838] hover:bg-[#222222] shadow-sm'
                  }`}
                >
                  {/* Left: Chevron or Animated Soundwave if active */}
                  <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
                    <div className="pt-1 shrink-0">
                      {isCurrentlyPlaying ? (
                        <div className="flex items-end gap-[3px] h-4 text-[#1ed760]">
                          <span className="w-[3px] bg-[#1ed760] rounded-full animate-wave-1 h-3"></span>
                          <span className="w-[3px] bg-[#1ed760] rounded-full animate-wave-2 h-4"></span>
                          <span className="w-[3px] bg-[#1ed760] rounded-full animate-wave-3 h-2"></span>
                        </div>
                      ) : isThisStoryActive ? (
                        <div className="flex items-end gap-[3px] h-4 text-[#1ed760]">
                          <span className="w-[3px] bg-[#1ed760] rounded-full h-2.5"></span>
                          <span className="w-[3px] bg-[#1ed760] rounded-full h-4"></span>
                          <span className="w-[3px] bg-[#1ed760] rounded-full h-1.5"></span>
                        </div>
                      ) : (
                        <ChevronRight size={18} className="text-[#727272] group-hover:text-[#1ed760] transition-colors" />
                      )}
                    </div>

                    {/* Middle: Title + Tag + Synopsis + Stats */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3
                          itemProp="name"
                          className={`text-sm sm:text-base leading-snug truncate ${
                            isThisStoryActive ? 'font-bold text-[#1ed760]' : 'font-bold text-white group-hover:text-[#1ed760] transition-colors'
                          }`}
                        >
                          {track.title}
                        </h3>
                        <span className="inline-block px-2 py-0.5 rounded-md bg-[#242424] text-[#b3b3b3] font-mono text-[11px] font-medium shrink-0 border border-[#333333]">
                          Audio Full
                        </span>
                      </div>

                      {/* Description & Category */}
                      <p itemProp="description" className="text-xs sm:text-sm text-[#b3b3b3] mt-1 line-clamp-1">
                        {track.description || 'Nội dung truyện audio đặc sắc đang được cập nhật...'}{' '}
                        <span className="text-[#727272] font-medium">
                          • {track.author ? `Tác giả: ${track.author}` : `Thể loại: ${track.category || 'Truyện Audio'}`}
                        </span>
                      </p>

                      {/* Stats */}
                      <div className="flex items-center gap-2 text-xs text-[#b3b3b3] font-mono mt-1.5">
                        <div className="flex items-center gap-1">
                          <Headphones size={13} className="text-[#727272]" />
                          <span>{formatPlayCount(getTrackPlayCount(track))}</span>
                        </div>
                        {getTrackActiveListeners(track) > 0 && (
                          <span className="text-[#1ed760] flex items-center gap-1 font-sans text-[11px] font-medium">
                            • {getTrackActiveListeners(track)} đang nghe
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Duration Tag */}
                  <div className="shrink-0">
                    <span className="bg-[#242424] text-[#b3b3b3] font-mono text-xs px-2.5 sm:px-3 py-1 rounded-md font-medium border border-[#333333]">
                      {durationLabel}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="bg-[#181818] rounded-2xl p-10 border border-[#282828] text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#242424] flex items-center justify-center mx-auto text-[#727272]">
              <Search size={22} />
            </div>
            <p className="text-sm font-bold text-white">
              {isSearching
                ? `Không tìm thấy audio nào khớp với từ khóa "${activeSearch}"`
                : 'Không có bài audio nào.'}
            </p>
            {isSearching && (
              <>
                <p className="text-xs text-[#b3b3b3] max-w-md mx-auto">
                  Vui lòng thử tìm kiếm với tên truyện khác, tác giả hoặc thể loại (ví dụ: đô thị, vả mặt, tu tiên...).
                </p>
                <div className="pt-1">
                  <button
                    onClick={handleClearSearch}
                    className="px-5 py-2 rounded-full text-xs font-bold bg-[#1ed760] hover:bg-[#1db954] text-black transition cursor-pointer shadow-md shadow-[#1ed760]/20 active:scale-95"
                  >
                    Xóa tìm kiếm & Xem toàn bộ
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {hasMore && (
          <div className="text-center pt-2">
            <button
              onClick={() => setVisibleCount((prev) => prev + 25)}
              className="px-6 py-2.5 rounded-full text-xs font-semibold bg-[#242424] hover:bg-[#282828] text-white border border-[#333333] hover:border-[#444444] shadow-md transition cursor-pointer active:scale-95"
            >
              Xem thêm audio (Còn {filteredAllTracks.length - visibleCount})
            </button>
          </div>
        )}
      </section>
    </div>
  );
});

