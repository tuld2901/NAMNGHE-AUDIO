import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Track, AffiliateCategory, AffiliateItem, SiteSettings, AdminAccount } from './src/types';
import { 
  DEFAULT_TRACKS, 
  DEFAULT_AFFILIATE_CATEGORIES, 
  DEFAULT_AFFILIATE_LINKS, 
  DEFAULT_SITE_SETTINGS,
  DEFAULT_ADMIN_ACCOUNTS
} from './src/services/defaultData';

export interface ServerDBData {
  tracks: Track[];
  affiliateCategories: AffiliateCategory[];
  affiliateLinks: AffiliateItem[];
  siteSettings: SiteSettings;
  adminAccounts: AdminAccount[];
  supabaseConfig: {
    url: string;
    anonKey: string;
    configured: boolean;
  };
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
export const UPLOAD_ROOT_DIR = path.resolve(process.cwd(), 'uploads');
export const UPLOAD_AUDIO_DIR = path.join(UPLOAD_ROOT_DIR, 'audio');
export const UPLOAD_IMAGE_DIR = path.join(UPLOAD_ROOT_DIR, 'images');
export const BACKUP_DIR = path.resolve(process.cwd(), 'backups');

// Ensure data, uploads, and backups directories exist at project root
[DATA_DIR, UPLOAD_ROOT_DIR, UPLOAD_AUDIO_DIR, UPLOAD_IMAGE_DIR, BACKUP_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Migrate any legacy files from public/uploads to root uploads/ if present
const legacyUploadsDir = path.resolve(process.cwd(), 'public', 'uploads');
if (fs.existsSync(legacyUploadsDir)) {
  try {
    (['audio', 'images'] as const).forEach((sub) => {
      const srcSub = path.join(legacyUploadsDir, sub);
      const destSub = path.join(UPLOAD_ROOT_DIR, sub);
      if (fs.existsSync(srcSub)) {
        for (const file of fs.readdirSync(srcSub)) {
          const srcFile = path.join(srcSub, file);
          const destFile = path.join(destSub, file);
          if (fs.statSync(srcFile).isFile() && !fs.existsSync(destFile)) {
            fs.copyFileSync(srcFile, destFile);
          }
        }
      }
    });
  } catch (err) {
    console.warn('Could not migrate legacy public/uploads:', err);
  }
}

/**
 * Chuẩn hóa chuỗi tiếng Việt thành slug không dấu, gạch nối chuẩn SEO & tên file
 * VD: "Tập 1: Tiếng Gõ Cửa Đêm Khuya" -> "tap-1-tieng-go-cua-dem-khuya"
 */
export function slugifyVietnamese(text: string): string {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Loại bỏ triệt để mọi địa chỉ loopback (localhost, 127.0.0.1, 0.0.0.0, IP nội bộ) và các giao thức gọi ứng dụng (intent://, shopeevn://)
 * để trình duyệt Chrome không bao giờ hiểu lầm và bật thông báo hỏi quyền "Ứng dụng trên thiết bị" (Apps on device / Local network).
 */
export function sanitizePublicWebUrl(rawUrl: string | undefined | null, fallback = ''): string {
  if (!rawUrl || typeof rawUrl !== 'string') return fallback;
  let cleaned = rawUrl.trim();
  if (!cleaned) return fallback;

  // Chặn các custom scheme gọi ứng dụng trên thiết bị (shopeevn://, intent://, market://, tiktok://, lazada://)
  if (/^(intent|shopeevn|shopee|lazada|tiktok|market|itms-apps|android-app|ios-app):\/\//i.test(cleaned)) {
    return fallback || 'https://shopee.vn';
  }

  // Nếu URL chứa localhost, 127.0.0.1, 0.0.0.0, [::1] hoặc IP LAN 192.168.x.x / 10.x.x.x -> chuyển thành đường dẫn tương đối (/uploads/...)
  const loopbackRegex = /^https?:\/\/(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[::1\]|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?(\/.*)?$/i;
  const match = cleaned.match(loopbackRegex);
  if (match) {
    const pathPart = match[4] || '/';
    return pathPart;
  }

  // Nếu URL có chứa /uploads/audio/ hoặc /uploads/images/ từ domain chính -> rút gọn về đường dẫn tương đối /uploads/... nếu file tồn tại trên ổ đĩa
  const uploadsIdx = cleaned.indexOf('/uploads/');
  if (uploadsIdx > 0 && /^https?:\/\//i.test(cleaned)) {
    const relativePart = cleaned.slice(uploadsIdx);
    const cleanRel = decodeURIComponent(relativePart.split('?')[0]).replace(/^\/uploads\//, '');
    if (fs.existsSync(path.join(UPLOAD_ROOT_DIR, cleanRel))) {
      return relativePart.split('?')[0];
    }
  }

  return cleaned;
}

/**
 * Đảm bảo file MP3 nội bộ (/uploads/audio/...) luôn có tên file chuẩn hóa theo storyTitle + chapterTitle slug
 * VD: "Truyện Ma Đêm Khuya" + "Phần 1" -> "/uploads/audio/truyen-ma-dem-khuya-phan-1.mp3"
 */
export function normalizeLocalChapterAudioSlug(chapterTitle: string, mp3Url: string, storyTitle?: string): string {
  const safeMp3Url = sanitizePublicWebUrl(mp3Url);
  if (!safeMp3Url || !safeMp3Url.startsWith('/uploads/audio/')) {
    return safeMp3Url;
  }
  mp3Url = safeMp3Url;
  const chapterSlug = slugifyVietnamese(chapterTitle);
  if (!chapterSlug) return mp3Url;

  const storySlug = storyTitle ? slugifyVietnamese(storyTitle) : '';
  let baseSlug = chapterSlug;
  if (storySlug) {
    if (chapterSlug.startsWith(storySlug)) {
      baseSlug = chapterSlug;
    } else {
      baseSlug = `${storySlug}-${chapterSlug}`;
    }
  }

  const currentFileName = decodeURIComponent(mp3Url.replace('/uploads/audio/', '').split('?')[0]);
  const rawExt = path.extname(currentFileName).toLowerCase();
  const ext = rawExt || '.mp3';
  const targetFileName = `${baseSlug}${ext}`;
  const targetUrl = `/uploads/audio/${targetFileName}`;

  if (currentFileName === targetFileName) {
    return targetUrl;
  }

  // Không đổi tên các file demo dùng chung để tránh làm mất file của các truyện mẫu
  if (currentFileName.startsWith('demo-audio-')) {
    return mp3Url;
  }

  const currentFilePath = path.join(UPLOAD_AUDIO_DIR, currentFileName);
  const targetFilePath = path.join(UPLOAD_AUDIO_DIR, targetFileName);

  try {
    if (fs.existsSync(currentFilePath)) {
      if (!fs.existsSync(targetFilePath)) {
        fs.renameSync(currentFilePath, targetFilePath);
        return targetUrl;
      }
      return targetUrl;
    } else if (fs.existsSync(targetFilePath)) {
      return targetUrl;
    }
  } catch (err) {
    console.warn('Could not rename audio file to slug:', err);
  }

  return mp3Url;
}

// In-memory cache of server DB
let dbData: ServerDBData;

function loadDatabase(): ServerDBData {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      const hasAdminAccountsArray = Array.isArray(parsed.adminAccounts);
      const loadedAdminAccounts: AdminAccount[] = hasAdminAccountsArray
        ? parsed.adminAccounts
        : DEFAULT_ADMIN_ACCOUNTS.map(acc => ({ ...acc }));

      const loadedData: ServerDBData = {
        tracks: Array.isArray(parsed.tracks) && parsed.tracks.length > 0 ? parsed.tracks : DEFAULT_TRACKS,
        affiliateCategories: Array.isArray(parsed.affiliateCategories) && parsed.affiliateCategories.length > 0 ? parsed.affiliateCategories : DEFAULT_AFFILIATE_CATEGORIES,
        affiliateLinks: Array.isArray(parsed.affiliateLinks) && parsed.affiliateLinks.length > 0 ? parsed.affiliateLinks : DEFAULT_AFFILIATE_LINKS,
        siteSettings: parsed.siteSettings ? { ...DEFAULT_SITE_SETTINGS, ...parsed.siteSettings } : DEFAULT_SITE_SETTINGS,
        adminAccounts: loadedAdminAccounts.length > 0 ? loadedAdminAccounts : DEFAULT_ADMIN_ACCOUNTS.map(acc => ({ ...acc })),
        supabaseConfig: parsed.supabaseConfig || {
          url: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
          anonKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
          configured: false
        }
      };

      if (!hasAdminAccountsArray) {
        saveDatabase(loadedData);
      }
      return loadedData;
    }
  } catch (err) {
    console.warn('Error reading db.json, creating initial server database:', err);
  }

  const initial: ServerDBData = {
    tracks: DEFAULT_TRACKS,
    affiliateCategories: DEFAULT_AFFILIATE_CATEGORIES,
    affiliateLinks: DEFAULT_AFFILIATE_LINKS,
    siteSettings: DEFAULT_SITE_SETTINGS,
    adminAccounts: DEFAULT_ADMIN_ACCOUNTS.map(acc => ({ ...acc })),
    supabaseConfig: {
      url: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
      anonKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
      configured: false
    }
  };
  saveDatabase(initial);
  return initial;
}

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let isWritingAsync = false;

function saveDatabase(data: ServerDBData) {
  try {
    dbData = data;
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save to db.json:', err);
  }
}

/**
 * Non-blocking debounced disk write for high-frequency events (e.g. play counts, affiliate clicks)
 * so thousands of concurrent listeners never block the Node.js event loop.
 */
function scheduleSaveDatabase() {
  if (saveTimeout) return;
  saveTimeout = setTimeout(async () => {
    saveTimeout = null;
    if (isWritingAsync) return;
    isWritingAsync = true;
    try {
      await fs.promises.writeFile(DB_FILE, JSON.stringify(dbData, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed async save to db.json:', err);
    } finally {
      isWritingAsync = false;
    }
  }, 1500);
}

// --- TỰ ĐỘNG TÍNH TOÁN ĐỘ DÀI AUDIO TỪ FILE DISK (FFPROBE / MP3 HEADER / FILE SIZE) ---
function parseMp3DurationFromHeader(localPath: string, fileSize: number): number {
  let fd: number | null = null;
  try {
    fd = fs.openSync(localPath, 'r');
    let id3v2Size = 0;
    const headerBuf = Buffer.alloc(10);
    if (fs.readSync(fd, headerBuf, 0, 10, 0) === 10 && headerBuf[0] === 0x49 && headerBuf[1] === 0x44 && headerBuf[2] === 0x33) {
      id3v2Size =
        10 +
        (((headerBuf[6] & 0x7f) << 21) |
          ((headerBuf[7] & 0x7f) << 14) |
          ((headerBuf[8] & 0x7f) << 7) |
          (headerBuf[9] & 0x7f));
      if (id3v2Size >= fileSize) id3v2Size = 0;
    }

    const scanLen = Math.min(16384, fileSize - id3v2Size);
    if (scanLen <= 4) return 0;
    const buf = Buffer.alloc(scanLen);
    const bytesRead = fs.readSync(fd, buf, 0, scanLen, id3v2Size);

    const bitratesMpeg1L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
    const bitratesMpeg2L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];
    const sampleRatesMpeg1 = [44100, 48000, 32000, 0];
    const sampleRatesMpeg2 = [22050, 24000, 16000, 0];
    const sampleRatesMpeg25 = [11025, 12000, 8000, 0];

    for (let i = 0; i < bytesRead - 48; i++) {
      if (buf[i] === 0xff && (buf[i + 1] & 0xe0) === 0xe0) {
        const versionBits = (buf[i + 1] >> 3) & 0x03; // 3=MPEG1, 2=MPEG2, 0=MPEG2.5
        const layerBits = (buf[i + 1] >> 1) & 0x03; // 1=Layer III
        const bitrateIdx = (buf[i + 2] >> 4) & 0x0f;
        const srIdx = (buf[i + 2] >> 2) & 0x03;

        if (versionBits === 1 || layerBits !== 1 || bitrateIdx === 0 || bitrateIdx === 15 || srIdx === 3) {
          continue;
        }

        const isMpeg1 = versionBits === 3;
        const bitrateKbps = isMpeg1 ? bitratesMpeg1L3[bitrateIdx] : bitratesMpeg2L3[bitrateIdx];
        const sampleRate =
          versionBits === 3
            ? sampleRatesMpeg1[srIdx]
            : versionBits === 2
            ? sampleRatesMpeg2[srIdx]
            : sampleRatesMpeg25[srIdx];

        if (!bitrateKbps || !sampleRate) continue;

        // Check for Xing / Info VBR header inside this first frame
        const frameSearchEnd = Math.min(bytesRead - 12, i + 200);
        for (let j = i + 4; j < frameSearchEnd; j++) {
          const isXing = buf[j] === 0x58 && buf[j + 1] === 0x69 && buf[j + 2] === 0x6e && buf[j + 3] === 0x67;
          const isInfo = buf[j] === 0x49 && buf[j + 1] === 0x6e && buf[j + 2] === 0x66 && buf[j + 3] === 0x6f;
          if (isXing || isInfo) {
            const flags = buf.readUInt32BE(j + 4);
            if (flags & 0x01) {
              const totalFrames = buf.readUInt32BE(j + 8);
              const samplesPerFrame = isMpeg1 ? 1152 : 576;
              if (totalFrames > 0) {
                return Math.round((totalFrames * samplesPerFrame) / sampleRate);
              }
            }
            break;
          }
        }

        const audioBytes = Math.max(0, fileSize - id3v2Size);
        const bytesPerSec = (bitrateKbps * 1000) / 8;
        if (bytesPerSec > 0) {
          return Math.round(audioBytes / bytesPerSec);
        }
      }
    }
    return 0;
  } catch {
    return 0;
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {}
    }
  }
}

const audioDurationStrCache = new Map<string, string>();
const audioDurationSecFastCache = new Map<string, number>();

export function detectAudioDurationSecondsFast(localPath: string, fallbackSecs = 0): number {
  try {
    if (!localPath || !fs.existsSync(localPath)) return fallbackSecs;
    const stat = fs.statSync(localPath);
    const cacheKey = `${localPath}:${stat.size}:${Math.floor(stat.mtimeMs)}`;
    const cached = audioDurationSecFastCache.get(cacheKey);
    if (cached && cached > 0) return cached;

    // 1. Đọc trực tiếp MP3 Frame Header (< 0.1ms, không mở tiến trình con)
    const headerSecs = parseMp3DurationFromHeader(localPath, stat.size);
    if (headerSecs > 0) {
      audioDurationSecFastCache.set(cacheKey, headerSecs);
      return headerSecs;
    }

    // 2. Nếu trình duyệt đã gửi sẵn fallbackSecs hợp lệ thì ưu tiên dùng luôn để không block luồng
    if (fallbackSecs > 1 && fallbackSecs < 86400) {
      audioDurationSecFastCache.set(cacheKey, fallbackSecs);
      return fallbackSecs;
    }

    // 3. Dự phòng tính theo dung lượng file (128kbps = 16,000 bytes/giây)
    const estSecs = Math.max(1, Math.round(stat.size / 16000));
    audioDurationSecFastCache.set(cacheKey, estSecs);
    return estSecs;
  } catch {
    return fallbackSecs;
  }
}

export function detectAudioDurationSync(mp3Url: string): string {
  try {
    if (!mp3Url) return '25:00';
    let filename = '';
    if (mp3Url.includes('/uploads/audio/')) {
      filename = decodeURIComponent(mp3Url.split('/uploads/audio/')[1]?.split('?')[0] || '');
    } else if (mp3Url.includes('/uploads/')) {
      filename = decodeURIComponent(mp3Url.split('/uploads/')[1]?.split('?')[0] || '');
    }
    if (!filename) return '25:00';

    let localPath = path.join(UPLOAD_AUDIO_DIR, filename);
    if (!fs.existsSync(localPath)) {
      localPath = path.join(UPLOAD_ROOT_DIR, filename);
      if (!fs.existsSync(localPath)) return '25:00';
    }

    const stat = fs.statSync(localPath);
    const cacheKey = `${localPath}:${stat.size}:${Math.floor(stat.mtimeMs)}`;
    const cachedStr = audioDurationStrCache.get(cacheKey);
    if (cachedStr) return cachedStr;

    const formatSecs = (secs: number): string => {
      const s = Math.max(1, Math.floor(secs));
      const hrs = Math.floor(s / 3600);
      const mins = Math.floor((s % 3600) / 60);
      const rem = s % 60;
      return hrs > 0
        ? `${hrs}:${mins < 10 ? '0' : ''}${mins}:${rem < 10 ? '0' : ''}${rem}`
        : `${mins < 10 ? '0' : ''}${mins}:${rem < 10 ? '0' : ''}${rem}`;
    };

    // 1. Ưu tiên đọc trực tiếp MP3 Frame Header (CBR Bitrate / VBR Xing Header) cực nhanh (< 0.1ms)
    const headerSecs = parseMp3DurationFromHeader(localPath, stat.size);
    if (headerSecs > 0) {
      const res = formatSecs(headerSecs);
      audioDurationStrCache.set(cacheKey, res);
      audioDurationSecFastCache.set(cacheKey, headerSecs);
      return res;
    }

    // 2. Dự phòng gọi ffprobe nếu file có header đặc biệt
    try {
      const out = execSync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${localPath}"`,
        { timeout: 1500, stdio: ['ignore', 'pipe', 'ignore'] }
      ).toString();
      const secs = parseFloat(out.trim());
      if (!isNaN(secs) && secs > 0) {
        const res = formatSecs(secs);
        audioDurationStrCache.set(cacheKey, res);
        audioDurationSecFastCache.set(cacheKey, Math.round(secs));
        return res;
      }
    } catch {}

    // 3. Dự phòng cuối: Tính theo dung lượng file (128kbps = 16,000 bytes/giây)
    const estSecs = Math.max(1, Math.round(stat.size / 16000));
    const res = formatSecs(estSecs);
    audioDurationStrCache.set(cacheKey, res);
    audioDurationSecFastCache.set(cacheKey, estSecs);
    return res;
  } catch {
    return '25:00';
  }
}

export function autoFixMissingChapterDurations(): void {
  try {
    let changed = false;

    // 1. Làm sạch toàn bộ URL trong siteSettings (loại bỏ localhost / 127.0.0.1 nếu có)
    if (dbData.siteSettings) {
      const cleanLogo = sanitizePublicWebUrl(dbData.siteSettings.logoUrl);
      const cleanFav = sanitizePublicWebUrl(dbData.siteSettings.faviconUrl);
      const cleanBanner = sanitizePublicWebUrl(dbData.siteSettings.heroBannerImage);
      if (cleanLogo !== dbData.siteSettings.logoUrl) {
        dbData.siteSettings.logoUrl = cleanLogo;
        changed = true;
      }
      if (cleanFav !== dbData.siteSettings.faviconUrl) {
        dbData.siteSettings.faviconUrl = cleanFav;
        changed = true;
      }
      if (cleanBanner !== dbData.siteSettings.heroBannerImage) {
        dbData.siteSettings.heroBannerImage = cleanBanner;
        changed = true;
      }
    }

    // 2. Làm sạch toàn bộ URL trong affiliateLinks (loại bỏ deep link gọi app hoặc localhost)
    if (Array.isArray(dbData.affiliateLinks)) {
      for (const link of dbData.affiliateLinks) {
        const cleanUrl = sanitizePublicWebUrl(link.url, 'https://shopee.vn');
        const cleanImg = link.imageUrl ? sanitizePublicWebUrl(link.imageUrl) : link.imageUrl;
        if (cleanUrl !== link.url) {
          link.url = cleanUrl;
          changed = true;
        }
        if (cleanImg !== link.imageUrl) {
          link.imageUrl = cleanImg;
          changed = true;
        }
      }
    }

    // 3. Làm sạch URL và đồng bộ thời lượng cho toàn bộ tracks & chapters
    for (const track of dbData.tracks) {
      const cleanTrackMp3 = sanitizePublicWebUrl(track.mp3_url);
      const cleanThumb = sanitizePublicWebUrl(track.thumb_url);
      const cleanAff = sanitizePublicWebUrl(track.affiliate_link, 'https://shopee.vn');
      if (cleanTrackMp3 !== track.mp3_url) {
        track.mp3_url = cleanTrackMp3;
        changed = true;
      }
      if (cleanThumb !== track.thumb_url) {
        track.thumb_url = cleanThumb;
        changed = true;
      }
      if (cleanAff !== track.affiliate_link) {
        track.affiliate_link = cleanAff;
        changed = true;
      }

      if (Array.isArray(track.chapters)) {
        for (const ch of track.chapters) {
          const cleanChMp3 = sanitizePublicWebUrl(ch.mp3_url || track.mp3_url || '');
          if (ch.mp3_url && cleanChMp3 !== ch.mp3_url) {
            ch.mp3_url = cleanChMp3;
            changed = true;
          }
          const mp3Url = cleanChMp3;
          const curDur = (ch.duration || '').trim();
          const needsDurationCalc =
            !curDur ||
            curDur === 'Audio Full' ||
            curDur === 'Chưa gắn' ||
            (curDur === '25:00' && mp3Url.includes('/uploads/'));

          if (needsDurationCalc) {
            const calcDuration = detectAudioDurationSync(mp3Url);
            if (ch.duration !== calcDuration) {
              ch.duration = calcDuration;
              changed = true;
            }
          }
        }
      }
    }
    if (changed) {
      saveDatabase(dbData);
      console.log('[Database] Đã tự động chuẩn hóa URL và đồng bộ thời lượng audio cho toàn bộ các tập truyện.');
    }
  } catch (err) {
    console.warn('[Database] Lỗi khi tự động gắn thời lượng tập:', err);
  }
}

// Initialize on server start
dbData = loadDatabase();
autoFixMissingChapterDurations();

// Supabase client instance on server if configured
let serverSupabase: SupabaseClient | null = null;

export function initServerSupabase(url: string, key: string): boolean {
  if (url && key && url.startsWith('http') && !url.includes('your-project')) {
    try {
      serverSupabase = createClient(url, key);
      return true;
    } catch (e) {
      console.warn('Could not init server Supabase client:', e);
    }
  }
  serverSupabase = null;
  return false;
}

// Auto-init Supabase if keys exist
if (dbData.supabaseConfig?.url && dbData.supabaseConfig?.anonKey) {
  initServerSupabase(dbData.supabaseConfig.url, dbData.supabaseConfig.anonKey);
}

// --- TRACKS API ---
let lastSupabaseSyncMs = 0;
let isSupabaseSyncing = false;

export function getTracksSync(): Track[] {
  return dbData.tracks;
}

export async function getTracks(): Promise<Track[]> {
  if (serverSupabase && !isSupabaseSyncing && Date.now() - lastSupabaseSyncMs > 30000) {
    isSupabaseSyncing = true;
    lastSupabaseSyncMs = Date.now();
    Promise.resolve(
      serverSupabase
        .from('tracks')
        .select('*')
        .order('created_at', { ascending: false })
    )
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          dbData.tracks = data.map((t: any) => ({
            ...t,
            chapters: t.chapters || [{ id: 1, title: 'Phần 1', duration: '25:00', mp3_url: t.mp3_url }]
          }));
          scheduleSaveDatabase();
        }
      })
      .catch(() => {})
      .finally(() => {
        isSupabaseSyncing = false;
      });
  }
  return dbData.tracks;
}

