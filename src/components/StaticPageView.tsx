import React from 'react';
import { ArrowLeft, Info, Mail, Shield, FileText, Scale, ChevronRight } from 'lucide-react';
import { SiteSettings } from '../types';
import { DEFAULT_SITE_SETTINGS } from '../services/defaultData';

export type StaticPageSlug =
  | 'gioi-thieu'
  | 'lien-he'
  | 'chinh-sach-bao-mat'
  | 'dieu-khoan-su-dung'
  | 'mien-tru-trach-nhiem';

export interface StaticPageConfigItem {
  slug: StaticPageSlug;
  path: string;
  title: string;
  shortTitle: string;
  subtitle: string;
  settingsKey: keyof Pick<
    SiteSettings,
    'pageAbout' | 'pageContact' | 'pagePrivacy' | 'pageTerms' | 'pageDisclaimer'
  >;
}

export const STATIC_PAGES_CONFIG: StaticPageConfigItem[] = [
  {
    slug: 'gioi-thieu',
    path: '/gioi-thieu',
    title: 'Giới Thiệu',
    shortTitle: 'Giới thiệu',
    subtitle: 'Thông tin tổng quan về nền tảng nghe truyện audio trực tuyến miễn phí',
    settingsKey: 'pageAbout',
  },
  {
    slug: 'lien-he',
    path: '/lien-he',
    title: 'Liên Hệ',
    shortTitle: 'Liên hệ',
    subtitle: 'Kênh tiếp nhận ý kiến đóng góp, báo lỗi và hợp tác nội dung',
    settingsKey: 'pageContact',
  },
  {
    slug: 'chinh-sach-bao-mat',
    path: '/chinh-sach-bao-mat',
    title: 'Chính Sách Bảo Mật',
    shortTitle: 'Chính sách bảo mật',
    subtitle: 'Cam kết bảo vệ quyền riêng tư và an toàn dữ liệu của người nghe',
    settingsKey: 'pagePrivacy',
  },
  {
    slug: 'dieu-khoan-su-dung',
    path: '/dieu-khoan-su-dung',
    title: 'Điều Khoản Sử Dụng',
    shortTitle: 'Điều khoản sử dụng',
    subtitle: 'Quy định và nguyên tắc khi truy cập, nghe truyện tại website',
    settingsKey: 'pageTerms',
  },
  {
    slug: 'mien-tru-trach-nhiem',
    path: '/mien-tru-trach-nhiem',
    title: 'Miễn Trừ Trách Nhiệm & Bản Quyền',
    shortTitle: 'Miễn trừ trách nhiệm & Bản quyền',
    subtitle: 'Tuyên bố miễn trừ trách nhiệm và chính sách tôn trọng bản quyền tác giả',
    settingsKey: 'pageDisclaimer',
  },
];

export function getStaticPageByPath(pathname: string): StaticPageConfigItem | null {
  const clean = pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  return STATIC_PAGES_CONFIG.find((p) => p.slug === clean) || null;
}

interface StaticPageViewProps {
  activePage: StaticPageConfigItem;
  siteSettings: SiteSettings;
  onNavigatePage: (slug: StaticPageSlug) => void;
  onBackToHome: () => void;
}

