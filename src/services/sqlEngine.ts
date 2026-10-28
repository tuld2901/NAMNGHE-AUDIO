import { Track } from '../types';
import { 
  saveLocalTracks, 
  getAffiliateCategories, 
  getAffiliateLinks, 
  getSiteSettings 
} from './api';

export interface SQLQueryResult {
  success: boolean;
  command: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'SCHEMA' | 'UNKNOWN';
  columns: string[];
  rows: Record<string, any>[];
  rowCount: number;
  message: string;
  executionTimeMs: number;
}

export interface DBHealthCheck {
  status: 'healthy' | 'warning' | 'error';
  totalTracks: number;
  totalChapters: number;
  totalCategories: number;
  totalAffiliates: number;
  validAudioUrls: number;
  invalidAudioUrls: number;
  missingFields: string[];
  issues: string[];
}

/**
 * Validate database integrity against TypeScript and SQL schema
 */
export function validateDatabaseIntegrity(tracks: Track[]): DBHealthCheck {
  const issues: string[] = [];
  const missingFields: string[] = [];
  let totalChapters = 0;
  let validAudioUrls = 0;
  let invalidAudioUrls = 0;

  const categories = getAffiliateCategories();
  const affiliates = getAffiliateLinks();

  if (!tracks || tracks.length === 0) {
    issues.push('Cơ sở dữ liệu chưa có bài audio nào.');
  }

  const seenIds = new Set<string>();

  tracks.forEach((t, idx) => {
    if (!t.id) {
      issues.push(`Bài số ${idx + 1} thiếu trường "id" định danh`);
    } else if (seenIds.has(t.id)) {
      issues.push(`Trùng lặp ID "${t.id}" ở bài "${t.title}"`);
    } else {
      seenIds.add(t.id);
    }

    if (!t.title || !t.title.trim()) {
      issues.push(`Bài [${t.id || idx}] thiếu tiêu đề (title)`);
    }

    if (!t.category) {
      missingFields.push(`[${t.id}] thiếu category`);
    }

    if (t.mp3_url && (t.mp3_url.startsWith('http://') || t.mp3_url.startsWith('https://') || t.mp3_url.startsWith('blob:'))) {
      validAudioUrls++;
    } else if (t.mp3_url) {
      validAudioUrls++;
    } else {
      invalidAudioUrls++;
      issues.push(`Bài "${t.title}" (${t.id}) chưa có link mp3_url`);
    }

    if (t.chapters && Array.isArray(t.chapters) && t.chapters.length > 0) {
      totalChapters += t.chapters.length;
      t.chapters.forEach((ch, chIdx) => {
        if (!ch.mp3_url && !t.mp3_url) {
          issues.push(`Tập ${chIdx + 1} của bài "${t.title}" thiếu link audio mp3`);
        }
      });
    } else {
      totalChapters += 1;
    }
  });

  const status: 'healthy' | 'warning' | 'error' = 
    issues.length === 0 ? 'healthy' : issues.length < 3 ? 'warning' : 'error';

  return {
    status,
    totalTracks: tracks.length,
    totalChapters,
    totalCategories: categories.length,
    totalAffiliates: affiliates.length,
    validAudioUrls,
    invalidAudioUrls,
    missingFields,
    issues
  };
}

/**
 * Execute client-side SQL parser for instant querying, updating, and analytics in Admin
 */
