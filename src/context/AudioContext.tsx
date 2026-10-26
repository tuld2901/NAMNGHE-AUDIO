import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  ReactNode,
  useCallback,
  useMemo,
} from 'react';
import { Track, Chapter } from '../types';
import { incrementPlayCount, isDailyUnlockedToday } from '../services/api';

// Helper to parse duration string ("28:15", "01:15:30", "120") into seconds
export const parseDurationToSeconds = (durationStr: string | number | undefined): number => {
  if (!durationStr) return 0;
  if (typeof durationStr === 'number') return durationStr;
  const str = String(durationStr).trim();
  if (str === 'Audio Full' || str === 'Chưa gắn' || !str) return 0;

  const parts = str.split(':').map((p) => parseFloat(p));
  if (parts.some((p) => isNaN(p))) return 0;

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 1) {
    return parts[0];
  }
  return 0;
};

const isTimeInBufferedAndSeekableRange = (audio: HTMLAudioElement, relativeSec: number): boolean => {
  if (relativeSec < 0) return false;
  try {
    let inBuffered = false;
    const buffered = audio.buffered;
    for (let i = 0; i < buffered.length; i++) {
      if (relativeSec >= buffered.start(i) - 0.25 && relativeSec <= buffered.end(i) - 0.25) {
        inBuffered = true;
        break;
      }
    }
    if (!inBuffered) return false;

    const seekable = audio.seekable;
    if (!seekable || seekable.length === 0) return false;
    for (let i = 0; i < seekable.length; i++) {
      if (relativeSec >= seekable.start(i) - 0.25 && relativeSec <= seekable.end(i) - 0.25) {
        return true;
      }
    }
  } catch {}
  return false;
};

const isLocalServerAudioUrl = (url: string): boolean => {
  if (!url) return false;
  if (url.includes('/uploads/')) return true;
  if (url.startsWith('/') && url.split('?')[0].toLowerCase().endsWith('.mp3')) return true;
  try {
    const parsed = new URL(url, window.location.origin);
    if (
      parsed.origin === window.location.origin &&
      (parsed.pathname.includes('/uploads/') || parsed.pathname.toLowerCase().endsWith('.mp3'))
    ) {
      return true;
    }
  } catch {}
  return false;
};

const extractCleanUploadPath = (url: string): string => {
  if (!url) return '';
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.pathname;
  } catch {
    return url.split('?')[0];
  }
};

export interface AudioTimeContextType {
  currentTime: number;
  bufferedTime: number;
  duration: number;
}

