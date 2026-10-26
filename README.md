# NAMNGHECMS - Installation Guide

A modern Audio Story CMS & Streaming Web Application powered by Node.js, Express, React, and Tailwind CSS.

---

## 1. Prerequisites

- **Node.js**: v18.x or v20.x LTS (Recommended: Node.js 20 LTS)
- **NPM**: v9+ or v10+
- **Git**
- **FFmpeg & FFprobe**: (Recommended) Tự động đo thời lượng chính xác từng giây khi upload MP3:
  - **Ubuntu / Debian**:
    ```bash
    sudo apt update && sudo apt install -y ffmpeg
    ```
  - **CentOS / AlmaLinux / Rocky Linux**:
    ```bash
    sudo dnf install -y epel-release && sudo dnf install -y ffmpeg
    ```
- **Default Port**: `3000` (configurable via `PORT` environment variable)

Check your environment:
```bash
node -v
npm -v
git --version
ffprobe -version
```

---

## 2. Quick Start & Installation

### Step 1: Clone Repository
```bash
git clone https://github.com/tuld2901/NAMNGHE-AUDIO.git
cd NAMNGHE-AUDIO
```

### Step 2: Create Required Directories

The backend stores database files, uploaded audio, and backups locally. You **must create** the following directory structure inside the project root:

| Directory Path | Description |
| :--- | :--- |
| `data/` | Stores the primary JSON database (`db.json`) containing stories, chapters, and settings. |
| `uploads/audio/` | Stores all uploaded MP3 audio files (named by slug, e.g., `tap-1-ten-tap.mp3`). |
| `uploads/images/` | Stores uploaded custom logos, banner graphics, and favicons. |
| `backups/` | Stores automated system snapshots, manual `.json` exports, and `.tar.gz` archives. |

Run these commands to create all required directories and set read/write permissions:
```bash
# 1. Create all required folders at once
mkdir -p data uploads/audio uploads/images backups

# 2. Grant full read/write permissions for Node.js and Nginx
chmod 755 /root 2>/dev/null || true
chmod -R 777 data uploads backups
```

### Step 3: Install Dependencies & Build
```bash
# MUST use --legacy-peer-deps to avoid React 19 peer dependency resolution conflicts:
npm install --legacy-peer-deps
npm run build
```

*(If you ever encounter an `edgesOut` or npm lock conflict, run: `rm -rf package-lock.json node_modules && npm cache clean --force && npm install --legacy-peer-deps`)*

---

## 3. Running the Application

### Development Mode
```bash
npm run dev
```
- App URL: `http://localhost:3000`
- Admin CMS URL: `http://localhost:3000/admin`

### Production Mode (Standard Node.js)
```bash
npm start
```

### Production Mode with PM2 (24/7 Background Service)
```bash
# 1. Install PM2 globally
sudo npm install -g pm2

# 2. Start application
pm2 start npm --name "namnghe-cms" -- start

# 3. Save process list & enable auto-start on server reboot
pm2 save
pm2 startup
```

Useful PM2 commands:
```bash
pm2 status                # Check status
pm2 logs namnghe-cms      # View real-time logs
pm2 restart namnghe-cms   # Restart application
pm2 stop namnghe-cms      # Stop application
```

---

## 4. Nginx Reverse Proxy Configuration (Production)

Create file `/etc/nginx/sites-available/namnghe-cms` (or simply copy the included `nginx.conf` template):
```bash
sudo cp /root/NAMNGHE-AUDIO/nginx.conf /etc/nginx/sites-available/namnghe-cms
```

