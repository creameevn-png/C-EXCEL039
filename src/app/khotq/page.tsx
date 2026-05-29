import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import KhoTqClient from './KhoTqClient';

export const dynamic = 'force-dynamic';

export default async function KhoTqPage() {
  const user = await requireRole(['KhoTQ']);

  const [pending, atW] = await Promise.all([
    prisma.donHang.findMany({
      where: { trangThai: 'NccGiaoHang' },
      include: { chiTiet: { take: 3, orderBy: { stt: 'asc' } } },
      orderBy: { ngayTao: 'desc' }
    }),
    prisma.donHang.findMany({
      where: { trangThai: 'KhoTqNhan' },
      include: { chiTiet: { take: 3, orderBy: { stt: 'asc' } } },
      orderBy: { ngayTao: 'desc' }
    })
  ]);

  const map = (o: any) => ({
    maDH: o.maDH, maVD: o.maVD || '',
    tenHang: o.chiTiet.map((c: any) => `${c.tenSP} (x${c.soLuong})`).join(' · '),
    kg: o.tongKg, m3: o.tongM3,
    web: o.chiTiet[0]?.webNguon || '',
    tuyen: o.tuyen
  });

  return <KhoTqClient user={user} pendingArrivals={pending.map(map)} atWarehouse={atW.map(map)} />;
}
