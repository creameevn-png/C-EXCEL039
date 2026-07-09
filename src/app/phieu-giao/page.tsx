import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import PhieuGiaoClient from './PhieuGiaoClient';
import OrderDetailModalHost from '@/components/OrderDetailModal';

export const dynamic = 'force-dynamic';

export default async function PhieuGiaoPage() {
  const user = await requireRole(['CSKH', 'KhoVN', 'KeToan']);

  const [candidates, phieus] = await Promise.all([
    prisma.donHang.findMany({
      where: {
        maPhieuGiao: null,
        trangThai: { in: ['ChoThanhToan', 'KhoVnNhan', 'GiaoHang', 'HoanThanh'] }
      },
      include: { khachHang: true, chiTiet: { take: 2, orderBy: { stt: 'asc' } } },
      orderBy: { ngayTao: 'desc' },
      take: 300,
    }),
    prisma.phieuGiao.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
  ]);

  return (
    <>
    <PhieuGiaoClient
    user={user}
    candidates={candidates.map((o) => ({
      maDH: o.maDH, maKH: o.maKH, tenKH: o.khachHang?.tenKH || '',
      hang: o.chiTiet.map((c) => `${c.tenSP} (x${c.soLuong})`).join(', '),
      tongTien: o.tongTien, daTra: o.daTra, conLai: o.conLai, trangThai: o.trangThai
    }))}
    phieus={phieus.map((p) => ({
      maPhieu: p.maPhieu, maKH: p.maKH, tenKH: p.tenKH || '',
      soDon: p.soDon, tongTien: p.tongTien, daThu: p.daThu, conLai: p.conLai,
      nguoiTao: p.nguoiTao || '', createdAt: p.createdAt.toISOString()
    }))}
  />
    <OrderDetailModalHost canSeeMoney={['Admin', 'CSKH', 'KeToan'].includes(user.vaiTro)} canSeeProfit={['Admin', 'KeToan', 'GDV', 'MuaHang'].includes(user.vaiTro)} />
    </>
  );
}
