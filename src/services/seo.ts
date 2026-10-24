import { Track, SiteSettings } from '../types';

/**
 * Convert Vietnamese text with accents to SEO-friendly ASCII slug
 * Example: "Phú Bà Audio Số 340" -> "phu-ba-audio-so-340"
 */
export function slugify(text: string): string {
  if (!text) return '';

  return text
    .toString()
    .toLowerCase()
    .normalize('NFD') // Normalize diacritics
    .replace(/[\u0300-\u036f]/g, '') // Remove accent marks
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '') // Remove invalid chars
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/-+/g, '-'); // Remove duplicate -
}

/**
 * Generate standard SEO friendly URL path for an audio track (Clean URL without #)
 * Example: "/phu-ba-audio-so-340"
 */
export function getStoryPath(track: Track): string {
  const slug = slugify(track.title) || track.id || 'audio';
  return `/${slug}`;
}

/**
 * Find track by clean slug (/ten-truyen), slug--id, or raw id with 100% reliability
 */
export function findTrackBySlugOrId(tracks: Track[], identifier: string): Track | null {
  if (!identifier || !tracks || tracks.length === 0) return null;

  let decoded = identifier;
  try {
    decoded = decodeURIComponent(identifier);
  } catch {
    decoded = identifier;
  }

  const clean = decoded
    .replace(/^#\/?/, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replace(/^truyen\//, '')
    .replace(/^story\//, '')
    .trim()
    .toLowerCase();

  if (!clean || clean === 'admin' || clean === 'quan-tri' || clean === 'system-secret-admin') {
    return null;
  }

  // 1. Direct slug match (e.g. "phu-ba-audio-so-340")
  for (const t of tracks) {
    if (slugify(t.title) === clean) {
      return t;
    }
  }

  // 2. Direct ID match
  const direct = tracks.find((t) => t.id.toLowerCase() === clean);
  if (direct) return direct;

  // 3. Double dash separator: slug--{id}
  if (clean.includes('--')) {
    const parts = clean.split('--');
    const idPart = parts.pop()?.trim();
    const slugPart = parts.join('--').trim();
    if (idPart) {
      const byDoubleDash = tracks.find((t) => t.id.toLowerCase() === idPart);
      if (byDoubleDash) return byDoubleDash;
    }
    if (slugPart) {
      const bySlugPart = tracks.find((t) => slugify(t.title) === slugPart);
      if (bySlugPart) return bySlugPart;
    }
  }

  // 4. Match if clean ends with `-${track.id}`
  for (const t of tracks) {
    const lowerId = t.id.toLowerCase();
    if (clean.endsWith(`-${lowerId}`) || clean === lowerId) {
      return t;
    }
  }

  // 5. Check if clean contains track id (e.g. "track-1")
  const byIdContain = tracks.find((t) => clean.includes(t.id.toLowerCase()));
  if (byIdContain) return byIdContain;

  // 6. Fallback title slug match
  const byTitleMatch = tracks.find((t) => {
    const s = slugify(t.title);
    return s && (clean.includes(s) || s.includes(clean));
  });
  if (byTitleMatch) return byTitleMatch;

  return null;
}

/**
 * Build Homepage SEO title & description directly from Admin CMS SiteSettings
 */
export function buildHomeSEOMeta(siteSettings?: SiteSettings) {
  const brandName = (siteSettings?.siteName || 'Gối Ôm Audio').trim() || 'Gối Ôm Audio';
  const tagline = (siteSettings?.siteTagline || 'Web Nghe Truyện Audio Online Miễn Phí').trim();
  const heroTitle = (siteSettings?.heroTitle || '').trim();
  const heroDesc = (siteSettings?.heroDescription || '').trim();

  const title = tagline ? `${brandName} - ${tagline}` : `${brandName} - Web Nghe Truyện Audio Online Miễn Phí`;

  const descParts: string[] = [];
  if (heroTitle) descParts.push(heroTitle);
  if (heroDesc) descParts.push(heroDesc);
  if (tagline && !heroDesc.toLowerCase().includes(tagline.toLowerCase())) {
    descParts.push(`${tagline} tại ${brandName}.`);
  }

  const description =
    descParts.length > 0
      ? descParts.join(' — ')
      : `${brandName} - ${tagline}. Kho truyện ma, tiên hiệp, kiếm hiệp, ngôn tình chất lượng cao nghe miễn phí.`;

  return { brandName, tagline, title, description };
}

/**
 * Update dynamic head tags, OpenGraph, Canonical, and JSON-LD structured data for Google
 */
export function updateSEOMetadata(track?: Track | null, siteSettings?: SiteSettings) {
  const { brandName, title: homeTitle, description: homeDesc } = buildHomeSEOMeta(siteSettings);
  const siteUrl = window.location.origin;
  const logoOrFavicon =
    siteSettings?.logoUrl ||
    siteSettings?.faviconUrl ||
    'https://api.iconify.design/lucide:headphones.svg?color=%23f59e0b';

  let title = homeTitle;
  let description = homeDesc;
  let canonicalUrl = `${siteUrl}/`;
  let ogType = 'website';
  let jsonLdData: any = null;

  if (track) {
    title = `${track.title} (Audio Full) - ${brandName}`;
    description = track.description
      ? `${track.title} - ${track.description.slice(0, 150)}... Thể loại: ${track.category || 'Audio'}. Nghe trọn bộ miễn phí trên ${brandName}.`
      : `Nghe truyện audio trọn bộ ${track.title} miễn phí chất lượng cao trên ${brandName}. Thể loại ${track.category || 'Audio'}.`;
    canonicalUrl = `${siteUrl}${getStoryPath(track)}`;
    ogType = 'music.song';

    // Schema.org AudioObject for Google Rich Results
    jsonLdData = {
      '@context': 'https://schema.org',
      '@type': 'AudioObject',
      name: track.title,
      description: track.description || `Truyện audio ${track.title} thể loại ${track.category}`,
      contentUrl: track.mp3_url || track.chapters?.[0]?.mp3_url || '',
      encodingFormat: 'audio/mpeg',
      duration: 'PT25M',
      uploadDate: track.created_at || '2026-10-22',
      author: {
        '@type': 'Person',
        name: track.author || brandName,
      },
      publisher: {
        '@type': 'Organization',
        name: brandName,
        url: siteUrl,
      },
      inLanguage: 'vi-VN',
      genre: track.category || 'Audio Story',
    };
  } else {
    // Schema.org WebSite & Organization for Homepage
    jsonLdData = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          name: brandName,
          url: siteUrl,
          description: description,
          inLanguage: 'vi-VN',
          potentialAction: {
            '@type': 'SearchAction',
            target: `${siteUrl}/?q={search_term_string}`,
            'query-input': 'required name=search_term_string',
          },
        },
        {
          '@type': 'Organization',
          name: brandName,
          url: siteUrl,
          logo: logoOrFavicon.startsWith('http') ? logoOrFavicon : `${siteUrl}${logoOrFavicon}`,
          sameAs: [],
        },
      ],
    };
  }

  // 1. Update Title
  document.title = title;

  // 2. Helper to set or create meta tag
  const setMetaTag = (attrName: string, attrVal: string, content: string) => {
    let el = document.querySelector(`meta[${attrName}="${attrVal}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attrName, attrVal);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  // Standard meta
  setMetaTag('name', 'description', description);
  setMetaTag('name', 'robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
  setMetaTag('name', 'googlebot', 'index, follow');

  // OpenGraph
  setMetaTag('property', 'og:title', title);
  setMetaTag('property', 'og:description', description);
  setMetaTag('property', 'og:url', canonicalUrl);
  setMetaTag('property', 'og:type', ogType);
  setMetaTag('property', 'og:site_name', brandName);
  setMetaTag('property', 'og:locale', 'vi_VN');

  // Twitter Cards
  setMetaTag('name', 'twitter:card', 'summary_large_image');
  setMetaTag('name', 'twitter:title', title);
  setMetaTag('name', 'twitter:description', description);

  // 3. Update Canonical Link
  let canonicalEl = document.querySelector('link[rel="canonical"]');
  if (!canonicalEl) {
    canonicalEl = document.createElement('link');
    canonicalEl.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalEl);
  }
  canonicalEl.setAttribute('href', canonicalUrl);

  // 4. Inject / Update JSON-LD Script tag for Google Search
  let scriptEl = document.getElementById('seo-jsonld-schema');
  if (!scriptEl) {
    scriptEl = document.createElement('script');
    scriptEl.id = 'seo-jsonld-schema';
    scriptEl.setAttribute('type', 'application/ld+json');
    document.head.appendChild(scriptEl);
  }
  scriptEl.textContent = JSON.stringify(jsonLdData);
}
