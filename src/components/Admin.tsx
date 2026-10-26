import React, { useState, useEffect, useMemo } from 'react';
import { 
  Lock, ShieldCheck, Upload, Image as ImageIcon, Plus, 
  Trash2, Edit3, CheckCircle2, AlertCircle, Database, RefreshCw, 
  ArrowLeft, ExternalLink, Play, Copy, Check, Shuffle, Sparkles,
  Sliders, Globe, Palette, BookmarkCheck, Folder, FolderPlus, Layers,
  AlertTriangle, Power, Filter, Search, Code2, Terminal, Download, PlayCircle,
  CheckSquare, Square, Zap, Users, UserPlus, Key, Eye, EyeOff,
  HardDrive, Archive, FileJson, FileAudio, RotateCcw, Server, Clock
} from 'lucide-react';
import { Track, Chapter, AffiliateItem, AffiliateCategory, SiteSettings, AdminAccount } from '../types';
import { getStoryPath } from '../services/seo';
import { 
  executeClientSQL, 
  validateDatabaseIntegrity, 
  generateFullSQLMigration, 
  SQLQueryResult, 
  DBHealthCheck 
} from '../services/sqlEngine';
import { 
  supabase, 
  isSupabaseConfigured, 
  isAuthorizedAdminEmail, 
  createTrack, 
  updateTrack, 
  deleteTrack, 
  uploadAudioFile, 
  uploadCoverImage,
  slugifyChapterTitle,
  DEFAULT_TRACKS,
  fetchAffiliateCategories,
  getAffiliateCategories,
  createAffiliateCategory,
  deleteAffiliateCategoryAndLinks,
  toggleAffiliateCategoryStatus,
  fetchAffiliateLinks,
  getAffiliateLinks,
  bulkAddAffiliateLinks,
  deleteAffiliateLink,
  deleteMultipleAffiliateLinks,
  toggleAffiliateStatus,
  fetchSiteSettings,
  saveSiteSettings,
  resetDefaultTracks,
  getSupabaseConfig,
  saveSupabaseConfig,
  detectPlatformFromUrl,
  getRandomAffiliateLink,
  getEligibleAffiliateLinks,
  fetchAdminAccounts,
  getAdminAccountsCache,
  loginAdminOnServer,
  createAdminAccountOnServer,
  updateAdminAccountOnServer,
  deleteAdminAccountOnServer,
  BackupStatusResponse,
  fetchBackupStatusInfo,
  createServerBackupSnapshot,
  restoreDatabaseOnServer,
  restoreFromServerSnapshotApi,
  deleteServerSnapshotApi,
  normalizeAllAudioSlugsOnServer,
  cleanupOrphanedFilesOnServer,
  deleteSingleAudioFileOnServer
} from '../services/api';

interface AdminProps {
  tracks: Track[];
  onRefreshTracks: () => void;
  onExitAdmin: () => void;
  onPreviewTrack: (track: Track) => void;
  siteSettings: SiteSettings;
  onUpdateSiteSettings: (settings: SiteSettings) => void;
}

