import { Track } from '../types';

const vnDateFormatter = (() => {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return null;
  }
})();

/**
 * Lấy mã ngày YYYY-MM-DD theo múi giờ Việt Nam (Asia/Ho_Chi_Minh)
 */
export function getVietnamDateKey(date: Date = new Date()): string {
  try {
    if (vnDateFormatter) {
      return vnDateFormatter.format(date);
    }
  } catch {}
  const vnTime = new Date(date.getTime() + 7 * 3600 * 1000);
  return vnTime.toISOString().slice(0, 10);
}

let cachedRecentKeysBucket = 0;
const cachedRecentKeysMap = new Map<number, string[]>();

/**
 * Lấy danh sách các ngày YYYY-MM-DD trong N ngày gần nhất (tính cả hôm nay), có bộ nhớ đệm theo phút
 */
export function getRecentDateKeys(days: number): string[] {
  const now = Date.now();
  const minuteBucket = Math.floor(now / 60000);
  if (minuteBucket !== cachedRecentKeysBucket) {
    cachedRecentKeysBucket = minuteBucket;
    cachedRecentKeysMap.clear();
  }
  const existing = cachedRecentKeysMap.get(days);
  if (existing) return existing;

  const keys: string[] = [];
  for (let i = 0; i < days; i++) {
    keys.push(getVietnamDateKey(new Date(now - i * 86400000)));
  }
  cachedRecentKeysMap.set(days, keys);
  return keys;
}

/**
 * Lấy số lượt nghe THẬT của từng bộ truyện (không dùng số ảo):
 * - Trả về đúng giá trị play_count thực tế được ghi nhận trên hệ thống (mặc định 0 nếu chưa có lượt nghe).
 */
export function getTrackPlayCount(track: { play_count?: number }): number {
  const realCount = Number(track?.play_count);
  if (!isFinite(realCount) || realCount < 0) return 0;
  return Math.floor(realCount);
}

/**
 * Tính số lượt nghe THẬT theo khung thời gian:
 * - 'today': Lượt nghe thực tế trong ngày hôm nay
 * - 'week': Lượt nghe thực tế trong 7 ngày gần nhất
 * - 'month': Lượt nghe thực tế trong 30 ngày gần nhất
 */
export function getTrackPeriodPlays(
  track: Pick<Track, 'play_count' | 'daily_plays' | 'created_at'>,
  period: 'today' | 'week' | 'month'
): number {
  const dailyMap = track.daily_plays;
  const daysCount = period === 'today' ? 1 : period === 'week' ? 7 : 30;
  const targetKeys = getRecentDateKeys(daysCount);

  if (dailyMap && typeof dailyMap === 'object' && Object.keys(dailyMap).length > 0) {
    let sum = 0;
    for (const key of targetKeys) {
      const val = Number(dailyMap[key]);
      if (isFinite(val) && val > 0) {
        sum += Math.floor(val);
      }
    }
    return sum;
  }

  // Nếu truyện đã có sẵn lượt nghe thực tế trước khi có bảng daily_plays và mới đăng trong khoảng thời gian này
  const totalRealPlays = getTrackPlayCount(track);
  if (totalRealPlays > 0 && track.created_at) {
    const createdTime = new Date(track.created_at).getTime();
    if (isFinite(createdTime)) {
      const createdKey = getVietnamDateKey(new Date(createdTime));
      if (targetKeys.includes(createdKey)) {
        return totalRealPlays;
      }
    }
  }

  return 0;
}

/**
 * Format số lượt nghe thật cho tiếng Việt (VD: "0 lượt nghe", "128 lượt nghe", "1,5 N lượt nghe")
 */
export function formatPlayCount(count?: number): string {
  const val = Math.max(0, Math.floor(Number(count) || 0));
  if (val >= 1000) {
    const k = (val / 1000).toFixed(1).replace('.', ',');
    return `${k} N lượt nghe`;
  }
  return `${val.toLocaleString('vi-VN')} lượt nghe`;
}
