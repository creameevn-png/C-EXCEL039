import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import KhoVnClient from './KhoVnClient';

export const dynamic = 'force-dynamic';

export default async function KhoVnPage() {
  const user = await requireRole(['KhoVN']);

  const [incoming, atVN, ready, baos] = await Promise.all([
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
    }),
    prisma.baoTong.findMany({
      where: { trangThai: { in: ['DaXuat', 'DaVeVN'] } },
      orderBy: { xuatAt: 'desc' },
      take: 100,
    })
  ]);

  // Đếm số đơn đã/chưa nhận theo bao
  const baoOrders = await prisma.donHang.findMany({
    where: { maBao: { in: baos.map((b) => b.maBao) } },
    select: { maBao: true, trangThai: true }
  });

  const mapO = (o: any) => ({
    maDH: o.maDH, maVD: o.maVD || '', maBao: o.maBao || '',
    tenKH: o.khachHang?.tenKH || '',
    tenHang: o.chiTiet.map((c: any) => `${c.tenSP} (x${c.soLuong})`).join(' · '),
    tuyen: o.tuyen,
    conLai: o.conLai, shipND: o.shipND,
    diaChiNhan: o.diaChiNhan || '', nguoiNhan: o.nguoiNhan || '', sdtNhan: o.sdtNhan || ''
  });

  return <KhoVnClient user={user}
    incomingShipments={incoming.map(mapO)}
    atWarehouse={atVN.map(mapO)}
    readyToDeliver={ready.map(mapO)}
    baos={baos.map((b) => {
      const ords = baoOrders.filter((o) => o.maBao === b.maBao);
      return {
        maBao: b.maBao, line: b.line, trangThai: b.trangThai,
        tongKg: b.tongKg, tongM3: b.tongM3, soKien: b.soKien,
        daNhan: ords.filter((o) => o.trangThai !== 'DangVanChuyen').length,
        tong: ords.length
      };
    })} />;
}