export const Admin: React.FC<AdminProps> = ({
  tracks,
  onRefreshTracks,
  onExitAdmin,
  onPreviewTrack,
  siteSettings,
  onUpdateSiteSettings,
}) => {
  // Auth state
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [authInputEmail, setAuthInputEmail] = useState<string>('');
  const [authInputPassword, setAuthInputPassword] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(false);

  // Active View in Admin
  const [activeTab, setActiveTab] = useState<'manage' | 'add' | 'affiliate' | 'settings' | 'accounts' | 'backup' | 'api' | 'sql'>('manage');

  // Admin Accounts Management State (Server-backed)
  const [adminAccounts, setAdminAccounts] = useState<AdminAccount[]>(() => getAdminAccountsCache());
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [accEmailInput, setAccEmailInput] = useState<string>('');
  const [accUsernameInput, setAccUsernameInput] = useState<string>('');
  const [accPasswordInput, setAccPasswordInput] = useState<string>('');
  const [accNameInput, setAccNameInput] = useState<string>('');
  const [accRoleInput, setAccRoleInput] = useState<string>('Super Admin');
  const [showAccPassword, setShowAccPassword] = useState<boolean>(false);
  const [visiblePasswordsMap, setVisiblePasswordsMap] = useState<Record<string, boolean>>({});
  const [accountFormMsg, setAccountFormMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSavingAccount, setIsSavingAccount] = useState<boolean>(false);

  // Backup & Restore State (Server-backed)
  const [backupInfo, setBackupInfo] = useState<BackupStatusResponse | null>(null);
  const [isLoadingBackup, setIsLoadingBackup] = useState<boolean>(false);
  const [backupMsg, setBackupMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [manageCleanupMsg, setManageCleanupMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [snapshotLabelInput, setSnapshotLabelInput] = useState<string>('');
  const [isRestoringDb, setIsRestoringDb] = useState<boolean>(false);
  const [audioFilesFilter, setAudioFilesFilter] = useState<'all' | 'orphan' | 'used'>('all');

  const loadBackupInfo = async () => {
    setIsLoadingBackup(true);
    try {
      const info = await fetchBackupStatusInfo();
      if (info) setBackupInfo(info);
    } finally {
      setIsLoadingBackup(false);
    }
  };

  useEffect(() => {
    loadBackupInfo();
  }, [tracks.length]);

  const formatBytes = (bytes: number): string => {
    if (!bytes || bytes <= 0) return '0 KB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleCleanupOrphanedFiles = () => {
    const orphanAudioCount = backupInfo?.uploadsDir.orphanAudioFilesCount ?? 0;
    const orphanImageCount = backupInfo?.uploadsDir.orphanImageFilesCount ?? 0;
    const orphanAudioBytes = backupInfo?.uploadsDir.orphanAudioSizeBytes ?? 0;
    const orphanImageBytes = backupInfo?.uploadsDir.orphanImageSizeBytes ?? 0;
    const totalOrphans = orphanAudioCount + orphanImageCount;
    const totalOrphanSize = formatBytes(orphanAudioBytes + orphanImageBytes);

    const orphanFileNames = (backupInfo?.uploadsDir.audioFiles || [])
      .filter(f => f.isUsedInDb === false)
      .map(f => `• ${f.filename} (${formatBytes(f.sizeBytes)})`)
      .slice(0, 10)
      .join('\n');

    setConfirmModal({
      isOpen: true,
      title: 'Quét & Dọn Dẹp File Audio Rác (uploads/audio)',
      message:
        totalOrphans > 0
          ? `Hệ thống đã đối chiếu với Database (data/db.json) và phát hiện:\n• ${orphanAudioCount} file MP3 thừa trong uploads/audio/\n• ${orphanImageCount} file ảnh thừa trong uploads/images/\n• Tổng dung lượng giải phóng: ${totalOrphanSize}\n\nDanh sách file MP3 sẽ bị xóa:\n${orphanFileNames}${orphanAudioCount > 10 ? `\n... và ${orphanAudioCount - 10} file khác` : ''}\n\nCác file đang gắn với truyện trong Database được giữ nguyên an toàn 100%. Bạn có chắc chắn muốn dọn sạch ngay không?`
          : `Hệ thống sẽ quét toàn bộ thư mục uploads/audio/ và uploads/images/, đối chiếu trực tiếp với Database (data/db.json) và xóa toàn bộ các file MP3 / hình ảnh của những truyện hoặc tập đã bị xóa trước đó.\n\nBạn có muốn chạy quét và dọn dẹp ngay không?`,
      confirmLabel: totalOrphans > 0 ? `Dọn Sạch ${totalOrphans} File Rác (${totalOrphanSize})` : 'Quét & Dọn Dẹp Ngay',
      isDestructive: totalOrphans > 0,
      onConfirm: async () => {
        setIsLoadingBackup(true);
        setBackupMsg(null);
        setManageCleanupMsg(null);
        try {
          const res = await cleanupOrphanedFilesOnServer({ includeImages: true });
          if (res.info) {
            setBackupInfo(res.info);
          } else {
            await loadBackupInfo();
          }
          const msgObj = {
            type: (res.success ? 'success' : 'error') as 'success' | 'error',
            text: res.message
          };
          setBackupMsg(msgObj);
          setManageCleanupMsg(msgObj);
        } finally {
          setIsLoadingBackup(false);
        }
      }
    });
  };

  const handleDeleteSingleAudioFile = (filename: string, isUsedInDb?: boolean, usedBy?: string[]) => {
    setConfirmModal({
      isOpen: true,
      title: `Xác Nhận Xóa File "${filename}"`,
      message: isUsedInDb
        ? `CẢNH BÁO: File "${filename}" hiện ĐANG ĐƯỢC SỬ DỤNG bởi truyện:\n• ${(usedBy || []).join('\n• ')}\n\nNếu xóa file vật lý này khỏi uploads/audio/, tập truyện đó sẽ không phát được âm thanh nữa. Bạn có chắc chắn vẫn muốn xóa không?`
        : `File "${filename}" là file rác (không còn gắn với bất kỳ truyện nào trong Database).\n\nBạn có chắc chắn muốn xóa vĩnh viễn file này khỏi thư mục uploads/audio/ trên Server không?`,
      confirmLabel: 'Xóa File Khỏi Server',
      isDestructive: true,
      onConfirm: async () => {
        setIsLoadingBackup(true);
        setBackupMsg(null);
        try {
          const res = await deleteSingleAudioFileOnServer(filename);
          if (res.info) {
            setBackupInfo(res.info);
          } else {
            await loadBackupInfo();
          }
          setBackupMsg({
            type: res.success ? 'success' : 'error',
            text: res.message
          });
        } finally {
          setIsLoadingBackup(false);
        }
      }
    });
  };

  const handleCreateServerSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoadingBackup(true);
    setBackupMsg(null);
    try {
      const res = await createServerBackupSnapshot(snapshotLabelInput.trim());
      if (res.success) {
        if (res.info) setBackupInfo(res.info);
        setSnapshotLabelInput('');
        setBackupMsg({
          type: 'success',
          text: `Đã tạo bản sao lưu trên Server: ${res.filename} thành công!`
        });
      } else {
        setBackupMsg({
          type: 'error',
          text: res.error || 'Không thể tạo bản sao lưu trên Server.'
        });
      }
    } finally {
      setIsLoadingBackup(false);
    }
  };

  const handleNormalizeAllSlugs = async () => {
    setIsLoadingBackup(true);
    setBackupMsg(null);
    try {
      const res = await normalizeAllAudioSlugsOnServer();
      if (res.info) setBackupInfo(res.info);
      onRefreshTracks();
      setBackupMsg({
        type: res.success ? 'success' : 'error',
        text: res.message
      });
    } finally {
      setIsLoadingBackup(false);
    }
  };

  const handleRestoreDbFromFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setConfirmModal({
      isOpen: true,
      title: `Khôi Phục Dữ Liệu Từ File "${file.name}"`,
      message: `Hệ thống sẽ tự động tạo 1 bản sao lưu dự phòng trên Server trước khi ghi đè file "${file.name}" vào data/db.json.\n\nBạn có chắc chắn muốn khôi phục dữ liệu từ file này không?`,
      confirmLabel: 'Khôi Phục Ngay',
      isDestructive: false,
      onConfirm: async () => {
        setIsRestoringDb(true);
        setBackupMsg(null);
        try {
          const text = await file.text();
          const parsed = JSON.parse(text);
          const res = await restoreDatabaseOnServer(parsed);
          if (res.info) setBackupInfo(res.info);
          if (res.success) {
            onRefreshTracks();
            loadSettingsFromServer();
            fetchAffiliateCategories().then(cats => setAffiliateCategories(cats));
            fetchAffiliateLinks().then(links => setAffiliateList(links));
            fetchAdminAccounts().then(accs => setAdminAccounts(accs));
          }
          setBackupMsg({
            type: res.success ? 'success' : 'error',
            text: res.message
          });
        } catch (err: any) {
          setBackupMsg({
            type: 'error',
            text: 'File JSON không đúng định dạng: ' + err.message
          });
        } finally {
          setIsRestoringDb(false);
        }
      }
    });
  };

  const handleRestoreFromSnapshot = (filename: string) => {
    setConfirmModal({
      isOpen: true,
      title: `Khôi Phục Bản Sao Lưu "${filename}"`,
      message: `Hệ thống sẽ khôi phục toàn bộ dữ liệu từ bản sao lưu "${filename}" vào data/db.json trên Server.\n\nBạn có chắc chắn muốn khôi phục không?`,
      confirmLabel: 'Khôi Phục Bản Này',
      isDestructive: false,
      onConfirm: async () => {
        setIsLoadingBackup(true);
        setBackupMsg(null);
        try {
          const res = await restoreFromServerSnapshotApi(filename);
          if (res.info) setBackupInfo(res.info);
          if (res.success) {
            onRefreshTracks();
            loadSettingsFromServer();
            fetchAffiliateCategories().then(cats => setAffiliateCategories(cats));
            fetchAffiliateLinks().then(links => setAffiliateList(links));
            fetchAdminAccounts().then(accs => setAdminAccounts(accs));
          }
          setBackupMsg({
            type: res.success ? 'success' : 'error',
            text: res.message
          });
        } finally {
          setIsLoadingBackup(false);
        }
      }
    });
  };

  const handleDeleteSnapshot = (filename: string) => {
    setConfirmModal({
      isOpen: true,
      title: `Xóa Bản Sao Lưu "${filename}"`,
      message: `Bạn có chắc chắn muốn xóa file sao lưu "${filename}" khỏi thư mục backups/ trên Server không?`,
      confirmLabel: 'Xóa Bản Sao Lưu',
      isDestructive: true,
      onConfirm: async () => {
        const res = await deleteServerSnapshotApi(filename);
        if (res.info) setBackupInfo(res.info);
        if (res.success) {
          setBackupMsg({
            type: 'success',
            text: `Đã xóa bản sao lưu "${filename}" khỏi Server.`
          });
        }
      }
    });
  };

  // Story API Gateway & Live Playground State
  const [apiDocExample, setApiDocExample] = useState<'create' | 'update' | 'add_chapter' | 'delete_chapter' | 'delete' | 'upload' | 'upload_image'>('create');
  const [apiCopiedKey, setApiCopiedKey] = useState<string | null>(null);
  const [apiPlaygroundAction, setApiPlaygroundAction] = useState<'create' | 'update' | 'add_chapter' | 'delete_chapter' | 'delete' | 'get' | 'list'>('create');
  const [apiPlaygroundTargetId, setApiPlaygroundTargetId] = useState<string>(tracks[0]?.id || 'track-1');
  const [apiPlaygroundBody, setApiPlaygroundBody] = useState<string>(() => JSON.stringify({
    action: 'create',
    title: 'Đêm Trăng Máu Nơi Miếu Hoang',
    author: 'Nguyễn Huy',
    narrator: 'Gối Ôm Audio',
    category: 'Truyện Ma',
    description: 'Bộ truyện ma kinh dị dài kỳ được đăng tự động qua cổng API.',
    is_hot: true,
    is_featured: false,
    chapters: [
      {
        id: 1,
        title: 'Phần 1: Tiếng gọi lúc nửa đêm',
        mp3_url: 'https://cdn.freesound.org/previews/612/612610_5674468-lq.mp3'
      }
    ]
  }, null, 2));
  const [apiPlaygroundLoading, setApiPlaygroundLoading] = useState<boolean>(false);
  const [apiPlaygroundResponse, setApiPlaygroundResponse] = useState<{ status: number; data: any; timeMs: number } | null>(null);

  const handleCopyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setApiCopiedKey(key);
    setTimeout(() => setApiCopiedKey(null), 2000);
  };

  const handleSwitchPlaygroundTemplate = (actionType: 'create' | 'update' | 'add_chapter' | 'delete_chapter' | 'delete' | 'get' | 'list', customId?: string) => {
    setApiPlaygroundAction(actionType);
    const sampleId = customId || apiPlaygroundTargetId || tracks[0]?.id || 'track-1';
    const sampleTrack = tracks.find(t => t.id === sampleId) || tracks[0];

    if (actionType === 'create') {
      setApiPlaygroundBody(JSON.stringify({
        action: 'create',
        title: 'Đêm Trăng Máu Nơi Miếu Hoang',
        author: 'Nguyễn Huy',
        narrator: 'Gối Ôm Audio',
        category: 'Truyện Ma',
        description: 'Bộ truyện ma kinh dị dài kỳ được đăng tự động qua cổng API.',
        is_hot: true,
        is_featured: false,
        chapters: [
          {
            id: 1,
            title: 'Phần 1: Tiếng gọi lúc nửa đêm',
            mp3_url: '/uploads/audio/dem-trang-mau-noi-mieu-hoang-phan-1.mp3',
            duration: '45:10'
          }
        ]
      }, null, 2));
    } else if (actionType === 'update') {
      setApiPlaygroundBody(JSON.stringify({
        action: 'update',
        id: sampleId,
        title: (sampleTrack?.title || 'Truyện cập nhật') + ' (Đã cập nhật)',
        author: sampleTrack?.author || 'Nguyễn Huy',
        category: sampleTrack?.category || 'Truyện Ma',
        description: sampleTrack?.description || 'Nội dung mô tả truyện đã được cập nhật qua cổng API.',
        is_hot: true
      }, null, 2));
    } else if (actionType === 'add_chapter') {
      const nextEp = (sampleTrack?.chapters?.length || 1) + 1;
      setApiPlaygroundBody(JSON.stringify({
        action: 'add_chapter',
        id: sampleId,
        chapter: {
          title: `Phần ${nextEp}: Tập mới cập nhật qua API`,
          mp3_url: '/uploads/audio/tap-moi-cap-nhat.mp3',
          duration: '48:00'
        }
      }, null, 2));
    } else if (actionType === 'delete_chapter') {
      const lastChapterId = sampleTrack?.chapters?.[sampleTrack.chapters.length - 1]?.id || 1;
      setApiPlaygroundBody(JSON.stringify({
        action: 'delete_chapter',
        id: sampleId,
        chapter_id: lastChapterId
      }, null, 2));
    } else if (actionType === 'delete') {
      setApiPlaygroundBody(JSON.stringify({
        action: 'delete',
        id: sampleId
      }, null, 2));
    } else if (actionType === 'get') {
      setApiPlaygroundBody(JSON.stringify({
        action: 'get',
        id: sampleId
      }, null, 2));
    } else if (actionType === 'list') {
      setApiPlaygroundBody(JSON.stringify({
        action: 'list'
      }, null, 2));
    }
  };

  const handleRunApiPlayground = async () => {
    setApiPlaygroundLoading(true);
    setApiPlaygroundResponse(null);
    const startTime = performance.now();
    try {
      let parsedBody: any = {};
      try {
        parsedBody = JSON.parse(apiPlaygroundBody);
      } catch (e: any) {
        setApiPlaygroundResponse({
          status: 400,
          data: { success: false, error: 'Lỗi cú pháp JSON Body: ' + e.message },
          timeMs: 0
        });
        setApiPlaygroundLoading(false);
        return;
      }

      // Tự động đồng bộ cấu hình API Key hiện tại lên Server trước khi chạy test để không bao giờ lệch Key
      if (
        settingsForm.requireApiKey !== siteSettings.requireApiKey ||
        settingsForm.apiKey !== siteSettings.apiKey
      ) {
        const synced = await saveSiteSettings(settingsForm);
        setSettingsForm(synced);
        onUpdateSiteSettings(synced);
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (settingsForm.apiKey) {
        headers['x-api-key'] = settingsForm.apiKey;
      }

      const res = await fetch('/api/gateway', {
        method: 'POST',
        headers,
        body: JSON.stringify(parsedBody)
      });

      const rawText = await res.text();
      let json: any;
      try {
        json = JSON.parse(rawText);
      } catch {
        json = {
          success: false,
          error: rawText.trim().startsWith('<')
            ? 'Máy chủ Web (Nginx) trả về HTML thay vì JSON. Vui lòng kiểm tra cấu hình proxy_pass http://127.0.0.1:3000 cho /api/ trong Nginx.'
            : rawText || `HTTP ${res.status}`
        };
      }

      const elapsed = Math.round(performance.now() - startTime);
      setApiPlaygroundResponse({
        status: res.status,
        data: json,
        timeMs: elapsed
      });
      if (res.ok && parsedBody.action !== 'list' && parsedBody.action !== 'get') {
        onRefreshTracks();
      }
    } catch (err: any) {
      setApiPlaygroundResponse({
        status: 500,
        data: { success: false, error: err.message },
        timeMs: Math.round(performance.now() - startTime)
      });
    } finally {
      setApiPlaygroundLoading(false);
    }
  };

  // Website Branding & Banner Settings State (Server-backed)
  const [settingsForm, setSettingsForm] = useState<SiteSettings>(siteSettings);
  const [settingsSaveMsg, setSettingsSaveMsg] = useState<string | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);
  const [logoUploading, setLogoUploading] = useState<boolean>(false);
  const [faviconUploading, setFaviconUploading] = useState<boolean>(false);
  const [bannerImageUploading, setBannerImageUploading] = useState<boolean>(false);

  useEffect(() => {
    setSettingsForm(siteSettings);
  }, [siteSettings]);

  const loadSettingsFromServer = async () => {
    const serverSettings = await fetchSiteSettings();
    if (serverSettings) {
      setSettingsForm(serverSettings);
      onUpdateSiteSettings(serverSettings);
    }
  };

  const handleSaveSettings = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    setIsSavingSettings(true);
    setSettingsSaveMsg(null);
    try {
      const saved = await saveSiteSettings(settingsForm);
      setSettingsForm(saved);
      onUpdateSiteSettings(saved);
      setSettingsSaveMsg('Đã lưu cấu hình trực tiếp lên Server thành công!');
      setTimeout(() => setSettingsSaveMsg(null), 4000);
    } catch (err: any) {
      setSettingsSaveMsg('Lỗi lưu cài đặt lên Server: ' + err.message);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // In-app Modal Confirmation state (replaces window.confirm to avoid iframe blocking)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  } | null>(null);

  const handleBannerImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBannerImageUploading(true);
    try {
      const url = await uploadCoverImage(file);
      const updated = { ...settingsForm, heroBannerImage: url };
      setSettingsForm(updated);
      const saved = await saveSiteSettings(updated);
      onUpdateSiteSettings(saved);
      setSettingsSaveMsg('Đã tải ảnh Banner lên Server và lưu thành công!');
      setTimeout(() => setSettingsSaveMsg(null), 3500);
    } catch (err: any) {
      setSettingsSaveMsg('Lỗi tải ảnh Banner lên Server: ' + err.message);
    } finally {
      setBannerImageUploading(false);
    }
  };

  const handleRemoveBannerImage = async () => {
    const updated = { ...settingsForm, heroBannerImage: '' };
    setSettingsForm(updated);
    const saved = await saveSiteSettings(updated);
    onUpdateSiteSettings(saved);
    setSettingsSaveMsg('Đã xóa ảnh nền Banner trên Server!');
    setTimeout(() => setSettingsSaveMsg(null), 3000);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const url = await uploadCoverImage(file);
      const updated = { ...settingsForm, logoUrl: url };
      setSettingsForm(updated);
      const saved = await saveSiteSettings(updated);
      onUpdateSiteSettings(saved);
      setSettingsSaveMsg('Đã tải ảnh Logo lên Server và lưu thành công!');
      setTimeout(() => setSettingsSaveMsg(null), 3500);
    } catch (err: any) {
      setSettingsSaveMsg('Lỗi tải ảnh logo: ' + err.message);
    } finally {
      setLogoUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    const updated = { ...settingsForm, logoUrl: '' };
    setSettingsForm(updated);
    const saved = await saveSiteSettings(updated);
    onUpdateSiteSettings(saved);
    setSettingsSaveMsg('Đã xóa Logo tùy chỉnh trên Server (về biểu tượng mặc định)!');
    setTimeout(() => setSettingsSaveMsg(null), 3000);
  };

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFaviconUploading(true);
    try {
      const url = await uploadCoverImage(file);
      const updated = { ...settingsForm, faviconUrl: url };
      setSettingsForm(updated);
      const saved = await saveSiteSettings(updated);
      onUpdateSiteSettings(saved);
      setSettingsSaveMsg('Đã tải Favicon lên Server và lưu thành công!');
      setTimeout(() => setSettingsSaveMsg(null), 3500);
    } catch (err: any) {
      setSettingsSaveMsg('Lỗi tải favicon: ' + err.message);
    } finally {
      setFaviconUploading(false);
    }
  };

  const handleRemoveFavicon = async () => {
    const updated = { ...settingsForm, faviconUrl: '' };
    setSettingsForm(updated);
    const saved = await saveSiteSettings(updated);
    onUpdateSiteSettings(saved);
    setSettingsSaveMsg('Đã xóa Favicon tùy chỉnh trên Server!');
    setTimeout(() => setSettingsSaveMsg(null), 3000);
  };

  // Affiliate Categories & Links Management State (Server-backed)
  const [affiliateCategories, setAffiliateCategories] = useState<AffiliateCategory[]>(() => getAffiliateCategories());
  const [affiliateList, setAffiliateList] = useState<AffiliateItem[]>(() => getAffiliateLinks());
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [affiliateSearch, setAffiliateSearch] = useState<string>('');
  
  // Bulk import & selection states (Chế độ duy nhất: Thêm số lượng lớn)
  const [bulkInputText, setBulkInputText] = useState<string>('');
  const [selectedLinkIds, setSelectedLinkIds] = useState<string[]>([]);
  const [randomTestResult, setRandomTestResult] = useState<AffiliateItem | null>(null);

  // Category Form State (Thêm danh mục / tài khoản mới)
  const [showAddCatForm, setShowAddCatForm] = useState<boolean>(false);
  const [newCatName, setNewCatName] = useState<string>('');
  const [newCatPlatform, setNewCatPlatform] = useState<'Shopee' | 'TikTok' | 'Lazada' | 'Khác'>('Shopee');
  const [newCatDescription, setNewCatDescription] = useState<string>('');

  // Target category for bulk link adding
  const [newAffCategoryId, setNewAffCategoryId] = useState<string>(() => affiliateCategories[0]?.id || '');
  const [affiliateMessage, setAffiliateMessage] = useState<string | null>(null);

  // Supabase SQL Server Configuration State
  const [supabaseUrlInput, setSupabaseUrlInput] = useState<string>('');
  const [supabaseKeyInput, setSupabaseKeyInput] = useState<string>('');
  const [supabaseConfigStatus, setSupabaseConfigStatus] = useState<string | null>(null);
  const [isSavingSupabase, setIsSavingSupabase] = useState<boolean>(false);
  const [isSupabaseServerConnected, setIsSupabaseServerConnected] = useState<boolean>(false);

  // Initial load directly from Server endpoints
  useEffect(() => {
    loadSettingsFromServer();

    fetchAffiliateCategories().then(cats => {
      if (cats && cats.length > 0) {
        setAffiliateCategories(cats);
        if (!newAffCategoryId && cats[0]) {
          setNewAffCategoryId(cats[0].id);
        }
      }
    });

    fetchAffiliateLinks().then(links => {
      if (links && links.length > 0) {
        setAffiliateList(links);
      }
    });

    getSupabaseConfig().then(cfg => {
      if (cfg) {
        setSupabaseUrlInput(cfg.url || '');
        setSupabaseKeyInput(cfg.anonKey || '');
        setIsSupabaseServerConnected(cfg.isConfigured);
      }
    });
  }, []);

  // Form State for Adding / Editing Track
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState<string>('');
  const [formAuthor, setFormAuthor] = useState<string>('');
  const [formNarrator, setFormNarrator] = useState<string>('Phú Bà Audio');
  const [formCategory, setFormCategory] = useState<string>('Truyện Ma');
  const [formMp3Url, setFormMp3Url] = useState<string>('');
  const [formThumbUrl, setFormThumbUrl] = useState<string>('');
  const [formAffiliateLink, setFormAffiliateLink] = useState<string>('https://shopee.vn');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formIsFeatured, setFormIsFeatured] = useState<boolean>(false);
  const [formIsHot, setFormIsHot] = useState<boolean>(false);
  const [formPlayCount, setFormPlayCount] = useState<number>(0);
  const [formChapters, setFormChapters] = useState<Chapter[]>([
    { id: 1, title: 'Phần 1: Khởi đầu', duration: '25:00', mp3_url: '' }
  ]);

  // Form submit status
  const [formSubmitLoading, setFormSubmitLoading] = useState<boolean>(false);
  const [formMessage, setFormMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Search & Filter in Table
  const [tableSearch, setTableSearch] = useState<string>('');
  const [sqlCopied, setSqlCopied] = useState<boolean>(false);

  // SQL Console & Health State
  const [sqlInput, setSqlInput] = useState<string>(
    'SELECT id, title, category, author, play_count FROM tracks ORDER BY play_count DESC LIMIT 10;'
  );
  const [sqlResult, setSqlResult] = useState<SQLQueryResult | null>(null);
  const [healthReport, setHealthReport] = useState<DBHealthCheck>(() => validateDatabaseIntegrity(tracks));
  const [isExecutingSql, setIsExecutingSql] = useState<boolean>(false);

  useEffect(() => {
    setHealthReport(validateDatabaseIntegrity(tracks));
  }, [tracks]);

  const handleRunSQL = () => {
    setIsExecutingSql(true);
    setTimeout(() => {
      const res = executeClientSQL(sqlInput, tracks, () => {
        onRefreshTracks();
      });
      setSqlResult(res);
      setIsExecutingSql(false);
    }, 60);
  };

  const handleDownloadSQL = () => {
    const fullSql = generateFullSQLMigration(tracks);
    const blob = new Blob([fullSql], { type: 'text/sql;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `phuba-audio-schema-${new Date().toISOString().split('T')[0]}.sql`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Cấu hình Supabase SQL lưu trực tiếp lên Server
  const handleSaveSupabaseConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSupabase(true);
    setSupabaseConfigStatus(null);
    try {
      const res = await saveSupabaseConfig(supabaseUrlInput.trim(), supabaseKeyInput.trim());
      setIsSupabaseServerConnected(res.isConfigured);
      setSupabaseConfigStatus(res.message);
      if (res.success) {
        onRefreshTracks();
      }
    } catch (err: any) {
      setSupabaseConfigStatus('Lỗi khi lưu cấu hình: ' + err.message);
    } finally {
      setIsSavingSupabase(false);
    }
  };

  // Affiliate Handlers: Tạo danh mục / tài khoản mới (Gửi trực tiếp lên Server)
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    try {
      const created = await createAffiliateCategory({
        name: newCatName.trim(),
        platform: newCatPlatform,
        description: newCatDescription.trim()
      });

      setAffiliateCategories(prev => [...prev, created]);
      if (!newAffCategoryId) {
        setNewAffCategoryId(created.id);
      }
      setNewCatName('');
      setNewCatDescription('');
      setShowAddCatForm(false);
      setAffiliateMessage(`Đã thêm danh mục tài khoản "${created.name}" lên Server thành công!`);
      setTimeout(() => setAffiliateMessage(null), 3500);
    } catch (err: any) {
      setAffiliateMessage('Lỗi thêm danh mục: ' + err.message);
    }
  };

  // Affiliate Handlers: Xóa danh mục / tài khoản trên Server
  const handleDeleteCategory = (cat: AffiliateCategory) => {
    const linkedItemsCount = affiliateList.filter(l => l.categoryId === cat.id).length;
    setConfirmModal({
      isOpen: true,
      title: `Xác Nhận Xóa Tài Khoản: "${cat.name}"`,
      message: linkedItemsCount > 0
        ? `Tài khoản này đang có ${linkedItemsCount} liên kết đang gán. Bấm "Xóa Vĩnh Viễn" sẽ gọi Server xóa danh mục này và TẤT CẢ ${linkedItemsCount} liên kết liên quan khỏi cơ sở dữ liệu!\n\nBạn có chắc chắn muốn xóa không?`
        : `Bạn có chắc chắn muốn gọi Server xóa vĩnh viễn danh mục tài khoản "${cat.name}" không?`,
      confirmLabel: 'Xóa Vĩnh Viễn Trên Server',
      isDestructive: true,
      onConfirm: async () => {
        const result = await deleteAffiliateCategoryAndLinks(cat.id);
        setAffiliateCategories(result.categories);
        setAffiliateList(result.links);

        if (selectedCategoryFilter === cat.id) {
          setSelectedCategoryFilter('all');
        }
        setSelectedLinkIds(prev => prev.filter(id => result.links.some(l => l.id === id)));

        setAffiliateMessage(`Đã gọi Server xóa vĩnh viễn danh mục "${cat.name}" cùng ${linkedItemsCount} link tiếp thị!`);
        setTimeout(() => setAffiliateMessage(null), 3500);
      }
    });
  };

  // Affiliate Handlers: Bật/tắt trạng thái toàn bộ danh mục tài khoản trên Server
  const handleToggleCategory = async (catId: string) => {
    const result = await toggleAffiliateCategoryStatus(catId);
    setAffiliateCategories(result.categories);
    setAffiliateList(result.links);
  };

  // Xử lý thêm hàng loạt nhiều link lên Server
  const handleBulkAddAffiliates = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkInputText.trim()) return;

    const lines = bulkInputText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const parsedItems: Array<{
      url: string;
      title?: string;
      platform?: 'Shopee' | 'TikTok' | 'Lazada' | 'Khác';
      categoryId?: string;
    }> = [];

    const targetCat = affiliateCategories.find(c => c.id === newAffCategoryId) || affiliateCategories[0];

    lines.forEach((line) => {
      const urlMatch = line.match(/(https?:\/\/[^\s]+)/i);
      if (urlMatch) {
        const url = urlMatch[1];
        let title = '';
        const textWithoutUrl = line.replace(url, '').replace(/[|:\-—–]/g, ' ').trim();
        if (textWithoutUrl.length > 2) {
          title = textWithoutUrl;
        } else {
          title = `${targetCat ? targetCat.name : 'Deal'} #${affiliateList.length + parsedItems.length + 1}`;
        }

        parsedItems.push({
          url,
          title,
          categoryId: targetCat?.id,
          platform: targetCat ? targetCat.platform : detectPlatformFromUrl(url)
        });
      }
    });

    if (parsedItems.length === 0) {
      setAffiliateMessage('Không tìm thấy đường dẫn (URL http:// hoặc https://) hợp lệ nào trong nội dung bạn dán.');
      setTimeout(() => setAffiliateMessage(null), 4000);
      return;
    }

    try {
      const result = await bulkAddAffiliateLinks(parsedItems);
      setAffiliateList(result.links);
      setBulkInputText('');
      setAffiliateMessage(`Đã thêm thành công ${result.addedCount} liên kết lên Server vào "${targetCat?.name || 'Tài khoản chính'}"!`);
      setTimeout(() => setAffiliateMessage(null), 4000);
    } catch (err: any) {
      setAffiliateMessage('Lỗi thêm link lên server: ' + err.message);
    }
  };

  const handleToggleAffiliateActive = async (id: string) => {
    const updated = await toggleAffiliateStatus(id);
    setAffiliateList(updated);
  };

  const handleDeleteAffiliate = (id: string, title?: string, url?: string) => {
    const itemTarget = affiliateList.find(item => item.id === id);
    const itemLabel = title || itemTarget?.title || 'liên kết này';
    const itemUrl = url || itemTarget?.url || '';

    setConfirmModal({
      isOpen: true,
      title: 'Xác Nhận Xóa Link Affiliate',
      message: `Bạn có chắc chắn muốn XÓA VĨNH VIỄN link affiliate này trên Server không?\n\n• Tiêu đề: "${itemLabel}"\n• URL: ${itemUrl}\n\nThao tác này sẽ gọi Server loại bỏ link khỏi cơ sở dữ liệu.`,
      confirmLabel: 'Xóa Link Khỏi Server',
      isDestructive: true,
      onConfirm: async () => {
        const updated = await deleteAffiliateLink(id);
        setAffiliateList(updated);
        setSelectedLinkIds(prev => prev.filter(item => item !== id));
        setAffiliateMessage(`Đã xóa liên kết "${itemLabel}" trên Server thành công!`);
        setTimeout(() => setAffiliateMessage(null), 3000);
      }
    });
  };

  // Xóa hàng loạt các link đã chọn bằng checkbox trên Server
  const handleBatchDeleteAffiliates = () => {
    if (selectedLinkIds.length === 0) return;
    setConfirmModal({
      isOpen: true,
      title: `Xác Nhận Xóa ${selectedLinkIds.length} Liên Kết Đã Chọn`,
      message: `Bạn có chắc chắn muốn gọi Server xóa vĩnh viễn ${selectedLinkIds.length} liên kết tiếp thị đang được chọn không?`,
      confirmLabel: `Xóa ${selectedLinkIds.length} Link Trên Server`,
      isDestructive: true,
      onConfirm: async () => {
        const count = selectedLinkIds.length;
        const updated = await deleteMultipleAffiliateLinks(selectedLinkIds);
        setAffiliateList(updated);
        setSelectedLinkIds([]);
        setAffiliateMessage(`Đã gọi Server xóa thành công ${count} liên kết affiliate đã chọn!`);
        setTimeout(() => setAffiliateMessage(null), 3500);
      }
    });
  };

  const handleBatchToggleActive = async (activate: boolean) => {
    if (selectedLinkIds.length === 0) return;
    const promises = selectedLinkIds.map(id => toggleAffiliateStatus(id));
    const results = await Promise.all(promises);
    if (results.length > 0) {
      setAffiliateList(results[results.length - 1]);
    }
    setAffiliateMessage(`Đã ${activate ? 'bật' : 'tắt'} ${selectedLinkIds.length} liên kết trên Server!`);
    setTimeout(() => setAffiliateMessage(null), 3000);
  };

  // Thử nghiệm quay random trực tiếp trong Quản trị
  const handleTestRandomAffiliate = () => {
    const picked = getRandomAffiliateLink();
    setRandomTestResult(picked);
  };

  // Check auth session & load admin accounts from Server
  useEffect(() => {
    fetchAdminAccounts().then((accs) => {
      setAdminAccounts(accs);
      const savedLocalAdmin = sessionStorage.getItem('phuba_admin_authenticated');
      if (savedLocalAdmin) {
        const clean = savedLocalAdmin.trim().toLowerCase();
        const matched = accs.find(
          (a) =>
            a.email.trim().toLowerCase() === clean ||
            (a.username && a.username.trim().toLowerCase() === clean)
        );
        if (matched) {
          setCurrentUserEmail(matched.email);
        } else {
          sessionStorage.removeItem('phuba_admin_authenticated');
          setCurrentUserEmail(null);
        }
      }
    });

    if (supabase) {
      supabase.auth.getUser().then(({ data }) => {
        if (data?.user?.email && isAuthorizedAdminEmail(data.user.email)) {
          setCurrentUserEmail(data.user.email);
        }
      });
    }
  }, []);

  const isAuthorized = Boolean(
    currentUserEmail &&
      (adminAccounts.some(
        (acc) =>
          acc.email.trim().toLowerCase() === currentUserEmail.trim().toLowerCase() ||
          (acc.username && acc.username.trim().toLowerCase() === currentUserEmail.trim().toLowerCase())
      ) ||
        isAuthorizedAdminEmail(currentUserEmail))
  );

  // Handle Login (Verified directly against Server Admin Accounts)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);
    setIsAuthLoading(true);

    const cleanIdentifier = authInputEmail.trim();
    const cleanPassword = authInputPassword.trim();

    if (!cleanIdentifier || !cleanPassword) {
      setAuthError('Vui lòng nhập đầy đủ Email/Tên đăng nhập và Mật khẩu quản trị.');
      setIsAuthLoading(false);
      return;
    }

    const loginRes = await loginAdminOnServer(cleanIdentifier, cleanPassword);
    if (loginRes.success && loginRes.account) {
      sessionStorage.setItem('phuba_admin_authenticated', loginRes.account.email);
      setCurrentUserEmail(loginRes.account.email);
      const latestAccounts = await fetchAdminAccounts();
      setAdminAccounts(latestAccounts);
      setAuthSuccess('Đăng nhập thành công vào Quản Trị CMS!');
      setIsAuthLoading(false);
      return;
    }

    // Fallback: If Supabase client configured, attempt sign in
    if (supabase && cleanPassword) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanIdentifier,
          password: cleanPassword,
        });

        if (!error && data.user?.email && isAuthorizedAdminEmail(data.user.email)) {
          sessionStorage.setItem('phuba_admin_authenticated', data.user.email);
          setCurrentUserEmail(data.user.email);
          setAuthSuccess('Đăng nhập Supabase Auth thành công!');
          setIsAuthLoading(false);
          return;
        }
      } catch {
        // Ignore fallback error
      }
    }

    setAuthError(loginRes.error || 'Tài khoản hoặc mật khẩu quản trị không đúng!');
    setIsAuthLoading(false);
  };

  const handleLogout = async () => {
    sessionStorage.removeItem('phuba_admin_authenticated');
    setCurrentUserEmail(null);
    if (supabase) {
      await supabase.auth.signOut();
    }
  };

  // --- ADMIN ACCOUNTS CRUD HANDLERS ---
  const resetAccountForm = () => {
    setEditingAccountId(null);
    setAccEmailInput('');
    setAccUsernameInput('');
    setAccPasswordInput('');
    setAccNameInput('');
    setAccRoleInput('Super Admin');
    setShowAccPassword(false);
  };

  const handleStartEditAccount = (acc: AdminAccount) => {
    setEditingAccountId(acc.id);
    setAccEmailInput(acc.email);
    setAccUsernameInput(acc.username || '');
    setAccPasswordInput(acc.password);
    setAccNameInput(acc.name || '');
    setAccRoleInput(acc.role || 'Super Admin');
    setAccountFormMsg(null);
  };

  const handleSaveAdminAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountFormMsg(null);
    setIsSavingAccount(true);

    const prevAccount = editingAccountId
      ? adminAccounts.find((a) => a.id === editingAccountId)
      : null;

    try {
      if (editingAccountId) {
        const res = await updateAdminAccountOnServer(editingAccountId, {
          email: accEmailInput.trim(),
          username: accUsernameInput.trim(),
          password: accPasswordInput.trim(),
          name: accNameInput.trim(),
          role: accRoleInput.trim()
        });

        if (!res.success) {
          setAccountFormMsg({ type: 'error', text: res.error || 'Lỗi cập nhật tài khoản.' });
          setIsSavingAccount(false);
          return;
        }

        setAdminAccounts(res.accounts);

        // If the currently logged-in admin updated their own email, update session seamlessly
        if (
          prevAccount &&
          currentUserEmail &&
          prevAccount.email.toLowerCase() === currentUserEmail.toLowerCase() &&
          res.account
        ) {
          sessionStorage.setItem('phuba_admin_authenticated', res.account.email);
          setCurrentUserEmail(res.account.email);
        }

        setAccountFormMsg({
          type: 'success',
          text: `Đã cập nhật tài khoản quản trị "${res.account?.email}" trên Server thành công!`
        });
        resetAccountForm();
      } else {
        const res = await createAdminAccountOnServer({
          email: accEmailInput.trim(),
          username: accUsernameInput.trim(),
          password: accPasswordInput.trim(),
          name: accNameInput.trim(),
          role: accRoleInput.trim()
        });

        if (!res.success) {
          setAccountFormMsg({ type: 'error', text: res.error || 'Lỗi tạo tài khoản mới.' });
          setIsSavingAccount(false);
          return;
        }

        setAdminAccounts(res.accounts);
        setAccountFormMsg({
          type: 'success',
          text: `Đã tạo tài khoản quản trị mới "${res.account?.email}" trên Server thành công!`
        });
        resetAccountForm();
      }
    } catch (err: any) {
      setAccountFormMsg({ type: 'error', text: err.message || 'Lỗi lưu tài khoản trên Server' });
    } finally {
      setIsSavingAccount(false);
    }
  };

  const handleDeleteAdminAccount = (acc: AdminAccount) => {
    const isSelf =
      currentUserEmail && acc.email.trim().toLowerCase() === currentUserEmail.trim().toLowerCase();
    const isLastAccount = adminAccounts.length <= 1;

    setConfirmModal({
      isOpen: true,
      title: `Xác Nhận Xóa Tài Khoản Quản Trị: "${acc.email}"`,
      message: isLastAccount
        ? `CẢNH BÁO: Đây là tài khoản quản trị duy nhất hiện có. Nếu bạn xóa tài khoản này, hệ thống sẽ tự động cấp lại tài khoản mặc định (tuld2901@gmail.com / admin123) ở lần đăng nhập kế tiếp để tránh mất quyền truy cập CMS.\n\nBạn có chắc chắn muốn xóa tài khoản "${acc.email}" không?`
        : `Bạn có chắc chắn muốn XÓA VĨNH VIỄN tài khoản quản trị "${acc.email}" (${acc.name || 'Admin'}) khỏi Server không?${isSelf ? '\n\nLưu ý: Bạn đang đăng nhập bằng chính tài khoản này, sau khi xóa hệ thống sẽ đăng xuất phiên hiện tại.' : ''}`,
      confirmLabel: 'Xóa Tài Khoản Khỏi Server',
      isDestructive: true,
      onConfirm: async () => {
        const res = await deleteAdminAccountOnServer(acc.id);
        if (res.success) {
          setAdminAccounts(res.accounts);
          if (editingAccountId === acc.id) {
            resetAccountForm();
          }
          if (isSelf) {
            handleLogout();
          } else {
            setAccountFormMsg({
              type: 'success',
              text: `Đã xóa tài khoản quản trị "${acc.email}" khỏi Server thành công!`
            });
          }
        } else {
          setAccountFormMsg({
            type: 'error',
            text: res.error || 'Không thể xóa tài khoản quản trị.'
          });
        }
      }
    });
  };

  // Chapters management in form
  const [uploadingChapterIdx, setUploadingChapterIdx] = useState<number | null>(null);

  const detectAudioFileDuration = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      let settled = false;

      const formatSecs = (secs: number): string => {
        const s = Math.max(1, Math.floor(secs));
        const hrs = Math.floor(s / 3600);
        const mins = Math.floor((s % 3600) / 60);
        const rem = s % 60;
        return hrs > 0
          ? `${hrs}:${mins < 10 ? '0' : ''}${mins}:${rem < 10 ? '0' : ''}${rem}`
          : `${mins < 10 ? '0' : ''}${mins}:${rem < 10 ? '0' : ''}${rem}`;
      };

      // Fallback calculation based on file size (standard 128kbps MP3 = 16,000 bytes/sec)
      const fallbackSecs = Math.max(1, Math.round(file.size / 16000));
      const fallbackFormatted = formatSecs(fallbackSecs);

      try {
        const audio = document.createElement('audio');
        const objectUrl = URL.createObjectURL(file);
        audio.preload = 'metadata';

        const finish = (result: string) => {
          if (!settled) {
            settled = true;
            try { URL.revokeObjectURL(objectUrl); } catch {}
            resolve(result || fallbackFormatted);
          }
        };

        // Safety timeout: if browser audio decoder takes over 2 seconds, immediately resolve with calculated estimate
        const timer = setTimeout(() => {
          finish(fallbackFormatted);
        }, 2000);

        audio.onloadedmetadata = () => {
          clearTimeout(timer);
          const secs = audio.duration;
          if (secs > 0 && isFinite(secs)) {
            finish(formatSecs(secs));
          } else {
            finish(fallbackFormatted);
          }
        };

        audio.onerror = () => {
          clearTimeout(timer);
          finish(fallbackFormatted);
        };

        audio.src = objectUrl;
      } catch {
        resolve(fallbackFormatted);
      }
    });
  };

  const handleUploadChapterMp3 = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingChapterIdx(index);
    setFormMessage(null);
    try {
      const currentChapterTitle = formChapters[index]?.title || `Tập ${index + 1}`;
      // Compute duration immediately from the file
      const detectedDuration = await detectAudioFileDuration(file);
      const uploadRes = await uploadAudioFile(file, currentChapterTitle, formTitle);
      const serverUrl = typeof uploadRes === 'string' ? uploadRes : uploadRes.url;
      const serverDuration = typeof uploadRes === 'object' ? uploadRes.duration : null;
      const finalDuration = serverDuration || detectedDuration || '25:00';

      setFormChapters(prev => prev.map((ch, i) => {
        if (i === index) {
          return {
            ...ch,
            mp3_url: serverUrl,
            duration: finalDuration
          };
        }
        return ch;
      }));

      if (index === 0) {
        setFormMp3Url(serverUrl);
      }
    } catch (err: any) {
      setFormMessage({ type: 'error', text: `Lỗi upload file MP3 tập ${index + 1}: ${err.message}` });
    } finally {
      setUploadingChapterIdx(null);
    }
  };

  const handleAddChapter = () => {
    const nextIdx = formChapters.length + 1;
    setFormChapters([
      ...formChapters,
      {
        id: nextIdx,
        title: `Phần ${nextIdx}: Tập mới`,
        duration: '25:00',
        mp3_url: '',
      }
    ]);
  };

  const handleUpdateChapter = (index: number, key: keyof Chapter, val: any) => {
    const next = [...formChapters];
    next[index] = { ...next[index], [key]: val };
    setFormChapters(next);
  };

  const handleRemoveChapter = (index: number) => {
    if (formChapters.length <= 1) return;
    setFormChapters(formChapters.filter((_, i) => i !== index));
  };

  // Submit form (Create or Update track)
  const handleSubmitTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMessage(null);
    setFormSubmitLoading(true);

    if (!formTitle.trim()) {
      setFormMessage({ type: 'error', text: 'Vui lòng nhập tiêu đề truyện!' });
      setFormSubmitLoading(false);
      return;
    }

    const payload: Partial<Track> = {
      title: formTitle.trim(),
      author: formAuthor.trim() || 'Đang cập nhật',
      narrator: formNarrator.trim() || 'Phú Bà Audio',
      category: formCategory,
      mp3_url: formMp3Url.trim() || (formChapters[0]?.mp3_url || 'https://cdn.freesound.org/previews/612/612610_5674468-lq.mp3'),
      thumb_url: formThumbUrl.trim() || 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80',
      affiliate_link: formAffiliateLink.trim() || 'https://shopee.vn',
      description: formDescription.trim(),
      is_featured: formIsFeatured,
      is_hot: formIsHot,
      play_count: Math.max(0, Number(formPlayCount) || 0),
      chapters: formChapters.map(ch => ({
        ...ch,
        duration: ch.duration && ch.duration.trim() ? ch.duration.trim() : '25:00',
        mp3_url: ch.mp3_url || formMp3Url || 'https://cdn.freesound.org/previews/612/612610_5674468-lq.mp3'
      }))
    };

    try {
      if (editingTrackId) {
        await updateTrack(editingTrackId, payload);
        setFormMessage({ type: 'success', text: 'Cập nhật truyện thành công!' });
      } else {
        await createTrack(payload);
        setFormMessage({ type: 'success', text: 'Đã thêm truyện mới thành công vào Database!' });
      }

      onRefreshTracks();
      setTimeout(() => {
        resetForm();
        setActiveTab('manage');
      }, 1000);
    } catch (err: any) {
      setFormMessage({ type: 'error', text: err.message || 'Lỗi khi lưu dữ liệu' });
    } finally {
      setFormSubmitLoading(false);
    }
  };

  const handleEditTrack = (track: Track) => {
    setEditingTrackId(track.id);
    setFormTitle(track.title);
    setFormAuthor(track.author || '');
    setFormNarrator(track.narrator || 'Phú Bà Audio');
    setFormCategory(track.category || 'Truyện Ma');
    setFormMp3Url(track.mp3_url || '');
    setFormThumbUrl(track.thumb_url || '');
    setFormAffiliateLink(track.affiliate_link || 'https://shopee.vn');
    setFormDescription(track.description || '');
    setFormIsFeatured(Boolean(track.is_featured));
    setFormIsHot(Boolean(track.is_hot));
    setFormPlayCount(Number(track.play_count) || 0);
    setFormChapters(track.chapters && track.chapters.length > 0 ? track.chapters : [
      { id: 1, title: 'Phần 1', duration: '25:00', mp3_url: track.mp3_url }
    ]);
    setActiveTab('add');
  };

  const handleDeleteTrack = (id: string, title: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Xác Nhận Xóa Truyện Audio',
      message: `Bạn có chắc chắn muốn xóa bộ truyện: "${title}" không? Toàn bộ các tập truyện liên quan cũng sẽ bị xóa khỏi cơ sở dữ liệu.`,
      confirmLabel: 'Xóa Truyện',
      isDestructive: true,
      onConfirm: async () => {
        await deleteTrack(id);
        onRefreshTracks();
        loadBackupInfo();
      }
    });
  };

  const resetForm = () => {
    setEditingTrackId(null);
    setFormTitle('');
    setFormAuthor('');
    setFormNarrator('Phú Bà Audio');
    setFormCategory('Truyện Ma');
    setFormMp3Url('');
    setFormThumbUrl('');
    setFormAffiliateLink('https://shopee.vn');
    setFormDescription('');
    setFormIsFeatured(false);
    setFormIsHot(false);
    setFormPlayCount(0);
    setFormChapters([{ id: 1, title: 'Phần 1: Khởi đầu', duration: '25:00', mp3_url: '' }]);
    setFormMessage(null);
  };

  // Dynamic Production SQL Script for Copy & Export
  const SQL_SNIPPET = useMemo(() => generateFullSQLMigration(tracks), [tracks]);

  // Filter table
  const filteredTracks = tracks.filter(t => 
    !tableSearch ||
    t.title.toLowerCase().includes(tableSearch.toLowerCase()) ||
    t.author.toLowerCase().includes(tableSearch.toLowerCase()) ||
    t.category.toLowerCase().includes(tableSearch.toLowerCase())
  );

  // If Not Authorized: Render Secure Login
  if (!isAuthorized) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-[#121723] p-6 sm:p-8 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Lock size={32} />
          </div>

          <div>
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block mb-1">
              Admin CMS Control Panel
            </span>
            <h2 className="text-2xl font-black text-white">Quản Trị CMS</h2>
            <p className="text-xs text-slate-400 mt-2">
              Hệ thống quản lý Audio, Banner, Favicon & Phân loại Danh mục Affiliate
            </p>
          </div>

          {authError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 text-left">
              <AlertCircle size={16} className="shrink-0 text-rose-400" />
              <span>{authError}</span>
            </div>
          )}

          {authSuccess && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 text-left">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
              <span>{authSuccess}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="text-xs text-slate-300 font-medium block mb-1.5">
                Email Hoặc Tên Đăng Nhập Quản Trị
              </label>
              <input
                type="text"
                value={authInputEmail}
                onChange={(e) => setAuthInputEmail(e.target.value)}
                required
                autoComplete="username"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-amber-400"
                placeholder="Nhập tài khoản quản trị"
              />
            </div>

            <div>
              <label className="text-xs text-slate-300 font-medium block mb-1.5">
                Mật Khẩu Quản Trị
              </label>
              <input
                type="password"
                value={authInputPassword}
                onChange={(e) => setAuthInputPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-amber-400 font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={isAuthLoading}
              className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 hover:brightness-110 shadow-lg shadow-amber-500/20 transition cursor-pointer flex items-center justify-center gap-2"
            >
              <ShieldCheck size={18} />
              <span>{isAuthLoading ? 'Đang xác thực...' : 'Đăng Nhập Trang Quản Trị'}</span>
            </button>
          </form>

          <div className="pt-2 border-t border-slate-800 text-center">
            <button
              onClick={onExitAdmin}
              className="text-xs text-slate-400 hover:text-white transition cursor-pointer"
            >
              ← Quay lại trang chủ nghe truyện
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Authorized Admin CMS Dashboard
  return (
    <div className="space-y-6 pb-28 animate-fade-in">
      {/* Top Admin Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-[#141a29] to-[#0f1422] border border-amber-500/20 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <ShieldCheck size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-white">Quản Trị CMS</h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Authorized
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Đăng nhập dưới quyền: <span className="text-amber-300 font-semibold">{currentUserEmail}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-medium border border-slate-700 flex items-center gap-1.5">
            <Database size={14} className={isSupabaseServerConnected ? 'text-emerald-400' : 'text-amber-400'} />
            <span className="text-slate-300">
              {isSupabaseServerConnected ? 'Supabase Live Connected' : 'Server Database Mode'}
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition cursor-pointer"
          >
            Đăng xuất
          </button>

          <button
            onClick={onExitAdmin}
            className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white flex items-center gap-1.5 border border-slate-700 transition cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Xem Website</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 flex-wrap">
        <button
          onClick={() => {
            setActiveTab('manage');
            resetForm();
          }}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer ${
            activeTab === 'manage'
              ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <span>Danh Sách Truyện ({tracks.length})</span>
        </button>

        <button
          onClick={() => {
            resetForm();
            setActiveTab('add');
          }}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer ${
            activeTab === 'add'
              ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Plus size={16} />
          <span>{editingTrackId ? 'Chỉnh Sửa Truyện' : 'Thêm Truyện Mới'}</span>
        </button>

        <button
          onClick={() => setActiveTab('affiliate')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer ${
            activeTab === 'affiliate'
              ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Shuffle size={16} />
          <span>Danh Sách Affiliate Random ({affiliateList.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('settings');
            loadSettingsFromServer();
          }}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer ${
            activeTab === 'settings'
              ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Sliders size={16} />
          <span>Cài Đặt Website & Banner</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('accounts');
            fetchAdminAccounts().then(accs => setAdminAccounts(accs));
          }}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer ${
            activeTab === 'accounts'
              ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Users size={16} />
          <span>Tài Khoản Quản Trị ({adminAccounts.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('backup');
            loadBackupInfo();
          }}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer ${
            activeTab === 'backup'
              ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <HardDrive size={16} />
          <span>Backup Dữ Liệu</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('api');
            loadSettingsFromServer();
          }}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer ${
            activeTab === 'api'
              ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Code2 size={16} />
          <span>Cổng API Truyện (Đăng/Sửa/Xóa)</span>
        </button>

        <button
          onClick={() => setActiveTab('sql')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer ${
            activeTab === 'sql'
              ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Database size={16} />
          <span>Cấu Hình Supabase SQL</span>
        </button>
      </div>

      {/* TAB 1: MANAGE TRACKS */}
      {activeTab === 'manage' && (
        <div className="space-y-4">
          {/* Orphaned Audio Files Alert Banner (if any orphan files exist in uploads/audio) */}
          {(backupInfo?.uploadsDir.orphanAudioFilesCount ?? 0) > 0 && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                  <Trash2 size={18} />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white">
                    Phát hiện {backupInfo?.uploadsDir.orphanAudioFilesCount} file MP3 rác ({formatBytes(backupInfo?.uploadsDir.orphanAudioSizeBytes || 0)}) trong <code className="text-amber-300 font-mono">uploads/audio/</code>
                  </h4>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Đây là các file của những truyện/tập đã xóa trước đây hoặc upload nháp nhưng không còn nằm trong <code className="text-amber-300 font-mono">data/db.json</code>.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setAudioFilesFilter('orphan');
                    setActiveTab('backup');
                    loadBackupInfo();
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
                >
                  Xem danh sách file
                </button>
                <button
                  type="button"
                  onClick={handleCleanupOrphanedFiles}
                  disabled={isLoadingBackup}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1.5 shadow-md shadow-rose-600/20 transition cursor-pointer"
                >
                  <Trash2 size={13} />
                  <span>Dọn Sạch Ngay ({formatBytes(backupInfo?.uploadsDir.orphanAudioSizeBytes || 0)})</span>
                </button>
              </div>
            </div>
          )}

          {manageCleanupMsg && (
            <div className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 ${
              manageCleanupMsg.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
            }`}>
              <div className="flex items-center gap-2">
                {manageCleanupMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <span>{manageCleanupMsg.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setManageCleanupMsg(null)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <input
              type="text"
              placeholder="Tìm kiếm truyện theo tiêu đề, tác giả, thể loại..."
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              className="max-w-md w-full px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400"
            />

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleCleanupOrphanedFiles}
                disabled={isLoadingBackup}
                className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border ${
                  (backupInfo?.uploadsDir.orphanAudioFilesCount ?? 0) > 0
                    ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border-rose-500/30'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
                title="Quét dựa vào data/db.json và xóa toàn bộ file MP3 thừa trong uploads/audio/"
              >
                <Trash2 size={13} />
                <span>
                  Dọn File Audio Rác
                  {(backupInfo?.uploadsDir.orphanAudioFilesCount ?? 0) > 0
                    ? ` (${backupInfo?.uploadsDir.orphanAudioFilesCount} file thừa)`
                    : ''}
                </span>
              </button>

              <button
                onClick={() => {
                  resetForm();
                  setActiveTab('add');
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus size={14} />
                <span>Thêm Truyện</span>
              </button>
            </div>
          </div>

          {/* Tracks Table */}
          <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-900/60">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-3.5">Truyện</th>
                    <th className="p-3.5">Thể loại</th>
                    <th className="p-3.5">Tác giả / Diễn đọc</th>
                    <th className="p-3.5">Lượt nghe</th>
                    <th className="p-3.5">Số phần</th>
                    <th className="p-3.5">Link Affiliate</th>
                    <th className="p-3.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {filteredTracks.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-800/30 transition">
                      <td className="p-3.5">
                        <div>
                          <span className="font-bold text-white block truncate max-w-xs">{t.title}</span>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleCopyText(t.id, `id-${t.id}`)}
                              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1 cursor-pointer"
                              title="Click để sao chép ID truyện dùng cho API"
                            >
                              <span>ID: {t.id}</span>
                              {apiCopiedKey === `id-${t.id}` ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} className="text-slate-400" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopyText(`${window.location.origin}${getStoryPath(t)}`, `url-${t.id}`)}
                              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 flex items-center gap-1 cursor-pointer max-w-[180px] truncate"
                              title={`Click để copy link chuẩn: ${window.location.origin}${getStoryPath(t)}`}
                            >
                              <span className="truncate">{getStoryPath(t)}</span>
                              {apiCopiedKey === `url-${t.id}` ? <Check size={10} className="text-emerald-400 shrink-0" /> : <Copy size={10} className="text-slate-400 shrink-0" />}
                            </button>
                            {t.is_featured && <span className="text-[10px] text-amber-400 font-semibold">Gợi ý</span>}
                            {t.is_hot && <span className="text-[10px] text-rose-400 font-semibold">Hot</span>}
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-amber-300">
                          {t.category}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className="block text-slate-200">{t.author}</span>
                        <span className="text-[10px] text-slate-400">{t.narrator || 'Phú Bà Audio'}</span>
                      </td>
                      <td className="p-3.5 font-mono text-amber-400">
                        {(t.play_count || 0).toLocaleString('vi-VN')}
                      </td>
                      <td className="p-3.5">
                        <span className="font-semibold text-slate-200">{t.chapters?.length || 1}</span>
                      </td>
                      <td className="p-3.5">
                        <a
                          href={t.affiliate_link || 'https://shopee.vn'}
                          target="_blank"
                          rel="noreferrer"
                          className="text-amber-400 hover:underline flex items-center gap-1 max-w-[120px] truncate"
                        >
                          <span className="truncate">{t.affiliate_link || 'https://shopee.vn'}</span>
                          <ExternalLink size={12} className="shrink-0" />
                        </a>
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onPreviewTrack(t)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                            title="Nghe thử"
                          >
                            <Play size={14} className="fill-current" />
                          </button>
                          <button
                            onClick={() => handleEditTrack(t)}
                            className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition cursor-pointer"
                            title="Sửa"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteTrack(t.id, t.title)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition cursor-pointer"
                            title="Xóa"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ADD OR EDIT TRACK (WITH DRAG & DROP) */}
      {activeTab === 'add' && (
        <form onSubmit={handleSubmitTrack} className="space-y-6">
          {formMessage && (
            <div className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2 ${
              formMessage.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
            }`}>
              {formMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span>{formMessage.text}</span>
            </div>
          )}

          <div className="max-w-4xl mx-auto space-y-5">
            <div className="p-6 sm:p-7 rounded-2xl bg-slate-900 border border-slate-800 space-y-5 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <Edit3 size={18} className="text-amber-400" />
                  <span>{editingTrackId ? 'Chỉnh Sửa Thông Tin Truyện' : 'Thêm Truyện Audio Mới'}</span>
                </h3>
                <span className="text-xs text-amber-400/90 font-medium">
                  {editingTrackId ? 'Cập nhật trực tiếp trên Server' : 'Lưu trữ trực tiếp trên Server'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-xs text-slate-300 font-medium block mb-1">
                    Tên / Tiêu đề truyện *
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="VD: Gặp Ma Ở Quán Trọ Vùng Cao"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">Tác giả</label>
                  <input
                    type="text"
                    value={formAuthor}
                    onChange={(e) => setFormAuthor(e.target.value)}
                    placeholder="VD: Nguyễn Huy"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">Diễn đọc / MC</label>
                  <input
                    type="text"
                    value={formNarrator}
                    onChange={(e) => setFormNarrator(e.target.value)}
                    placeholder="Phú Bà Audio"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">Thể loại</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                  >
                    <option value="Truyện Ma">Truyện Ma</option>
                    <option value="Tiên Hiệp">Tiên Hiệp</option>
                    <option value="Kiếm Hiệp">Kiếm Hiệp</option>
                    <option value="Ngôn Tình">Ngôn Tình</option>
                    <option value="Trinh Thám">Trinh Thám</option>
                    <option value="Đời Thực">Đời Thực</option>
                    <option value="Truyện Ngắn">Truyện Ngắn</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">
                    Lượt nghe (Play Count)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formPlayCount}
                    onChange={(e) => setFormPlayCount(Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="VD: 1200"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                  />
                </div>

                <div className="flex items-center gap-6 pt-3 sm:col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-200">
                    <input
                      type="checkbox"
                      checked={formIsFeatured}
                      onChange={(e) => setFormIsFeatured(e.target.checked)}
                      className="rounded accent-amber-400"
                    />
                    <span>Gợi ý hôm nay (Slider 1)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-200">
                    <input
                      type="checkbox"
                      checked={formIsHot}
                      onChange={(e) => setFormIsHot(e.target.checked)}
                      className="rounded accent-rose-500"
                    />
                    <span>Đánh dấu Hot 🔥</span>
                  </label>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs text-slate-300 font-medium block mb-1">
                    Giới thiệu tóm tắt nội dung
                  </label>
                  <textarea
                    rows={3}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Mô tả tóm tắt nội dung truyện lôi cuốn..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400 resize-none"
                  />
                </div>
              </div>

              {/* Chapters / Tập truyện Builder (Upload File MP3 Lên Server - Tự Động Chuẩn Hóa Slug) */}
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Danh Sách Tập / Phần ({formChapters.length})
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Khi upload file .mp3, hệ thống tự động ghép <strong className="text-amber-300">Tên truyện + Tên tập</strong> vào thư mục <code className="text-amber-300 font-mono">uploads/audio/</code> (VD: <code className="text-emerald-300 font-mono">ten-truyen-phan-1.mp3</code>). Bạn có thể thoải mái đặt tên tập là <code className="text-amber-300">phan_1</code>, <code className="text-amber-300">phan_2</code> ở mọi truyện mà không lo bị trùng hay ghi đè mất file!
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddChapter}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Plus size={14} /> Thêm Tập Mới
                  </button>
                </div>

                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                  {formChapters.map((ch, idx) => {
                    const isUploadingThis = uploadingChapterIdx === idx;
                    const hasMp3 = Boolean(ch.mp3_url && ch.mp3_url.trim());
                    const storySlug = slugifyChapterTitle(formTitle);
                    const chapterSlug = slugifyChapterTitle(ch.title || `Tập ${idx + 1}`) || `tap-${idx + 1}`;
                    const expectedSlug = storySlug ? (chapterSlug.startsWith(storySlug) ? chapterSlug : `${storySlug}-${chapterSlug}`) : chapterSlug;
                    const expectedDiskFile = `${expectedSlug}.mp3`;
                    const expectedDbUrl = `/uploads/audio/${expectedDiskFile}`;
                    const displayFileName = hasMp3
                      ? decodeURIComponent(ch.mp3_url.split('/').pop() || expectedDiskFile)
                      : '';

                    return (
                      <div key={idx} className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-xs font-bold text-amber-400 w-6 text-center shrink-0">{idx + 1}</span>
                            <input
                              type="text"
                              value={ch.title}
                              onChange={(e) => handleUpdateChapter(idx, 'title', e.target.value)}
                              placeholder="VD: Tập 1: Tiếng Gõ Cửa Đêm Khuya"
                              className="flex-1 min-w-[140px] px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:border-amber-400 focus:outline-none"
                            />
                          </div>

                          <div className="flex items-center gap-2 justify-end shrink-0 flex-wrap">
                            {/* Thời lượng hiển thị và chỉnh sửa trực tiếp */}
                            <div
                              className="flex items-center gap-1.5 shrink-0 bg-slate-900 border border-slate-700 px-2.5 py-1.5 rounded-lg"
                              title="Thời lượng tập truyện: Tự động tính toán khi tải file MP3 lên, hoặc bạn có thể chỉnh sửa thủ công"
                            >
                              <Clock size={12} className="text-amber-400 shrink-0" />
                              <input
                                type="text"
                                value={ch.duration || ''}
                                onChange={(e) => handleUpdateChapter(idx, 'duration', e.target.value)}
                                placeholder="Thời lượng"
                                className="w-16 bg-transparent text-xs text-amber-300 font-mono focus:outline-none focus:text-white"
                              />
                            </div>

                            <input
                              type="file"
                              accept=".mp3,audio/*"
                              id={`chapter-mp3-upload-${idx}`}
                              onChange={(e) => handleUploadChapterMp3(idx, e)}
                              className="hidden"
                            />

                            {isUploadingThis ? (
                              <span className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-1.5">
                                <RefreshCw size={13} className="animate-spin" />
                                <span>Đang tính thời lượng & lưu {expectedDiskFile}...</span>
                              </span>
                            ) : hasMp3 ? (
                              <div className="flex items-center gap-2">
                                <span
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-mono font-medium flex items-center gap-1.5 max-w-[200px] truncate"
                                  title={ch.mp3_url}
                                >
                                  <Check size={13} className="shrink-0 text-emerald-400" />
                                  <span className="truncate">{displayFileName}</span>
                                </span>
                                <label
                                  htmlFor={`chapter-mp3-upload-${idx}`}
                                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition"
                                  title="Đổi file MP3 khác"
                                >
                                  <Upload size={12} />
                                  <span>Đổi file</span>
                                </label>
                              </div>
                            ) : (
                              <label
                                htmlFor={`chapter-mp3-upload-${idx}`}
                                className="px-3.5 py-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
                              >
                                <Upload size={14} />
                                <span>Upload File .MP3 Lên Server</span>
                              </label>
                            )}

                            {formChapters.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveChapter(idx)}
                                className="p-2 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition cursor-pointer shrink-0"
                                title="Xóa phần này"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Live Slug Filename & DB Path & Duration Preview */}
                        <div className="pl-8 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                          <span>
                            Thời lượng: <strong className="text-amber-300 font-mono">{ch.duration || 'Chưa gắn'}</strong>
                          </span>
                          <span>•</span>
                          <span>
                            Tên file đĩa: <code className="text-slate-300 font-mono">{expectedDiskFile}</code>
                          </span>
                          <span>•</span>
                          <span>
                            Đường dẫn db: <code className="text-emerald-300 font-mono">{hasMp3 ? ch.mp3_url : expectedDbUrl}</code>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Form Buttons */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setActiveTab('manage');
                  }}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                >
                  Hủy bỏ
                </button>

                <button
                  type="submit"
                  disabled={formSubmitLoading}
                  className="px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 flex items-center gap-2 transition cursor-pointer"
                >
                  <CheckCircle2 size={16} />
                  <span>{formSubmitLoading ? 'Đang lưu...' : (editingTrackId ? 'Cập Nhật Truyện' : 'Lưu Truyện Mới')}</span>
                </button>
              </div>

            </div>
          </div>
        </form>
      )}

      {/* TAB 3: AFFILIATE LINKS POOL MANAGER (RANDOM POPUP & THEO TÀI KHOẢN/DANH MỤC) */}
      {activeTab === 'affiliate' && (
        <div className="space-y-8">
          {/* Explanation Banner & Stats Overview */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-900 border border-amber-500/30 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                  <Shuffle size={24} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Hệ Thống Phân Phối Link Affiliate Random Vào Popup</span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-amber-400 text-slate-950 font-bold uppercase">Tự động</span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Hệ thống tự động <strong>lấy ngẫu nhiên (random)</strong> một liên kết đang hoạt động từ các tài khoản còn sống để gắn vào Popup khóa màn hình khi người nghe bấm chọn tập truyện.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800/80">
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Tài khoản / Danh mục</span>
                <span className="text-base font-black text-amber-400 mt-0.5 block">
                  {affiliateCategories.length} Tài khoản
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Đang hoạt động</span>
                <span className="text-base font-black text-emerald-400 mt-0.5 block">
                  {affiliateCategories.filter(c => c.isActive).length} / {affiliateCategories.length} Tài khoản
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Tổng số liên kết</span>
                <span className="text-base font-black text-white mt-0.5 block">
                  {affiliateList.length} Links deal
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Tổng lượt click ủng hộ</span>
                <span className="text-base font-black text-amber-400 mt-0.5 block">
                  {affiliateList.reduce((acc, item) => acc + (item.clicks || 0), 0)} Clicks
                </span>
              </div>
            </div>

            {/* Live Interactive Random Link Tester */}
            <div className="p-3.5 sm:p-4 rounded-xl bg-slate-950/90 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Shuffle className="text-amber-400" size={16} />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Kiểm Tra Xoay Vòng Random ({getEligibleAffiliateLinks().length} link hợp lệ trong vòng quay)
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Bấm nút bên cạnh để kiểm tra thuật toán: lấy ngẫu nhiên công bằng từ các tài khoản đang chạy, không lặp lại 2 lần liên tiếp.
                </p>
                {randomTestResult && (
                  <div className="pt-1.5 text-xs flex items-center gap-2 flex-wrap">
                    <span className="text-slate-400">Kết quả vừa chọn:</span>
                    <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                      randomTestResult.platform === 'Shopee' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                      randomTestResult.platform === 'TikTok' ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30' :
                      randomTestResult.platform === 'Lazada' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                      'bg-slate-800 text-slate-300'
                    }`}>
                      {randomTestResult.platform}
                    </span>
                    <strong className="text-amber-300 font-medium">"{randomTestResult.title}"</strong>
                    <span className="text-slate-500 font-mono text-[11px] truncate max-w-[200px]">({randomTestResult.url})</span>
                    <span className="text-emerald-400 font-mono text-[11px]">✓ Hợp lệ</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleTestRandomAffiliate}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-sm"
              >
                <Shuffle size={14} /> 🎲 Bấm Quay Thử Ngay
              </button>
            </div>
          </div>

          {affiliateMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>{affiliateMessage}</span>
            </div>
          )}

          {/* PHẦN 1: QUẢN LÝ DANH MỤC / TÀI KHOẢN AFFILIATE */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Folder className="text-amber-400" size={18} />
                  <span>Danh Mục Tài Khoản Affiliate ({affiliateCategories.length})</span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Phân chia riêng biệt theo từng tài khoản tiếp thị (Shopee, TikTok, Lazada...). Nếu tài khoản bị khóa/chết, bạn có thể xóa danh mục đó đi để xóa sạch toàn bộ link liên quan.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAddCatForm(!showAddCatForm)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto shadow-md shadow-amber-500/20"
              >
                <FolderPlus size={15} />
                <span>{showAddCatForm ? 'Đóng form thêm' : '+ Thêm Danh Mục / Tài Khoản'}</span>
              </button>
            </div>

            {/* Form Thêm Danh Mục / Tài Khoản Mới */}
            {showAddCatForm && (
              <form onSubmit={handleCreateCategory} className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-amber-500/40 space-y-4 animate-fade-in">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider">
                  <FolderPlus size={16} />
                  <span>Tạo Danh Mục / Tài Khoản Affiliate Mới</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-5">
                    <label className="text-[11px] text-slate-300 block mb-1">
                      Tên Tài Khoản / Danh Mục *
                    </label>
                    <input
                      type="text"
                      required
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      placeholder="VD: Tài khoản Shopee 2 (Shop Sách & Tai Nghe)"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="text-[11px] text-slate-300 block mb-1">
                      Nền Tảng
                    </label>
                    <select
                      value={newCatPlatform}
                      onChange={(e) => setNewCatPlatform(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                    >
                      <option value="Shopee">Shopee</option>
                      <option value="TikTok">TikTok</option>
                      <option value="Lazada">Lazada</option>
                      <option value="Khác">Khác</option>
                    </select>
                  </div>

                  <div className="sm:col-span-4">
                    <label className="text-[11px] text-slate-300 block mb-1">
                      Mô Tả / Ghi Chú Tài Khoản
                    </label>
                    <input
                      type="text"
                      value={newCatDescription}
                      onChange={(e) => setNewCatDescription(e.target.value)}
                      placeholder="VD: Tài khoản dự phòng, gắn deal công nghệ"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddCatForm(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 transition cursor-pointer shadow-md shadow-amber-500/20"
                  >
                    Lưu Tài Khoản
                  </button>
                </div>
              </form>
            )}

            {/* Grid các danh mục / tài khoản hiện có */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {affiliateCategories.map((cat) => {
                const linksInCat = affiliateList.filter(l => l.categoryId === cat.id);
                const clicksInCat = linksInCat.reduce((sum, l) => sum + (l.clicks || 0), 0);

                return (
                  <div
                    key={cat.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                      cat.isActive
                        ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                        : 'bg-slate-950/60 border-slate-800/50 opacity-75'
                    }`}
                  >
                    <div>
                      {/* Top tags */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          cat.platform === 'Shopee' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                          cat.platform === 'TikTok' ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30' :
                          cat.platform === 'Lazada' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                          'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}>
                          {cat.platform}
                        </span>

                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          cat.isActive
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        }`}>
                          {cat.isActive ? '● Đang Chạy' : '○ Đang Tạm Dừng'}
                        </span>
                      </div>

                      {/* Category Name */}
                      <h5 className="text-sm font-bold text-white flex items-center gap-1.5 line-clamp-1" title={cat.name}>
                        <Folder size={15} className={cat.isActive ? 'text-amber-400 shrink-0' : 'text-slate-500 shrink-0'} />
                        <span>{cat.name}</span>
                      </h5>

                      {/* Description */}
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                        {cat.description || 'Chưa có ghi chú mô tả cho tài khoản này.'}
                      </p>

                      {/* Stats */}
                      <div className="mt-3 py-1.5 px-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">
                          {linksInCat.length} links đang gắn
                        </span>
                        <span className="font-bold text-amber-400 font-mono">
                          {clicksInCat} clicks
                        </span>
                      </div>
                    </div>

                    {/* Actions Row */}
                    <div className="mt-3.5 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleCategory(cat.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer ${
                          cat.isActive
                            ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                            : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                        }`}
                        title="Bật hoặc tạm tắt toàn bộ link thuộc tài khoản này"
                      >
                        <Power size={12} />
                        <span>{cat.isActive ? 'Tạm Dừng' : 'Kích Hoạt'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 flex items-center gap-1 transition cursor-pointer"
                        title="Xóa danh mục này và toàn bộ link liên kết nếu tài khoản đã chết"
                      >
                        <Trash2 size={12} />
                        <span>Xóa Danh Mục (TK Chết)</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* PHẦN 2: QUẢN LÝ TỪNG LINK AFFILIATE TRONG DANH SÁCH XOAY VÒNG */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="text-amber-400" size={18} />
                  <span>Danh Sách Link Affiliate Xoay Vòng Vào Popup</span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Mỗi link được gán vào một danh mục tài khoản cụ thể. Khi 1 link bị lỗi, dán URL vào thanh tìm kiếm dưới đây để tìm và xóa ngay lập tức.
                </p>
              </div>
            </div>

            {/* Thanh Tìm Kiếm Link Lỗi & Bộ Lọc Danh Mục Tài Khoản */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* Ô Search Link Lỗi */}
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-400" />
                  <input
                    type="text"
                    value={affiliateSearch}
                    onChange={(e) => setAffiliateSearch(e.target.value)}
                    placeholder="Dán link lỗi (URL shopee.vn/..., tiktok...) hoặc tên deal để tìm và xóa ngay..."
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-400 font-mono transition"
                  />
                  {affiliateSearch && (
                    <button
                      type="button"
                      onClick={() => setAffiliateSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs p-1"
                      title="Xóa bộ lọc tìm kiếm"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Bộ lọc theo Danh mục / Tài khoản */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Filter size={13} /> Tài khoản:
                  </span>
                  <select
                    value={selectedCategoryFilter}
                    onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-xs text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-amber-400 cursor-pointer"
                  >
                    <option value="all">Tất cả tài khoản ({affiliateList.length})</option>
                    {affiliateCategories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} ({affiliateList.filter(l => l.categoryId === cat.id).length})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Thông báo kết quả tìm kiếm */}
              {affiliateSearch && (
                <div className="flex items-center justify-between text-xs text-amber-300 bg-amber-500/10 px-3 py-2 rounded-xl border border-amber-500/20">
                  <span className="flex items-center gap-1.5">
                    <Search size={13} />
                    <span>
                      Đang tìm link chứa: <strong className="font-mono text-white underline">{affiliateSearch}</strong> 
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setAffiliateSearch('')}
                    className="text-[11px] text-amber-400 hover:text-amber-200 underline cursor-pointer"
                  >
                    Hiển thị tất cả ({affiliateList.length} link)
                  </button>
                </div>
              )}
            </div>

            {/* Form Thêm Số Lượng Lớn (Chế độ duy nhất: dán 10, 20, 50 link cùng lúc) */}
            <div className="p-5 sm:p-6 rounded-3xl bg-slate-900 border-2 border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-400 to-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-md shadow-amber-400/20 shrink-0">
                    <Zap size={18} className="text-slate-950 fill-current" />
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>Thêm Liên Kết Affiliate Số Lượng Lớn</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        Dán nhiều link cùng lúc
                      </span>
                    </h5>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Dán danh sách 10, 20 hoặc 50 link (mỗi dòng 1 link). Hệ thống sẽ tự động tách thành từng link riêng biệt và xoay vòng ngẫu nhiên vào popup mở khóa khi nghe truyện.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {bulkInputText && (
                    <button
                      type="button"
                      onClick={() => setBulkInputText('')}
                      className="px-3 py-1.5 rounded-xl text-[11px] font-semibold bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-700 transition cursor-pointer"
                    >
                      ✕ Xóa Trắng
                    </button>
                  )}
                </div>
              </div>

              <form onSubmit={handleBulkAddAffiliates} className="space-y-3.5">
                {/* Chọn tài khoản / danh mục để gán các link này */}
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/80">
                  <label className="text-[11px] font-bold text-slate-300 block mb-1.5">
                    1. Chọn Tài Khoản / Danh Mục Để Gán Toàn Bộ Link Này Vào *
                  </label>
                  <select
                    value={newAffCategoryId}
                    onChange={(e) => setNewAffCategoryId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-amber-400 cursor-pointer font-medium"
                  >
                    {affiliateCategories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} ({cat.platform} - {affiliateList.filter(l => l.categoryId === cat.id).length} link hiện có)
                      </option>
                    ))}
                    {affiliateCategories.length === 0 && (
                      <option value="">Chưa có tài khoản</option>
                    )}
                  </select>
                </div>

                {/* Header Textarea */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                  <label className="text-xs text-slate-300 font-bold block">
                    3. Dán danh sách các đường link vào đây (Mỗi dòng một link URL):
                  </label>
                  <span className={`text-xs font-mono font-bold px-3 py-1 rounded-full ${
                    bulkInputText.split(/\r?\n/).filter(l => /(https?:\/\/[^\s]+)/i.test(l)).length > 0
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    ⚡ Đã nhận diện: {bulkInputText.split(/\r?\n/).filter(l => /(https?:\/\/[^\s]+)/i.test(l)).length} link hợp lệ
                  </span>
                </div>

                <textarea
                  rows={6}
                  value={bulkInputText}
                  onChange={(e) => setBulkInputText(e.target.value)}
                  placeholder={`Dán 10, 20 hoặc 50 link tại đây, mỗi dòng một link. Ví dụ:
https://shopee.vn/deal-tai-nghe-chong-on-1
https://shopee.vn/deal-sach-noi-giam-gia-2
https://www.tiktok.com/@affiliate_store/video/7391823
https://s.lazada.vn/s.flashsale_deal`}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-950 border-2 border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400 font-mono leading-relaxed resize-y placeholder-slate-600 shadow-inner"
                />

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                  <p className="text-[11px] text-slate-400">
                    💡 Bạn có thể dán link trực tiếp từ Shopee, TikTok Shop, Lazada hoặc bất kỳ trang nào. Hệ thống tự động nhận diện nền tảng.
                  </p>

                  <button
                    type="submit"
                    disabled={bulkInputText.split(/\r?\n/).filter(l => /(https?:\/\/[^\s]+)/i.test(l)).length === 0}
                    className={`px-6 py-3 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-lg w-full sm:w-auto ${
                      bulkInputText.split(/\r?\n/).filter(l => /(https?:\/\/[^\s]+)/i.test(l)).length > 0
                        ? 'bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 shadow-amber-500/20'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed shadow-none'
                    }`}
                  >
                    <Zap size={16} className="text-rose-600 fill-current" />
                    <span>
                      {bulkInputText.split(/\r?\n/).filter(l => /(https?:\/\/[^\s]+)/i.test(l)).length > 0 
                        ? `THÊM ${bulkInputText.split(/\r?\n/).filter(l => /(https?:\/\/[^\s]+)/i.test(l)).length} LINK NÀY VÀO HỆ THỐNG` 
                        : 'Dán Link Để Thêm Vào Hệ Thống'}
                    </span>
                  </button>
                </div>
              </form>
            </div>

            {/* Thanh thao tác hàng loạt khi có link được chọn */}
            {selectedLinkIds.length > 0 && (
              <div className="p-3 bg-amber-500/15 border border-amber-500/40 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs animate-fade-in shadow-lg">
                <span className="font-bold text-amber-300 flex items-center gap-1.5">
                  <CheckSquare size={16} />
                  Đang chọn {selectedLinkIds.length} liên kết
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleBatchToggleActive(true)}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 font-semibold cursor-pointer transition"
                  >
                    Bật tất cả
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBatchToggleActive(false)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 font-semibold cursor-pointer transition"
                  >
                    Tắt tất cả
                  </button>
                  <button
                    type="button"
                    onClick={handleBatchDeleteAffiliates}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-rose-600/30 transition"
                  >
                    <Trash2 size={13} /> Xóa {selectedLinkIds.length} link đã chọn
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedLinkIds([])}
                    className="text-slate-400 hover:text-white px-2 py-1 text-xs underline cursor-pointer"
                  >
                    Bỏ chọn
                  </button>
                </div>
              </div>
            )}

            {/* Table of Affiliate links */}
            <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-900/60">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                    <tr>
                      <th className="p-3.5 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={
                            affiliateList.filter(item => {
                              const matchesCat = selectedCategoryFilter === 'all' || item.categoryId === selectedCategoryFilter;
                              if (!matchesCat) return false;
                              if (!affiliateSearch.trim()) return true;
                              const q = affiliateSearch.trim().toLowerCase();
                              return (
                                item.title.toLowerCase().includes(q) ||
                                item.url.toLowerCase().includes(q) ||
                                (item.categoryName && item.categoryName.toLowerCase().includes(q)) ||
                                (item.platform && item.platform.toLowerCase().includes(q))
                              );
                            }).length > 0 &&
                            selectedLinkIds.length === affiliateList.filter(item => {
                              const matchesCat = selectedCategoryFilter === 'all' || item.categoryId === selectedCategoryFilter;
                              if (!matchesCat) return false;
                              if (!affiliateSearch.trim()) return true;
                              const q = affiliateSearch.trim().toLowerCase();
                              return (
                                item.title.toLowerCase().includes(q) ||
                                item.url.toLowerCase().includes(q) ||
                                (item.categoryName && item.categoryName.toLowerCase().includes(q)) ||
                                (item.platform && item.platform.toLowerCase().includes(q))
                              );
                            }).length
                          }
                          onChange={(e) => {
                            const currentFiltered = affiliateList.filter(item => {
                              const matchesCat = selectedCategoryFilter === 'all' || item.categoryId === selectedCategoryFilter;
                              if (!matchesCat) return false;
                              if (!affiliateSearch.trim()) return true;
                              const q = affiliateSearch.trim().toLowerCase();
                              return (
                                item.title.toLowerCase().includes(q) ||
                                item.url.toLowerCase().includes(q) ||
                                (item.categoryName && item.categoryName.toLowerCase().includes(q)) ||
                                (item.platform && item.platform.toLowerCase().includes(q))
                              );
                            });
                            if (e.target.checked) {
                              setSelectedLinkIds(currentFiltered.map(l => l.id));
                            } else {
                              setSelectedLinkIds([]);
                            }
                          }}
                          className="rounded accent-amber-400 cursor-pointer"
                          title="Chọn tất cả các link đang hiển thị"
                        />
                      </th>
                      <th className="p-3.5">Nền tảng</th>
                      <th className="p-3.5">Thuộc Tài khoản</th>
                      <th className="p-3.5">URL liên kết (Dán để tìm)</th>
                      <th className="p-3.5 text-center">Lượt click</th>
                      <th className="p-3.5 text-center">Trạng thái</th>
                      <th className="p-3.5 text-right">Xóa Link Lẻ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {affiliateList
                      .filter(item => {
                        const matchesCat = selectedCategoryFilter === 'all' || item.categoryId === selectedCategoryFilter;
                        if (!matchesCat) return false;
                        if (!affiliateSearch.trim()) return true;
                        const q = affiliateSearch.trim().toLowerCase();
                        return (
                          item.title.toLowerCase().includes(q) ||
                          item.url.toLowerCase().includes(q) ||
                          (item.categoryName && item.categoryName.toLowerCase().includes(q)) ||
                          (item.platform && item.platform.toLowerCase().includes(q))
                        );
                      })
                      .map((item) => {
                        const parentCat = affiliateCategories.find(c => c.id === item.categoryId);
                        const isCatInactive = parentCat && !parentCat.isActive;
                        const isSelected = selectedLinkIds.includes(item.id);

                        return (
                          <tr key={item.id} className={`hover:bg-slate-800/40 transition ${isSelected ? 'bg-amber-500/5' : ''}`}>
                            <td className="p-3.5 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedLinkIds(prev => [...prev, item.id]);
                                  } else {
                                    setSelectedLinkIds(prev => prev.filter(id => id !== item.id));
                                  }
                                }}
                                className="rounded accent-amber-400 cursor-pointer"
                              />
                            </td>

                            <td className="p-3.5">
                              <span className={`px-2 py-1 rounded font-bold text-[10px] ${
                                item.platform === 'Shopee' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                                item.platform === 'TikTok' ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30' :
                                item.platform === 'Lazada' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                'bg-slate-800 text-slate-300 border border-slate-700'
                              }`}>
                                {item.platform}
                              </span>
                            </td>

                            <td className="p-3.5 font-medium text-slate-200">
                              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800/70 border border-slate-700/60 text-[11px]">
                                <Folder size={12} className={parentCat?.isActive ? 'text-amber-400' : 'text-slate-500'} />
                                <span className="truncate max-w-[140px]" title={parentCat?.name || item.categoryName || 'Chưa gán'}>
                                  {parentCat?.name || item.categoryName || 'Chưa gán'}
                                </span>
                              </span>
                              {isCatInactive && (
                                <span className="block text-[9px] text-rose-400 mt-0.5">
                                  (Tài khoản đang tạm dừng)
                                </span>
                              )}
                            </td>

                            <td className="p-3.5 font-mono text-slate-300 max-w-sm truncate">
                              <div className="flex items-center gap-1.5">
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="hover:text-amber-400 hover:underline truncate max-w-[240px] text-slate-300"
                                  title={item.url}
                                >
                                  {item.url}
                                </a>
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1 text-slate-400 hover:text-amber-400 transition"
                                  title="Mở link kiểm tra"
                                >
                                  <ExternalLink size={13} />
                                </a>
                              </div>
                            </td>

                            <td className="p-3.5 text-center font-mono font-bold text-amber-400">
                              {item.clicks || 0}
                            </td>

                            <td className="p-3.5 text-center">
                              <button
                                onClick={() => handleToggleAffiliateActive(item.id)}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition ${
                                  item.isActive && !isCatInactive
                                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-slate-800 text-slate-500 border border-slate-700'
                                }`}
                                title={item.isActive ? 'Bấm để tắt link này' : 'Bấm để bật link này'}
                              >
                                {item.isActive && !isCatInactive ? '● Đang Bật' : (isCatInactive ? '○ TK Dừng' : '○ Tạm Tắt')}
                              </button>
                            </td>

                            <td className="p-3.5 text-right">
                              <button
                                onClick={() => handleDeleteAffiliate(item.id, item.title, item.url)}
                                className="px-2.5 py-1.5 text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 rounded-lg inline-flex items-center gap-1.5 transition cursor-pointer"
                                title="Xóa link lẻ này khỏi hệ thống"
                              >
                                <Trash2 size={13} />
                                <span>Xóa Link</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              {affiliateList
                .filter(item => {
                  const matchesCat = selectedCategoryFilter === 'all' || item.categoryId === selectedCategoryFilter;
                  if (!matchesCat) return false;
                  if (!affiliateSearch.trim()) return true;
                  const q = affiliateSearch.trim().toLowerCase();
                  return (
                    item.title.toLowerCase().includes(q) ||
                    item.url.toLowerCase().includes(q) ||
                    (item.categoryName && item.categoryName.toLowerCase().includes(q)) ||
                    (item.platform && item.platform.toLowerCase().includes(q))
                  );
                }).length === 0 && (
                <div className="p-10 text-center text-slate-400 text-xs space-y-2">
                  <Search size={28} className="mx-auto text-slate-600 mb-1" />
                  <p className="font-semibold text-slate-300">
                    {affiliateSearch 
                      ? `Không tìm thấy liên kết nào khớp với "${affiliateSearch}"` 
                      : 'Không có liên kết nào trong danh mục đã chọn'}
                  </p>
                  {affiliateSearch && (
                    <button
                      onClick={() => setAffiliateSearch('')}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-medium transition cursor-pointer"
                    >
                      Xóa tìm kiếm và hiển thị tất cả
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CÀI ĐẶT GIAO DIỆN, BANNER, LOGO & FAVICON (LƯU TRỰC TIẾP TRÊN SERVER) */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          {settingsSaveMsg && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                <span>{settingsSaveMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setSettingsSaveMsg(null)}
                className="text-emerald-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-900 border border-amber-500/30">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Palette size={20} className="text-amber-400" />
                <span>Cài Đặt Website, Banner, Logo & Favicon (Đồng Bộ Server)</span>
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                Tất cả chỉnh sửa, upload ảnh và xóa dữ liệu đều lưu trực tiếp lên Server — áp dụng ngay lập tức cho mọi người truy cập website.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="submit"
                disabled={isSavingSettings}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-amber-500/20"
              >
                <BookmarkCheck size={15} />
                <span>{isSavingSettings ? 'Đang Lưu Lên Server...' : 'Lưu Cài Đặt Lên Server'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* 1. CẤU HÌNH BANNER TRANG CHỦ */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                  <Sliders size={16} />
                  <span>1. Tùy Chỉnh Nội Dung Banner Trang Chủ</span>
                </h4>

                <label className="inline-flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={settingsForm.showHeroBanner !== false}
                    onChange={(e) => setSettingsForm({ ...settingsForm, showHeroBanner: e.target.checked })}
                    className="rounded accent-amber-400 cursor-pointer"
                  />
                  <span className="text-slate-300 font-semibold">Hiển thị khung Banner</span>
                </label>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 font-semibold">
                      Huy Hiệu Phụ Trên Banner (Badge Text)
                    </label>
                    {settingsForm.heroBadge && (
                      <button
                        type="button"
                        onClick={() => setSettingsForm({ ...settingsForm, heroBadge: '' })}
                        className="text-[10px] text-rose-400 hover:text-rose-300 cursor-pointer"
                      >
                        Xóa trống
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={settingsForm.heroBadge ?? ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, heroBadge: e.target.value })}
                    placeholder="VD: Kho Truyện Audio Chất Lượng Cao"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 font-semibold">
                      Tiêu Đề Lớn Banner (Hero Title)
                    </label>
                    {settingsForm.heroTitle && (
                      <button
                        type="button"
                        onClick={() => setSettingsForm({ ...settingsForm, heroTitle: '' })}
                        className="text-[10px] text-rose-400 hover:text-rose-300 cursor-pointer"
                      >
                        Xóa trống
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={settingsForm.heroTitle ?? ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, heroTitle: e.target.value })}
                    placeholder="VD: Thưởng Thức Truyện Audio Mọi Lúc Mọi Nơi"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 font-semibold">
                      Đoạn Văn Mô Tả Banner (Hero Description)
                    </label>
                    {settingsForm.heroDescription && (
                      <button
                        type="button"
                        onClick={() => setSettingsForm({ ...settingsForm, heroDescription: '' })}
                        className="text-[10px] text-rose-400 hover:text-rose-300 cursor-pointer"
                      >
                        Xóa trống
                      </button>
                    )}
                  </div>
                  <textarea
                    rows={3}
                    value={settingsForm.heroDescription ?? ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, heroDescription: e.target.value })}
                    placeholder="Nhập mô tả tóm tắt hiển thị trên Banner trang chủ..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-amber-400 leading-relaxed resize-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 font-semibold">
                      Chữ Trên Nút Khám Phá (Button CTA Text - Để trống nếu muốn ẩn nút)
                    </label>
                    {settingsForm.heroButtonText && (
                      <button
                        type="button"
                        onClick={() => setSettingsForm({ ...settingsForm, heroButtonText: '' })}
                        className="text-[10px] text-rose-400 hover:text-rose-300 cursor-pointer"
                      >
                        Ẩn nút
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={settingsForm.heroButtonText ?? ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, heroButtonText: e.target.value })}
                    placeholder="VD: Khám phá toàn bộ (Để trống sẽ ẩn nút)"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                {/* Upload Ảnh Nền Banner Lên Server */}
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">
                    Ảnh Nền Banner Tùy Chỉnh (Lưu trên Server - Tùy chọn)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={settingsForm.heroBannerImage || ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, heroBannerImage: e.target.value })}
                      placeholder="https://... hoặc bấm Upload ảnh lên Server"
                      className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                    />
                    <label className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold cursor-pointer shrink-0 transition flex items-center gap-1.5">
                      <Upload size={14} />
                      <span>{bannerImageUploading ? 'Đang tải...' : 'Upload'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleBannerImageUpload}
                        className="hidden"
                      />
                    </label>
                    {settingsForm.heroBannerImage && (
                      <button
                        type="button"
                        onClick={handleRemoveBannerImage}
                        className="px-2.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-semibold cursor-pointer transition shrink-0"
                        title="Xóa ảnh nền Banner trên Server"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* LIVE PREVIEW BANNER */}
              <div className="pt-2">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-2">
                  Xem Trước Banner Thực Tế Ngoài Trang Chủ (Live Preview):
                </span>
                <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-amber-950/40 via-slate-950 to-[#0e131d] border border-amber-500/25 p-4 space-y-2">
                  {settingsForm.heroBannerImage && (
                    <div className="absolute inset-0 z-0">
                      <img
                        src={settingsForm.heroBannerImage}
                        alt="Banner Preview"
                        className="w-full h-full object-cover opacity-30"
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-[#0b0f17]/90 via-[#0b0f17]/75 to-[#0b0f17]/50" />
                    </div>
                  )}
                  <div className="relative z-10 space-y-2">
                    {settingsForm.heroBadge && (
                      <span className="inline-block px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-semibold">
                        ✨ {settingsForm.heroBadge}
                      </span>
                    )}
                    <h5 className="text-sm font-black text-white leading-tight">
                      {settingsForm.heroTitle || 'Nghe gì hôm nay?'}
                    </h5>
                    <p className="text-[11px] text-slate-300 leading-relaxed line-clamp-3">
                      {settingsForm.heroDescription || `${tracks.length} audio • nghe miễn phí, không cần tài khoản`}
                    </p>
                    {settingsForm.heroButtonText && (
                      <div className="pt-1">
                        <span className="inline-block px-3 py-1 rounded-lg text-[10px] font-bold bg-amber-400 text-slate-950">
                          {settingsForm.heroButtonText} →
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. CẤU HÌNH LOGO & FAVICON */}
            <div className="space-y-6">
              
              {/* LOGO */}
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Globe size={16} />
                  <span>2. Logo & Tên Thương Hiệu Website</span>
                </h4>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">
                      Tên Website / Thương Hiệu (Brand Name)
                    </label>
                    <input
                      type="text"
                      value={settingsForm.siteName ?? ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, siteName: e.target.value })}
                      placeholder="VD: Gối Ôm Audio"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold tracking-wider focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">
                      Khẩu Hiệu / Slogan Phụ Dưới Logo (Tagline)
                    </label>
                    <input
                      type="text"
                      value={settingsForm.siteTagline ?? ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, siteTagline: e.target.value })}
                      placeholder="VD: Web Nghe Truyện Audio Online Miễn Phí"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">
                      Ảnh Logo Tùy Chỉnh (Lưu trên Server - Tùy chọn)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={settingsForm.logoUrl || ''}
                        onChange={(e) => setSettingsForm({ ...settingsForm, logoUrl: e.target.value })}
                        placeholder="https://... hoặc bấm Upload"
                        className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                      />
                      <label className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold cursor-pointer shrink-0 transition flex items-center gap-1.5">
                        <Upload size={14} />
                        <span>{logoUploading ? 'Đang tải...' : 'Upload'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                      </label>
                      {settingsForm.logoUrl && (
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="px-2.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-semibold cursor-pointer transition shrink-0"
                          title="Xóa Logo trên Server"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      * Nếu để trống, website sẽ dùng biểu tượng sóng âm mặc định.
                    </span>
                  </div>

                  {/* Preview Logo */}
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-3">
                    {settingsForm.logoUrl ? (
                      <img src={settingsForm.logoUrl} alt="Logo Preview" className="w-10 h-10 rounded-lg object-cover border border-amber-500/40" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-amber-500 to-amber-300 p-0.5">
                        <div className="w-full h-full bg-[#0d121c] rounded-[7px] flex items-center justify-center text-amber-400 font-bold">
                          🎧
                        </div>
                      </div>
                    )}
                    <div>
                      <span className="font-black text-white text-sm block tracking-wider">
                        {settingsForm.siteName || 'Gối Ôm Audio'}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        {settingsForm.siteTagline || 'Web Nghe Truyện Audio Online Miễn Phí'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* FAVICON */}
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3">
                  <BookmarkCheck size={16} />
                  <span>3. Favicon (Biểu Tượng Tab Trình Duyệt)</span>
                </h4>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">
                      Đường Dẫn Favicon (.ico, .svg, .png - Lưu trên Server)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={settingsForm.faviconUrl || ''}
                        onChange={(e) => setSettingsForm({ ...settingsForm, faviconUrl: e.target.value })}
                        placeholder="https://...favicon.svg"
                        className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                      />
                      <label className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold cursor-pointer shrink-0 transition flex items-center gap-1.5">
                        <Upload size={14} />
                        <span>{faviconUploading ? 'Đang tải...' : 'Upload'}</span>
                        <input
                          type="file"
                          accept="image/*,.ico"
                          onChange={handleFaviconUpload}
                          className="hidden"
                        />
                      </label>
                      {settingsForm.faviconUrl && (
                        <button
                          type="button"
                          onClick={handleRemoveFavicon}
                          className="px-2.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-semibold cursor-pointer transition shrink-0"
                          title="Xóa Favicon trên Server"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Preview Tab Trình Duyệt */}
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-500 block mb-1.5">Mô phỏng Tab trình duyệt:</span>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-t-lg bg-slate-800 border-t border-x border-slate-700 text-xs text-slate-200">
                      {settingsForm.faviconUrl ? (
                        <img src={settingsForm.faviconUrl} alt="Favicon" className="w-4 h-4 object-contain rounded" />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded bg-amber-400"></span>
                      )}
                      <span className="text-[11px] font-semibold truncate max-w-[150px]">
                        {settingsForm.siteName || 'Gối Ôm Audio'} - Nghe Truyện
                      </span>
                      <span className="text-slate-500 text-[10px] ml-1">✕</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

              {/* 4. XEM TRƯỚC KẾT QUẢ HIỂN THỊ TRÊN GOOGLE TÌM KIẾM (GOOGLE SERP LIVE PREVIEW) */}
              <div className="col-span-1 lg:col-span-2 p-6 rounded-2xl bg-slate-900 border border-amber-500/30 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                      <Search size={16} />
                      <span>4. Xem Trước Hiển Thị Trên Google Tìm Kiếm (Google Search Live Preview)</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Mô phỏng chính xác cách Google hiển thị Trang Chủ và Trang Nghe Truyện của bạn dựa trên các cài đặt bên trên (đồng bộ cả Server-Side HTML, Sitemap XML & Schema.org).
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href="/sitemap.xml"
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-[11px] font-semibold flex items-center gap-1 transition"
                    >
                      <ExternalLink size={12} />
                      <span>Xem /sitemap.xml</span>
                    </a>
                    <a
                      href="/robots.txt"
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-semibold flex items-center gap-1 transition"
                    >
                      <ExternalLink size={12} />
                      <span>Xem /robots.txt</span>
                    </a>
                  </div>
                </div>

                {(() => {
                  const previewBrand = (settingsForm.siteName || 'Gối Ôm Audio').trim() || 'Gối Ôm Audio';
                  const previewTagline = (settingsForm.siteTagline || 'Web Nghe Truyện Audio Online Miễn Phí').trim();
                  const previewHeroTitle = (settingsForm.heroTitle || '').trim();
                  const previewHeroDesc = (settingsForm.heroDescription || '').trim();
                  const previewOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://ten-mien-cua-ban.com';
                  const previewHomeTitle = previewTagline
                    ? `${previewBrand} - ${previewTagline}`
                    : `${previewBrand} - Web Nghe Truyện Audio Online Miễn Phí`;

                  const descParts: string[] = [];
                  if (previewHeroTitle) descParts.push(previewHeroTitle);
                  if (previewHeroDesc) descParts.push(previewHeroDesc);
                  if (previewTagline && !previewHeroDesc.toLowerCase().includes(previewTagline.toLowerCase())) {
                    descParts.push(`${previewTagline} tại ${previewBrand}.`);
                  }
                  const previewHomeDesc =
                    descParts.length > 0
                      ? descParts.join(' — ')
                      : `${previewBrand} - ${previewTagline}. Kho truyện audio chất lượng cao nghe miễn phí.`;

                  const sampleStory = tracks[0] || {
                    id: 'track-1',
                    title: 'Gặp Ma Ở Quán Trọ Vùng Cao',
                    category: 'Truyện Ma',
                    description:
                      'Chuyến xe đêm muộn đưa hai người khách lữ hành dừng chân tại một quán trọ heo hút lưng chừng đèo mây mù bao phủ...',
                  };
                  const sampleSlug =
                    sampleStory.title
                      .toLowerCase()
                      .normalize('NFD')
                      .replace(/[\u0300-\u036f]/g, '')
                      .replace(/[đĐ]/g, 'd')
                      .replace(/[^a-z0-9\s-]/g, '')
                      .trim()
                      .replace(/\s+/g, '-') || 'gap-ma-o-quan-tro-vung-cao';
                  const sampleStoryTitle = `${sampleStory.title} (Audio Full) - ${previewBrand}`;
                  const sampleStoryDesc = sampleStory.description
                    ? `${sampleStory.title} - ${sampleStory.description.slice(0, 140)}... Thể loại: ${sampleStory.category || 'Audio'}. Nghe trọn bộ miễn phí trên ${previewBrand}.`
                    : `Nghe truyện audio trọn bộ ${sampleStory.title} miễn phí chất lượng cao trên ${previewBrand}.`;

                  return (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      {/* Card 1: Kết quả Trang Chủ trên Google */}
                      <div className="p-4 rounded-2xl bg-[#1f2329] border border-slate-700/80 space-y-2.5 shadow-inner">
                        <div className="flex items-center justify-between text-[10px] text-amber-400 font-bold uppercase tracking-wider border-b border-slate-700/60 pb-2">
                          <span>① Khi tìm Tên Web / Trang Chủ trên Google</span>
                          <span className="text-emerald-400 font-mono">Schema: WebSite + SearchBox</span>
                        </div>

                        {/* Google Header Row (Favicon + Site Name + URL) */}
                        <div className="flex items-center gap-2.5 pt-1">
                          <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center overflow-hidden shrink-0">
                            {settingsForm.faviconUrl || settingsForm.logoUrl ? (
                              <img
                                src={settingsForm.faviconUrl || settingsForm.logoUrl}
                                alt="Favicon"
                                className="w-4 h-4 object-contain"
                              />
                            ) : (
                              <span className="text-xs">🎧</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs text-[#dadce0] font-medium truncate">{previewBrand}</div>
                            <div className="text-[11px] text-[#bdc1c6] truncate font-mono">{previewOrigin}</div>
                          </div>
                        </div>

                        {/* Google Blue Link Title */}
                        <div className="text-base sm:text-lg text-[#8ab4f8] hover:underline font-normal leading-snug line-clamp-1 cursor-pointer">
                          {previewHomeTitle}
                        </div>

                        {/* Google Snippet Description */}
                        <p className="text-xs text-[#bdc1c6] leading-relaxed line-clamp-3">
                          {previewHomeDesc}
                        </p>

                        {/* Sitelinks Searchbox Preview */}
                        <div className="pt-1.5">
                          <div className="px-3 py-1.5 rounded-lg bg-[#282c34] border border-slate-600/80 text-[11px] text-slate-400 flex items-center justify-between">
                            <span>Tìm truyện trên {previewBrand}...</span>
                            <Search size={12} className="text-slate-400" />
                          </div>
                        </div>
                      </div>

                      {/* Card 2: Kết quả Trang Truyện Lẻ trên Google */}
                      <div className="p-4 rounded-2xl bg-[#1f2329] border border-slate-700/80 space-y-2.5 shadow-inner">
                        <div className="flex items-center justify-between text-[10px] text-amber-400 font-bold uppercase tracking-wider border-b border-slate-700/60 pb-2">
                          <span>② Khi tìm Tên Truyện Cụ Thể trên Google</span>
                          <span className="text-emerald-400 font-mono">Schema: AudioObject</span>
                        </div>

                        {/* Google Header Row */}
                        <div className="flex items-center gap-2.5 pt-1">
                          <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center overflow-hidden shrink-0">
                            {settingsForm.faviconUrl || settingsForm.logoUrl ? (
                              <img
                                src={settingsForm.faviconUrl || settingsForm.logoUrl}
                                alt="Favicon"
                                className="w-4 h-4 object-contain"
                              />
                            ) : (
                              <span className="text-xs">🎧</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs text-[#dadce0] font-medium truncate">{previewBrand}</div>
                            <div className="text-[11px] text-[#bdc1c6] truncate font-mono">
                              {previewOrigin} › {sampleSlug}
                            </div>
                          </div>
                        </div>

                        {/* Google Blue Link Title */}
                        <div className="text-base sm:text-lg text-[#8ab4f8] hover:underline font-normal leading-snug line-clamp-1 cursor-pointer">
                          {sampleStoryTitle}
                        </div>

                        {/* Rich Result Badge */}
                        <div className="flex items-center gap-2 text-[11px] text-[#bdc1c6]">
                          <span className="px-2 py-0.5 rounded bg-slate-700/80 text-amber-300 font-medium">
                            🎧 Audio · {sampleStory.category || 'Truyện Audio'}
                          </span>
                          <span>•</span>
                          <span>Nghe trọn bộ ({(sampleStory as any).chapters?.length || 3} tập)</span>
                        </div>

                        {/* Google Snippet Description */}
                        <p className="text-xs text-[#bdc1c6] leading-relaxed line-clamp-2">
                          {sampleStoryDesc}
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* 5. CHÈN MÃ THEO DÕI HEADER & BODY (GOOGLE ANALYTICS, FACEBOOK PIXEL, META TAGS...) */}
              <div className="col-span-1 lg:col-span-2 p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                    <Code2 size={16} />
                    <span>5. Chèn Mã Đo Lường & Theo Dõi (Google Analytics, Facebook Pixel, Thẻ Meta)</span>
                  </h4>
                  <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 font-medium">
                    ✓ Lưu trên Server & kích hoạt toàn trang
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Header Code (<head>) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-slate-200 font-bold flex items-center gap-1.5">
                        <span className="text-amber-400 font-mono">&lt;head&gt;</span>
                        <span>Mã Chèn Vào Header (Phổ biến nhất)</span>
                      </label>
                      {settingsForm.headerCode ? (
                        <button
                          type="button"
                          onClick={() => setSettingsForm({ ...settingsForm, headerCode: '' })}
                          className="text-[10px] text-rose-400 hover:text-rose-300 cursor-pointer"
                        >
                          Xóa mã Header
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400">Google Analytics, GTM, Meta Pixel</span>
                      )}
                    </div>

                    <textarea
                      rows={7}
                      value={settingsForm.headerCode || ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, headerCode: e.target.value })}
                      placeholder="<!-- Dán mã Google Analytics (G-XXXXX), Facebook Pixel hoặc thẻ xác minh Google Search Console vào đây -->"
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-amber-200/90 font-mono focus:outline-none focus:border-amber-400 leading-relaxed"
                    />

                    {/* Preset Buttons for Quick Template Insertion */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] text-slate-400 mr-1">Chèn nhanh:</span>
                      <button
                        type="button"
                        onClick={() => {
                          const sampleGA = `<!-- Google tag (gtag.js) -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>\n<script>\n  window.dataLayer = window.dataLayer || [];\n  function gtag(){dataLayer.push(arguments);}\n  gtag('js', new Date());\n  gtag('config', 'G-XXXXXXXXXX');\n</script>`;
                          setSettingsForm(prev => ({
                            ...prev,
                            headerCode: (prev.headerCode ? prev.headerCode + '\n\n' : '') + sampleGA
                          }));
                        }}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-medium border border-slate-700 transition cursor-pointer"
                      >
                        + Google Analytics (GA4)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const sampleFB = `<!-- Meta Pixel Code -->\n<script>\n!function(f,b,e,v,n,t,s)\n{if(f.fbq)return;n=f.fbq=function(){n.callMethod?\nn.callMethod.apply(n,arguments):n.queue.push(arguments)};\nif(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';\nn.queue=[];t=b.createElement(e);t.async=!0;\nt.src=v;s=b.getElementsByTagName(e)[0];\ns.parentNode.insertBefore(t,s)}(window, document,'script',\n'https://connect.facebook.net/en_US/fbevents.js');\nfbq('init', 'YOUR_PIXEL_ID');\nfbq('track', 'PageView');\n</script>`;
                          setSettingsForm(prev => ({
                            ...prev,
                            headerCode: (prev.headerCode ? prev.headerCode + '\n\n' : '') + sampleFB
                          }));
                        }}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-medium border border-slate-700 transition cursor-pointer"
                      >
                        + Facebook Pixel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const sampleVerify = `<meta name="google-site-verification" content="YOUR_VERIFICATION_CODE_HERE" />`;
                          setSettingsForm(prev => ({
                            ...prev,
                            headerCode: (prev.headerCode ? prev.headerCode + '\n\n' : '') + sampleVerify
                          }));
                        }}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-medium border border-slate-700 transition cursor-pointer"
                      >
                        + Xác minh Google
                      </button>
                    </div>
                  </div>

                  {/* Body Code (</body>) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-slate-200 font-bold flex items-center gap-1.5">
                        <span className="text-amber-400 font-mono">&lt;body&gt;</span>
                        <span>Mã Chèn Trước Thẻ Đóng Body</span>
                      </label>
                      {settingsForm.bodyCode ? (
                        <button
                          type="button"
                          onClick={() => setSettingsForm({ ...settingsForm, bodyCode: '' })}
                          className="text-[10px] text-rose-400 hover:text-rose-300 cursor-pointer"
                        >
                          Xóa mã Body
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400">Facebook Chat, TikTok Pixel, Zalo Widget</span>
                      )}
                    </div>

                    <textarea
                      rows={7}
                      value={settingsForm.bodyCode || ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, bodyCode: e.target.value })}
                      placeholder="<!-- Dán mã Facebook Chat Plugin, TikTok Pixel hoặc mã HTML/JS widget vào đây -->"
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-amber-200/90 font-mono focus:outline-none focus:border-amber-400 leading-relaxed"
                    />

                    {/* Preset Buttons for Body */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] text-slate-400 mr-1">Chèn nhanh:</span>
                      <button
                        type="button"
                        onClick={() => {
                          const sampleTikTok = `<!-- TikTok Pixel Code -->\n<script>\n!function (w, d, t) {\n  w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};\n  ttq.load('YOUR_TIKTOK_PIXEL_ID');\n  ttq.page();\n}(window, document, 'ttq');\n</script>`;
                          setSettingsForm(prev => ({
                            ...prev,
                            bodyCode: (prev.bodyCode ? prev.bodyCode + '\n\n' : '') + sampleTikTok
                          }));
                        }}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-medium border border-slate-700 transition cursor-pointer"
                      >
                        + TikTok Pixel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const sampleChat = `<!-- Facebook Messenger Chat Plugin -->\n<div id="fb-root"></div>\n<div id="fb-customer-chat" class="fb-customerchat"></div>\n<script>\n  var chatbox = document.getElementById('fb-customer-chat');\n  chatbox.setAttribute("page_id", "YOUR_PAGE_ID");\n  chatbox.setAttribute("attribution", "biz_inbox");\n</script>`;
                          setSettingsForm(prev => ({
                            ...prev,
                            bodyCode: (prev.bodyCode ? prev.bodyCode + '\n\n' : '') + sampleChat
                          }));
                        }}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-medium border border-slate-700 transition cursor-pointer"
                      >
                        + Facebook Chat Widget
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="submit"
              disabled={isSavingSettings}
              className="px-6 py-3 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 flex items-center gap-2 transition cursor-pointer"
            >
              <BookmarkCheck size={16} />
              <span>{isSavingSettings ? 'Đang Lưu Lên Server...' : 'Lưu Thay Đổi Cài Đặt Lên Server'}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB: QUẢN LÝ TÀI KHOẢN QUẢN TRỊ CMS (THÊM / SỬA / ĐỔI MẬT KHẨU / XÓA KỂ CẢ ADMIN MẶC ĐỊNH) */}
      {activeTab === 'accounts' && (
        <div className="space-y-6 animate-fade-in">
          {/* Header Banner */}
          <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-amber-500/15 via-slate-900 to-slate-900 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold">
                <Users size={14} />
                <span>QUẢN LÝ TÀI KHOẢN QUẢN TRỊ TRÊN SERVER</span>
              </div>
              <h2 className="text-xl font-black text-white">
                Quản Lý Tài Khoản Admin CMS (Thêm • Sửa • Đổi Mật Khẩu • Xóa)
              </h2>
              <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
                Hệ thống luôn cấp sẵn 1 tài khoản Admin mặc định (<strong className="text-amber-300 font-mono">tuld2901@gmail.com</strong> / mật khẩu: <strong className="text-amber-300 font-mono">admin123</strong>). Tại đây bạn có thể <strong className="text-white">tạo thêm tài khoản quản trị mới</strong>, <strong className="text-white">thay đổi email/tên đăng nhập, đổi mật khẩu</strong> hoặc <strong className="text-white">xóa bất kỳ tài khoản nào — kể cả tài khoản Admin mặc định</strong>. Mọi thay đổi đều lưu trực tiếp vào cơ sở dữ liệu trên Server.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="px-3.5 py-2 rounded-xl bg-slate-950/90 border border-slate-800 text-xs font-bold text-amber-300 flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-400" />
                <span>Tổng số: {adminAccounts.length} Tài khoản Admin</span>
              </span>
            </div>
          </div>

          {accountFormMsg && (
            <div className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 ${
              accountFormMsg.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
            }`}>
              <div className="flex items-center gap-2">
                {accountFormMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                <span>{accountFormMsg.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setAccountFormMsg(null)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Cột trái: Form Tạo mới / Chỉnh sửa tài khoản quản trị */}
            <div className="lg:col-span-5 p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 self-start">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  {editingAccountId ? (
                    <>
                      <Edit3 size={16} className="text-amber-400" />
                      <span>Chỉnh Sửa Tài Khoản Quản Trị</span>
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} className="text-amber-400" />
                      <span>Tạo Thêm Tài Khoản Quản Trị Mới</span>
                    </>
                  )}
                </h3>
                {editingAccountId && (
                  <button
                    type="button"
                    onClick={resetAccountForm}
                    className="text-xs text-rose-400 hover:text-rose-300 underline cursor-pointer"
                  >
                    Hủy sửa
                  </button>
                )}
              </div>

              <form onSubmit={handleSaveAdminAccount} className="space-y-4 text-xs">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1.5">
                    Email Quản Trị (Dùng để đăng nhập) *
                  </label>
                  <input
                    type="text"
                    required
                    value={accEmailInput}
                    onChange={(e) => setAccEmailInput(e.target.value)}
                    placeholder="VD: admin@tenmien.com hoặc tuld2901@gmail.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-amber-400 font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1.5">
                    Tên Đăng Nhập Ngắn / Username (Tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={accUsernameInput}
                    onChange={(e) => setAccUsernameInput(e.target.value)}
                    placeholder="VD: admin, superadmin..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-amber-400 font-mono"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Có thể dùng Email hoặc Tên đăng nhập này để đăng nhập vào CMS.
                  </span>
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1.5">
                    Mật Khẩu Quản Trị *
                  </label>
                  <div className="relative">
                    <input
                      type={showAccPassword ? 'text' : 'password'}
                      required
                      value={accPasswordInput}
                      onChange={(e) => setAccPasswordInput(e.target.value)}
                      placeholder="Nhập mật khẩu quản trị (tối thiểu 3 ký tự)..."
                      className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-amber-300 font-mono focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAccPassword(!showAccPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                      title={showAccPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      {showAccPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1.5">
                      Tên Hiển Thị
                    </label>
                    <input
                      type="text"
                      value={accNameInput}
                      onChange={(e) => setAccNameInput(e.target.value)}
                      placeholder="VD: Quản Trị Viên Chính"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-semibold block mb-1.5">
                      Vai Trò / Quyền Hạn
                    </label>
                    <select
                      value={accRoleInput}
                      onChange={(e) => setAccRoleInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                    >
                      <option value="Super Admin">Super Admin (Toàn quyền)</option>
                      <option value="Admin">Admin (Quản trị viên)</option>
                      <option value="Editor">Biên tập viên (Editor)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-800">
                  {editingAccountId && (
                    <button
                      type="button"
                      onClick={resetAccountForm}
                      className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition cursor-pointer"
                    >
                      Hủy Bỏ
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isSavingAccount}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold flex items-center gap-2 transition cursor-pointer shadow-lg shadow-amber-500/20"
                  >
                    <Key size={15} />
                    <span>
                      {isSavingAccount
                        ? 'Đang Lưu Lên Server...'
                        : editingAccountId
                          ? 'Lưu Cập Nhật Tài Khoản'
                          : 'Tạo Tài Khoản Admin Mới'}
                    </span>
                  </button>
                </div>
              </form>
            </div>

            {/* Cột phải: Danh sách các tài khoản quản trị hiện có */}
            <div className="lg:col-span-7 p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <ShieldCheck size={16} className="text-amber-400" />
                    <span>Danh Sách Tài Khoản Quản Trị ({adminAccounts.length})</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Bấm "Sửa / Đổi Pass" để đổi email, username, mật khẩu hoặc bấm "Xóa" để loại bỏ tài khoản khỏi Server.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {adminAccounts.map((acc) => {
                  const isCurrentSession =
                    currentUserEmail &&
                    (acc.email.trim().toLowerCase() === currentUserEmail.trim().toLowerCase() ||
                      (acc.username && acc.username.trim().toLowerCase() === currentUserEmail.trim().toLowerCase()));
                  const isBeingEdited = editingAccountId === acc.id;
                  const isPassVisible = Boolean(visiblePasswordsMap[acc.id]);

                  return (
                    <div
                      key={acc.id}
                      className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        isBeingEdited
                          ? 'bg-amber-500/10 border-amber-400 shadow-lg shadow-amber-500/10'
                          : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="space-y-2 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-white">
                            {acc.name || 'Quản Trị Viên'}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            {acc.role || 'Super Admin'}
                          </span>
                          {(acc.isDefault || acc.id === 'admin-default') && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                              Mặc định
                            </span>
                          )}
                          {isCurrentSession && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              ● Đang đăng nhập
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/90">
                          <div className="flex items-center justify-between gap-2 min-w-0">
                            <span className="text-slate-400 font-sans text-[11px] shrink-0">Email:</span>
                            <span className="text-amber-300 font-bold truncate select-all" title={acc.email}>
                              {acc.email}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-2 min-w-0">
                            <span className="text-slate-400 font-sans text-[11px] shrink-0">Username:</span>
                            <span className="text-slate-200 font-semibold truncate select-all">
                              {acc.username || acc.email.split('@')[0]}
                            </span>
                          </div>

                          <div className="sm:col-span-2 flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                            <span className="text-slate-400 font-sans text-[11px]">Mật khẩu:</span>
                            <div className="flex items-center gap-2">
                              <span className="text-emerald-300 font-bold select-all">
                                {isPassVisible ? acc.password : '••••••••'}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setVisiblePasswordsMap((prev) => ({
                                    ...prev,
                                    [acc.id]: !prev[acc.id]
                                  }))
                                }
                                className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                                title={isPassVisible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                              >
                                {isPassVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopyText(acc.password, `pass-${acc.id}`)}
                                className="text-slate-400 hover:text-amber-300 p-0.5 cursor-pointer"
                                title="Sao chép mật khẩu"
                              >
                                {apiCopiedKey === `pass-${acc.id}` ? (
                                  <Check size={13} className="text-emerald-400" />
                                ) : (
                                  <Copy size={13} />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center justify-end gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleStartEditAccount(acc)}
                          className="w-full sm:w-auto px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 flex items-center justify-center gap-1.5 transition cursor-pointer"
                          title="Chỉnh sửa thông tin hoặc đổi mật khẩu tài khoản này"
                        >
                          <Edit3 size={13} />
                          <span>Sửa / Đổi Pass</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteAdminAccount(acc)}
                          className="w-full sm:w-auto px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 flex items-center justify-center gap-1.5 transition cursor-pointer"
                          title="Xóa tài khoản này khỏi hệ thống (kể cả tài khoản mặc định)"
                        >
                          <Trash2 size={13} />
                          <span>Xóa Tài Khoản</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: BACKUP DỮ LIỆU, CHUẨN HÓA SLUG FILE MP3 & THỐNG NHẤT THƯ MỤC TĨNH */}
      {activeTab === 'backup' && (
        <div className="space-y-6 animate-fade-in">
          {/* Header Banner */}
          <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-amber-500/15 via-slate-900 to-slate-900 border border-amber-500/30 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold">
                <HardDrive size={14} />
                <span>SAO LƯU & KHÔI PHỤC DỮ LIỆU TOÀN HỆ THỐNG</span>
              </div>
              <h2 className="text-xl font-black text-white">
                Backup Dữ Liệu • Chuẩn Hóa Tên File Theo Slug • Thư Mục Tĩnh <code className="text-amber-300 font-mono">uploads/audio/</code>
              </h2>
              <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
                Quản lý sao lưu và khôi phục trọn bộ cơ sở dữ liệu <code className="text-amber-300 font-mono">data/db.json</code> cùng thư mục tĩnh cố định <code className="text-amber-300 font-mono">uploads/audio/</code> nằm ngay tại thư mục gốc dự án. Mọi file MP3 tải lên đều được tự động chuẩn hóa tên file theo slug không dấu gạch nối của tiêu đề tập truyện.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <button
                type="button"
                onClick={handleCleanupOrphanedFiles}
                disabled={isLoadingBackup}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border ${
                  (backupInfo?.uploadsDir.orphanAudioFilesCount ?? 0) > 0
                    ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500 shadow-lg shadow-rose-600/20'
                    : 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/40 text-rose-300'
                }`}
                title="Đối chiếu với data/db.json và xóa sạch các file MP3/ảnh đã xóa truyện nhưng vẫn còn nằm trong uploads/"
              >
                <Trash2 size={15} />
                <span>
                  Dọn Sạch File Audio Rác
                  {(backupInfo?.uploadsDir.orphanAudioFilesCount ?? 0) > 0
                    ? ` (${backupInfo?.uploadsDir.orphanAudioFilesCount} file - ${formatBytes(backupInfo?.uploadsDir.orphanAudioSizeBytes || 0)})`
                    : ''}
                </span>
              </button>
              <button
                type="button"
                onClick={handleNormalizeAllSlugs}
                disabled={isLoadingBackup}
                className="px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                title="Quét và chuẩn hóa toàn bộ tên file MP3 theo slug tiêu đề tập"
              >
                <Sparkles size={15} />
                <span>Chuẩn Hóa Toàn Bộ Tên File Theo Slug</span>
              </button>
              <button
                type="button"
                onClick={loadBackupInfo}
                disabled={isLoadingBackup}
                className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <RefreshCw size={14} className={isLoadingBackup ? 'animate-spin' : ''} />
                <span>Làm mới</span>
              </button>
            </div>
          </div>

          {backupMsg && (
            <div className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 ${
              backupMsg.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
            }`}>
              <div className="flex items-center gap-2">
                {backupMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                <span>{backupMsg.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setBackupMsg(null)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Metrics Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase">File CSDL Server</span>
                <FileJson size={16} className="text-amber-400" />
              </div>
              <div className="text-lg font-black text-white font-mono">data/db.json</div>
              <div className="text-xs text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/80">
                <span>Dung lượng: <strong className="text-amber-300">{formatBytes(backupInfo?.dbFile.sizeBytes || 0)}</strong></span>
                <span className="text-emerald-400 font-semibold">✓ Sẵn sàng</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase">Thư Mục Audio Cố Định</span>
                <FileAudio size={16} className="text-emerald-400" />
              </div>
              <div className="text-lg font-black text-emerald-300 font-mono">uploads/audio/</div>
              <div className="text-xs text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/80">
                <span>
                  Đang dùng: <strong className="text-emerald-400">{backupInfo?.uploadsDir.usedAudioFilesCount ?? backupInfo?.uploadsDir.audioFilesCount ?? 0}</strong> • Rác: <strong className={(backupInfo?.uploadsDir.orphanAudioFilesCount ?? 0) > 0 ? 'text-rose-400' : 'text-slate-300'}>{backupInfo?.uploadsDir.orphanAudioFilesCount ?? 0}</strong>
                </span>
                <span>Tổng: <strong className="text-amber-300">{formatBytes(backupInfo?.uploadsDir.totalSizeBytes || 0)}</strong></span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase">Dữ Liệu Đang Lưu Trữ</span>
                <Database size={16} className="text-sky-400" />
              </div>
              <div className="text-lg font-black text-white">
                {backupInfo?.dbFile.storiesCount ?? tracks.length} Bộ Truyện ({backupInfo?.dbFile.chaptersCount ?? 0} Tập)
              </div>
              <div className="text-xs text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/80">
                <span>Affiliate: <strong className="text-white">{backupInfo?.dbFile.affiliatesCount ?? affiliateList.length} link</strong></span>
                <span>Admin: <strong className="text-white">{backupInfo?.dbFile.adminsCount ?? adminAccounts.length} TK</strong></span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase">Bản Sao Lưu Trên Server</span>
                <Archive size={16} className="text-purple-400" />
              </div>
              <div className="text-lg font-black text-white">
                {backupInfo?.snapshots.length ?? 0} Bản Snapshot
              </div>
              <div className="text-xs text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/80">
                <span>Thư mục: <code className="text-amber-300 font-mono">backups/</code></span>
                <span className="text-emerald-400">Khôi phục 1-Click</span>
              </div>
            </div>
          </div>

          {/* Section 1: Download Backup & Restore Database */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Tải về máy tính & Tạo bản sao lưu trên Server */}
            <div className="lg:col-span-7 p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Download size={16} className="text-amber-400" />
                  <span>1. Tải Về Bản Sao Lưu (Download Backup Về Máy Tính)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Tải trực tiếp file cơ sở dữ liệu <code className="text-amber-300 font-mono">db.json</code> hoặc gói nén toàn bộ dữ liệu + file âm thanh <code className="text-amber-300 font-mono">.tar.gz</code> về máy tính để lưu trữ an toàn khi chuyển VPS/Hosting.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <a
                  href="/api/backup/download-db"
                  download
                  className="p-4 rounded-2xl bg-slate-950 hover:bg-slate-950/80 border border-amber-500/40 hover:border-amber-400 transition flex flex-col justify-between gap-3 group"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold font-mono">
                        data/db.json
                      </span>
                      <FileJson size={18} className="text-amber-400 group-hover:scale-110 transition-transform" />
                    </div>
                    <h4 className="text-sm font-bold text-white">Tải File Database (db.json)</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Chứa toàn bộ danh sách truyện, tập truyện, đường dẫn <code className="text-slate-300">/uploads/audio/...</code>, link Affiliate, Banner và tài khoản Admin.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs font-bold text-amber-400">
                    <span>Tải về máy (.json)</span>
                    <Download size={14} />
                  </div>
                </a>

                <a
                  href="/api/backup/download-full"
                  download
                  className="p-4 rounded-2xl bg-slate-950 hover:bg-slate-950/80 border border-emerald-500/40 hover:border-emerald-400 transition flex flex-col justify-between gap-3 group"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold font-mono">
                        data/ + uploads/
                      </span>
                      <Archive size={18} className="text-emerald-400 group-hover:scale-110 transition-transform" />
                    </div>
                    <h4 className="text-sm font-bold text-white">Tải Trọn Gói Full Backup (.tar.gz)</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Nén toàn bộ thư mục <code className="text-slate-300">data/db.json</code> cùng toàn bộ file MP3 & hình ảnh trong <code className="text-slate-300">uploads/</code> thành 1 file duy nhất.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs font-bold text-emerald-400">
                    <span>Tải trọn gói (.tar.gz)</span>
                    <Download size={14} />
                  </div>
                </a>
              </div>

              {/* Create Snapshot on Server */}
              <form onSubmit={handleCreateServerSnapshot} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Server size={14} className="text-amber-400" />
                    <span>Tạo Bản Sao Lưu Dự Phòng Lưu Ngay Trên Server (backups/)</span>
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="text"
                    value={snapshotLabelInput}
                    onChange={(e) => setSnapshotLabelInput(e.target.value)}
                    placeholder="Ghi chú bản sao lưu (VD: truoc-khi-them-truyen-moi)..."
                    className="flex-1 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="submit"
                    disabled={isLoadingBackup}
                    className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0 shadow-md shadow-amber-500/20"
                  >
                    <Archive size={14} />
                    <span>Tạo Bản Backup Trên Server</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Right: Khôi phục dữ liệu từ file JSON & Danh sách Snapshot */}
            <div className="lg:col-span-5 p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <RotateCcw size={16} className="text-amber-400" />
                    <span>2. Khôi Phục Dữ Liệu (Restore Từ File db.json)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Tải file <code className="text-amber-300 font-mono">.json</code> đã sao lưu từ máy tính lên để khôi phục toàn bộ truyện, tập truyện, Affiliate và cài đặt.
                  </p>
                </div>

                <label className="p-5 rounded-2xl border-2 border-dashed border-amber-500/40 hover:border-amber-400 bg-slate-950/70 hover:bg-slate-950 transition flex flex-col items-center justify-center text-center gap-2 cursor-pointer">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Upload size={20} />
                  </div>
                  <span className="text-xs font-bold text-white">
                    {isRestoringDb ? 'Đang khôi phục dữ liệu lên Server...' : 'Bấm để chọn file backup (.json) từ máy tính'}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Hệ thống tự động tạo 1 bản snapshot an toàn trước khi khôi phục
                  </span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleRestoreDbFromFile}
                    disabled={isRestoringDb}
                    className="hidden"
                  />
                </label>

                {/* Server Snapshots List */}
                <div className="space-y-2 pt-2">
                  <span className="text-xs font-bold text-slate-300 block">
                    Các bản Snapshot đang lưu trên Server ({backupInfo?.snapshots.length ?? 0}):
                  </span>
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {backupInfo?.snapshots && backupInfo.snapshots.length > 0 ? (
                      backupInfo.snapshots.map((snap) => (
                        <div
                          key={snap.filename}
                          className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-mono font-bold text-amber-300 truncate" title={snap.filename}>
                              {snap.filename}
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                              <span>{snap.storiesCount} truyện ({snap.chaptersCount} tập)</span>
                              <span>•</span>
                              <span>{formatBytes(snap.sizeBytes)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleRestoreFromSnapshot(snap.filename)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold cursor-pointer"
                              title="Khôi phục bản sao lưu này"
                            >
                              Khôi phục
                            </button>
                            <a
                              href={`/api/backup/snapshots/${encodeURIComponent(snap.filename)}/download`}
                              download
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700"
                              title="Tải bản sao lưu này về máy"
                            >
                              <Download size={13} />
                            </a>
                            <button
                              type="button"
                              onClick={() => handleDeleteSnapshot(snap.filename)}
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 cursor-pointer"
                              title="Xóa bản sao lưu này"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400">
                        Chưa có bản snapshot nào trong thư mục <code className="text-amber-300 font-mono">backups/</code>. Bấm "Tạo Bản Backup Trên Server" để tạo ngay.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Chuẩn Hóa Quy Tắc Đặt Tên File Slug & Quản Lý / Dọn Dẹp File Trong uploads/audio/ */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Quy chuẩn đặt tên file MP3 theo Slug & Cấu hình Nginx */}
            <div className="lg:col-span-5 p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles size={16} className="text-amber-400" />
                  <span>3. Chuẩn Hóa Tên File Theo Slug & Cơ Chế Tự Dọn Rác</span>
                </h3>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs">
                <div className="font-bold text-amber-300 uppercase tracking-wider text-[11px]">
                  1. Quy tắc tự động đặt tên & tự động xóa file khi xóa truyện/tập:
                </div>
                <div className="space-y-1.5 text-slate-300 font-mono text-[11px] bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                  <div>
                    <span className="text-slate-400">Tiêu đề tập: </span>
                    <strong className="text-white">Tập 1: Tiếng Gõ Cửa Đêm Khuya</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Tên file lưu trên đĩa: </span>
                    <strong className="text-amber-300">tap-1-tieng-go-cua-dem-khuya.mp3</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Khi xóa truyện / xóa tập: </span>
                    <strong className="text-emerald-300">Tự động xóa luôn file MP3 khỏi uploads/audio/</strong>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-amber-300 uppercase tracking-wider text-[11px]">
                    2. Cấu hình Nginx trỏ thẳng thư mục tĩnh duy nhất (uploads/):
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyText(
                        `location /uploads/ {\n    alias /root/NAMNGHE-AUDIO/uploads/;\n    expires 30d;\n    add_header Cache-Control "public, no-transform";\n    add_header Accept-Ranges bytes;\n}`,
                        'nginx-uploads-alias'
                      )
                    }
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    {apiCopiedKey === 'nginx-uploads-alias' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    <span>{apiCopiedKey === 'nginx-uploads-alias' ? 'Đã Copy' : 'Copy Nginx'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  Đường dẫn thư mục vật lý cố định: <code className="text-emerald-300 font-mono">uploads/audio/</code> (nằm ngay trong thư mục gốc dự án).
                </p>
                <pre className="p-3 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] text-emerald-300 overflow-x-auto leading-relaxed">
{`location /uploads/ {
    alias /root/NAMNGHE-AUDIO/uploads/;
    expires 30d;
    add_header Cache-Control "public, no-transform";
    add_header Accept-Ranges bytes;
}`}
                </pre>
              </div>
            </div>

            {/* Right: Danh sách file vật lý trong uploads/audio/ & Công cụ dọn dẹp theo DB */}
            <div className="lg:col-span-7 p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <FileAudio size={16} className="text-emerald-400" />
                    <span>4. Quản Lý & Dọn Dẹp File Trong <code className="text-emerald-300 font-mono">uploads/audio/</code> ({backupInfo?.uploadsDir.audioFiles.length ?? 0})</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Đối chiếu trực tiếp từng file vật lý trên ổ đĩa với <code className="text-amber-300 font-mono">data/db.json</code> để phát hiện và xóa các file dư thừa.
                  </p>
                </div>

                {(backupInfo?.uploadsDir.orphanAudioFilesCount ?? 0) > 0 && (
                  <button
                    type="button"
                    onClick={handleCleanupOrphanedFiles}
                    disabled={isLoadingBackup}
                    className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer shadow-md shadow-rose-600/20"
                  >
                    <Trash2 size={14} />
                    <span>Xóa Tất Cả {backupInfo?.uploadsDir.orphanAudioFilesCount} File Rác</span>
                  </button>
                )}
              </div>

              {/* Filter Tabs: Tất cả / Đang dùng trong DB / File rác */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    {
                      id: 'all',
                      label: `Tất cả (${backupInfo?.uploadsDir.audioFiles.length ?? 0})`
                    },
                    {
                      id: 'orphan',
                      label: `File rác / Đã xóa khỏi DB (${backupInfo?.uploadsDir.orphanAudioFilesCount ?? 0})`
                    },
                    {
                      id: 'used',
                      label: `Đang dùng trong DB (${backupInfo?.uploadsDir.usedAudioFilesCount ?? 0})`
                    }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setAudioFilesFilter(tab.id as any)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        audioFilesFilter === tab.id
                          ? tab.id === 'orphan'
                            ? 'bg-rose-500 text-white'
                            : 'bg-amber-400 text-slate-950'
                          : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <span className="text-[11px] text-slate-400">
                  Dung lượng file rác: <strong className={(backupInfo?.uploadsDir.orphanAudioSizeBytes ?? 0) > 0 ? 'text-rose-400' : 'text-emerald-400'}>{formatBytes(backupInfo?.uploadsDir.orphanAudioSizeBytes || 0)}</strong>
                </span>
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {(() => {
                  const allFiles = backupInfo?.uploadsDir.audioFiles || [];
                  const filteredFiles = allFiles.filter((f) => {
                    if (audioFilesFilter === 'orphan') return f.isUsedInDb === false;
                    if (audioFilesFilter === 'used') return f.isUsedInDb !== false;
                    return true;
                  });

                  if (filteredFiles.length === 0) {
                    return (
                      <div className="p-6 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400">
                        {audioFilesFilter === 'orphan'
                          ? 'Tuyệt vời! Không có file MP3 rác nào trong thư mục uploads/audio/. Toàn bộ file trên đĩa đều khớp 100% với Database.'
                          : 'Hiện chưa có file MP3 nào trong danh mục này.'}
                      </div>
                    );
                  }

                  return filteredFiles.map((f) => {
                    const isUsed = f.isUsedInDb !== false;
                    return (
                      <div
                        key={f.filename}
                        className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition ${
                          isUsed
                            ? 'bg-slate-950 border-slate-800'
                            : 'bg-rose-500/5 border-rose-500/30 hover:border-rose-500/50'
                        }`}
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-white truncate" title={f.filename}>
                              {f.filename}
                            </span>
                            {isUsed ? (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                                ✓ Đang dùng trong DB
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold">
                                ⚠️ File rác (Đã xóa khỏi DB)
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] font-mono text-slate-400 truncate">
                            {f.url}
                          </div>

                          {isUsed && f.usedBy && f.usedBy.length > 0 && (
                            <div className="text-[11px] text-emerald-400/90 truncate" title={f.usedBy.join(', ')}>
                              Truyện sử dụng: <strong>{f.usedBy.join(', ')}</strong>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0 justify-end">
                          <span className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-amber-300">
                            {formatBytes(f.sizeBytes)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyText(f.url, `audio-url-${f.filename}`)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                            title="Copy đường dẫn /uploads/audio/..."
                          >
                            {apiCopiedKey === `audio-url-${f.filename}` ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                            <span>Copy</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSingleAudioFile(f.filename, isUsed, f.usedBy)}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition ${
                              isUsed
                                ? 'bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-700'
                                : 'bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/40'
                            }`}
                            title={isUsed ? 'Xóa file này khỏi ổ đĩa' : 'Xóa vĩnh viễn file rác này khỏi uploads/audio/'}
                          >
                            <Trash2 size={12} />
                            <span>Xóa</span>
                          </button>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: SQL SCHEMA & SETUP */}
      {activeTab === 'sql' && (
        <div className="space-y-6">
          {/* 1. Cấu Hình Supabase Cloud SQL Trực Tiếp Lên Server */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Database size={18} className="text-amber-400" />
                <h3 className="text-base font-bold text-white">
                  Cấu Hình Supabase Cloud SQL (Đồng Bộ Server)
                </h3>
              </div>
              <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold border ${
                isSupabaseServerConnected
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {isSupabaseServerConnected ? '✓ Supabase Đã Kết Nối Server' : 'Chế độ: Server JSON Database (db.json)'}
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Nhập thông tin kết nối Supabase của bạn để Server lưu trữ trực tiếp vào PostgreSQL Cloud SQL. Mọi thao tác thêm/xóa/sửa truyện, link affiliate và cài đặt banner sẽ được gửi trực tiếp lên Server và đồng bộ vào Supabase mà không dựa vào bộ nhớ trình duyệt Chrome.
            </p>

            <form onSubmit={handleSaveSupabaseConfig} className="space-y-4 pt-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Supabase Project URL:
                  </label>
                  <input
                    type="url"
                    value={supabaseUrlInput}
                    onChange={(e) => setSupabaseUrlInput(e.target.value)}
                    placeholder="https://your-project.supabase.co"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Supabase Anon Public Key:
                  </label>
                  <input
                    type="password"
                    value={supabaseKeyInput}
                    onChange={(e) => setSupabaseKeyInput(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {supabaseConfigStatus && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  supabaseConfigStatus.toLowerCase().includes('lỗi') || supabaseConfigStatus.toLowerCase().includes('thất bại')
                    ? 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                    : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                }`}>
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{supabaseConfigStatus}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="submit"
                  disabled={isSavingSupabase}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 flex items-center gap-2 transition cursor-pointer shadow-md shadow-amber-500/20"
                >
                  <BookmarkCheck size={16} />
                  <span>{isSavingSupabase ? 'Đang lưu lên Server...' : 'Lưu Cấu Hình Supabase Lên Server'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* 2. Database Health & Status Banner */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-[#101726] to-slate-900 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Database size={18} className="text-amber-400" />
                <h4 className="text-sm font-bold text-white">
                  Trạng Thái Cơ Sở Dữ Liệu SQL
                </h4>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                  isSupabaseServerConnected || isSupabaseConfigured()
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}>
                  {isSupabaseServerConnected || isSupabaseConfigured() ? '✓ Đã kết nối Supabase Cloud SQL' : '✓ Server Database Persistent (data/db.json)'}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                  healthReport.status === 'healthy'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-red-500/10 text-red-400 border-red-500/30'
                }`}>
                  {healthReport.status === 'healthy' ? '✓ Dữ liệu chuẩn 100%' : '⚠️ Có cảnh báo'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Toàn bộ dữ liệu hiển thị trên trang chủ, danh sách truyện và thanh phát audio được đồng bộ trực tiếp từ CSDL Server này.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  onRefreshTracks();
                  setHealthReport(validateDatabaseIntegrity(tracks));
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 flex items-center gap-1.5 transition cursor-pointer"
              >
                <RefreshCw size={13} /> Kiểm tra & Tải lại
              </button>
            </div>
          </div>

          {/* 2. Thống kê & Kiểm tra toàn vẹn CSDL */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Tổng Audio Trong CSDL</span>
              <span className="text-2xl font-black text-white font-mono">{healthReport.totalTracks}</span>
              <span className="text-[11px] text-emerald-400 block">Sẵn sàng phát</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Tổng Số Tập (Chapters)</span>
              <span className="text-2xl font-black text-amber-400 font-mono">{healthReport.totalChapters}</span>
              <span className="text-[11px] text-slate-400 block">Đầy đủ thời lượng</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Link MP3 Hợp Lệ</span>
              <span className="text-2xl font-black text-emerald-400 font-mono">{healthReport.validAudioUrls}</span>
              <span className="text-[11px] text-slate-400 block">0 link lỗi</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Liên Kết Affiliate Pool</span>
              <span className="text-2xl font-black text-blue-400 font-mono">{healthReport.totalAffiliates}</span>
              <span className="text-[11px] text-slate-400 block">{healthReport.totalCategories} tài khoản</span>
            </div>
          </div>

          {/* 3. INTERACTIVE SQL CONSOLE (TRUY VẤN VÀ CẬP NHẬT TRỰC TIẾP) */}
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Terminal size={18} className="text-amber-400" />
                <h3 className="text-base font-bold text-white">
                  SQL Query Console (Thực Thi Truy Vấn Trực Tiếp)
                </h3>
              </div>
              <span className="text-[11px] text-slate-400">
                Hỗ trợ SELECT, INSERT, UPDATE, DELETE & GROUP BY
              </span>
            </div>

            {/* Quick Query Templates */}
            <div className="space-y-1.5">
              <span className="text-[11px] text-slate-400 font-semibold block">Mẫu truy vấn nhanh:</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  {
                    label: 'Top lượt nghe',
                    query: 'SELECT id, title, category, author, play_count FROM tracks ORDER BY play_count DESC LIMIT 10;'
                  },
                  {
                    label: 'Thống kê theo thể loại',
                    query: 'SELECT category, count(*) AS total_stories, sum(play_count) AS total_plays FROM tracks GROUP BY category;'
                  },
                  {
                    label: 'Truyện Ma rùng rợn',
                    query: "SELECT id, title, narrator, play_count FROM tracks WHERE category = 'Truyện Ma' ORDER BY play_count DESC;"
                  },
                  {
                    label: '+100 lượt nghe track-1',
                    query: "UPDATE tracks SET play_count = play_count + 100 WHERE id = 'track-1';"
                  },
                  {
                    label: 'Xem bảng Affiliate Links',
                    query: "SELECT id, title, platform, is_active, clicks FROM affiliate_links;"
                  }
                ].map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSqlInput(item.query)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs border border-slate-700/80 transition cursor-pointer"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Query Input Box */}
            <div className="space-y-2">
              <textarea
                rows={4}
                value={sqlInput}
                onChange={(e) => setSqlInput(e.target.value)}
                placeholder="Nhập câu lệnh SQL vào đây. Ví dụ: SELECT * FROM tracks WHERE category = 'Truyện Ma';"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-amber-300 font-mono focus:outline-none focus:border-amber-400 leading-relaxed"
              />

              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-[11px] text-slate-400">
                  Phím tắt: Bấm Chạy câu lệnh để xem kết quả trả về ngay bên dưới.
                </span>
                <button
                  type="button"
                  onClick={handleRunSQL}
                  disabled={isExecutingSql}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-amber-500/20"
                >
                  <PlayCircle size={15} />
                  <span>{isExecutingSql ? 'Đang thực thi...' : 'Chạy câu lệnh SQL'}</span>
                </button>
              </div>
            </div>

            {/* Query Result Box */}
            {sqlResult && (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 animate-fade-in">
                <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800/80 pb-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${sqlResult.success ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                    <span className={`text-xs font-bold ${sqlResult.success ? 'text-emerald-300' : 'text-red-400'}`}>
                      {sqlResult.message}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                    <span>{sqlResult.rowCount} bản ghi</span>
                    <span>•</span>
                    <span>{sqlResult.executionTimeMs} ms</span>
                  </div>
                </div>

                {sqlResult.rows && sqlResult.rows.length > 0 ? (
                  <div className="overflow-x-auto max-h-72 scrollbar-thin">
                    <table className="w-full text-left text-xs font-mono border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-amber-400 bg-slate-900/60 sticky top-0">
                          {sqlResult.columns.map((col, idx) => (
                            <th key={idx} className="p-2 whitespace-nowrap font-semibold">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {sqlResult.rows.map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-slate-900/40 text-slate-300">
                            {sqlResult.columns.map((col, cIdx) => (
                              <td key={cIdx} className="p-2 whitespace-nowrap max-w-xs truncate">
                                {typeof row[col] === 'boolean'
                                  ? (row[col] ? 'TRUE' : 'FALSE')
                                  : typeof row[col] === 'object' && row[col] !== null
                                    ? JSON.stringify(row[col])
                                    : String(row[col] ?? 'NULL')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    Không có bản ghi nào phù hợp với điều kiện truy vấn.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 4. FULL MIGRATION SCRIPT & EXPORT */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Database size={18} className="text-amber-400" />
                  <span>Mã SQL Chuẩn Hóa Khởi Tạo Database (Supabase & Cloud SQL)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Bao gồm đầy đủ 4 bảng <code className="text-amber-300 font-mono">tracks</code>, <code className="text-amber-300 font-mono">affiliate_categories</code>, <code className="text-amber-300 font-mono">affiliate_links</code>, <code className="text-amber-300 font-mono">site_settings</code> đồng bộ theo dữ liệu thực tế trên Server.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadSQL}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
                  title="Tải về file script .sql"
                >
                  <Download size={14} />
                  <span>Tải file .sql</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(SQL_SNIPPET);
                    setSqlCopied(true);
                    setTimeout(() => setSqlCopied(false), 2000);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-400 text-slate-950 hover:bg-amber-300 flex items-center gap-1.5 transition cursor-pointer"
                >
                  {sqlCopied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{sqlCopied ? 'Đã copy!' : 'Sao chép SQL'}</span>
                </button>
              </div>
            </div>

            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-amber-200/90 overflow-x-auto max-h-96 leading-relaxed">
              {SQL_SNIPPET}
            </pre>
          </div>
        </div>
      )}

      {/* TAB: STORY MANAGEMENT API GATEWAY (CỔNG API ĐĂNG / SỬA / XÓA TRUYỆN) */}
      {activeTab === 'api' && (
        <div className="space-y-6 animate-fade-in">
          {/* Header & Overview */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-amber-500/15 via-slate-900 to-slate-900 border border-amber-500/30 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold">
                <Code2 size={14} />
                <span>CỔNG API QUẢN LÝ TRUYỆN TRÊN SERVER (REST & GATEWAY)</span>
              </div>
              <h2 className="text-xl font-black text-white">
                Cổng API Tự Động Đăng • Sửa • Thêm Tập • Xóa Truyện
              </h2>
              <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
                Bạn có thể gọi trực tiếp từ tool tự động (Python, Node.js, n8n, Make, Postman, cURL...) vào <strong className="text-amber-300">1 Cổng API Duy Nhất (POST /api/gateway)</strong> hoặc qua các chuẩn RESTful <code className="text-amber-300 font-mono">/api/v1/stories</code>. Mọi thao tác đều lưu trực tiếp vào cơ sở dữ liệu trên Server.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Cổng API Đang Mở (24/7)</span>
              </span>
            </div>
          </div>

          {/* Section 1: Endpoint URLs & Server API Key Security */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Main Gateway & REST Endpoints */}
            <div className="lg:col-span-7 p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Terminal size={16} className="text-amber-400" />
                <span>Địa Chỉ Cổng API Chính Thức (Endpoints)</span>
              </h3>

              {/* Primary Single Gateway URL */}
              <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/40 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <Zap size={14} />
                    <span>Cổng API Duy Nhất (Khuyên dùng - Gửi mọi lệnh Đăng/Sửa/Xóa vào 1 link):</span>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold">
                    POST JSON
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 bg-slate-900 px-3 py-2 rounded-lg border border-slate-800 font-mono text-xs text-emerald-300">
                  <span className="truncate select-all">{`${window.location.origin}/api/gateway`}</span>
                  <button
                    type="button"
                    onClick={() => handleCopyText(`${window.location.origin}/api/gateway`, 'gw-url')}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-sans font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    {apiCopiedKey === 'gw-url' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    <span>{apiCopiedKey === 'gw-url' ? 'Đã copy' : 'Copy Link'}</span>
                  </button>
                </div>
              </div>

              {/* Standard RESTful Endpoints Table */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-400 block">
                  Hoặc gọi theo chuẩn RESTful & Upload / Streaming trực tiếp:
                </span>
                <div className="divide-y divide-slate-800/80 rounded-xl border border-slate-800 bg-slate-950/70 text-xs">
                  {[
                    { method: 'POST', badge: 'bg-amber-500/20 text-amber-300', path: '/api/gateway', desc: 'Cổng 1-Port Đa Năng (list, get, create, update, add_chapter, delete_chapter, delete)' },
                    { method: 'POST', badge: 'bg-indigo-500/20 text-indigo-300', path: '/api/upload-audio', desc: 'Upload file .mp3 vào uploads/audio/ (form-data: audio, tối đa 150MB, đo duration bằng ffprobe)' },
                    { method: 'POST', badge: 'bg-cyan-500/20 text-cyan-300', path: '/api/upload-image', desc: 'Upload ảnh bìa/banner vào uploads/images/ (form-data: image, tối đa 20MB)' },
                    { method: 'GET', badge: 'bg-teal-500/20 text-teal-300', path: '/uploads/audio/:filename', desc: 'Phát trực tiếp file MP3 (HTTP 206 Partial Content, Accept-Ranges: bytes)' },
                    { method: 'GET', badge: 'bg-emerald-500/20 text-emerald-300', path: '/api/stream-audio', desc: 'Cắt luồng Byte-Slicing khi tua qua Cloudflare (?src=/uploads/audio/...&t=giây&dur=tổng)' },
                    { method: 'GET', badge: 'bg-sky-500/20 text-sky-300', path: '/api/tracks (hoặc /api/v1/stories)', desc: 'Lấy danh sách tất cả truyện' },
                    { method: 'POST', badge: 'bg-emerald-500/20 text-emerald-300', path: '/api/tracks (hoặc /api/v1/stories)', desc: 'Đăng truyện mới lên Server' },
                    { method: 'PUT', badge: 'bg-amber-500/20 text-amber-300', path: '/api/tracks/:id', desc: 'Sửa thông tin truyện theo ID (Hỗ trợ cả PUT và PATCH)' },
                    { method: 'POST', badge: 'bg-purple-500/20 text-purple-300', path: '/api/tracks/:id/chapters', desc: 'Thêm tập MP3 mới vào truyện' },
                    { method: 'DELETE', badge: 'bg-rose-500/20 text-rose-300', path: '/api/tracks/:id', desc: 'Xóa truyện theo ID (Tự động xóa luôn file .mp3 trong uploads/audio/)' }
                  ].map((ep, i) => (
                    <div key={i} className="p-2.5 flex items-center justify-between gap-2 hover:bg-slate-900/50">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold w-14 text-center shrink-0 ${ep.badge}`}>
                          {ep.method}
                        </span>
                        <code className="font-mono text-slate-200 truncate select-all">{ep.path}</code>
                      </div>
                      <span className="text-[11px] text-slate-400 hidden sm:inline shrink-0">{ep.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: API Key Security Configuration (Saved on Server) */}
            <div className="lg:col-span-5 p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Lock size={16} className="text-amber-400" />
                    <span>Bảo Mật Cổng API (API Key Server)</span>
                  </h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    settingsForm.requireApiKey
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}>
                    {settingsForm.requireApiKey ? 'Đang bật khóa bảo mật' : 'Mở tự do (Không cần Key)'}
                  </span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  Nếu bật <strong className="text-slate-200">Yêu cầu API Key</strong>, các lệnh Đăng / Sửa / Xóa / Upload từ bên ngoài chỉ cần truyền khóa qua 1 trong 3 cách: Header <code className="text-amber-300 font-mono">x-api-key</code>, Header <code className="text-amber-300 font-mono">Authorization: Bearer &lt;KEY&gt;</code>, hoặc trường <code className="text-amber-300 font-mono">"api_key"</code> trong Body/Query.
                </p>

                {/* Toggle requireApiKey */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-white block">Bắt buộc xác thực API Key khi Đăng/Sửa/Xóa</span>
                    <span className="text-[11px] text-slate-400">Chống người lạ gọi API xóa hoặc sửa truyện trái phép</span>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const nextVal = !settingsForm.requireApiKey;
                      const updated = { ...settingsForm, requireApiKey: nextVal };
                      setSettingsForm(updated);
                      const saved = await saveSiteSettings(updated);
                      setSettingsForm(saved);
                      onUpdateSiteSettings(saved);
                      setSettingsSaveMsg(nextVal ? 'Đã bật khóa bảo mật API Key trên Server!' : 'Đã mở tự do cổng API (không cần Key)!');
                      setTimeout(() => setSettingsSaveMsg(null), 3000);
                    }}
                    className={`w-12 h-6 rounded-full transition-colors relative shrink-0 cursor-pointer ${
                      settingsForm.requireApiKey ? 'bg-amber-400' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full bg-slate-950 absolute top-1 transition-transform ${
                        settingsForm.requireApiKey ? 'left-7' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                {/* API Key Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Mã API Key Bí Mật (<code className="text-amber-300 font-mono">x-api-key</code>):
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={settingsForm.apiKey || ''}
                      onChange={(e) => setSettingsForm(prev => ({ ...prev, apiKey: e.target.value }))}
                      placeholder="Nhập mã API Key bảo mật..."
                      className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-amber-300 font-mono focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const randomKey = 'goiom_sk_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36).slice(-4);
                        const updated = { ...settingsForm, apiKey: randomKey };
                        setSettingsForm(updated);
                        const saved = await saveSiteSettings(updated);
                        setSettingsForm(saved);
                        onUpdateSiteSettings(saved);
                        setSettingsSaveMsg('Đã tạo và lưu mã API Key mới trên Server!');
                        setTimeout(() => setSettingsSaveMsg(null), 3000);
                      }}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 shrink-0 cursor-pointer"
                      title="Tạo mã ngẫu nhiên mới"
                    >
                      Tạo Key Mới
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyText(settingsForm.apiKey || '', 'api-key-val')}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold border border-slate-700 shrink-0 cursor-pointer flex items-center gap-1"
                    >
                      {apiCopiedKey === 'api-key-val' ? <Check size={13} /> : <Copy size={13} />}
                      <span>Copy</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
                {settingsSaveMsg ? (
                  <span className="text-xs text-emerald-400 font-medium">{settingsSaveMsg}</span>
                ) : (
                  <span className="text-[11px] text-slate-400">Lưu cấu hình API Key trực tiếp vào Server</span>
                )}
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  disabled={isSavingSettings}
                  className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold transition cursor-pointer shrink-0 shadow-md shadow-amber-500/20"
                >
                  {isSavingSettings ? 'Đang lưu...' : 'Lưu Cấu Hình API'}
                </button>
              </div>
            </div>
          </div>

          {/* Section 1.5: Cấu Trúc Thư Mục Vật Lý Trên Server (Chỉ có uploads/, không có download/) & Chi Tiết Cổng API */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Cấu trúc thư mục lưu trữ trên Server */}
            <div className="lg:col-span-5 p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <HardDrive size={16} className="text-emerald-400" />
                  <span>Cấu Trúc Thư Mục Lưu Trữ Trên Server (<code className="text-amber-300 font-mono">server-db.ts</code>)</span>
                </h3>
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                  Chuẩn Đồng Bộ 100%
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 leading-relaxed">
                <strong>Lưu ý quan trọng:</strong> Trên hệ thống <strong>hoàn toàn không có thư mục <code className="font-mono text-white">download</code> (hay <code className="font-mono text-white">downloads</code>)</strong>. Khi khởi chạy, Server tự động kiểm tra và tạo đúng <strong>3 thư mục gốc</strong> tại thư mục dự án:
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="font-bold text-emerald-400 font-mono flex items-center justify-between">
                    <span>1. uploads/ (Thư mục chứa file tải lên & phát ra ngoài)</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">Public Static</span>
                  </div>
                  <ul className="space-y-1 text-slate-300 pl-3 list-disc">
                    <li>
                      <code className="text-amber-300 font-mono">uploads/audio/</code>: Chứa toàn bộ file <code className="text-white font-mono">.mp3</code>. Khi upload, file tự động đổi tên chuẩn SEO không dấu (<code className="text-emerald-300 font-mono">ten-truyen-ten-tap.mp3</code>).
                    </li>
                    <li>
                      <code className="text-amber-300 font-mono">uploads/images/</code>: Chứa file ảnh bìa, banner, icon tải lên.
                    </li>
                  </ul>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <div className="font-bold text-amber-300 font-mono">2. data/</div>
                  <p className="text-slate-300">
                    <code className="text-amber-300 font-mono">data/db.json</code>: Cơ sở dữ liệu chính lưu danh sách truyện, tập truyện, cấu hình web, tài khoản admin, affiliate và khóa API.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <div className="font-bold text-sky-300 font-mono">3. backups/</div>
                  <p className="text-slate-300">
                    Chứa các bản sao lưu tự động và thủ công (<code className="text-sky-300 font-mono">snapshot .json</code>) trên máy chủ.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
                <strong className="text-slate-200">Lưu ý trên VPS / Nginx (<code className="font-mono text-amber-300">nginx.conf</code>):</strong> Bạn chỉ cần trỏ duy nhất <code className="font-mono text-emerald-300">location /uploads/</code> về đúng thư mục <code className="font-mono text-emerald-300">/đường_dẫn_code/uploads/;</code> và <code className="font-mono text-emerald-300">location ^~ /api/</code> vào <code className="font-mono text-emerald-300">http://127.0.0.1:3000</code>, hoàn toàn không cần tạo hay cấu hình bất kỳ thư mục <code className="font-mono text-rose-300">download</code> nào.
              </div>
            </div>

            {/* Right: Bảng tổng hợp chi tiết cấu hình API Upload, Streaming & Gateway */}
            <div className="lg:col-span-7 p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Zap size={16} className="text-amber-400" />
                  <span>Bảng Chi Tiết Cấu Hình Các Cổng API (<code className="text-amber-300 font-mono">server.ts</code>)</span>
                </h3>
              </div>

              {/* A. Bảng API Upload */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-amber-300 block">
                  A. API Upload File (Lưu thẳng vào thư mục <code className="font-mono">uploads/</code>):
                </span>
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="p-2.5">Chức năng</th>
                        <th className="p-2.5">Endpoint</th>
                        <th className="p-2.5">Trường (form-data)</th>
                        <th className="p-2.5">Giới hạn</th>
                        <th className="p-2.5">Đường dẫn trả về (url)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70 text-slate-300">
                      <tr>
                        <td className="p-2.5 font-semibold text-white">Upload Audio MP3</td>
                        <td className="p-2.5 font-mono text-emerald-300">POST /api/upload-audio</td>
                        <td className="p-2.5 font-mono text-amber-300">audio <span className="text-slate-400 font-sans text-[10px]">(hoặc file, mp3 + storyTitle, chapterTitle)</span></td>
                        <td className="p-2.5 font-mono">150 MB</td>
                        <td className="p-2.5 font-mono text-emerald-300">/uploads/audio/&lt;slug&gt;.mp3 <span className="text-slate-400 font-sans text-[10px]">(+ duration ffprobe)</span></td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-semibold text-white">Upload Hình ảnh</td>
                        <td className="p-2.5 font-mono text-cyan-300">POST /api/upload-image</td>
                        <td className="p-2.5 font-mono text-amber-300">image <span className="text-slate-400 font-sans text-[10px]">(hoặc file, thumb, cover)</span></td>
                        <td className="p-2.5 font-mono">20 MB</td>
                        <td className="p-2.5 font-mono text-cyan-300">/uploads/images/&lt;slug&gt;.&lt;ext&gt;</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* B. Các hành động (action) trong Cổng Gateway 1-Port */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-amber-300 block">
                  B. Các hành động (<code className="font-mono">action</code>) hỗ trợ tại Cổng 1-Port <code className="font-mono text-emerald-300">POST /api/gateway</code>:
                </span>
                <p className="text-[11px] text-slate-400">
                  Hỗ trợ <code className="font-mono text-slate-200">JSON</code>, <code className="font-mono text-slate-200">form-urlencoded</code> &amp; <code className="font-mono text-slate-200">multipart/form-data</code>. Nhận diện truyện thông minh theo <code className="font-mono text-amber-300">id</code>, <code className="font-mono text-amber-300">slug</code> hoặc <code className="font-mono text-amber-300">title</code>.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {[
                    { act: 'list', alias: '', desc: 'Lấy danh sách toàn bộ truyện' },
                    { act: 'get', alias: '', desc: 'Lấy chi tiết 1 truyện theo id / slug / tên truyện' },
                    { act: 'create', alias: 'dang', desc: 'Đăng truyện mới (kèm mảng chapters hoặc mp3_url / audio_url)' },
                    { act: 'update', alias: 'sua', desc: 'Cập nhật thông tin truyện / danh sách tập' },
                    { act: 'add_chapter', alias: 'them_tap', desc: 'Thêm tập mới vào bộ truyện đã có (id, title, mp3_url / audio_url, duration)' },
                    { act: 'delete_chapter', alias: 'xoa_tap', desc: 'Xóa 1 tập trong truyện (theo chapter_id hoặc chapter_index)' },
                    { act: 'delete', alias: 'xoa', desc: 'Xóa truyện & tự động dọn luôn file .mp3 trong uploads/audio/' }
                  ].map((item, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <code className="font-mono font-bold text-emerald-300">"{item.act}"</code>
                        {item.alias && (
                          <span className="text-[10px] font-mono text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                            hoặc "{item.alias}"
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400">{item.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* C. API Phát & Tua Audio qua Cloudflare */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1 text-xs">
                <span className="font-bold text-amber-300 block">
                  C. Cơ chế Phát & Tua Audio Không Bị Nhảy Về 0:00 (Streaming & Byte-Range):
                </span>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  • <strong>Phát chuẩn:</strong> <code className="font-mono text-emerald-300">GET /uploads/audio/:filename</code> (Hỗ trợ <code className="font-mono">HTTP 206 Partial Content</code>, <code className="font-mono">Accept-Ranges: bytes</code>).<br />
                  • <strong>Cắt luồng khi tua qua Cloudflare:</strong> <code className="font-mono text-emerald-300">GET /api/stream-audio?src=/uploads/audio/:filename&amp;t=&lt;giây&gt;&amp;dur=&lt;tổng_thời_lượng&gt;</code> — Nếu người nghe kéo tua đến giây <code className="font-mono text-amber-300">t</code> khi file chưa tải xong vào bộ đệm, Server tự động tính vị trí byte và cắt luồng MP3 phát ngay từ điểm đó.
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Interactive Live API Tester & Code Examples */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Ready-to-copy cURL & JSON Payload Documentation */}
            <div className="lg:col-span-6 p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Code2 size={16} className="text-amber-400" />
                  <span>Mẫu Lệnh Gọi API (Copy 1-Click)</span>
                </h3>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { id: 'create', label: '1. Đăng Truyện' },
                    { id: 'update', label: '2. Sửa Truyện' },
                    { id: 'add_chapter', label: '3. Thêm Tập' },
                    { id: 'delete_chapter', label: '4. Xóa Tập' },
                    { id: 'delete', label: '5. Xóa Truyện' },
                    { id: 'upload', label: '6. Upload MP3' },
                    { id: 'upload_image', label: '7. Upload Ảnh' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setApiDocExample(tab.id as any)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        apiDocExample === tab.id
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {(() => {
                const origin = window.location.origin;
                const keyHeader = settingsForm.requireApiKey && settingsForm.apiKey
                  ? ` \\\n  -H "x-api-key: ${settingsForm.apiKey}"`
                  : '';
                const sampleId = tracks[0]?.id || 'track-1';

                let title = '';
                let desc = '';
                let curlCode = '';

                if (apiDocExample === 'create') {
                  title = 'Đăng Truyện Mới (POST /api/gateway)';
                  desc = 'Truyền action: "create" (hoặc "dang") kèm tên truyện, tác giả, thể loại và danh sách các tập MP3:';
                  curlCode = `curl -X POST "${origin}/api/gateway" \\
  -H "Content-Type: application/json"${keyHeader} \\
  -d '{
    "action": "create",
    "title": "Bóng Ma Bên Khung Cửa Sổ",
    "author": "Nguyễn Huy",
    "narrator": "Gối Ôm Audio",
    "category": "Truyện Ma",
    "description": "Truyện ma kinh dị mới nhất...",
    "is_hot": true,
    "chapters": [
      {
        "id": 1,
        "title": "Phần 1: Đêm mưa đầu tiên",
        "mp3_url": "/uploads/audio/bong-ma-ben-khung-cua-so-phan-1.mp3",
        "duration": "45:20"
      },
      {
        "id": 2,
        "title": "Phần 2: Tiếng bước chân trên gác",
        "mp3_url": "/uploads/audio/bong-ma-ben-khung-cua-so-phan-2.mp3",
        "duration": "52:10"
      }
    ]
  }'`;
                } else if (apiDocExample === 'update') {
                  title = 'Sửa Thông Tin Truyện Đang Có (POST /api/gateway)';
                  desc = 'Truyền action: "update" (hoặc "sua"), id của truyện cần sửa, và các trường muốn thay đổi:';
                  curlCode = `curl -X POST "${origin}/api/gateway" \\
  -H "Content-Type: application/json"${keyHeader} \\
  -d '{
    "action": "update",
    "id": "${sampleId}",
    "title": "Tên Truyện Đã Chỉnh Sửa Mới",
    "author": "Tác Giả Mới",
    "category": "Tiên Hiệp",
    "description": "Cập nhật mô tả nội dung truyện...",
    "is_featured": true
  }'`;
                } else if (apiDocExample === 'add_chapter') {
                  title = 'Thêm Tập MP3 Mới Vào Truyện Có Sẵn (POST /api/gateway)';
                  desc = 'Truyền action: "add_chapter" (hoặc "them_tap"), id của truyện, và thông tin tập mới trong trường chapter:';
                  curlCode = `curl -X POST "${origin}/api/gateway" \\
  -H "Content-Type: application/json"${keyHeader} \\
  -d '{
    "action": "add_chapter",
    "id": "${sampleId}",
    "chapter": {
      "title": "Phần Mới: Tập tiếp theo",
      "mp3_url": "/uploads/audio/ten-truyen-phan-moi.mp3",
      "duration": "48:15"
    }
  }'`;
                } else if (apiDocExample === 'delete_chapter') {
                  title = 'Xóa 1 Tập Trong Bộ Truyện (POST /api/gateway)';
                  desc = 'Truyền action: "delete_chapter" (hoặc "xoa_tap"), id truyện, kèm chapter_id (hoặc chapter_index):';
                  curlCode = `curl -X POST "${origin}/api/gateway" \\
  -H "Content-Type: application/json"${keyHeader} \\
  -d '{
    "action": "delete_chapter",
    "id": "${sampleId}",
    "chapter_id": 2
  }'`;
                } else if (apiDocExample === 'delete') {
                  title = 'Xóa Truyện Khỏi Server (POST /api/gateway)';
                  desc = 'Truyền action: "delete" (hoặc "xoa") và id của bộ truyện (tự động xóa luôn các file MP3 của truyện trong uploads/audio/):';
                  curlCode = `curl -X POST "${origin}/api/gateway" \\
  -H "Content-Type: application/json"${keyHeader} \\
  -d '{
    "action": "delete",
    "id": "${sampleId}"
  }'`;
                } else if (apiDocExample === 'upload_image') {
                  title = 'Upload File Hình Ảnh Vào uploads/images/ (POST /api/upload-image)';
                  desc = 'Tải file ảnh bìa/banner (tối đa 20MB) lên Server, nhận lại đường dẫn /uploads/images/<slug>.<ext>:';
                  curlCode = `curl -X POST "${origin}/api/upload-image"${keyHeader} \\
  -F "image=@/duong-dan/anh-bia.jpg"`;
                } else {
                  title = 'Upload File Audio .MP3 Vào uploads/audio/ (POST /api/upload-audio)';
                  desc = 'Tải file .mp3 (tối đa 150MB) lên Server, tự động đổi tên chuẩn SEO và đo thời lượng bằng ffprobe:';
                  curlCode = `curl -X POST "${origin}/api/upload-audio"${keyHeader} \\
  -F "storyTitle=Bóng Ma Bên Khung Cửa Sổ" \\
  -F "chapterTitle=Phần 1" \\
  -F "audio=@/duong-dan/file-truyen-tap-1.mp3"`;
                }

                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-bold text-amber-300">{title}</h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">{desc}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyText(curlCode, 'doc-curl')}
                        className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        {apiCopiedKey === 'doc-curl' ? <Check size={13} /> : <Copy size={13} />}
                        <span>{apiCopiedKey === 'doc-curl' ? 'Đã Copy!' : 'Copy Lệnh'}</span>
                      </button>
                    </div>

                    <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto leading-relaxed">
                      {curlCode}
                    </pre>
                  </div>
                );
              })()}
            </div>

            {/* Right: Live API Gateway Tester in Browser */}
            <div className="lg:col-span-6 p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <PlayCircle size={16} className="text-amber-400" />
                  <span>Trình Test Cổng API Trực Tiếp (/api/gateway)</span>
                </h3>
                <span className="text-[11px] text-slate-400">
                  Chạy thật trực tiếp trên Database Server
                </span>
              </div>

              {/* Action Template Selector & Target Story Picker */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                    Chọn tác vụ mẫu để nạp JSON:
                  </label>
                  <select
                    value={apiPlaygroundAction}
                    onChange={(e) => handleSwitchPlaygroundTemplate(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="create">➕ Đăng truyện mới (action: create / dang)</option>
                    <option value="update">✏️ Sửa truyện đang có (action: update / sua)</option>
                    <option value="add_chapter">🎵 Thêm tập mới vào truyện (action: add_chapter / them_tap)</option>
                    <option value="delete_chapter">✂️ Xóa 1 tập trong truyện (action: delete_chapter / xoa_tap)</option>
                    <option value="delete">🗑️ Xóa truyện theo ID (action: delete / xoa)</option>
                    <option value="get">🔍 Xem chi tiết 1 truyện (action: get)</option>
                    <option value="list">📋 Lấy danh sách truyện (action: list)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                    Chọn nhanh truyện để lấy ID (khi Sửa/Thêm tập/Xóa):
                  </label>
                  <select
                    value={apiPlaygroundTargetId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setApiPlaygroundTargetId(nextId);
                      handleSwitchPlaygroundTemplate(apiPlaygroundAction, nextId);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-amber-300 focus:outline-none focus:border-amber-400"
                  >
                    {tracks.map(t => (
                      <option key={t.id} value={t.id}>
                        [{t.id}] {t.title} ({t.chapters?.length || 1} tập)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* JSON Body Editor */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Nội dung JSON gửi tới <code className="text-amber-300 font-mono">POST /api/gateway</code>:</span>
                  <button
                    type="button"
                    onClick={() => handleCopyText(apiPlaygroundBody, 'pg-body')}
                    className="text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {apiCopiedKey === 'pg-body' ? <Check size={11} /> : <Copy size={11} />}
                    <span>Copy JSON</span>
                  </button>
                </div>
                <textarea
                  rows={9}
                  value={apiPlaygroundBody}
                  onChange={(e) => setApiPlaygroundBody(e.target.value)}
                  className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-700 font-mono text-xs text-amber-200 focus:outline-none focus:border-amber-400 leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={handleRunApiPlayground}
                  disabled={apiPlaygroundLoading}
                  className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-lg shadow-amber-500/20"
                >
                  <Zap size={15} />
                  <span>{apiPlaygroundLoading ? 'Đang gửi lệnh tới Server...' : 'Gửi Lệnh Tới Cổng API (/api/gateway)'}</span>
                </button>
              </div>

              {/* Live Response Box */}
              {apiPlaygroundResponse && (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-xs">
                    <span className={`font-bold flex items-center gap-1.5 ${
                      apiPlaygroundResponse.status >= 200 && apiPlaygroundResponse.status < 300
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${
                        apiPlaygroundResponse.status >= 200 && apiPlaygroundResponse.status < 300
                          ? 'bg-emerald-400'
                          : 'bg-rose-400'
                      }`} />
                      <span>HTTP {apiPlaygroundResponse.status}</span>
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {apiPlaygroundResponse.timeMs} ms
                    </span>
                  </div>
                  <pre className="font-mono text-xs text-slate-200 overflow-x-auto max-h-60 leading-relaxed">
                    {JSON.stringify(apiPlaygroundResponse.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Universal In-App Confirmation Modal (Bypasses iframe alert/confirm blocking) */}
      {confirmModal && confirmModal.isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                confirmModal.isDestructive 
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}>
                <AlertTriangle size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-base font-bold text-white leading-tight">
                  {confirmModal.title}
                </h4>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed whitespace-pre-line">
                  {confirmModal.message}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              >
                {confirmModal.cancelLabel || 'Hủy Bỏ'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const callback = confirmModal.onConfirm;
                  setConfirmModal(null);
                  callback();
                }}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-md ${
                  confirmModal.isDestructive
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                    : 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-amber-500/20'
                }`}
              >
                {confirmModal.confirmLabel || 'Xác Nhận'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
