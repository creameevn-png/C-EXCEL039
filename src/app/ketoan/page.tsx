import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import KeToanClient from './KeToanClient';

export const dynamic = 'force-dynamic';

export default async function KeToanPage() {
  const user = await requireRole(['KeToan']);

  const [orders, customers] = await Promise.all([
    prisma.donHang.findMany({
      where: {
        trangThai: { in: ['DaMuaHang', 'NccGiaoHang', 'KhoTqNhan', 'DangVanChuyen', 'KhoVnNhan', 'ChoThanhToan'] }
      },
      include: { khachHang: true, nv: true },
      orderBy: { ngayTao: 'desc' }
    }),
    prisma.khachHang.findMany({ orderBy: { maKH: 'asc' }, select: { maKH: true, tenKH: true, sdt: true, soDuVi: true } })
  ]);

  // Cột `quy` có thể chưa tồn tại trên DB production (chờ migration) → tránh 500 cả trang.
  let walletTxns: any[] = [];
  try {
    walletTxns = await prisma.giaoDichVi.findMany({ orderBy: { ngay: 'desc' }, take: 120, include: { khachHang: true } });
  } catch {
    walletTxns = [];
  }

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

  return (
    <KeToanClient
      user={user}
      pendingPayments={pending}
      customers={customers.map((c) => ({ maKH: c.maKH, tenKH: c.tenKH, sdt: c.sdt || '', soDuVi: c.soDuVi }))}
      walletTxns={walletTxns.map((t) => ({
        id: t.id, ngay: t.ngay.toISOString(), maKH: t.maKH,
        tenKH: t.khachHang?.tenKH || t.maKH, loai: t.loai,
        soTien: t.soTien, soDuSau: t.soDuSau, quy: t.quy || '', ghiChu: t.ghiChu || '', nv: t.nv || ''
      }))}
    />
  );
}
