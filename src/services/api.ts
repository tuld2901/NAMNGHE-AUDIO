import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Track, Chapter, AffiliateItem, AffiliateCategory, SiteSettings, AdminAccount } from '../types';
import {
  DEFAULT_TRACKS,
  DEFAULT_AFFILIATE_CATEGORIES,
  DEFAULT_AFFILIATE_LINKS,
  DEFAULT_SITE_SETTINGS,
  DEFAULT_ADMIN_ACCOUNTS
} from './defaultData';

export {
  DEFAULT_TRACKS,
  DEFAULT_AFFILIATE_CATEGORIES,
  DEFAULT_AFFILIATE_LINKS,
  DEFAULT_SITE_SETTINGS,
  DEFAULT_ADMIN_ACCOUNTS
};

// Admin authentication constants & server-synchronized cache
const ENV_ADMIN = (import.meta.env.VITE_ADMIN_EMAIL || '').toLowerCase();
export const ADMIN_EMAILS: string[] = [
  'tuld2901@gmail.com',
  'admin',
  ...(ENV_ADMIN ? [ENV_ADMIN] : [])
];

let cachedAdminAccounts: AdminAccount[] = [...DEFAULT_ADMIN_ACCOUNTS];

export const getAdminAccountsCache = (): AdminAccount[] => cachedAdminAccounts;

export const isAuthorizedAdminEmail = (email: string | null | undefined): boolean => {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  const inCache = cachedAdminAccounts.some(
    acc =>
      acc.email.trim().toLowerCase() === clean ||
      (acc.username && acc.username.trim().toLowerCase() === clean)
  );
  if (inCache) return true;
  if (cachedAdminAccounts.length === 0) {
    return ADMIN_EMAILS.some(adminEmail => adminEmail.toLowerCase() === clean);
  }
  return false;
};

// Supabase environment keys
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    SUPABASE_URL && 
    SUPABASE_ANON_KEY && 
    !SUPABASE_URL.includes('your-project') &&
    SUPABASE_URL.startsWith('http')
  );
};

export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// ===========================================================================
// IN-MEMORY CACHES (Synchronized continuously with Server backend)
// ===========================================================================
const ssrBootstrap =
  typeof window !== 'undefined' ? (window as any).__INITIAL_BOOTSTRAP__ : null;

let cachedTracks: Track[] =
  ssrBootstrap && Array.isArray(ssrBootstrap.tracks) && ssrBootstrap.tracks.length > 0
    ? ssrBootstrap.tracks
    : [...DEFAULT_TRACKS];
let cachedCategories: AffiliateCategory[] = [...DEFAULT_AFFILIATE_CATEGORIES];
let cachedLinks: AffiliateItem[] = [...DEFAULT_AFFILIATE_LINKS];
let cachedSettings: SiteSettings =
  ssrBootstrap && ssrBootstrap.siteSettings
    ? { ...DEFAULT_SITE_SETTINGS, ...ssrBootstrap.siteSettings }
    : { ...DEFAULT_SITE_SETTINGS };

// Synchronous getters (read from in-memory cache for instant UI rendering)
export const getLocalTracks = (): Track[] => cachedTracks;
export const saveLocalTracks = (tracks: Track[]): void => {
  cachedTracks = tracks;
};
export const getAffiliateCategories = (): AffiliateCategory[] => cachedCategories;
export const getAffiliateLinks = (): AffiliateItem[] => cachedLinks;
export const getSiteSettings = (): SiteSettings => cachedSettings;

// ===========================================================================
// 1. TRACKS & BOOTSTRAP API (CRUD DIRECTLY WITH SERVER BACKEND)
// ===========================================================================

/**
 * Single-request bootstrap for instant initial page load
 */
export const fetchBootstrapData = async (): Promise<{
  tracks: Track[];
  siteSettings: SiteSettings;
}> => {
  // If SSR already injected __INITIAL_BOOTSTRAP__ into index.html, return immediately in 0ms!
  if (ssrBootstrap && Array.isArray(ssrBootstrap.tracks) && ssrBootstrap.tracks.length > 0) {
    return {
      tracks: cachedTracks,
      siteSettings: cachedSettings,
    };
  }

  try {
    const res = await fetch('/api/bootstrap');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.tracks) && data.tracks.length > 0) {
        cachedTracks = data.tracks;
      }
      if (Array.isArray(data.categories) && data.categories.length > 0) {
        cachedCategories = data.categories;
      }
      if (Array.isArray(data.links) && data.links.length > 0) {
        cachedLinks = data.links;
      }
      if (data.siteSettings) {
        cachedSettings = { ...DEFAULT_SITE_SETTINGS, ...data.siteSettings };
      }
      return {
        tracks: cachedTracks,
        siteSettings: cachedSettings,
      };
    }
  } catch {}

  const [tracks, settings] = await Promise.all([
    fetchTracks(),
    fetchSiteSettings(),
  ]);
  return {
    tracks,
    siteSettings: settings || cachedSettings,
  };
};

