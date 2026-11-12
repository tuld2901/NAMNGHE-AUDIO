# NAMNGHE-AUDIO (Gối Ôm Audio CMS) — Hướng Dẫn Cài Đặt & Vận Hành

Hệ thống Web Nghe Truyện Audio Online & Quản trị CMS (Node.js, Express, React, Tailwind CSS) đã tối ưu chịu tải cao cho hàng nghìn người nghe cùng lúc.

---

## 1. Cài Đặt Nhanh Trên VPS (Ubuntu / Debian)

```bash
# 1. Cài đặt Node.js 20 LTS, Nginx, Git, FFmpeg và PM2
sudo apt update && sudo apt install -y curl git nginx build-essential ffmpeg
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2

# 2. Tải mã nguồn & Tạo 3 thư mục lưu trữ bắt buộc
git clone https://github.com/tuld2901/NAMNGHE-AUDIO.git /root/NAMNGHE-AUDIO
cd /root/NAMNGHE-AUDIO
mkdir -p data uploads/audio uploads/images backups
chmod 755 /root 2>/dev/null || true
chmod -R 777 data uploads backups

# 3. Cài đặt thư viện & Build giao diện Production
npm install --legacy-peer-deps
npm run build

# 4. Chạy dịch vụ ngầm 24/7 với PM2
pm2 start npm --name "namnghe-cms" -- start
pm2 save
pm2 startup
```

* **Lệnh quản lý PM2**: `pm2 status` | `pm2 logs namnghe-cms` | `pm2 restart namnghe-cms`
* **Cấu trúc thư mục dữ liệu**:
  * `data/db.json`: Lưu toàn bộ truyện, tập truyện, cấu hình web, tài khoản admin, link affiliate.
  * `uploads/audio/`: Lưu toàn bộ file `.mp3` (tự động chuẩn hóa tên file theo slug không dấu).
  * `uploads/images/`: Lưu ảnh bìa, logo, banner, favicon.
  * `backups/`: Lưu các bản sao lưu `.json` snapshot.

---

## 2. Cấu Hình Nginx Chịu Tải Cao (Đọc Phát Audio Trực Tiếp & Chống Nghẽn Băng Thông)

Trên giao diện web, thẻ `<audio preload="metadata">` đã được cấu hình để trình duyệt **chỉ tải vài KB đầu tiên** lấy số phút (không tải trước cả file 50MB). Khi người dùng bấm nghe hoặc kéo tua tới đâu, **Nginx trực tiếp cắt từng khúc nhỏ (`512KB`) từ ổ cứng gửi tới đó** mà không đi qua Node.js.

Copy file cấu hình mẫu hoặc dán trực tiếp vào `/etc/nginx/sites-available/namnghe-cms`:

```bash
sudo cp /root/NAMNGHE-AUDIO/nginx.conf /etc/nginx/sites-available/namnghe-cms
```

Nội dung chuẩn của `/etc/nginx/sites-available/namnghe-cms`:

```nginx
# 1. Giới hạn đăng nhập Admin tối đa 5 lần / 1 phút theo IP
limit_req_zone $binary_remote_addr zone=admin_login_limit:10m rate=5r/m;

# 2. Pool kết nối Keep-Alive bền vững tới Node.js Port 3000
upstream audio_node_backend {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com www.your-domain.com; # Đổi thành tên miền của bạn

    # Cho phép upload MP3 & Backup lớn (tới 250MB)
    client_max_body_size 250M;
    client_body_timeout 600s;
    client_header_timeout 600s;
    keepalive_timeout 65s;
    keepalive_requests 10000;
    large_client_header_buffers 4 32k;

    # Cache File Descriptor trong RAM giúp hàng nghìn người mở cùng 1 file MP3 không phải quét lại đĩa
    open_file_cache max=5000 inactive=60s;
    open_file_cache_valid 120s;
    open_file_cache_min_uses 2;
    open_file_cache_errors on;

    # Nén Gzip cho HTML/CSS/JS/JSON (Tuyệt đối KHÔNG nén file MP3)
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml application/json application/javascript application/rss+xml font/woff2 image/svg+xml;

    # A. GIAO HOÀN TOÀN VIỆC ĐỌC, PHÁT & TUA AUDIO CHO NGINX (/uploads/)
    location ^~ /uploads/ {
        alias /root/NAMNGHE-AUDIO/uploads/; # Đổi đúng đường dẫn thư mục uploads trên VPS

        # Đọc file trực tiếp từ nhân Linux (Zero-Copy + Đa luồng bất đồng bộ)
        sendfile on;
        sendfile_max_chunk 512k; # Cắt từng khúc 512KB để tránh 1 người chiếm hết băng thông
        tcp_nopush on;
        tcp_nodelay on;
        aio threads;
        directio 4m;             # File > 4MB đọc thẳng Direct I/O, không làm tràn RAM VPS
        output_buffers 2 1m;

        # Hỗ trợ tua nhanh (HTTP 206 Partial Content / Byte-Range)
        add_header Accept-Ranges bytes always;
        add_header Cache-Control "public, max-age=2592000, immutable, no-transform" always;
        add_header Access-Control-Allow-Origin * always;
        add_header Access-Control-Allow-Methods "GET, HEAD, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Range, Origin, Content-Type, Accept" always;
        add_header Access-Control-Expose-Headers "Content-Range, Content-Length, Accept-Ranges" always;
        expires 30d;
        access_log off;

        location ~* \.(php|pl|py|jsp|asp|sh|cgi)$ {
            deny all;
        }
    }

    # B. GIỚI HẠN 5 LẦN LOGIN / 1 PHÚT CHO TRANG QUẢN TRỊ (/app-config)
    location = /api/admin/login {
        limit_req zone=admin_login_limit burst=4 nodelay;
        limit_req_status 429;
        error_page 429 = @login_rate_limited;

        proxy_pass http://audio_node_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location @login_rate_limited {
        default_type application/json;
        return 429 '{"success":false,"error":"Bạn đã thử đăng nhập quá 5 lần trong 1 phút. Vui lòng đợi 1 phút rồi thử lại!"}';
    }

    # C. CỔNG API ĐỘNG (/api/bootstrap, /api/gateway, /api/tracks, /api/upload-audio)
    location ^~ /api/ {
        proxy_pass http://audio_node_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header Range $http_range;
        proxy_set_header If-Range $http_if_range;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        client_max_body_size 250M;
        gzip off;
        proxy_buffering off;
        proxy_request_buffering off;
        proxy_cache off;
        proxy_connect_timeout 600s;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
    }

    # D. GIAO DIỆN WEB & SEO SSR (NODE.JS PORT 3000)
    location / {
        proxy_pass http://audio_node_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
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

Kích hoạt Nginx & Cài đặt SSL miễn phí (HTTPS):
```bash
sudo ln -sf /etc/nginx/sites-available/namnghe-cms /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# Cài SSL Let's Encrypt
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

---

## 3. Quản Trị CMS (`/app-config`) & Bảo Mật 2 Lớp (2FA)

* **Đường dẫn Quản trị bí mật**: `https://your-domain.com/app-config` (Mọi truy cập vào `/admin` hoặc `/quan-tri` tự động đẩy về trang chủ `/`).
* **Tài khoản mặc định**:
  * **Email / Username**: `tuld2901@gmail.com` (hoặc `admin`)
  * **Mật khẩu**: `admin123`
* **Google Authenticator (2FA)**: Vào **Quản trị -> Tài Khoản Quản Trị** -> Nhấn **Bật Google Authenticator** -> Quét mã QR bằng điện thoại và nhập 6 số xác nhận.

---

## 4. Cổng API Gateway Tự Động Hóa (`POST /api/gateway`)

Hỗ trợ `application/json`, `multipart/form-data` cho n8n, Make, Python, cURL. Khi bật bảo mật API Key trong Admin, truyền header `x-api-key: <MÃ_KEY>`.

* **Upload Audio MP3 (`<= 150MB`)**: `POST /api/upload-audio` (trường `audio`, trả về `url: "/uploads/audio/<slug>.mp3"` và `duration`).
* **Upload Ảnh (`<= 20MB`)**: `POST /api/upload-image` (trường `image`, trả về `url: "/uploads/images/<slug>.<ext>"`).
* **Đăng / Sửa / Xóa Truyện qua Gateway (`POST /api/gateway`)**:
  * `action: "create"` (hoặc `"dang"`): Đăng truyện mới -> trả về `"id": "track-..."` để lưu lại dùng cho cập nhật/thêm tập.
  * `action: "update"` (hoặc `"sua"`): Cập nhật truyện theo `id` (hoặc slug / tên truyện).
  * `action: "add_chapter"` (hoặc `"them_tap"`): Thêm tập mới vào truyện.
  * `action: "delete_chapter"` (hoặc `"xoa_tap"`): Xóa tập trong truyện.
  * `action: "delete"` (hoặc `"xoa"`): Xóa truyện (tự động xóa luôn file MP3 và ảnh bìa không còn dùng trong `uploads/`).
