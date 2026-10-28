import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { Request } from 'express';

export interface TrafficRecord {
  id: string;
  timestamp: string; // ISO String
  ipHash: string; // Anonymized visitor hash
  path: string;
  referrer: string;
  referrerSource: 'Zalo' | 'Facebook' | 'TikTok' | 'Shopee' | 'Google' | 'Trực tiếp' | 'Khác';
  device: 'Mobile' | 'Desktop' | 'Tablet';
  os: 'iOS' | 'Android' | 'Windows' | 'macOS' | 'Linux' | 'Khác';
  browser: 'Safari' | 'Chrome' | 'Zalo In-App' | 'Facebook In-App' | 'TikTok In-App' | 'Edge' | 'Firefox' | 'Khác';
  screenWidth?: number;
}

export interface DailyTraffic {
  date: string; // YYYY-MM-DD
  pageviews: number;
  uniqueVisitors: number;
  unlockClicks: number;
}

export interface TrafficStorage {
  totalPageviews: number;
  totalUnlockClicks: number;
  visitors: Record<string, { firstSeen: string; lastSeen: string; visitCount: number }>;
  daily: Record<string, { pageviews: number; uniqueVisitors: string[]; unlockClicks: number }>;
  recentVisits: TrafficRecord[];
  topPages: Record<string, number>;
  sources: Record<string, number>;
  devices: Record<string, number>;
  operatingSystems: Record<string, number>;
  browsers: Record<string, number>;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const TRAFFIC_FILE = path.join(DATA_DIR, 'traffic.json');

// Đảm bảo thư mục data tồn tại
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let inMemoryTraffic: TrafficStorage = loadTrafficData();
let saveTimer: NodeJS.Timeout | null = null;

function loadTrafficData(): TrafficStorage {
  try {
    if (fs.existsSync(TRAFFIC_FILE)) {
      const raw = fs.readFileSync(TRAFFIC_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        totalPageviews: Number(parsed.totalPageviews) || 0,
        totalUnlockClicks: Number(parsed.totalUnlockClicks) || 0,
        visitors: parsed.visitors && typeof parsed.visitors === 'object' ? parsed.visitors : {},
        daily: parsed.daily && typeof parsed.daily === 'object' ? parsed.daily : {},
        recentVisits: Array.isArray(parsed.recentVisits) ? parsed.recentVisits.slice(-100) : [],
        topPages: parsed.topPages && typeof parsed.topPages === 'object' ? parsed.topPages : {},
        sources: parsed.sources && typeof parsed.sources === 'object' ? parsed.sources : {},
        devices: parsed.devices && typeof parsed.devices === 'object' ? parsed.devices : {},
        operatingSystems: parsed.operatingSystems && typeof parsed.operatingSystems === 'object' ? parsed.operatingSystems : {},
        browsers: parsed.browsers && typeof parsed.browsers === 'object' ? parsed.browsers : {},
      };
    }
  } catch (err) {
    console.warn('Could not read traffic.json, initializing fresh store:', err);
  }

  // Khởi tạo ban đầu với dữ liệu tự nhiên ban đầu cho trang web
  return {
    totalPageviews: 0,
    totalUnlockClicks: 0,
    visitors: {},
    daily: {},
    recentVisits: [],
    topPages: {},
    sources: {},
    devices: {},
    operatingSystems: {},
    browsers: {},
  };
}

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.writeFileSync(TRAFFIC_FILE, JSON.stringify(inMemoryTraffic, null, 2), 'utf-8');
    } catch (err) {
      console.warn('Failed to save traffic.json:', err);
    }
  }, 1000);
}

function parseUserAgent(uaRaw: string = '') {
  const ua = uaRaw.toLowerCase();

  // 1. Browser & In-App WebViews
  let browser: TrafficRecord['browser'] = 'Khác';
  if (ua.includes('zalo')) {
    browser = 'Zalo In-App';
  } else if (ua.includes('fban') || ua.includes('fbav') || ua.includes('fb_iab')) {
    browser = 'Facebook In-App';
  } else if (ua.includes('bytelocale') || ua.includes('tiktok') || ua.includes('musical_ly')) {
    browser = 'TikTok In-App';
  } else if (ua.includes('edg/') || ua.includes('edge/')) {
    browser = 'Edge';
  } else if (ua.includes('firefox/') || ua.includes('fxios/')) {
    browser = 'Firefox';
  } else if (ua.includes('chrome/') || ua.includes('crios/')) {
    browser = 'Chrome';
  } else if (ua.includes('safari') && !ua.includes('chrome')) {
    browser = 'Safari';
  }

  // 2. OS
  let os: TrafficRecord['os'] = 'Khác';
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) {
    os = 'iOS';
  } else if (ua.includes('android')) {
    os = 'Android';
  } else if (ua.includes('windows nt')) {
    os = 'Windows';
  } else if (ua.includes('macintosh') || (ua.includes('mac os') && !ua.includes('iphone'))) {
    os = 'macOS';
  } else if (ua.includes('linux')) {
    os = 'Linux';
  }

  // 3. Device
  let device: TrafficRecord['device'] = 'Desktop';
  if (ua.includes('ipad') || ua.includes('tablet')) {
    device = 'Tablet';
  } else if (ua.includes('mobile') || ua.includes('iphone') || (ua.includes('android') && !ua.includes('tablet'))) {
    device = 'Mobile';
  }

  return { browser, os, device };
}

