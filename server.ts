import express from 'express';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import {
  UPLOAD_ROOT_DIR,
  UPLOAD_AUDIO_DIR,
  UPLOAD_IMAGE_DIR,
  BACKUP_DIR,
  slugifyVietnamese,
  normalizeLocalChapterAudioSlug,
  getTracks,
  getTrackById,
  addTrack,
  updateTrack,
  addChapterToTrack,
  deleteChapterFromTrack,
  deleteTrack,
  incrementTrackPlay,
  resetTracks,
  getCategories,
  addCategory,
  deleteCategory,
  toggleCategory,
  getAffiliateLinks,
  bulkAddAffiliateLinks,
  deleteAffiliateLink,
  batchDeleteAffiliateLinks,
  toggleAffiliateLink,
  incrementAffiliateClick,
  getRandomAffiliateLink,
  extractOgImageFromUrl,
  resetAffiliates,
  getSiteSettings,
  saveSiteSettings,
  resetSiteSettings,
  getSupabaseConfig,
  saveSupabaseConfig,
  getAdminAccounts,
  verifyAdminCredentials,
  createAdminAccount,
  updateAdminAccount,
  deleteAdminAccount,
  getBackupStatusInfo,
  getRawDatabaseData,
  createServerSnapshot,
  restoreDatabaseFromJson,
  restoreFromServerSnapshot,
  deleteServerSnapshot,
  normalizeAllAudioFilesToSlug,
  detectAudioDurationSync
} from './server-db';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Chặn hoàn toàn các quyền PWA / Ứng dụng trên thiết bị (Apps on device / Local Network Access)
  app.use((_req, res, next) => {
    res.setHeader(
      'Permissions-Policy',
      'local-network-access=(), loopback-network=(), local-network=(), browsing-topics=(), interest-cohort=()'
    );
    next();
  });

  // Trả về 404 rõ ràng cho mọi file cấu hình PWA / Service Worker / App Links để trình duyệt hoạt động thuần túy như trang web thường
  app.get(
    [
      '/manifest.json',
      '/manifest.webmanifest',
      '/site.webmanifest',
      '/sw.js',
      '/service-worker.js',
      '/registerSW.js',
      '/.well-known/assetlinks.json',
      '/.well-known/apple-app-site-association',
      '/apple-app-site-association',
    ],
    (_req, res) => {
      res.status(404).type('text/plain').send('Not Found');
    }
  );

  // Enable CORS for external API clients (Postman, Python, n8n, Make, cURL, external scripts)
  app.use('/api', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    next();
  });

  // Optional API Key verification helper when requireApiKey is enabled in siteSettings
  const verifyExternalApiKey = (req: express.Request, res: express.Response): boolean => {
    const settings = getSiteSettings();
    if (!settings.requireApiKey) return true;

    const expectedKey = (settings.apiKey || '').trim();
    if (!expectedKey) return true;

    const headerKey = (req.headers['x-api-key'] as string) || '';
    const authHeader = (req.headers['authorization'] as string) || '';
    const bearerKey = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const bodyKey = req.body?.api_key || req.body?.apiKey || '';
    const queryKey = (req.query?.api_key as string) || (req.query?.apiKey as string) || '';

    const providedKey = (headerKey || bearerKey || bodyKey || queryKey).trim();
    if (providedKey !== expectedKey) {
      res.status(401).json({
        success: false,
        error: 'Sai hoặc thiếu mã API Key. Vui lòng truyền header x-api-key hoặc api_key trong JSON body.'
      });
      return false;
    }
    return true;
  };

  // Unified Physical Upload Directories in Project Root:
  // - Audio: uploads/audio/
  // - Images: uploads/images/
  // Nginx alias config: location /uploads/ { alias /root/my-web/uploads/; }
  const audioStorage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, UPLOAD_AUDIO_DIR);
    },
    filename: (req, file, cb) => {
      const rawExt = path.extname(file.originalname).toLowerCase();
      const ext = rawExt || '.mp3';

      const rawStory =
        (req.query?.story as string) ||
        (req.query?.storyTitle as string) ||
        (req.body?.story as string) ||
        (req.body?.storyTitle as string) ||
        '';

      const rawTitle =
        (req.query?.title as string) ||
        (req.query?.chapterTitle as string) ||
        (req.body?.title as string) ||
        (req.body?.chapterTitle as string) ||
        path.basename(file.originalname, rawExt);

      const chapterSlug = slugifyVietnamese(rawTitle) || 'tap-truyen-audio';
      const storySlug = rawStory ? slugifyVietnamese(rawStory) : '';

      let baseSlug = chapterSlug;
      if (storySlug) {
        if (!chapterSlug.startsWith(storySlug)) {
          baseSlug = `${storySlug}-${chapterSlug}`;
        }
      }

      let safeName = `${baseSlug}${ext}`;
      const targetPath = path.join(UPLOAD_AUDIO_DIR, safeName);
      // To strictly avoid overwriting existing audio files from other stories, append short hash/timestamp if collision
      if (fs.existsSync(targetPath)) {
        safeName = `${baseSlug}-${Date.now().toString(36)}${ext}`;
      }

      cb(null, safeName);
    }
  });

  const imageStorage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, UPLOAD_IMAGE_DIR);
    },
    filename: (req, file, cb) => {
      const rawExt = path.extname(file.originalname).toLowerCase();
      const ext = rawExt || '.png';
      const rawTitle =
        (req.query?.title as string) ||
        (req.body?.title as string) ||
        path.basename(file.originalname, rawExt);
      const slugName = slugifyVietnamese(rawTitle) || 'image';
      const safeName = `${slugName}-${Date.now()}${ext}`;
      cb(null, safeName);
    }
  });

  const uploadAudioMiddleware = multer({
    storage: audioStorage,
    limits: { fileSize: 150 * 1024 * 1024 } // 150MB audio files
  });

  const uploadImageMiddleware = multer({
    storage: imageStorage,
    limits: { fileSize: 20 * 1024 * 1024 } // 20MB image files
  });

  const audioDurationSecCache = new Map<string, number>();

  const parseDurationStrToSec = (str: string): number => {
    if (!str) return 0;
    const parts = str.trim().split(':').map((n) => parseFloat(n));
    if (parts.some((n) => isNaN(n))) return 0;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 1) return parts[0];
    return 0;
  };

  const getCachedAudioDurationSec = (filePath: string, fallbackDurSec: number): number => {
    const cached = audioDurationSecCache.get(filePath);
    if (cached && cached > 0) return cached;
    const durStr = detectAudioDurationSync(`/uploads/audio/${path.basename(filePath)}`);
    const detected = parseDurationStrToSec(durStr);
    // Prefer exact duration from browser decoder if detected fell back to default 25:00 (1500s)
    const finalDur =
      fallbackDurSec > 1 && fallbackDurSec < 86400 && (detected === 1500 || detected <= 0)
        ? fallbackDurSec
        : detected > 0
        ? detected
        : fallbackDurSec;
    if (finalDur > 0) {
      audioDurationSecCache.set(filePath, finalDur);
    }
    return finalDur;
  };

  const computeMp3SeekByteOffset = (filePath: string, fileSize: number, seekSeconds: number, totalDurationSec: number): number => {
    if (seekSeconds <= 0.5 || totalDurationSec <= 0 || fileSize <= 1024) return 0;
    let fd: number | null = null;
    try {
      fd = fs.openSync(filePath, 'r');
      let id3v2Size = 0;
      const headerBuf = Buffer.alloc(10);
      const headerRead = fs.readSync(fd, headerBuf, 0, 10, 0);
      if (
        headerRead === 10 &&
        headerBuf[0] === 0x49 &&
        headerBuf[1] === 0x44 &&
        headerBuf[2] === 0x33
      ) {
        id3v2Size =
          10 +
          (((headerBuf[6] & 0x7f) << 21) |
            ((headerBuf[7] & 0x7f) << 14) |
            ((headerBuf[8] & 0x7f) << 7) |
            (headerBuf[9] & 0x7f));
        if (id3v2Size >= fileSize) id3v2Size = 0;
      }

      const audioDataBytes = Math.max(0, fileSize - id3v2Size);
      const ratio = Math.max(0, Math.min(0.995, seekSeconds / totalDurationSec));
      const rawOffset = id3v2Size + Math.floor(ratio * audioDataBytes);

      const scanBuf = Buffer.alloc(4096);
      const scanRead = fs.readSync(fd, scanBuf, 0, 4096, rawOffset);
      let frameOffset = 0;
      for (let i = 0; i < scanRead - 4; i++) {
        if (
          scanBuf[i] === 0xff &&
          (scanBuf[i + 1] & 0xe0) === 0xe0 &&
          (scanBuf[i + 1] & 0x18) !== 0x08 &&
          (scanBuf[i + 1] & 0x06) !== 0x00 &&
          (scanBuf[i + 2] & 0xf0) !== 0xf0 &&
          (scanBuf[i + 2] & 0x0c) !== 0x0c
        ) {
          frameOffset = i;
          break;
        }
      }
      return Math.min(rawOffset + frameOffset, fileSize - 1);
    } catch {
      return 0;
    } finally {
      if (fd !== null) {
        try {
          fs.closeSync(fd);
        } catch {}
      }
    }
  };

  const handleAudioStreamRequest = (req: express.Request, res: express.Response, next: express.NextFunction, rawFilename: string) => {
    let cleanRaw = rawFilename.split('?')[0];
    try {
      cleanRaw = decodeURIComponent(cleanRaw);
    } catch {}
    const filename = path.basename(cleanRaw);
    if (!filename.toLowerCase().endsWith('.mp3')) {
      return next();
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept, Origin');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');
    res.setHeader('X-Accel-Buffering', 'no');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    let filePath = path.join(UPLOAD_AUDIO_DIR, filename);
    if (!fs.existsSync(filePath)) {
      filePath = path.join(UPLOAD_ROOT_DIR, filename);
      if (!fs.existsSync(filePath)) {
        return next();
      }
    }

    try {
      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const seekSeconds = parseFloat(String(req.query.t || req.query.seek || '0')) || 0;
      const fallbackDurSec = parseFloat(String(req.query.dur || '0')) || 0;
      const isApiStreamRoute = req.path.includes('/api/stream-audio');

      let baseStartByte = 0;
      if (seekSeconds > 0.5) {
        const totalDurSec = getCachedAudioDurationSec(filePath, fallbackDurSec);
        baseStartByte = computeMp3SeekByteOffset(filePath, fileSize, seekSeconds, totalDurSec);
      }

      const slicedFileSize = fileSize - baseStartByte;
      const range = req.headers.range;

      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Last-Modified', stat.mtime.toUTCString());
      res.setHeader('ETag', `W/"${slicedFileSize.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}-${Math.floor(seekSeconds)}"`);

      // Crucial for VPS + Cloudflare: prevent Cloudflare from buffering/caching sliced seek streams or stripping byte ranges
      if (seekSeconds > 0.5 || isApiStreamRoute) {
        res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate, no-transform');
        res.setHeader('CDN-Cache-Control', 'no-store');
        res.setHeader('Cloudflare-CDN-Cache-Control', 'no-store');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=2592000, immutable, no-transform');
      }

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const relStart = parseInt(parts[0], 10) || 0;
        const relEnd = parts[1] ? parseInt(parts[1], 10) : slicedFileSize - 1;

        if (relStart >= slicedFileSize || relStart < 0) {
          res.status(416).setHeader('Content-Range', `bytes */${slicedFileSize}`).end();
          return;
        }

        const validRelEnd = Math.min(relEnd, slicedFileSize - 1);
        const chunksize = validRelEnd - relStart + 1;
        const diskStart = baseStartByte + relStart;
        const diskEnd = baseStartByte + validRelEnd;

        res.writeHead(206, {
          'Content-Range': `bytes ${relStart}-${validRelEnd}/${slicedFileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': 'audio/mpeg',
        });

        if (req.method === 'HEAD') {
          res.end();
          return;
        }

        const fileStream = fs.createReadStream(filePath, { start: diskStart, end: diskEnd });
        req.on('close', () => {
          fileStream.destroy();
        });
        fileStream.on('error', () => {
          if (!res.headersSent) res.status(500).end();
        });
        fileStream.pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': slicedFileSize,
          'Content-Type': 'audio/mpeg',
          'Accept-Ranges': 'bytes',
        });

        if (req.method === 'HEAD') {
          res.end();
          return;
        }

        const fileStream = fs.createReadStream(filePath, { start: baseStartByte, end: fileSize - 1 });
        req.on('close', () => {
          fileStream.destroy();
        });
        fileStream.on('error', () => {
          if (!res.headersSent) res.status(500).end();
        });
        fileStream.pipe(res);
      }
    } catch {
      next();
    }
  };

  // Dedicated progressive audio streaming & server-side seek endpoint
  app.all('/api/stream-audio', (req, res, next) => {
    const rawSrc = String(req.query.src || req.query.file || '');
    if (!rawSrc) {
      return res.status(400).json({ error: 'Thiếu đường dẫn file audio' });
    }
    handleAudioStreamRequest(req, res, next, rawSrc);
  });

  app.all(['/uploads/audio/:filename', '/uploads/:filename'], (req, res, next) => {
    handleAudioStreamRequest(req, res, next, req.params.filename);
  });

  // Serve unified static uploaded audio & image files from root /uploads directory
  // Supports HTTP Byte-Range (206 Partial Content) & 30-day cache with full CORS
  app.use(
    '/uploads',
    (req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept, Origin');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');
      if (req.method === 'OPTIONS') {
        return res.status(200).end();
      }
      next();
    },
    express.static(UPLOAD_ROOT_DIR, {
      maxAge: '30d',
      acceptRanges: true,
      etag: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.mp3')) {
          res.setHeader('Accept-Ranges', 'bytes');
          res.setHeader('Cache-Control', 'public, max-age=2592000, immutable, no-transform');
        }
      }
    })
  );

  // JSON middleware
  app.use(express.json({ limit: '25mb' }));

  // --- AUDIO UPLOAD API (AUTO CONVERT FILENAME TO CHAPTER TITLE SLUG) ---
  app.post('/api/upload-audio', uploadAudioMiddleware.single('audio'), (req, res) => {
    try {
      if (!verifyExternalApiKey(req, res)) return;
      if (!req.file) {
        return res.status(400).json({ error: 'Không tìm thấy file audio để tải lên' });
      }

      let fileUrl = `/uploads/audio/${req.file.filename}`;
      const explicitTitle =
        (req.query?.title as string) ||
        (req.query?.chapterTitle as string) ||
        (req.body?.title as string) ||
        (req.body?.chapterTitle as string) ||
        '';
      const explicitStory =
        (req.query?.story as string) ||
        (req.query?.storyTitle as string) ||
        (req.body?.story as string) ||
        (req.body?.storyTitle as string) ||
        '';

      if (explicitTitle.trim()) {
        fileUrl = normalizeLocalChapterAudioSlug(explicitTitle.trim(), fileUrl, explicitStory.trim());
      }

      const finalFilename = fileUrl.replace('/uploads/audio/', '');
      const detectedDuration = detectAudioDurationSync(fileUrl);

      res.json({
        success: true,
        url: fileUrl,
        filename: finalFilename,
        originalName: req.file.originalname,
        size: req.file.size,
        duration: detectedDuration
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- IMAGE UPLOAD API (LOGO, FAVICON, BANNER, COVER) ---
  app.post('/api/upload-image', uploadImageMiddleware.single('image'), (req, res) => {
    try {
      if (!verifyExternalApiKey(req, res)) return;
      if (!req.file) {
        return res.status(400).json({ error: 'Không tìm thấy file ảnh để tải lên' });
      }
      const fileUrl = `/uploads/images/${req.file.filename}`;
      res.json({
        success: true,
        url: fileUrl,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- UNIFIED STORY API GATEWAY (1 CỔNG DUY NHẤT ĐỂ ĐĂNG / SỬA / XÓA TRUYỆN) ---
  const handleStoryGateway = async (req: express.Request, res: express.Response) => {
    try {
      if (!verifyExternalApiKey(req, res)) return;

      const rawAction = String(req.body?.action || req.query?.action || 'list').toLowerCase().trim();
      const targetId = String(req.body?.id || req.body?.track_id || req.body?.story_id || req.query?.id || '').trim();
      const payload = req.body?.data || req.body || {};

      // 1. LIST ALL STORIES
      if (rawAction === 'list' || rawAction === 'get_all') {
        const tracks = await getTracks();
        return res.json({
          success: true,
          action: 'list',
          count: tracks.length,
          data: tracks
        });
      }

      // 2. GET SINGLE STORY BY ID
      if (rawAction === 'get' || rawAction === 'detail') {
        if (!targetId) {
          return res.status(400).json({ success: false, error: 'Thiếu trường "id" của truyện cần lấy thông tin.' });
        }
        const track = await getTrackById(targetId);
        if (!track) {
          return res.status(404).json({ success: false, error: `Không tìm thấy truyện có id: ${targetId}` });
        }
        return res.json({
          success: true,
          action: 'get',
          data: track
        });
      }

      // 3. CREATE / POST NEW STORY
      if (rawAction === 'create' || rawAction === 'post' || rawAction === 'add' || rawAction === 'dang') {
        if (!payload.title && !req.body?.title) {
          return res.status(400).json({
            success: false,
            error: 'Thiếu trường "title" (Tên truyện). Vui lòng truyền "title" khi đăng truyện mới.'
          });
        }
        const created = await addTrack({
          ...req.body,
          ...payload
        });
        return res.status(201).json({
          success: true,
          action: 'create',
          message: `Đã đăng truyện mới "${created.title}" thành công!`,
          data: created
        });
      }

      // 4. UPDATE / EDIT EXISTING STORY
      if (rawAction === 'update' || rawAction === 'edit' || rawAction === 'put' || rawAction === 'patch' || rawAction === 'sua') {
        if (!targetId) {
          return res.status(400).json({
            success: false,
            error: 'Thiếu trường "id" của truyện cần chỉnh sửa.'
          });
        }
        const cleanUpdates = { ...req.body, ...payload };
        delete cleanUpdates.action;
        delete cleanUpdates.api_key;
        delete cleanUpdates.apiKey;

        const updated = await updateTrack(targetId, cleanUpdates);
        if (!updated) {
          return res.status(404).json({
            success: false,
            error: `Không tìm thấy truyện có id "${targetId}" để cập nhật.`
          });
        }
        return res.json({
          success: true,
          action: 'update',
          message: `Đã cập nhật truyện "${updated.title}" thành công!`,
          data: updated
        });
      }

      // 5. ADD NEW CHAPTER / EPISODE TO EXISTING STORY
      if (rawAction === 'add_chapter' || rawAction === 'add_episode' || rawAction === 'them_tap') {
        if (!targetId) {
          return res.status(400).json({
            success: false,
            error: 'Thiếu trường "id" của truyện cần thêm tập mới.'
          });
        }
        const chapterData = req.body?.chapter || payload?.chapter || {
          title: req.body?.chapter_title || req.body?.title,
          mp3_url: req.body?.mp3_url,
          duration: req.body?.duration
        };
        if (!chapterData?.mp3_url) {
          return res.status(400).json({
            success: false,
            error: 'Thiếu "mp3_url" cho tập truyện mới.'
          });
        }
        const updated = await addChapterToTrack(targetId, chapterData);
        if (!updated) {
          return res.status(404).json({
            success: false,
            error: `Không tìm thấy truyện có id "${targetId}".`
          });
        }
        return res.json({
          success: true,
          action: 'add_chapter',
          message: `Đã thêm tập mới vào truyện "${updated.title}" (Tổng: ${updated.chapters?.length || 1} tập)!`,
          data: updated
        });
      }

      // 6. DELETE CHAPTER FROM STORY
      if (rawAction === 'delete_chapter' || rawAction === 'remove_chapter' || rawAction === 'xoa_tap') {
        const chapterId = req.body?.chapter_id ?? req.body?.chapterId;
        if (!targetId || chapterId === undefined) {
          return res.status(400).json({
            success: false,
            error: 'Thiếu "id" truyện hoặc "chapter_id" cần xóa.'
          });
        }
        const updated = await deleteChapterFromTrack(targetId, chapterId);
        if (!updated) {
          return res.status(404).json({
            success: false,
            error: `Không tìm thấy truyện có id "${targetId}".`
          });
        }
        return res.json({
          success: true,
          action: 'delete_chapter',
          message: `Đã xóa tập #${chapterId} khỏi truyện "${updated.title}".`,
          data: updated
        });
      }

      // 7. DELETE STORY
      if (rawAction === 'delete' || rawAction === 'remove' || rawAction === 'xoa') {
        if (!targetId) {
          return res.status(400).json({
            success: false,
            error: 'Thiếu trường "id" của truyện cần xóa.'
          });
        }
        const deleted = await deleteTrack(targetId);
        if (!deleted) {
          return res.status(404).json({
            success: false,
            error: `Không tìm thấy truyện có id "${targetId}" hoặc truyện đã bị xóa trước đó.`
          });
        }
        return res.json({
          success: true,
          action: 'delete',
          message: `Đã xóa truyện có id "${targetId}" khỏi Server thành công!`,
          deletedId: targetId
        });
      }

      return res.status(400).json({
        success: false,
        error: `Action "${rawAction}" không hợp lệ. Các action hỗ trợ: "create" (đăng truyện), "update" (sửa truyện), "add_chapter" (thêm tập), "delete_chapter" (xóa tập), "delete" (xóa truyện), "list" (danh sách), "get" (chi tiết).`
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err.message || 'Lỗi xử lý tại cổng API'
      });
    }
  };

  app.post('/api/gateway', handleStoryGateway);
  app.post('/api/v1/stories/gateway', handleStoryGateway);
  app.get('/api/gateway', handleStoryGateway);

  // --- FAST SINGLE-REQUEST BOOTSTRAP ENDPOINT FOR INITIAL PAGE LOAD ---
  app.get('/api/bootstrap', async (_req, res) => {
    try {
      const [tracks, siteSettings, categories, links] = await Promise.all([
        getTracks(),
        Promise.resolve(getSiteSettings()),
        Promise.resolve(getCategories()),
        Promise.resolve(getAffiliateLinks()),
      ]);
      res.setHeader('Cache-Control', 'no-cache');
      res.json({ tracks, siteSettings, categories, links });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- TRACKS & STORIES RESTFUL API (/api/tracks AND /api/v1/stories) ---
  app.get(['/api/tracks', '/api/v1/stories'], async (_req, res) => {
    try {
      const tracks = await getTracks();
      res.json(tracks);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get(['/api/tracks/:id', '/api/v1/stories/:id'], async (req, res) => {
    try {
      const track = await getTrackById(req.params.id);
      if (!track) return res.status(404).json({ error: 'Không tìm thấy truyện' });
      res.json(track);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post(['/api/tracks', '/api/v1/stories'], async (req, res) => {
    try {
      if (!verifyExternalApiKey(req, res)) return;
      const track = await addTrack(req.body);
      res.status(201).json(track);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put(['/api/tracks/:id', '/api/v1/stories/:id'], async (req, res) => {
    try {
      if (!verifyExternalApiKey(req, res)) return;
      const track = await updateTrack(req.params.id, req.body);
      if (!track) return res.status(404).json({ error: 'Không tìm thấy truyện để cập nhật' });
      res.json(track);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch(['/api/tracks/:id', '/api/v1/stories/:id'], async (req, res) => {
    try {
      if (!verifyExternalApiKey(req, res)) return;
      const track = await updateTrack(req.params.id, req.body);
      if (!track) return res.status(404).json({ error: 'Không tìm thấy truyện để cập nhật' });
      res.json(track);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post(['/api/tracks/:id/chapters', '/api/v1/stories/:id/chapters'], async (req, res) => {
    try {
      if (!verifyExternalApiKey(req, res)) return;
      const track = await addChapterToTrack(req.params.id, req.body);
      if (!track) return res.status(404).json({ error: 'Không tìm thấy truyện để thêm tập' });
      res.json(track);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete(['/api/tracks/:id', '/api/v1/stories/:id'], async (req, res) => {
    try {
      if (!verifyExternalApiKey(req, res)) return;
      const success = await deleteTrack(req.params.id);
      if (!success) return res.status(404).json({ success: false, error: 'Không tìm thấy truyện để xóa' });
      res.json({ success: true, deletedId: req.params.id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/tracks/:id/play', async (req, res) => {
    try {
      await incrementTrackPlay(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/tracks/reset', async (_req, res) => {
    try {
      const tracks = await resetTracks();
      res.json(tracks);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- AFFILIATE CATEGORIES API ---
  app.get('/api/affiliates/categories', (_req, res) => {
    res.json(getCategories());
  });

  app.post('/api/affiliates/categories', (req, res) => {
    try {
      const category = addCategory(req.body);
      res.status(201).json(category);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/affiliates/categories/:id', (req, res) => {
    try {
      const result = deleteCategory(req.params.id);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/affiliates/categories/:id/toggle', (req, res) => {
    try {
      const result = toggleCategory(req.params.id);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- AFFILIATE LINKS API ---
  app.get('/api/affiliates/links', (_req, res) => {
    res.json(getAffiliateLinks());
  });

  app.post('/api/affiliates/links/bulk', (req, res) => {
    try {
      const items = req.body.items || [];
      const result = bulkAddAffiliateLinks(items);
      res.status(201).json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/affiliates/links/:id', (req, res) => {
    try {
      const updated = deleteAffiliateLink(req.params.id);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/affiliates/links/batch-delete', (req, res) => {
    try {
      const ids = req.body.ids || [];
      const updated = batchDeleteAffiliateLinks(ids);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/affiliates/links/:id/toggle', (req, res) => {
    try {
      const updated = toggleAffiliateLink(req.params.id);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/affiliates/links/:id/click', (req, res) => {
    try {
      incrementAffiliateClick(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/affiliates/random', async (_req, res) => {
    try {
      const picked = await getRandomAffiliateLink();
      res.json(picked);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/affiliates/reset', (_req, res) => {
    try {
      const result = resetAffiliates();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- SITE SETTINGS API ---
  app.get('/api/settings', (_req, res) => {
    res.json(getSiteSettings());
  });

  app.post('/api/settings', (req, res) => {
    try {
      const saved = saveSiteSettings(req.body);
      res.json(saved);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/settings', (req, res) => {
    try {
      const saved = saveSiteSettings(req.body);
      res.json(saved);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/settings/reset', (_req, res) => {
    try {
      const saved = resetSiteSettings();
      res.json(saved);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- SUPABASE CONFIGURATION API ---
  app.get('/api/config/supabase', (_req, res) => {
    res.json(getSupabaseConfig());
  });

  app.post('/api/config/supabase', async (req, res) => {
    try {
      const { url, anonKey } = req.body;
      const result = await saveSupabaseConfig(url, anonKey);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- ADMIN ACCOUNTS & AUTH API (CREATE, UPDATE, DELETE INCLUDING DEFAULT ACCOUNT) ---
  app.post('/api/admin/login', (req, res) => {
    try {
      const identifier = req.body?.email || req.body?.username || req.body?.identifier || '';
      const password = req.body?.password || '';
      const result = verifyAdminCredentials(identifier, password);
      if (!result.success) {
        return res.status(401).json(result);
      }
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/admin/accounts', (_req, res) => {
    try {
      const accounts = getAdminAccounts();
      res.json(accounts);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/accounts', (req, res) => {
    try {
      const result = createAdminAccount(req.body || {});
      if (!result.success) {
        return res.status(400).json(result);
      }
      return res.status(201).json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.put('/api/admin/accounts/:id', (req, res) => {
    try {
      const result = updateAdminAccount(req.params.id, req.body || {});
      if (!result.success) {
        return res.status(400).json(result);
      }
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/admin/accounts/:id', (req, res) => {
    try {
      const result = deleteAdminAccount(req.params.id);
      if (!result.success) {
        return res.status(404).json(result);
      }
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- OPEN GRAPH OG:IMAGE EXTRACTION API ---
  app.get('/api/og-image', async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl || !targetUrl.startsWith('http')) {
      return res.status(400).json({ error: 'Missing or invalid url parameter' });
    }

    try {
      const { ogImage, title } = await extractOgImageFromUrl(targetUrl);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.json({ ogImage, title, url: targetUrl });
    } catch (err: any) {
      return res.json({ ogImage: null, error: err.message });
    }
  });

  // --- BACKUP, RESTORE & SLUG NORMALIZATION API ---
  app.get('/api/backup/info', (_req, res) => {
    try {
      res.json(getBackupStatusInfo());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/backup/download-db', (_req, res) => {
    try {
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `goi-om-audio-db-${dateStr}.json`;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(JSON.stringify(getRawDatabaseData(), null, 2));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/backup/download-full', (_req, res) => {
    try {
      const dateStr = new Date().toISOString().split('T')[0];
      const archiveName = `goi-om-audio-full-backup-${dateStr}.tar.gz`;
      res.setHeader('Content-Type', 'application/gzip');
      res.setHeader('Content-Disposition', `attachment; filename="${archiveName}"`);

      const tarProc = spawn('tar', ['-czf', '-', 'data', 'uploads'], {
        cwd: process.cwd()
      });

      tarProc.stdout.pipe(res);
      tarProc.stderr.on('data', (chunk) => {
        console.warn('tar stderr:', chunk.toString());
      });
      tarProc.on('error', (err) => {
        if (!res.headersSent) {
          res.status(500).json({ error: 'Không thể nén gói backup: ' + err.message });
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/backup/restore-db', (req, res) => {
    try {
      const payload = req.body?.data || req.body;
      const result = restoreDatabaseFromJson(payload);
      if (!result.success) {
        return res.status(400).json(result);
      }
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post('/api/backup/snapshots', (req, res) => {
    try {
      const label = req.body?.label || '';
      const result = createServerSnapshot(label);
      if (!result.success) {
        return res.status(400).json(result);
      }
      return res.status(201).json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/backup/snapshots/:filename/download', (req, res) => {
    try {
      const safeName = path.basename(req.params.filename);
      const fullPath = path.join(BACKUP_DIR, safeName);
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: 'Không tìm thấy file snapshot' });
      }
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
      res.sendFile(fullPath);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/backup/snapshots/:filename/restore', (req, res) => {
    try {
      const result = restoreFromServerSnapshot(req.params.filename);
      if (!result.success) {
        return res.status(400).json(result);
      }
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  app.delete('/api/backup/snapshots/:filename', (req, res) => {
    try {
      const result = deleteServerSnapshot(req.params.filename);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/backup/normalize-slugs', (_req, res) => {
    try {
      const result = normalizeAllAudioFilesToSlug();
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // --- DYNAMIC ROBOTS.TXT & SITEMAP.XML (CLEAN URLS WITHOUT #) ---
  const slugifyServer = slugifyVietnamese;

  // Helper lấy Base URL công khai an toàn, tuyệt đối không bao giờ trả về localhost hoặc 127.0.0.1
  const getSafePublicBaseUrl = (req: express.Request): string => {
    const rawHost = String(req.headers['x-forwarded-host'] || req.headers.host || '').trim();
    const isLoopbackOrPrivate =
      !rawHost ||
      /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[::1\]|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/i.test(rawHost);
    if (isLoopbackOrPrivate) {
      return '';
    }
    const rawProto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
    const protocol = rawProto === 'http' || rawProto === 'https' ? rawProto : 'https';
    return `${protocol}://${rawHost}`;
  };

  app.get('/robots.txt', (req, res) => {
    const baseUrl = getSafePublicBaseUrl(req);
    const content = [
      'User-agent: *',
      'Allow: /',
      'Disallow: /admin',
      'Disallow: /quan-tri',
      'Disallow: /system-secret-admin',
      'Disallow: /api/',
      '',
      `Sitemap: ${baseUrl}/sitemap.xml`,
    ].join('\n');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(content);
  });

  app.get('/sitemap.xml', async (req, res) => {
    try {
      const baseUrl = getSafePublicBaseUrl(req);
      const tracks = await getTracks();
      const today = new Date().toISOString().split('T')[0];

      const urlsXml = tracks
        .map((t) => {
          const slug = slugifyServer(t.title) || t.id;
          const lastmod = t.created_at ? t.created_at.split('T')[0] : today;
          return `  <url>
    <loc>${baseUrl}/${slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
        })
        .join('\n');

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
${urlsXml}
</urlset>`;

      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.send(xml);
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  const distPath = path.join(process.cwd(), 'dist');
  const isProdMode =
    process.env.NODE_ENV === 'production' || process.argv.includes('--production');

  if (isProdMode && fs.existsSync(distPath)) {
    app.use(
      express.static(distPath, {
        index: false,
        maxAge: '7d',
        etag: true,
      })
    );

    const indexHtmlPath = path.join(distPath, 'index.html');
    let cachedIndexHtml = '';
    try {
      cachedIndexHtml = fs.readFileSync(indexHtmlPath, 'utf-8');
    } catch {
      cachedIndexHtml = '';
    }

    app.get('*', async (req, res) => {
      try {
        let html = cachedIndexHtml || fs.readFileSync(indexHtmlPath, 'utf-8');

        const baseUrl = getSafePublicBaseUrl(req);
        const settings = getSiteSettings();
        const brandName = (settings.siteName || 'Gối Ôm Audio').trim() || 'Gối Ôm Audio';
        const tagline = (settings.siteTagline || 'Web Nghe Truyện Audio Online Miễn Phí').trim();
        const heroTitle = (settings.heroTitle || '').trim();
        const heroDesc = (settings.heroDescription || '').trim();
        const faviconUrl =
          settings.faviconUrl ||
          settings.logoUrl ||
          'https://api.iconify.design/lucide:headphones.svg?color=%23f59e0b';

        const descParts: string[] = [];
        if (heroTitle) descParts.push(heroTitle);
        if (heroDesc) descParts.push(heroDesc);
        if (tagline && !heroDesc.toLowerCase().includes(tagline.toLowerCase())) {
          descParts.push(`${tagline} tại ${brandName}.`);
        }

        let pageTitle = tagline
          ? `${brandName} - ${tagline}`
          : `${brandName} - Web Nghe Truyện Audio Online Miễn Phí`;
        let pageDesc =
          descParts.length > 0
            ? descParts.join(' — ')
            : `${brandName} - ${tagline}. Kho truyện audio chất lượng cao nghe miễn phí.`;
        let canonicalUrl = `${baseUrl}/`;
        let jsonLdObj: any = {
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'WebSite',
              name: brandName,
              url: `${baseUrl}/`,
              description: pageDesc,
              inLanguage: 'vi-VN',
              potentialAction: {
                '@type': 'SearchAction',
                target: `${baseUrl}/?q={search_term_string}`,
                'query-input': 'required name=search_term_string',
              },
            },
            {
              '@type': 'Organization',
              name: brandName,
              url: `${baseUrl}/`,
              logo: faviconUrl.startsWith('http') ? faviconUrl : `${baseUrl}${faviconUrl}`,
            },
          ],
        };

        const cleanSlug = req.path
          .replace(/^\/+/, '')
          .replace(/\/+$/, '')
          .replace(/^(truyen|story)\//, '')
          .trim()
          .toLowerCase();

        if (cleanSlug && cleanSlug !== 'admin' && cleanSlug !== 'quan-tri' && cleanSlug !== 'system-secret-admin') {
          const tracks = await getTracks();
          const matched = tracks.find(
            (t) =>
              slugifyServer(t.title) === cleanSlug ||
              t.id.toLowerCase() === cleanSlug ||
              cleanSlug.endsWith(`--${t.id.toLowerCase()}`)
          );

          if (matched) {
            const storySlug = slugifyServer(matched.title) || matched.id;
            pageTitle = `${matched.title} (Audio Full) - ${brandName}`;
            pageDesc = matched.description
              ? `${matched.title} - ${matched.description.slice(0, 150)}... Thể loại: ${matched.category || 'Audio'}. Nghe trọn bộ miễn phí trên ${brandName}.`
              : `Nghe truyện audio trọn bộ ${matched.title} miễn phí chất lượng cao trên ${brandName}.`;
            canonicalUrl = `${baseUrl}/${storySlug}`;
            jsonLdObj = {
              '@context': 'https://schema.org',
              '@type': 'AudioObject',
              name: matched.title,
              description: matched.description || pageDesc,
              contentUrl: matched.mp3_url || matched.chapters?.[0]?.mp3_url || '',
              encodingFormat: 'audio/mpeg',
              author: { '@type': 'Person', name: matched.author || brandName },
              publisher: { '@type': 'Organization', name: brandName, url: baseUrl },
              inLanguage: 'vi-VN',
              genre: matched.category || 'Audio Story',
            };
          }
        }

        const escapeHtml = (str: string) =>
          str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        html = html
          .replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(pageTitle)}</title>`)
          .replace(
            /<meta name="description" content="[^"]*"\s*\/?>/i,
            `<meta name="description" content="${escapeHtml(pageDesc)}" />`
          )
          .replace(
            /<meta property="og:site_name" content="[^"]*"\s*\/?>/i,
            `<meta property="og:site_name" content="${escapeHtml(brandName)}" />`
          )
          .replace(
            /<meta property="og:title" content="[^"]*"\s*\/?>/i,
            `<meta property="og:title" content="${escapeHtml(pageTitle)}" />`
          )
          .replace(
            /<meta property="og:description" content="[^"]*"\s*\/?>/i,
            `<meta property="og:description" content="${escapeHtml(pageDesc)}" />`
          )
          .replace(
            /<meta property="og:url" content="[^"]*"\s*\/?>/i,
            `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`
          )
          .replace(
            /<meta name="twitter:title" content="[^"]*"\s*\/?>/i,
            `<meta name="twitter:title" content="${escapeHtml(pageTitle)}" />`
          )
          .replace(
            /<meta name="twitter:description" content="[^"]*"\s*\/?>/i,
            `<meta name="twitter:description" content="${escapeHtml(pageDesc)}" />`
          )
          .replace(
            /<link rel="canonical" href="[^"]*"\s*\/?>/i,
            `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`
          )
          .replace(
            /<link rel="icon" href="[^"]*"\s*\/?>/i,
            `<link rel="icon" href="${escapeHtml(faviconUrl)}" />`
          )
          .replace(
            /<script id="seo-jsonld-schema" type="application\/ld\+json">[\s\S]*?<\/script>/i,
            `<script id="seo-jsonld-schema" type="application/ld+json">\n${JSON.stringify(jsonLdObj, null, 2)}\n    </script>`
          );

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
      } catch {
        res.sendFile(path.join(distPath, 'index.html'));
      }
    });
  } else {
    // Mount Vite middleware for dev SPA
    const vite = await createViteServer({
      server: { 
        middlewareMode: true, 
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {
          ignored: ['**/data/**', '**/uploads/**', '**/backups/**'],
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
