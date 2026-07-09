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
    // Góp ý NV #21: Kế toán không được thấy SĐT / email khách → chỉ lấy mã + tên.
    prisma.khachHang.findMany({ orderBy: { maKH: 'asc' }, select: { maKH: true, tenKH: true, soDuVi: true } })
  ]);

  // Cột `quy` có thể chưa tồn tại trên DB production (chờ migration) → tránh 500 cả trang.
  let walletTxns: any[] = [];
  try {
    walletTxns = await prisma.giaoDichVi.findMany({ orderBy: { ngay: 'desc' }, take: 120, include: { khachHang: true } });
  } catch {
    walletTxns = [];
  }

  // Góp ý NV #9: đơn có phí phát sinh đang chờ Kế toán duyệt (chưa cộng vào tổng tiền).
  let pendingFees: any[] = [];
  try {
    pendingFees = await prisma.donHang.findMany({
      where: { phiPhatSinh: { gt: 0 }, phiPhatSinhDuyet: false },
      include: { khachHang: true, nv: true },
      orderBy: { ngayTao: 'desc' }
    });
  } catch {
    pendingFees = [];
  }

  // Góp ý NV #22: sổ quỹ thu-chi nội bộ công ty (Kế toán ghi được).
  let soQuyCongTy: any[] = [];
  try {
    soQuyCongTy = await prisma.soQuy.findMany({ where: { quy: 'CongTy' }, orderBy: { ngay: 'desc' }, take: 200 });
  } catch {
    soQuyCongTy = [];
  }

  // Góp ý NV #42: Kế toán xem (chỉ đọc) quỹ của kho VN và kho TQ.
  let soQuyKho: any[] = [];
  try {
    soQuyKho = await prisma.soQuy.findMany({ where: { quy: { in: ['KhoVN', 'KhoTQ'] } }, orderBy: { ngay: 'desc' }, take: 200 });
  } catch {
    soQuyKho = [];
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

  const mapSoQuy = (r: any) => ({
    id: r.id,
    ngay: r.ngay.toISOString(),
    quy: r.quy,
    loai: r.loai,
    soTien: r.soTien,
    danhMuc: r.danhMuc || '',
    noiDung: r.noiDung || '',
    maDH: r.maDH || '',
    maKH: r.maKH || '',
    nguoiTao: r.nguoiTao || ''
  });

  return (
    <KeToanClient
      user={user}
      pendingPayments={pending}
      customers={customers.map((c) => ({ maKH: c.maKH, tenKH: c.tenKH, soDuVi: c.soDuVi }))}
      walletTxns={walletTxns.map((t) => ({
        id: t.id, ngay: t.ngay.toISOString(), maKH: t.maKH,
        tenKH: t.khachHang?.tenKH || t.maKH, loai: t.loai,
        soTien: t.soTien, soDuSau: t.soDuSau, quy: t.quy || '', ghiChu: t.ghiChu || '', nv: t.nv || ''
      }))}
      pendingFees={pendingFees.map((o) => ({
        maDH: o.maDH,
        maKH: o.maKH || '',
        tenKH: o.khachHang?.tenKH || '',
        phiPhatSinh: o.phiPhatSinh,
        nguoiTao: o.nv?.hoTen || o.nvTao || '',
        ngayTao: o.ngayTao.toISOString()
      }))}
      soQuyCongTy={soQuyCongTy.map(mapSoQuy)}
      soQuyKho={soQuyKho.map(mapSoQuy)}
    />
  );
}
