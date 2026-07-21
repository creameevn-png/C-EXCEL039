import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import AppShell from '@/components/AppShell';
import OrderDetailModalHost from '@/components/OrderDetailModal';
import CustomerDetailModalHost from '@/components/CustomerDetailModal';
import DonHangTable from './DonHangTable';
import { statusToClass, statusToLabel } from '@/lib/status';

export const dynamic = 'force-dynamic';

export default async function AdminDonHangPage({ searchParams }: { searchParams: Promise<{ trang_thai?: string }> }) {
  const user = await requireRole(['Admin']);
  const sp = await searchParams;
  const where: any = {};
  if (sp.trang_thai) where.trangThai = sp.trang_thai as any;

  const orders = await prisma.donHang.findMany({
    where, include: { khachHang: true },
    orderBy: { ngayTao: 'desc' }, take: 500
  });

  // Danh sách nhân viên vai GDV/Mua hàng để gán xử lý cho đơn (giống màn CSKH).
  const gdvs = await prisma.nhanVien.findMany({
    where: { vaiTro: { in: ['GDV', 'MuaHang'] }, trangThai: 'HoatDong' },
    select: { id: true, hoTen: true }
  });

  const STATUSES = ['DonMoiTao', 'DatCoc', 'DaMuaHang', 'NccGiaoHang', 'KhoTqNhan', 'DangVanChuyen', 'KhoVnNhan', 'ChoThanhToan', 'GiaoHang', 'HoanThanh', 'Huy'];

  return (
    <AppShell user={user} subtitle={`${orders.length} đơn`}>
      <div className="form-section">
        <div style={{ marginBottom: 14, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <a href="/admin/don-hang" className="btn btn-sm" style={{ background: !sp.trang_thai ? 'var(--primary)' : undefined, color: !sp.trang_thai ? 'white' : undefined }}>
            Tất cả
          </a>
          {STATUSES.map((s) => (
            <a key={s} href={`/admin/don-hang?trang_thai=${s}`} className={`status-badge ${statusToClass(s)}`} style={{ textDecoration: 'none', opacity: sp.trang_thai === s ? 1 : 0.6 }}>
              {statusToLabel(s)}
            </a>
          ))}
        </div>

        <DonHangTable gdvs={gdvs} orders={orders.map((o) => ({
          maDH: o.maDH, ngayTao: o.ngayTao.toISOString(),
          tenKH: o.khachHang?.tenKH || '', maKH: o.maKH,
          tongTien: o.tongTien, conLai: o.conLai, trangThai: o.trangThai,
          nvTao: o.nvTao || '', maGD: o.maGD || '', maVD: o.maVD || '',
          gdvId: o.gdvId,
          tuyen: o.tuyen, lineVC: o.lineVC, loaiHang: o.loaiHang, pctCoc: o.pctCoc,
          shipND: o.shipND, dongGo: o.dongGo, phuThu: o.phuThu, ghiChu: o.ghiChu || ''
        }))} />
      </div>
      <CustomerDetailModalHost canSeeMoney />
      <OrderDetailModalHost canSeeMoney={true} />
    </AppShell>
  );
}
