import { Track, AffiliateCategory, AffiliateItem, SiteSettings, AdminAccount } from '../types';

export const DEFAULT_TRACKS: Track[] = [];

export const DEFAULT_AFFILIATE_CATEGORIES: AffiliateCategory[] = [
  {
    id: 'cat-shopee-1',
    name: 'Tài khoản Shopee 1 (Chính)',
    platform: 'Shopee',
    description: 'Tài khoản Shopee Affiliate chính thức, gắn các deal phụ kiện & sách nói',
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'cat-tiktok-1',
    name: 'Tài khoản TikTok Shop 1',
    platform: 'TikTok',
    description: 'Kênh TikTok Shop liên kết tiếp thị video viral',
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'cat-lazada-1',
    name: 'Tài khoản Lazada (Dự phòng)',
    platform: 'Lazada',
    description: 'Tài khoản Lazada Mall chiến dịch ngày đôi siêu sale',
    isActive: true,
    createdAt: new Date().toISOString()
  }
];

export const DEFAULT_AFFILIATE_LINKS: AffiliateItem[] = [
  {
    id: 'aff-shopee-1',
    title: 'Shopee - Siêu Sale Mua Sắm Deal 0Đ & Voucher 50%',
    url: 'https://shopee.vn',
    platform: 'Shopee',
    categoryId: 'cat-shopee-1',
    categoryName: 'Tài khoản Shopee 1 (Chính)',
    isActive: true,
    clicks: 142
  },
  {
    id: 'aff-shopee-audio',
    title: 'Shopee Mall - Tai Nghe Bluetooth & Phụ Kiện Nghe Truyện Ban Đêm',
    url: 'https://shopee.vn',
    platform: 'Shopee',
    categoryId: 'cat-shopee-1',
    categoryName: 'Tài khoản Shopee 1 (Chính)',
    isActive: true,
    clicks: 95
  },
  {
    id: 'aff-tiktok-1',
    title: 'TikTok Shop - Săn Hàng Hot Trend Flash Sale Giảm 70%',
    url: 'https://www.tiktok.com',
    platform: 'TikTok',
    categoryId: 'cat-tiktok-1',
    categoryName: 'Tài khoản TikTok Shop 1',
    isActive: true,
    clicks: 119
  },
  {
    id: 'aff-lazada-1',
    title: 'Lazada - Đại Tiệc Thương Hiệu Miễn Phí Vận Chuyển Toàn Quốc',
    url: 'https://www.lazada.vn',
    platform: 'Lazada',
    categoryId: 'cat-lazada-1',
    categoryName: 'Tài khoản Lazada (Dự phòng)',
    isActive: true,
    clicks: 76
  }
];

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  siteName: 'Gối Ôm Audio',
  siteTagline: 'Web Nghe Truyện Audio Online Miễn Phí',
  logoUrl: '',
  faviconUrl: 'https://api.iconify.design/lucide:headphones.svg?color=%23f59e0b',
  ogImage: '',
  heroBadge: 'Gối Ôm Audio • Kho Truyện Audio Chất Lượng Cao',
  heroTitle: 'Thưởng Thức Truyện Audio Mọi Lúc Mọi Nơi',
  heroDescription: 'Hàng trăm bộ truyện ma rùng rợn, tiên hiệp huyền ảo, kiếm hiệp giang hồ và ngôn tình sâu lắng. Tối ưu nghe trên điện thoại và máy tính, nghe miễn phí không cần tài khoản.',
  heroButtonText: 'Khám phá toàn bộ',
  heroBannerImage: '',
  showHeroBanner: true,
  headerCode: '',
  bodyCode: '',
  apiKey: 'goiom_api_secret_2025',
  requireApiKey: false,
  socialBlockerEnabled: true,
  socialBlockerTitle: 'Vui lòng mở bằng Google Chrome',
  socialBlockerDesc: 'Website được tối ưu phát âm thanh và nghe liên tục trên ứng dụng Google Chrome. Vui lòng mở bằng Google Chrome để tiếp tục!',
  socialBlockerBtnText: 'Mở bằng Google Chrome'
};

export const DEFAULT_ADMIN_ACCOUNTS: AdminAccount[] = [
  {
    id: 'admin-default',
    email: 'tuld2901@gmail.com',
    username: 'admin',
    password: 'admin123',
    name: 'Quản Trị Viên Mặc Định',
    role: 'Super Admin',
    isDefault: true,
    createdAt: '2025-01-01T00:00:00.000Z'
  }
];

