import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Chapter, Track, AffiliateItem } from '../types';
import { 
  getRandomAffiliateLink, 
  fetchRandomAffiliateLinkFromServer,
  markDailyUnlockedToday, 
  incrementAffiliateClick,
  fetchOgImage
} from '../services/api';

interface LockScreenModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetTrack: Track | null;
  targetChapter: Chapter | null;
  onUnlockSuccess: (track: Track, chapter: Chapter) => void;
}

const DEFAULT_BANNER = '/assets/aistudio/affiliate_product_banner.png';

export const LockScreenModal: React.FC<LockScreenModalProps> = ({
  isOpen,
  onClose,
  targetTrack,
  targetChapter,
  onUnlockSuccess,
}) => {
  const [selectedAffiliate, setSelectedAffiliate] = useState<AffiliateItem | null>(null);
  const [productThumbnail, setProductThumbnail] = useState<string>(DEFAULT_BANNER);
  const [imageLoading, setImageLoading] = useState<boolean>(false);

  // Bốc ngẫu nhiên 1 link affiliate từ Server mỗi khi popup mở và lấy ảnh thumbnail sản phẩm (og:image)
  useEffect(() => {
    let isCancelled = false;
    if (isOpen) {
      setImageLoading(true);
      fetchRandomAffiliateLinkFromServer()
        .then(async (picked) => {
          if (isCancelled) return;
          setSelectedAffiliate(picked);

          if (picked?.imageUrl) {
            setProductThumbnail(picked.imageUrl);
            setImageLoading(false);
            return;
          }

          setProductThumbnail(DEFAULT_BANNER);
          if (picked && picked.url) {
            const ogUrl = await fetchOgImage(picked.url);
            if (!isCancelled && ogUrl) {
              setProductThumbnail(ogUrl);
            }
          }
        })
        .catch(() => {
          if (isCancelled) return;
          const fallback = getRandomAffiliateLink();
          setSelectedAffiliate(fallback);
          setProductThumbnail(fallback?.imageUrl || DEFAULT_BANNER);
        })
        .finally(() => {
          if (!isCancelled) {
            setImageLoading(false);
          }
        });
    }
    return () => {
      isCancelled = true;
    };
  }, [isOpen]);

  if (!isOpen || !targetTrack) return null;

  const currentAffiliate = selectedAffiliate || {
    id: 'default',
    title: 'Shopee - Mua Sắm Deal Ưu Đãi',
    url: 'https://shopee.vn',
    platform: 'Shopee' as const,
    isActive: true,
  };

  const sanitizeWebAffiliateUrl = (rawUrl: string | undefined): string => {
    if (!rawUrl || typeof rawUrl !== 'string') return 'https://shopee.vn';
    const trimmed = rawUrl.trim();
    if (/^(intent|shopeevn|shopee|lazada|tiktok|market|itms-apps|android-app|ios-app):\/\//i.test(trimmed)) {
      return 'https://shopee.vn';
    }
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      return 'https://shopee.vn';
    }
    try {
      const parsed = new URL(trimmed);
      // Loại bỏ các tham số ép mở ứng dụng (deep link) nếu có
      parsed.searchParams.delete('deep_and_deferred');
      parsed.searchParams.delete('af_dp');
      parsed.searchParams.delete('af_force_deeplink');
      parsed.searchParams.delete('is_retargeting');
      return parsed.toString();
    } catch {
      return trimmed;
    }
  };

  const targetUrl = sanitizeWebAffiliateUrl(currentAffiliate.url);

  const handleUnlockClick = () => {
    // 1. Ghi nhận lượt click thống kê
    incrementAffiliateClick(currentAffiliate.id);

    // 2. Đánh dấu đã mở khóa trong ngày hôm nay
    markDailyUnlockedToday();

    // 3. Kích hoạt phát audio tập truyện
    if (targetChapter) {
      onUnlockSuccess(targetTrack, targetChapter);
    }

    // 4. Đóng modal
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3.5 sm:p-4 bg-black/85 backdrop-blur-sm animate-fade-in"
      style={{ touchAction: 'none' }}
    >
      <div 
        className="relative w-full max-w-[390px] sm:max-w-[420px] bg-white rounded-[26px] p-5 sm:p-6 shadow-2xl text-center overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Nút X ở góc trên bên phải để người nghe có thể bấm thoát */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 sm:top-5 sm:right-5 w-9 h-9 rounded-full border border-slate-300 bg-slate-100/90 hover:bg-slate-200 text-slate-800 flex items-center justify-center transition cursor-pointer shadow-sm z-10"
          title="Đóng và thoát"
        >
          <X size={19} className="stroke-[2.5]" />
        </button>

        {/* Nội dung cố định fix cứng theo yêu cầu */}
        <p className="text-[13px] sm:text-[14px] font-bold text-slate-900 leading-snug px-2 pr-10 mt-1">
          Bạn xác nhận bấm “Đồng Ý mở Shopee và tham khảo sản phẩm” là hoàn toàn tình nguyện. Bạn cũng có thể bấm X ở góc và thoát khỏi website.
        </p>

        {/* Link URL pill badge: hiển thị link affiliate bất kỳ vừa được bốc ngẫu nhiên */}
        <div className="mt-3 mb-3.5 flex justify-center">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[#b45327]/40 bg-[#fffaf6] text-[#b45327] text-[11px] sm:text-xs font-mono font-medium max-w-full truncate shadow-sm">
            <span className="text-[#b45327] font-bold">›</span>
            <span className="truncate">{currentAffiliate.url}</span>
          </div>
        </div>

        {/* Ảnh đại diện chính (thumbnail) lấy từ thẻ Open Graph og:image của sản phẩm */}
        <div className="relative w-full aspect-square rounded-2xl overflow-hidden border border-slate-100 shadow-sm mb-4 bg-slate-100 flex items-center justify-center">
          <img 
            src={productThumbnail} 
            alt="Ảnh đại diện sản phẩm (og:image)" 
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover transition-opacity duration-300"
            onError={() => {
              if (productThumbnail !== DEFAULT_BANNER) {
                setProductThumbnail(DEFAULT_BANNER);
              }
            }}
          />
          {imageLoading && (
            <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Nút bấm mở Shopee dạng thẻ <a> chuẩn: Trình duyệt mở tab mới tự nhiên, không bị tính là popup ẩn và không bao giờ hỏi quyền */}
        <a
          href={targetUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleUnlockClick}
          className="w-full py-3.5 px-5 rounded-2xl font-bold text-sm sm:text-base text-slate-950 bg-gradient-to-r from-[#ff6b3d] to-[#ffaa48] hover:from-[#ff5c2a] hover:to-[#ff9f3a] transition-all duration-200 shadow-lg shadow-orange-500/25 flex items-center justify-center text-center cursor-pointer no-underline select-none active:scale-[0.99]"
        >
          Đồng Ý mở Shopee và tham khảo sản phẩm
        </a>

        {/* Lưu ý cố định dưới cùng */}
        <p className="mt-3.5 text-[11px] sm:text-xs text-slate-500 leading-relaxed font-normal">
          Lưu ý: Quảng Cáo trên chỉ xuất hiện 1 lần trong ngày, mong Quý độc giả ủng hộ.
        </p>
      </div>
    </div>
  );
};
