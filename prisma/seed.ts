import { PrismaClient, VaiTro } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const pwd = await bcrypt.hash('123456', 10);

  const users: Array<{ email: string; hoTen: string; vaiTro: VaiTro }> = [
    { email: 'admin@demo.vn', hoTen: 'Quản trị viên', vaiTro: 'Admin' },
    { email: 'cskh@demo.vn', hoTen: 'Nhân viên CSKH', vaiTro: 'CSKH' },
    { email: 'gdv@demo.vn', hoTen: 'Giao dịch viên', vaiTro: 'GDV' },
    { email: 'ketoan@demo.vn', hoTen: 'Kế toán', vaiTro: 'KeToan' },
    { email: 'muahang@demo.vn', hoTen: 'Nhân viên Mua hàng', vaiTro: 'MuaHang' },
    { email: 'khotq@demo.vn', hoTen: 'Nhân viên Kho TQ', vaiTro: 'KhoTQ' },
    { email: 'khovn@demo.vn', hoTen: 'Nhân viên Kho VN', vaiTro: 'KhoVN' },
    { email: 'kh001@gmail.com', hoTen: 'Anh Tuấn', vaiTro: 'Customer' }
  ];
  for (const u of users) {
    await prisma.nhanVien.upsert({
      where: { email: u.email },
      update: { hoTen: u.hoTen, vaiTro: u.vaiTro },
      create: { ...u, passwordHash: pwd }
    });
  }

  // Cài đặt mặc định
  const settings = [
    { ten: 'ty_gia_ndt_vnd', giaTri: '3650', ghiChu: 'Tỷ giá NDT → VND' },
    { ten: 'phi_mua_pct', giaTri: '2', ghiChu: 'Phí mua hàng (%)' },
    { ten: 'phi_bh_pct', giaTri: '1', ghiChu: 'Phí bảo hiểm (%)' },
    { ten: 'ten_cong_ty', giaTri: 'Quản Lý Ship Trung Việt', ghiChu: 'Tên doanh nghiệp' },
    { ten: 'zalo_lien_he', giaTri: '0901234567', ghiChu: 'Zalo liên hệ' }
  ];
  for (const s of settings) {
    await prisma.caiDat.upsert({
      where: { ten: s.ten },
      update: { giaTri: s.giaTri, ghiChu: s.ghiChu },
      create: s
    });
  }

  // Customers
  await prisma.khachHang.upsert({
    where: { maKH: 'KH001' }, update: {},
    create: {
      maKH: 'KH001', tenKH: 'Anh Tuấn - Shop ABC',
      sdt: '0901234567', email: 'kh001@gmail.com',
      tuyen: 'HCM', diaChi: '123 Nguyễn Huệ, Q1, HCM',
      pctCoc: 70, soDuVi: 2000000
    }
  });
  await prisma.khachHang.upsert({
    where: { maKH: 'KH002' }, update: {},
    create: {
      maKH: 'KH002', tenKH: 'Chị Hằng - Beauty Shop',
      sdt: '0912345678', tuyen: 'HaNoi',
      diaChi: '45 Lê Lợi, Hà Nội',
      pctCoc: 80, soDuVi: 5000000
    }
  });

  // Products
  await prisma.sanPham.upsert({
    where: { maSP: 'SP001' }, update: {},
    create: {
      maSP: 'SP001', tenSP: 'Áo thun nam form rộng size L',
      danhMuc: 'Thời trang nam', webNguon: 'Taobao',
      kgGoiY: 0.3, m3GoiY: 0.002, giaThamKhao: 120000
    }
  });
  await prisma.sanPham.upsert({
    where: { maSP: 'SP002' }, update: {},
    create: {
      maSP: 'SP002', tenSP: 'Giày sneaker unisex',
      danhMuc: 'Giày dép', webNguon: '1688',
      kgGoiY: 0.8, m3GoiY: 0.008, giaThamKhao: 350000
    }
  });

  // Bảng giá 3 line
  const bg = [
    ['LineNhanh', 'Thường', 55000, 50000, 45000, 4500000, 0, '3-5 ngày'],
    ['LineNhanh', 'Hàng dễ vỡ', 75000, 70000, 65000, 5500000, 5, '3-5 ngày'],
    ['LineNhanh', 'Mỹ phẩm', 85000, 80000, 75000, 6000000, 10, '3-5 ngày'],
    ['LineThuong', 'Thường', 35000, 30000, 25000, 3500000, 0, '7-10 ngày'],
    ['LineThuong', 'Hàng dễ vỡ', 50000, 45000, 40000, 4200000, 5, '7-10 ngày'],
    ['LineThuong', 'Mỹ phẩm', 60000, 55000, 50000, 4800000, 10, '7-10 ngày'],
    ['LineRe', 'Thường', 22000, 20000, 18000, 2500000, 0, '15-20 ngày'],
    ['LineRe', 'Hàng dễ vỡ', 35000, 32000, 28000, 3000000, 5, '15-20 ngày'],
    ['LineRe', 'Mỹ phẩm', 45000, 40000, 35000, 3500000, 10, '15-20 ngày']
  ] as const;
  for (const [line, loaiHang, k5, k20, kMax, m3, phu, tg] of bg) {
    await prisma.bangGia.upsert({
      where: { uq_bang_gia_line_loai: { line: line as any, loaiHang } },
      update: {},
      create: {
        line: line as any, loaiHang,
        giaKgDuoi5: k5, giaKg5To20: k20, giaKgTren20: kMax,
        giaM3: m3, phiPhuPct: phu, thoiGianDuKien: tg, hoatDong: true
      }
    });
  }

  // NCC mẫu
  await prisma.nCC.upsert({
    where: { maNCC: 'NCC001' }, update: {},
    create: { maNCC: 'NCC001', tenNCC: 'Shop ABC (Taobao)', wechat: 'abc123', ghiChu: 'NCC chính cho thời trang' }
  });

  console.log('✅ Seed done');
  console.log('Login mặc định (mật khẩu 123456):');
  console.log('  Admin    : admin@demo.vn');
  console.log('  CSKH     : cskh@demo.vn');
  console.log('  GDV      : gdv@demo.vn');
  console.log('  Kế toán  : ketoan@demo.vn');
  console.log('  Mua hàng : muahang@demo.vn');
  console.log('  Kho TQ   : khotq@demo.vn');
  console.log('  Kho VN   : khovn@demo.vn');
  console.log('  Customer : kh001@gmail.com (KH001)');
  console.log('Tra cứu public: /tra-cuu  (Mã KH: KH001, SĐT cuối: 4567)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