export const StaticPageView: React.FC<StaticPageViewProps> = ({
  activePage,
  siteSettings,
  onNavigatePage,
  onBackToHome,
}) => {
  const rawContent =
    (siteSettings[activePage.settingsKey] && String(siteSettings[activePage.settingsKey]).trim()) ||
    DEFAULT_SITE_SETTINGS[activePage.settingsKey] ||
    '';

  const getPageIcon = (slug: StaticPageSlug, size = 18) => {
    switch (slug) {
      case 'gioi-thieu':
        return <Info size={size} />;
      case 'lien-he':
        return <Mail size={size} />;
      case 'chinh-sach-bao-mat':
        return <Shield size={size} />;
      case 'dieu-khoan-su-dung':
        return <FileText size={size} />;
      case 'mien-tru-trach-nhiem':
        return <Scale size={size} />;
    }
  };

  const hasHtmlTags = /<[a-z][\s\S]*>/i.test(rawContent);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 animate-fade-in">
      {/* Breadcrumb & Back button */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2 text-xs text-[#b3b3b3]">
          <button
            type="button"
            onClick={onBackToHome}
            className="hover:text-[#1ed760] transition cursor-pointer font-medium"
          >
            Trang chủ
          </button>
          <ChevronRight size={13} className="text-[#535353]" />
          <span className="text-white font-semibold">{activePage.title}</span>
        </div>

        <button
          type="button"
          onClick={onBackToHome}
          className="px-3.5 py-2 rounded-xl bg-[#181818] hover:bg-[#242424] border border-[#282828] text-xs font-bold text-white flex items-center gap-2 transition cursor-pointer"
        >
          <ArrowLeft size={14} className="text-[#1ed760]" />
          <span>Quay lại Trang chủ</span>
        </button>
      </div>

      {/* Navigation Tabs between the 5 Footer Pages */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6 no-scrollbar">
        {STATIC_PAGES_CONFIG.map((item) => {
          const isActive = item.slug === activePage.slug;
          return (
            <button
              key={item.slug}
              type="button"
              onClick={() => onNavigatePage(item.slug)}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition cursor-pointer shrink-0 border ${
                isActive
                  ? 'bg-[#1ed760] text-black border-[#1ed760] shadow-md shadow-[#1ed760]/20'
                  : 'bg-[#181818] text-[#d1d1d1] border-[#282828] hover:bg-[#242424] hover:text-white'
              }`}
            >
              <span className={isActive ? 'text-black' : 'text-[#1ed760]'}>
                {getPageIcon(item.slug, 15)}
              </span>
              <span>{item.shortTitle}</span>
            </button>
          );
        })}
      </div>

      {/* Main Content Card */}
      <div className="rounded-2xl bg-[#181818] border border-[#282828] shadow-xl overflow-hidden">
        {/* Page Header Banner */}
        <div className="p-6 sm:p-8 bg-gradient-to-r from-[#1ed760]/15 via-[#181818] to-[#181818] border-b border-[#282828]">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#1ed760]/20 border border-[#1ed760]/40 flex items-center justify-center text-[#1ed760] shrink-0">
              {getPageIcon(activePage.slug, 24)}
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#1ed760] block mb-1">
                {siteSettings.siteName || 'Gối Ôm Audio'} • Thông Tin & Chính Sách
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-white">
                {activePage.title}
              </h1>
              <p className="text-xs sm:text-sm text-[#b3b3b3] mt-1">
                {activePage.subtitle}
              </p>
            </div>
          </div>
        </div>

        {/* Page Body */}
        <div className="p-6 sm:p-8">
          {hasHtmlTags ? (
            <div
              className="prose prose-invert max-w-none text-sm sm:text-base text-[#e5e5e5] leading-relaxed space-y-4"
              dangerouslySetInnerHTML={{ __html: rawContent }}
            />
          ) : (
            <div className="text-sm sm:text-[15px] text-[#e5e5e5] leading-relaxed space-y-3 whitespace-pre-line">
              {rawContent}
            </div>
          )}
        </div>

        {/* Bottom Quick Links */}
        <div className="px-6 sm:px-8 py-4 bg-[#121212] border-t border-[#282828] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#b3b3b3]">
          <span>
            © {new Date().getFullYear()} <strong className="text-white">{siteSettings.siteName || 'Gối Ôm Audio'}</strong>. Mọi quyền được bảo lưu.
          </span>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {STATIC_PAGES_CONFIG.filter((p) => p.slug !== activePage.slug).map((p) => (
              <button
                key={p.slug}
                type="button"
                onClick={() => onNavigatePage(p.slug)}
                className="hover:text-[#1ed760] transition cursor-pointer underline underline-offset-4"
              >
                {p.shortTitle}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
