# HƯỚNG DẪN CÀI ĐẶT CHI TIẾT TRÊN HOSTING, VPS & CẤU HÌNH PM2 TOÀN HỆ THỐNG

Tài liệu hướng dẫn từng bước triển khai mã nguồn lên **GitHub**, cài đặt **PM2 toàn hệ thống**, và cấu hình chi tiết trên **Shared Hosting (cPanel, DirectAdmin)**, **aaPanel** và **VPS Ubuntu/Debian**.

---

## 1. ĐẨY MÃ NGUỒN LÊN GITHUB

Tại thư mục dự án trên máy tính, mở Terminal / Git Bash và chạy:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<USERNAME>/<REPO_NAME>.git
git push -u origin main
```

---

## 2. CÀI ĐẶT PM2 TOÀN HỆ THỐNG (GLOBAL PM2)

### 2.1. Cài đặt PM2 Global
- **Trên Linux (Ubuntu / Debian / CentOS / AlmaLinux):**
  ```bash
  sudo npm install -g pm2
  ```
- **Trên Windows (Chạy CMD / PowerShell quyền Administrator):**
  ```bash
  npm install -g pm2
  ```

### 2.2. Gắn PM2 vào biến môi trường toàn hệ thống (`/usr/bin`)
Nếu cài Node.js qua **NVM** hoặc **aaPanel**, đôi khi gõ `pm2` ở thư mục khác hoặc qua `sudo` sẽ báo `pm2: command not found`. Chạy lệnh dưới đây để gắn PM2 cho toàn hệ thống:

- **Khi dùng NVM hoặc Node chuẩn:**
  ```bash
  sudo ln -sf $(which node) /usr/bin/node
  sudo ln -sf $(which npm) /usr/bin/npm
  sudo ln -sf $(which pm2) /usr/bin/pm2
  ```
- **Khi dùng aaPanel (Node.js Version Manager):**
  ```bash
  sudo ln -sf /www/server/nodejs/v20*/bin/node /usr/bin/node
  sudo ln -sf /www/server/nodejs/v20*/bin/npm /usr/bin/npm
  sudo ln -sf /www/server/nodejs/v20*/bin/pm2 /usr/bin/pm2
  ```

Kiểm tra lại:
```bash
pm2 -v
```

### 2.3. Khởi chạy ứng dụng & Tự khởi động cùng Server (Auto-Startup)
Tại thư mục gốc của dự án trên Server:

```bash
# 1. Tạo thư mục lưu trữ dữ liệu và file upload
mkdir -p data uploads/audio uploads/images backups
chmod -R 777 data uploads backups

# 2. Cài đặt thư viện (bắt buộc dùng cờ --legacy-peer-deps) và biên dịch giao diện vào thư mục dist/
npm install --legacy-peer-deps
npm run build

# 3. Chạy ứng dụng ngầm 24/7 bằng PM2
pm2 start npm --name "audio-cms" -- start

# 4. Đăng ký dịch vụ tự khởi động khi VPS/Server reboot
pm2 startup
# (Nếu màn hình hiển thị thêm 1 dòng lệnh sudo env PATH=..., hãy copy và chạy dòng đó)

