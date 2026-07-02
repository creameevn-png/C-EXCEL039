import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import AppShell from '@/components/AppShell';
import BaoCaoClient from './BaoCaoClient';
import OrderDetailModalHost from '@/components/OrderDetailModal';

export const dynamic = 'force-dynamic';

export default async function BaoCaoPage() {
  const user = await requireRole(['KeToan']);

  // Lấy đơn trong ~18 tháng gần nhất (đủ để xem tháng/quý + so sánh kỳ trước).
  const since = new Date();
  since.setMonth(since.getMonth() - 18);

  const [orders, khieuNai, thanhToan, tonKhoOrders] = await Promise.all([
    prisma.donHang.findMany({
      where: { ngayTao: { gte: since }, trangThai: { not: 'Huy' } },
      include: { khachHang: true, nv: true },
      orderBy: { ngayTao: 'desc' }
    }),
    prisma.khieuNai.findMany({
      where: { ngayTao: { gte: since } },
      orderBy: { ngayTao: 'desc' }
    }),
    // Dòng tiền thu–chi (item 19): các bút toán thu/chi thực tế.
    prisma.thanhToan.findMany({
      where: { ngay: { gte: since } },
      orderBy: { ngay: 'desc' }
    }),
    // Tồn kho TQ & VN (item 17): ảnh chụp hiện tại các đơn còn trong kho/đang về.
    prisma.donHang.findMany({
      where: { trangThai: { in: ['KhoTqNhan', 'DangVanChuyen', 'KhoVnNhan', 'ChoThanhToan', 'GiaoHang'] } },
      include: { khachHang: true },
      orderBy: { ngayTao: 'asc' }
    })
  ]);

  const rows = orders.map((o) => ({
    maDH: o.maDH,
    ngayTao: o.ngayTao.toISOString(),
    maKH: o.maKH,
    tenKH: o.khachHang?.tenKH || o.maKH,
    nv: o.nv?.hoTen || o.nvTao || '(không rõ)',
    lineVC: o.lineVC as string,
    tuyen: o.tuyen as string,
    trangThai: o.trangThai as string,
    tongKg: o.tongKg, tongM3: o.tongM3,
    tongGiaHang: o.tongGiaHang,
    phiMua: o.phiMua, phiBH: o.phiBH, phiPhatSinh: o.phiPhatSinh, phiVC: o.phiVC,
    shipND: o.shipND, dongGo: o.dongGo, phuThu: o.phuThu,
    vonNDT: o.vonNDT, shipNDTQ: o.shipNDTQ, loiNhuanNDT: o.loiNhuanNDT,
    tongTien: o.tongTien, daTra: o.daTra, conLai: o.conLai
  }));

  const knRows = khieuNai.map((k) => ({
    maKN: k.maKN, ngayTao: k.ngayTao.toISOString(),
    maKH: k.maKH || '', maDH: k.maDH || '',
    loai: k.loai as string, trangThai: k.trangThai as string,
    soTienHoan: k.soTienHoan, phiDoiTra: k.phiDoiTra
  }));

  const cashRows = thanhToan.map((t) => ({
    ngay: t.ngay.toISOString(), maDH: t.maDH || '',
    loai: t.loai as string, soTien: t.soTien, ghiChu: t.ghiChu || '', nv: t.nv || ''
  }));

  const tonKhoRows = tonKhoOrders.map((o) => ({
    maDH: o.maDH, maKH: o.maKH, tenKH: o.khachHang?.tenKH || o.maKH,
    trangThai: o.trangThai as string, tongKg: o.tongKg, tongM3: o.tongM3
  }));

  return (
    <AppShell user={user}>
      <BaoCaoClient rows={rows} knRows={knRows} cashRows={cashRows} tonKhoRows={tonKhoRows} />
      <OrderDetailModalHost canSeeMoney={['Admin', 'CSKH', 'KeToan'].includes(user.vaiTro)} canSeeProfit={['Admin', 'KeToan', 'GDV'].includes(user.vaiTro)} />
    </AppShell>
  );
}
