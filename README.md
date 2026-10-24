# HƯỚNG DẪN CÀI ĐẶT, QUẢN TRỊ PM2 TOÀN HỆ THỐNG & TRIỂN KHAI TRÊN HOSTING / VPS

Tài liệu kỹ thuật hướng dẫn cài đặt môi trường, cấu hình **PM2 toàn hệ thống (Global PM2)**, triển khai chi tiết trên **Shared Hosting (cPanel / DirectAdmin)**, **aaPanel** và **VPS Linux (Ubuntu / Debian / CentOS)**, cùng tài liệu kết nối **API Gateway**.

---

## 1. YÊU CẦU HỆ THỐNG & CÀI ĐẶT MÔI TRƯỜNG

- **Node.js**: Phiên bản **v18.x** hoặc **v20.x LTS** (Khuyên dùng **Node.js v20 LTS**).
- **NPM**: Đi kèm khi cài đặt Node.js (v9+ hoặc v10+).
- **Git**: Để kéo và cập nhật mã nguồn từ GitHub.
- **Cổng chạy mặc định (Port)**: `3000` (tự động nhận biến môi trường `PORT` trên Hosting/Server).

### Kiểm tra phiên bản trên máy hoặc Server:
```bash
node -v
npm -v
git --version
```

---

## 2. CÀI ĐẶT & CHẠY TRÊN MÁY CÁ NHÂN (LOCAL)

### Bước 2.1: Cài đặt thư viện
Mở Terminal / Command Prompt tại thư mục gốc của mã nguồn và chạy:

```bash
npm install
```
*(Nếu gặp cảnh báo xung đột phiên bản trên npm cũ, chạy: `npm install --legacy-peer-deps`)*

### Bước 2.2: Chạy chế độ phát triển (Development)
```bash
npm run dev
```
- Website hoạt động tại: `http://localhost:3000`
- Trang quản trị CMS (truy cập trực tiếp qua URL): `http://localhost:3000/admin`

### Bước 2.3: Đóng gói và chạy chế độ thực tế (Production)
```bash
# 1. Biên dịch giao diện tĩnh vào thư mục dist/
npm run build

# 2. Khởi chạy Server Production
npm start
```

---

## 3. HƯỚNG DẪN CÀI ĐẶT PM2 TOÀN HỆ THỐNG (SYSTEM-WIDE PM2)

**PM2** là trình quản lý tiến trình Node.js giúp website luôn chạy ngầm 24/7, tự động khởi động lại khi gặp sự cố và tự động bật lại khi Server/VPS reboot.

### Bước 3.1: Cài đặt PM2 toàn cục (Global) cho toàn hệ thống

- **Trên VPS Linux (Ubuntu / Debian / CentOS / AlmaLinux):**
  ```bash
  sudo npm install -g pm2
  ```

- **Trên Windows (Chạy CMD / PowerShell với quyền Administrator):**
  ```bash
  npm install -g pm2
  ```

### Bước 3.2: Xử lý lỗi `pm2: command not found` (Khi cài qua NVM hoặc aaPanel)
Nếu bạn cài Node.js qua **NVM** hoặc **aaPanel Node.js Version Manager**, lệnh `pm2` có thể chưa được gắn vào `/usr/bin` của toàn hệ thống. Chạy lệnh sau để liên kết (symlink) PM2 toàn hệ thống:

```bash
# Kiểm tra đường dẫn thực tế của node và pm2 rồi liên kết vào /usr/bin
sudo ln -sf $(which node) /usr/bin/node
sudo ln -sf $(which npm) /usr/bin/npm
sudo ln -sf $(which pm2) /usr/bin/pm2
```

Nếu dùng **aaPanel**, đường dẫn mặc định của Node thường nằm tại `/www/server/nodejs/v20.x.x/bin/`. Bạn có thể gắn toàn hệ thống bằng lệnh:
```bash
sudo ln -sf /www/server/nodejs/v20*/bin/node /usr/bin/node
sudo ln -sf /www/server/nodejs/v20*/bin/npm /usr/bin/npm
sudo ln -sf /www/server/nodejs/v20*/bin/pm2 /usr/bin/pm2
```

Kiểm tra lại xem hệ thống đã nhận PM2 ở mọi thư mục chưa:
```bash
pm2 -v
```

### Bước 3.3: Khởi chạy Website bằng PM2
Di chuyển vào thư mục chứa mã nguồn (đã chạy `npm install` và `npm run build`), sau đó khởi chạy:

```bash
# Tạo sẵn thư mục lưu trữ database, backup và thư mục tĩnh uploads/ ngay tại gốc dự án
mkdir -p data uploads/audio uploads/images backups

# Build giao diện vào thư mục dist/
npm run build

# Khởi chạy ứng dụng với tên định danh "audio-cms"
pm2 start npm --name "audio-cms" -- start
```

*(Hoặc nếu bạn muốn chỉ định cổng tùy chỉnh, ví dụ cổng `4000`):*
```bash
PORT=4000 pm2 start npm --name "audio-cms" -- start
```

### Bước 3.4: Cấu hình PM2 tự động chạy lại khi Server khởi động (Reboot)
Để đảm bảo mỗi khi VPS/Server khởi động lại, website tự động bật lên mà không cần đăng nhập SSH gõ lệnh thủ công:

```bash
# 1. Tạo dịch vụ khởi động cùng hệ điều hành (Systemd)
pm2 startup
```
> **Lưu ý:** Sau khi gõ `pm2 startup`, nếu bạn không đăng nhập bằng quyền `root`, màn hình sẽ in ra một dòng lệnh dạng `sudo env PATH=$PATH:... pm2 startup systemd -u ...`. Hãy copy và chạy dòng lệnh đó. Nếu bạn đang ở quyền `root`, PM2 sẽ tự tạo dịch vụ ngay lập tức.

```bash
# 2. Lưu danh sách các tiến trình đang chạy để PM2 tự khôi phục khi reboot
pm2 save
```

### Bước 3.5: Bảng lệnh quản lý PM2 thường dùng
| Lệnh PM2 | Chức năng |
| :--- | :--- |
| `pm2 list` hoặc `pm2 status` | Xem danh sách các ứng dụng đang chạy, trạng thái, RAM và CPU |
| `pm2 logs audio-cms` | Xem nhật ký hoạt động (log) thời gian thực của web |
| `pm2 logs audio-cms --lines 100` | Xem 100 dòng log gần nhất để kiểm tra lỗi |
| `pm2 restart audio-cms` | Khởi động lại ứng dụng (dùng sau khi cập nhật code và chạy `npm run build`) |
| `pm2 reload audio-cms` | Khởi động lại không gián đoạn (Zero-downtime reload) |
| `pm2 stop audio-cms` | Tạm dừng ứng dụng |
| `pm2 delete audio-cms` | Xóa ứng dụng khỏi danh sách quản lý của PM2 |
| `pm2 monit` | Mở bảng theo dõi RAM / CPU trực quan trên Terminal |
| `pm2 flush` | Xóa toàn bộ file log cũ của PM2 để giải phóng dung lượng ổ cứng |

---

## 4. HƯỚNG DẪN CÀI ĐẶT CHI TIẾT TRÊN HOSTING & VPS

---

### PHƯƠNG ÁN A: CÀI ĐẶT TRÊN SHARED HOSTING SỬ DỤNG CPANEL (Setup Node.js App)

Hầu hết các nhà cung cấp Hosting hiện nay (AZDIGI, Vietnix, TinoHost, Hostinger, Namecheap, HawkHost...) sử dụng **cPanel** có tích hợp sẵn **Setup Node.js App** (CloudLinux Passenger).

#### Bước 1: Chuẩn bị và tải mã nguồn lên Hosting
1. Trên máy tính cá nhân, nén toàn bộ các file và thư mục của dự án thành file `source.zip`.
   > **Quan trọng:** **KHÔNG** nén thư mục `node_modules` và `.git` để file nén nhẹ (chỉ khoảng vài trăm KB).
2. Đăng nhập vào **cPanel** -> Mở **File Manager**.
3. Tại thư mục gốc của tài khoản Hosting (`/home/ten_user/`), nhấn **+ Folder** để tạo thư mục mới tên là `audio-app` (không nên để mã nguồn trực tiếp trong `public_html` vì cPanel Node.js App sẽ tự tạo cầu nối sang `public_html`).
4. Mở thư mục `/home/ten_user/audio-app` -> Nhấn **Upload** -> Tải file `source.zip` lên -> Nhấp chuột phải vào `source.zip` chọn **Extract** (Giải nén) -> Xóa file `source.zip`.
5. Kiểm tra đảm bảo các file `package.json`, `server.ts`, `index.html`, `src/` nằm trực tiếp bên trong `/home/ten_user/audio-app/`.

