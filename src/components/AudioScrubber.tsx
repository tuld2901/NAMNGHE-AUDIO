import React, { useState, useRef, useEffect, useCallback } from 'react';

interface AudioScrubberProps {
  currentTime: number;
  bufferedTime?: number;
  duration: number;
  onSeek: (time: number) => void;
  formatTime: (secs: number) => string;
  size?: 'sm' | 'md' | 'lg';
  showTimeLabels?: boolean;
  className?: string;
  onScrubbingChange?: (isScrubbing: boolean) => void;
}

export const AudioScrubber: React.FC<AudioScrubberProps> = ({
  currentTime,
  bufferedTime = 0,
  duration,
  onSeek,
  formatTime,
  size = 'md',
  showTimeLabels = true,
  className = '',
  onScrubbingChange,
}) => {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragTime, setDragTime] = useState<number>(currentTime);
  const pendingSeekTimeRef = useRef<number | null>(null);
  const seekTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  // Sync with current time, but NEVER snap back while dragging or waiting for seek to resolve
  useEffect(() => {
    if (isDragging) return;

    if (pendingSeekTimeRef.current !== null) {
      // If audio has caught up near the seeked position (within 1.5s), resume normal tracking
      if (Math.abs(currentTime - pendingSeekTimeRef.current) < 1.5) {
        pendingSeekTimeRef.current = null;
        if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
        setDragTime(currentTime);
      }
    } else {
      setDragTime(currentTime);
    }
  }, [currentTime, isDragging]);

  const activeDuration = duration > 0 ? duration : 0.001;
  const displayTime = isDragging || pendingSeekTimeRef.current !== null ? dragTime : currentTime;
  const progressPercent = Math.min(100, Math.max(0, (displayTime / activeDuration) * 100));
  const bufferedPercent = Math.min(100, Math.max(0, (bufferedTime / activeDuration) * 100));

  const getTimeFromClientX = useCallback(
    (clientX: number): number => {
      if (!trackRef.current) return 0;
      const rect = trackRef.current.getBoundingClientRect();
      if (rect.width <= 0) return 0;
      const clickX = clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, clickX / rect.width));
      const targetDur = duration > 0 ? duration : 0;
      return ratio * targetDur;
    },
    [duration]
  );

  // Pointer Down (Mouse click or Touch start)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Only main click
    e.preventDefault();
    e.stopPropagation();

    const newTime = getTimeFromClientX(e.clientX);
    pendingSeekTimeRef.current = null;
    if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);

    setDragTime(newTime);
    setIsDragging(true);
    if (onScrubbingChange) onScrubbingChange(true);

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  // Pointer Move (Dragging with mouse or finger)
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const newTime = getTimeFromClientX(e.clientX);
    setDragTime(newTime);
  };

  // Pointer Up (Mouse release or Finger lifted) - handles both click-to-seek and drag-to-seek
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    if (onScrubbingChange) onScrubbingChange(false);

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    const finalTime = getTimeFromClientX(e.clientX);
    pendingSeekTimeRef.current = finalTime;
    setDragTime(finalTime);

    // Safety timeout: if seek takes longer than 3.5s, unlock pending seek
    if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
    seekTimeoutRef.current = setTimeout(() => {
      pendingSeekTimeRef.current = null;
    }, 3500);

    onSeek(finalTime);
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    if (onScrubbingChange) onScrubbingChange(false);
    pendingSeekTimeRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  const trackHeightClass = size === 'lg' ? 'h-2.5' : size === 'sm' ? 'h-[3px]' : 'h-2';
  const thumbSizeClass = size === 'lg' ? 'w-4 h-4' : size === 'sm' ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5';

  return (
    <div className={`w-full flex items-center gap-2 select-none ${className}`}>
      {showTimeLabels && (
        <span className="text-[10px] text-slate-400 font-mono shrink-0 w-8 text-right tabular-nums">
          {formatTime(displayTime)}
        </span>
      )}

      {/* Interactive Hit Area: Unified Pointer Capture for zero-lag scrubbing without snap-back */}
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        className="relative py-2.5 cursor-pointer touch-none flex items-center flex-1 group"
        title="Chạm hoặc kéo thanh để tua đến đoạn bạn muốn nghe"
      >
        {/* Background Track */}
        <div className={`relative w-full ${trackHeightClass} bg-slate-800/90 rounded-full overflow-hidden`}>
          {/* Buffered Fill */}
          <div
            className="absolute top-0 left-0 h-full bg-slate-600/50 rounded-full transition-[width] duration-150"
            style={{ width: `${bufferedPercent}%` }}
          />
          {/* Active Progress Fill */}
          <div
            className="relative h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-[width] duration-75"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Draggable Knob */}
        <div
          className={`absolute pointer-events-none rounded-full bg-amber-400 border border-slate-950 shadow-md transform -translate-x-1/2 transition-transform duration-75 ${thumbSizeClass} ${
            isDragging ? 'scale-125 ring-2 ring-amber-400/50' : 'group-hover:scale-110'
          }`}
          style={{ left: `${progressPercent}%` }}
        />
      </div>

      {showTimeLabels && (
        <span className="text-[10px] text-slate-400 font-mono shrink-0 w-8 text-left tabular-nums">
          {duration > 0 ? formatTime(duration) : '--:--'}
        </span>
      )}
    </div>
  );
};