function findTrackInList(tracks: Track[], idOrSlug: string): Track | null {
  if (!idOrSlug) return null;
  const raw = String(idOrSlug).trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const slug = slugifyVietnamese(raw);

  return (
    tracks.find(t => t.id === raw) ||
    tracks.find(t => t.id.toLowerCase() === lower) ||
    (slug ? tracks.find(t => slugifyVietnamese(t.title) === slug) : undefined) ||
    tracks.find(t => t.title.trim().toLowerCase() === lower) ||
    null
  );
}

export async function getTrackById(id: string): Promise<Track | null> {
  const tracks = await getTracks();
  return findTrackInList(tracks, id);
}

export async function addTrack(payload: Partial<Track> & { cover_url?: string; image_url?: string; audio_url?: string; url?: string }): Promise<Track> {
  const storyTitle = (payload.title || 'Truyện mới').trim();
  const fallbackTopAudio = payload.mp3_url || payload.audio_url || payload.url || '';

  const rawChapters = Array.isArray(payload.chapters) && payload.chapters.length > 0
    ? payload.chapters.map((ch: any, idx: number) => {
        const chTitle = ch.title || ch.chapter_title || ch.name || `Phần ${idx + 1}`;
        const rawUrl = ch.mp3_url || ch.audio_url || ch.url || ch.mp3 || fallbackTopAudio || '';
        const normalizedUrl = normalizeLocalChapterAudioSlug(chTitle, rawUrl, storyTitle);
        const resolvedDuration =
          ch.duration && String(ch.duration).trim() && ch.duration !== 'Audio Full' && ch.duration !== 'Chưa gắn'
            ? String(ch.duration).trim()
            : detectAudioDurationSync(normalizedUrl);
        return {
          id: ch.id !== undefined ? ch.id : idx + 1,
          title: chTitle,
          duration: resolvedDuration,
          mp3_url: normalizedUrl
        };
      })
    : [
        {
          id: 1,
          title: 'Phần 1: Khởi đầu',
          duration: detectAudioDurationSync(fallbackTopAudio),
          mp3_url: normalizeLocalChapterAudioSlug('Phần 1: Khởi đầu', fallbackTopAudio, storyTitle)
        }
      ];

  const primaryMp3 = sanitizePublicWebUrl(rawChapters[0]?.mp3_url || fallbackTopAudio);

  const newTrack: Track = {
    id: payload.id && String(payload.id).trim() ? String(payload.id).trim() : 'track-' + Date.now(),
    title: storyTitle,
    author: (payload.author || 'Đang cập nhật').trim(),
    narrator: (payload.narrator || 'Gối Ôm Audio').trim(),
    category: (payload.category || 'Truyện Ma').trim(),
    mp3_url: primaryMp3,
    thumb_url: sanitizePublicWebUrl(payload.thumb_url || payload.cover_url || payload.image_url) || 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80',
    description: payload.description || '',
    play_count: Number(payload.play_count) || 0,
    affiliate_link: sanitizePublicWebUrl(payload.affiliate_link, 'https://shopee.vn'),
    chapters: rawChapters,
    is_featured: Boolean(payload.is_featured),
    is_hot: Boolean(payload.is_hot),
    created_at: new Date().toISOString()
  };

  if (serverSupabase) {
    try {
      const { data, error } = await serverSupabase
        .from('tracks')
        .insert([newTrack])
        .select()
        .single();
      if (!error && data) {
        newTrack.id = data.id;
      }
    } catch (err) {
      console.warn('Supabase insert failed on server:', err);
    }
  }

  dbData.tracks = [newTrack, ...dbData.tracks.filter(t => t.id !== newTrack.id)];
  saveDatabase(dbData);
  return newTrack;
}

