import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import GdvClient from './GdvClient';

export const dynamic = 'force-dynamic';

export default async function GdvPage() {
  const user = await requireRole(['GDV']);
  const pending = await prisma.donHang.findMany({
    where: { trangThai: { in: ['DatCoc', 'DaMuaHang'] } },
    include: { khachHang: true, chiTiet: { take: 3, orderBy: { stt: 'asc' } } },
    orderBy: { ngayTao: 'desc' }
  });
  return <GdvClient user={user} pendingOrders={pending.map((o) => ({
    maDH: o.maDH, tenKH: o.khachHang?.tenKH || '',
    web: o.chiTiet[0]?.webNguon || '',
    tongKg: o.tongKg, tuyen: o.tuyen,
    tongTien: o.tongTien, daTra: o.daTra,
    tenHang: o.chiTiet.map((c) => `${c.tenSP} (x${c.soLuong})`).join(' · '),
    maGD: o.maGD || '', maVD: o.maVD || '', trangThai: o.trangThai
  }))} />;
}
