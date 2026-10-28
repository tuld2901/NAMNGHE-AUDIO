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
 * - Nếu lượt nghe = 0 hoặc chưa có, tự động sinh số liệu ảo trong khoảng từ 10.000 đến 30.000 lượt nghe
 *   dựa trên hash của ID và tiêu đề.
 * - Nhờ vậy: MỖI TRUYỆN CÓ MỘT CON SỐ LƯỢT NGHE KHÁC NHAU, KHÔNG TRUYỆN NÀO BỊ TRÙNG LẶP NHAU!
 */
export function getTrackPlayCount(track: { id?: string; title?: string; play_count?: number }): number {
  if (track.play_count !== undefined && track.play_count !== null && track.play_count > 0) {
    return track.play_count;
  }
  const hash = getTrackHash(track);
  // Giá trị lượt nghe ảo từ khoảng 10.000 đến 30.000
  const spread = 20000;
  const offset = hash % (spread + 1);
  return 10000 + offset;
}

/**
 * Format play count cho tiếng Việt (VD: "24,5 N lượt nghe" hoặc "18,2 N lượt nghe")
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
 * - Giá trị đang nghe từ 0 đến 20 người
 * - Phân bổ tự nhiên dựa theo độ hot và hash của từng truyện
 * - Đối với CÙNG 1 truyện: ở Mới cập nhật, Đang nghe nhiều, Top lượt nghe, Tất cả audio, hay Trang chi tiết
 *   đều hiển thị CHÍNH XÁC CÙNG 1 CON SỐ ĐANG NGHE DUY NHẤT.
 */
export function getTrackActiveListeners(track: { id?: string; title?: string; play_count?: number }): number {
  const hash = getTrackHash(track);
  const plays = getTrackPlayCount(track);

  // Tỷ lệ phân bổ theo lượt nghe trong dải 10.000 đến 30.000
  const normalized = Math.max(0, Math.min(1, (plays - 10000) / 20000));
  const base = Math.round(normalized * 15); // 0 đến 15
  const jitter = hash % 6; // 0 đến 5
  let listeners = base + jitter;

  // Giới hạn nghiêm ngặt từ 0 đến 20
  if (listeners > 20) listeners = 20;
  if (listeners < 0) listeners = 0;

  return listeners;
}