export async function updateTrack(
  id: string,
  updates: Partial<Track> & { cover_url?: string; image_url?: string; audio_url?: string; url?: string }
): Promise<Track | null> {
  const currentStory = findTrackInList(dbData.tracks, id);
  if (!currentStory) return null;
  const resolvedId = currentStory.id;

  let updatedTrack: Track | null = null;
  const storyTitle = (updates.title || currentStory.title || '').trim();

  const normalizedUpdates: Partial<Track> = { ...updates };
  delete (normalizedUpdates as any).cover_url;
  delete (normalizedUpdates as any).image_url;
  delete (normalizedUpdates as any).audio_url;
  delete (normalizedUpdates as any).url;

  if ((updates.cover_url || updates.image_url) && !updates.thumb_url) {
    normalizedUpdates.thumb_url = updates.cover_url || updates.image_url;
  }
  if ((updates.audio_url || updates.url) && !updates.mp3_url) {
    normalizedUpdates.mp3_url = updates.audio_url || updates.url;
  }
  if (normalizedUpdates.thumb_url) {
    normalizedUpdates.thumb_url = sanitizePublicWebUrl(normalizedUpdates.thumb_url);
  }
  if (normalizedUpdates.mp3_url) {
    normalizedUpdates.mp3_url = sanitizePublicWebUrl(normalizedUpdates.mp3_url);
  }
  if (normalizedUpdates.affiliate_link) {
    normalizedUpdates.affiliate_link = sanitizePublicWebUrl(normalizedUpdates.affiliate_link, 'https://shopee.vn');
  }
  if (Array.isArray(updates.chapters)) {
    normalizedUpdates.chapters = updates.chapters.map((ch: any, idx: number) => {
      const chTitle = ch.title || ch.chapter_title || ch.name || `Phần ${idx + 1}`;
      const rawChUrl = ch.mp3_url || ch.audio_url || ch.url || ch.mp3 || '';
      const normalizedUrl = normalizeLocalChapterAudioSlug(chTitle, rawChUrl, storyTitle);
      const resolvedDuration =
        ch.duration && String(ch.duration).trim() && ch.duration !== 'Audio Full' && ch.duration !== 'Chưa gắn'
          ? String(ch.duration).trim()
          : detectAudioDurationSync(normalizedUrl);
      return {
        id: ch.id !== undefined ? ch.id : idx + 1,
        title: chTitle,
        duration: resolvedDuration,
        mp3_url: normalizedUrl
      };
    });
    if (normalizedUpdates.chapters[0]?.mp3_url) {
      normalizedUpdates.mp3_url = normalizedUpdates.chapters[0].mp3_url;
    }
  }

  if (serverSupabase) {
    try {
      await serverSupabase.from('tracks').update(normalizedUpdates).eq('id', resolvedId);
    } catch (err) {
      console.warn('Supabase update failed on server:', err);
    }
  }

  dbData.tracks = dbData.tracks.map(t => {
    if (t.id === resolvedId) {
      updatedTrack = { ...t, ...normalizedUpdates, id: t.id, updated_at: new Date().toISOString() };
      return updatedTrack;
    }
    return t;
  });

  if (updatedTrack) {
    saveDatabase(dbData);
  }
  return updatedTrack;
}

