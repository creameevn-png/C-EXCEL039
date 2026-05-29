import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import KhoVnClient from './KhoVnClient';

export const dynamic = 'force-dynamic';

export default async function KhoVnPage() {
  const user = await requireRole(['KhoVN']);

  const [incoming, atVN, ready] = await Promise.all([
    prisma.donHang.findMany({
      where: { trangThai: 'DangVanChuyen' },
      include: { khachHang: true, chiTiet: { take: 2, orderBy: { stt: 'asc' } } },
      orderBy: { ngayTao: 'desc' }
    }),
    prisma.donHang.findMany({
      where: { trangThai: 'ChoThanhToan' },
      include: { khachHang: true, chiTiet: { take: 2, orderBy: { stt: 'asc' } } },
      orderBy: { ngayTao: 'desc' }
    }),
    prisma.donHang.findMany({
      where: { trangThai: { in: ['KhoVnNhan', 'GiaoHang'] } },
      include: { khachHang: true, chiTiet: { take: 2, orderBy: { stt: 'asc' } } },
      orderBy: { ngayTao: 'desc' }
    })
  ]);

  const mapO = (o: any) => ({
    maDH: o.maDH, maVD: o.maVD || '',
    tenKH: o.khachHang?.tenKH || '',
    tenHang: o.chiTiet.map((c: any) => `${c.tenSP} (x${c.soLuong})`).join(' · '),
    tuyen: o.tuyen,
    conLai: o.conLai
  });

  return <KhoVnClient user={user}
    incomingShipments={incoming.map(mapO)}
    atWarehouse={atVN.map(mapO)}
    readyToDeliver={ready.map(mapO)} />;
}
