import React from 'react';
import { Sun, Moon } from 'lucide-react';
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
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

export const Navbar: React.FC<NavbarProps> = React.memo(({
  onNavigateHome,
  isAdminView,
  siteSettings,
  theme = 'light',
  onToggleTheme,
}) => {
  const brandTitle = siteSettings?.siteName || 'Gối Ôm Audio';
  const brandTagline = siteSettings?.siteTagline || '';
  const isDark = theme === 'dark';

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#000000]/95 backdrop-blur-md border-b border-slate-200 dark:border-[#282828] transition-colors duration-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        {/* Brand Logo & Trang chủ */}
        <div className="flex items-center gap-3 min-w-0">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onNavigateHome();
            }}
            className="flex items-center gap-2.5 cursor-pointer select-none group min-w-0"
          >
            {siteSettings?.logoUrl ? (
              <img
                src={siteSettings.logoUrl}
                alt={brandTitle}
                loading="lazy"
                decoding="async"
                className="w-7 h-7 rounded-full object-cover border border-[#1ed760]/40 shrink-0"
              />
            ) : (
              <BrandIcon size={24} className="group-hover:scale-105 transition-transform shrink-0" />
            )}
            <div className="leading-tight min-w-0">
              <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight block group-hover:text-[#16a34a] dark:group-hover:text-[#1ed760] transition-colors truncate">
                {brandTitle}
              </span>
              {brandTagline && (
                <span className="hidden md:block text-[10px] text-slate-500 dark:text-[#b3b3b3] truncate max-w-[240px]">
                  {brandTagline}
                </span>
              )}
            </div>
          </a>
        </div>

        {/* Right Actions: Nút đổi giao diện Sáng / Tối (chỉ hiện ở trang người dùng) & Nút Về trang chủ khi ở Quản trị */}
        <div className="flex items-center gap-2 shrink-0">
          {!isAdminView && onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={isDark ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'}
              title={isDark ? 'Đang ở giao diện Tối — Bấm để đổi sang giao diện Sáng' : 'Đang ở giao diện Sáng — Bấm để đổi sang giao diện Tối'}
              className="h-9 px-3 rounded-xl border border-slate-200 dark:border-[#282828] bg-slate-100 hover:bg-slate-200/80 dark:bg-[#181818] dark:hover:bg-[#242424] text-slate-700 dark:text-[#e5e5e5] flex items-center gap-1.5 text-xs font-semibold transition cursor-pointer active:scale-95 select-none shadow-xs"
            >
              {isDark ? (
                <>
                  <Sun size={15} className="text-amber-400 shrink-0" />
                  <span>Sáng</span>
                </>
              ) : (
                <>
                  <Moon size={15} className="text-slate-700 shrink-0" />
                  <span>Tối</span>
                </>
              )}
            </button>
          )}

          {isAdminView && (
            <button
              type="button"
              onClick={onNavigateHome}
              className="px-3.5 py-1.5 h-9 rounded-xl text-xs font-bold text-black bg-[#1ed760] hover:bg-[#1db954] active:scale-95 transition cursor-pointer shadow-md shadow-[#1ed760]/20"
              title="Quay lại trang chính"
            >
              <span>Về trang chủ</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
});