export async function addChapterToTrack(
  trackId: string,
  chapterPayload: { id?: string | number; title?: string; chapter_title?: string; mp3_url?: string; audio_url?: string; url?: string; duration?: string }
): Promise<Track | null> {
  const existing = findTrackInList(dbData.tracks, trackId);
  if (!existing) return null;

  const currentChapters = Array.isArray(existing.chapters) ? [...existing.chapters] : [];
  const nextIndex = currentChapters.length + 1;
  const rawMp3Url = chapterPayload.mp3_url || chapterPayload.audio_url || chapterPayload.url || '';
  const chTitle = chapterPayload.title || chapterPayload.chapter_title || `Phần ${nextIndex}: Tập mới`;
  const normalizedUrl = normalizeLocalChapterAudioSlug(chTitle, rawMp3Url, existing.title);

  const resolvedDuration =
    chapterPayload.duration &&
    String(chapterPayload.duration).trim() &&
    chapterPayload.duration !== 'Audio Full' &&
    chapterPayload.duration !== 'Chưa gắn'
      ? String(chapterPayload.duration).trim()
      : detectAudioDurationSync(normalizedUrl);

  const newChapter = {
    id: chapterPayload.id !== undefined ? chapterPayload.id : nextIndex,
    title: chTitle,
    duration: resolvedDuration,
    mp3_url: normalizedUrl
  };

  const nextChapters = [...currentChapters, newChapter];
  return updateTrack(existing.id, {
    chapters: nextChapters,
    mp3_url: existing.mp3_url || newChapter.mp3_url
  });
}

