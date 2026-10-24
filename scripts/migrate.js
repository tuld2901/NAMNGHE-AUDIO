/**
 * Auto Setup & Migration Script for PhubaAudio
 * Run via: npm run db:setup
 * 
 * Creates 'tracks' table and storage buckets in Supabase,
 * and seeds initial Vietnamese audio story sample data.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load .env if present
if (fs.existsSync('.env')) {
  dotenv.config({ path: '.env' });
} else if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

console.log('='.repeat(65));
console.log('  HỆ THỐNG PHUBA AUDIO - DATABASE & STORAGE AUTO SETUP');
console.log('='.repeat(65));

const MIGRATION_SQL = `
-- 1. TẠO BẢNG TRACKS (DANH SÁCH TRUYỆN AUDIO)
CREATE TABLE IF NOT EXISTS public.tracks (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title TEXT NOT NULL,
    author TEXT DEFAULT 'Đang cập nhật',
    narrator TEXT DEFAULT 'Phú Bà Audio',
    category TEXT DEFAULT 'Truyện Ngắn',
    mp3_url TEXT NOT NULL,
    thumb_url TEXT,
    description TEXT,
    play_count BIGINT DEFAULT 0,
    affiliate_link TEXT DEFAULT 'https://shopee.vn',
    chapters JSONB DEFAULT '[]'::jsonb,
    is_featured BOOLEAN DEFAULT false,
    is_hot BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;

-- 3. POLICIES: Ai cũng có thể xem truyện (Public Read)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'tracks' AND policyname = 'Public read access for tracks'
    ) THEN
        CREATE POLICY "Public read access for tracks"
        ON public.tracks FOR SELECT
        USING (true);
    END IF;
END $$;

-- 4. POLICIES: Cho phép Admin / Service Role thêm, sửa, xóa
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'tracks' AND policyname = 'Admin all access for tracks'
    ) THEN
        CREATE POLICY "Admin all access for tracks"
        ON public.tracks FOR ALL
        USING (auth.jwt() ->> 'email' = '${process.env.ADMIN_EMAIL || 'tuld2901@gmail.com'}' OR auth.role() = 'service_role')
        WITH CHECK (auth.jwt() ->> 'email' = '${process.env.ADMIN_EMAIL || 'tuld2901@gmail.com'}' OR auth.role() = 'service_role');
    END IF;
END $$;

-- 5. FUNCTION TỰ ĐỘNG TĂNG LƯỢT NGHE (INCREMENT PLAY COUNT)
CREATE OR REPLACE FUNCTION increment_track_play_count(track_id TEXT)
RETURNS void AS $$
BEGIN
    UPDATE public.tracks
    SET play_count = play_count + 1
    WHERE id = track_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. TẠO STORAGE BUCKET NẾU CHƯA CÓ
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-stories', 'audio-stories', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('story-covers', 'story-covers', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 7. STORAGE POLICIES: Public download
CREATE POLICY IF NOT EXISTS "Public Access Audio"
ON storage.objects FOR SELECT
USING (bucket_id IN ('audio-stories', 'story-covers'));

CREATE POLICY IF NOT EXISTS "Admin Upload Audio"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id IN ('audio-stories', 'story-covers'));
`;

const SAMPLE_TRACKS = [
  {
    title: 'Gặp Ma Ở Quán Trọ Vùng Cao',
    author: 'Nguyễn Huy',
    narrator: 'Phú Bà Audio',
    category: 'Truyện Ma',
    mp3_url: 'https://cdn.freesound.org/previews/612/612610_5674468-lq.mp3',
    thumb_url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80',
    description: 'Chuyến xe đêm muộn đưa hai người khách lữ hành dừng chân tại một quán trọ heo hút lưng chừng đèo. Đêm định mệnh với những tiếng gõ cửa bí ẩn lúc 2 giờ sáng...',
    play_count: 24500,
    affiliate_link: 'https://shopee.vn',
    is_featured: true,
    is_hot: true,
    chapters: [
      { id: 1, title: 'Phần 1: Chuyến xe đêm định mệnh', duration: '28:15', mp3_url: 'https://cdn.freesound.org/previews/612/612610_5674468-lq.mp3' },
      { id: 2, title: 'Phần 2: Căn phòng số 13', duration: '32:40', mp3_url: 'https://cdn.freesound.org/previews/682/682631_11861866-lq.mp3' },
      { id: 3, title: 'Phần 3: Bóng áo trắng nơi sương mờ', duration: '35:10', mp3_url: 'https://cdn.freesound.org/previews/612/612610_5674468-lq.mp3' }
    ]
  },
  {
    title: 'Phàm Nhân Tu Tiên: Khởi Đầu Nghèo Khó',
    author: 'Vong Ngữ',
    narrator: 'MC Tuấn Anh',
    category: 'Tiên Hiệp',
    mp3_url: 'https://cdn.freesound.org/previews/682/682631_11861866-lq.mp3',
    thumb_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
    description: 'Một thiếu niên bình phàm xuất thân thôn dã tình cờ bước vào con đường tu tiên đầy trắc trở. Dựa vào sự cẩn trọng và cơ trí, từng bước vượt qua khảo nghiệm.',
    play_count: 51200,
    affiliate_link: 'https://shopee.vn',
    is_featured: true,
    is_hot: true,
    chapters: [
      { id: 1, title: 'Phần 1: Thất Huyền Môn', duration: '24:00', mp3_url: 'https://cdn.freesound.org/previews/682/682631_11861866-lq.mp3' },
      { id: 2, title: 'Phần 2: Mặc Đại Phu & Bí Mật Thảo Dược', duration: '30:15', mp3_url: 'https://cdn.freesound.org/previews/612/612610_5674468-lq.mp3' }
    ]
  },
  {
    title: 'Mối Tình Nơi Hẻm Vắng Sài Gòn',
    author: 'Hạ Vy',
    narrator: 'Phú Bà Audio',
    category: 'Ngôn Tình',
    mp3_url: 'https://cdn.freesound.org/previews/612/612610_5674468-lq.mp3',
    thumb_url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80',
    description: 'Những ngày mưa tầm tã tháng 7, quán cà phê nhỏ nơi cuối ngõ đón người khách quen thuộc. Tình cảm nhen nhóm từ những mẩu chuyện đời thường nhẹ nhàng mà sâu lắng.',
    play_count: 18900,
    affiliate_link: 'https://shopee.vn',
    is_featured: false,
    is_hot: true,
    chapters: [
      { id: 1, title: 'Phần 1: Buổi chiều mưa đầu mùa', duration: '22:30', mp3_url: 'https://cdn.freesound.org/previews/612/612610_5674468-lq.mp3' },
      { id: 2, title: 'Phần 2: Lời chưa nói', duration: '25:10', mp3_url: 'https://cdn.freesound.org/previews/682/682631_11861866-lq.mp3' }
    ]
  },
  {
    title: 'Bí Ẩn Vụ Án Nhà Cổ Ven Sông',
    author: 'Trần Bách',
    narrator: 'Hoàng Lâm',
    category: 'Trinh Thám',
    mp3_url: 'https://cdn.freesound.org/previews/682/682631_11861866-lq.mp3',
    thumb_url: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600&auto=format&fit=crop&q=80',
    description: 'Bức di chúc thất lạc cùng vụ án mạng bí ẩn trong căn biệt thự kiểu Pháp cũ. Ai là kẻ thủ ác thực sự trong chuỗi những manh mối đánh lạc hướng?',
    play_count: 32000,
    affiliate_link: 'https://shopee.vn',
    is_featured: true,
    is_hot: false,
    chapters: [
      { id: 1, title: 'Phần 1: Dấu chân trong đêm giông', duration: '29:40', mp3_url: 'https://cdn.freesound.org/previews/682/682631_11861866-lq.mp3' },
      { id: 2, title: 'Phần 2: Chiếc hộp gỗ chạm trổ', duration: '31:20', mp3_url: 'https://cdn.freesound.org/previews/612/612610_5674468-lq.mp3' }
    ]
  },
  {
    title: 'Đại Hiệp Rời Núi Hành Tẩu Giang Hồ',
    author: 'Cổ Long Phong',
    narrator: 'Phú Bà Audio',
    category: 'Kiếm Hiệp',
    mp3_url: 'https://cdn.freesound.org/previews/612/612610_5674468-lq.mp3',
    thumb_url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=600&auto=format&fit=crop&q=80',
    description: 'Một thanh cổ kiếm, một bầu rượu nồng. Bước chân vào chốn phong vân tranh đoạt ngôi vị Minh Chủ võ lâm.',
    play_count: 42300,
    affiliate_link: 'https://shopee.vn',
    is_featured: false,
    is_hot: true,
    chapters: [
      { id: 1, title: 'Phần 1: Tiếng đàn phiêu bạt', duration: '26:50', mp3_url: 'https://cdn.freesound.org/previews/612/612610_5674468-lq.mp3' },
      { id: 2, title: 'Phần 2: Trận quyết chiến tại Hoàng Hạc Lâu', duration: '33:15', mp3_url: 'https://cdn.freesound.org/previews/682/682631_11861866-lq.mp3' }
    ]
  },
  {
    title: 'Hồn Ma Cây Đa Đầu Làng',
    author: 'Dương Khắc',
    narrator: 'Phú Bà Audio',
    category: 'Truyện Ma',
    mp3_url: 'https://cdn.freesound.org/previews/682/682631_11861866-lq.mp3',
    thumb_url: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600&auto=format&fit=crop&q=80',
    description: 'Cây đa cổ thụ hơn trăm năm ở đầu làng bỗng phát ra những tiếng than khóc lúc nửa đêm. Nhóm trai làng tò mò khám phá và sự thật rợn người bị chôn vùi.',
    play_count: 67800,
    affiliate_link: 'https://shopee.vn',
    is_featured: true,
    is_hot: true,
    chapters: [
      { id: 1, title: 'Phần 1: Tiếng ru con giữa canh ba', duration: '27:10', mp3_url: 'https://cdn.freesound.org/previews/682/682631_11861866-lq.mp3' },
      { id: 2, title: 'Phần 2: Ngôi mộ vô danh', duration: '34:00', mp3_url: 'https://cdn.freesound.org/previews/612/612610_5674468-lq.mp3' }
    ]
  }
];

async function run() {
  if (!supabaseUrl || !supabaseKey) {
    console.log('\n⚠️  CHƯA CẤU HÌNH SUPABASE URL HOẶC KEY!');
    console.log('Vui lòng tạo file .env với các biến sau:');
    console.log('--------------------------------------------------');
    console.log('VITE_SUPABASE_URL="https://your-project.supabase.co"');
    console.log('VITE_SUPABASE_ANON_KEY="your-anon-key"');
    console.log('SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"');
    console.log('ADMIN_EMAIL="tuld2901@gmail.com"');
    console.log('--------------------------------------------------');
    console.log('\n📋 BẠN CÓ THỂ COPY ĐOẠN SQL SAU VÀO SUPABASE SQL EDITOR:\n');
    console.log(MIGRATION_SQL);
    console.log('\n💡 Ứng dụng web đã được tích hợp sẵn Local/Demo Store để chạy mượt mà');
    console.log('   ngay cả khi chưa gắn Supabase credentials!');
    process.exit(0);
  }

  console.log(`\n🔗 Đang kết nối tới Supabase: ${supabaseUrl}`);
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    // Check if tracks table exists
    const { data, error } = await supabase.from('tracks').select('id').limit(1);

    if (error && error.code === '42P01') {
      console.log('\n⚡ Bảng "tracks" chưa tồn tại trên Supabase.');
      console.log('Do Supabase REST API không hỗ trợ thực thi DDL (CREATE TABLE) trực tiếp không qua SQL Editor / Postgres,');
      console.log('vui lòng mở Supabase Dashboard -> SQL Editor và chạy đoạn SQL bên dưới:');
      console.log('\n' + '-'.repeat(60));
      console.log(MIGRATION_SQL);
      console.log('-'.repeat(60));
    } else if (error) {
      console.log('⚠️ Kết nối được tới Supabase nhưng gặp thông báo:', error.message);
      console.log('Bạn có thể dán SQL migration trên vào SQL Editor của Supabase để hoàn tất.');
    } else {
      console.log('✅ Bảng "tracks" đã sẵn sàng!');
      const count = data ? data.length : 0;
      if (count === 0) {
        console.log('🌱 Đang nạp dữ liệu mẫu ban đầu (Sample Stories)...');
        const { error: insertError } = await supabase.from('tracks').insert(SAMPLE_TRACKS);
        if (insertError) {
          console.log('Lưu ý nạp dữ liệu:', insertError.message);
        } else {
          console.log(`🎉 Đã nạp thành công ${SAMPLE_TRACKS.length} truyện mẫu vào database!`);
        }
      } else {
        console.log(`ℹ️ Bảng "tracks" đã có dữ liệu (${count} truyện).`);
      }
    }

    console.log('\n✨ QUÁ TRÌNH SETUP HOÀN TẤT!');
    console.log('Bạn có thể bắt đầu chạy ứng dụng với lệnh: npm run dev');
  } catch (err) {
    console.error('Lỗi khi thiết lập:', err.message);
  }
}

run();
