import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { Track, Chapter, SiteSettings } from './types';
import { 
  fetchTracks, 
  fetchBootstrapData,
  getLocalTracks,
  isDailyUnlockedToday, 
  getSiteSettings,
  updateFavicon,
  recordClientVisit
} from './services/api';
import { getStoryPath, findTrackBySlugOrId, updateSEOMetadata } from './services/seo';
import { Navbar } from './components/Navbar';
import { Home } from './components/Home';
import { StoryPage } from './components/StoryPage';
import { Player } from './components/Player';
import { LockScreenModal } from './components/LockScreenModal';
import {
  StaticPageView,
  STATIC_PAGES_CONFIG,
  getStaticPageByPath,
  StaticPageSlug,
} from './components/StaticPageView';
import { AudioProvider, useAudio } from './context/AudioContext';

const Admin = React.lazy(() =>
  import('./components/Admin').then((module) => ({ default: module.Admin }))
);

function AppContent({
  tracks,
  loadTracksData,
  siteSettings,
  setSiteSettings,
}: {
  tracks: Track[];
  loadTracksData: () => Promise<void>;
  siteSettings: SiteSettings;
  setSiteSettings: React.Dispatch<React.SetStateAction<SiteSettings>>;
}) {
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeStoryParam, setActiveStoryParam] = useState<string | null>(null);
  const [selectedStoryTrack, setSelectedStoryTrack] = useState<Track | null>(null);

  // Audio Context
  const {
    currentTrack,
    isPlaying,
    playTrackChapter,
  } = useAudio();

  // Apply custom Header and Body tracking code (Google Analytics, Meta Pixel, etc.)
  useEffect(() => {
    import('./services/api').then(({ applyTrackingScripts }) => {
      applyTrackingScripts(siteSettings.headerCode, siteSettings.bodyCode);
    });
  }, [siteSettings.headerCode, siteSettings.bodyCode]);

  // Đồng bộ cấu hình website & thương hiệu vào popup chặn trình duyệt mạng xã hội
  useEffect(() => {
    try {
      (window as any).__SITE_SETTINGS__ = siteSettings;
      localStorage.setItem('site_settings_cache', JSON.stringify(siteSettings));
      if (typeof (window as any).refreshCustomBlockerUI === 'function') {
        (window as any).refreshCustomBlockerUI(siteSettings);
      }
    } catch (e) {}
  }, [siteSettings]);

  // Lock Screen Modal State
  const [isLockModalOpen, setIsLockModalOpen] = useState<boolean>(false);
  const [pendingTrack, setPendingTrack] = useState<Track | null>(null);
  const [pendingChapter, setPendingChapter] = useState<Chapter | null>(null);

  // Sync clean pathname routes (/ten-truyen, /admin) and auto-convert legacy #/... links
  useEffect(() => {
    const syncRouteFromLocation = () => {
      let pathname = window.location.pathname || '/';
      const hash = window.location.hash || '';

      // Automatically migrate any old hash URL (#/truyen/..., #/admin, #/ten-truyen) to clean pathname without #
      if (hash.startsWith('#')) {
        const cleanFromHash = hash
          .replace(/^#\/?/, '')
          .replace(/^(truyen|story)\//, '')
          .trim();
        const targetPath = cleanFromHash ? `/${cleanFromHash}` : '/';
        window.history.replaceState({}, '', targetPath);
        pathname = targetPath;
      }

      // Normalize legacy /truyen/slug or /story/slug to /slug
      if (pathname.startsWith('/truyen/') || pathname.startsWith('/story/')) {
        const cleanSlug = pathname.replace(/^\/(truyen|story)\//, '').replace(/\/+$/, '').trim();
        const normalizedPath = cleanSlug ? `/${cleanSlug}` : '/';
        window.history.replaceState({}, '', normalizedPath);
        pathname = normalizedPath;
      }

      // Ẩn hoàn toàn đường dẫn quản trị cũ: Nếu ai cố tình vào /admin hoặc /quan-tri -> tự động chuyển về trang chủ /
      const rawSegment = pathname.replace(/^\/+/, '').replace(/\/+$/, '').trim().toLowerCase();
      if (rawSegment === 'admin' || rawSegment === 'quan-tri' || rawSegment === 'system-secret-admin') {
        window.history.replaceState({}, '', '/');
        pathname = '/';
      }

      setCurrentPath(pathname);

      // Ghi nhận traffic đo lường khách truy cập (trừ trang quản trị /app-config)
      if (!pathname.includes('app-config')) {
        recordClientVisit(pathname, document.referrer, window.innerWidth);
      }

      const cleanSegment = pathname.replace(/^\/+/, '').replace(/\/+$/, '').trim();
      const lowerSegment = cleanSegment.toLowerCase();
      const matchedStatic = getStaticPageByPath(lowerSegment);

      if (
        !cleanSegment ||
        lowerSegment === 'index.html' ||
        lowerSegment === 'app-config' ||
        matchedStatic
      ) {
        setActiveStoryParam(null);
        if (!cleanSegment || lowerSegment === 'index.html' || matchedStatic) {
          setSelectedStoryTrack(null);
        }
      } else {
        setActiveStoryParam(cleanSegment);
      }
    };

    syncRouteFromLocation();
    window.addEventListener('popstate', syncRouteFromLocation);
    window.addEventListener('hashchange', syncRouteFromLocation);
    return () => {
      window.removeEventListener('popstate', syncRouteFromLocation);
      window.removeEventListener('hashchange', syncRouteFromLocation);
    };
  }, []);

  // Determine current view - CHỈ áp dụng cho đường dẫn /app-config để bảo mật tuyệt đối
  const normalizedPath = currentPath.replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase();
  const isAdminView = normalizedPath === 'app-config';
  const activeStaticPage = useMemo(() => getStaticPageByPath(normalizedPath), [normalizedPath]);

  // Find active track using selected track or clean SEO slug/ID (/ten-truyen)
  const currentViewingStory = useMemo(() => {
    if (activeStaticPage) return null;
    if (selectedStoryTrack) {
      return tracks.find((t) => t.id === selectedStoryTrack.id) || selectedStoryTrack;
    }
    if (!activeStoryParam) return null;
    return findTrackBySlugOrId(tracks, activeStoryParam);
  }, [selectedStoryTrack, activeStoryParam, tracks, activeStaticPage]);

  // Keep canonical URL clean (/ten-truyen) when story is resolved from slug--id or id
  useEffect(() => {
    if (currentViewingStory && !isAdminView && !activeStaticPage) {
      const canonicalStoryPath = getStoryPath(currentViewingStory);
      if (window.location.pathname !== canonicalStoryPath) {
        window.history.replaceState({}, '', canonicalStoryPath);
        setCurrentPath(canonicalStoryPath);
      }
    }
  }, [currentViewingStory, isAdminView, activeStaticPage]);

  const isStoryPageView = Boolean(currentViewingStory && !isAdminView && !activeStaticPage);

  // Dynamic SEO metadata update for Google (Title, Description, OpenGraph, JSON-LD)
  useEffect(() => {
    if (!isAdminView) {
      if (activeStaticPage) {
        document.title = `${activeStaticPage.title} - ${siteSettings.siteName || 'Gối Ôm Audio'}`;
      } else {
        updateSEOMetadata(currentViewingStory, siteSettings);
      }
    }
  }, [currentViewingStory, siteSettings, isAdminView, activeStaticPage]);

  // Navigate helpers using HTML5 History API (no # in URL)
  const handleNavigateToStory = useCallback((track: Track) => {
    const path = getStoryPath(track);
    setSelectedStoryTrack(track);
    setActiveStoryParam(path.replace(/^\/+/, ''));
    setCurrentPath(path);
    window.history.pushState({}, '', path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleNavigateToStaticPage = useCallback((slug: StaticPageSlug) => {
    const path = `/${slug}`;
    setSelectedStoryTrack(null);
    setActiveStoryParam(null);
    setCurrentPath(path);
    window.history.pushState({}, '', path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleBackToHome = useCallback(() => {
    setSelectedStoryTrack(null);
    setActiveStoryParam(null);
    setCurrentPath('/');
    window.history.pushState({}, '', '/');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleNavigateToAdmin = useCallback(() => {
    setSelectedStoryTrack(null);
    setActiveStoryParam(null);
    setCurrentPath('/app-config');
    window.history.pushState({}, '', '/app-config');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Secret admin shortcut: Ctrl + Shift + A (or Cmd + Shift + A)
  useEffect(() => {
    const handleAdminKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        if (isAdminView) {
          handleBackToHome();
        } else {
          handleNavigateToAdmin();
        }
      }
    };
    window.addEventListener('keydown', handleAdminKey);
    return () => window.removeEventListener('keydown', handleAdminKey);
  }, [isAdminView, handleBackToHome, handleNavigateToAdmin]);

  // Handle playing with daily unlock gate
  const handleSelectOrPlayChapter = useCallback(
    (track: Track, chapter: Chapter) => {
      const isUnlocked = isDailyUnlockedToday();
      if (!isUnlocked) {
        setPendingTrack(track);
        setPendingChapter(chapter);
        setIsLockModalOpen(true);
      } else {
        playTrackChapter(track, chapter);
      }
    },
    [playTrackChapter]
  );

  const handleUnlockSuccess = useCallback(
    (track: Track, chapter: Chapter) => {
      playTrackChapter(track, chapter);
    },
    [playTrackChapter]
  );

  const handleOpenSupportModal = useCallback(() => {
    if (tracks.length > 0) {
      setPendingTrack(tracks[0]);
      setPendingChapter(tracks[0].chapters?.[0] || null);
      setIsLockModalOpen(true);
    }
  }, [tracks]);

  return (
    <div className="min-h-screen bg-[#121212] text-white flex flex-col font-sans selection:bg-[#1db954]/30 selection:text-[#1ed760]">
      {/* Top Navbar */}
      <Navbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenSupportModal={handleOpenSupportModal}
        onNavigateHome={handleBackToHome}
        onNavigateAdmin={handleNavigateToAdmin}
        isAdminView={isAdminView}
        siteSettings={siteSettings}
      />

      {/* Main Content + Audio Bar Wrapper (Luôn nằm phía trên Footer, không bao giờ đè lên Footer) */}
      <div className="flex-1 flex flex-col w-full">
        <main className="flex-1 w-full mx-auto">
          {isAdminView ? (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
              <Suspense
                fallback={
                  <div className="py-16 text-center text-sm text-slate-400">
                    Đang tải trang quản trị...
                  </div>
                }
              >
                <Admin
                  tracks={tracks}
                  onRefreshTracks={loadTracksData}
                  onExitAdmin={handleBackToHome}
                  onPreviewTrack={(t) => {
                    const ch = t.chapters?.[0] || { id: 1, title: 'Phần 1', mp3_url: t.mp3_url };
                    playTrackChapter(t, ch);
                  }}
                  siteSettings={siteSettings}
                  onUpdateSiteSettings={(newSettings) => setSiteSettings(newSettings)}
                />
              </Suspense>
            </div>
          ) : activeStaticPage ? (
            /* CÁC TRANG TĨNH CHÂN TRANG: GIỚI THIỆU, LIÊN HỆ, CHÍNH SÁCH BẢO MẬT, ĐIỀU KHOẢN SỬ DỤNG, MIỄN TRỪ TRÁCH NHIỆM & BẢN QUYỀN */
            <StaticPageView
              activePage={activeStaticPage}
              siteSettings={siteSettings}
              onNavigatePage={handleNavigateToStaticPage}
              onBackToHome={handleBackToHome}
            />
          ) : isStoryPageView && currentViewingStory ? (
            /* TRANG PHÁT NHẠC VÀ NGHE TRUYỆN ĐẦY ĐỦ CÁC TẬP */
            <StoryPage
              track={currentViewingStory}
              allTracks={tracks}
              onSelectChapter={handleSelectOrPlayChapter}
              onSelectStory={handleNavigateToStory}
              onBackToHome={handleBackToHome}
            />
          ) : (
            /* TRANG CHỦ VỚI CÁC DẢI TRUYỆN VÀ GRID AUDIO */
            <Home
              tracks={tracks}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              onSelectStory={handleNavigateToStory}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              siteSettings={siteSettings}
            />
          )}
        </main>

        {/* Thanh trình chạy nhạc nằm ngay trên Footer */}
        <Player onOpenStoryDetail={handleNavigateToStory} />
      </div>

      {/* Fullscreen Lock Popup */}
      <LockScreenModal
        isOpen={isLockModalOpen}
        onClose={() => setIsLockModalOpen(false)}
        targetTrack={pendingTrack}
        targetChapter={pendingChapter}
        onUnlockSuccess={handleUnlockSuccess}
      />

      {/* Spotify Style Dark Footer (Luôn nằm dưới trình chạy nhạc khi kéo xuống cuối trang) */}
      <footer className="border-t border-[#282828] bg-[#000000] py-6 text-[#b3b3b3] text-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col gap-4">
          {/* Hàng trên: Thương hiệu & các đường dẫn trang thông tin / chính sách */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
            <div className="flex items-center gap-2 flex-wrap justify-center md:justify-start">
              <button
                type="button"
                onClick={handleBackToHome}
                className="font-bold text-white hover:text-[#1ed760] transition cursor-pointer"
              >
                {siteSettings.siteName || 'Gối Ôm Audio'}
              </button>
              <span className="text-[#535353]">•</span>
              <span>{siteSettings.siteTagline || 'Nghe miễn phí, không cần tài khoản'}</span>
            </div>

            {/* Các đường dẫn trang: Giới thiệu, Liên hệ, Chính sách bảo mật, Điều khoản sử dụng, Miễn trừ trách nhiệm & Bản quyền */}
            <nav
              aria-label="Liên kết chân trang"
              className="flex flex-wrap items-center justify-center md:justify-end gap-x-4 gap-y-2"
            >
              {STATIC_PAGES_CONFIG.map((page, index) => {
                const isActive = activeStaticPage?.slug === page.slug;
                return (
                  <React.Fragment key={page.slug}>
                    <a
                      href={page.path}
                      onClick={(e) => {
                        e.preventDefault();
                        handleNavigateToStaticPage(page.slug);
                      }}
                      className={`transition cursor-pointer ${
                        isActive
                          ? 'text-[#1ed760] font-bold underline underline-offset-4'
                          : 'text-[#b3b3b3] hover:text-[#1ed760]'
                      }`}
                    >
                      {page.shortTitle}
                    </a>
                    {index < STATIC_PAGES_CONFIG.length - 1 && (
                      <span className="text-[#383838] hidden sm:inline">•</span>
                    )}
                  </React.Fragment>
                );
              })}

              <span className="text-[#383838] hidden sm:inline">•</span>
              <button
                type="button"
                onClick={() => {
                  if (tracks.length > 0) {
                    setPendingTrack(tracks[0]);
                    setPendingChapter(tracks[0].chapters?.[0] || null);
                    setIsLockModalOpen(true);
                  }
                }}
                className="hover:text-[#1ed760] transition cursor-pointer font-medium text-white/90"
              >
                Ủng hộ kênh ❤️
              </button>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  const [tracks, setTracks] = useState<Track[]>(() => getLocalTracks());
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(() => getSiteSettings());

  // Dynamic favicon
  useEffect(() => {
    updateFavicon(siteSettings.faviconUrl);
  }, [siteSettings.faviconUrl]);

  // Refresh tracks from server
  const loadTracksData = useCallback(async () => {
    try {
      const list = await fetchTracks();
      setTracks(list);
    } catch (e) {
      console.error('Failed to load tracks:', e);
    }
  }, []);

  useEffect(() => {
    fetchBootstrapData().then(({ tracks: loadedTracks, siteSettings: loadedSettings }) => {
      if (Array.isArray(loadedTracks)) {
        setTracks(loadedTracks);
      }
      if (loadedSettings) {
        setSiteSettings(loadedSettings);
      }
    });
  }, []);

  return (
    <AudioProvider allTracks={tracks}>
      <AppContent
        tracks={tracks}
        loadTracksData={loadTracksData}
        siteSettings={siteSettings}
        setSiteSettings={setSiteSettings}
      />
    </AudioProvider>
  );
}
