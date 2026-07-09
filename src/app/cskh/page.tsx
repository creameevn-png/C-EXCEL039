import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getNumber } from '@/lib/settings';
import CskhClient from './CskhClient';

export const dynamic = 'force-dynamic';

export default async function CskhPage() {
  const user = await requireRole(['CSKH']);

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

  const normWeb = (s: string) => String(s || '').toLowerCase().replace(/\s+/g, '').replace(/\.com.*$/, '');

  const [customers, products, myOrders, kpiMyToday, kpiCompleted, kpiInProgress, kpiCustomers, tyGia, bangGiaWebs, gdvs] = await Promise.all([
    prisma.khachHang.findMany({ orderBy: { maKH: 'asc' } }),
    prisma.sanPham.findMany({ orderBy: { maSP: 'asc' } }),
    prisma.donHang.findMany({
      where: { nvId: user.id },
      orderBy: { ngayTao: 'desc' },
      take: 200,
      include: { khachHang: true, chiTiet: { take: 1, orderBy: { stt: 'asc' } }, gdv: { select: { hoTen: true } } }
    }),
    prisma.donHang.count({ where: { nvId: user.id, ngayTao: { gte: todayStart } } }),
    prisma.donHang.count({ where: { nvId: user.id, trangThai: 'HoanThanh' } }),
    prisma.donHang.count({ where: { nvId: user.id, trangThai: { notIn: ['HoanThanh', 'Huy'] } } }),
    prisma.khachHang.count(),
    getNumber('ty_gia_ndt_vnd', 3650),
    prisma.bangGiaWeb.findMany({ where: { hoatDong: true } }),
    prisma.nhanVien.findMany({ where: { vaiTro: { in: ['GDV', 'MuaHang'] }, trangThai: 'HoatDong' }, select: { id: true, hoTen: true } })
  ]);

  // Tỷ giá riêng theo từng sàn (PL02 #10): CSKH chọn "Nguồn" nào thì dòng đó tự lấy
  // tỷ giá của sàn đó; sàn chưa cấu hình → dùng tỷ giá chung.
  const tyGiaByWeb: Record<string, number> = {};
  for (const w of bangGiaWebs) if (w.tyGia > 0) tyGiaByWeb[normWeb(w.web)] = w.tyGia;

  const initial = {
    user,
    appName: process.env.APP_NAME || 'Quản Lý Ship Trung Việt',
    tyGia,
    tyGiaByWeb,
    customers: customers.map((c) => ({
      maKH: c.maKH, tenKH: c.tenKH, sdt: c.sdt || '', diaChi: c.diaChi || '',
      pctCoc: c.pctCoc, soDuVi: c.soDuVi, congNo: c.congNo
    })),
    products: products.map((p) => ({
      maSP: p.maSP, tenSP: p.tenSP,
      kgGoiY: p.kgGoiY, m3GoiY: p.m3GoiY,
      giaThamKhao: p.giaThamKhao, webNguon: p.webNguon || ''
    })),
    gdvs: gdvs.map((g) => ({ id: g.id, hoTen: g.hoTen })),
    myOrders: myOrders.map((o) => ({
      maDH: o.maDH, ngayTao: o.ngayTao.toISOString(),
      tenKH: o.khachHang?.tenKH || '',
      tenHang: o.chiTiet[0]?.tenSP || '',
      tongTien: o.tongTien, daTra: o.daTra, conLai: o.conLai,
      trangThai: o.trangThai,
      gdvId: o.gdvId,
      gdvTen: o.gdv?.hoTen || '',
      phiPhatSinh: o.phiPhatSinh,
      phiPhatSinhDuyet: o.phiPhatSinhDuyet
    })),
    kpi: {
      myOrdersToday: kpiMyToday,
      completed: kpiCompleted,
      inProgress: kpiInProgress,
      customers: kpiCustomers
    }
  };

  return <CskhClient initial={initial} />;
}