export async function deleteChapterFromTrack(
  trackId: string,
  chapterIdOrIndex: string | number
): Promise<Track | null> {
  const existing = findTrackInList(dbData.tracks, trackId);
  if (!existing || !Array.isArray(existing.chapters)) return null;

  let nextChapters = existing.chapters.filter(ch => String(ch.id) !== String(chapterIdOrIndex));
  // Nếu không khớp theo ch.id mà truyền số thứ tự tập (1-based index), xóa theo vị trí tập
  if (nextChapters.length === existing.chapters.length) {
    const idxNum = Number(chapterIdOrIndex);
    if (!isNaN(idxNum) && idxNum >= 1 && idxNum <= existing.chapters.length) {
      nextChapters = existing.chapters.filter((_, i) => i !== idxNum - 1);
    }
  }

  return updateTrack(existing.id, {
    chapters: nextChapters,
    mp3_url: nextChapters[0]?.mp3_url || existing.mp3_url
  });
}

export async function deleteTrack(id: string): Promise<boolean> {
  const existing = findTrackInList(dbData.tracks, id);
  if (!existing) return false;
  const resolvedId = existing.id;

  if (serverSupabase) {
    try {
      await serverSupabase.from('tracks').delete().eq('id', resolvedId);
    } catch (err) {
      console.warn('Supabase delete failed on server:', err);
    }
  }

  const initialLen = dbData.tracks.length;
  dbData.tracks = dbData.tracks.filter(t => t.id !== resolvedId);
  saveDatabase(dbData);
  return dbData.tracks.length < initialLen;
}

export async function incrementTrackPlay(id: string): Promise<void> {
  if (serverSupabase) {
    serverSupabase.rpc('increment_track_play_count', { track_id: id }).then(() => {}, () => {});
  }

  dbData.tracks = dbData.tracks.map(t => {
    if (t.id === id) {
      return { ...t, play_count: (t.play_count || 0) + 1 };
    }
    return t;
  });
  scheduleSaveDatabase();
}

export async function resetTracks(): Promise<Track[]> {
  dbData.tracks = DEFAULT_TRACKS;
  saveDatabase(dbData);
  return dbData.tracks;
}

// --- AFFILIATE CATEGORIES API ---
export function getCategories(): AffiliateCategory[] {
  return dbData.affiliateCategories;
}

export function addCategory(payload: { name: string; platform: any; description?: string }): AffiliateCategory {
  const newCat: AffiliateCategory = {
    id: `cat-${Date.now()}`,
    name: payload.name.trim(),
    platform: payload.platform || 'Shopee',
    description: payload.description || '',
    isActive: true,
    createdAt: new Date().toISOString()
  };

  dbData.affiliateCategories = [...dbData.affiliateCategories, newCat];
  saveDatabase(dbData);
  return newCat;
}

export function deleteCategory(id: string): { categories: AffiliateCategory[]; links: AffiliateItem[] } {
  dbData.affiliateCategories = dbData.affiliateCategories.filter(c => c.id !== id);
  // Automatically clean up all links in that category
  dbData.affiliateLinks = dbData.affiliateLinks.filter(l => l.categoryId !== id);
  saveDatabase(dbData);
  return { categories: dbData.affiliateCategories, links: dbData.affiliateLinks };
}

export function toggleCategory(id: string): { categories: AffiliateCategory[]; links: AffiliateItem[] } {
  let newState = false;
  dbData.affiliateCategories = dbData.affiliateCategories.map(c => {
    if (c.id === id) {
      newState = !c.isActive;
      return { ...c, isActive: newState };
    }
    return c;
  });

  dbData.affiliateLinks = dbData.affiliateLinks.map(l => {
    if (l.categoryId === id) {
      return { ...l, isActive: newState };
    }
    return l;
  });

  saveDatabase(dbData);
  return { categories: dbData.affiliateCategories, links: dbData.affiliateLinks };
}

// --- SERVER-SIDE OG:IMAGE SCRAPER & CACHE ---
export async function extractOgImageFromUrl(targetUrl: string): Promise<{ ogImage: string | null; title: string | null }> {
  if (!targetUrl || !targetUrl.startsWith('http')) {
    return { ogImage: null, title: null };
  }

  const userAgents = [
    'TelegramBot (like TwitterBot)',
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'Twitterbot/1.0',
    'WhatsApp/2.21.11.17 i',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  ];

  let ogImage: string | null = null;
  let title: string | null = null;

  for (const ua of userAgents) {
    try {
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': ua,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'vi,en;q=0.9',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(6000),
      });

      if (!response.ok && response.status !== 200) continue;

      const html = await response.text();

      const ogMatch =
        html.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["']/i) ||
        html.match(/"image"\s*:\s*"(https?:\/\/[^"]+susercontent\.com[^"]+)"/i);

      if (ogMatch && ogMatch[1]) {
        const candidate = ogMatch[1].trim().replace(/&amp;/g, '&');
        const fullUrl = candidate.startsWith('//') ? 'https:' + candidate : candidate;
        // Skip generic site-wide logos if possible, or accept product image
        if (fullUrl.startsWith('http')) {
          ogImage = fullUrl;
        }
      }

      const titleMatch =
        html.match(/<meta[^>]+(?:property|name)=["'](?:og:title|twitter:title)["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        title = titleMatch[1].trim();
      }

      if (ogImage) break;
    } catch {
      // Try next user-agent
    }
  }

  return { ogImage, title };
}

/**
 * Background task on server to auto-populate missing imageUrl (thumbnail) for affiliate links
 */
export async function syncMissingAffiliateThumbnails(): Promise<void> {
  let updated = false;
  for (const link of dbData.affiliateLinks) {
    if (!link.imageUrl && link.url && link.url.startsWith('http')) {
      try {
        const { ogImage } = await extractOgImageFromUrl(link.url);
        if (ogImage) {
          link.imageUrl = ogImage;
          updated = true;
        }
      } catch {
        // Ignore single link error
      }
    }
  }
  if (updated) {
    saveDatabase(dbData);
  }
}

// Trigger background sync on server startup
setTimeout(() => {
  syncMissingAffiliateThumbnails().catch(() => {});
}, 500);

// --- AFFILIATE LINKS API ---
export function getAffiliateLinks(): AffiliateItem[] {
  return dbData.affiliateLinks;
}

export function bulkAddAffiliateLinks(
  items: Array<{ url: string; title?: string; platform?: any; categoryId?: string; imageUrl?: string }>
): { addedCount: number; links: AffiliateItem[] } {
  const categoryMap = new Map(dbData.affiliateCategories.map(c => [c.id, c]));
  const newLinks: AffiliateItem[] = [];

  items.forEach((item, idx) => {
    const cleanUrl = (item.url || '').trim();
    if (!cleanUrl.startsWith('http')) return;

    let platform = item.platform;
    if (!platform) {
      const lower = cleanUrl.toLowerCase();
      if (lower.includes('shopee') || lower.includes('shp.ee')) platform = 'Shopee';
      else if (lower.includes('tiktok')) platform = 'TikTok';
      else if (lower.includes('lazada')) platform = 'Lazada';
      else platform = 'Shopee';
    }

    const parentCat = item.categoryId ? categoryMap.get(item.categoryId) : undefined;
    const catName = parentCat ? parentCat.name : (dbData.affiliateCategories[0]?.name || 'Tài khoản chính');

    newLinks.push({
      id: `aff-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
      title: item.title || `${catName} Deal #${dbData.affiliateLinks.length + newLinks.length + 1}`,
      url: cleanUrl,
      platform,
      categoryId: item.categoryId || dbData.affiliateCategories[0]?.id,
      categoryName: catName,
      isActive: true,
      clicks: 0,
      imageUrl: item.imageUrl
    });
  });

  dbData.affiliateLinks = [...newLinks, ...dbData.affiliateLinks];
  saveDatabase(dbData);

  // Automatically fetch and persist og:image thumbnails on server in background
  setTimeout(() => {
    syncMissingAffiliateThumbnails().catch(() => {});
  }, 100);

  return { addedCount: newLinks.length, links: dbData.affiliateLinks };
}