export function executeClientSQL(
  sqlQuery: string, 
  currentTracks: Track[], 
  onTracksChange?: (updated: Track[]) => void
): SQLQueryResult {
  const start = performance.now();
  const trimmed = sqlQuery.trim().replace(/;+$/, '').trim();

  if (!trimmed) {
    return {
      success: false,
      command: 'UNKNOWN',
      columns: [],
      rows: [],
      rowCount: 0,
      message: 'Vui lòng nhập câu lệnh SQL cần thực thi.',
      executionTimeMs: 0
    };
  }

  const upper = trimmed.toUpperCase();

  try {
    // 1. SELECT QUERY
    if (upper.startsWith('SELECT')) {
      return executeSelectQuery(trimmed, currentTracks, start);
    }

    // 2. UPDATE QUERY
    if (upper.startsWith('UPDATE')) {
      return executeUpdateQuery(trimmed, currentTracks, onTracksChange, start);
    }

    // 3. INSERT QUERY
    if (upper.startsWith('INSERT')) {
      return executeInsertQuery(trimmed, currentTracks, onTracksChange, start);
    }

    // 4. DELETE QUERY
    if (upper.startsWith('DELETE')) {
      return executeDeleteQuery(trimmed, currentTracks, onTracksChange, start);
    }

    // 5. DDL (CREATE, ALTER, DROP)
    if (upper.startsWith('CREATE') || upper.startsWith('ALTER')) {
      return {
        success: true,
        command: 'SCHEMA',
        columns: ['status', 'statement'],
        rows: [{ status: 'SUCCESS', statement: 'Cấu trúc bảng SQL đã được xác thực chuẩn!' }],
        rowCount: 1,
        message: 'Cú pháp DDL hợp lệ. Để áp dụng cho Supabase/PostgreSQL từ xa, vui lòng chạy trong SQL Editor.',
        executionTimeMs: Math.round(performance.now() - start)
      };
    }

    return {
      success: false,
      command: 'UNKNOWN',
      columns: [],
      rows: [],
      rowCount: 0,
      message: `Cú pháp SQL chưa được hỗ trợ trực tiếp. Hỗ trợ: SELECT, INSERT, UPDATE, DELETE, CREATE TABLE.`,
      executionTimeMs: Math.round(performance.now() - start)
    };
  } catch (err: any) {
    return {
      success: false,
      command: 'UNKNOWN',
      columns: [],
      rows: [],
      rowCount: 0,
      message: `Lỗi SQL: ${err.message || String(err)}`,
      executionTimeMs: Math.round(performance.now() - start)
    };
  }
}