# 5. Lưu trạng thái tiến trình
pm2 save
```

### 2.4. Các lệnh quản lý PM2
- Xem danh sách tiến trình: `pm2 list`
- Xem log hoạt động trực tiếp: `pm2 logs audio-cms`
- Khởi động lại sau khi sửa code / build lại: `pm2 restart audio-cms`
- Tạm dừng ứng dụng: `pm2 stop audio-cms`
- Xóa tiến trình khỏi PM2: `pm2 delete audio-cms`
- Xóa toàn bộ log cũ: `pm2 flush`

---

## 3. HƯỚNG DẪN CÀI ĐẶT CHI TIẾT TRÊN SHARED HOSTING (CPANEL)

Áp dụng cho các gói Hosting cPanel có mục **Setup Node.js App**:

### Bước 3.1: Tải mã nguồn lên Hosting
1. Nén toàn bộ mã nguồn trên máy tính thành file `source.zip` (**không nén** thư mục `node_modules` và `.git`).
2. Đăng nhập **cPanel** -> Mở **File Manager**.
3. Tại thư mục gốc `/home/ten_user/`, tạo thư mục mới tên là `audio-app`.
4. Vào `/home/ten_user/audio-app` -> Nhấn **Upload** để tải `source.zip` lên -> Nhấp chuột phải chọn **Extract** (Giải nén) -> Xóa `source.zip`.

### Bước 3.2: Cấu hình trong "Setup Node.js App"
1. Tại trang chủ **cPanel** -> Mục **Software** -> Mở **Setup Node.js App**.
2. Nhấn **CREATE APPLICATION** và điền:
   - **Node.js version**: `20.x` (hoặc `18.x` trở lên)
   - **Application mode**: `Production`
   - **Application root**: `audio-app`
   - **Application URL**: Chọn tên miền của bạn (`tenmien.com`)
   - **Application startup file**: `server.ts`
3. Nhấn **CREATE** ở góc trên bên phải.

### Bước 3.3: Chạy lệnh cài đặt thư viện & Build trong Terminal cPanel
1. Sau khi tạo xong, copy dòng lệnh kích hoạt môi trường ảo ở đầu trang (có dạng `source /home/ten_user/nodevenv/audio-app/20/bin/activate && cd /home/ten_user/audio-app`).
2. Mở công cụ **Terminal** trên cPanel (hoặc SSH), dán dòng lệnh vừa copy vào rồi chạy tiếp:
   ```bash
   mkdir -p data uploads/audio uploads/images backups
   chmod -R 777 data uploads backups
   npm install --legacy-peer-deps
   npm run build
   ```
3. Quay lại **Setup Node.js App** trên cPanel -> Nhấn nút **RESTART**.

### Bước 3.4: Mở giới hạn dung lượng Upload MP3 trên cPanel
Mở `/home/ten_user/public_html/.htaccess` và đảm bảo cuối file có cấu hình cho phép upload file lớn (150MB):
```apache
LimitRequestBody 157286400
```

---

## 4. HƯỚNG DẪN CÀI ĐẶT CHI TIẾT TRÊN AAPANEL (BAOTA PANEL)

### Bước 4.1: Chuẩn bị môi trường
1. Vào **App Store** trên aaPanel -> Cài đặt **Nginx** và **Node.js Version Manager**.
2. Trong **Node.js Version Manager**, tải **Node.js v20.x LTS** và chọn `Command Line Version` là `v20.x`.
3. Mở **Terminal** của aaPanel, cài PM2 toàn hệ thống:
   ```bash
   npm install -g pm2
   sudo ln -sf /www/server/nodejs/v20*/bin/node /usr/bin/node
   sudo ln -sf /www/server/nodejs/v20*/bin/npm /usr/bin/npm
   sudo ln -sf /www/server/nodejs/v20*/bin/pm2 /usr/bin/pm2
   ```

### Bước 4.2: Upload mã nguồn & Khởi chạy PM2
1. Đưa mã nguồn vào `/www/wwwroot/audio-web` (qua File Manager hoặc `git clone`).
2. Mở Terminal trên aaPanel và chạy:
   ```bash
   cd /www/wwwroot/audio-web
   mkdir -p data uploads/audio uploads/images backups
   chmod -R 777 data uploads backups
   npm install --legacy-peer-deps
   npm run build
   pm2 start npm --name "audio-cms" -- start
   pm2 save
   pm2 startup
   ```

### Bước 4.3: Trỏ tên miền qua Reverse Proxy & Bật HTTPS
1. Vào **Website** -> **PHP Project** -> **Add site** -> Nhập tên miền `tenmien.com` (PHP Version chọn `Pure Static`).
2. Nhấn vào tên miền vừa tạo -> Chọn **Reverse proxy** -> **Add reverse proxy**:
   - **Proxy name**: `audio-node`
   - **Target URL**: `http://127.0.0.1:3000`
3. Vào tab **Config** của tên miền -> Đặt `client_max_body_size 150M;` để upload MP3 dung lượng lớn.
4. Vào tab **SSL** -> **Let's Encrypt** -> Nhấn **Apply** và bật **Force HTTPS**.

---

## 5. HƯỚNG DẪN CÀI ĐẶT TRÊN VPS LINUX THUẦN (UBUNTU / DEBIAN + NGINX)