export function deleteAffiliateLink(id: string): AffiliateItem[] {
  dbData.affiliateLinks = dbData.affiliateLinks.filter(l => l.id !== id);
  saveDatabase(dbData);
  return dbData.affiliateLinks;
}

export function batchDeleteAffiliateLinks(ids: string[]): AffiliateItem[] {
  const idSet = new Set(ids);
  dbData.affiliateLinks = dbData.affiliateLinks.filter(l => !idSet.has(l.id));
  saveDatabase(dbData);
  return dbData.affiliateLinks;
}

export function toggleAffiliateLink(id: string): AffiliateItem[] {
  dbData.affiliateLinks = dbData.affiliateLinks.map(l => 
    l.id === id ? { ...l, isActive: !l.isActive } : l
  );
  saveDatabase(dbData);
  return dbData.affiliateLinks;
}

export function incrementAffiliateClick(id: string): void {
  dbData.affiliateLinks = dbData.affiliateLinks.map(l => 
    l.id === id ? { ...l, clicks: (l.clicks || 0) + 1 } : l
  );
  scheduleSaveDatabase();
}

const pendingOgExtractions = new Set<string>();
let lastServerAffId: string | null = null;
export async function getRandomAffiliateLink(): Promise<AffiliateItem> {
  const activeCategories = new Set(dbData.affiliateCategories.filter(c => c.isActive).map(c => c.id));
  
  const eligible = dbData.affiliateLinks.filter(l => {
    if (!l.isActive) return false;
    if (l.categoryId && !activeCategories.has(l.categoryId)) return false;
    return true;
  });

  const pool = eligible.length > 0 ? eligible : dbData.affiliateLinks;
  if (pool.length === 0) return DEFAULT_AFFILIATE_LINKS[0];

  let candidates = pool;
  if (pool.length > 1 && lastServerAffId) {
    const filtered = pool.filter(l => l.id !== lastServerAffId);
    if (filtered.length > 0) candidates = filtered;
  }

  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  lastServerAffId = chosen.id;

  // Non-blocking background extraction if chosen link doesn't have imageUrl cached yet
  if (!chosen.imageUrl && chosen.url && chosen.url.startsWith('http') && !pendingOgExtractions.has(chosen.id)) {
    pendingOgExtractions.add(chosen.id);
    extractOgImageFromUrl(chosen.url)
      .then(({ ogImage }) => {
        if (ogImage) {
          chosen.imageUrl = ogImage;
          scheduleSaveDatabase();
        }
      })
      .catch(() => {})
      .finally(() => {
        pendingOgExtractions.delete(chosen.id);
      });
  }

  return chosen;
}

export function resetAffiliates(): { categories: AffiliateCategory[]; links: AffiliateItem[] } {
  dbData.affiliateCategories = DEFAULT_AFFILIATE_CATEGORIES;
  dbData.affiliateLinks = DEFAULT_AFFILIATE_LINKS;
  saveDatabase(dbData);
  return { categories: dbData.affiliateCategories, links: dbData.affiliateLinks };
}

// --- SITE SETTINGS API ---
export function getSiteSettings(): SiteSettings {
  return dbData.siteSettings;
}

export function saveSiteSettings(settings: Partial<SiteSettings>): SiteSettings {
  dbData.siteSettings = {
    ...DEFAULT_SITE_SETTINGS,
    ...dbData.siteSettings,
    ...settings,
    siteName: settings.siteName !== undefined ? String(settings.siteName) : dbData.siteSettings.siteName,
    siteTagline: settings.siteTagline !== undefined ? String(settings.siteTagline) : dbData.siteSettings.siteTagline,
    logoUrl: settings.logoUrl !== undefined ? String(settings.logoUrl) : (dbData.siteSettings.logoUrl || ''),
    faviconUrl: settings.faviconUrl !== undefined ? String(settings.faviconUrl) : (dbData.siteSettings.faviconUrl || ''),
    heroBadge: settings.heroBadge !== undefined ? String(settings.heroBadge) : dbData.siteSettings.heroBadge,
    heroTitle: settings.heroTitle !== undefined ? String(settings.heroTitle) : dbData.siteSettings.heroTitle,
    heroDescription: settings.heroDescription !== undefined ? String(settings.heroDescription) : dbData.siteSettings.heroDescription,
    heroButtonText: settings.heroButtonText !== undefined ? String(settings.heroButtonText) : (dbData.siteSettings.heroButtonText ?? ''),
    heroBannerImage: settings.heroBannerImage !== undefined ? String(settings.heroBannerImage) : (dbData.siteSettings.heroBannerImage || ''),
    showHeroBanner: settings.showHeroBanner !== undefined ? Boolean(settings.showHeroBanner) : (dbData.siteSettings.showHeroBanner ?? true),
    headerCode: settings.headerCode !== undefined ? String(settings.headerCode) : (dbData.siteSettings.headerCode || ''),
    bodyCode: settings.bodyCode !== undefined ? String(settings.bodyCode) : (dbData.siteSettings.bodyCode || ''),
    apiKey: settings.apiKey !== undefined ? String(settings.apiKey) : (dbData.siteSettings.apiKey || DEFAULT_SITE_SETTINGS.apiKey || 'goiom_api_secret_2025'),
    requireApiKey: settings.requireApiKey !== undefined ? Boolean(settings.requireApiKey) : Boolean(dbData.siteSettings.requireApiKey),
  };
  saveDatabase(dbData);
  return dbData.siteSettings;
}

export function resetSiteSettings(): SiteSettings {
  dbData.siteSettings = { ...DEFAULT_SITE_SETTINGS };
  saveDatabase(dbData);
  return dbData.siteSettings;
}

// --- SUPABASE CONFIG API ---
export function getSupabaseConfig() {
  return {
    url: dbData.supabaseConfig?.url || '',
    anonKey: dbData.supabaseConfig?.anonKey ? '••••••••' + dbData.supabaseConfig.anonKey.slice(-6) : '',
    hasKey: Boolean(dbData.supabaseConfig?.anonKey),
    isConfigured: Boolean(serverSupabase)
  };
}

export async function saveSupabaseConfig(url: string, anonKey: string): Promise<{ success: boolean; message: string }> {
  const cleanUrl = (url || '').trim();
  const cleanKey = (anonKey || '').trim();

  const isConnected = initServerSupabase(cleanUrl, cleanKey);
  
  dbData.supabaseConfig = {
    url: cleanUrl,
    anonKey: cleanKey,
    configured: isConnected
  };
  saveDatabase(dbData);

  if (isConnected && serverSupabase) {
    try {
      const { count, error } = await serverSupabase.from('tracks').select('*', { count: 'exact', head: true });
      if (error) {
        return { success: false, message: `Kết nối được nhưng bảng tracks lỗi: ${error.message}` };
      }
      return { success: true, message: `Kết nối Supabase Cloud SQL thành công! Đã tìm thấy ${count || 0} bản ghi.` };
    } catch (e: any) {
      return { success: true, message: 'Đã lưu cấu hình Supabase trên Server!' };
    }
  }

  return { 
    success: false, 
    message: cleanUrl ? 'URL hoặc Anon Key không hợp lệ.' : 'Đã xóa cấu hình Supabase, hệ thống sử dụng cơ sở dữ liệu Server JSON.' 
  };
}

// --- ADMIN ACCOUNTS MANAGEMENT & AUTH API (SERVER PERSISTENT) ---
export function getAdminAccounts(): AdminAccount[] {
  if (!Array.isArray(dbData.adminAccounts)) {
    dbData.adminAccounts = DEFAULT_ADMIN_ACCOUNTS.map(acc => ({ ...acc }));
    saveDatabase(dbData);
  }
  return dbData.adminAccounts;
}

