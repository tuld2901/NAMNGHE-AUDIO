import React from 'react';
import { BrandIcon } from './BrandIcon';
import { SiteSettings } from '../types';

interface NavbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenSupportModal: () => void;
  onNavigateHome: () => void;
  onNavigateAdmin?: () => void;
  isAdminView: boolean;
  siteSettings?: SiteSettings;
}

export const Navbar: React.FC<NavbarProps> = ({
  onNavigateHome,
  onNavigateAdmin,
  isAdminView,
  siteSettings,
}) => {
  const brandTitle = siteSettings?.siteName || 'Gối Ôm Audio';
  const brandTagline = siteSettings?.siteTagline || '';

  return (
    <header className="sticky top-0 z-40 bg-[#0b0f17]/90 border-b border-slate-800/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Brand Logo & Trang chủ pill */}
        <div className="flex items-center gap-3">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onNavigateHome();
            }}
            className="flex items-center gap-2.5 cursor-pointer select-none group"
          >
            {siteSettings?.logoUrl ? (
              <img
                src={siteSettings.logoUrl}
                alt={brandTitle}
                className="w-7 h-7 rounded-full object-cover border border-amber-500/30 shrink-0"
              />
            ) : (
              <BrandIcon size={24} className="group-hover:scale-105 transition-transform shrink-0" />
            )}
            <div className="leading-tight">
              <span className="text-base sm:text-lg font-black text-white tracking-tight block">
                {brandTitle}
              </span>
              {brandTagline && (
                <span className="hidden md:block text-[10px] text-slate-400 truncate max-w-[240px]">
                  {brandTagline}
                </span>
              )}
            </div>
          </a>
        </div>

        {/* Right Action: Chỉ hiển thị nút Về trang chủ khi đang ở trong trang Quản trị */}
        {isAdminView && (
          <div className="flex items-center gap-2">
            <button
              onClick={onNavigateHome}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 transition cursor-pointer shadow-md shadow-amber-500/20"
              title="Quay lại trang chính"
            >
              <span>Về trang chủ</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