#### Bước 2: Khởi tạo ứng dụng trong "Setup Node.js App"
1. Quay lại trang chủ **cPanel**, tìm mục **Software** -> Nhấn vào **Setup Node.js App**.
2. Nhấn nút **CREATE APPLICATION** và điền chính xác các thông số sau:
   - **Node.js version**: Chọn `20.x` (hoặc `18.x` trở lên).
   - **Application mode**: Chọn `Production`.
   - **Application root**: Nhập `audio-app` (tên thư mục bạn vừa giải nén ở Bước 1).
   - **Application URL**: Chọn tên miền hoặc tên miền phụ (subdomain) bạn muốn chạy web (để trống ô đường dẫn phía sau nếu muốn chạy ở trang chủ `https://tenmien.com`).
   - **Application startup file**: Nhập `server.ts`
3. Nhấn nút **CREATE** ở góc phải trên cùng và đợi khoảng 5–10 giây để cPanel khởi tạo môi trường ảo (Virtual Environment).

#### Bước 3: Cài đặt thư viện & Build giao diện trên cPanel
Sau khi nhấn Create, ở ngay đầu trang cấu hình Node.js App sẽ có dòng chữ:
`Enter to the virtual environment. To enter to virtual environment, run the command:` kèm một đoạn lệnh màu xám dạng:
```bash
source /home/ten_user/nodevenv/audio-app/20/bin/activate && cd /home/ten_user/audio-app
```

1. **Copy đoạn lệnh đó** (chỉ cần click chuột vào đoạn lệnh là cPanel tự copy).
2. Quay ra trang chủ cPanel -> Mở công cụ **Terminal** (hoặc kết nối qua SSH).
3. Dán đoạn lệnh vừa copy vào Terminal và nhấn **Enter**.
4. Chạy tiếp các lệnh sau trong Terminal để cài đặt thư viện, tạo thư mục dữ liệu và biên dịch giao diện:
   ```bash
   # Tạo thư mục lưu database và thư mục tĩnh uploads/ tại gốc dự án
   mkdir -p data uploads/audio uploads/images backups
   chmod -R 755 data uploads backups

   # Cài đặt toàn bộ gói thư viện
   npm install

   # Biên dịch giao diện React ra thư mục dist/
   npm run build
   ```
5. Quay lại giao diện **Setup Node.js App** trên cPanel -> Nhấn nút **RESTART** (Khởi động lại ứng dụng).

#### Bước 4: Cấu hình giới hạn dung lượng Upload MP3 trên cPanel
Để upload được các tập truyện MP3 dung lượng lớn (50MB – 150MB) mà không bị lỗi ngắt kết nối:
1. Mở **File Manager** trên cPanel -> Vào thư mục `public_html` (hoặc thư mục gốc của tên miền).
2. Mở file `.htaccess` (nhấn **Settings** ở góc phải trên cùng của File Manager -> tích chọn **Show Hidden Files (dotfiles)** để thấy file `.htaccess`).
3. Giữ nguyên khối cấu hình `# DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION BEGIN...` của cPanel, và thêm các dòng sau vào cuối file `.htaccess`:
   ```apache
   <IfModule mod_Rewrite.c>
   RewriteEngine On
   # Không chặn các đường dẫn ảo để Node.js Express tự xử lý URL sạch (/ten-truyen, /admin)
   </IfModule>

   # Tăng giới hạn kích thước request trên Apache / LiteSpeed
   LimitRequestBody 157286400
   ```
4. Lưu file lại. Truy cập tên miền của bạn để kiểm tra.

---

### PHƯƠNG ÁN B: CÀI ĐẶT TRÊN HOSTING / VPS SỬ DỤNG AAPANEL (BAOTA PANEL)

Nếu bạn quản lý Hosting/VPS qua bảng điều khiển **aaPanel**:

#### Bước 1: Cài đặt Nginx, Node.js và PM2 trên aaPanel
1. Đăng nhập aaPanel -> Vào mục **App Store**:
   - Tìm và cài đặt **Nginx** (nếu chưa cài).
   - Tìm và cài đặt **Node.js Version Manager** (hoặc **PM2 Manager**).
2. Mở **Node.js Version Manager** -> Tải phiên bản **Node.js v20.x LTS** -> Chọn làm phiên bản mặc định (**Command Line Version: v20.x**).
3. Mở **Terminal** trên aaPanel, cài đặt PM2 toàn hệ thống:
   ```bash
   npm install -g pm2
   sudo ln -sf /www/server/nodejs/v20*/bin/node /usr/bin/node
   sudo ln -sf /www/server/nodejs/v20*/bin/npm /usr/bin/npm
   sudo ln -sf /www/server/nodejs/v20*/bin/pm2 /usr/bin/pm2
   ```

