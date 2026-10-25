# NAMNGHECMS - Installation Guide

A modern Audio Story CMS & Streaming Web Application powered by Node.js, Express, React, and Tailwind CSS.

---

## 1. Prerequisites

- **Node.js**: v18.x or v20.x LTS (Recommended: Node.js 20 LTS)
- **NPM**: v9+ or v10+
- **Git**
- **Default Port**: `3000` (configurable via `PORT` environment variable)

Check your environment:
```bash
node -v
npm -v
git --version
```

---

## 2. Quick Start & Installation

### Step 1: Clone Repository
```bash
git clone https://github.com/<USERNAME>/<REPO_NAME>.git NAMNGHE-AUDIO
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
npm install
npm run build
```

*(If you ever encounter an `edgesOut` or npm lock conflict, run: `rm -rf package-lock.json node_modules && npm cache clean --force && npm install`)*

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

Create file `/etc/nginx/sites-available/namnghe-cms`:
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # Allow large MP3 & backup file uploads (up to 250MB)
    client_max_body_size 250M;
    client_body_timeout 600s;
    client_header_timeout 600s;

    # Serve static audio & image uploads directly (fast streaming)
    location /uploads/ {
        alias /root/NAMNGHE-AUDIO/uploads/;
        expires 30d;
        add_header Cache-Control "public, no-transform";
        add_header Accept-Ranges bytes;
        client_max_body_size 250M;
    }

    # Proxy all clean routes into Node.js (Port 3000)
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
sudo nginx -t
sudo systemctl restart nginx
```

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
