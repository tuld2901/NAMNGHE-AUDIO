import React from 'react';
import { 
  Activity, RefreshCw, Trash2, Users, Eye, MousePointerClick, 
  TrendingUp, BarChart3, Globe, Smartphone, Monitor, Tablet,
  Compass, ArrowUpRight, ShieldCheck, CheckCircle2
} from 'lucide-react';
import { TrafficAnalyticsResponse } from '../services/api';

interface AdminTrafficProps {
  trafficStats: TrafficAnalyticsResponse | null;
  isLoading: boolean;
  onRefresh: () => void;
  onReset: () => void;
}

export const AdminTraffic: React.FC<AdminTrafficProps> = ({
  trafficStats,
  isLoading,
  onRefresh,
  onReset,
}) => {
  const summary = trafficStats?.summary || {
    totalPageviews: 0,
    totalUniqueVisitors: 0,
    todayPageviews: 0,
    todayUniqueVisitors: 0,
    activeNow: 1,
    totalUnlockClicks: 0,
    todayUnlockClicks: 0,
    conversionRate: '0.0%',
  };

  const daily = trafficStats?.daily || [];
  const maxDailyViews = Math.max(1, ...daily.map(d => d.pageviews));

  // Tính tỷ lệ phần trăm phân bổ
  const calcPercent = (count: number, total: number) => {
    if (!total || total <= 0) return '0%';
    return `${Math.round((count / total) * 100)}%`;
  };

  const totalDeviceVisits = Object.values(trafficStats?.devices || {}).reduce((a, b) => a + b, 0);
  const totalOsVisits = Object.values(trafficStats?.operatingSystems || {}).reduce((a, b) => a + b, 0);
  const totalBrowserVisits = Object.values(trafficStats?.browsers || {}).reduce((a, b) => a + b, 0);
  const totalSourceVisits = Object.values(trafficStats?.sources || {}).reduce((a, b) => a + b, 0);

  // Format ngày dd/mm
  const formatShortDate = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}`;
    }
    return dateStr;
  };

  // Format relative time
  const formatRelativeTime = (isoString: string) => {
    try {
      const now = Date.now();
      const past = new Date(isoString).getTime();
      const diffSecs = Math.floor((now - past) / 1000);

      if (diffSecs < 15) return 'Vừa xong';
      if (diffSecs < 60) return `${diffSecs} giây trước`;
      const diffMins = Math.floor(diffSecs / 60);
      if (diffMins < 60) return `${diffMins} phút trước`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours} giờ trước`;
      return new Date(isoString).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-[#d1d1d1]">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[#181818] border border-[#282828] shadow-lg">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1ed760]/10 border border-[#1ed760]/30 flex items-center justify-center text-[#1ed760]">
              <Activity size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Đo Lường & Phân Tích Traffic Website
                </h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>{summary.activeNow} đang online</span>
                </span>
              </div>
              <p className="text-xs text-[#b3b3b3] mt-0.5">
                Theo dõi khách truy cập thực tế, thiết bị (iOS / Android / PC), trình duyệt (Safari / Zalo / Chrome) và tỷ lệ mở khóa nghe truyện
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#242424] hover:bg-[#2e2e2e] text-white flex items-center gap-1.5 border border-[#333333] transition cursor-pointer disabled:opacity-50"
            title="Làm mới số liệu"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin text-[#1ed760]' : ''} />
            <span>Làm Mới</span>
          </button>

          <button
            onClick={onReset}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 transition cursor-pointer flex items-center gap-1.5"
            title="Xóa dữ liệu đo lường để thống kê lại từ đầu"
          >
            <Trash2 size={14} />
            <span>Xóa Lịch Sử</span>
          </button>
        </div>
      </div>

      {/* 2. Top KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Card 1: Hôm nay - Pageviews */}
        <div className="p-4 rounded-2xl bg-[#181818] border border-[#282828] hover:border-[#1ed760]/40 transition space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[#b3b3b3]">
            <span className="font-medium truncate">Lượt xem hôm nay</span>
            <Eye size={15} className="text-[#1ed760] shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-white tracking-tight">
            {summary.todayPageviews.toLocaleString('vi-VN')}
          </div>
          <div className="text-[11px] text-emerald-400 font-medium truncate">
            {summary.todayPageviews > 0 ? '✓ Đang hoạt động' : 'Chưa có lượt mới'}
          </div>
        </div>

        {/* Card 2: Hôm nay - Khách duy nhất */}
        <div className="p-4 rounded-2xl bg-[#181818] border border-[#282828] hover:border-sky-500/40 transition space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[#b3b3b3]">
            <span className="font-medium truncate">Khách hôm nay</span>
            <Users size={15} className="text-sky-400 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-white tracking-tight">
            {summary.todayUniqueVisitors.toLocaleString('vi-VN')}
          </div>
          <div className="text-[11px] text-sky-400 font-medium truncate">
            Thiết bị truy cập độc nhất
          </div>
        </div>

        {/* Card 3: Tổng lượt xem trang */}
        <div className="p-4 rounded-2xl bg-[#181818] border border-[#282828] hover:border-purple-500/40 transition space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[#b3b3b3]">
            <span className="font-medium truncate">Tổng lượt xem trang</span>
            <BarChart3 size={15} className="text-purple-400 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-white tracking-tight">
            {summary.totalPageviews.toLocaleString('vi-VN')}
          </div>
          <div className="text-[11px] text-[#8e8e8e] truncate">
            Tất cả lượt tải trang
          </div>
        </div>

        {/* Card 4: Tổng khách độc nhất */}
        <div className="p-4 rounded-2xl bg-[#181818] border border-[#282828] hover:border-amber-500/40 transition space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[#b3b3b3]">
            <span className="font-medium truncate">Tổng khách truy cập</span>
            <Globe size={15} className="text-amber-400 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-white tracking-tight">
            {summary.totalUniqueVisitors.toLocaleString('vi-VN')}
          </div>
          <div className="text-[11px] text-[#8e8e8e] truncate">
            Khách phân biệt IP / Thiết bị
          </div>
        </div>

        {/* Card 5: Lượt mở khóa nghe */}
        <div className="p-4 rounded-2xl bg-[#181818] border border-[#282828] hover:border-rose-500/40 transition space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[#b3b3b3]">
            <span className="font-medium truncate">Mở khóa nghe audio</span>
            <MousePointerClick size={15} className="text-rose-400 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-white tracking-tight">
            {summary.totalUnlockClicks.toLocaleString('vi-VN')}
          </div>
          <div className="text-[11px] text-rose-400 font-medium truncate">
            Hôm nay: {summary.todayUnlockClicks} click
          </div>
        </div>

        {/* Card 6: Tỷ lệ chuyển đổi mở khóa */}
        <div className="p-4 rounded-2xl bg-[#181818] border border-[#282828] hover:border-emerald-500/40 transition space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[#b3b3b3]">
            <span className="font-medium truncate">Tỷ lệ mở khóa</span>
            <TrendingUp size={15} className="text-emerald-400 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-[#1ed760] tracking-tight">
            {summary.conversionRate}
          </div>
          <div className="text-[11px] text-[#8e8e8e] truncate">
            Tỷ lệ click link shopee/sp
          </div>
        </div>
      </div>

      {/* 3. Xu Hướng Truy Cập 14 Ngày Gần Nhất (Visual Trend & Table) */}
      <div className="p-5 rounded-2xl bg-[#181818] border border-[#282828] shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#282828] pb-3">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <BarChart3 size={18} className="text-[#1ed760]" />
              <span>Biểu Đồ Xu Hướng 14 Ngày Gần Nhất</span>
            </h3>
            <p className="text-xs text-[#b3b3b3] mt-0.5">
              So sánh lượng truy cập (Lượt xem trang, Khách duy nhất, và Lượt mở khóa nghe)
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-[#b3b3b3]">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-[#1ed760] inline-block"></span>
              <span>Lượt xem trang</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-sky-400 inline-block"></span>
              <span>Khách duy nhất</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-rose-400 inline-block"></span>
              <span>Mở khóa nghe</span>
            </div>
          </div>
        </div>

        {/* Visual Bar Columns */}
        <div className="pt-2 pb-1">
          <div className="h-44 flex items-end justify-between gap-1 sm:gap-2 px-1">
            {daily.map((item, idx) => {
              const viewHeight = Math.max(8, Math.round((item.pageviews / maxDailyViews) * 100));
              const visitorHeight = Math.max(6, Math.round((item.uniqueVisitors / maxDailyViews) * 100));
              const unlockHeight = Math.max(4, Math.round((item.unlockClicks / maxDailyViews) * 100));
              const isToday = idx === daily.length - 1;

              return (
                <div key={item.date} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group relative">
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col p-2 bg-[#282828] text-white text-[11px] rounded-lg border border-[#3e3e3e] shadow-xl whitespace-nowrap z-20 pointer-events-none">
                    <span className="font-bold text-[#1ed760]">{item.date} {isToday ? '(Hôm nay)' : ''}</span>
                    <span>• Lượt xem: {item.pageviews}</span>
                    <span>• Khách: {item.uniqueVisitors}</span>
                    <span>• Mở khóa: {item.unlockClicks}</span>
                  </div>

                  {/* Bars */}
                  <div className="w-full flex items-end justify-center gap-0.5 sm:gap-1 h-36">
                    {/* View Bar */}
                    <div
                      style={{ height: `${viewHeight}%` }}
                      className={`w-2 sm:w-3 rounded-t transition-all duration-300 ${
                        isToday ? 'bg-[#1ed760]' : 'bg-[#1ed760]/70 group-hover:bg-[#1ed760]'
                      }`}
                    ></div>
                    {/* Visitor Bar */}
                    <div
                      style={{ height: `${visitorHeight}%` }}
                      className={`w-2 sm:w-3 rounded-t transition-all duration-300 ${
                        isToday ? 'bg-sky-400' : 'bg-sky-400/60 group-hover:bg-sky-400'
                      }`}
                    ></div>
                    {/* Unlock Bar */}
                    {item.unlockClicks > 0 && (
                      <div
                        style={{ height: `${unlockHeight}%` }}
                        className="w-1.5 sm:w-2 rounded-t bg-rose-400/80 group-hover:bg-rose-400 transition-all duration-300"
                      ></div>
                    )}
                  </div>

                  {/* Label Date */}
                  <span className={`text-[10px] truncate ${isToday ? 'font-bold text-[#1ed760]' : 'text-[#8e8e8e]'}`}>
                    {formatShortDate(item.date)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detailed Table for Last 7-14 Days */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#282828] text-[#8e8e8e]">
                <th className="py-2.5 px-3 font-semibold">Ngày</th>
                <th className="py-2.5 px-3 font-semibold">Lượt Xem Trang</th>
                <th className="py-2.5 px-3 font-semibold">Khách Duy Nhất</th>
                <th className="py-2.5 px-3 font-semibold">Click Mở Khóa</th>
                <th className="py-2.5 px-3 font-semibold text-right">Tỷ Lệ Mở Khóa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222222]">
              {[...daily].reverse().slice(0, 7).map((d, index) => {
                const rate = d.pageviews > 0 ? ((d.unlockClicks / d.pageviews) * 100).toFixed(1) + '%' : '0.0%';
                const isToday = index === 0;

                return (
                  <tr key={d.date} className="hover:bg-[#202020] transition-colors">
                    <td className="py-2.5 px-3 font-mono text-white flex items-center gap-1.5">
                      <span>{d.date}</span>
                      {isToday && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#1ed760]/20 text-[#1ed760] font-sans font-bold">
                          Hôm nay
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-white">
                      {d.pageviews.toLocaleString('vi-VN')}
                    </td>
                    <td className="py-2.5 px-3 text-sky-400 font-medium">
                      {d.uniqueVisitors.toLocaleString('vi-VN')}
                    </td>
                    <td className="py-2.5 px-3 text-rose-300 font-medium">
                      {d.unlockClicks.toLocaleString('vi-VN')}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-[#1ed760] font-semibold">
                      {rate}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Grid 4 Trụ Cột: Thiết Bị, Hệ Điều Hành, Trình Duyệt/WebView, Nguồn Khách */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Box 1: Thiết Bị (Device) */}
        <div className="p-4 rounded-2xl bg-[#181818] border border-[#282828] space-y-3">
          <div className="flex items-center justify-between border-b border-[#282828] pb-2">
            <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
              <Smartphone size={16} className="text-[#1ed760]" />
              <span>Thiết Bị</span>
            </h4>
            <span className="text-[11px] text-[#8e8e8e]">{totalDeviceVisits} lượt</span>
          </div>

          <div className="space-y-2.5">
            {[
              { label: 'Mobile (Điện thoại)', key: 'Mobile', count: trafficStats?.devices?.Mobile || 0, color: 'bg-[#1ed760]' },
              { label: 'Desktop (Máy tính)', key: 'Desktop', count: trafficStats?.devices?.Desktop || 0, color: 'bg-sky-400' },
              { label: 'Tablet (Máy tính bảng)', key: 'Tablet', count: trafficStats?.devices?.Tablet || 0, color: 'bg-purple-400' },
            ].map(item => {
              const pct = calcPercent(item.count, totalDeviceVisits);
              return (
                <div key={item.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white font-medium">{item.label}</span>
                    <span className="font-mono text-[#b3b3b3]">{item.count} ({pct})</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#282828] rounded-full overflow-hidden">
                    <div style={{ width: pct }} className={`h-full ${item.color} rounded-full transition-all`}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Box 2: Hệ Điều Hành (OS) */}
        <div className="p-4 rounded-2xl bg-[#181818] border border-[#282828] space-y-3">
          <div className="flex items-center justify-between border-b border-[#282828] pb-2">
            <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
              <Monitor size={16} className="text-sky-400" />
              <span>Hệ Điều Hành</span>
            </h4>
            <span className="text-[11px] text-[#8e8e8e]">{totalOsVisits} lượt</span>
          </div>

          <div className="space-y-2.5">
            {[
              { label: 'iOS (iPhone / iPad)', count: trafficStats?.operatingSystems?.iOS || 0, color: 'bg-[#1ed760]' },
              { label: 'Android', count: trafficStats?.operatingSystems?.Android || 0, color: 'bg-emerald-400' },
              { label: 'Windows', count: trafficStats?.operatingSystems?.Windows || 0, color: 'bg-sky-400' },
              { label: 'macOS', count: trafficStats?.operatingSystems?.macOS || 0, color: 'bg-indigo-400' },
              { label: 'Khác', count: trafficStats?.operatingSystems?.Khác || 0, color: 'bg-zinc-500' },
            ].map(item => {
              const pct = calcPercent(item.count, totalOsVisits);
              return (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white font-medium">{item.label}</span>
                    <span className="font-mono text-[#b3b3b3]">{item.count} ({pct})</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#282828] rounded-full overflow-hidden">
                    <div style={{ width: pct }} className={`h-full ${item.color} rounded-full transition-all`}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Box 3: Trình Duyệt & In-App WebView (Rất hữu ích để xem khách Zalo/Facebook) */}
        <div className="p-4 rounded-2xl bg-[#181818] border border-[#282828] space-y-3">
          <div className="flex items-center justify-between border-b border-[#282828] pb-2">
            <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
              <Compass size={16} className="text-amber-400" />
              <span>Trình Duyệt & WebView</span>
            </h4>
            <span className="text-[11px] text-[#8e8e8e]">{totalBrowserVisits} lượt</span>
          </div>

          <div className="space-y-2.5">
            {[
              { label: 'Safari (iOS chuẩn)', count: trafficStats?.browsers?.Safari || 0, color: 'bg-[#1ed760]' },
              { label: 'Chrome', count: trafficStats?.browsers?.Chrome || 0, color: 'bg-sky-400' },
              { label: 'Zalo In-App WebView', count: trafficStats?.browsers?.['Zalo In-App'] || 0, color: 'bg-amber-400' },
              { label: 'Facebook In-App', count: trafficStats?.browsers?.['Facebook In-App'] || 0, color: 'bg-blue-500' },
              { label: 'TikTok In-App', count: trafficStats?.browsers?.['TikTok In-App'] || 0, color: 'bg-rose-400' },
              { label: 'Khác (Edge/Firefox)', count: (trafficStats?.browsers?.Edge || 0) + (trafficStats?.browsers?.Firefox || 0) + (trafficStats?.browsers?.Khác || 0), color: 'bg-zinc-500' },
            ].map(item => {
              const pct = calcPercent(item.count, totalBrowserVisits);
              return (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white font-medium truncate pr-1">{item.label}</span>
                    <span className="font-mono text-[#b3b3b3] shrink-0">{item.count} ({pct})</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#282828] rounded-full overflow-hidden">
                    <div style={{ width: pct }} className={`h-full ${item.color} rounded-full transition-all`}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Box 4: Nguồn Khách Đến (Referrers) */}
        <div className="p-4 rounded-2xl bg-[#181818] border border-[#282828] space-y-3">
          <div className="flex items-center justify-between border-b border-[#282828] pb-2">
            <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
              <ArrowUpRight size={16} className="text-purple-400" />
              <span>Nguồn Truy Cập</span>
            </h4>
            <span className="text-[11px] text-[#8e8e8e]">{totalSourceVisits} lượt</span>
          </div>

          <div className="space-y-2.5">
            {[
              { label: 'Trực tiếp (URL/Bookmark)', count: trafficStats?.sources?.['Trực tiếp'] || 0, color: 'bg-[#1ed760]' },
              { label: 'Từ Zalo', count: trafficStats?.sources?.Zalo || 0, color: 'bg-sky-400' },
              { label: 'Từ Facebook', count: trafficStats?.sources?.Facebook || 0, color: 'bg-blue-500' },
              { label: 'Từ TikTok', count: trafficStats?.sources?.TikTok || 0, color: 'bg-rose-400' },
              { label: 'Từ Google Tìm kiếm', count: trafficStats?.sources?.Google || 0, color: 'bg-amber-400' },
              { label: 'Từ Shopee', count: trafficStats?.sources?.Shopee || 0, color: 'bg-orange-500' },
              { label: 'Nguồn khác', count: trafficStats?.sources?.Khác || 0, color: 'bg-zinc-500' },
            ].map(item => {
              const pct = calcPercent(item.count, totalSourceVisits);
              return (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white font-medium truncate pr-1">{item.label}</span>
                    <span className="font-mono text-[#b3b3b3] shrink-0">{item.count} ({pct})</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#282828] rounded-full overflow-hidden">
                    <div style={{ width: pct }} className={`h-full ${item.color} rounded-full transition-all`}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 5. Top Trang & Truyện Được Xem Nhiều Nhất */}
      <div className="p-5 rounded-2xl bg-[#181818] border border-[#282828] shadow-lg space-y-3">
        <div className="flex items-center justify-between border-b border-[#282828] pb-3">
          <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
            <Globe size={18} className="text-[#1ed760]" />
            <span>Top Đường Dẫn / Truyện Được Xem Nhiều Nhất</span>
          </h3>
          <span className="text-xs text-[#b3b3b3]">
            {trafficStats?.topPages?.length || 0} trang có lượt xem
          </span>
        </div>

        {trafficStats?.topPages && trafficStats.topPages.length > 0 ? (
          <div className="divide-y divide-[#242424]">
            {trafficStats.topPages.map((page, index) => {
              const topCount = trafficStats.topPages[0]?.count || 1;
              const barWidth = Math.max(5, Math.round((page.count / topCount) * 100));

              return (
                <div key={page.path} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      index === 0
                        ? 'bg-[#1ed760] text-black font-extrabold'
                        : index === 1
                        ? 'bg-sky-400 text-black'
                        : index === 2
                        ? 'bg-amber-400 text-black'
                        : 'bg-[#282828] text-[#8e8e8e]'
                    }`}>
                      {index + 1}
                    </span>
                    <div className="truncate font-mono text-[#e1e1e1]">
                      {page.path === '/' ? 'Trang chủ (/)' : page.path}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-24 sm:w-36 h-2 bg-[#282828] rounded-full overflow-hidden hidden sm:block">
                      <div style={{ width: `${barWidth}%` }} className="h-full bg-[#1ed760] rounded-full"></div>
                    </div>
                    <span className="font-bold text-white font-mono w-14 text-right">
                      {page.count.toLocaleString('vi-VN')} <span className="text-[10px] text-[#8e8e8e] font-normal">lượt</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-[#8e8e8e]">
            Chưa có ghi nhận lượt xem trang nào.
          </div>
        )}
      </div>

      {/* 6. Nhật Ký Khách Truy Cập Thời Gian Thực (Live Visitor Log) */}
      <div className="p-5 rounded-2xl bg-[#181818] border border-[#282828] shadow-lg space-y-3">
        <div className="flex items-center justify-between border-b border-[#282828] pb-3">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <Activity size={18} className="text-emerald-400" />
              <span>Nhật Ký Truy Cập Trực Tuyến (Thời Gian Thực)</span>
            </h3>
            <p className="text-xs text-[#b3b3b3] mt-0.5">
              Ghi nhận các phiên truy cập mới nhất cùng thiết bị, hệ điều hành và nguồn truy cập
            </p>
          </div>
          <span className="text-xs text-[#8e8e8e]">
            {trafficStats?.recentVisits?.length || 0} lượt gần nhất
          </span>
        </div>

        {trafficStats?.recentVisits && trafficStats.recentVisits.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#282828] text-[#8e8e8e]">
                  <th className="py-2.5 px-3 font-semibold">Thời Gian</th>
                  <th className="py-2.5 px-3 font-semibold">Khách Ẩn Danh</th>
                  <th className="py-2.5 px-3 font-semibold">Thiết Bị & OS</th>
                  <th className="py-2.5 px-3 font-semibold">Trình Duyệt</th>
                  <th className="py-2.5 px-3 font-semibold">Nguồn Đến</th>
                  <th className="py-2.5 px-3 font-semibold">Trang Xem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222222]">
                {trafficStats.recentVisits.map((item) => {
                  const isZalo = item.browser === 'Zalo In-App' || item.referrerSource === 'Zalo';

                  return (
                    <tr key={item.id} className="hover:bg-[#202020] transition-colors">
                      <td className="py-2.5 px-3 font-mono text-[#b3b3b3] whitespace-nowrap">
                        {formatRelativeTime(item.timestamp)}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-medium text-white whitespace-nowrap">
                        <span className="px-1.5 py-0.5 rounded bg-[#242424] border border-[#333333] text-[11px]">
                          #{item.ipHash}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-white whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          {item.device === 'Mobile' ? (
                            <Smartphone size={13} className="text-[#1ed760]" />
                          ) : item.device === 'Tablet' ? (
                            <Tablet size={13} className="text-purple-400" />
                          ) : (
                            <Monitor size={13} className="text-sky-400" />
                          )}
                          <span>{item.device}</span>
                          <span className="text-[#6e6e6e]">•</span>
                          <span className="text-[#b3b3b3]">{item.os}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border ${
                          isZalo
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            : item.browser === 'Safari'
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : 'bg-[#242424] text-[#d1d1d1] border-[#333333]'
                        }`}>
                          {item.browser}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="text-[#b3b3b3] font-medium">
                          {item.referrerSource}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-white truncate max-w-[200px]" title={item.path}>
                        {item.path}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-[#8e8e8e]">
            Chưa có ghi nhận nhật ký truy cập nào.
          </div>
        )}
      </div>
    </div>
  );
};