export function verifyAdminCredentials(
  identifier: string,
  password: string
): { success: boolean; account?: AdminAccount; error?: string } {
  const accounts = getAdminAccounts();
  // Ensure at least default account exists if array became completely empty
  if (accounts.length === 0) {
    dbData.adminAccounts = DEFAULT_ADMIN_ACCOUNTS.map(acc => ({ ...acc }));
    saveDatabase(dbData);
  }

  const cleanId = (identifier || '').trim().toLowerCase();
  const cleanPass = (password || '').trim();

  if (!cleanId || !cleanPass) {
    return { success: false, error: 'Vui lòng nhập đầy đủ Email/Tên đăng nhập và Mật khẩu.' };
  }

  const matched = dbData.adminAccounts.find(
    (acc) =>
      acc.email.trim().toLowerCase() === cleanId ||
      (acc.username && acc.username.trim().toLowerCase() === cleanId)
  );

  if (!matched) {
    return {
      success: false,
      error: 'Tài khoản quản trị không tồn tại trên hệ thống!'
    };
  }

  if (matched.password !== cleanPass) {
    return {
      success: false,
      error: 'Mật khẩu không chính xác! Vui lòng kiểm tra lại.'
    };
  }

  return {
    success: true,
    account: matched
  };
}

export function createAdminAccount(payload: {
  email: string;
  username?: string;
  password: string;
  name?: string;
  role?: string;
}): { success: boolean; account?: AdminAccount; accounts: AdminAccount[]; error?: string } {
  const accounts = getAdminAccounts();
  const cleanEmail = (payload.email || '').trim().toLowerCase();
  const cleanUsername = (payload.username || '').trim().toLowerCase();
  const cleanPassword = (payload.password || '').trim();
  const cleanName = (payload.name || '').trim() || 'Quản Trị Viên';
  const cleanRole = (payload.role || '').trim() || 'Admin';

  if (!cleanEmail) {
    return { success: false, accounts, error: 'Vui lòng nhập Email hoặc Tên tài khoản quản trị.' };
  }
  if (!cleanPassword || cleanPassword.length < 3) {
    return { success: false, accounts, error: 'Mật khẩu phải có ít nhất 3 ký tự.' };
  }

  const exists = accounts.some(
    (acc) =>
      acc.email.trim().toLowerCase() === cleanEmail ||
      (cleanUsername && acc.username && acc.username.trim().toLowerCase() === cleanUsername) ||
      (cleanUsername && acc.email.trim().toLowerCase() === cleanUsername)
  );

  if (exists) {
    return {
      success: false,
      accounts,
      error: `Tài khoản "${cleanEmail}" đã tồn tại trong danh sách quản trị!`
    };
  }

  const newAccount: AdminAccount = {
    id: 'admin-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    email: cleanEmail,
    username: cleanUsername || cleanEmail.split('@')[0],
    password: cleanPassword,
    name: cleanName,
    role: cleanRole,
    isDefault: false,
    createdAt: new Date().toISOString()
  };

  dbData.adminAccounts = [...accounts, newAccount];
  saveDatabase(dbData);

  return {
    success: true,
    account: newAccount,
    accounts: dbData.adminAccounts
  };
}

export function updateAdminAccount(
  id: string,
  payload: {
    email?: string;
    username?: string;
    password?: string;
    name?: string;
    role?: string;
  }
): { success: boolean; account?: AdminAccount; accounts: AdminAccount[]; error?: string } {
  const accounts = getAdminAccounts();
  const idx = accounts.findIndex((a) => a.id === id);
  if (idx === -1) {
    return {
      success: false,
      accounts,
      error: 'Không tìm thấy tài khoản quản trị cần cập nhật.'
    };
  }

  const target = accounts[idx];
  const nextEmail = payload.email !== undefined ? payload.email.trim().toLowerCase() : target.email;
  const nextUsername =
    payload.username !== undefined
      ? payload.username.trim().toLowerCase()
      : target.username || nextEmail.split('@')[0];
  const nextPassword =
    payload.password !== undefined && payload.password.trim() !== ''
      ? payload.password.trim()
      : target.password;
  const nextName = payload.name !== undefined ? payload.name.trim() : target.name;
  const nextRole = payload.role !== undefined ? payload.role.trim() : target.role;

  if (!nextEmail) {
    return {
      success: false,
      accounts,
      error: 'Email / Tên đăng nhập không được để trống.'
    };
  }

  const duplicate = accounts.some(
    (acc) =>
      acc.id !== id &&
      (acc.email.trim().toLowerCase() === nextEmail ||
        (nextUsername && acc.username && acc.username.trim().toLowerCase() === nextUsername))
  );

  if (duplicate) {
    return {
      success: false,
      accounts,
      error: `Email hoặc tên đăng nhập "${nextEmail}" đã trùng với một tài khoản khác!`
    };
  }

  const updatedAccount: AdminAccount = {
    ...target,
    email: nextEmail,
    username: nextUsername,
    password: nextPassword,
    name: nextName || 'Quản Trị Viên',
    role: nextRole || target.role || 'Super Admin',
    updatedAt: new Date().toISOString()
  };

  dbData.adminAccounts = accounts.map((acc) => (acc.id === id ? updatedAccount : acc));
  saveDatabase(dbData);

  return {
    success: true,
    account: updatedAccount,
    accounts: dbData.adminAccounts
  };
}

export function deleteAdminAccount(id: string): {
  success: boolean;
  accounts: AdminAccount[];
  error?: string;
} {
  const accounts = getAdminAccounts();
  const exists = accounts.some((a) => a.id === id);
  if (!exists) {
    return {
      success: false,
      accounts,
      error: 'Không tìm thấy tài khoản quản trị cần xóa.'
    };
  }

  dbData.adminAccounts = accounts.filter((a) => a.id !== id);
  saveDatabase(dbData);

  return {
    success: true,
    accounts: dbData.adminAccounts
  };
}

// --- BACKUP, RESTORE & SLUG FILE NORMALIZATION API ---
export interface BackupStatusInfo {
  dbFile: {
    path: string;
    exists: boolean;
    sizeBytes: number;
    updatedAt: string;
    storiesCount: number;
    chaptersCount: number;
    affiliatesCount: number;
    categoriesCount: number;
    adminsCount: number;
  };
  uploadsDir: {
    rootPath: string;
    audioPath: string;
    imagesPath: string;
    audioFilesCount: number;
    imageFilesCount: number;
    totalSizeBytes: number;
    audioFiles: Array<{
      filename: string;
      url: string;
      sizeBytes: number;
      updatedAt: string;
    }>;
  };
  snapshots: Array<{
    filename: string;
    createdAt: string;
    sizeBytes: number;
    storiesCount: number;
    chaptersCount: number;
  }>;
}

