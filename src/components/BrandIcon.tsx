import React from 'react';

interface BrandIconProps {
  size?: number;
  className?: string;
}

export const BrandIcon: React.FC<BrandIconProps> = ({ size = 20, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
    >
      <defs>
        <linearGradient id="brandGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="50%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="11" fill="url(#brandGoldGrad)" />
      <path
        d="M7 10v4M9.5 7.5v9M12 5.5v13M14.5 7.5v9M17 10v4"
        stroke="#0b0f17"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
};

export const SoundWaveIcon: React.FC<{ isPlaying?: boolean; className?: string }> = ({
  isPlaying = false,
  className = '',
}) => {
  return (
    <div className={`flex items-end gap-[3px] h-4 ${className}`}>
      <span
        className={`w-[3px] rounded-full bg-amber-400 transition-all ${
          isPlaying ? 'animate-wave-1 h-3' : 'h-2'
        }`}
      />
      <span
        className={`w-[3px] rounded-full bg-amber-400 transition-all ${
          isPlaying ? 'animate-wave-2 h-4' : 'h-3.5'
        }`}
      />
      <span
        className={`w-[3px] rounded-full bg-amber-400 transition-all ${
          isPlaying ? 'animate-wave-3 h-2.5' : 'h-1.5'
        }`}
      />
      <span
        className={`w-[3px] rounded-full bg-amber-400 transition-all ${
          isPlaying ? 'animate-wave-4 h-3.5' : 'h-2.5'
        }`}
      />
    </div>
  );
};
