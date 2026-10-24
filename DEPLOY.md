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
mkdir -p data public/uploads/audio public/uploads/images

# 2. Cài đặt thư viện và biên dịch giao diện vào thư mục dist/
npm install
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
   mkdir -p data public/uploads/audio public/uploads/images
   chmod -R 755 data public/uploads
   npm install
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
   mkdir -p data public/uploads/audio public/uploads/images
   chmod -R 755 data public/uploads
   npm install
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

mkdir -p data public/uploads/audio public/uploads/images
npm install
npm run build

pm2 start npm --name "audio-cms" -- start
pm2 save
pm2 startup
```

### Bước 5.3: Cấu hình Nginx & SSL
Tạo file `/etc/nginx/sites-available/audio-web`:
```nginx
server {
    listen 80;
    server_name tenmien.com www.tenmien.com;

    client_max_body_size 150M;
    client_body_timeout 300s;

    location /uploads/ {
        alias /var/www/audio-web/public/uploads/;
        expires 30d;
        add_header Cache-Control "public, no-transform";
        add_header Accept-Ranges bytes;
    }

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

Kích hoạt Nginx và cài SSL:
```bash
sudo ln -sf /etc/nginx/sites-available/audio-web /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx

sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d tenmien.com -d www.tenmien.com
```

---

## 6. THÔNG TIN TÀI KHOẢN QUẢN TRỊ MẶC ĐỊNH

- **URL đăng nhập CMS**: `https://tenmien.com/admin`
- **Tài khoản mặc định**: `tuld2901@gmail.com` (hoặc `admin`)
- **Mật khẩu mặc định**: `admin123`
- Sau khi đăng nhập, vào mục **Tài Khoản Quản Trị** để đổi mật khẩu, thêm tài khoản mới hoặc xóa tài khoản mặc định.