Full configuration content:
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com www.your-domain.com;

    # Allow large MP3 & backup file uploads (up to 250MB)
    client_max_body_size 250M;
    client_body_timeout 600s;
    client_header_timeout 600s;
    large_client_header_buffers 4 32k;

    # Gzip: Compress text/code (NEVER compress audio/MP3)
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/rss+xml font/woff2 image/svg+xml;

    # Serve static audio & image uploads directly (fast progressive streaming: load đến đâu nghe đến đó)
    location /uploads/ {
        alias /root/NAMNGHE-AUDIO/uploads/;
        expires 30d;
        add_header Accept-Ranges bytes always;
        add_header Cache-Control "public, max-age=2592000, immutable" always;
        client_max_body_size 250M;

        # Linux direct chunk transmission (1MB chunks)
        sendfile on;
        sendfile_max_chunk 1m;
        tcp_nopush on;
        tcp_nodelay on;

        # Disable buffering so first chunk plays immediately
        proxy_buffering off;
        proxy_request_buffering off;

        location ~* \.(php|pl|py|jsp|asp|sh|cgi)$ {
            deny all;
        }
    }

    # Proxy all clean routes & APIs into Node.js (Port 3000)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
    }
}
```

Enable site and restart Nginx:
```bash
sudo ln -sf /etc/nginx/sites-available/namnghe-cms /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
```

---

### Cloudflare CDN Recommendation (If using Cloudflare Proxy)
If your domain is proxied through Cloudflare (orange cloud):
1. **Cache Rule**: In Cloudflare -> **Caching** -> **Cache Rules**, create a rule for `*your-domain.com/uploads/*` with **Cache Everything** and **Edge TTL = 1 month**. This caches audio chunks at Cloudflare edge nodes in Vietnam (VNPT, Viettel) so playback starts under 100ms.
2. **Range Requests**: Cloudflare automatically respects `Accept-Ranges: bytes` and HTTP 206 delivered by Node.js.

Free SSL (HTTPS) with Certbot:
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

---

## 5. Admin CMS Credentials

The login button is hidden from public view for security. Access directly:

- **CMS URL**: `https://your-domain.com/admin` (or `http://localhost:3000/admin`)
- **Email / Username**: `tuld2901@gmail.com` (or `admin`)
- **Password**: `admin123`

*(You can update or delete this account anytime inside Admin CMS -> Admin Accounts tab).*

---

## 6. Cấu Trúc Thư Mục Lưu Trữ & Cấu Hình Cổng API (`server-db.ts` & `server.ts`)

### 6.1. Cấu trúc thư mục lưu trữ trên Server (`server-db.ts`)
> **Lưu ý quan trọng:** Trên hệ thống **hoàn toàn không có thư mục `download` (hay `downloads`)**. Khi khởi chạy, Server tự động kiểm tra và tạo đúng **3 thư mục gốc** tại thư mục dự án:

1. **`uploads/`** *(Thư mục chứa toàn bộ file tải lên và phát ra ngoài)*:
   - `uploads/audio/`: Chứa toàn bộ file `.mp3`. Khi upload, file tự động được đổi tên chuẩn SEO không dấu (`ten-truyen-ten-tap.mp3`).
   - `uploads/images/`: Chứa file ảnh bìa, banner, icon tải lên.
2. **`data/`**:
   - `data/db.json`: Cơ sở dữ liệu chính lưu danh sách truyện, tập truyện, cấu hình web, tài khoản admin, affiliate và khóa API.
3. **`backups/`**:
   - Chứa các bản sao lưu tự động và thủ công (snapshot `.json`) trên máy chủ.

---

### 6.2. Kiểm tra cấu hình các cổng API (`server.ts`)

#### A. API Upload File (Lưu thẳng vào `uploads/`)
| Chức năng | Phương thức & Đường dẫn | Tên trường (`form-data`) | Giới hạn | Đường dẫn trả về (`url`) |
| :--- | :--- | :--- | :--- | :--- |
| **Upload Audio MP3** | `POST /api/upload-audio` | `audio` (kèm tùy chọn `storyTitle`, `chapterTitle`) | 150 MB | `/uploads/audio/<slug>.mp3` (kèm `duration` đo tự động bằng `ffprobe`) |
| **Upload Hình ảnh** | `POST /api/upload-image` | `image` | 20 MB | `/uploads/images/<slug>.<ext>` |

#### B. API Phát & Tua Audio (Streaming & Byte-Range)
- **Đường dẫn tĩnh chuẩn**: `GET /uploads/audio/:filename` (Hỗ trợ `HTTP 206 Partial Content`, `Accept-Ranges: bytes`).
- **Đường dẫn Cắt luồng khi tua qua Cloudflare**: `GET /api/stream-audio?src=/uploads/audio/:filename&t=<giây>&dur=<tổng_thời_lượng>`
  - Nếu người dùng kéo tua đến giây `t` khi file chưa tải xong, Server tự động tính vị trí byte và cắt luồng MP3 phát ngay từ điểm đó mà không bị nhảy về `0:00`.

#### C. Cổng API Gateway 1-Port Đa Năng (Dành cho Tool / Auto Post / n8n / Make)
- **Endpoint chính**: `POST /api/gateway` *(Bí danh tương thích: `POST /api/v1/stories/gateway` hoặc `GET /api/gateway`)*
- **Các hành động (`action`) hỗ trợ**:
  - `list`: Lấy danh sách toàn bộ truyện.
  - `get`: Lấy chi tiết 1 truyện theo `id`.
  - `create` (hoặc `dang`): Đăng truyện mới (hỗ trợ truyền mảng `chapters` hoặc `audio_url` tập đầu).
  - `update` (hoặc `sua`): Cập nhật thông tin truyện / danh sách tập.
  - `add_chapter` (hoặc `them_tap`): Thêm tập mới vào bộ truyện đã có (`id`, `title`, `mp3_url`/`audio_url`, `duration`).
  - `delete_chapter` (hoặc `xoa_tap`): Xóa 1 tập trong truyện.
  - `delete` (hoặc `xoa`): Xóa truyện (tự động dọn luôn các file `.mp3` của truyện đó trong `uploads/audio/`).

#### D. API RESTful Quản lý Truyện
- `GET /api/tracks` (hoặc `/api/v1/stories`): Lấy danh sách truyện.
- `POST /api/tracks`: Tạo truyện mới.
- `PUT /api/tracks/:id` hoặc `PATCH /api/tracks/:id`: Sửa truyện.
- `POST /api/tracks/:id/chapters`: Thêm tập mới vào truyện.
- `DELETE /api/tracks/:id`: Xóa truyện.

#### E. Bảo mật Khóa API (`API Key`)
- Quản lý trực tiếp trong **Admin -> Cổng API Truyện (Đăng/Sửa/Xóa)**.
- Khi bật **Yêu cầu API Key**, các lệnh thêm/sửa/xóa/upload từ bên ngoài chỉ cần truyền khóa qua 1 trong 3 cách:
  1. Header: `x-api-key: <MÃ_KEY>`
  2. Header: `Authorization: Bearer <MÃ_KEY>`
  3. Body / Query: `"api_key": "<MÃ_KEY>"`

#### F. Lưu ý trên VPS / Nginx (`nginx.conf`)
- Trong file `nginx.conf` trên VPS, bạn chỉ cần trỏ duy nhất `location /uploads/` về đúng thư mục `/đường_dẫn_code/uploads/;` (hoặc để Node.js tự phục vụ trực tiếp qua Reverse Proxy cổng `3000`), không cần tạo hay cấu hình bất kỳ thư mục `download` nào.

