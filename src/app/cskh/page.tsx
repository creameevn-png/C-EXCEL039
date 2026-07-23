import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getNumber } from '@/lib/settings';
import CskhClient from './CskhClient';

export const dynamic = 'force-dynamic';

export default async function CskhPage() {
  const user = await requireRole(['CSKH']);

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

  const normWeb = (s: string) => String(s || '').toLowerCase().replace(/\s+/g, '').replace(/\.com.*$/, '');

  // Đơn CSKH cần xử lý = đơn mình tạo + MỌI đơn khách tự đặt trên /dat-hang.
  // Đơn khách tự đặt mang nvId = tài khoản của khách, nếu chỉ lọc theo nvId thì
  // không CSKH nào nhìn thấy nó — mà nút "Xác nhận cọc" chỉ có ở màn này, nên đơn
  // khách tự đặt sẽ kẹt vĩnh viễn ở "Đơn mới tạo".
  const scopeDon = { OR: [{ nvId: user.id }, { nv: { vaiTro: 'Customer' as const } }] };

  const [customers, products, myOrders, kpiMyToday, kpiCompleted, kpiInProgress, kpiCustomers, tyGia, pctMua, pctBH, bangGiaWebs, gdvs] = await Promise.all([
    prisma.khachHang.findMany({ orderBy: { maKH: 'asc' } }),
    prisma.sanPham.findMany({ orderBy: { maSP: 'asc' } }),
    prisma.donHang.findMany({
      where: scopeDon,
      orderBy: { ngayTao: 'desc' },
      take: 200,
      include: {
        khachHang: true,
        chiTiet: { take: 1, orderBy: { stt: 'asc' } },
        gdv: { select: { hoTen: true } },
        nv: { select: { vaiTro: true } }
      }
    }),
    prisma.donHang.count({ where: { ...scopeDon, ngayTao: { gte: todayStart } } }),
    prisma.donHang.count({ where: { ...scopeDon, trangThai: 'HoanThanh' } }),
    prisma.donHang.count({ where: { ...scopeDon, trangThai: { notIn: ['HoanThanh', 'Huy'] } } }),
    prisma.khachHang.count(),
    getNumber('ty_gia_ndt_vnd', 3650),
    getNumber('phi_mua_pct', 2),
    getNumber('phi_bh_pct', 1),
    prisma.bangGiaWeb.findMany({ where: { hoatDong: true } }),
    prisma.nhanVien.findMany({ where: { vaiTro: { in: ['GDV', 'MuaHang'] }, trangThai: 'HoatDong' }, select: { id: true, hoTen: true } })
  ]);

  // Đợt 5 — đơn giá phí dịch vụ (đóng gỗ/kiểm đếm/lưu kho) cho form tạm tính.
  const [phiDongGoKgDau, phiDongGoKgTiep, phiKiemDemSp, phiLuuKhoNgay, luuKhoFreeNgay] = await Promise.all([
    getNumber('phi_dong_go_kg_dau', 70000), getNumber('phi_dong_go_kg_tiep', 3500),
    getNumber('phi_kiem_dem_sp', 500), getNumber('phi_luu_kho_ngay', 1000), getNumber('luu_kho_free_ngay', 7)
  ]);

  // Tỷ giá riêng theo từng sàn (PL02 #10): CSKH chọn "Nguồn" nào thì dòng đó tự lấy
  // tỷ giá của sàn đó; sàn chưa cấu hình → dùng tỷ giá chung.
  const tyGiaByWeb: Record<string, number> = {};
  for (const w of bangGiaWebs) if (w.tyGia > 0) tyGiaByWeb[normWeb(w.web)] = w.tyGia;

  const initial = {
    user,
    appName: process.env.APP_NAME || 'Quản Lý Ship Trung Việt',
    tyGia,
    pctMua,
    pctBH,
    phiDongGoKgDau, phiDongGoKgTiep, phiKiemDemSp, phiLuuKhoNgay, luuKhoFreeNgay,
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
      maKH: o.maKH,
      tenKH: o.khachHang?.tenKH || '',
      tenHang: o.chiTiet[0]?.tenSP || '',
      tongTien: o.tongTien, daTra: o.daTra, conLai: o.conLai,
      trangThai: o.trangThai,
      // Đơn do chính khách tự gửi lên từ /dat-hang — CSKH cần biết để gọi xác nhận cọc.
      khachTuDat: o.nv?.vaiTro === 'Customer',
      gdvId: o.gdvId,
      gdvTen: o.gdv?.hoTen || '',
      phiPhatSinh: o.phiPhatSinh,
      phiPhatSinhDuyet: o.phiPhatSinhDuyet,
      // Góp ý NV #36: CSKH cũng cập nhật được phí ship nội địa của đơn đã tạo.
      shipND: o.shipND,
      lineNoiDia: o.lineNoiDia || ''
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
