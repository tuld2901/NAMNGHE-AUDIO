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

export const Home: React.FC<HomeProps> = ({
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
    if (onSearchChange) onSearchChange('');
  };

  const handleSearchChange = (val: string) => {
    setInternalSearch(val);
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

  // 4. Tất cả audio filtered list
  const filteredAllTracks = useMemo(() => {
    return tracks.filter((t) => {
      const matchSearch =
        !activeSearch ||
        t.title.toLowerCase().includes(activeSearch.toLowerCase()) ||
        t.author.toLowerCase().includes(activeSearch.toLowerCase()) ||
        t.category.toLowerCase().includes(activeSearch.toLowerCase()) ||
        (t.description && t.description.toLowerCase().includes(activeSearch.toLowerCase()));
      return matchSearch;
    });
  }, [tracks, activeSearch]);

  const displayedTracks = filteredAllTracks.slice(0, visibleCount);
  const hasMore = visibleCount < filteredAllTracks.length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-7 pb-10">
      {/* Hero Banner / Website Header Configured from Admin Server Settings */}
      {siteSettings?.showHeroBanner !== false ? (
        <div className="relative rounded-3xl overflow-hidden border border-amber-500/25 bg-gradient-to-r from-amber-950/40 via-[#111827] to-[#0d1322] p-5 sm:p-7 shadow-xl">
          {siteSettings?.heroBannerImage && (
            <div className="absolute inset-0 z-0">
              <img
                src={siteSettings.heroBannerImage}
                alt={siteSettings.heroTitle || 'Banner'}
                className="w-full h-full object-cover opacity-30"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#0b0f17]/90 via-[#0b0f17]/75 to-[#0b0f17]/50" />
            </div>
          )}

          <div className="relative z-10 max-w-3xl space-y-2.5">
            {siteSettings?.heroBadge && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold">
                <span>✨</span>
                <span>{siteSettings.heroBadge}</span>
              </span>
            )}

            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
              {siteSettings?.heroTitle || 'Nghe gì hôm nay?'}
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {siteSettings?.heroDescription || `${tracks.length} audio • nghe miễn phí, không cần tài khoản`}
            </p>

            {siteSettings?.heroButtonText && (
              <div className="pt-1.5">
                <button
                  type="button"
                  onClick={() => {
                    allTracksSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 shadow-md shadow-amber-500/20 transition cursor-pointer inline-flex items-center gap-1.5"
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
          <p className="text-xs sm:text-sm text-slate-400 font-mono">
            {siteSettings?.heroDescription || `${tracks.length} audio • nghe miễn phí, không cần tài khoản`}
          </p>
        </div>
      )}

      {/* Rounded Search Bar */}
      <div className="relative max-w-6xl">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Tìm kiếm audio, tên truyện, tác giả, thể loại..."
          value={activeSearch}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full pl-11 pr-10 py-3 text-sm rounded-2xl bg-[#101726]/90 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400/80 focus:ring-1 focus:ring-amber-400/20 transition shadow-inner"
        />
        {activeSearch && (
          <button
            onClick={handleClearSearch}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-800 transition cursor-pointer"
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
          <div className="flex items-center gap-1 text-slate-400">
            <button
              onClick={() => scrollCarousel(newTracksScrollRef, 'left')}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white active:scale-95 transition cursor-pointer"
              title="Xem trước"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => scrollCarousel(newTracksScrollRef, 'right')}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white active:scale-95 transition cursor-pointer"
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
                className="bg-gradient-to-b from-[#131b2e] to-[#0d1322] rounded-2xl p-4 border border-slate-800/90 hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/5 transition cursor-pointer flex flex-col justify-between h-36 shrink-0 w-[240px] sm:w-[260px] md:w-[calc((100%-32px)/3)] lg:w-[calc((100%-48px)/4)] snap-start select-none group"
              >
                <div>
                  <h3 className="font-bold text-slate-100 text-sm sm:text-base leading-snug line-clamp-2 group-hover:text-amber-400 transition-colors">
                    {track.title}
                  </h3>
                  <div className="mt-1.5">
                    <span className="inline-block px-2 py-0.5 rounded-md bg-slate-800/90 text-amber-400/90 font-mono text-[11px] font-medium border border-slate-700/60">
                      Audio Full
                    </span>
                  </div>
                </div>

                <div className="pt-1 space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono truncate">
                    <Headphones size={13} className="text-slate-500 shrink-0" />
                    <span>{formatPlayCount(getTrackPlayCount(track))}</span>
                  </div>
                  {activeListeners > 0 && (
                    <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
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
          <div className="flex items-center gap-1 text-slate-400">
            <button
              onClick={() => scrollCarousel(trendingScrollRef, 'left')}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white active:scale-95 transition cursor-pointer"
              title="Xem trước"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => scrollCarousel(trendingScrollRef, 'right')}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white active:scale-95 transition cursor-pointer"
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
                className="bg-gradient-to-b from-[#131b2e] to-[#0d1322] rounded-2xl p-4 border border-slate-800/90 hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/5 transition cursor-pointer flex flex-col justify-between h-36 shrink-0 w-[240px] sm:w-[260px] md:w-[calc((100%-32px)/3)] lg:w-[calc((100%-48px)/4)] snap-start select-none group"
              >
                <div>
                  <h3 className="font-bold text-slate-100 text-sm sm:text-base leading-snug line-clamp-2 group-hover:text-amber-400 transition-colors">
                    {track.title}
                  </h3>
                  <div className="mt-1.5">
                    <span className="inline-block px-2 py-0.5 rounded-md bg-slate-800/90 text-amber-400/90 font-mono text-[11px] font-medium border border-slate-700/60">
                      Audio Full
                    </span>
                  </div>
                </div>

                <div className="pt-1 space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono truncate">
                    <Headphones size={13} className="text-slate-500 shrink-0" />
                    <span>{formatPlayCount(getTrackPlayCount(track))}</span>
                  </div>
                  {activeListeners > 0 && (
                    <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Top lượt nghe
            </h2>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setTopTimeFilter('today')}
                className={`px-3 py-1 rounded-full text-xs transition cursor-pointer ${
                  topTimeFilter === 'today'
                    ? 'border border-amber-400 text-slate-950 bg-amber-400 shadow-md shadow-amber-500/20 font-bold'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-700/60 font-medium'
                }`}
              >
                Hôm nay
              </button>
              <button
                onClick={() => setTopTimeFilter('week')}
                className={`px-3 py-1 rounded-full text-xs transition cursor-pointer ${
                  topTimeFilter === 'week'
                    ? 'border border-amber-400 text-slate-950 bg-amber-400 shadow-md shadow-amber-500/20 font-bold'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-700/60 font-medium'
                }`}
              >
                Tuần
              </button>
              <button
                onClick={() => setTopTimeFilter('month')}
                className={`px-3 py-1 rounded-full text-xs transition cursor-pointer ${
                  topTimeFilter === 'month'
                    ? 'border border-amber-400 text-slate-950 bg-amber-400 shadow-md shadow-amber-500/20 font-bold'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-700/60 font-medium'
                }`}
              >
                Tháng
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1 text-slate-400">
            <button
              onClick={() => scrollCarousel(topScrollRef, 'left')}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white active:scale-95 transition cursor-pointer"
              title="Xem trước"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => scrollCarousel(topScrollRef, 'right')}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white active:scale-95 transition cursor-pointer"
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
                className="bg-gradient-to-b from-[#131b2e] to-[#0d1322] rounded-2xl p-4 border border-slate-800/90 hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/5 transition cursor-pointer flex flex-col justify-between h-36 shrink-0 w-[240px] sm:w-[260px] md:w-[calc((100%-32px)/3)] lg:w-[calc((100%-48px)/4)] snap-start select-none group"
              >
                <div>
                  <h3 className="font-bold text-slate-100 text-sm sm:text-base leading-snug line-clamp-2 group-hover:text-amber-400 transition-colors">
                    {track.title}
                  </h3>
                  <div className="mt-1.5">
                    <span className="inline-block px-2 py-0.5 rounded-md bg-slate-800/90 text-amber-400/90 font-mono text-[11px] font-medium border border-slate-700/60">
                      Audio Full
                    </span>
                  </div>
                </div>

                <div className="pt-1 space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono truncate">
                    <Headphones size={13} className="text-slate-500 shrink-0" />
                    <span>{formatPlayCount(getTrackPlayCount(track))}</span>
                  </div>
                  {activeListeners > 0 && (
                    <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-2 border-b border-slate-800/80 pb-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <span>Kết quả tìm kiếm cho:</span>
                  <span className="text-amber-400 font-extrabold">"{activeSearch}"</span>
                </h2>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Tìm thấy {filteredAllTracks.length} audio phù hợp
                </p>
              </div>
              <button
                onClick={handleClearSearch}
                className="self-start sm:self-auto text-xs px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer flex items-center gap-1.5"
              >
                ✕ Quay lại tất cả truyện
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Tất cả audio
              </h2>
              <span className="text-xs text-slate-400 font-mono">
                {filteredAllTracks.length} truyện
              </span>
            </>
          )}
        </div>

        {/* List of full-width horizontal cards */}
        {displayedTracks.length > 0 ? (
          <div className="space-y-3">
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
                  className={`rounded-2xl p-4 sm:p-5 border transition cursor-pointer select-none flex items-center justify-between gap-3 sm:gap-4 group ${
                    isThisStoryActive
                      ? 'border-amber-500/80 bg-gradient-to-r from-amber-950/30 via-[#162136] to-[#101726] shadow-lg shadow-amber-500/10'
                      : 'bg-[#101726]/90 border-slate-800/90 hover:border-amber-500/40 hover:bg-[#141d30] shadow-sm'
                  }`}
                >
                  {/* Left: Chevron or Animated Soundwave if active */}
                  <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
                    <div className="pt-1 shrink-0">
                      {isCurrentlyPlaying ? (
                        <div className="flex items-end gap-[3px] h-4 text-amber-400">
                          <span className="w-[3px] bg-amber-400 rounded-full animate-wave-1 h-3"></span>
                          <span className="w-[3px] bg-amber-400 rounded-full animate-wave-2 h-4"></span>
                          <span className="w-[3px] bg-amber-400 rounded-full animate-wave-3 h-2"></span>
                        </div>
                      ) : isThisStoryActive ? (
                        <div className="flex items-end gap-[3px] h-4 text-amber-400">
                          <span className="w-[3px] bg-amber-400 rounded-full h-2.5"></span>
                          <span className="w-[3px] bg-amber-400 rounded-full h-4"></span>
                          <span className="w-[3px] bg-amber-400 rounded-full h-1.5"></span>
                        </div>
                      ) : (
                        <ChevronRight size={18} className="text-slate-500 group-hover:text-amber-400 transition-colors" />
                      )}
                    </div>

                    {/* Middle: Title + Tag + Synopsis + Stats */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3
                          itemProp="name"
                          className={`text-sm sm:text-base leading-snug truncate ${
                            isThisStoryActive ? 'font-bold text-amber-400' : 'font-bold text-slate-100 group-hover:text-amber-400 transition-colors'
                          }`}
                        >
                          {track.title}
                        </h3>
                        <span className="inline-block px-2 py-0.5 rounded-md bg-slate-800/90 text-amber-400/90 font-mono text-[11px] font-medium shrink-0 border border-slate-700/60">
                          Audio Full
                        </span>
                      </div>

                      {/* Description & Category */}
                      <p itemProp="description" className="text-xs sm:text-sm text-slate-400 mt-1 line-clamp-1">
                        {track.description || 'Nội dung truyện audio đặc sắc đang được cập nhật...'}{' '}
                        <span className="text-slate-500 font-medium">
                          • {track.author ? `Tác giả: ${track.author}` : `Thể loại: ${track.category || 'Truyện Audio'}`}
                        </span>
                      </p>

                      {/* Stats */}
                      <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-1.5">
                        <div className="flex items-center gap-1">
                          <Headphones size={13} className="text-slate-500" />
                          <span>{formatPlayCount(getTrackPlayCount(track))}</span>
                        </div>
                        {getTrackActiveListeners(track) > 0 && (
                          <span className="text-emerald-400 flex items-center gap-1 font-sans text-[11px] font-medium">
                            • {getTrackActiveListeners(track)} đang nghe
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Duration Tag */}
                  <div className="shrink-0">
                    <span className="bg-slate-800/90 text-slate-300 font-mono text-xs px-2.5 sm:px-3 py-1 rounded-md font-medium border border-slate-700/60">
                      {durationLabel}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="bg-[#101726] rounded-2xl p-10 border border-slate-800 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-800/80 flex items-center justify-center mx-auto text-slate-400">
              <Search size={22} />
            </div>
            <p className="text-sm font-bold text-slate-200">
              {isSearching
                ? `Không tìm thấy audio nào khớp với từ khóa "${activeSearch}"`
                : 'Không có bài audio nào.'}
            </p>
            {isSearching && (
              <>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Vui lòng thử tìm kiếm với tên truyện khác, tác giả hoặc thể loại (ví dụ: đô thị, vả mặt, tu tiên...).
                </p>
                <div className="pt-1">
                  <button
                    onClick={handleClearSearch}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 transition cursor-pointer shadow-md shadow-amber-500/20"
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
              className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 shadow-md transition cursor-pointer"
            >
              Xem thêm audio (Còn {filteredAllTracks.length - visibleCount})
            </button>
          </div>
        )}
      </section>
    </div>
  );
};
