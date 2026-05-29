import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import AppShell from '@/components/AppShell';
import MuaHangClient from './MuaHangClient';
import { FiInfo, FiPackage, FiHome, FiStar, FiCalendar } from 'react-icons/fi';

export const dynamic = 'force-dynamic';

export default async function MuaHangPage() {
  const user = await requireRole(['MuaHang']);

  const [nguonHang, ncc] = await Promise.all([
    prisma.nguonHang.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }),
    prisma.nCC.findMany({ orderBy: { tenNCC: 'asc' } })
  ]);

  const avg = nguonHang.length ? (nguonHang.reduce((s, n) => s + (n.chatLuong || 0), 0) / nguonHang.length).toFixed(1) : '-';

  return (
    <AppShell user={user}>
      <div className="alert alert-info">
        <FiInfo />
        <span>Bạn là <b>Mua hàng</b>. Quản lý nguồn hàng + NCC để CSKH có data tạo đơn.</span>
      </div>

      <div className="kpi-row">
        <div className="kpi" style={{ ['--primary' as any]: '#7c3aed' }}><div className="kpi-label"><FiPackage /> Nguồn hàng</div><div className="kpi-value">{nguonHang.length}</div></div>
        <div className="kpi" style={{ ['--primary' as any]: '#0891b2' }}><div className="kpi-label"><FiHome /> NCC</div><div className="kpi-value">{ncc.length}</div></div>
        <div className="kpi" style={{ ['--primary' as any]: '#f59e0b' }}><div className="kpi-label"><FiStar /> Đánh giá TB</div><div className="kpi-value">{avg}</div></div>
        <div className="kpi" style={{ ['--primary' as any]: '#10b981' }}><div className="kpi-label"><FiCalendar /> Hôm nay</div><div className="kpi-value">-</div></div>
      </div>

      <MuaHangClient
        nguonHang={nguonHang.map((n) => ({
          id: n.id, tenSP: n.tenSP, tenNCC: n.tenNCC || '', linkTaobao: n.linkTaobao || '',
          giaNDT: n.giaNDT, moq: n.moq, thoiGianGiao: n.thoiGianGiao || '',
          chatLuong: n.chatLuong || 0, createdAt: n.createdAt.toISOString()
        }))}
        ncc={ncc.map((n) => ({
          id: n.id, maNCC: n.maNCC || '', tenNCC: n.tenNCC, wechat: n.wechat || '', ghiChu: n.ghiChu || ''
        }))}
      />
    </AppShell>
  );
}
