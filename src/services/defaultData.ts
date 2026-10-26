import { Track, AffiliateCategory, AffiliateItem, SiteSettings, AdminAccount } from '../types';

export const DEFAULT_TRACKS: Track[] = [
  {
    id: 'track-1',
    title: 'Gặp Ma Ở Quán Trọ Vùng Cao',
    author: 'Nguyễn Huy',
    narrator: 'Phú Bà Audio',
    category: 'Truyện Ma',
    mp3_url: '/uploads/audio/demo-audio-1.mp3',
    thumb_url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80',
    description: 'Chuyến xe đêm muộn đưa hai người khách lữ hành dừng chân tại một quán trọ heo hút lưng chừng đèo mây mù bao phủ. Đêm định mệnh với những tiếng gõ cửa bí ẩn lúc 2 giờ sáng...',
    play_count: 24500,
    affiliate_link: 'https://shopee.vn',
    is_featured: true,
    is_hot: true,
    chapters: [
      { id: 1, title: 'Phần 1: Chuyến xe đêm định mệnh', duration: '28:15', mp3_url: '/uploads/audio/demo-audio-1.mp3' },
      { id: 2, title: 'Phần 2: Căn phòng số 13', duration: '32:40', mp3_url: '/uploads/audio/demo-audio-2.mp3' },
      { id: 3, title: 'Phần 3: Bóng áo trắng nơi sương mờ', duration: '35:10', mp3_url: '/uploads/audio/demo-audio-1.mp3' }
    ]
  },
  {
    id: 'track-2',
    title: 'Phàm Nhân Tu Tiên: Khởi Đầu Nghèo Khó',
    author: 'Vong Ngữ',
    narrator: 'MC Tuấn Anh',
    category: 'Tiên Hiệp',
    mp3_url: '/uploads/audio/demo-audio-2.mp3',
    thumb_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
    description: 'Một thiếu niên bình phàm xuất thân thôn dã tình cờ bước vào con đường tu tiên đầy hiểm hóc. Dựa vào sự cẩn trọng và cơ trí phi thường, từng bước vượt qua khảo nghiệm sinh tử.',
    play_count: 51200,
    affiliate_link: 'https://shopee.vn',
    is_featured: true,
    is_hot: true,
    chapters: [
      { id: 1, title: 'Phần 1: Thất Huyền Môn', duration: '24:00', mp3_url: '/uploads/audio/demo-audio-2.mp3' },
      { id: 2, title: 'Phần 2: Mặc Đại Phu & Bí Mật Thảo Dược', duration: '30:15', mp3_url: '/uploads/audio/demo-audio-1.mp3' },
      { id: 3, title: 'Phần 3: Bình Xanh Thần Bí', duration: '28:50', mp3_url: '/uploads/audio/demo-audio-2.mp3' }
    ]
  },
  {
    id: 'track-3',
    title: 'Mối Tình Nơi Hẻm Vắng Sài Gòn',
    author: 'Hạ Vy',
    narrator: 'Phú Bà Audio',
    category: 'Ngôn Tình',
    mp3_url: '/uploads/audio/demo-audio-1.mp3',
    thumb_url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80',
    description: 'Những ngày mưa tầm tã tháng 7, quán cà phê nhỏ nơi cuối ngõ đón người khách quen thuộc. Tình cảm nhen nhóm từ những mẩu chuyện đời thường nhẹ nhàng mà sâu lắng.',
    play_count: 18900,
    affiliate_link: 'https://shopee.vn',
    is_featured: false,
    is_hot: true,
    chapters: [
      { id: 1, title: 'Phần 1: Buổi chiều mưa đầu mùa', duration: '22:30', mp3_url: '/uploads/audio/demo-audio-1.mp3' },
      { id: 2, title: 'Phần 2: Lời chưa nói', duration: '25:10', mp3_url: '/uploads/audio/demo-audio-2.mp3' }
    ]
  },
  {
    id: 'track-4',
    title: 'Bí Ẩn Vụ Án Biệt Thự Cổ Ven Sông',
    author: 'Trần Bách',
    narrator: 'Hoàng Lâm',
    category: 'Trinh Thám',
    mp3_url: '/uploads/audio/demo-audio-2.mp3',
    thumb_url: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600&auto=format&fit=crop&q=80',
    description: 'Bức di chúc thất lạc cùng vụ án mạng bí ẩn trong căn biệt thự kiểu Pháp cũ. Ai là kẻ thủ ác thực sự trong chuỗi những manh mối đánh lạc hướng công an?',
    play_count: 32000,
    affiliate_link: 'https://shopee.vn',
    is_featured: true,
    is_hot: false,
    chapters: [
      { id: 1, title: 'Phần 1: Dấu chân trong đêm giông', duration: '29:40', mp3_url: '/uploads/audio/demo-audio-2.mp3' },
      { id: 2, title: 'Phần 2: Chiếc hộp gỗ chạm trổ', duration: '31:20', mp3_url: '/uploads/audio/demo-audio-1.mp3' },
      { id: 3, title: 'Phần 3: Vén màn sự thật', duration: '36:10', mp3_url: '/uploads/audio/demo-audio-2.mp3' }
    ]
  },
  {
    id: 'track-5',
    title: 'Đại Hiệp Rời Núi Hành Tẩu Giang Hồ',
    author: 'Cổ Long Phong',
    narrator: 'Phú Bà Audio',
    category: 'Kiếm Hiệp',
    mp3_url: '/uploads/audio/demo-audio-1.mp3',
    thumb_url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=600&auto=format&fit=crop&q=80',
    description: 'Một thanh cổ kiếm, một bầu rượu nồng. Bước chân vào chốn phong vân tranh đoạt ngôi vị Minh Chủ võ lâm sau mười năm khổ luyện.',
    play_count: 42300,
    affiliate_link: 'https://shopee.vn',
    is_featured: false,
    is_hot: true,
    chapters: [
      { id: 1, title: 'Phần 1: Tiếng đàn phiêu bạt', duration: '26:50', mp3_url: '/uploads/audio/demo-audio-1.mp3' },
      { id: 2, title: 'Phần 2: Quyết chiến Hoàng Hạc Lâu', duration: '33:15', mp3_url: '/uploads/audio/demo-audio-2.mp3' }
    ]
  },
  {
    id: 'track-6',
    title: 'Hồn Ma Cây Đa Đầu Làng',
    author: 'Dương Khắc',
    narrator: 'Phú Bà Audio',
    category: 'Truyện Ma',
    mp3_url: '/uploads/audio/demo-audio-2.mp3',
    thumb_url: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600&auto=format&fit=crop&q=80',
    description: 'Cây đa cổ thụ hơn trăm năm ở đầu làng bỗng phát ra những tiếng than khóc lúc nửa đêm. Nhóm trai làng tò mò khám phá và sự thật rợn người bị chôn vùi.',
    play_count: 67800,
    affiliate_link: 'https://shopee.vn',
    is_featured: true,
    is_hot: true,
    chapters: [
      { id: 1, title: 'Phần 1: Tiếng ru con giữa canh ba', duration: '27:10', mp3_url: '/uploads/audio/demo-audio-2.mp3' },
      { id: 2, title: 'Phần 2: Ngôi mộ vô danh', duration: '34:00', mp3_url: '/uploads/audio/demo-audio-1.mp3' }
    ]
  },
  {
    id: 'track-7',
    title: 'Thầy Cúng Làng Thượng',
    author: 'Minh Đức',
    narrator: 'Phú Bà Audio',
    category: 'Truyện Ma',
    mp3_url: '/uploads/audio/demo-audio-1.mp3',
    thumb_url: 'https://images.unsplash.com/photo-1514539079130-25950c84af65?w=600&auto=format&fit=crop&q=80',
    description: 'Bí thuật trừ tà gia truyền của dòng họ Vũ làng Thượng gặp phải một thế lực u ám vượt ngoài tầm kiểm soát của các bùa chú thông thường.',
    play_count: 28900,
    affiliate_link: 'https://shopee.vn',
    is_featured: false,
    is_hot: false,
    chapters: [
      { id: 1, title: 'Phần 1: Lệnh bùa trấn yểm', duration: '25:40', mp3_url: '/uploads/audio/demo-audio-1.mp3' },
      { id: 2, title: 'Phần 2: Đêm trăng máu', duration: '31:50', mp3_url: '/uploads/audio/demo-audio-2.mp3' }
    ]
  },
  {
    id: 'track-8',
    title: 'Nghịch Thiên Chí Tôn',
    author: 'Khôi Nguyên',
    narrator: 'Quang Thắng',
    category: 'Tiên Hiệp',
    mp3_url: '/uploads/audio/demo-audio-2.mp3',
    thumb_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
    description: 'Kiếp trước bị phản bội, ngàn năm luân hồi tái sinh. Mang theo ký ức chí tôn quét ngang tam giới.',
    play_count: 38400,
    affiliate_link: 'https://shopee.vn',
    is_featured: false,
    is_hot: false,
    chapters: [
      { id: 1, title: 'Phần 1: Trùng sinh thiếu niên', duration: '23:30', mp3_url: '/uploads/audio/demo-audio-2.mp3' },
      { id: 2, title: 'Phần 2: Thần mạch thức tỉnh', duration: '29:10', mp3_url: '/uploads/audio/demo-audio-1.mp3' }
    ]
  },
  {
    id: 'track-9',
    title: 'Gió Thổi Qua Rừng Phong',
    author: 'Lam Vũ',
    narrator: 'Phương Anh',
    category: 'Đời Thực',
    mp3_url: '/uploads/audio/demo-audio-1.mp3',
    thumb_url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=600&auto=format&fit=crop&q=80',
    description: 'Câu chuyện xúc động về tình cha con và những thăng trầm mưu sinh nơi góc phố nhỏ của một người thợ sửa đồng hồ già.',
    play_count: 15600,
    affiliate_link: 'https://shopee.vn',
    is_featured: false,
    is_hot: false,
    chapters: [
      { id: 1, title: 'Phần 1: Tiếng tích tắc thời gian', duration: '21:15', mp3_url: '/uploads/audio/demo-audio-1.mp3' },
      { id: 2, title: 'Phần 2: Chiếc vé tàu khứ hồi', duration: '27:00', mp3_url: '/uploads/audio/demo-audio-2.mp3' }
    ]
  },
  {
    id: 'track-10',
    title: 'Hồ Sơ Vụ Án: Mật Mã Số 7',
    author: 'Đình Luân',
    narrator: 'Hoàng Lâm',
    category: 'Trinh Thám',
    mp3_url: '/uploads/audio/demo-audio-2.mp3',
    thumb_url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80',
    description: 'Một chuỗi những vụ trộm nghệ thuật kỳ lạ tại các bảo tàng lớn, để lại duy nhất một lá bài số 7 cùng thông điệp thách thức cảnh sát hình sự.',
    play_count: 29800,
    affiliate_link: 'https://shopee.vn',
    is_featured: false,
    is_hot: true,
    chapters: [
      { id: 1, title: 'Phần 1: Lá bài đen', duration: '26:20', mp3_url: '/uploads/audio/demo-audio-2.mp3' },
      { id: 2, title: 'Phần 2: Cuộc truy đuổi trong sương', duration: '32:00', mp3_url: '/uploads/audio/demo-audio-1.mp3' }
    ]
  }
];

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
  heroBadge: 'Gối Ôm Audio • Kho Truyện Audio Chất Lượng Cao',
  heroTitle: 'Thưởng Thức Truyện Audio Mọi Lúc Mọi Nơi',
  heroDescription: 'Hàng trăm bộ truyện ma rùng rợn, tiên hiệp huyền ảo, kiếm hiệp giang hồ và ngôn tình sâu lắng. Tối ưu nghe trên điện thoại và máy tính, nghe miễn phí không cần tài khoản.',
  heroButtonText: 'Khám phá toàn bộ',
  heroBannerImage: '',
  showHeroBanner: true,
  headerCode: '',
  bodyCode: '',
  apiKey: 'goiom_api_secret_2025',
  requireApiKey: false
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

