import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Tự động gỡ bỏ mọi Service Worker hoặc Manifest cũ nếu trình duyệt từng lưu trước đó
// Đảm bảo website hoạt động 100% như trang web thông thường, không bao giờ hỏi quyền "Ứng dụng trên thiết bị"
if (typeof window !== 'undefined') {
  try {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
      }).catch(() => {});
    }
    const manifestLinks = document.querySelectorAll('link[rel="manifest"]');
    manifestLinks.forEach((el) => el.remove());
  } catch {}
}

createRoot(document.getElementById('root')!).render(<App />);