/**
 * Fetch all tracks from Server (/api/tracks)
 */
export const fetchTracks = async (): Promise<Track[]> => {
  try {
    const res = await fetch('/api/tracks');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        cachedTracks = data;
        return data;
      }
    }
  } catch (err) {
    console.warn('Error fetching tracks from server, using cache:', err);
  }
  return cachedTracks;
};

const getApiAuthHeaders = (extra?: Record<string, string>): Record<string, string> => {
  const headers: Record<string, string> = { ...(extra || {}) };
  if (cachedSettings.apiKey && cachedSettings.apiKey.trim()) {
    headers['x-api-key'] = cachedSettings.apiKey.trim();
  }
  return headers;
};

/**
 * Create a new track on Server
 */
export const createTrack = async (newTrack: Partial<Track>): Promise<Track> => {
  const chapters: Chapter[] = newTrack.chapters && newTrack.chapters.length > 0
    ? newTrack.chapters
    : [{ id: 1, title: 'Phần 1', duration: '25:00', mp3_url: newTrack.mp3_url || '' }];

  const payload = {
    title: newTrack.title || 'Truyện mới',
    author: newTrack.author || 'Tác giả',
    narrator: newTrack.narrator || 'Phú Bà Audio',
    category: newTrack.category || 'Truyện Ngắn',
    mp3_url: newTrack.mp3_url || '',
    thumb_url: newTrack.thumb_url || 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80',
    description: newTrack.description || '',
    play_count: Number(newTrack.play_count) || 0,
    affiliate_link: newTrack.affiliate_link || 'https://shopee.vn',
    chapters,
    is_featured: Boolean(newTrack.is_featured),
    is_hot: Boolean(newTrack.is_hot),
  };

  try {
    const res = await fetch('/api/tracks', {
      method: 'POST',
      headers: getApiAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const created: Track = await res.json();
      cachedTracks = [created, ...cachedTracks];
      return created;
    }
  } catch (err) {
    console.error('Error creating track on server:', err);
  }

  // Fallback in case of server offline
  const fallbackCreated: Track = {
    ...payload,
    id: 'track-' + Date.now(),
    created_at: new Date().toISOString()
  };
  cachedTracks = [fallbackCreated, ...cachedTracks];
  return fallbackCreated;
};

/**
 * Update existing track on Server
 */
export const updateTrack = async (id: string, updates: Partial<Track>): Promise<Track | null> => {
  try {
    const res = await fetch(`/api/tracks/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: getApiAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(updates)
    });
    if (res.ok) {
      const updated: Track = await res.json();
      cachedTracks = cachedTracks.map(t => t.id === id ? updated : t);
      return updated;
    }
  } catch (err) {
    console.error('Error updating track on server:', err);
  }

  // Fallback
  let updatedTrack: Track | null = null;
  cachedTracks = cachedTracks.map(t => {
    if (t.id === id) {
      updatedTrack = { ...t, ...updates, updated_at: new Date().toISOString() };
      return updatedTrack;
    }
    return t;
  });
  return updatedTrack;
};

/**
 * Delete a track from Server
 */
export const deleteTrack = async (id: string): Promise<boolean> => {
  try {
    const res = await fetch(`/api/tracks/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getApiAuthHeaders()
    });
    if (res.ok) {
      cachedTracks = cachedTracks.filter(t => t.id !== id);
      return true;
    }
  } catch (err) {
    console.error('Error deleting track on server:', err);
  }

  cachedTracks = cachedTracks.filter(t => t.id !== id);
  return true;
};

/**
 * Increment track play count on Server
 */
export const incrementPlayCount = async (trackId: string): Promise<void> => {
  cachedTracks = cachedTracks.map(t => 
    t.id === trackId ? { ...t, play_count: (t.play_count || 0) + 1 } : t
  );

  try {
    await fetch(`/api/tracks/${encodeURIComponent(trackId)}/play`, {
      method: 'POST'
    });
  } catch (err) {
    console.warn('Error sending play increment to server:', err);
  }
};

/**
 * Reset default tracks on Server
 */