function parseReferrer(rawRef: string = ''): TrafficRecord['referrerSource'] {
  if (!rawRef || rawRef.trim() === '') return 'Trực tiếp';
  const ref = rawRef.toLowerCase();

  if (ref.includes('zalo.me') || ref.includes('zalo')) return 'Zalo';
  if (ref.includes('facebook.com') || ref.includes('fb.com') || ref.includes('fb.me')) return 'Facebook';
  if (ref.includes('tiktok.com')) return 'TikTok';
  if (ref.includes('shopee.vn') || ref.includes('shope.ee')) return 'Shopee';
  if (ref.includes('google.com') || ref.includes('google.com.vn')) return 'Google';

  return 'Khác';
}

function hashClientIp(ip: string, ua: string): string {
  const salt = 'phuba_traffic_salt';
  return crypto.createHash('sha256').update(`${ip}:${ua}:${salt}`).digest('hex').slice(0, 12);
}

/**
 * Ghi nhận một lượt truy cập website
 */
export function recordTrafficVisit(req: Request, options?: { path?: string; referrer?: string; screenWidth?: number }) {
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    '127.0.0.1';

  const userAgent = (req.headers['user-agent'] as string) || '';

  // Bỏ qua bot thu thập dữ liệu nội bộ hoặc bot tìm kiếm nếu là bot quét rác
  if (userAgent.toLowerCase().includes('uptime') || userAgent.toLowerCase().includes('healthcheck')) {
    return;
  }

  const ipHash = hashClientIp(ip, userAgent);
  const now = new Date();
  const isoTime = now.toISOString();
  const dateKey = isoTime.split('T')[0]; // YYYY-MM-DD

  const parsedUA = parseUserAgent(userAgent);
  const cleanPath = options?.path || req.path || '/';
  const rawRef = options?.referrer || (req.headers['referer'] as string) || '';
  const refSource = parseReferrer(rawRef);

  // Tạo record
  const record: TrafficRecord = {
    id: `v_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: isoTime,
    ipHash,
    path: cleanPath,
    referrer: rawRef,
    referrerSource: refSource,
    device: parsedUA.device,
    os: parsedUA.os,
    browser: parsedUA.browser,
    screenWidth: options?.screenWidth,
  };

  // 1. Cập nhật tổng pageviews
  inMemoryTraffic.totalPageviews += 1;

  // 2. Cập nhật danh sách khách truy cập duy nhất
  if (!inMemoryTraffic.visitors[ipHash]) {
    inMemoryTraffic.visitors[ipHash] = {
      firstSeen: isoTime,
      lastSeen: isoTime,
      visitCount: 1,
    };
  } else {
    inMemoryTraffic.visitors[ipHash].lastSeen = isoTime;
    inMemoryTraffic.visitors[ipHash].visitCount += 1;
  }

  // 3. Cập nhật theo ngày
  if (!inMemoryTraffic.daily[dateKey]) {
    inMemoryTraffic.daily[dateKey] = {
      pageviews: 1,
      uniqueVisitors: [ipHash],
      unlockClicks: 0,
    };
  } else {
    inMemoryTraffic.daily[dateKey].pageviews += 1;
    if (!inMemoryTraffic.daily[dateKey].uniqueVisitors.includes(ipHash)) {
      inMemoryTraffic.daily[dateKey].uniqueVisitors.push(ipHash);
    }
  }

  // 4. Cập nhật top pages
  inMemoryTraffic.topPages[cleanPath] = (inMemoryTraffic.topPages[cleanPath] || 0) + 1;

  // 5. Cập nhật thống kê phân bổ
  inMemoryTraffic.sources[refSource] = (inMemoryTraffic.sources[refSource] || 0) + 1;
  inMemoryTraffic.devices[parsedUA.device] = (inMemoryTraffic.devices[parsedUA.device] || 0) + 1;
  inMemoryTraffic.operatingSystems[parsedUA.os] = (inMemoryTraffic.operatingSystems[parsedUA.os] || 0) + 1;
  inMemoryTraffic.browsers[parsedUA.browser] = (inMemoryTraffic.browsers[parsedUA.browser] || 0) + 1;

  // 6. Lưu vào recent visits (giữ 100 lượt gần nhất)
  inMemoryTraffic.recentVisits.unshift(record);
  if (inMemoryTraffic.recentVisits.length > 100) {
    inMemoryTraffic.recentVisits.pop();
  }

  scheduleSave();
}

/**
 * Ghi nhận một lượt bấm mở khóa nghe audio (click link shopee/affiliate)
 */
export function recordTrafficUnlockClick() {
  const dateKey = new Date().toISOString().split('T')[0];
  inMemoryTraffic.totalUnlockClicks += 1;

  if (inMemoryTraffic.daily[dateKey]) {
    inMemoryTraffic.daily[dateKey].unlockClicks = (inMemoryTraffic.daily[dateKey].unlockClicks || 0) + 1;
  } else {
    inMemoryTraffic.daily[dateKey] = {
      pageviews: 1,
      uniqueVisitors: [],
      unlockClicks: 1,
    };
  }

  scheduleSave();
}

/**
 * Lấy toàn bộ báo cáo và thống kê đo lường traffic cho CMS
 */
export function getTrafficAnalyticsReport() {
  const now = new Date();
  const todayKey = now.toISOString().split('T')[0];
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

  // Đang online: các visitor có lastSeen trong vòng 5 phút qua
  let activeNow = 0;
  for (const v of Object.values(inMemoryTraffic.visitors)) {
    if (new Date(v.lastSeen) >= fiveMinutesAgo) {
      activeNow += 1;
    }
  }

  // Khách hôm nay & Lượt xem hôm nay
  const todayStats = inMemoryTraffic.daily[todayKey] || {
    pageviews: 0,
    uniqueVisitors: [],
    unlockClicks: 0,
  };

  const totalUniqueVisitors = Object.keys(inMemoryTraffic.visitors).length;

  // Chuẩn bị danh sách theo ngày cho 14 ngày gần nhất
  const dailyList: DailyTraffic[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().split('T')[0];
    const data = inMemoryTraffic.daily[key];
    dailyList.push({
      date: key,
      pageviews: data ? data.pageviews : 0,
      uniqueVisitors: data ? data.uniqueVisitors.length : 0,
      unlockClicks: data ? data.unlockClicks : 0,
    });
  }

  // Top pages đã sắp xếp
  const sortedPages = Object.entries(inMemoryTraffic.topPages)
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  return {
    summary: {
      totalPageviews: inMemoryTraffic.totalPageviews,
      totalUniqueVisitors: totalUniqueVisitors,
      todayPageviews: todayStats.pageviews,
      todayUniqueVisitors: todayStats.uniqueVisitors.length,
      activeNow: Math.max(1, activeNow), // Ít nhất là admin đang mở xem
      totalUnlockClicks: inMemoryTraffic.totalUnlockClicks,
      todayUnlockClicks: todayStats.unlockClicks,
      conversionRate:
        inMemoryTraffic.totalPageviews > 0
          ? ((inMemoryTraffic.totalUnlockClicks / inMemoryTraffic.totalPageviews) * 100).toFixed(1) + '%'
          : '0.0%',
    },
    daily: dailyList,
    devices: inMemoryTraffic.devices,
    operatingSystems: inMemoryTraffic.operatingSystems,
    browsers: inMemoryTraffic.browsers,
    sources: inMemoryTraffic.sources,
    topPages: sortedPages,
    recentVisits: inMemoryTraffic.recentVisits.slice(0, 50),
  };
}

/**
 * Đặt lại dữ liệu traffic
 */
export function resetTrafficData() {
  inMemoryTraffic = {
    totalPageviews: 0,
    totalUnlockClicks: 0,
    visitors: {},
    daily: {},
    recentVisits: [],
    topPages: {},
    sources: {},
    devices: {},
    operatingSystems: {},
    browsers: {},
  };
  try {
    fs.writeFileSync(TRAFFIC_FILE, JSON.stringify(inMemoryTraffic, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not reset traffic.json:', err);
  }
  return { success: true, message: 'Đã xóa toàn bộ lịch sử đo lường traffic trên Server.' };
}
