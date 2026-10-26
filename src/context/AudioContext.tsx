import React, { createContext, useContext, useState, useRef, useEffect, ReactNode, useCallback } from 'react';
import { Track, Chapter } from '../types';
import { incrementPlayCount, isDailyUnlockedToday } from '../services/api';

// Helper to parse duration string ("28:15", "01:15:30", "120") into seconds
export const parseDurationToSeconds = (durationStr: string | number | undefined): number => {
  if (!durationStr) return 0;
  if (typeof durationStr === 'number') return durationStr;
  const str = String(durationStr).trim();
  if (str === 'Audio Full' || !str) return 0;

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

const isTimeInBufferedRange = (audio: HTMLAudioElement, relativeSec: number): boolean => {
  if (relativeSec < 0) return false;
  try {
    const buffered = audio.buffered;
    for (let i = 0; i < buffered.length; i++) {
      if (relativeSec >= buffered.start(i) - 0.5 && relativeSec <= buffered.end(i) + 0.5) {
        return true;
      }
    }
  } catch {}
  return false;
};

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
  const pendingSeekRef = useRef<number | null>(null);
  const streamOffsetRef = useRef<number>(0);
  const fullDurationRef = useRef<number>(0);
  const loadedChapterUrlRef = useRef<string>('');

  useEffect(() => {
    isScrubbingRef.current = isScrubbing;
  }, [isScrubbing]);

  const activeMp3Url = currentChapter?.mp3_url || currentTrack?.mp3_url || '';

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
      setCurrentTime(0);
      setBufferedTime(0);
      const parsedSecs = parseDurationToSeconds(currentChapter?.duration);
      if (parsedSecs > 0) {
        fullDurationRef.current = parsedSecs;
        setDuration(parsedSecs);
      } else {
        setDuration(0);
      }
      audio.src = activeMp3Url;
    }
    audio.playbackRate = playbackSpeed;
    audio.volume = isMuted ? 0 : volume;

    if (isPlaying) {
      if (audio.paused) {
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.warn('Playback error or auto-play prevented:', err);
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
  }, [activeMp3Url, isPlaying, playbackSpeed, isMuted, volume, currentChapter]);

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

  // Handle seeking with finger/scrubber (2-Mode Intelligent Seeking)
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
      isSeekingRef.current = true;
      seekTimeoutRef.current = setTimeout(() => {
        isSeekingRef.current = false;
      }, 2500);

      setCurrentTime(validTime);

      if (!audio || !activeMp3Url) return;

      const relativeTarget = validTime - streamOffsetRef.current;
      const isBuffered = isTimeInBufferedRange(audio, relativeTarget);
      const isLocalUpload = activeMp3Url.includes('/uploads/');

      // Trường hợp 1: Nếu file đã tải xong (hoặc đoạn cần tua đã có trong bộ đệm RAM) -> Tua mượt trực tiếp từ bộ đệm
      if (isBuffered && audio.readyState >= 1) {
        try {
          audio.currentTime = Math.max(0, relativeTarget);
          return;
        } catch (err) {
          console.warn('Buffered seek error:', err);
        }
      }

      // Trường hợp 2: Nếu file dài chưa tải xong đến vị trí đó -> Gửi request lên server để tải dữ liệu bắt đầu ngay từ điểm vừa kéo
      if (isLocalUpload) {
        const baseUrl = activeMp3Url.split('?')[0];
        if (validTime <= 1) {
          streamOffsetRef.current = 0;
          audio.src = baseUrl;
        } else {
          streamOffsetRef.current = validTime;
          const durParam = totalDur > 0 && totalDur < 99999 ? Math.round(totalDur) : 0;
          audio.src = `/api/stream-audio?src=${encodeURIComponent(baseUrl)}&t=${validTime.toFixed(1)}&dur=${durParam}`;
        }
        audio.playbackRate = playbackSpeed;
        audio.volume = isMuted ? 0 : volume;
        if (isPlaying) {
          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise.catch((err) => {
              console.warn('Server seek stream play error:', err);
            });
          }
        }
        return;
      }

      // Fallback cho link ngoài
      try {
        if (audio.readyState >= 1) {
          audio.currentTime = validTime;
        } else {
          pendingSeekRef.current = validTime;
        }
      } catch (err) {
        console.warn('Seek error on audio element:', err);
      }
    },
    [duration, activeMp3Url, playbackSpeed, isMuted, volume, isPlaying]
  );

  // Skip relative seconds (+/- 10s)
  const skip = useCallback(
    (seconds: number) => {
      const nextTime = Math.max(0, currentTime + seconds);
      seekTo(nextTime);
    },
    [currentTime, seekTo]
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
      // Advance to next track
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
  }, [currentTrack, currentChapter, allTracks]);

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
          setCurrentTime(0);
          setBufferedTime(0);
          const parsedSecs = parseDurationToSeconds(chapter?.duration);
          if (parsedSecs > 0) {
            fullDurationRef.current = parsedSecs;
            setDuration(parsedSecs);
          } else {
            setDuration(0);
          }
          audio.src = nextUrl;
        }
        audio.playbackRate = playbackSpeed;
        audio.volume = isMuted ? 0 : volume;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.warn('Direct playback attempt:', err);
          });
        }
      }

      setCurrentTrack(track);
      setCurrentChapter(chapter);
      setIsPlaying(true);
      incrementPlayCount(track.id);
    },
    [onRequireUnlock, playbackSpeed, isMuted, volume]
  );

  const togglePlayPause = useCallback(() => {
    if (!isPlaying && !isDailyUnlockedToday()) {
      if (currentTrack && onRequireUnlock) {
        onRequireUnlock(
          currentTrack,
          currentChapter || currentTrack.chapters?.[0] || { id: 1, title: 'Phần 1', duration: '', mp3_url: currentTrack.mp3_url }
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
          playPromise.catch((err) => {
            console.warn('Toggle play error:', err);
          });
        }
        setIsPlaying(true);
      }
    } else {
      setIsPlaying((prev) => !prev);
    }
  }, [isPlaying, currentTrack, currentChapter, allTracks, playTrackChapter, onRequireUnlock]);

  const updateBufferedProgress = () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      if (audio.buffered.length > 0) {
        const end = audio.buffered.end(audio.buffered.length - 1);
        setBufferedTime(streamOffsetRef.current + end);
      }
    } catch {}
  };

  // Audio event handlers
  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    updateBufferedProgress();

    // When user is scrubbing with hand/finger or audio is actively seeking, NEVER overwrite currentTime!
    if (!isScrubbingRef.current && !isSeekingRef.current && !audio.seeking) {
      setCurrentTime(streamOffsetRef.current + audio.currentTime);
    }

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
  };

  const handleLoadedMetadata = () => {
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
  };

  return (
    <AudioContext.Provider
      value={{
        currentTrack,
        currentChapter,
        isPlaying,
        currentTime,
        bufferedTime,
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
      }}
    >
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
          isSeekingRef.current = false;
          if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
          if (audioRef.current && !isScrubbingRef.current) {
            setCurrentTime(streamOffsetRef.current + audioRef.current.currentTime);
          }
        }}
        onEnded={nextChapter}
        onError={() => setAudioError('Không thể tải file âm thanh. Vui lòng kiểm tra lại đường dẫn MP3.')}
      />
      {children}
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
