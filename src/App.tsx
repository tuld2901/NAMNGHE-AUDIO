import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { Track, Chapter, SiteSettings } from './types';
import { 
  fetchTracks, 
  fetchBootstrapData,
  getLocalTracks,
  isDailyUnlockedToday, 
  getSiteSettings,
  updateFavicon
} from './services/api';
import { getStoryPath, findTrackBySlugOrId, updateSEOMetadata } from './services/seo';
import { Navbar } from './components/Navbar';
import { Home } from './components/Home';
import { StoryPage } from './components/StoryPage';
import { Player } from './components/Player';
import { LockScreenModal } from './components/LockScreenModal';
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

      setCurrentPath(pathname);

      const cleanSegment = pathname.replace(/^\/+/, '').replace(/\/+$/, '').trim();
      const lowerSegment = cleanSegment.toLowerCase();

      if (
        !cleanSegment ||
        lowerSegment === 'index.html' ||
        lowerSegment === 'admin' ||
        lowerSegment === 'quan-tri' ||
        lowerSegment === 'system-secret-admin'
      ) {
        setActiveStoryParam(null);
        if (!cleanSegment || lowerSegment === 'index.html') {
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

  // Determine current view - supports /admin, /quan-tri, and /system-secret-admin
  const normalizedPath = currentPath.replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase();
  const isAdminView =
    normalizedPath === 'admin' ||
    normalizedPath === 'quan-tri' ||
    normalizedPath === 'system-secret-admin';

  // Find active track using selected track or clean SEO slug/ID (/ten-truyen)
  const currentViewingStory = useMemo(() => {
    if (selectedStoryTrack) {
      return tracks.find((t) => t.id === selectedStoryTrack.id) || selectedStoryTrack;
    }
    if (!activeStoryParam) return null;
    return findTrackBySlugOrId(tracks, activeStoryParam);
  }, [selectedStoryTrack, activeStoryParam, tracks]);

  // Keep canonical URL clean (/ten-truyen) when story is resolved from slug--id or id
  useEffect(() => {
    if (currentViewingStory && !isAdminView) {
      const canonicalStoryPath = getStoryPath(currentViewingStory);
      if (window.location.pathname !== canonicalStoryPath) {
        window.history.replaceState({}, '', canonicalStoryPath);
        setCurrentPath(canonicalStoryPath);
      }
    }
  }, [currentViewingStory, isAdminView]);

  const isStoryPageView = Boolean(currentViewingStory && !isAdminView);

  // Dynamic SEO metadata update for Google (Title, Description, OpenGraph, JSON-LD)
  useEffect(() => {
    if (!isAdminView) {
      updateSEOMetadata(currentViewingStory, siteSettings);
    }
  }, [currentViewingStory, siteSettings, isAdminView]);

  // Navigate helpers using HTML5 History API (no # in URL)
  const handleNavigateToStory = useCallback((track: Track) => {
    const path = getStoryPath(track);
    setSelectedStoryTrack(track);
    setActiveStoryParam(path.replace(/^\/+/, ''));
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
    setCurrentPath('/admin');
    window.history.pushState({}, '', '/admin');
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
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200">
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

      {/* Modern Dark Footer (Luôn nằm dưới trình chạy nhạc khi kéo xuống cuối trang) */}
      <footer className="border-t border-slate-800/80 bg-[#0d121d] py-5 text-slate-400 text-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
            <span className="font-bold text-slate-200">{siteSettings.siteName || 'Gối Ôm Audio'}</span>
            <span className="text-slate-600">•</span>
            <span>{siteSettings.siteTagline || 'Nghe miễn phí, không cần tài khoản'}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (tracks.length > 0) {
                  setPendingTrack(tracks[0]);
                  setPendingChapter(tracks[0].chapters?.[0] || null);
                  setIsLockModalOpen(true);
                }
              }}
              className="hover:text-amber-400 transition cursor-pointer"
            >
              Ủng hộ kênh ❤️
            </button>
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
