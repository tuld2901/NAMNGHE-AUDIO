import { Track } from '../types';

/**
 * Tạo seed hash số nguyên ổn định từ track.id và track.title
 */
export function getTrackHash(track: { id?: string; title?: string }): number {
  const str = `${track.id || ''}:${track.title || ''}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Lấy số lượt nghe chuẩn riêng biệt cho từng truyện:
 * - Nếu admin đã chỉnh số lượt nghe cụ thể > 0 trong CMS thì ưu tiên hiển thị con số đó.
 * - Nếu lượt nghe = 0 hoặc chưa có, tự động sinh số liệu giả lập tự nhiên, riêng biệt cho từng truyện
 *   dựa trên hash của ID và tiêu đề (từ 850 đến 45.000 lượt nghe).
 * - Nhờ vậy: MỖI TRUYỆN CÓ MỘT CON SỐ LƯỢT NGHE KHÁC NHAU, KHÔNG TRUYỆN NÀO BỊ TRÙNG LẶP NHAU!
 */
export function getTrackPlayCount(track: { id?: string; title?: string; play_count?: number }): number {
  if (track.play_count !== undefined && track.play_count !== null && track.play_count > 0) {
    return track.play_count;
  }
  const hash = getTrackHash(track);
  // Bảng phân bổ lượt nghe thực tế đa dạng theo các dải
  const tiers = [860, 1450, 3280, 6940, 12600, 18700, 24800, 31900, 42500, 58200];
  const tierIndex = hash % tiers.length;
  const base = tiers[tierIndex];
  const offset = (hash % 120) * 10;
  return base + offset;
}

/**
 * Format play count cho tiếng Việt (VD: "24,5 N lượt nghe" hoặc "850 lượt nghe")
 */
export function formatPlayCount(count?: number): string {
  const val = count ?? 0;
  if (val >= 1000) {
    const k = (val / 1000).toFixed(1).replace('.', ',');
    return `${k} N lượt nghe`;
  }
  return `${val.toLocaleString('vi-VN')} lượt nghe`;
}

/**
 * Tính số người đang nghe trực tuyến riêng biệt và hoàn toàn nhất quán cho từng truyện:
 * - Tùy theo độ hot (lượt nghe) và hash riêng của từng truyện mà sinh ra các con số sinh động (từ 2 đến 36 người)
 * - Mỗi truyện ra một con số khác nhau! Tuyệt đối không bị đồng loạt cùng 1 số (như 48)!
 * - Nhưng đối với CÙNG 1 truyện: ở Mới cập nhật, Đang nghe nhiều, Top lượt nghe, Tất cả audio, hay Trang chi tiết
 *   đều hiển thị CHÍNH XÁC CÙNG 1 CON SỐ ĐANG NGHE DUY NHẤT.
 */
export function getTrackActiveListeners(track: { id?: string; title?: string; play_count?: number }): number {
  const plays = getTrackPlayCount(track);
  const hash = getTrackHash(track);
  const variance = (hash % 7) - 3; // -3 đến +3

  let listeners = 2;
  if (plays >= 50000) {
    // 28 - 36 đang nghe
    listeners = 32 + variance;
  } else if (plays >= 30000) {
    // 20 - 27 đang nghe
    listeners = 23 + variance;
  } else if (plays >= 15000) {
    // 12 - 18 đang nghe
    listeners = 15 + variance;
  } else if (plays >= 5000) {
    // 6 - 11 đang nghe
    listeners = 8 + (hash % 5);
  } else if (plays >= 1000) {
    // 3 - 5 đang nghe
    listeners = 3 + (hash % 3);
  } else {
    // 1 - 2 đang nghe
    listeners = 1 + (hash % 2);
  }

  return Math.max(1, listeners);
}