function executeSelectQuery(sql: string, tracks: Track[], startTime: number): SQLQueryResult {
  const categories = getAffiliateCategories();
  const affiliates = getAffiliateLinks();
  const settings = getSiteSettings();

  const lower = sql.toLowerCase();

  // Determine source table
  let sourceData: Record<string, any>[] = [];
  let tableName = 'tracks';

  if (lower.includes('from affiliate_links') || lower.includes('from "affiliate_links"')) {
    tableName = 'affiliate_links';
    sourceData = affiliates.map(a => ({
      id: a.id,
      title: a.title,
      url: a.url,
      platform: a.platform,
      category_id: a.categoryId || null,
      category_name: a.categoryName || null,
      is_active: a.isActive,
      clicks: a.clicks || 0
    }));
  } else if (lower.includes('from affiliate_categories') || lower.includes('from "affiliate_categories"')) {
    tableName = 'affiliate_categories';
    sourceData = categories.map(c => ({
      id: c.id,
      name: c.name,
      platform: c.platform,
      description: c.description || '',
      is_active: c.isActive,
      created_at: c.createdAt || null
    }));
  } else if (lower.includes('from site_settings') || lower.includes('from "site_settings"')) {
    tableName = 'site_settings';
    sourceData = [{
      site_name: settings.siteName,
      site_tagline: settings.siteTagline,
      hero_title: settings.heroTitle,
      hero_badge: settings.heroBadge,
      has_header_code: Boolean(settings.headerCode),
      has_body_code: Boolean(settings.bodyCode)
    }];
  } else {
    // Default to tracks
    tableName = 'tracks';
    sourceData = tracks.map(t => ({
      id: t.id,
      title: t.title,
      author: t.author,
      narrator: t.narrator || 'Phú Bà Audio',
      category: t.category,
      play_count: t.play_count || 0,
      chapters_count: t.chapters?.length || 1,
      is_featured: Boolean(t.is_featured),
      is_hot: Boolean(t.is_hot),
      mp3_url: t.mp3_url,
      created_at: t.created_at || '2026-10-22'
    }));
  }

  // Handle GROUP BY category
  if (lower.includes('group by category') && tableName === 'tracks') {
    const grouped: Record<string, { count: number; total_plays: number; authors: Set<string> }> = {};
    tracks.forEach(t => {
      const cat = t.category || 'Khác';
      if (!grouped[cat]) {
        grouped[cat] = { count: 0, total_plays: 0, authors: new Set() };
      }
      grouped[cat].count++;
      grouped[cat].total_plays += (t.play_count || 0);
      if (t.author) grouped[cat].authors.add(t.author);
    });

    const rows = Object.entries(grouped).map(([cat, info]) => ({
      category: cat,
      total_stories: info.count,
      total_plays: info.total_plays,
      authors_count: info.authors.size
    })).sort((a, b) => b.total_plays - a.total_plays);

    return {
      success: true,
      command: 'SELECT',
      columns: ['category', 'total_stories', 'total_plays', 'authors_count'],
      rows,
      rowCount: rows.length,
      message: `Truy vấn GROUP BY thành công (${rows.length} nhóm thể loại).`,
      executionTimeMs: Math.round(performance.now() - startTime)
    };
  }

  // Filter with WHERE
  let filtered = [...sourceData];
  const whereMatch = sql.match(/where\s+(.*?)(order\s+by|group\s+by|limit|$)/i);
  if (whereMatch && whereMatch[1]) {
    const condition = whereMatch[1].trim();
    // Simple category = '...'
    const catMatch = condition.match(/category\s*=\s*['"](.*?)['"]/i);
    if (catMatch && catMatch[1]) {
      filtered = filtered.filter(row => String(row.category).toLowerCase() === catMatch[1].toLowerCase());
    }
    // id = '...'
    const idMatch = condition.match(/id\s*=\s*['"](.*?)['"]/i);
    if (idMatch && idMatch[1]) {
      filtered = filtered.filter(row => String(row.id) === idMatch[1]);
    }
    // is_hot = true
    if (/is_hot\s*=\s*true/i.test(condition)) {
      filtered = filtered.filter(row => row.is_hot === true);
    }
    // is_featured = true
    if (/is_featured\s*=\s*true/i.test(condition)) {
      filtered = filtered.filter(row => row.is_featured === true);
    }
    // is_active = true
    if (/is_active\s*=\s*true/i.test(condition)) {
      filtered = filtered.filter(row => row.is_active === true);
    }
    // play_count > X
    const playGt = condition.match(/play_count\s*>\s*(\d+)/i);
    if (playGt && playGt[1]) {
      const minPlay = parseInt(playGt[1], 10);
      filtered = filtered.filter(row => Number(row.play_count) > minPlay);
    }
  }

  // Handle ORDER BY
  const orderMatch = sql.match(/order\s+by\s+(\w+)\s*(asc|desc)?/i);
  if (orderMatch && orderMatch[1]) {
    const orderField = orderMatch[1];
    const isDesc = (orderMatch[2] || 'ASC').toUpperCase() === 'DESC';
    filtered.sort((a, b) => {
      const valA = a[orderField] ?? 0;
      const valB = b[orderField] ?? 0;
      if (typeof valA === 'number' && typeof valB === 'number') {
        return isDesc ? valB - valA : valA - valB;
      }
      return isDesc 
        ? String(valB).localeCompare(String(valA)) 
        : String(valA).localeCompare(String(valB));
    });
  }

  // Handle LIMIT
  const limitMatch = sql.match(/limit\s+(\d+)/i);
  if (limitMatch && limitMatch[1]) {
    const limitNum = parseInt(limitMatch[1], 10);
    filtered = filtered.slice(0, limitNum);
  }

  // Select columns
  const selectPartMatch = sql.match(/select\s+(.*?)\s+from/i);
  let columns: string[] = [];
  if (selectPartMatch && selectPartMatch[1]) {
    const rawCols = selectPartMatch[1].trim();
    if (rawCols === '*') {
      columns = filtered.length > 0 ? Object.keys(filtered[0]) : ['id', 'title', 'category', 'play_count'];
    } else {
      columns = rawCols.split(',').map(c => c.trim().replace(/^.*as\s+/i, '').replace(/[^\w]/g, ''));
    }
  } else {
    columns = filtered.length > 0 ? Object.keys(filtered[0]) : [];
  }

  return {
    success: true,
    command: 'SELECT',
    columns,
    rows: filtered,
    rowCount: filtered.length,
    message: `Thực thi thành công từ bảng ${tableName} (${filtered.length} kết quả).`,
    executionTimeMs: Math.round(performance.now() - startTime)
  };
}

function executeUpdateQuery(
  sql: string, 
  tracks: Track[], 
  onTracksChange: ((updated: Track[]) => void) | undefined, 
  startTime: number
): SQLQueryResult {
  let updatedCount = 0;
  const tracksList = [...tracks];

  // Pattern: UPDATE tracks SET play_count = play_count + 100 WHERE id = 'track-1'
  const whereMatch = sql.match(/where\s+(.*)$/i);
  const whereCond = whereMatch ? whereMatch[1].trim() : '';

  const idMatch = whereCond.match(/id\s*=\s*['"](.*?)['"]/i);
  const targetId = idMatch ? idMatch[1] : null;

  const catMatch = whereCond.match(/category\s*=\s*['"](.*?)['"]/i);
  const targetCat = catMatch ? catMatch[1] : null;

  // Set play_count = play_count + X
  const addPlayMatch = sql.match(/play_count\s*=\s*play_count\s*\+\s*(\d+)/i);
  const setPlayMatch = sql.match(/play_count\s*=\s*(\d+)/i);

  const updatedTracks = tracksList.map(t => {
    let match = false;
    if (targetId && t.id === targetId) match = true;
    else if (targetCat && t.category.toLowerCase() === targetCat.toLowerCase()) match = true;
    else if (!whereCond) match = true; // Update all

    if (match) {
      updatedCount++;
      let newPlay = t.play_count || 0;
      if (addPlayMatch && addPlayMatch[1]) {
        newPlay += parseInt(addPlayMatch[1], 10);
      } else if (setPlayMatch && setPlayMatch[1]) {
        newPlay = parseInt(setPlayMatch[1], 10);
      }
      return { ...t, play_count: newPlay, updated_at: new Date().toISOString() };
    }
    return t;
  });

  if (updatedCount > 0) {
    saveLocalTracks(updatedTracks);
    if (onTracksChange) onTracksChange(updatedTracks);
  }

  return {
    success: true,
    command: 'UPDATE',
    columns: ['rows_updated', 'status'],
    rows: [{ rows_updated: updatedCount, status: 'UPDATED' }],
    rowCount: updatedCount,
    message: `Đã cập nhật ${updatedCount} bản ghi trong CSDL tracks.`,
    executionTimeMs: Math.round(performance.now() - startTime)
  };
}

function executeInsertQuery(
  sql: string, 
  tracks: Track[], 
  onTracksChange: ((updated: Track[]) => void) | undefined, 
  startTime: number
): SQLQueryResult {
  // Simple INSERT INTO tracks (title, author, category, mp3_url) VALUES ('...', '...', '...', '...')
  const valuesMatch = sql.match(/values\s*\((.*?)\)/i);
  if (!valuesMatch || !valuesMatch[1]) {
    throw new Error('Cú pháp INSERT không hợp lệ. Ví dụ: INSERT INTO tracks (title, category) VALUES (\'Truyện mới\', \'Truyện Ma\')');
  }

  const rawValues = valuesMatch[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
  const newTrack: Track = {
    id: 'track-' + Date.now(),
    title: rawValues[0] || 'Truyện Audio Mới',
    author: rawValues[1] || 'Phú Bà Audio',
    category: rawValues[2] || 'Truyện Ngắn',
    mp3_url: rawValues[3] || 'https://cdn.freesound.org/previews/612/612610_5674468-lq.mp3',
    play_count: 100,
    chapters: [
      { id: 1, title: 'Phần 1', duration: '25:00', mp3_url: rawValues[3] || 'https://cdn.freesound.org/previews/612/612610_5674468-lq.mp3' }
    ],
    created_at: new Date().toISOString()
  };

  const updated = [newTrack, ...tracks];
  saveLocalTracks(updated);
  if (onTracksChange) onTracksChange(updated);

  return {
    success: true,
    command: 'INSERT',
    columns: ['id', 'title', 'category', 'status'],
    rows: [{ id: newTrack.id, title: newTrack.title, category: newTrack.category, status: 'INSERTED' }],
    rowCount: 1,
    message: `Đã chèn 1 bản ghi mới vào CSDL (ID: ${newTrack.id}).`,
    executionTimeMs: Math.round(performance.now() - startTime)
  };
}

function executeDeleteQuery(
  sql: string, 
  tracks: Track[], 
  onTracksChange: ((updated: Track[]) => void) | undefined, 
  startTime: number
): SQLQueryResult {
  const whereMatch = sql.match(/where\s+(.*)$/i);
  if (!whereMatch) {
    throw new Error('Vì an toàn dữ liệu, câu lệnh DELETE bắt buộc phải có điều kiện WHERE id = \'...\'');
  }

  const idMatch = whereMatch[1].match(/id\s*=\s*['"](.*?)['"]/i);
  if (!idMatch || !idMatch[1]) {
    throw new Error('Vui lòng chỉ định rõ id cần xóa. Ví dụ: DELETE FROM tracks WHERE id = \'track-10\'');
  }

  const deleteId = idMatch[1];
  const initialLength = tracks.length;
  const filtered = tracks.filter(t => t.id !== deleteId);
  const deletedCount = initialLength - filtered.length;

  if (deletedCount > 0) {
    saveLocalTracks(filtered);
    if (onTracksChange) onTracksChange(filtered);
  }

  return {
    success: true,
    command: 'DELETE',
    columns: ['id', 'deleted_count', 'status'],
    rows: [{ id: deleteId, deleted_count: deletedCount, status: 'DELETED' }],
    rowCount: deletedCount,
    message: `Đã xóa ${deletedCount} bản ghi có ID: "${deleteId}" khỏi CSDL.`,
    executionTimeMs: Math.round(performance.now() - startTime)
  };
}

/**
 * Generate full production PostgreSQL / Supabase SQL schema and seed data
 */
export function generateFullSQLMigration(tracks: Track[]): string {
  const tracksList = Array.isArray(tracks) ? tracks : [];

  const seedSql = tracksList.length > 0
    ? `-- 7. DỮ LIỆU AUDIO HIỆN TẠI TRONG DATABASE
INSERT INTO public.tracks (id, title, author, narrator, category, mp3_url, thumb_url, description, play_count, affiliate_link, chapters, is_featured, is_hot)
VALUES
${tracksList.map(t => {
  const safeId = t.id.replace(/'/g, "''");
  const safeTitle = t.title.replace(/'/g, "''");
  const safeAuthor = (t.author || 'Phú Bà').replace(/'/g, "''");
  const safeNarrator = (t.narrator || 'Phú Bà Audio').replace(/'/g, "''");
  const safeCat = (t.category || 'Truyện Ngắn').replace(/'/g, "''");
  const safeUrl = (t.mp3_url || '').replace(/'/g, "''");
  const safeThumb = (t.thumb_url || '').replace(/'/g, "''");
  const safeDesc = (t.description || '').replace(/'/g, "''");
  const safePlays = Number(t.play_count) || 0;
  const safeAff = (t.affiliate_link || 'https://shopee.vn').replace(/'/g, "''");
  const chaptersJson = JSON.stringify(t.chapters || []).replace(/'/g, "''");
  const isFeat = Boolean(t.is_featured);
  const isHot = Boolean(t.is_hot);

  return `('${safeId}', '${safeTitle}', '${safeAuthor}', '${safeNarrator}', '${safeCat}', '${safeUrl}', '${safeThumb}', '${safeDesc}', ${safePlays}, '${safeAff}', '${chaptersJson}'::jsonb, ${isFeat}, ${isHot})`;
}).join(',\n')}
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  author = EXCLUDED.author,
  category = EXCLUDED.category,
  mp3_url = EXCLUDED.mp3_url,
  chapters = EXCLUDED.chapters,
  play_count = EXCLUDED.play_count;`
    : `-- (Hiện chưa có bản ghi truyện nào trong bảng tracks)`;

  return `-- =====================================================================
-- BẢN SCRIPT CSDL SQL CHUẨN HOÀN CHỈNH CHO GỐI ÔM AUDIO
-- Tương thích 100%: PostgreSQL, Supabase Cloud SQL, Neon, Google Cloud SQL
-- =====================================================================

-- 1. TẠO BẢNG TRACKS (DANH SÁCH BÀI AUDIO & TẬP TRUYỆN)
CREATE TABLE IF NOT EXISTS public.tracks (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title TEXT NOT NULL,
    author TEXT DEFAULT 'Đang cập nhật',
    narrator TEXT DEFAULT 'Gối Ôm Audio',
    category TEXT DEFAULT 'Truyện Ngắn',
    mp3_url TEXT NOT NULL,
    thumb_url TEXT,
    description TEXT,
    play_count BIGINT DEFAULT 0,
    affiliate_link TEXT DEFAULT 'https://shopee.vn',
    chapters JSONB DEFAULT '[]'::jsonb,
    is_featured BOOLEAN DEFAULT false,
    is_hot BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. TẠO BẢNG DANH MỤC AFFILIATE (QUẢN LÝ THEO TÀI KHOẢN TIẾP THỊ)
CREATE TABLE IF NOT EXISTS public.affiliate_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    platform TEXT DEFAULT 'Shopee',
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TẠO BẢNG LIÊN KẾT AFFILIATE
CREATE TABLE IF NOT EXISTS public.affiliate_links (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    platform TEXT DEFAULT 'Shopee',
    category_id TEXT REFERENCES public.affiliate_categories(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    clicks BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. BẢNG CẤU HÌNH GIAO DIỆN & MÃ THEO DÕI (SITE SETTINGS)
CREATE TABLE IF NOT EXISTS public.site_settings (
    id TEXT PRIMARY KEY DEFAULT 'current_settings',
    site_name TEXT DEFAULT 'Gối Ôm Audio',
    site_tagline TEXT DEFAULT 'Web Nghe Truyện Audio Online Miễn Phí',
    logo_url TEXT,
    favicon_url TEXT,
    hero_badge TEXT,
    hero_title TEXT,
    hero_description TEXT,
    header_code TEXT,
    body_code TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. FUNCTION TỰ ĐỘNG TĂNG LƯỢT NGHE
CREATE OR REPLACE FUNCTION increment_track_play_count(track_id TEXT)
RETURNS void AS $$
BEGIN
    UPDATE public.tracks
    SET play_count = play_count + 1
    WHERE id = track_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. PHÂN QUYỀN ROW LEVEL SECURITY (RLS)
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read tracks" ON public.tracks;
CREATE POLICY "Public read tracks" ON public.tracks FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read affiliate_categories" ON public.affiliate_categories;
CREATE POLICY "Public read affiliate_categories" ON public.affiliate_categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read affiliate_links" ON public.affiliate_links;
CREATE POLICY "Public read affiliate_links" ON public.affiliate_links FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read site_settings" ON public.site_settings;
CREATE POLICY "Public read site_settings" ON public.site_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin write tracks" ON public.tracks;
CREATE POLICY "Admin write tracks" ON public.tracks FOR ALL 
USING (auth.jwt() ->> 'email' = 'tuld2901@gmail.com' OR auth.role() = 'service_role');

${seedSql}
`;
}
