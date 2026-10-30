import express from 'express';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { spawn } from 'child_process';
import {
  UPLOAD_ROOT_DIR,
  UPLOAD_AUDIO_DIR,
  UPLOAD_IMAGE_DIR,
  BACKUP_DIR,
  slugifyVietnamese,
  normalizeLocalChapterAudioSlug,
  getTracks,
  getTracksSync,
  getTrackById,
  addTrack,
  updateTrack,
  addChapterToTrack,
  deleteChapterFromTrack,
  deleteTrack,
  batchDeleteTracks,
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
  generateAdmin2FASetup,
  enableAdmin2FA,
  disableAdmin2FA,
  getBackupStatusInfo,
  getRawDatabaseData,
  createServerSnapshot,
  restoreDatabaseFromJson,
  restoreFromServerSnapshot,
  deleteServerSnapshot,
  normalizeAllAudioFilesToSlug,
  cleanupOrphanedUploadFiles,
  deleteSingleUploadAudioFile,
  detectAudioDurationSync,
  detectAudioDurationSecondsFast
} from './server-db';
import {
  recordTrafficVisit,
  recordTrafficUnlockClick,
  getTrafficAnalyticsReport,
  resetTrafficData
} from './server-traffic';

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

  const getCachedAudioDurationSec = (filePath: string, fallbackDurSec: number): number => {
    const cached = audioDurationSecCache.get(filePath);
    if (cached && cached > 0) return cached;
    const finalDur = detectAudioDurationSecondsFast(filePath, fallbackDurSec);
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

      // Crucial for VPS + Cloudflare:
      // - When seekSeconds > 0.5 (server-sliced seek): prevent any caching of sliced range
      // - When seekSeconds <= 0.5 (normal playback): allow browser private cache (max-age=3600) for fast buffering, while instructing Cloudflare CDN not to buffer/transform
      if (seekSeconds > 0.5) {
        res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate, no-transform');
        res.setHeader('CDN-Cache-Control', 'no-store');
        res.setHeader('Cloudflare-CDN-Cache-Control', 'no-store');
      } else {
        res.setHeader('Cache-Control', 'private, max-age=3600, no-transform');
        res.setHeader('CDN-Cache-Control', 'no-store');
        res.setHeader('Cloudflare-CDN-Cache-Control', 'no-store');
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

        const fileStream = fs.createReadStream(filePath, {
          start: diskStart,
          end: diskEnd,
          highWaterMark: 128 * 1024,
        });
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

        const fileStream = fs.createReadStream(filePath, {
          start: baseStartByte,
          end: fileSize - 1,
          highWaterMark: 128 * 1024,
        });
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

  // Body parsers: JSON, URL-encoded, and plain-text JSON fallback
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use('/api', express.text({ type: ['text/plain', 'application/*+json'], limit: '50mb' }), (req, _res, next) => {
    if (typeof req.body === 'string' && req.body.trim().startsWith('{')) {
      try {
        req.body = JSON.parse(req.body.trim());
      } catch {}
    } else if (!req.body || typeof req.body !== 'object') {
      req.body = {};
    }
    next();
  });

  // --- AUDIO UPLOAD API (AUTO CONVERT FILENAME TO CHAPTER TITLE SLUG) ---
  app.post('/api/upload-audio', (req, res) => {
    uploadAudioMiddleware.any()(req, res, (multerErr: any) => {
      try {
        if (multerErr) {
          return res.status(400).json({
            success: false,
            error: `Lỗi tải file audio: ${multerErr.message || String(multerErr)}`
          });
        }
        if (!verifyExternalApiKey(req, res)) return;

        const files = (req.files as Express.Multer.File[]) || [];
        const uploadedFile = req.file || files.find(f => f.fieldname === 'audio' || f.fieldname === 'file' || f.fieldname === 'mp3') || files[0];
        if (!uploadedFile) {
          return res.status(400).json({
            success: false,
            error: 'Không tìm thấy file audio để tải lên (vui lòng gửi form-data với trường "audio" hoặc "file")'
          });
        }

        let fileUrl = `/uploads/audio/${uploadedFile.filename}`;
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

        return res.json({
          success: true,
          url: fileUrl,
          mp3_url: fileUrl,
          audio_url: fileUrl,
          filename: finalFilename,
          originalName: uploadedFile.originalname,
          size: uploadedFile.size,
          duration: detectedDuration
        });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err.message });
      }
    });
  });

  // --- IMAGE UPLOAD API (LOGO, FAVICON, BANNER, COVER) ---
  app.post('/api/upload-image', (req, res) => {
    uploadImageMiddleware.any()(req, res, (multerErr: any) => {
      try {
        if (multerErr) {
          return res.status(400).json({
            success: false,
            error: `Lỗi tải file ảnh: ${multerErr.message || String(multerErr)}`
          });
        }
        if (!verifyExternalApiKey(req, res)) return;

        const files = (req.files as Express.Multer.File[]) || [];
        const uploadedFile = req.file || files.find(f => f.fieldname === 'image' || f.fieldname === 'file' || f.fieldname === 'thumb' || f.fieldname === 'cover') || files[0];
        if (!uploadedFile) {
          return res.status(400).json({
            success: false,
            error: 'Không tìm thấy file ảnh để tải lên (vui lòng gửi form-data với trường "image" hoặc "file")'
          });
        }

        const fileUrl = `/uploads/images/${uploadedFile.filename}`;
        return res.json({
          success: true,
          url: fileUrl,
          thumb_url: fileUrl,
          cover_url: fileUrl,
          filename: uploadedFile.filename,
          originalName: uploadedFile.originalname,
          size: uploadedFile.size
        });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err.message });
      }
    });
  });

  // --- UNIFIED STORY API GATEWAY (1 CỔNG DUY NHẤT ĐỂ ĐĂNG / SỬA / XÓA TRUYỆN) ---
  const handleStoryGateway = async (req: express.Request, res: express.Response) => {
    try {
      // Nếu payload.data là chuỗi JSON (khi gửi qua form-data), tự động parse
      let parsedDataObj: any = {};
      if (typeof req.body?.data === 'string' && req.body.data.trim().startsWith('{')) {
        try {
          parsedDataObj = JSON.parse(req.body.data.trim());
        } catch {}
      } else if (req.body?.data && typeof req.body.data === 'object') {
        parsedDataObj = req.body.data;
      }

      const mergedBody: any = {
        ...(req.body || {}),
        ...parsedDataObj
      };

      // Nếu gửi kèm chapters dưới dạng chuỗi JSON trong form-data
      if (typeof mergedBody.chapters === 'string' && mergedBody.chapters.trim().startsWith('[')) {
        try {
          mergedBody.chapters = JSON.parse(mergedBody.chapters.trim());
        } catch {}
      }
      if (typeof mergedBody.chapter === 'string' && mergedBody.chapter.trim().startsWith('{')) {
        try {
          mergedBody.chapter = JSON.parse(mergedBody.chapter.trim());
        } catch {}
      }

      // Nếu người dùng upload kèm file .mp3 trực tiếp vào /api/gateway (multipart/form-data)
      const files = (req.files as Express.Multer.File[]) || (req.file ? [req.file] : []);
      const audioFile = files.find(f => f.originalname?.toLowerCase().endsWith('.mp3') || f.fieldname === 'audio' || f.fieldname === 'mp3' || f.fieldname === 'file');
      if (audioFile) {
        const uploadedAudioUrl = `/uploads/audio/${audioFile.filename}`;
        if (!mergedBody.mp3_url && !mergedBody.audio_url) {
          mergedBody.mp3_url = uploadedAudioUrl;
        }
        if (mergedBody.chapter && typeof mergedBody.chapter === 'object' && !mergedBody.chapter.mp3_url) {
          mergedBody.chapter.mp3_url = uploadedAudioUrl;
        }
      }

      req.body = mergedBody;

      // Xác định action tự động nếu không truyền rõ
      let rawAction = String(
        mergedBody.action ||
        req.query?.action ||
        ''
      ).toLowerCase().trim();

      if (!rawAction) {
        if (req.method === 'GET') {
          rawAction = (req.query?.id || mergedBody.id) ? 'get' : 'list';
        } else if (req.method === 'DELETE') {
          rawAction = 'delete';
        } else if (req.method === 'PUT' || req.method === 'PATCH') {
          rawAction = 'update';
        } else if (mergedBody.chapter || mergedBody.chapter_title) {
          rawAction = 'add_chapter';
        } else if (mergedBody.title && !mergedBody.id) {
          rawAction = 'create';
        } else if (mergedBody.id && Object.keys(mergedBody).length > 1) {
          rawAction = 'update';
        } else {
          rawAction = 'list';
        }
      }

      // Chỉ yêu cầu API Key cho các thao tác ghi (create, update, add_chapter, delete_chapter, delete)
      const isReadOnlyAction = rawAction === 'list' || rawAction === 'get_all' || rawAction === 'get' || rawAction === 'detail';
      if (!isReadOnlyAction && !verifyExternalApiKey(req, res)) {
        return;
      }

      const targetId = String(
        mergedBody.id ||
        mergedBody.track_id ||
        mergedBody.story_id ||
        mergedBody.slug ||
        req.query?.id ||
        req.query?.slug ||
        ''
      ).trim();

      // 1. LIST ALL STORIES
      if (rawAction === 'list' || rawAction === 'get_all' || rawAction === 'danh_sach') {
        const tracks = await getTracks();
        return res.json({
          success: true,
          action: 'list',
          count: tracks.length,
          data: tracks
        });
      }

      // 2. GET SINGLE STORY BY ID OR SLUG
      if (rawAction === 'get' || rawAction === 'detail' || rawAction === 'chi_tiet') {
        if (!targetId) {
          return res.status(400).json({ success: false, error: 'Thiếu trường "id" (hoặc "slug") của truyện cần lấy thông tin.' });
        }
        const track = await getTrackById(targetId);
        if (!track) {
          return res.status(404).json({ success: false, error: `Không tìm thấy truyện có id/slug: ${targetId}` });
        }
        return res.json({
          success: true,
          action: 'get',
          data: track
        });
      }

      // 3. CREATE / POST NEW STORY
      if (rawAction === 'create' || rawAction === 'post' || rawAction === 'add' || rawAction === 'dang' || rawAction === 'them_truyen') {
        if (!mergedBody.title) {
          return res.status(400).json({
            success: false,
            error: 'Thiếu trường "title" (Tên truyện). Vui lòng truyền "title" khi đăng truyện mới.'
          });
        }
        const created = await addTrack(mergedBody);
        return res.status(201).json({
          success: true,
          action: 'create',
          message: `Đã đăng truyện mới "${created.title}" thành công!`,
          data: created
        });
      }

      // 4. UPDATE / EDIT EXISTING STORY
      if (rawAction === 'update' || rawAction === 'edit' || rawAction === 'put' || rawAction === 'patch' || rawAction === 'sua' || rawAction === 'cap_nhat') {
        if (!targetId) {
          return res.status(400).json({
            success: false,
            error: 'Thiếu trường "id" của truyện cần chỉnh sửa.'
          });
        }
        const cleanUpdates = { ...mergedBody };
        delete cleanUpdates.action;
        delete cleanUpdates.api_key;
        delete cleanUpdates.apiKey;
        delete cleanUpdates.data;

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

        const rawChapterObj = mergedBody.chapter || (Array.isArray(mergedBody.chapters) ? mergedBody.chapters[0] : null) || {};
        const resolvedMp3Url =
          rawChapterObj.mp3_url ||
          rawChapterObj.audio_url ||
          rawChapterObj.url ||
          rawChapterObj.mp3 ||
          mergedBody.mp3_url ||
          mergedBody.audio_url ||
          mergedBody.url ||
          '';

        const chapterData = {
          id: rawChapterObj.id ?? mergedBody.chapter_id,
          title: rawChapterObj.title || rawChapterObj.chapter_title || mergedBody.chapter_title || mergedBody.title,
          mp3_url: resolvedMp3Url,
          duration: rawChapterObj.duration || mergedBody.duration
        };

        if (!chapterData.mp3_url) {
          return res.status(400).json({
            success: false,
            error: 'Thiếu "mp3_url" (hoặc "audio_url") cho tập truyện mới.'
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
        const chapterId =
          mergedBody.chapter_id ??
          mergedBody.chapterId ??
          mergedBody.chapter_index ??
          mergedBody.index ??
          mergedBody.episode ??
          mergedBody.chapter?.id ??
          req.query?.chapter_id;

        if (!targetId || chapterId === undefined || chapterId === '') {
          return res.status(400).json({
            success: false,
            error: 'Thiếu "id" truyện hoặc "chapter_id" (hoặc "chapter_index") cần xóa.'
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
      if (rawAction === 'delete' || rawAction === 'remove' || rawAction === 'xoa' || rawAction === 'xoa_truyen') {
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
          message: `Đã xóa truyện có id "${targetId}" và dọn file MP3 liên quan khỏi Server thành công!`,
          deletedId: targetId
        });
      }

      // 8. CLEANUP ORPHANED AUDIO/IMAGE FILES IN UPLOADS/
      if (rawAction === 'cleanup' || rawAction === 'clean' || rawAction === 'don_dep' || rawAction === 'don_rac') {
        const result = cleanupOrphanedUploadFiles({
          includeImages: mergedBody.includeImages !== false
        });
        return res.json({
          ...result,
          action: 'cleanup'
        });
      }

      return res.status(400).json({
        success: false,
        error: `Action "${rawAction}" không hợp lệ. Các action hỗ trợ: "create" (đăng truyện), "update" (sửa truyện), "add_chapter" (thêm tập), "delete_chapter" (xóa tập), "delete" (xóa truyện), "cleanup" (dọn file rác), "list" (danh sách), "get" (chi tiết).`
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err.message || 'Lỗi xử lý tại cổng API'
      });
    }
  };

  // Cho phép gọi cổng Gateway bằng cả JSON, x-www-form-urlencoded, multipart/form-data và mọi HTTP method (GET/POST/PUT/PATCH/DELETE)
  const gatewayMiddleware = (req: express.Request, res: express.Response) => {
    const contentType = String(req.headers['content-type'] || '').toLowerCase();
    if (contentType.includes('multipart/form-data')) {
      uploadAudioMiddleware.any()(req, res, (err: any) => {
        if (err) {
          return res.status(400).json({ success: false, error: `Lỗi đọc dữ liệu form-data: ${err.message}` });
        }
        handleStoryGateway(req, res);
      });
    } else {
      handleStoryGateway(req, res);
    }
  };

  app.all(['/api/gateway', '/api/v1/stories/gateway', '/api/v1/gateway'], gatewayMiddleware);

  // --- FAST SINGLE-REQUEST BOOTSTRAP ENDPOINT FOR INITIAL PAGE LOAD ---
  app.get('/api/bootstrap', async (req, res) => {
    try {
      const tracks = await getTracks();
      const siteSettings = getSiteSettings();
      const includeAdminData = req.query.full === '1';
      const payloadObj = includeAdminData
        ? { tracks, siteSettings, categories: getCategories(), links: getAffiliateLinks() }
        : { tracks, siteSettings };

      const jsonStr = JSON.stringify(payloadObj);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');

      const acceptEncoding = String(req.headers['accept-encoding'] || '');
      if (acceptEncoding.includes('gzip') && jsonStr.length > 1024) {
        res.setHeader('Content-Encoding', 'gzip');
        res.send(zlib.gzipSync(Buffer.from(jsonStr, 'utf-8')));
        return;
      }
      res.send(jsonStr);
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

  app.post('/api/tracks/batch-delete', async (req, res) => {
    try {
      if (!verifyExternalApiKey(req, res)) return;
      const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
      if (ids.length === 0) {
        return res.status(400).json({ success: false, error: 'Danh sách ID truyện cần xóa trống' });
      }
      const deletedCount = await batchDeleteTracks(ids);
      res.json({ success: true, deletedCount });
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
      recordTrafficUnlockClick();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- TRAFFIC ANALYTICS & VISITOR MEASUREMENT API ---
  app.post('/api/traffic/visit', (req, res) => {
    try {
      recordTrafficVisit(req, {
        path: req.body?.path,
        referrer: req.body?.referrer,
        screenWidth: req.body?.screenWidth
      });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/traffic/stats', (_req, res) => {
    try {
      const stats = getTrafficAnalyticsReport();
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/traffic/reset', (_req, res) => {
    try {
      const result = resetTrafficData();
      res.json(result);
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

  // --- ADMIN ACCOUNTS & AUTH API (CREATE, UPDATE, DELETE INCLUDING DEFAULT ACCOUNT & GOOGLE AUTHENTICATOR 2FA) ---
  // Giới hạn 5 lần đăng nhập / 1 phút theo IP
  const loginRateLimitMap = new Map<string, { count: number; resetAt: number }>();

  app.post('/api/admin/login', (req, res) => {
    try {
      const clientIp =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        (req.headers['x-real-ip'] as string) ||
        req.socket.remoteAddress ||
        'unknown';

      const now = Date.now();
      const windowMs = 60 * 1000; // 1 phút
      const maxAttempts = 5;

      let record = loginRateLimitMap.get(clientIp);
      if (!record || now > record.resetAt) {
        record = { count: 0, resetAt: now + windowMs };
      }

      if (record.count >= maxAttempts) {
        const waitSec = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
        return res.status(429).json({
          success: false,
          error: `Bạn đã thử đăng nhập quá 5 lần/phút. Vui lòng đợi ${waitSec} giây nữa rồi thử lại!`
        });
      }

      const identifier = req.body?.email || req.body?.username || req.body?.identifier || '';
      const password = req.body?.password || '';
      const twoFactorToken = req.body?.twoFactorToken || req.body?.token || req.body?.otp || '';
      const result = verifyAdminCredentials(identifier, password, twoFactorToken);
      if (!result.success) {
        if (result.require2FA) {
          return res.status(200).json(result);
        }
        record.count += 1;
        loginRateLimitMap.set(clientIp, record);
        return res.status(401).json(result);
      }

      // Đăng nhập thành công -> xóa bộ đếm lỗi của IP này
      loginRateLimitMap.delete(clientIp);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- GOOGLE AUTHENTICATOR (TOTP 2FA) ENDPOINTS ---
  app.post('/api/admin/2fa/generate', async (req, res) => {
    try {
      const accountId = req.body?.accountId || '';
      const result = await generateAdmin2FASetup(accountId);
      if (!result.success) {
        return res.status(400).json(result);
      }
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/admin/2fa/enable', (req, res) => {
    try {
      const { accountId, secret, token } = req.body || {};
      const result = enableAdmin2FA(accountId, secret, token);
      if (!result.success) {
        return res.status(400).json(result);
      }
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/admin/2fa/disable', (req, res) => {
    try {
      const { accountId } = req.body || {};
      const result = disableAdmin2FA(accountId);
      if (!result.success) {
        return res.status(400).json(result);
      }
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
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

  app.post(['/api/backup/cleanup-orphans', '/api/admin/cleanup-uploads'], (req, res) => {
    try {
      const result = cleanupOrphanedUploadFiles({
        includeImages: req.body?.includeImages !== false,
        targetFilenames: Array.isArray(req.body?.targetFilenames) ? req.body.targetFilenames : undefined
      });
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  app.delete('/api/backup/audio-file/:filename', (req, res) => {
    try {
      const result = deleteSingleUploadAudioFile(req.params.filename);
      if (!result.success) {
        return res.status(404).json(result);
      }
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

  // Đảm bảo mọi đường dẫn /api/* không khớp hoặc bị lỗi cú pháp JSON đều trả về JSON chuẩn, tuyệt đối không bao giờ trả về trang HTML
  app.all('/api/*', (req, res) => {
    res.status(404).json({
      success: false,
      error: `Không tìm thấy đường dẫn API: ${req.method} ${req.path}. Cổng API chính thức là POST /api/gateway hoặc /api/tracks.`
    });
  });

  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path.startsWith('/api')) {
      return res.status(err.status || 400).json({
        success: false,
        error: err.message || 'Dữ liệu gửi lên cổng API không hợp lệ'
      });
    }
    next(err);
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

        let matchedTrackThumb = '';

        if (cleanSlug && cleanSlug !== 'admin' && cleanSlug !== 'quan-tri' && cleanSlug !== 'system-secret-admin') {
          const tracks = await getTracks();
          const matched = tracks.find(
            (t) =>
              slugifyServer(t.title) === cleanSlug ||
              t.id.toLowerCase() === cleanSlug ||
              cleanSlug.endsWith(`--${t.id.toLowerCase()}`)
          );

          if (matched) {
            matchedTrackThumb = matched.thumb_url || '';
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

        const rawOgImage = matchedTrackThumb || settings.ogImage || settings.logoUrl || '';
        let fullOgImage = '';
        if (rawOgImage) {
          fullOgImage = rawOgImage.startsWith('http') ? rawOgImage : `${baseUrl}${rawOgImage.startsWith('/') ? '' : '/'}${rawOgImage}`;
        }

        const bootstrapJson = JSON.stringify({
          tracks: getTracksSync(),
          siteSettings: settings,
        }).replace(/</g, '\\u003c');

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
            /<meta property="og:image" content="[^"]*"\s*\/?>/i,
            fullOgImage ? `<meta property="og:image" content="${escapeHtml(fullOgImage)}" />` : ''
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
            /<meta name="twitter:image" content="[^"]*"\s*\/?>/i,
            fullOgImage ? `<meta name="twitter:image" content="${escapeHtml(fullOgImage)}" />` : ''
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
            `<script id="seo-jsonld-schema" type="application/ld+json">\n${JSON.stringify(jsonLdObj, null, 2)}\n    </script>\n    <script>window.__INITIAL_BOOTSTRAP__=${bootstrapJson};</script>`
          );

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        const acceptEncoding = String(req.headers['accept-encoding'] || '');
        if (acceptEncoding.includes('gzip')) {
          res.setHeader('Content-Encoding', 'gzip');
          res.send(zlib.gzipSync(Buffer.from(html, 'utf-8')));
          return;
        }
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