export function getBackupStatusInfo(): BackupStatusInfo {
  // 1. Inspect data/db.json
  let dbSizeBytes = 0;
  let dbUpdatedAt = new Date().toISOString();
  const dbExists = fs.existsSync(DB_FILE);
  if (dbExists) {
    try {
      const stat = fs.statSync(DB_FILE);
      dbSizeBytes = stat.size;
      dbUpdatedAt = stat.mtime.toISOString();
    } catch {
      // ignore
    }
  }

  const storiesCount = dbData.tracks.length;
  const chaptersCount = dbData.tracks.reduce(
    (sum, t) => sum + (Array.isArray(t.chapters) && t.chapters.length > 0 ? t.chapters.length : 1),
    0
  );

  // 2. Inspect uploads/audio & uploads/images
  const audioFiles: Array<{ filename: string; url: string; sizeBytes: number; updatedAt: string }> = [];
  let totalUploadBytes = 0;

  if (fs.existsSync(UPLOAD_AUDIO_DIR)) {
    try {
      for (const name of fs.readdirSync(UPLOAD_AUDIO_DIR)) {
        const full = path.join(UPLOAD_AUDIO_DIR, name);
        const st = fs.statSync(full);
        if (st.isFile()) {
          totalUploadBytes += st.size;
          audioFiles.push({
            filename: name,
            url: `/uploads/audio/${name}`,
            sizeBytes: st.size,
            updatedAt: st.mtime.toISOString()
          });
        }
      }
    } catch {
      // ignore
    }
  }

  audioFiles.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  let imageFilesCount = 0;
  if (fs.existsSync(UPLOAD_IMAGE_DIR)) {
    try {
      for (const name of fs.readdirSync(UPLOAD_IMAGE_DIR)) {
        const full = path.join(UPLOAD_IMAGE_DIR, name);
        const st = fs.statSync(full);
        if (st.isFile()) {
          imageFilesCount++;
          totalUploadBytes += st.size;
        }
      }
    } catch {
      // ignore
    }
  }

  // 3. Inspect backups/ snapshots
  const snapshots: Array<{
    filename: string;
    createdAt: string;
    sizeBytes: number;
    storiesCount: number;
    chaptersCount: number;
  }> = [];

  if (fs.existsSync(BACKUP_DIR)) {
    try {
      for (const name of fs.readdirSync(BACKUP_DIR)) {
        if (!name.endsWith('.json')) continue;
        const full = path.join(BACKUP_DIR, name);
        const st = fs.statSync(full);
        if (st.isFile()) {
          let snapStories = 0;
          let snapChapters = 0;
          try {
            const parsed = JSON.parse(fs.readFileSync(full, 'utf-8'));
            if (Array.isArray(parsed.tracks)) {
              snapStories = parsed.tracks.length;
              snapChapters = parsed.tracks.reduce(
                (acc: number, t: any) => acc + (Array.isArray(t.chapters) ? t.chapters.length : 1),
                0
              );
            }
          } catch {
            // ignore
          }
          snapshots.push({
            filename: name,
            createdAt: st.mtime.toISOString(),
            sizeBytes: st.size,
            storiesCount: snapStories,
            chaptersCount: snapChapters
          });
        }
      }
    } catch {
      // ignore
    }
  }

  snapshots.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    dbFile: {
      path: 'data/db.json',
      exists: dbExists,
      sizeBytes: dbSizeBytes,
      updatedAt: dbUpdatedAt,
      storiesCount,
      chaptersCount,
      affiliatesCount: dbData.affiliateLinks.length,
      categoriesCount: dbData.affiliateCategories.length,
      adminsCount: dbData.adminAccounts.length
    },
    uploadsDir: {
      rootPath: 'uploads/',
      audioPath: 'uploads/audio/',
      imagesPath: 'uploads/images/',
      audioFilesCount: audioFiles.length,
      imageFilesCount,
      totalSizeBytes: totalUploadBytes,
      audioFiles
    },
    snapshots
  };
}

export function getRawDatabaseData(): ServerDBData {
  return dbData;
}

export function createServerSnapshot(label?: string): {
  success: boolean;
  filename?: string;
  info: BackupStatusInfo;
  error?: string;
} {
  try {
    const now = new Date();
    const stamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const cleanLabel = label ? '-' + slugifyVietnamese(label).slice(0, 24) : '';
    const filename = `db-backup-${stamp}${cleanLabel}.json`;
    const targetPath = path.join(BACKUP_DIR, filename);

    fs.writeFileSync(targetPath, JSON.stringify(dbData, null, 2), 'utf-8');
    return {
      success: true,
      filename,
      info: getBackupStatusInfo()
    };
  } catch (err: any) {
    return {
      success: false,
      info: getBackupStatusInfo(),
      error: err.message
    };
  }
}

export function restoreDatabaseFromJson(rawJson: any): {
  success: boolean;
  message: string;
  info: BackupStatusInfo;
} {
  try {
    const parsed = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
    if (!parsed || typeof parsed !== 'object') {
      return {
        success: false,
        message: 'File JSON không hợp lệ hoặc bị hỏng cấu trúc.',
        info: getBackupStatusInfo()
      };
    }

    if (!Array.isArray(parsed.tracks)) {
      return {
        success: false,
        message: 'File backup thiếu danh sách truyện (tracks). Vui lòng chọn đúng file db.json của hệ thống.',
        info: getBackupStatusInfo()
      };
    }

    // Create an automatic safety snapshot before overwriting db.json
    createServerSnapshot('auto-before-restore');

    const restoredData: ServerDBData = {
      tracks: parsed.tracks,
      affiliateCategories: Array.isArray(parsed.affiliateCategories)
        ? parsed.affiliateCategories
        : dbData.affiliateCategories,
      affiliateLinks: Array.isArray(parsed.affiliateLinks)
        ? parsed.affiliateLinks
        : dbData.affiliateLinks,
      siteSettings: parsed.siteSettings
        ? { ...DEFAULT_SITE_SETTINGS, ...parsed.siteSettings }
        : dbData.siteSettings,
      adminAccounts:
        Array.isArray(parsed.adminAccounts) && parsed.adminAccounts.length > 0
          ? parsed.adminAccounts
          : dbData.adminAccounts,
      supabaseConfig: parsed.supabaseConfig || dbData.supabaseConfig
    };

    saveDatabase(restoredData);

    return {
      success: true,
      message: `Đã khôi phục thành công ${restoredData.tracks.length} bộ truyện, ${restoredData.affiliateLinks.length} link affiliate và toàn bộ cấu hình vào data/db.json!`,
      info: getBackupStatusInfo()
    };
  } catch (err: any) {
    return {
      success: false,
      message: 'Lỗi khi khôi phục dữ liệu: ' + (err.message || 'Định dạng JSON lỗi'),
      info: getBackupStatusInfo()
    };
  }
}

export function restoreFromServerSnapshot(filename: string): {
  success: boolean;
  message: string;
  info: BackupStatusInfo;
} {
  const safeName = path.basename(filename);
  const fullPath = path.join(BACKUP_DIR, safeName);
  if (!fs.existsSync(fullPath)) {
    return {
      success: false,
      message: `Không tìm thấy bản sao lưu "${safeName}" trên Server.`,
      info: getBackupStatusInfo()
    };
  }

  const raw = fs.readFileSync(fullPath, 'utf-8');
  return restoreDatabaseFromJson(raw);
}

export function deleteServerSnapshot(filename: string): {
  success: boolean;
  info: BackupStatusInfo;
  error?: string;
} {
  const safeName = path.basename(filename);
  const fullPath = path.join(BACKUP_DIR, safeName);
  try {
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
    return {
      success: true,
      info: getBackupStatusInfo()
    };
  } catch (err: any) {
    return {
      success: false,
      info: getBackupStatusInfo(),
      error: err.message
    };
  }
}

/**
 * Quét toàn bộ db.json và thư mục uploads/audio/ để chuẩn hóa 100% tên file MP3 theo slug tiêu đề tập
 */
export function normalizeAllAudioFilesToSlug(): {
  success: boolean;
  updatedChaptersCount: number;
  message: string;
  info: BackupStatusInfo;
} {
  let updatedCount = 0;

  dbData.tracks = dbData.tracks.map((track) => {
    const chapters = Array.isArray(track.chapters) ? track.chapters : [];
    const nextChapters = chapters.map((ch, idx) => {
      const chTitle = ch.title || `Phần ${idx + 1}`;
      if (ch.mp3_url && ch.mp3_url.startsWith('/uploads/audio/')) {
        const normalizedUrl = normalizeLocalChapterAudioSlug(chTitle, ch.mp3_url);
        if (normalizedUrl !== ch.mp3_url) {
          updatedCount++;
          return { ...ch, mp3_url: normalizedUrl };
        }
      }
      return ch;
    });

    const nextPrimaryMp3 =
      nextChapters[0]?.mp3_url ||
      (track.mp3_url && track.mp3_url.startsWith('/uploads/audio/')
        ? normalizeLocalChapterAudioSlug(nextChapters[0]?.title || track.title, track.mp3_url)
        : track.mp3_url);

    return {
      ...track,
      mp3_url: nextPrimaryMp3,
      chapters: nextChapters
    };
  });

  if (updatedCount > 0) {
    saveDatabase(dbData);
  }

  return {
    success: true,
    updatedChaptersCount: updatedCount,
    message:
      updatedCount > 0
        ? `Đã chuẩn hóa thành công ${updatedCount} đường dẫn & tên file MP3 theo chuẩn slug tiêu đề tập trong uploads/audio/ và data/db.json!`
        : 'Tất cả các file MP3 trong uploads/audio/ và data/db.json đều đã chuẩn hóa 100% theo slug tiêu đề tập!',
    info: getBackupStatusInfo()
  };
}


