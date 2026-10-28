# TỔNG HỢP BẢO MẬT QUẢN TRỊ (`/app-config`), GOOGLE AUTHENTICATOR & GIỚI HẠN NGINX (5 LẦN LOGIN / 1 PHÚT)

Tài liệu tổng hợp cấu hình bảo mật trang quản trị CMS gồm 3 lớp:
1. **Ẩn đường dẫn quản trị sang `/app-config`**
2. **Xác thực 2 bước Google Authenticator (`speakeasy` + `qrcode`)**
3. **Giới hạn 5 lần đăng nhập / 1 phút bằng Nginx & Node.js Backend**

---

## 1. ĐƯỜNG DẪN QUẢN TRỊ BÍ MẬT (`/app-config`)

- **Đường dẫn truy cập Quản trị CMS mới**:
  - Trên tên miền thật: `https://ten-mien-cua-ban.com/app-config`
  - Trên máy cục bộ (Local): `http://localhost:3000/app-config`
- **Cơ chế ẩn đường dẫn cũ**:
  - Bất kỳ ai cố tình gõ `/admin`, `/quan-tri` hoặc `/system-secret-admin` sẽ lập tức bị đẩy thẳng về trang chủ `/`.
  - Trang chủ và trình phát audio hoạt động độc lập, không bị ảnh hưởng.
- **Tài khoản mặc định ban đầu**:
  - **Email / Username**: `tuld2901@gmail.com` (hoặc `admin`)
  - **Mật khẩu**: `admin123`

---

## 2. XÁC THỰC 2 BƯỚC GOOGLE AUTHENTICATOR (`speakeasy` + `qrcode`)

### 2.1. Thư viện sử dụng
- `speakeasy`: Sinh khóa bí mật Base32 (`secret`) và kiểm tra mã OTP 6 chữ số theo chuẩn TOTP (30 giây đổi mã 1 lần).
- `qrcode`: Tạo hình ảnh **Mã QR** trực tiếp ngay trong trang quản trị để quét bằng điện thoại trong lần đầu cài đặt.

### 2.2. Cách Bật / Tắt Google Authenticator trong Admin
1. Truy cập **`/app-config`** và đăng nhập vào Quản trị CMS.
2. Mở tab **Tài Khoản Quản Trị**.
3. Tại dòng tài khoản cần bảo mật:
   - **Để BẬT**: Nhấn nút **Bật Google Authenticator** -> Mở ứng dụng **Google Authenticator** (hoặc Authy / Microsoft Authenticator) trên điện thoại -> Quét **Mã QR** trên màn hình (hoặc nhập mã khóa `Secret Key` thủ công) -> Nhập **6 chữ số** hiển thị trên điện thoại vào ô xác nhận -> Bấm **Xác Nhận & Bật 2FA**.
   - **Để TẮT**: Nhấn nút **✕ Tắt Google Authenticator** và xác nhận.

### 2.3. Quy trình đăng nhập khi đã bật 2FA
- **Bước 1**: Nhập Email/Username và Mật khẩu quản trị tại `/app-config`.
- **Bước 2**: Khi mật khẩu đúng, giao diện tự động chuyển sang màn hình yêu cầu nhập **Mã Xác Thực 6 Số (Google Authenticator)**. Nhập đúng 6 số trên điện thoại sẽ vào thẳng Quản trị CMS.

---

## 3. HƯỚNG DẪN CÀI ĐẶT NGINX GIỚI HẠN 5 LẦN LOGIN / 1 PHÚT

Cấu hình này chỉ giới hạn riêng API đăng nhập quản trị (`POST /api/admin/login`), hoàn toàn **không giới hạn** khách nghe truyện ở trang chủ.

### Bước 3.1: Khai báo vùng nhớ Rate Limit trong `/etc/nginx/nginx.conf`

Mở file `/etc/nginx/nginx.conf`:

