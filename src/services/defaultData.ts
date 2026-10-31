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
  socialBlockerBtnText: 'Mở bằng Google Chrome',
  pageAbout: `Chào mừng bạn đến với Gối Ôm Audio — nền tảng nghe truyện audio trực tuyến miễn phí chất lượng cao dành cho người yêu thích sách nói và truyện đêm khuya.

1. Sứ mệnh của chúng tôi
Gối Ôm Audio được xây dựng với mong muốn mang đến một không gian thư giãn nhẹ nhàng, nơi thính giả có thể thưởng thức hàng trăm bộ truyện đặc sắc mọi lúc, mọi nơi mà không cần đăng ký tài khoản phức tạp.

2. Kho nội dung đa dạng
Chúng tôi liên tục cập nhật và tuyển chọn các bộ truyện hấp dẫn thuộc nhiều thể loại được yêu thích nhất:
• Truyện Ma & Kinh Dị đêm khuya rùng rợn, lôi cuốn.
• Tiên Hiệp, Kiếm Hiệp kỳ ảo, hấp dẫn qua từng chương hồi.
• Ngôn Tình, Hiện Đại, Cổ Trang sâu lắng, giàu cảm xúc.
• Truyện Ngắn, Trinh Thám, Tiểu Thuyết đời thường ý nghĩa.

3. Trải nghiệm nghe tối ưu
• Giao diện tối (Dark Mode) dịu mắt, phù hợp nghe ban đêm trước khi đi ngủ.
• Trình phát âm thanh thông minh hỗ trợ nghe liên tục nhiều tập, hẹn giờ tắt tự động và ghi nhớ vị trí đang nghe.
• Tương thích mượt mà trên cả điện thoại di động, máy tính bảng và máy tính để bàn.`,
  pageContact: `Chúng tôi luôn lắng nghe mọi ý kiến đóng góp, phản hồi của quý thính giả để ngày càng hoàn thiện chất lượng âm thanh và dịch vụ.

1. Thông tin liên hệ trực tiếp
• Đơn vị vận hành: Ban Quản Trị Gối Ôm Audio
• Email hỗ trợ & góp ý: lienhe@goiomaudio.com
• Thời gian phản hồi: Từ 08:30 – 22:00 tất cả các ngày trong tuần.

2. Các vấn đề hỗ trợ
• Báo lỗi tập truyện không phát được âm thanh, nhầm thứ tự tập hoặc chất lượng âm thanh kém.
• Yêu cầu cập nhật thêm bộ truyện mới hoặc đề xuất giọng đọc yêu thích.
• Liên hệ hợp tác truyền thông, quảng cáo, tài trợ hoặc đóng góp bản thu âm.
• Phản hồi các vấn đề liên quan đến bản quyền tác giả, tác phẩm.

Mọi thư từ và yêu cầu của bạn sẽ được đội ngũ quản trị viên tiếp nhận và phản hồi trong vòng 24 giờ làm việc.`,
  pagePrivacy: `Chính sách bảo mật này giải thích cách chúng tôi thu thập, sử dụng và bảo vệ thông tin của người dùng khi truy cập và nghe truyện tại website.

1. Không yêu cầu đăng ký tài khoản cá nhân
Thính giả có thể truy cập và nghe toàn bộ kho truyện audio trên website hoàn toàn miễn phí mà không cần tạo tài khoản, không cần cung cấp họ tên, số điện thoại hay địa chỉ cá nhân.

2. Dữ liệu lưu trữ cục bộ (Local Storage & Cookies)
Hệ thống chỉ sử dụng bộ nhớ cục bộ trên trình duyệt của bạn (LocalStorage) nhằm mục đích:
• Ghi nhớ tập truyện và mốc thời gian bạn đang nghe dở để tự động phát tiếp trong lần truy cập sau.
• Lưu tùy chỉnh âm lượng, tốc độ phát và chế độ hẹn giờ tắt nhạc của riêng bạn.
• Ghi nhớ trạng thái mở khóa ủng hộ kênh để không làm gián đoạn trải nghiệm nghe.

3. Thống kê truy cập ẩn danh
Website có thể ghi nhận các số liệu thống kê ẩn danh (như lượt nghe truyện, loại thiết bị truy cập) nhằm đánh giá mức độ yêu thích của từng bộ truyện và tối ưu hóa tốc độ máy chủ. Chúng tôi cam kết không bán, trao đổi hoặc chia sẻ dữ liệu người dùng cho bất kỳ bên thứ ba nào.`,
  pageTerms: `Khi truy cập và sử dụng dịch vụ nghe truyện tại website, đồng nghĩa với việc bạn đồng ý tuân thủ các điều khoản sử dụng dưới đây:

1. Quyền và trách nhiệm của người nghe
• Người dùng được phép nghe trực tuyến miễn phí các bộ truyện được đăng tải công khai trên website cho mục đích giải trí cá nhân, phi thương mại.
• Không sử dụng các công cụ tự động (bot, tool cào dữ liệu) gây quá tải băng thông hoặc làm gián đoạn hoạt động của máy chủ.
• Không tự ý tải xuống hàng loạt để kinh doanh, bán lại hoặc phát tán trái phép dưới danh nghĩa thương mại.

2. Liên kết tiếp thị & Ủng hộ kênh (Affiliate)
Để duy trì chi phí máy chủ lưu trữ âm thanh tốc độ cao và hoàn toàn miễn phí cho người nghe, website có tích hợp một số liên kết giới thiệu sản phẩm từ các sàn thương mại điện tử uy tín (Shopee, TikTok Shop, Lazada). Việc bạn nhấn qua liên kết là hoàn toàn tự nguyện và không phát sinh bất kỳ chi phí nào.

3. Thay đổi điều khoản
Ban quản trị có quyền cập nhật, bổ sung nội dung Điều khoản sử dụng bất cứ lúc nào để phù hợp với quy định pháp luật và định hướng phát triển của website.`,
  pageDisclaimer: `1. Tuyên bố miễn trừ trách nhiệm
• Các bộ truyện audio trên website được sưu tầm, tổng hợp từ nhiều nguồn cộng đồng mở và đóng góp của các giọng đọc, nhằm phục vụ mục đích giải trí, thư giãn phi lợi nhuận cho cộng đồng người yêu truyện đêm khuya.
• Nội dung trong các câu chuyện (đặc biệt là thể loại Truyện Ma, Tâm Linh, Tiểu Thuyết hư cấu) hoàn toàn mang tính chất văn học, nghệ thuật và giải trí. Chúng tôi không cổ xúy mê tín dị đoan hay các hành vi vi phạm pháp luật.

2. Chính sách Bản quyền (DMCA / Copyright)
Gối Ôm Audio luôn tôn trọng quyền sở hữu trí tuệ của các tác giả, dịch giả, nhà xuất bản và các nghệ sĩ lồng tiếng / diễn đọc:
• Nếu bạn là chủ sở hữu bản quyền hợp pháp của bất kỳ tác phẩm văn học hoặc bản thu âm nào đang xuất hiện trên website và không đồng ý cho phép phổ biến miễn phí, hoặc muốn bổ sung đầy đủ thông tin ghi nhận tác giả/nguồn gốc, xin vui lòng gửi thông báo cho Ban Quản Trị qua trang Liên hệ.
• Ngay khi nhận được yêu cầu xác thực hợp lệ, chúng tôi cam kết sẽ tiến hành gỡ bỏ hoàn toàn nội dung liên quan khỏi máy chủ hoặc cập nhật thông tin tác quyền trong vòng 24 – 48 giờ làm việc.`
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