export const resetDefaultTracks = async (): Promise<Track[]> => {
  try {
    const res = await fetch('/api/tracks/reset', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      cachedTracks = data;
      return data;
    }
  } catch (err) {
    console.error('Error resetting tracks on server:', err);
  }
  cachedTracks = [...DEFAULT_TRACKS];
  return cachedTracks;
};

// ===========================================================================
// 2. AFFILIATE CATEGORIES API (SERVER BACKEND)
// ===========================================================================

export const fetchAffiliateCategories = async (): Promise<AffiliateCategory[]> => {
  try {
    const res = await fetch('/api/affiliates/categories');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        cachedCategories = data;
        return data;
      }
    }
  } catch (err) {
    console.warn('Error fetching categories from server:', err);
  }
  return cachedCategories;
};

export const createAffiliateCategory = async (payload: {
  name: string;
  platform?: 'Shopee' | 'TikTok' | 'Lazada' | 'Khác';
  description?: string;
}): Promise<AffiliateCategory> => {
  try {
    const res = await fetch('/api/affiliates/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const created = await res.json();
      cachedCategories = [...cachedCategories, created];
      return created;
    }
  } catch (err) {
    console.error('Error creating category on server:', err);
  }

  const fallback: AffiliateCategory = {
    id: 'cat-' + Date.now(),
    name: payload.name,
    platform: payload.platform || 'Shopee',
    description: payload.description || '',
    isActive: true,
    createdAt: new Date().toISOString()
  };
  cachedCategories = [...cachedCategories, fallback];
  return fallback;
};

export const deleteAffiliateCategoryAndLinks = async (categoryId: string): Promise<{
  categories: AffiliateCategory[];
  links: AffiliateItem[];
}> => {
  try {
    const res = await fetch(`/api/affiliates/categories/${encodeURIComponent(categoryId)}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      const data = await res.json();
      cachedCategories = data.categories;
      cachedLinks = data.links;
      return data;
    }
  } catch (err) {
    console.error('Error deleting category on server:', err);
  }

  cachedCategories = cachedCategories.filter(c => c.id !== categoryId);
  cachedLinks = cachedLinks.filter(l => l.categoryId !== categoryId);
  return { categories: cachedCategories, links: cachedLinks };
};

export const toggleAffiliateCategoryStatus = async (categoryId: string): Promise<{
  categories: AffiliateCategory[];
  links: AffiliateItem[];
}> => {
  try {
    const res = await fetch(`/api/affiliates/categories/${encodeURIComponent(categoryId)}/toggle`, {
      method: 'PUT'
    });
    if (res.ok) {
      const data = await res.json();
      cachedCategories = data.categories;
      cachedLinks = data.links;
      return data;
    }
  } catch (err) {
    console.error('Error toggling category on server:', err);
  }

  let newActiveState = false;
  cachedCategories = cachedCategories.map(c => {
    if (c.id === categoryId) {
      newActiveState = !c.isActive;
      return { ...c, isActive: newActiveState };
    }
    return c;
  });
  cachedLinks = cachedLinks.map(l => l.categoryId === categoryId ? { ...l, isActive: newActiveState } : l);
  return { categories: cachedCategories, links: cachedLinks };
};

// ===========================================================================
// 3. AFFILIATE LINKS API (SERVER BACKEND)
// ===========================================================================

export const fetchAffiliateLinks = async (): Promise<AffiliateItem[]> => {
  try {
    const res = await fetch('/api/affiliates/links');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        cachedLinks = data;
        return data;
      }
    }
  } catch (err) {
    console.warn('Error fetching affiliate links from server:', err);
  }
  return cachedLinks;
};

export const detectPlatformFromUrl = (url: string): 'Shopee' | 'TikTok' | 'Lazada' | 'Khác' => {
  const lower = (url || '').toLowerCase();
  if (lower.includes('shopee') || lower.includes('shp.ee') || lower.includes('shope.ee')) {
    return 'Shopee';
  }
  if (lower.includes('tiktok') || lower.includes('vt.tiktok') || lower.includes('shop.tiktok')) {
    return 'TikTok';
  }
  if (lower.includes('lazada') || lower.includes('s.lazada')) {
    return 'Lazada';
  }
  return 'Shopee';
};

export const bulkAddAffiliateLinks = async (
  rawItems: Array<{
    url: string;
    title?: string;
    platform?: 'Shopee' | 'TikTok' | 'Lazada' | 'Khác';
    categoryId?: string;
    isActive?: boolean;
  }>
): Promise<{ addedCount: number; links: AffiliateItem[] }> => {
  try {
    const res = await fetch('/api/affiliates/links/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: rawItems })
    });
    if (res.ok) {
      const result = await res.json();
      cachedLinks = result.links;
      return result;
    }
  } catch (err) {
    console.error('Error bulk adding links on server:', err);
  }

  // Fallback
  const newItems: AffiliateItem[] = rawItems.map((item, idx) => ({
    id: `aff-${Date.now()}-${idx}`,
    title: item.title || 'Deal Khuyến Mãi Shopee',
    url: item.url,
    platform: item.platform || detectPlatformFromUrl(item.url),
    categoryId: item.categoryId || cachedCategories[0]?.id,
    categoryName: cachedCategories.find(c => c.id === item.categoryId)?.name || 'Tài khoản chính',
    isActive: item.isActive !== undefined ? item.isActive : true,
    clicks: 0
  }));
  cachedLinks = [...newItems, ...cachedLinks];
  return { addedCount: newItems.length, links: cachedLinks };
};

export const deleteAffiliateLink = async (id: string): Promise<AffiliateItem[]> => {
  try {
    const res = await fetch(`/api/affiliates/links/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      const updated = await res.json();
      cachedLinks = updated;
      return updated;
    }
  } catch (err) {
    console.error('Error deleting affiliate link on server:', err);
  }
  cachedLinks = cachedLinks.filter(l => l.id !== id);
  return cachedLinks;
};

