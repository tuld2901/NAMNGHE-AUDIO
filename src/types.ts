export interface Chapter {
  id: number | string;
  title: string;
  duration?: string;
  mp3_url: string;
}

export interface AffiliateCategory {
  id: string;
  name: string; // Tên danh mục/tài khoản (VD: "Tài khoản Shopee 1", "Tài khoản TikTok Shop")
  platform: 'Shopee' | 'TikTok' | 'Lazada' | 'Khác';
  description?: string;
  isActive: boolean;
  createdAt?: string;
}

export interface AffiliateItem {
  id: string;
  title: string;
  url: string;
  platform: 'Shopee' | 'TikTok' | 'Lazada' | 'Khác';
  categoryId?: string; // ID của tài khoản/danh mục chứa link
  categoryName?: string; // Tên hiển thị của danh mục/tài khoản
  isActive: boolean;
  clicks?: number;
  imageUrl?: string; // Ảnh og:image đại diện chính của sản phẩm
}

export interface Track {
  id: string;
  title: string;
  author: string;
  narrator?: string;
  category: string;
  mp3_url: string;
  thumb_url?: string;
  description?: string;
  play_count: number;
  affiliate_link?: string;
  chapters?: Chapter[];
  is_featured?: boolean;
  is_hot?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CategoryOption {
  id: string;
  name: string;
  icon?: string;
}

export interface AudioPlayerState {
  currentTrack: Track | null;
  currentChapter: Chapter | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  sleepTimer: number | null; // minutes remaining
}

export interface SiteSettings {
  siteName: string;
  siteTagline: string;
  logoUrl?: string;
  faviconUrl?: string;
  heroBadge: string;
  heroTitle: string;
  heroDescription: string;
  heroButtonText?: string;
  heroBannerImage?: string;
  showHeroBanner?: boolean;
  headerCode?: string; // Mã chèn vào thẻ <head> (Google Analytics, Google Tag Manager, Meta Pixel, Webmaster Tools, v.v.)
  bodyCode?: string;   // Mã chèn trước thẻ </body> (Facebook Chat Plugin, TikTok Pixel, v.v.)
  apiKey?: string;     // Khóa bảo mật cho cổng API đăng/sửa/xóa truyện
  requireApiKey?: boolean; // Bật/tắt yêu cầu xác thực x-api-key khi gọi cổng API
}

export interface AdminAccount {
  id: string;
  email: string;
  username?: string;
  password: string;
  name?: string;
  role?: string;
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

