import React, { useState, useRef, useEffect, useCallback } from 'react';

interface AudioScrubberProps {
  currentTime: number;
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
  const trackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isDragging) {
      setDragTime(currentTime);
    }
  }, [currentTime, isDragging]);

  const activeDuration = duration > 0 ? duration : 0.001;
  const displayTime = isDragging ? dragTime : currentTime;
  const progressPercent = Math.min(100, Math.max(0, (displayTime / activeDuration) * 100));

  const getTimeFromEvent = useCallback(
    (clientX: number): number => {
      if (!trackRef.current) return 0;
      const rect = trackRef.current.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, clickX / rect.width));
      return ratio * (duration || 0);
    },
    [duration]
  );

  const handleStart = (clientX: number) => {
    setIsDragging(true);
    if (onScrubbingChange) onScrubbingChange(true);
    const newTime = getTimeFromEvent(clientX);
    setDragTime(newTime);
  };

  const handleMove = (clientX: number) => {
    if (!isDragging && !trackRef.current) return;
    const newTime = getTimeFromEvent(clientX);
    setDragTime(newTime);
  };

  const handleEnd = () => {
    if (isDragging) {
      setIsDragging(false);
      if (onScrubbingChange) onScrubbingChange(false);
      onSeek(dragTime);
    }
  };

  useEffect(() => {
    if (!isDragging) return;

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      handleMove(clientX);
    };

    const onPointerUp = () => {
      handleEnd();
    };

    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);
    window.addEventListener('touchcancel', onPointerUp);

    return () => {
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
      window.removeEventListener('touchcancel', onPointerUp);
    };
  }, [isDragging, dragTime, duration]);

  const trackHeightClass = size === 'lg' ? 'h-2' : size === 'sm' ? 'h-[3px]' : 'h-1.5';
  const thumbSizeClass = size === 'lg' ? 'w-4 h-4' : size === 'sm' ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5';

  return (
    <div className={`w-full flex items-center gap-2 select-none ${className}`}>
      {showTimeLabels && (
        <span className="text-[10px] text-slate-400 font-mono shrink-0 w-7 text-right">
          {formatTime(displayTime)}
        </span>
      )}

      {/* Interactive Hit Area */}
      <div
        ref={trackRef}
        onMouseDown={(e) => {
          e.preventDefault();
          handleStart(e.clientX);
        }}
        onTouchStart={(e) => {
          handleStart(e.touches[0].clientX);
        }}
        className="relative py-1.5 cursor-pointer touch-none flex items-center flex-1 group"
      >
        {/* Background Track */}
        <div className={`w-full ${trackHeightClass} bg-slate-800/90 rounded-full overflow-hidden`}>
          {/* Active Progress Fill */}
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full"
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
        <span className="text-[10px] text-slate-400 font-mono shrink-0 w-8 text-left">
          {duration > 0 ? formatTime(duration) : '--:--'}
        </span>
      )}
    </div>
  );
};