export const deleteMultipleAffiliateLinks = async (ids: string[]): Promise<AffiliateItem[]> => {
  try {
    const res = await fetch('/api/affiliates/links/batch-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });
    if (res.ok) {
      const updated = await res.json();
      cachedLinks = updated;
      return updated;
    }
  } catch (err) {
    console.error('Error batch deleting links on server:', err);
  }
  const idSet = new Set(ids);
  cachedLinks = cachedLinks.filter(l => !idSet.has(l.id));
  return cachedLinks;
};

export const toggleAffiliateStatus = async (id: string): Promise<AffiliateItem[]> => {
  try {
    const res = await fetch(`/api/affiliates/links/${encodeURIComponent(id)}/toggle`, {
      method: 'PUT'
    });
    if (res.ok) {
      const updated = await res.json();
      cachedLinks = updated;
      return updated;
    }
  } catch (err) {
    console.error('Error toggling affiliate status on server:', err);
  }
  cachedLinks = cachedLinks.map(l => l.id === id ? { ...l, isActive: !l.isActive } : l);
  return cachedLinks;
};

export const incrementAffiliateClick = async (id: string): Promise<void> => {
  cachedLinks = cachedLinks.map(l => l.id === id ? { ...l, clicks: (l.clicks || 0) + 1 } : l);
  try {
    await fetch(`/api/affiliates/links/${encodeURIComponent(id)}/click`, { method: 'POST' });
  } catch (err) {
    console.warn('Error recording affiliate click on server:', err);
  }
};

export const getEligibleAffiliateLinks = (): AffiliateItem[] => {
  const categoryMap = new Map(cachedCategories.map(c => [c.id, c]));
  return cachedLinks.filter(l => {
    if (!l.isActive) return false;
    if (!l.url || !l.url.trim()) return false;
    if (l.categoryId && categoryMap.has(l.categoryId)) {
      const cat = categoryMap.get(l.categoryId);
      if (cat && !cat.isActive) return false;
    }
    return true;
  });
};

let lastAffiliateId: string | null = null;
export const getRandomAffiliateLink = (): AffiliateItem => {
  const eligible = getEligibleAffiliateLinks();
  if (eligible.length === 0) {
    const anyActive = cachedLinks.find(l => l.isActive);
    if (anyActive) return anyActive;
    if (cachedLinks.length > 0) return cachedLinks[0];
    return DEFAULT_AFFILIATE_LINKS[0];
  }

  let pool = eligible;
  if (eligible.length > 1 && lastAffiliateId) {
    const nonRepeat = eligible.filter(l => l.id !== lastAffiliateId);
    if (nonRepeat.length > 0) pool = nonRepeat;
  }

  const randomIndex = Math.floor(Math.random() * pool.length);
  const chosen = pool[randomIndex];
  lastAffiliateId = chosen.id;
  return chosen;
};

/**
 * Fetch random active affiliate link directly from Server (/api/affiliates/random)
 * which also resolves and caches the product og:image thumbnail on the server.
 */
export const fetchRandomAffiliateLinkFromServer = async (): Promise<AffiliateItem> => {
  try {
    const res = await fetch('/api/affiliates/random');
    if (res.ok) {
      const data = await res.json();
      if (data && data.url) {
        return data;
      }
    }
  } catch (err) {
    console.warn('Error fetching random affiliate link from server:', err);
  }
  return getRandomAffiliateLink();
};

export const resetAffiliates = async (): Promise<{
  categories: AffiliateCategory[];
  links: AffiliateItem[];
}> => {
  try {
    const res = await fetch('/api/affiliates/reset', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      cachedCategories = data.categories;
      cachedLinks = data.links;
      return data;
    }
  } catch (err) {
    console.error('Error resetting affiliates on server:', err);
  }
  cachedCategories = [...DEFAULT_AFFILIATE_CATEGORIES];
  cachedLinks = [...DEFAULT_AFFILIATE_LINKS];
  return { categories: cachedCategories, links: cachedLinks };
};

// ===========================================================================
// 4. OPEN GRAPH OG:IMAGE EXTRACTION (FETCH FROM SERVER SCRAPER)
// ===========================================================================
export const fetchOgImage = async (url: string): Promise<string | null> => {
  if (!url || !url.startsWith('http')) return null;

  try {
    const res = await fetch(`/api/og-image?url=${encodeURIComponent(url)}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.ogImage || null;
  } catch (e) {
    console.warn('Could not fetch og:image for URL:', url, e);
  }
  return null;
};

// ===========================================================================
// 5. DAILY UNLOCK RATE LIMITING (1 LẦN TRONG NGÀY THEO NGÀY ĐỊA PHƯƠNG)
// ===========================================================================
const DAILY_UNLOCK_STORAGE_KEY = 'phuba_daily_unlock_date_v2';

const getTodayLocalDateString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const isDailyUnlockedToday = (): boolean => {
  try {
    const todayStr = getTodayLocalDateString();
    const lastUnlocked = localStorage.getItem(DAILY_UNLOCK_STORAGE_KEY);
    return lastUnlocked === todayStr;
  } catch {
    return false;
  }
};

export const markDailyUnlockedToday = (): void => {
  try {
    const todayStr = getTodayLocalDateString();
    localStorage.setItem(DAILY_UNLOCK_STORAGE_KEY, todayStr);
  } catch {
    // Ignore
  }
};

// ===========================================================================
// 6. SITE SETTINGS & BRANDING (SAVED DIRECTLY TO SERVER)
// ===========================================================================
export const fetchSiteSettings = async (): Promise<SiteSettings> => {
  try {
    const res = await fetch('/api/settings');
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        cachedSettings = { ...DEFAULT_SITE_SETTINGS, ...data };
        return cachedSettings;
      }
    }
  } catch (err) {
    console.warn('Error fetching settings from server:', err);
  }
  return cachedSettings;
};

export const saveSiteSettings = async (settings: SiteSettings): Promise<SiteSettings> => {
  cachedSettings = settings;

  // Immediately apply client-side changes
  updateFavicon(settings.faviconUrl);
  applyTrackingScripts(settings.headerCode, settings.bodyCode);

  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    if (res.ok) {
      const saved = await res.json();
      cachedSettings = saved;
      return saved;
    }
  } catch (err) {
    console.error('Error saving settings to server:', err);
  }
  return settings;
};

export const resetSiteSettingsOnServer = async (): Promise<SiteSettings> => {
  try {
    const res = await fetch('/api/settings/reset', {
      method: 'POST',
    });
    if (res.ok) {
      const saved = await res.json();
      cachedSettings = saved;
      updateFavicon(saved.faviconUrl);
      applyTrackingScripts(saved.headerCode, saved.bodyCode);
      return saved;
    }
  } catch (err) {
    console.error('Error resetting settings on server:', err);
  }
  cachedSettings = { ...DEFAULT_SITE_SETTINGS };
  return cachedSettings;
};

export const updateFavicon = (url?: string): void => {
  if (typeof document === 'undefined') return;
  try {
    let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = url || 'https://api.iconify.design/lucide:headphones.svg?color=%23f59e0b';
  } catch (e) {
    console.warn('Could not update favicon:', e);
  }
};

export const applyTrackingScripts = (headerCode?: string, bodyCode?: string): void => {
  if (typeof document === 'undefined') return;

  try {
    let headContainer = document.getElementById('custom-header-tracking-code');
    if (!headContainer) {
      headContainer = document.createElement('div');
      headContainer.id = 'custom-header-tracking-code';
      headContainer.style.display = 'none';
      document.head.appendChild(headContainer);
    }

    if (headerCode !== undefined) {
      headContainer.innerHTML = headerCode || '';
      const scripts = headContainer.querySelectorAll('script');
      scripts.forEach((oldScript) => {
        const newScript = document.createElement('script');
        Array.from(oldScript.attributes).forEach((attr) => newScript.setAttribute(attr.name, attr.value));
        newScript.textContent = oldScript.textContent;
        oldScript.parentNode?.replaceChild(newScript, oldScript);
      });
    }

    let bodyContainer = document.getElementById('custom-body-tracking-code');
    if (!bodyContainer) {
      bodyContainer = document.createElement('div');
      bodyContainer.id = 'custom-body-tracking-code';
      bodyContainer.style.display = 'none';
      document.body.appendChild(bodyContainer);
    }

    if (bodyCode !== undefined) {
      bodyContainer.innerHTML = bodyCode || '';
      const scripts = bodyContainer.querySelectorAll('script');
      scripts.forEach((oldScript) => {
        const newScript = document.createElement('script');
        Array.from(oldScript.attributes).forEach((attr) => newScript.setAttribute(attr.name, attr.value));
        newScript.textContent = oldScript.textContent;
        oldScript.parentNode?.replaceChild(newScript, oldScript);
      });
    }
  } catch (err) {
    console.warn('Error applying custom tracking scripts:', err);
  }
};

// ===========================================================================
// 7. SUPABASE SQL CONFIGURATION (SERVER API)
// ===========================================================================
export interface SupabaseConfigResponse {
  isConfigured: boolean;
  url: string;
  anonKey: string;
}

export const getSupabaseConfig = async (): Promise<SupabaseConfigResponse> => {
  try {
    const res = await fetch('/api/config/supabase');
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Error fetching Supabase config from server:', err);
  }
  return {
    isConfigured: isSupabaseConfigured(),
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY
  };
};

export const saveSupabaseConfig = async (url: string, anonKey: string): Promise<{
  success: boolean;
  message: string;
  isConfigured: boolean;
}> => {
  try {
    const res = await fetch('/api/config/supabase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, anonKey })
    });
    if (res.ok) {
      return await res.json();
    }
    const err = await res.json();
    return { success: false, message: err.error || 'Server error', isConfigured: false };
  } catch (err: any) {
    return { success: false, message: err.message, isConfigured: false };
  }
};

// ===========================================================================
// 8. FILE UPLOAD (AUDIO & IMAGES DIRECTLY TO SERVER WITH SLUG STANDARDIZATION)
// ===========================================================================
/**
 * Chuẩn hóa tiêu đề tập truyện sang slug không dấu gạch nối
 * VD: "Tập 1: Tiếng Gõ Cửa Đêm Khuya" -> "tap-1-tieng-go-cua-dem-khuya"
 */
export const slugifyChapterTitle = (text: string): string => {
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
};

/**
 * Upload Audio file (.mp3) directly to Server (/api/upload-audio)
 * Backend automatically converts filename according to chapterTitle slug:
 * e.g. "Tập 1: Tiếng Gõ Cửa Đêm Khuya" -> "/uploads/audio/tap-1-tieng-go-cua-dem-khuya.mp3"
 */
/**
 * Helper an toàn phân tích phản hồi từ Server (tránh lỗi JSON parser khi Nginx trả về trang HTML)
 */
async function parseApiResponse<T>(res: Response, defaultErrorMsg: string): Promise<T> {
  const text = await res.text();
  const trimmed = text.trim();

  // Kiểm tra nếu Nginx hoặc Web server trả về trang HTML (<!doctype... hoặc <html>...)
  if (trimmed.startsWith('<') || trimmed.toLowerCase().startsWith('<!doctype')) {
    if (res.status === 413) {
      throw new Error(
        'Lỗi 413 (File quá lớn): Nginx chặn tải lên. Bạn cần thêm dòng "client_max_body_size 250M;" vào file cấu hình Nginx trên VPS rồi restart lại Nginx.'
      );
    }
    if (res.status === 502 || res.status === 504) {
      throw new Error(
        `Lỗi ${res.status} (${res.statusText || 'Bad Gateway'}): Ứng dụng Node.js chưa chạy trên Port 3000. Hãy kiểm tra lệnh "pm2 status" trên VPS xem app đã bật chưa.`
      );
    }
    throw new Error(
      'Nginx chưa chuyển tiếp vào Node.js: Đường dẫn API trả về trang HTML (index.html) thay vì dữ liệu JSON. Bạn cần cấu hình "proxy_pass http://127.0.0.1:3000;" trong Nginx trên VPS.'
    );
  }

  try {
    const data = JSON.parse(text);
    if (!res.ok) {
      throw new Error(data.error || data.message || defaultErrorMsg);
    }
    return data as T;
  } catch (err: any) {
    if (err.message && !err.message.includes('JSON')) {
      throw err;
    }
    throw new Error(defaultErrorMsg + (res.status ? ` (Mã lỗi HTTP: ${res.status})` : ''));
  }
}

/**
 * Upload Audio file (.mp3) directly to Server (/api/upload-audio)
 * Backend automatically converts filename according to chapterTitle slug:
 * e.g. "Tiên Nghịch" + "Tập 1" -> "/uploads/audio/tien-nghich-tap-1.mp3"
 */
export const uploadAudioToServer = async (
  file: File,
  chapterTitle?: string,
  storyTitle?: string
): Promise<{ url: string; filename: string; originalName: string; duration?: string }> => {
  const formData = new FormData();
  if (chapterTitle && chapterTitle.trim()) {
    formData.append('title', chapterTitle.trim());
  }
  if (storyTitle && storyTitle.trim()) {
    formData.append('story', storyTitle.trim());
  }
  formData.append('audio', file);

  const queryParams = new URLSearchParams();
  if (chapterTitle && chapterTitle.trim()) {
    queryParams.set('title', chapterTitle.trim());
  }
  if (storyTitle && storyTitle.trim()) {
    queryParams.set('story', storyTitle.trim());
  }
  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

  const res = await fetch(`/api/upload-audio${queryString}`, {
    method: 'POST',
    headers: getApiAuthHeaders(),
    body: formData,
  });

  return await parseApiResponse<{ url: string; filename: string; originalName: string; duration?: string }>(
    res,
    'Lỗi khi tải file audio lên server'
  );
};

/**
 * Upload Image file (.png, .jpg, .webp, .svg, .ico) directly to Server (/api/upload-image)
 */
export const uploadImageToServer = async (
  file: File
): Promise<{ url: string; filename: string; originalName: string }> => {
  const formData = new FormData();
  formData.append('image', file);

  const res = await fetch('/api/upload-image', {
    method: 'POST',
    headers: getApiAuthHeaders(),
    body: formData,
  });

  return await parseApiResponse<{ url: string; filename: string; originalName: string }>(
    res,
    'Lỗi khi tải file ảnh lên server'
  );
};

export const uploadAudioFile = async (
  file: File,
  chapterTitle?: string,
  storyTitle?: string
): Promise<{ url: string; duration?: string }> => {
  const res = await uploadAudioToServer(file, chapterTitle, storyTitle);
  return { url: res.url, duration: res.duration };
};

export const uploadCoverImage = async (file: File): Promise<string> => {
  const res = await uploadImageToServer(file);
  return res.url;
};

// ===========================================================================
// 9. ADMIN ACCOUNTS MANAGEMENT & AUTH (SERVER PERSISTENT)
// ===========================================================================
export const fetchAdminAccounts = async (): Promise<AdminAccount[]> => {
  try {
    const res = await fetch('/api/admin/accounts');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        cachedAdminAccounts = data;
        return data;
      }
    }
  } catch (err) {
    console.warn('Error fetching admin accounts from server:', err);
  }
  return cachedAdminAccounts;
};

export const loginAdminOnServer = async (
  identifier: string,
  password: string
): Promise<{ success: boolean; account?: AdminAccount; error?: string }> => {
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      await fetchAdminAccounts();
      return data;
    }
    return {
      success: false,
      error: data.error || 'Sai thông tin tài khoản hoặc mật khẩu quản trị!'
    };
  } catch (err: any) {
    // Fallback check against cachedAdminAccounts if server unreachable
    const cleanId = identifier.trim().toLowerCase();
    const cleanPass = password.trim();
    const matched = cachedAdminAccounts.find(
      a =>
        (a.email.toLowerCase() === cleanId || (a.username && a.username.toLowerCase() === cleanId)) &&
        a.password === cleanPass
    );
    if (matched) {
      return { success: true, account: matched };
    }
    return {
      success: false,
      error: 'Không thể xác thực tài khoản quản trị: ' + (err.message || 'Lỗi kết nối')
    };
  }
};

export const createAdminAccountOnServer = async (payload: {
  email: string;
  username?: string;
  password: string;
  name?: string;
  role?: string;
}): Promise<{ success: boolean; account?: AdminAccount; accounts: AdminAccount[]; error?: string }> => {
  try {
    const res = await fetch('/api/admin/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok && data.success) {
      cachedAdminAccounts = data.accounts;
      return data;
    }
    return {
      success: false,
      accounts: cachedAdminAccounts,
      error: data.error || 'Không thể tạo tài khoản quản trị mới.'
    };
  } catch (err: any) {
    return {
      success: false,
      accounts: cachedAdminAccounts,
      error: err.message || 'Lỗi kết nối Server khi tạo tài khoản'
    };
  }
};

export const updateAdminAccountOnServer = async (
  id: string,
  payload: {
    email?: string;
    username?: string;
    password?: string;
    name?: string;
    role?: string;
  }
): Promise<{ success: boolean; account?: AdminAccount; accounts: AdminAccount[]; error?: string }> => {
  try {
    const res = await fetch(`/api/admin/accounts/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok && data.success) {
      cachedAdminAccounts = data.accounts;
      return data;
    }
    return {
      success: false,
      accounts: cachedAdminAccounts,
      error: data.error || 'Không thể cập nhật tài khoản quản trị.'
    };
  } catch (err: any) {
    return {
      success: false,
      accounts: cachedAdminAccounts,
      error: err.message || 'Lỗi kết nối Server khi cập nhật tài khoản'
    };
  }
};

export const deleteAdminAccountOnServer = async (
  id: string
): Promise<{ success: boolean; accounts: AdminAccount[]; error?: string }> => {
  try {
    const res = await fetch(`/api/admin/accounts/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (res.ok && data.success) {
      cachedAdminAccounts = data.accounts;
      return data;
    }
    return {
      success: false,
      accounts: cachedAdminAccounts,
      error: data.error || 'Không thể xóa tài khoản quản trị.'
    };
  } catch (err: any) {
    return {
      success: false,
      accounts: cachedAdminAccounts,
      error: err.message || 'Lỗi kết nối Server khi xóa tài khoản'
    };
  }
};

// ===========================================================================
// 10. BACKUP, RESTORE & SLUG FILE NORMALIZATION API
// ===========================================================================
export interface BackupStatusResponse {
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

export const fetchBackupStatusInfo = async (): Promise<BackupStatusResponse | null> => {
  try {
    const res = await fetch('/api/backup/info');
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Error fetching backup status info:', err);
  }
  return null;
};

export const createServerBackupSnapshot = async (
  label?: string
): Promise<{ success: boolean; filename?: string; info?: BackupStatusResponse; error?: string }> => {
  try {
    const res = await fetch('/api/backup/snapshots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: label || '' })
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};

export const restoreDatabaseOnServer = async (
  rawJson: any
): Promise<{ success: boolean; message: string; info?: BackupStatusResponse }> => {
  try {
    const res = await fetch('/api/backup/restore-db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: rawJson })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      await fetchTracks();
      await fetchAffiliateCategories();
      await fetchAffiliateLinks();
      await fetchSiteSettings();
      await fetchAdminAccounts();
    }
    return data;
  } catch (err: any) {
    return { success: false, message: err.message };
  }
};

export const restoreFromServerSnapshotApi = async (
  filename: string
): Promise<{ success: boolean; message: string; info?: BackupStatusResponse }> => {
  try {
    const res = await fetch(`/api/backup/snapshots/${encodeURIComponent(filename)}/restore`, {
      method: 'POST'
    });
    const data = await res.json();
    if (res.ok && data.success) {
      await fetchTracks();
      await fetchAffiliateCategories();
      await fetchAffiliateLinks();
      await fetchSiteSettings();
      await fetchAdminAccounts();
    }
    return data;
  } catch (err: any) {
    return { success: false, message: err.message };
  }
};

export const deleteServerSnapshotApi = async (
  filename: string
): Promise<{ success: boolean; info?: BackupStatusResponse; error?: string }> => {
  try {
    const res = await fetch(`/api/backup/snapshots/${encodeURIComponent(filename)}`, {
      method: 'DELETE'
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};

export const normalizeAllAudioSlugsOnServer = async (): Promise<{
  success: boolean;
  updatedChaptersCount: number;
  message: string;
  info?: BackupStatusResponse;
}> => {
  try {
    const res = await fetch('/api/backup/normalize-slugs', {
      method: 'POST'
    });
    const data = await res.json();
    if (res.ok && data.success) {
      await fetchTracks();
    }
    return data;
  } catch (err: any) {
    return { success: false, updatedChaptersCount: 0, message: err.message };
  }
};