### Bước 5.1: Cài đặt Node.js 20, Git, Nginx và PM2
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nginx build-essential
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

### Bước 5.2: Tải code, Build và chạy PM2
```bash
sudo mkdir -p /var/www/audio-web
sudo chown -R $USER:$USER /var/www/audio-web
git clone https://github.com/<USERNAME>/<REPO_NAME>.git /var/www/audio-web
cd /var/www/audio-web

mkdir -p data uploads/audio uploads/images backups
chmod -R 777 data uploads backups
npm install --legacy-peer-deps
npm run build

pm2 start npm --name "audio-cms" -- start
pm2 save
pm2 startup
```

### Bước 5.3: Cấu hình Nginx Tối Ưu Toàn Diện (Hoặc dùng trực tiếp file `nginx.conf`)

> 💡 **Cách nhanh nhất:** Bạn có thể copy trực tiếp file cấu hình mẫu đã được tạo sẵn trong dự án:
> ```bash
> sudo cp /root/NAMNGHE-AUDIO/nginx.conf /etc/nginx/sites-available/audio-web
> ```
> Hoặc mở file `/etc/nginx/sites-available/audio-web` và dán cấu hình chuẩn dưới đây:

```nginx
# ==============================================================================
# CẤU HÌNH NGINX CHUẨN CHO DỰ ÁN NAMNGHE-AUDIO (NGHE TRUYỆN AUDIO ONLINE)
# ==============================================================================

server {
    listen 80;
    listen [::]:80;
    server_name tenmien.com www.tenmien.com; # Thay bằng domain của bạn

    # 1. CHO PHÉP UPLOAD FILE MP3 VÀ BACKUP DUNG LƯỢNG LỚN (LÊN TỚI 250MB)
    client_max_body_size 250M;
    client_body_timeout 600s;
    client_header_timeout 600s;
    large_client_header_buffers 4 32k;

    # 2. TỐI ƯU GZIP (Chỉ nén HTML/CSS/JS/JSON - TUYỆT ĐỐI KHÔNG NÉN MP3)
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/rss+xml font/woff2 image/svg+xml;

    # 3. PHỤC VỤ TRỰC TIẾP AUDIO & ẢNH (LOAD ĐẾN ĐÂU NGHE ĐẾN ĐÓ - CHUNK STREAMING)
    location /uploads/ {
        alias /root/NAMNGHE-AUDIO/uploads/; # Đổi thành đường dẫn thư mục uploads thực tế của bạn
        
        # Bật Byte-Range để trình duyệt/điện thoại nhận ngay chunk nhỏ 1.5MB nghe ngay
        add_header Accept-Ranges bytes always;
        add_header Cache-Control "public, max-age=2592000, immutable" always;
        expires 30d;

        # Tối ưu truyền tải file âm thanh từ ổ đĩa Linux ra mạng cực nhanh
        sendfile on;
        sendfile_max_chunk 1m;
        tcp_nopush on;
        tcp_nodelay on;

        # TẮT BUFFERING: Không đợi gom cả file MP3 50MB-100MB mà đẩy ngay data để phát ngay
        proxy_buffering off;
        proxy_request_buffering off;

        # Chặn thực thi mã độc hại trong thư mục uploads
        location ~* \.(php|pl|py|jsp|asp|sh|cgi)$ {
            deny all;
        }
    }

    # 4. CHUYỂN TOÀN BỘ API, GATEWAY VÀ GIAO DIỆN VÀO NODE.JS (PORT 3000)
    # Khắc phục triệt để lỗi: <!doctype html> ... is not valid JSON
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

Kích hoạt Nginx và cài SSL miễn phí:
```bash
sudo ln -sf /etc/nginx/sites-available/audio-web /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx

sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d tenmien.com -d www.tenmien.com
```

---

## 6. CẤU HÌNH CLOUDFLARE (NẾU DÙNG DOMAIN QUA CLOUDFLARE)

Nếu tên miền của bạn bật đám mây cam (Proxy) qua Cloudflare, để audio nghe mượt mà và không bị trễ:

1. **Bật Range Requests (HTTP 206):**
   - Cloudflare mặc định hỗ trợ Range Requests. Node.js backend đã tự động cắt chunk 1.5MB để người nghe nghe được ngay trong <100ms.
2. **Tạo Cache Rule cho thư mục Audio (Khuyên dùng để tiết kiệm băng thông VPS):**
   - Vào Cloudflare Dashboard -> **Caching** -> **Cache Rules** -> **Create Rule**:
     - *Field*: URI Path
     - *Operator*: starts with
     - *Value*: `/uploads/`
     - *Cache eligibility*: Cache Everything
     - *Edge TTL*: 1 month (hoặc 7 days)
   - Kết quả: File audio nghe lần đầu sẽ được Cloudflare lưu tại máy chủ CDN gần nhất ở Việt Nam (VNPT, Viettel, FPT), lần nghe sau tốc độ phát sẽ đạt tối đa ngay tức thì!
3. **Tắt Auto Minify cho HTML/JS** nếu trang web có cập nhật mới chưa kịp xóa cache: Vào **Speed** -> **Optimization** -> kiểm tra cache.

---

## 7. CHECKLIST KIỂM TRA TOÀN BỘ FILE & THƯ MỤC CẦN THIẾT

Trước khi chạy, hãy kiểm tra danh sách file và thư mục đã đủ chưa:

| Đường Dẫn File / Thư Mục | Trạng Thái Bắt Buộc | Tác Dụng |
| :--- | :---: | :--- |
| `data/db.json` | **BẮT BUỘC** | Chứa toàn bộ dữ liệu truyện, tập, link affiliate, cấu hình website. Hệ thống sẽ tự tạo nếu chưa có. |
| `uploads/audio/` | **BẮT BUỘC** | Thư mục lưu toàn bộ file âm thanh MP3 tải lên. |
| `uploads/images/` | **BẮT BUỘC** | Thư mục lưu ảnh bìa, logo, favicon, banner tải lên. |
| `backups/` | **BẮT BUỘC** | Thư mục lưu các bản snapshot backup tự động & thủ công. |
| `dist/` | **BẮT BUỘC** | Thư mục frontend được tạo ra sau khi chạy lệnh `npm run build`. |
| `server.ts` | **BẮT BUỘC** | File server backend Node.js chính (chạy API, streaming audio, SEO SSR). |
| `server-db.ts` | **BẮT BUỘC** | Module quản lý đọc/ghi cơ sở dữ liệu `data/db.json` và snapshot. |
| `package.json` | **BẮT BUỘC** | Danh sách thư viện và scripts (`npm run build`, `npm start`). |
| `tsconfig.json` | **BẮT BUỘC** | Cấu hình TypeScript của toàn bộ dự án. |
| `vite.config.ts` | **BẮT BUỘC** | Cấu hình đóng gói giao diện React + Tailwind CSS. |

### Lệnh tạo nhanh toàn bộ thư mục chỉ với 1 dòng:
```bash
mkdir -p data uploads/audio uploads/images backups
chmod -R 777 data uploads backups
```

---

## 8. LỆNH KIỂM TRA SỨC KHỎE HỆ THỐNG (HEALTH CHECK)

Sau khi cài đặt xong, bạn có thể chạy các lệnh sau để đảm bảo hệ thống hoạt động hoàn hảo:

```bash
# 1. Kiểm tra Node.js có đang lắng nghe trên cổng 3000 không:
ss -tulpn | grep 3000

# 2. Kiểm tra API backend trả về chuẩn JSON (Không được trả về <!doctype html>):
curl -i http://127.0.0.1:3000/api/settings

# 3. Kiểm tra xem file audio có phát streaming HTTP 206 không:
curl -I http://127.0.0.1:3000/uploads/audio/test.mp3

# 4. Xem log hoạt động thời gian thực của PM2:
pm2 logs audio-cms --lines 50
```

---

## 9. THÔNG TIN TÀI KHOẢN QUẢN TRỊ MẶC ĐỊNH

- **URL đăng nhập CMS**: `https://tenmien.com/admin` (hoặc `http://localhost:3000/admin`)
- **Tài khoản mặc định**: `tuld2901@gmail.com` (hoặc `admin`)
- **Mật khẩu mặc định**: `admin123`
- Sau khi đăng nhập, vào mục **Tài Khoản Quản Trị** để đổi mật khẩu, thêm tài khoản mới hoặc xóa tài khoản mặc định.