#### Bước 2: Đưa mã nguồn lên aaPanel và Build
1. Vào mục **Files** trên aaPanel -> Đi tới `/www/wwwroot/`.
2. Tạo thư mục `/www/wwwroot/audio-web` -> Upload file nén mã nguồn (không kèm `node_modules`) và giải nén, hoặc mở Terminal kéo trực tiếp từ GitHub:
   ```bash
   cd /www/wwwroot
   git clone https://github.com/<USERNAME>/<REPO_NAME>.git audio-web
   cd /www/wwwroot/audio-web
   ```
3. Chạy lệnh tạo thư mục lưu trữ, cài đặt và build:
   ```bash
   mkdir -p data uploads/audio uploads/images backups
   chmod -R 755 data uploads backups
   npm install
   npm run build
   ```
4. Khởi chạy bằng PM2:
   ```bash
   pm2 start npm --name "audio-cms" -- start
   pm2 save
   pm2 startup
   ```

#### Bước 3: Gắn Tên Miền (Reverse Proxy) và SSL trên aaPanel
1. Vào mục **Website** -> Tab **PHP Project** -> Nhấn **Add site**:
   - **Domain name**: Nhập `tenmien.com` và `www.tenmien.com`
   - **PHP Version**: Chọn `Pure Static`
   - Nhấn **Submit**.
2. Nhấn vào tên miền vừa tạo -> Chọn mục **Reverse proxy** -> Nhấn **Add reverse proxy**:
   - **Proxy name**: `audio-node`
   - **Target URL**: `http://127.0.0.1:3000`
   - Nhấn **Submit**.
3. Chuyển sang mục **Config** (Cấu hình Nginx của tên miền) -> Kiểm tra hoặc thêm dòng cho phép upload file MP3 lớn (150MB) bên trong khối `server { ... }`:
   ```nginx
   client_max_body_size 150M;
   client_body_timeout 300s;
   ```
4. Chuyển sang mục **SSL** -> Chọn tab **Let's Encrypt** -> Tích chọn tên miền -> Nhấn **Apply** -> Bật nút **Force HTTPS**.

---

### PHƯƠNG ÁN C: CÀI ĐẶT TRÊN HOSTING SỬ DỤNG DIRECTADMIN

1. Đăng nhập **DirectAdmin** -> Vào **File Manager** -> Tạo thư mục `audio-app` và giải nén mã nguồn vào đó.
2. Mở **SSH / Terminal** trên DirectAdmin:
   ```bash
   cd ~/audio-app
   mkdir -p data uploads/audio uploads/images backups
   npm install
   npm run build
   ```
3. Nếu DirectAdmin của nhà cung cấp có mục **Node.js Selector** (CloudLinux):
   - Chọn **Create Application** -> Chọn **Node.js 20** -> **Application root**: `audio-app` -> **Application startup file**: `server.ts` -> Nhấn **Create** và **Restart**.
4. Nếu DirectAdmin sử dụng `.htaccess` Proxy sang Port nội bộ:
   - Khởi chạy ứng dụng qua PM2 trên cổng riêng (ví dụ `PORT=3000 pm2 start npm --name "audio-cms" -- start && pm2 save`).
   - Trong `domains/tenmien.com/public_html/.htaccess`, cấu hình chuyển hướng sang cổng Node.js:
     ```apache
     DirectoryIndex disabled
     RewriteEngine On
     RewriteRule ^(.*)$ http://127.0.0.1:3000/$1 [P,L]
     ```

---

### PHƯƠNG ÁN D: CÀI ĐẶT TRÊN VPS LINUX THUẦN (UBUNTU / DEBIAN + NGINX + CERTBOT SSL)

Phương án tối ưu nhất nếu bạn thuê VPS trắng tại Vultr, DigitalOcean, Linode, Vietnix, AZDIGI, v.v.

#### Bước 1: Cài đặt Node.js 20 LTS, Git, Nginx và PM2 toàn hệ thống
Kết nối SSH vào VPS và chạy lần lượt:

```bash
# 1. Cập nhật hệ điều hành và cài đặt các gói cơ bản
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nginx build-essential

# 2. Cài đặt Node.js 20 LTS chính thức từ NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Cài đặt PM2 toàn hệ thống (Global)
sudo npm install -g pm2
```

