import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import AppShell from '@/components/AppShell';
import MuaHangClient from './MuaHangClient';
import { FiInfo, FiPackage, FiHome, FiStar, FiCalendar } from 'react-icons/fi';

export const dynamic = 'force-dynamic';

export default async function MuaHangPage() {
  const user = await requireRole(['MuaHang', 'GDV']);

  const ncc = await prisma.nCC.findMany({ orderBy: { tenNCC: 'asc' } });

  // Cột `danh_muc` có thể chưa tồn tại trên DB production (chờ migration) →
  // fallback đọc các cột cũ bằng raw query để vẫn hiện được nguồn hàng.
  let nguonHang: any[];
  try {
    nguonHang = await prisma.nguonHang.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  } catch {
    const rows: any[] = await prisma.$queryRaw`
      SELECT id, ten_sp AS tenSP, ten_ncc AS tenNCC, link_taobao AS linkTaobao,
             gia_ndt AS giaNDT, moq, thoi_gian_giao AS thoiGianGiao,
             chat_luong AS chatLuong, ghi_chu AS ghiChu, created_at AS createdAt
      FROM nguon_hang ORDER BY created_at DESC LIMIT 200`;
    nguonHang = rows.map((n) => ({ ...n, danhMuc: null }));
  }

  const avg = nguonHang.length ? (nguonHang.reduce((s, n) => s + (n.chatLuong || 0), 0) / nguonHang.length).toFixed(1) : '-';

  return (
    <AppShell user={user}>
      <div className="alert alert-info">
        <FiInfo />
        <span>Bạn là <b>GDV / Mua hàng</b>. Quản lý nguồn hàng + NCC để CSKH có data tạo đơn. Sang <b>Trang GDV</b> để nhập mã GD / mã VĐ.</span>
      </div>

      <div className="kpi-row">
        <div className="kpi" style={{ ['--primary' as any]: '#7c3aed' }}><div className="kpi-label"><FiPackage /> Nguồn hàng</div><div className="kpi-value">{nguonHang.length}</div></div>
        <div className="kpi" style={{ ['--primary' as any]: '#0891b2' }}><div className="kpi-label"><FiHome /> NCC</div><div className="kpi-value">{ncc.length}</div></div>
        <div className="kpi" style={{ ['--primary' as any]: '#f59e0b' }}><div className="kpi-label"><FiStar /> Đánh giá TB</div><div className="kpi-value">{avg}</div></div>
        <div className="kpi" style={{ ['--primary' as any]: '#10b981' }}><div className="kpi-label"><FiCalendar /> Hôm nay</div><div className="kpi-value">-</div></div>
      </div>

      <MuaHangClient
        nguonHang={nguonHang.map((n) => ({
          id: n.id, tenSP: n.tenSP, danhMuc: n.danhMuc || '', tenNCC: n.tenNCC || '', linkTaobao: n.linkTaobao || '',
          giaNDT: n.giaNDT, moq: n.moq, thoiGianGiao: n.thoiGianGiao || '',
          chatLuong: n.chatLuong || 0, ghiChu: n.ghiChu || '', createdAt: n.createdAt.toISOString()
        }))}
        ncc={ncc.map((n) => ({
          id: n.id, maNCC: n.maNCC || '', tenNCC: n.tenNCC, wechat: n.wechat || '', ghiChu: n.ghiChu || ''
        }))}
      />
    </AppShell>
  );
}
