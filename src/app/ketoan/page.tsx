import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import KeToanClient from './KeToanClient';

export const dynamic = 'force-dynamic';

export default async function KeToanPage() {
  const user = await requireRole(['KeToan']);

  const orders = await prisma.donHang.findMany({
    where: {
      trangThai: { in: ['DaMuaHang', 'NccGiaoHang', 'KhoTqNhan', 'DangVanChuyen', 'KhoVnNhan', 'ChoThanhToan'] }
    },
    include: { khachHang: true, nv: true },
    orderBy: { ngayTao: 'desc' }
  });

  const pending = orders
    .map((o) => ({
      maDH: o.maDH,
      tenKH: o.khachHang?.tenKH || '',
      maGD: o.maGD || '',
      nv: o.nv?.hoTen || o.nvTao || '',
      tongTien: o.tongTien,
      daTra: o.daTra,
      conLai: o.conLai,
      trangThai: o.trangThai
    }))
    .filter((o) => o.conLai > 0.5);

  return <KeToanClient user={user} pendingPayments={pending} />;
}