```bash
sudo nano /etc/nginx/nginx.conf
```

Bên trong khối `http { ... }`, thêm dòng khai báo vùng nhớ `admin_login_limit` với tốc độ `5r/m` (5 requests / 1 minute):

```nginx
http {
    # ... các cấu hình sẵn có của Nginx ...

    # Giới hạn tối đa 5 lần đăng nhập / 1 phút cho mỗi địa chỉ IP ($binary_remote_addr)
    limit_req_zone $binary_remote_addr zone=admin_login_limit:10m rate=5r/m;
}
```

> **Mẹo**: Nếu bạn dùng trực tiếp file `nginx.conf` có sẵn trong thư mục gốc dự án để đưa vào `/etc/nginx/sites-available/`, dòng `limit_req_zone` này đã được khai báo sẵn ở đầu file.

---

### Bước 3.2: Cấu hình chặn tại `location = /api/admin/login`

Mở file cấu hình domain của bạn (ví dụ `/etc/nginx/sites-available/namnghe-audio` hoặc `/etc/nginx/sites-available/default`):

```bash
sudo nano /etc/nginx/sites-available/default
```

Thêm khối `location = /api/admin/login` và `location @login_rate_limited` vào trong khối `server { ... }` (đặt **trước** `location /`):

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name ten-mien-cua-ban.com www.ten-mien-cua-ban.com;

    # ==========================================================================
    # 1. GIỚI HẠN 5 LẦN LOGIN / 1 PHÚT CHO TRANG QUẢN TRỊ (/app-config)
    # ==========================================================================
    location = /api/admin/login {
        # burst=4 nodelay: Cho phép thử tối đa 5 lần trong 1 phút, từ lần thứ 6 sẽ chặn ngay lập tức
        limit_req zone=admin_login_limit burst=4 nodelay;
        limit_req_status 429;

        # Trả về phản hồi JSON tiếng Việt khi bị chặn (HTTP 429)
        error_page 429 = @login_rate_limited;

        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location @login_rate_limited {
        default_type application/json;
        return 429 '{"success":false,"error":"Bạn đã thử đăng nhập quá 5 lần trong 1 phút. Vui lòng đợi 1 phút rồi thử lại!"}';
    }

    # ==========================================================================
    # 2. CÁC ĐƯỜNG DẪN CÒN LẠI CỦA WEBSITE (HOẠT ĐỘNG BÌNH THƯỜNG)
    # ==========================================================================
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

### Bước 3.3: Kiểm tra cú pháp và tải lại Nginx

Chạy lệnh sau trên Terminal VPS để áp dụng ngay mà không làm gián đoạn website:

```bash
# 1. Kiểm tra cú pháp cấu hình Nginx
sudo nginx -t

# 2. Nếu báo "syntax is ok" và "test is successful", reload lại Nginx:
sudo systemctl reload nginx
```

---

### Bước 3.4: Cách kiểm tra (Test) xem giới hạn 5 lần / 1 phút đã hoạt động chưa

Bạn có thể chạy lệnh `curl` sau 6 lần liên tiếp trên Terminal để kiểm tra:

```bash
for i in {1..6}; do
  echo "Lần thử $i:"
  curl -i -s -X POST http://127.0.0.1:3000/api/admin/login \
    -H "Content-Type: application/json" \
    -d '{"identifier":"admin","password":"sai_mat_khau"}' | head -n 15
  echo -e "\n-------------------"
done
```

- **Từ lần 1 đến lần 5**: Trả về `HTTP/1.1 401 Unauthorized` (Báo sai mật khẩu).
- **Từ lần thứ 6 trở đi (trong vòng 1 phút)**: Trả về `HTTP/1.1 429 Too Many Requests` kèm thông báo:
  `{"success":false,"error":"Bạn đã thử đăng nhập quá 5 lần/phút. Vui lòng đợi ... giây nữa rồi thử lại!"}`
