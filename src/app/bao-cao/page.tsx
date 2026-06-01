import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import AppShell from '@/components/AppShell';
import BaoCaoClient from './BaoCaoClient';

export const dynamic = 'force-dynamic';

export default async function BaoCaoPage() {
  const user = await requireRole(['KeToan']);

  // Lấy đơn trong ~18 tháng gần nhất (đủ để xem tháng/quý + so sánh kỳ trước).
  const since = new Date();
  since.setMonth(since.getMonth() - 18);

  const orders = await prisma.donHang.findMany({
    where: { ngayTao: { gte: since }, trangThai: { not: 'Huy' } },
    include: { khachHang: true, nv: true },
    orderBy: { ngayTao: 'desc' }
  });

  const rows = orders.map((o) => ({
    maDH: o.maDH,
    ngayTao: o.ngayTao.toISOString(),
    maKH: o.maKH,
    tenKH: o.khachHang?.tenKH || o.maKH,
    nv: o.nv?.hoTen || o.nvTao || '(không rõ)',
    lineVC: o.lineVC as string,
    tuyen: o.tuyen as string,
    tongKg: o.tongKg, tongM3: o.tongM3,
    tongGiaHang: o.tongGiaHang,
    phiMua: o.phiMua, phiBH: o.phiBH, phiVC: o.phiVC,
    shipND: o.shipND, dongGo: o.dongGo, phuThu: o.phuThu,
    tongTien: o.tongTien, daTra: o.daTra
  }));

  return (
    <AppShell user={user}>
      <BaoCaoClient rows={rows} />
    </AppShell>
  );
}