export interface AudioContextType {
  currentTrack: Track | null;
  currentChapter: Chapter | null;
  isPlaying: boolean;
  currentTime: number;
  bufferedTime: number;
  duration: number;
  playbackSpeed: number;
  volume: number;
  isMuted: boolean;
  sleepTimerMinutes: number | null;
  sleepTimerSecondsLeft: number | null;
  audioError: string | null;
  isScrubbing: boolean;
  // Controls
  playTrackChapter: (track: Track, chapter: Chapter) => void;
  togglePlayPause: () => void;
  seekTo: (time: number) => void;
  skip: (seconds: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  setVolume: (val: number) => void;
  toggleMute: () => void;
  setSleepTimer: (minutes: number | null) => void;
  nextChapter: () => void;
  prevChapter: () => void;
  setIsScrubbing: (val: boolean) => void;
  formatTime: (secs: number) => string;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);
const AudioTimeContext = createContext<AudioTimeContextType>({
  currentTime: 0,
  bufferedTime: 0,
  duration: 0,
});

interface AudioProviderProps {
  children: ReactNode;
  allTracks: Track[];
  onRequireUnlock?: (track: Track, chapter: Chapter) => void;
}

export const AudioProvider: React.FC<AudioProviderProps> = ({
  children,
  allTracks,
  onRequireUnlock,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [bufferedTime, setBufferedTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeedState] = useState<number>(1.0);
  const [volume, setVolumeState] = useState<number>(0.85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);
  const [sleepTimerSecondsLeft, setSleepTimerSecondsLeft] = useState<number | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);

  const isScrubbingRef = useRef<boolean>(false);
  const isSeekingRef = useRef<boolean>(false);
  const seekTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const verifySeekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSeekRef = useRef<number | null>(null);
  const lastTargetSeekRef = useRef<number | null>(null);
  const streamOffsetRef = useRef<number>(0);
  const fullDurationRef = useRef<number>(0);
  const loadedChapterUrlRef = useRef<string>('');
  const currentTimeRef = useRef<number>(0);

  // Full-file in-memory Blob preloader for 0ms seeking immune to Cloudflare Range resets
  const blobUrlRef = useRef<string | null>(null);
  const isBlobReadyRef = useRef<boolean>(false);
  const preloadAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    isScrubbingRef.current = isScrubbing;
  }, [isScrubbing]);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  const cleanupPreloadedBlob = useCallback(() => {
    if (preloadAbortRef.current) {
      preloadAbortRef.current.abort();
      preloadAbortRef.current = null;
    }
    isBlobReadyRef.current = false;
    if (blobUrlRef.current) {
      try {
        URL.revokeObjectURL(blobUrlRef.current);
      } catch {}
      blobUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanupPreloadedBlob();
    };
  }, [cleanupPreloadedBlob]);

  const startBackgroundBlobPreload = useCallback(
    (rawUrl: string) => {
      cleanupPreloadedBlob();
      if (!isLocalServerAudioUrl(rawUrl)) return;

      const cleanPath = extractCleanUploadPath(rawUrl);
      const controller = new AbortController();
      preloadAbortRef.current = controller;

      const preloadUrl = `/api/stream-audio?src=${encodeURIComponent(cleanPath)}&t=0`;
      fetch(preloadUrl, { signal: controller.signal })
        .then((res) => {
          if (!res.ok) throw new Error('Preload failed');
          return res.blob();
        })
        .then((blob) => {
          if (controller.signal.aborted) return;
          if (blob.size < 1024) return;
          const mp3Blob = blob.type === 'audio/mpeg' ? blob : new Blob([blob], { type: 'audio/mpeg' });
          const objectUrl = URL.createObjectURL(mp3Blob);
          blobUrlRef.current = objectUrl;
          isBlobReadyRef.current = true;
          if (fullDurationRef.current > 0) {
            setBufferedTime(fullDurationRef.current);
          }
        })
        .catch(() => {
          // Silently ignore abort or network preload error; server-side seek remains active
        });
    },
    [cleanupPreloadedBlob]
  );

  const activeMp3Url = currentChapter?.mp3_url || currentTrack?.mp3_url || '';

  const buildInitialPlaybackUrl = useCallback((rawUrl: string): string => {
    if (isLocalServerAudioUrl(rawUrl)) {
      const cleanPath = extractCleanUploadPath(rawUrl);
      return `/api/stream-audio?src=${encodeURIComponent(cleanPath)}&t=0`;
    }
    return rawUrl;
  }, []);

  // Helper to force server-side byte-sliced stream starting at exact target second
  const triggerServerSlicedStream = useCallback(
    (targetSec: number, rawUrl: string) => {
      const audio = audioRef.current;
      if (!audio || !rawUrl) return;

      const cleanPath = extractCleanUploadPath(rawUrl);
      const totalDur =
        fullDurationRef.current > 0
          ? fullDurationRef.current
          : duration > 0
          ? duration
          : 0;
      const durParam = totalDur > 0 && totalDur < 99999 ? Math.round(totalDur) : 0;

      if (targetSec <= 0.5) {
        streamOffsetRef.current = 0;
        lastTargetSeekRef.current = 0;
        audio.src = `/api/stream-audio?src=${encodeURIComponent(cleanPath)}&t=0&_cb=${Date.now()}`;
      } else {
        streamOffsetRef.current = targetSec;
        lastTargetSeekRef.current = targetSec;
        audio.src = `/api/stream-audio?src=${encodeURIComponent(cleanPath)}&t=${targetSec.toFixed(1)}&dur=${durParam}&_cb=${Date.now()}`;
      }

      audio.playbackRate = playbackSpeed;
      audio.volume = isMuted ? 0 : volume;
      if (isPlaying) {
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {});
        }
      }
    },
    [duration, playbackSpeed, isMuted, volume, isPlaying]
  );

  // Synchronize audio element source and play/pause state safely
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !activeMp3Url) return;

    setAudioError(null);
    if (loadedChapterUrlRef.current !== activeMp3Url) {
      loadedChapterUrlRef.current = activeMp3Url;
      streamOffsetRef.current = 0;
      fullDurationRef.current = 0;
      isSeekingRef.current = false;
      pendingSeekRef.current = null;
      lastTargetSeekRef.current = null;
      setCurrentTime(0);
      setBufferedTime(0);
      const parsedSecs = parseDurationToSeconds(currentChapter?.duration);
      if (parsedSecs > 0) {
        fullDurationRef.current = parsedSecs;
        setDuration(parsedSecs);
      } else {
        setDuration(0);
      }
      audio.src = buildInitialPlaybackUrl(activeMp3Url);
      startBackgroundBlobPreload(activeMp3Url);
    }
    audio.playbackRate = playbackSpeed;
    audio.volume = isMuted ? 0 : volume;

    if (isPlaying) {
      if (audio.paused) {
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            if (err?.name === 'NotAllowedError') {
              setIsPlaying(false);
            }
          });
        }
      }
    } else {
      if (!audio.paused) {
        audio.pause();
      }
    }
  }, [activeMp3Url, isPlaying, playbackSpeed, isMuted, volume, currentChapter, buildInitialPlaybackUrl, startBackgroundBlobPreload]);

  // Synchronize playback speed
  const setPlaybackSpeed = useCallback((speed: number) => {
    setPlaybackSpeedState(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  }, []);

  // Synchronize volume
  const setVolume = useCallback((val: number) => {
    setVolumeState(val);
    if (val === 0) {
      setIsMuted(true);
    } else {
      setIsMuted(false);
    }
    if (audioRef.current) {
      audioRef.current.volume = val;
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.volume = volume;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  }, [isMuted, volume]);

  // Handle seeking with finger/scrubber (Dual-Engine RAM Blob + Server Byte-Slice Seeking)
  const seekTo = useCallback(
    (time: number) => {
      const audio = audioRef.current;
      const totalDur =
        fullDurationRef.current > 0
          ? fullDurationRef.current
          : duration > 0
          ? duration
          : audio?.duration && isFinite(audio.duration)
          ? streamOffsetRef.current + audio.duration
          : 99999;

      const validTime = Math.max(0, Math.min(time, totalDur));

      if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
      if (verifySeekTimerRef.current) clearTimeout(verifySeekTimerRef.current);

      isSeekingRef.current = true;
      lastTargetSeekRef.current = validTime;
      seekTimeoutRef.current = setTimeout(() => {
        isSeekingRef.current = false;
        lastTargetSeekRef.current = null;
      }, 2800);

      setCurrentTime(validTime);

      if (!audio || !activeMp3Url) return;

      const isLocalUpload = isLocalServerAudioUrl(activeMp3Url);

      // TRƯỜNG HỢP 1A: Nếu file MP3 đã tải trọn bộ vào RAM (Blob URL) -> Tua tức thì 0ms trong RAM, bất tử trước Cloudflare!
      if (isBlobReadyRef.current && blobUrlRef.current) {
        streamOffsetRef.current = 0;
        if (audio.src !== blobUrlRef.current) {
          pendingSeekRef.current = validTime;
          audio.src = blobUrlRef.current;
          audio.playbackRate = playbackSpeed;
          audio.volume = isMuted ? 0 : volume;
          try {
            audio.currentTime = validTime;
          } catch {}
          if (isPlaying) {
            const p = audio.play();
            if (p !== undefined) p.catch(() => {});
          }
        } else {
          pendingSeekRef.current = null;
          try {
            audio.currentTime = validTime;
          } catch {}
          if (isPlaying && audio.paused) {
            const p = audio.play();
            if (p !== undefined) p.catch(() => {});
          }
        }
        return;
      }

      // TRƯỜNG HỢP 1B: Nếu đoạn cần tua đã nằm sẵn trong cả buffered và seekable của trình duyệt
      const relativeTarget = validTime - streamOffsetRef.current;
      const canSeekNatively = isTimeInBufferedAndSeekableRange(audio, relativeTarget);

      if (canSeekNatively && audio.readyState >= 1) {
        try {
          audio.currentTime = Math.max(0, relativeTarget);

          // Hậu kiểm sau 90ms: Nếu trình duyệt/Cloudflare ép reset currentTime về 0 thì lập tức chuyển sang cắt luồng từ Server!
          if (isLocalUpload && relativeTarget > 2) {
            verifySeekTimerRef.current = setTimeout(() => {
              if (!audioRef.current) return;
              if (audioRef.current.currentTime < 1 && relativeTarget > 2) {
                triggerServerSlicedStream(validTime, activeMp3Url);
              }
            }, 90);
          }
          return;
        } catch {
          // Rơi xuống Trường hợp 2
        }
      }

      // TRƯỜNG HỢP 2: File dài chưa tải xong đến điểm kéo -> Gửi request lên Server cắt MP3 bắt đầu ngay từ giây vừa kéo
      if (isLocalUpload) {
        triggerServerSlicedStream(validTime, activeMp3Url);
        return;
      }

      // Dự phòng cho link MP3 bên ngoài
      try {
        if (audio.readyState >= 1) {
          audio.currentTime = validTime;
        } else {
          pendingSeekRef.current = validTime;
        }
      } catch {}
    },
    [duration, activeMp3Url, playbackSpeed, isMuted, volume, isPlaying, triggerServerSlicedStream]
  );

  // Skip relative seconds
  const skip = useCallback(
    (seconds: number) => {
      const nextTime = Math.max(0, currentTimeRef.current + seconds);
      seekTo(nextTime);
    },
    [seekTo]
  );

  // Sleep Timer Countdown
  useEffect(() => {
    if (sleepTimerSecondsLeft === null) return;

    if (sleepTimerSecondsLeft <= 0) {
      setIsPlaying(false);
      setSleepTimerMinutes(null);
      setSleepTimerSecondsLeft(null);
      return;
    }

    const interval = setInterval(() => {
      setSleepTimerSecondsLeft((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearInterval(interval);
  }, [sleepTimerSecondsLeft]);

  const setSleepTimer = useCallback((minutes: number | null) => {
    setSleepTimerMinutes(minutes);
    if (minutes === null) {
      setSleepTimerSecondsLeft(null);
    } else {
      setSleepTimerSecondsLeft(minutes * 60);
    }
  }, []);

  // Format seconds to mm:ss or hh:mm:ss
  const formatTime = useCallback((secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const totalSecs = Math.floor(secs);
    const hours = Math.floor(totalSecs / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const seconds = totalSecs % 60;

    const mm = minutes < 10 ? `0${minutes}` : `${minutes}`;
    const ss = seconds < 10 ? `0${seconds}` : `${seconds}`;

    if (hours > 0) {
      const hh = hours < 10 ? `0${hours}` : `${hours}`;
      return `${hh}:${mm}:${ss}`;
    }
    return `${mm}:${ss}`;
  }, []);

  // Play track & chapter with daily lock check - synchronously starts audio in user gesture
  const playTrackChapter = useCallback(
    (track: Track, chapter: Chapter) => {
      const isUnlocked = isDailyUnlockedToday();
      if (!isUnlocked && onRequireUnlock) {
        onRequireUnlock(track, chapter);
        return;
      }

      const nextUrl = chapter?.mp3_url || track?.mp3_url || '';
      const audio = audioRef.current;
      if (audio && nextUrl) {
        setAudioError(null);
        if (loadedChapterUrlRef.current !== nextUrl) {
          loadedChapterUrlRef.current = nextUrl;
          streamOffsetRef.current = 0;
          fullDurationRef.current = 0;
          isSeekingRef.current = false;
          pendingSeekRef.current = null;
          lastTargetSeekRef.current = null;
          setCurrentTime(0);
          setBufferedTime(0);
          const parsedSecs = parseDurationToSeconds(chapter?.duration);
          if (parsedSecs > 0) {
            fullDurationRef.current = parsedSecs;
            setDuration(parsedSecs);
          } else {
            setDuration(0);
          }
          audio.src = buildInitialPlaybackUrl(nextUrl);
          startBackgroundBlobPreload(nextUrl);
        }
        audio.playbackRate = playbackSpeed;
        audio.volume = isMuted ? 0 : volume;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {});
        }
      }

      setCurrentTrack(track);
      setCurrentChapter(chapter);
      setIsPlaying(true);
      incrementPlayCount(track.id);
    },
    [onRequireUnlock, playbackSpeed, isMuted, volume, buildInitialPlaybackUrl, startBackgroundBlobPreload]
  );

  // Next Chapter
  const nextChapter = useCallback(() => {
    if (!currentTrack) return;
    const chapters = currentTrack.chapters || [];
    if (chapters.length === 0) return;

    const currentIndex = chapters.findIndex((c) => c.id === currentChapter?.id);
    if (currentIndex >= 0 && currentIndex < chapters.length - 1) {
      const nextCh = chapters[currentIndex + 1];
      setCurrentChapter(nextCh);
      setIsPlaying(true);
    } else {
      const currentTrackIndex = allTracks.findIndex((t) => t.id === currentTrack.id);
      if (currentTrackIndex >= 0 && currentTrackIndex < allTracks.length - 1) {
        const nextTrack = allTracks[currentTrackIndex + 1];
        const nextFirstCh = nextTrack.chapters?.[0] || {
          id: 1,
          title: 'Phần 1',
          duration: '10:00',
          mp3_url: nextTrack.mp3_url,
        };
        playTrackChapter(nextTrack, nextFirstCh);
      } else {
        setIsPlaying(false);
      }
    }
  }, [currentTrack, currentChapter, allTracks, playTrackChapter]);

  // Previous Chapter
  const prevChapter = useCallback(() => {
    if (!currentTrack) return;
    const chapters = currentTrack.chapters || [];
    if (chapters.length === 0) return;

    const currentIndex = chapters.findIndex((c) => c.id === currentChapter?.id);
    if (currentIndex > 0) {
      const prevCh = chapters[currentIndex - 1];
      setCurrentChapter(prevCh);
      setIsPlaying(true);
    }
  }, [currentTrack, currentChapter]);

  const togglePlayPause = useCallback(() => {
    if (!isPlaying && !isDailyUnlockedToday()) {
      if (currentTrack && onRequireUnlock) {
        onRequireUnlock(
          currentTrack,
          currentChapter ||
            currentTrack.chapters?.[0] || { id: 1, title: 'Phần 1', duration: '', mp3_url: currentTrack.mp3_url }
        );
      }
      return;
    }
    if (!currentTrack && allTracks.length > 0) {
      playTrackChapter(
        allTracks[0],
        allTracks[0].chapters?.[0] || { id: 1, title: 'Phần 1', duration: '10:00', mp3_url: allTracks[0].mp3_url }
      );
      return;
    }

    const audio = audioRef.current;
    if (audio) {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {});
        }
        setIsPlaying(true);
      }
    } else {
      setIsPlaying((prev) => !prev);
    }
  }, [isPlaying, currentTrack, currentChapter, allTracks, playTrackChapter, onRequireUnlock]);

  const updateBufferedProgress = useCallback(() => {
    if (isBlobReadyRef.current && fullDurationRef.current > 0) {
      setBufferedTime(fullDurationRef.current);
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
    try {
      if (audio.buffered.length > 0) {
        const end = audio.buffered.end(audio.buffered.length - 1);
        const nextBuf = streamOffsetRef.current + end;
        setBufferedTime((prev) => (Math.abs(prev - nextBuf) > 0.5 ? nextBuf : prev));
      }
    } catch {}
  }, []);

  // Audio event handlers
  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    updateBufferedProgress();

    if (!isScrubbingRef.current && !isSeekingRef.current && !audio.seeking && pendingSeekRef.current === null) {
      const actualTime = streamOffsetRef.current + audio.currentTime;
      // Guard against unexpected browser 0-reset right after a seek
      if (lastTargetSeekRef.current !== null && lastTargetSeekRef.current > 2 && actualTime < 1) {
        return;
      }
      setCurrentTime((prev) => (Math.abs(prev - actualTime) >= 0.2 ? actualTime : prev));
    }

    if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration) && audio.duration > 0) {
      if (streamOffsetRef.current === 0) {
        if (Math.abs(fullDurationRef.current - audio.duration) > 1) {
          fullDurationRef.current = audio.duration;
          setDuration(audio.duration);
        }
      } else if (fullDurationRef.current <= 0) {
        const estTotal = streamOffsetRef.current + audio.duration;
        fullDurationRef.current = estTotal;
        setDuration(estTotal);
      }
    }
  }, [updateBufferedProgress]);

  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    updateBufferedProgress();

    if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration) && audio.duration > 0) {
      if (streamOffsetRef.current === 0) {
        fullDurationRef.current = audio.duration;
        setDuration(audio.duration);
      } else if (fullDurationRef.current <= 0) {
        const estTotal = streamOffsetRef.current + audio.duration;
        fullDurationRef.current = estTotal;
        setDuration(estTotal);
      }
    }

    if (pendingSeekRef.current !== null) {
      const target = pendingSeekRef.current;
      pendingSeekRef.current = null;
      try {
        audio.currentTime = Math.max(0, target - streamOffsetRef.current);
      } catch {}
    }

    isSeekingRef.current = false;
    if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
  }, [updateBufferedProgress]);

  const timeContextValue = useMemo<AudioTimeContextType>(
    () => ({
      currentTime,
      bufferedTime,
      duration,
    }),
    [currentTime, bufferedTime, duration]
  );

  // Main context value memoized WITHOUT currentTime/bufferedTime dependencies
  // so Home, StoryPage, Navbar, and AppContent NEVER re-render 4x/sec while audio plays!
  const mainContextValue = useMemo<AudioContextType>(
    () => ({
      currentTrack,
      currentChapter,
      isPlaying,
      currentTime: 0,
      bufferedTime: 0,
      duration,
      playbackSpeed,
      volume,
      isMuted,
      sleepTimerMinutes,
      sleepTimerSecondsLeft,
      audioError,
      isScrubbing,
      playTrackChapter,
      togglePlayPause,
      seekTo,
      skip,
      setPlaybackSpeed,
      setVolume,
      toggleMute,
      setSleepTimer,
      nextChapter,
      prevChapter,
      setIsScrubbing,
      formatTime,
    }),
    [
      currentTrack,
      currentChapter,
      isPlaying,
      duration,
      playbackSpeed,
      volume,
      isMuted,
      sleepTimerMinutes,
      sleepTimerSecondsLeft,
      audioError,
      isScrubbing,
      playTrackChapter,
      togglePlayPause,
      seekTo,
      skip,
      setPlaybackSpeed,
      setVolume,
      toggleMute,
      setSleepTimer,
      nextChapter,
      prevChapter,
      formatTime,
    ]
  );

  return (
    <AudioContext.Provider value={mainContextValue}>
      <AudioTimeContext.Provider value={timeContextValue}>
        {/* Global Audio Element */}
        <audio
          ref={audioRef}
          preload="auto"
          playsInline
          onTimeUpdate={handleTimeUpdate}
          onProgress={updateBufferedProgress}
          onLoadedMetadata={handleLoadedMetadata}
          onDurationChange={handleLoadedMetadata}
          onCanPlay={handleLoadedMetadata}
          onSeeking={() => {
            isSeekingRef.current = true;
          }}
          onSeeked={() => {
            const audio = audioRef.current;
            if (!audio) return;

            const actualTime = streamOffsetRef.current + audio.currentTime;
            // If Cloudflare/browser rejected native seek and reset currentTime to 0, switch to server byte-slice stream immediately!
            if (
              lastTargetSeekRef.current !== null &&
              lastTargetSeekRef.current > 2 &&
              actualTime < 1 &&
              isLocalServerAudioUrl(activeMp3Url)
            ) {
              const target = lastTargetSeekRef.current;
              lastTargetSeekRef.current = null;
              triggerServerSlicedStream(target, activeMp3Url);
              return;
            }

            isSeekingRef.current = false;
            lastTargetSeekRef.current = null;
            if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
            if (!isScrubbingRef.current) {
              setCurrentTime(actualTime);
            }
          }}
          onEnded={nextChapter}
          onError={() => setAudioError('Không thể tải file âm thanh. Vui lòng kiểm tra lại đường dẫn MP3.')}
        />
        {children}
      </AudioTimeContext.Provider>
    </AudioContext.Provider>
  );
};

export const useAudio = (): AudioContextType => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};

export const useAudioTime = (): AudioTimeContextType => {
  return useContext(AudioTimeContext);
};