#### Bước 2: Tải mã nguồn, Build và Khởi chạy PM2
```bash
# 1. Tạo thư mục chứa dự án (ví dụ /root/my-web hoặc /var/www/audio-web)
mkdir -p /root/my-web

# 2. Clone mã nguồn từ GitHub vào /root/my-web
git clone https://github.com/<USERNAME>/<REPO_NAME>.git /root/my-web
cd /root/my-web

# 3. Tạo thư mục dữ liệu data/ và thư mục tĩnh duy nhất uploads/audio/ ngay tại gốc dự án
mkdir -p data uploads/audio uploads/images backups

# 4. Cài đặt thư viện và Build Production
npm install
npm run build

# 5. Khởi chạy bằng PM2 và lưu cấu hình tự khởi động cùng VPS
pm2 start npm --name "audio-cms" -- start
pm2 save
pm2 startup
```

#### Bước 3: Cấu hình Nginx Reverse Proxy & Trỏ Thẳng Thư Mục Tĩnh `uploads/`
Tạo file cấu hình Nginx:
```bash
sudo nano /etc/nginx/sites-available/audio-web
```

Dán nội dung sau vào (thay `tenmien.com` bằng tên miền thật của bạn):
```nginx
server {
    listen 80;
    server_name tenmien.com www.tenmien.com;

    # Cho phép upload file MP3 dung lượng lớn tới 150MB
    client_max_body_size 150M;
    client_body_timeout 300s;

    # Trỏ thẳng vào thư mục tĩnh duy nhất uploads/ tại thư mục gốc dự án
    location /uploads/ {
        alias /root/my-web/uploads/;
        expires 30d;
        add_header Cache-Control "public, no-transform";
        add_header Accept-Ranges bytes;
    }

    # Chuyển tiếp mọi đường dẫn sạch (/ten-truyen, /admin, /api/...) vào Node.js Port 3000
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
        proxy_read_timeout 300s;
    }
}
```

Kích hoạt cấu hình Nginx:
```bash
sudo ln -sf /etc/nginx/sites-available/audio-web /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

#### Bước 4: Cài đặt chứng chỉ bảo mật HTTPS (SSL Let's Encrypt miễn phí)
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d tenmien.com -d www.tenmien.com
```

---

## 5. CẬP NHẬT CODE & SAO LƯU DỮ LIỆU (BACKUP) TRÊN SERVER

### 5.1. Đẩy mã nguồn từ máy tính lên GitHub
```bash
git init
git add .
git commit -m "Update source code"
git branch -M main
git remote add origin https://github.com/<USERNAME>/<REPO_NAME>.git
git push -u origin main
```

### 5.2. Cập nhật phiên bản mới trên Server/VPS (Không mất dữ liệu)
Khi có thay đổi giao diện hoặc tính năng mới từ GitHub, chỉ cần chạy trên Server:
```bash
cd /var/www/audio-web
git pull origin main
npm install
npm run build
pm2 restart audio-cms
```

### 5.3. Quy Chuẩn Lưu Trữ File Tĩnh & Sao Lưu (Backup Dữ Liệu)
1. **Chuẩn hóa tên file theo slug tiêu đề tập truyện**:
   - Khi upload file MP3 qua CMS (`/admin`) hoặc qua API (`/api/upload-audio`), backend tự động chuyển đổi tên file theo chuẩn slug không dấu, gạch nối của tiêu đề tập truyện:
     - **Tiêu đề tập**: `Tập 1: Tiếng Gõ Cửa Đêm Khuya`
     - **Tên file lưu trên đĩa**: `tap-1-tieng-go-cua-dem-khuya.mp3`
     - **Đường dẫn lưu trong `db.json`**: `/uploads/audio/tap-1-tieng-go-cua-dem-khuya.mp3`
2. **Thống nhất một thư mục tĩnh duy nhất**:
   - Đường dẫn thư mục vật lý cố định: `uploads/audio/` và `uploads/images/` (nằm ngay trong thư mục gốc dự án).
   - Cấu hình Nginx trỏ thẳng: `location /uploads/ { alias /root/my-web/uploads/; }`
3. **Sao lưu & Khôi phục trực tiếp trong Quản trị CMS (`/admin` -> tab `Backup Dữ Liệu`)**:
   - Tải trực tiếp file `data/db.json` hoặc gói nén toàn bộ hệ thống `.tar.gz` (`data/` + `uploads/`) về máy tính chỉ với 1 cú nhấp chuột.
   - Tạo bản Snapshot dự phòng ngay trên Server (`backups/`) và khôi phục lại bất kỳ lúc nào.

---

## 6. THÔNG TIN ĐĂNG NHẬP QUẢN TRỊ (ADMIN CMS)

Nút đăng nhập và thông tin gợi ý đã được ẩn hoàn toàn khỏi giao diện công khai để bảo mật. Để truy cập trang quản trị, bạn nhập trực tiếp đường dẫn trên trình duyệt:

- **Đường dẫn Quản trị CMS**: `https://tenmien.com/admin` (hoặc `http://localhost:3000/admin`)
- **Email / Tên đăng nhập mặc định**: `tuld2901@gmail.com` (hoặc `admin`)
- **Mật khẩu mặc định**: `admin123`

> **Thay đổi hoặc xóa tài khoản mặc định:**
> Sau khi đăng nhập vào `/admin`, mở tab **Tài Khoản Quản Trị** trên thanh điều hướng để đổi mật khẩu, thêm tài khoản quản trị mới hoặc xóa bỏ tài khoản mặc định.

---

## 7. TÀI LIỆU KẾT NỐI API GATEWAY (DÀNH CHO ĐẨY DỮ LIỆU TỰ ĐỘNG)

Hệ thống hỗ trợ đẩy truyện và tập âm thanh từ công cụ bên ngoài (Python, Node.js, n8n, Make.com...) qua khóa bảo mật `x-api-key`.
- Lấy hoặc đổi **API Key** trong trang `/admin` -> mục **Quản Lý API Gateway**.
- Header bắt buộc cho các lệnh ghi/sửa/xóa/upload:
  ```http
  x-api-key: <API_KEY_CỦA_BẠN>
  ```

### 7.1. Upload file MP3 lên Server (`POST /api/upload-audio`)
```bash
curl -X POST https://tenmien.com/api/upload-audio \
  -H "x-api-key: goi-om-secret-api-key-2025" \
  -F "audio=@/duong/dan/tap_1.mp3"
```

### 7.2. Tạo truyện mới kèm danh sách tập (`POST /api/gateway`)
```bash
curl -X POST https://tenmien.com/api/gateway \
  -H "Content-Type: application/json" \
  -H "x-api-key: goi-om-secret-api-key-2025" \
  -d '{
    "action": "create_story",
    "payload": {
      "title": "Tên Bộ Truyện Audio",
      "author": "Tên Tác Giả",
      "category": "Ngôn Tình",
      "status": "Hoàn thành",
      "description": "Nội dung giới thiệu truyện audio...",
      "episodes": [
        {
          "number": 1,
          "title": "Tập 1: Mở đầu",
          "duration": "25:30",
          "audioUrl": "https://tenmien.com/uploads/audio/ten-file.mp3"
        }
      ]
    }
  }'
```

### 7.3. Thêm tập mới vào bộ truyện đã có (`POST /api/gateway`)
```bash
curl -X POST https://tenmien.com/api/gateway \
  -H "Content-Type: application/json" \
  -H "x-api-key: goi-om-secret-api-key-2025" \
  -d '{
    "action": "add_episode",
    "payload": {
      "storyId": "ten-bo-truyen-audio",
      "episode": {
        "number": 2,
        "title": "Tập 2: Diễn biến",
        "duration": "28:15",
        "audioUrl": "https://tenmien.com/uploads/audio/tap-2.mp3"
      }
    }
  }'
```

---

## 8. XỬ LÝ SỰ CỐ THƯỜNG GẶP (TROUBLESHOOTING)

1. **Lỗi `413 Request Entity Too Large` khi tải file MP3 lên Server:**
   - Nguyên nhân: Nginx hoặc Apache giới hạn dung lượng upload mặc định (1MB - 2MB).
   - Khắc phục: Thêm `client_max_body_size 150M;` vào cấu hình Nginx (hoặc `LimitRequestBody 157286400` trong `.htaccess` trên cPanel), sau đó khởi động lại Nginx (`sudo systemctl reload nginx`).
2. **Lỗi `EADDRINUSE: address already in use :::3000`:**
   - Nguyên nhân: Cổng `3000` đã có một tiến trình khác đang chạy.
   - Khắc phục: Kiểm tra bằng `pm2 list` để tránh bật trùng 2 lần, hoặc tắt tiến trình cũ bằng `npx kill-port 3000`.
3. **Lỗi `pm2: command not found` sau khi cài PM2:**
   - Khắc phục: Thực hiện liên kết symlink vào `/usr/bin/pm2` theo hướng dẫn tại **Mục 3.2**.
