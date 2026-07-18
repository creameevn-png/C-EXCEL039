import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession, getSessionFresh } from '@/lib/auth';
import { computeOrderTotals, calcPhiMua, calcM3 } from '@/lib/shipping-fee';
import { nextMaDH, nextMaKH, nextMaSP, nextMaKN, nextMaYC, nextMaNCC } from '@/lib/codes';
import { logActivity, diffFields } from '@/lib/audit';
import { pushNotify } from '@/lib/notify';
import { getNumber, getSetting } from '@/lib/settings';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import type { VaiTro, TrangThaiDon, Tuyen, LineVC, LoaiKN, TrangThaiKN, TrangThaiYC } from '@prisma/client';

type Ok<T = any> = { success: true } & T;
type Err = { success: false; message: string };
type Resp = Ok | Err;

function err(message: string): Err { return { success: false, message }; }
function ok<T extends object>(data?: T): Ok<T> { return { success: true, ...(data || {} as T) }; }

function allow(role: VaiTro, roles: VaiTro[]): boolean {
  return role === 'Admin' || roles.includes(role);
}

function normTuyen(v: any): Tuyen {
  return String(v).toUpperCase() === 'HCM' ? 'HCM' : 'HaNoi';
}

const LINE_VC: LineVC[] = ['LineNhanh', 'LineThuong', 'LineRe'];
// Đơn đã hoàn thành / đã hủy thì hoá đơn coi như đã chốt: không cho sửa số làm đổi tiền.
// (Riêng Admin sửa đơn qua updateOrderFields vẫn được — cố ý, xem modal sửa đơn bên admin.)
function donDaChot(trangThai: TrangThaiDon): boolean {
  return trangThai === 'HoanThanh' || trangThai === 'Huy';
}
// Các gói đóng gỗ/bọt khí khách được chọn — khớp select trên form CSKH và form khách.
const DONG_GO_GOI = [0, 5000, 10000];

// Sổ quỹ (góp ý NV #22, #42, #43): mỗi vai trò chỉ ghi được sổ quỹ của mình.
const QUY_HOP_LE = ['CongTy', 'KhoVN', 'KhoTQ'];
function quyChoPhep(role: VaiTro): string[] {
  if (role === 'Admin') return QUY_HOP_LE;
  if (role === 'KeToan') return ['CongTy'];
  if (role === 'KhoVN') return ['KhoVN'];
  if (role === 'KhoTQ') return ['KhoTQ'];
  return [];
}

type ChiTietInput = {
  tenSP: string;
  soLuong?: number;
  donGiaNDT?: number;
  tyGia?: number;
  kg?: number;
  m3?: number;
  webNguon?: string;
  linkTaobao?: string;
  ghiChu?: string;
};

async function recomputeDonHang(maDH: string) {
  const ct = await prisma.chiTietDon.findMany({ where: { maDH } });
  const o = await prisma.donHang.findUnique({ where: { maDH } });
  if (!o) return;

  const tongGiaHang = ct.reduce((s, c) => s + c.thanhTien, 0);
  const tongKg = ct.reduce((s, c) => s + c.kg * c.soLuong, 0);
  const tongM3 = ct.reduce((s, c) => s + c.m3 * c.soLuong, 0);
  // Phí mua theo từng sàn (per-web); fallback % chung khi sàn chưa cấu hình.
  const phiMuaPerWeb = await calcPhiMua(ct.map((c) => ({ webNguon: c.webNguon, thanhTien: c.thanhTien })));
  // Z6 — phí RIÊNG theo khách: đọc khách của đơn để lấy % mua/bảo hiểm riêng (nếu có).
  // Đơn lỗi không thấy khách → để undefined, hàm tính dùng % chung như cũ (không vỡ).
  const khDon = o.maKH ? await prisma.khachHang.findUnique({ where: { maKH: o.maKH } }) : null;

  const totals = await computeOrderTotals({
    giaHang: tongGiaHang,
    kg: tongKg, m3: tongM3,
    tuyen: o.tuyen,
    phiShipND: o.shipND, phiDongGoi: o.dongGo, phiPhuThu: o.phuThu,
    // Góp ý NV #9: phí phát sinh chỉ vào tổng tiền sau khi Kế toán duyệt.
    phiPhatSinh: o.phiPhatSinhDuyet ? o.phiPhatSinh : 0,
    phiKhieuNai: o.phiKhieuNai,
    phiMuaOverride: phiMuaPerWeb,
    // Z6 — % riêng của khách; null → hàm tính tự dùng % chung.
    phiMuaPctKH: khDon?.phiMuaPctRieng ?? undefined,
    phiBhPctKH: khDon?.phiBhPctRieng ?? undefined,
    // 3B — bật/tắt bảo hiểm theo ưu tiên ĐƠN > KHÁCH > CÔNG TY (hàm tính lo phần ??).
    coBaoHiem: o.coBaoHiem,
    baoHiemKH: khDon?.baoHiemRieng,
    thueNK: o.thueNK, vat: o.vat, phiKiemHoa: o.phiKiemHoa, phiLuuKho: o.phiLuuKho,
    pctCoc: o.pctCoc,
    lineVC: o.lineVC, loaiHang: o.loaiHang
  });

  await prisma.donHang.update({
    where: { maDH },
    data: {
      tongGiaHang, tongKg, tongM3,
      // KHÔNG ghi đè phiPhatSinh: đó là số CSKH nhập, đang chờ duyệt hay đã duyệt
      // đều phải giữ nguyên để Kế toán còn thấy mà xét.
      phiMua: totals.phiMua, phiBH: totals.phiBH, phiVC: totals.phiVC,
      tongTien: totals.tongTien,
      tienCoc: totals.coc,
      conLai: totals.tongTien - o.daTra
    }
  });
}

/** Góp ý NV #13 — giá vốn đơn = Σ tiền tệ mua thực tế của từng dòng hàng (nếu GDV đã nhập theo dòng). */
async function recomputeVonGDV(maDH: string) {
  const o = await prisma.donHang.findUnique({ where: { maDH }, include: { chiTiet: true } });
  if (!o) return;
  const vonTheoDong = o.chiTiet.reduce((s, c) => s + (c.vonNDT || 0), 0);
  if (vonTheoDong <= 0) return; // GDV chưa nhập theo dòng → giữ số tổng nhập tay.
  const tongThuNDT = o.chiTiet.reduce((s, c) => s + c.donGiaNDT * c.soLuong, 0);
  await prisma.donHang.update({
    where: { maDH },
    data: { vonNDT: vonTheoDong, loiNhuanNDT: tongThuNDT - (vonTheoDong + o.shipNDTQ) }
  });
}

/** Tách ô "mã vận đơn" (nhiều mã, cách nhau dấu phẩy) thành danh sách mã sạch. */
function tachMaVD(raw: string | null | undefined): string[] {
  return String(raw || '')
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Góp ý NV #28, #37, #38 — đồng bộ danh sách KIỆN của đơn theo ô mã vận đơn.
 * Thêm kiện mới, xoá kiện có mã không còn trong ô — nhưng KHÔNG xoá kiện đã về
 * hoặc đã giao (tránh mất dấu hàng thật khi GDV sửa lại ô mã).
 */
async function syncKienTheoMaVD(maDH: string, maVDRaw: string | null | undefined) {
  const codes = tachMaVD(maVDRaw);
  const daCo = await prisma.kienHang.findMany({ where: { maDH } });
  const o = await prisma.donHang.findUnique({ where: { maDH } });

  for (const maVD of codes) {
    if (daCo.some((k) => k.maVD === maVD)) continue;
    await prisma.kienHang.create({ data: { maDH, maVD, maBao: o?.maBao || null } });
  }
  const thua = daCo.filter((k) => !codes.includes(k.maVD) && k.trangThai === 'ChuaVe');
  if (thua.length > 0) {
    await prisma.kienHang.deleteMany({ where: { id: { in: thua.map((k) => k.id) } } });
  }
}

/**
 * Tìm kiện theo mã vận đơn. Đơn tạo trước khi có bảng kiện chưa được tách kiện,
 * nên nếu chưa thấy thì dò trong ô mã VĐ của đơn rồi sinh bù — kho không phải chờ
 * chạy script mới bắn được mã.
 */
/** 'TRUNG' = mã vận đơn đang gắn với nhiều đơn, không đoán được kiện nào. */
async function timHoacSinhKien(maVD: string) {
  // Cùng một mã vận đơn không được gắn với hai đơn — nếu có, bắt người dùng kiểm tra
  // lại thay vì đoán đơn nào, kẻo đánh dấu nhầm hàng của khách khác.
  const trung = await prisma.kienHang.findMany({ where: { maVD }, take: 2 });
  if (trung.length > 1) return 'TRUNG' as const;
  const kien = trung[0];
  if (kien) return kien;

  const ungVien = await prisma.donHang.findMany({
    where: { maVD: { contains: maVD } },
    select: { maDH: true, maVD: true }
  });
  const don = ungVien.find((o) => tachMaVD(o.maVD).includes(maVD));
  if (!don) return null;

  await syncKienTheoMaVD(don.maDH, don.maVD);
  return prisma.kienHang.findFirst({ where: { maDH: don.maDH, maVD } });
}

// Công nợ phiếu giao tính lại từ các đơn thành viên (tránh stale sau khi KH trả thêm).
async function recomputePhieuGiao(maPhieu: string | null | undefined) {
  if (!maPhieu) return;
  const orders = await prisma.donHang.findMany({ where: { maPhieuGiao: maPhieu } });
  if (orders.length === 0) return;
  const tongTien = orders.reduce((s, o) => s + o.tongTien, 0);
  const daThu = orders.reduce((s, o) => s + o.daTra, 0);
  await prisma.phieuGiao
    .update({ where: { maPhieu }, data: { tongTien, daThu, conLai: tongTien - daThu, soDon: orders.length } })
    .catch(() => { /* phiếu đã xoá: bỏ qua */ });
}

async function recomputeBao(maBao: string) {
  const orders = await prisma.donHang.findMany({ where: { maBao } });
  const tongKg = orders.reduce((s, o) => s + o.tongKg, 0);
  const tongM3 = orders.reduce((s, o) => s + o.tongM3, 0);
  await prisma.baoTong.update({
    where: { maBao },
    data: { tongKg, tongM3, soKien: orders.length }
  });
}

const handlers: Record<string, (args: any[], user: NonNullable<Awaited<ReturnType<typeof getSession>>>) => Promise<Resp>> = {
  // ============== CSKH ==============
  async createOrder(args, user) {
    // Khách hàng tự đặt đơn trên /dat-hang (góp ý NV #1-8). Khách chỉ được đặt cho
    // chính mình: maKH lấy từ tài khoản đăng nhập, không nhận từ client.
    const isCustomer = user.vaiTro === 'Customer';
    if (!isCustomer && !allow(user.vaiTro, ['CSKH'])) return err('Không có quyền');
    const d = args[0] || {};
    if (!isCustomer && !d.maKH) return err('Vui lòng chọn khách hàng');
    const items: ChiTietInput[] = Array.isArray(d.chiTiet) && d.chiTiet.length > 0
      ? d.chiTiet
      : (d.tenHang ? [{
          tenSP: d.tenHang,
          soLuong: 1,
          donGiaNDT: Number(d.giaHang || 0) / Number(d.tyGia || 3650),
          tyGia: Number(d.tyGia || 3650),
          kg: Number(d.kg) || 0,
          m3: Number(d.m3) || 0,
          webNguon: d.web,
          linkTaobao: d.linkTaobao
        }] : []);
    if (items.length === 0) return err('Đơn phải có ít nhất 1 sản phẩm');

    const kh = isCustomer
      ? await prisma.khachHang.findFirst({ where: { email: user.email } })
      : await prisma.khachHang.findUnique({ where: { maKH: d.maKH } });
    if (!kh) return err(isCustomer ? 'Tài khoản chưa liên kết khách hàng. Liên hệ CSKH.' : 'KH không tồn tại');

    const maDH = await nextMaDH();
    const tuyen = normTuyen(d.tuyen ?? kh.tuyen);
    const lineVC: LineVC = LINE_VC.includes(d.lineVC) ? d.lineVC : 'LineThuong';
    // Khách chỉ chọn được gói đóng gỗ có sẵn; các phí nội bộ và % cọc do CSKH/kế toán quyết.
    const dongGo = isCustomer
      ? (DONG_GO_GOI.includes(Number(d.phiDongGoi)) ? Number(d.phiDongGoi) : 0)
      : Number(d.phiDongGoi) || 0;

    await prisma.donHang.create({
      data: {
        maDH,
        maKH: kh.maKH,
        nvTao: user.email,
        nvId: user.id,
        // Góp ý NV #12: CSKH chọn GDV phụ trách ngay khi lên đơn (khách tự đặt thì để trống).
        gdvId: isCustomer ? null : (Number(d.gdvId) || null),
        // 3B — bật/tắt bảo hiểm cấp ĐƠN. Khách tự đặt → null (theo khách/công ty);
        // CSKH tạo → tri-state từ payload (true/false đè riêng đơn, còn lại null).
        coBaoHiem: isCustomer ? null : (d.coBaoHiem === true ? true : d.coBaoHiem === false ? false : null),
        tuyen,
        lineVC,
        loaiHang: d.loaiHang || 'Thường',
        pctCoc: isCustomer ? (kh.pctCoc || 70) : (Number(d.pctCoc) || kh.pctCoc || 70),
        shipND: isCustomer ? 0 : Number(d.phiShipND) || 0,
        dongGo,
        phuThu: isCustomer ? 0 : Number(d.phiPhuThu) || 0,
        // Góp ý NV #9: phí phát sinh vào đơn ở trạng thái CHỜ Kế toán duyệt.
        phiPhatSinh: isCustomer ? 0 : Number(d.phiPhatSinh) || 0,
        phiPhatSinhDuyet: false,
        ngachHQ: isCustomer ? 'Tiểu ngạch' : (d.ngachHQ || 'Tiểu ngạch'),
        thueNK: isCustomer ? 0 : Number(d.thueNK) || 0,
        vat: isCustomer ? 0 : Number(d.vat) || 0,
        phiKiemHoa: isCustomer ? 0 : Number(d.phiKiemHoa) || 0,
        phiLuuKho: isCustomer ? 0 : Number(d.phiLuuKho) || 0,
        kiemDem: !!d.kiemDem,
        nguoiNhan: (d.nguoiNhan && String(d.nguoiNhan).trim()) || kh.tenKH,
        sdtNhan: (d.sdtNhan && String(d.sdtNhan).trim()) || kh.sdt || null,
        diaChiNhan: (d.diaChiNhan && String(d.diaChiNhan).trim()) || kh.diaChi || null,
        ghiChu: d.ghiChu || null,
        trangThai: 'DonMoiTao'
      }
    });

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const sl = Number(it.soLuong) || 1;
      const ndt = Number(it.donGiaNDT) || 0;
      const tg = Number(it.tyGia) || 3650;
      const vnd = Math.round(ndt * tg);
      await prisma.chiTietDon.create({
        data: {
          maDH, stt: i + 1,
          tenSP: it.tenSP,
          soLuong: sl,
          donGiaNDT: ndt, tyGia: tg,
          donGiaVND: vnd,
          thanhTien: vnd * sl,
          kg: Number(it.kg) || 0,
          m3: Number(it.m3) || 0,
          webNguon: it.webNguon ?? null,
          linkTaobao: it.linkTaobao ?? null,
          ghiChu: it.ghiChu ?? null
        }
      });
    }

    await recomputeDonHang(maDH);
    // Z1a — Ví bắt buộc cho khách tự đặt (mặc định TẮT). Chỉ áp cho Customer, không chặn CSKH/Admin nhập hộ.
    if (isCustomer && (await getSetting('vi_bat_buoc')) === '1') {
      const donSauTinh = await prisma.donHang.findUnique({ where: { maDH }, select: { tienCoc: true } });
      const coc = donSauTinh?.tienCoc || 0;
      const mucToiThieu = Math.max(coc, await getNumber('vi_coc_toi_thieu', 0));
      if (kh.soDuVi < mucToiThieu - 0.5) {
        // Ví chưa đủ → huỷ đơn vừa tạo để không để lại đơn rác.
        await prisma.chiTietDon.deleteMany({ where: { maDH } });
        await prisma.donHang.delete({ where: { maDH } });
        return err(`Số dư ví không đủ để đặt đơn. Cần tối thiểu ${Math.round(mucToiThieu).toLocaleString('vi-VN')} đ trong ví. Vui lòng nạp thêm.`);
      }
    }
    await logActivity(user.email, 'CREATE_ORDER', maDH, { maKH: kh.maKH, items: items.length, khachTuDat: isCustomer });
    await pushNotify(isCustomer
      ? {
          vaiTro: ['CSKH'], loai: 'info', maDH,
          tieuDe: `Khách tự đặt đơn ${maDH}`,
          noiDung: `${kh.maKH} · ${kh.tenKH} · ${items.length} SP · chờ CSKH xác nhận`,
          link: '/cskh', nguoiTao: user.email
        }
      : {
          vaiTro: ['GDV', 'MuaHang'], loai: 'info', maDH,
          tieuDe: `Đơn mới ${maDH}`,
          noiDung: `${kh.tenKH} · ${items.length} SP · chờ đặt cọc / xử lý`,
          link: '/gdv', nguoiTao: user.email
        });
    return ok({ maDH });
  },

  async addCustomer(args, user) {
    if (!allow(user.vaiTro, ['CSKH'])) return err('Không có quyền');
    const d = args[0] || {};
    if (!d.tenKH) return err('Vui lòng nhập tên KH');
    const maKH = await nextMaKH();
    const kh = await prisma.khachHang.create({
      data: {
        maKH,
        tenKH: d.tenKH,
        sdt: d.sdt || null,
        tuyen: normTuyen(d.tuyen),
        diaChi: d.diaChi || null,
        email: d.email || null,
        pctCoc: Number(d.pctCoc) || 70
      }
    });
    await logActivity(user.email, 'CREATE_CUSTOMER', maKH, { tenKH: d.tenKH });
    return ok({ maKH, tenKH: kh.tenKH, pctCoc: kh.pctCoc });
  },

  async addProduct(args, user) {
    if (!allow(user.vaiTro, ['CSKH'])) return err('Không có quyền');
    const d = args[0] || {};
    if (!d.tenSP) return err('Vui lòng nhập tên SP');
    const maSP = await nextMaSP();
    await prisma.sanPham.create({
      data: {
        maSP, tenSP: d.tenSP,
        danhMuc: d.danhMuc || null,
        webNguon: d.webNguon || null,
        kgGoiY: Number(d.kg) || 0,
        m3GoiY: Number(d.m3) || 0,
        giaThamKhao: Number(d.gia) || 0,
        linkTaobao: d.linkTaobao || null,
        ghiChu: d.ghiChu || null
      }
    });
    await logActivity(user.email, 'CREATE_PRODUCT', maSP, { tenSP: d.tenSP });
    return ok({ maSP, tenSP: d.tenSP, kg: Number(d.kg) || 0, m3: Number(d.m3) || 0, gia: Number(d.gia) || 0 });
  },

  async updateSanPham(args, user) {
    if (!allow(user.vaiTro, ['CSKH', 'MuaHang', 'GDV'])) return err('Không có quyền');
    const [maSP, patch] = args;
    if (!maSP) return err('Thiếu mã SP');
    const data: any = {};
    if (patch?.tenSP) data.tenSP = patch.tenSP;
    if (patch?.danhMuc !== undefined) data.danhMuc = patch.danhMuc || null;
    if (patch?.webNguon !== undefined) data.webNguon = patch.webNguon || null;
    if (patch?.kg !== undefined) data.kgGoiY = Number(patch.kg) || 0;
    if (patch?.m3 !== undefined) data.m3GoiY = Number(patch.m3) || 0;
    if (patch?.gia !== undefined) data.giaThamKhao = Number(patch.gia) || 0;
    if (patch?.linkTaobao !== undefined) data.linkTaobao = patch.linkTaobao || null;
    if (patch?.ghiChu !== undefined) data.ghiChu = patch.ghiChu || null;
    await prisma.sanPham.update({ where: { maSP }, data });
    await logActivity(user.email, 'UPDATE_PRODUCT', maSP, patch);
    return ok();
  },

  async deleteSanPham(args, user) {
    if (user.vaiTro !== 'Admin') return err('Chỉ Admin được xóa SP');
    const [maSP] = args;
    if (!maSP) return err('Thiếu mã SP');
    await prisma.sanPham.delete({ where: { maSP } });
    await logActivity(user.email, 'DELETE_PRODUCT', maSP);
    return ok();
  },

  async topupWallet(args, user) {
    // Góp ý NV #10: chỉ Kế toán được nạp ví (CSKH đã bị gỡ quyền).
    if (!allow(user.vaiTro, ['KeToan'])) return err('Chỉ Kế toán được nạp ví');
    const [maKH, amount, note] = args;
    const amt = Number(amount) || 0;
    if (!maKH) return err('Thiếu mã KH');
    if (amt <= 0) return err('Số tiền không hợp lệ');
    const kh = await prisma.khachHang.findUnique({ where: { maKH } });
    if (!kh) return err('KH không tồn tại');
    const newDu = kh.soDuVi + amt;
    await prisma.$transaction([
      prisma.khachHang.update({ where: { maKH }, data: { soDuVi: newDu } }),
      prisma.giaoDichVi.create({
        data: { maKH, loai: 'Nap', soTien: amt, soDuSau: newDu, ghiChu: note || 'Nạp ví', nv: user.email, nvId: user.id }
      })
    ]);
    await logActivity(user.email, 'TOPUP_WALLET', maKH, { amount: amt });
    return ok();
  },

  async confirmDeposit(args, user) {
    if (!allow(user.vaiTro, ['CSKH'])) return err('Không có quyền');
    const maDH = args[0];
    const o = await prisma.donHang.findUnique({ where: { maDH } });
    if (!o) return err('Đơn không tồn tại');
    if (o.trangThai !== 'DonMoiTao') return err('Đơn không ở trạng thái mới tạo');
    const coc = o.tienCoc;
    const newDaTra = o.daTra + coc;
    await prisma.$transaction([
      prisma.donHang.update({
        where: { maDH },
        data: { daTra: newDaTra, conLai: o.tongTien - newDaTra, trangThai: 'DatCoc' }
      }),
      prisma.thanhToan.create({
        data: { maDH, loai: 'Thu', soTien: coc, ghiChu: 'Đặt cọc', nv: user.email, nvId: user.id }
      })
    ]);
    await recomputePhieuGiao(o.maPhieuGiao);
    await logActivity(user.email, 'CONFIRM_DEPOSIT', maDH, { trangThai: { truoc: o.trangThai, sau: 'DatCoc' }, tienCoc: coc });
    await pushNotify({
      vaiTro: ['GDV', 'MuaHang'], loai: 'info', maDH,
      tieuDe: `Đơn ${maDH} đã đặt cọc`,
      noiDung: 'Cần tiến hành mua hàng (nhập mã GD).', link: '/gdv', nguoiTao: user.email
    });
    return ok({ tienCoc: coc });
  },

  // ============== GDV ==============
  async updateMaGD(args, user) {
    if (!allow(user.vaiTro, ['GDV', 'MuaHang'])) return err('Không có quyền');
    const [maDH, maGD] = args;
    if (!maGD) return err('Thiếu mã GD');
    const o = await prisma.donHang.findUnique({ where: { maDH } });
    if (!o) return err('Đơn không tồn tại');
    if (o.trangThai !== 'DatCoc') return err('Đơn không ở trạng thái Đặt cọc');
    await prisma.donHang.update({ where: { maDH }, data: { maGD, trangThai: 'DaMuaHang' } });
    await logActivity(user.email, 'UPDATE_MA_GD', maDH, { trangThai: { truoc: o.trangThai, sau: 'DaMuaHang' }, maGD });
    return ok();
  },

  async updateMaVD(args, user) {
    if (!allow(user.vaiTro, ['GDV', 'MuaHang'])) return err('Không có quyền');
    const [maDH, maVD] = args;
    if (!maVD) return err('Thiếu mã VĐ');
    const o = await prisma.donHang.findUnique({ where: { maDH } });
    if (!o) return err('Đơn không tồn tại');
    // Shop giao làm nhiều đợt → GDV bổ sung mã vận đơn sau (#18, #38). Chỉ lần đầu
    // mới đẩy trạng thái sang "NCC giao hàng"; các lần sau chỉ thêm kiện.
    const SUA_DUOC: TrangThaiDon[] = ['DaMuaHang', 'NccGiaoHang', 'KhoTqNhan'];
    if (!SUA_DUOC.includes(o.trangThai)) return err('Đơn không ở trạng thái nhận mã vận đơn');
    await prisma.donHang.update({
      where: { maDH },
      data: { maVD, ...(o.trangThai === 'DaMuaHang' && { trangThai: 'NccGiaoHang' as TrangThaiDon }) }
    });
    // Mỗi mã vận đơn là một kiện — kho VN sẽ bắn từng mã để nhận và giao (#28, #37, #38).
    await syncKienTheoMaVD(maDH, maVD);
    await logActivity(user.email, 'UPDATE_MA_VD', maDH, {
      ...(o.trangThai === 'DaMuaHang' && { trangThai: { truoc: o.trangThai, sau: 'NccGiaoHang' } }),
      maVD
    });
    await pushNotify({
      vaiTro: 'KhoTQ', loai: 'info', maDH,
      tieuDe: `Đơn ${maDH} sắp về kho TQ`,
      noiDung: `NCC đã giao (VĐ ${maVD}).`, link: '/khotq', nguoiTao: user.email
    });
    return ok();
  },

  // GDV nhập giá vốn thực mua (tệ) + ship nội địa TQ → tự tính lợi nhuận GDV.
  async updateVonGDV(args, user) {
    if (!allow(user.vaiTro, ['GDV', 'MuaHang', 'KeToan'])) return err('Không có quyền');
    const [maDH, patch] = args;
    if (!maDH) return err('Thiếu mã đơn');
    const o = await prisma.donHang.findUnique({ where: { maDH }, include: { chiTiet: true } });
    if (!o) return err('Đơn không tồn tại');
    if (donDaChot(o.trangThai)) return err('Đơn đã hoàn thành / đã hủy — không sửa được giá vốn');
    // Chỉ ghi đè giá vốn / ship khi client thực sự gửi lên: GDV lưu riêng ô ghi chú (#14)
    // trước lúc mua hàng thì không được xoá mất số đã nhập.
    const vonNDT = patch?.vonNDT !== undefined ? Math.max(0, Number(patch.vonNDT) || 0) : o.vonNDT;
    const shipNDTQ = patch?.shipNDTQ !== undefined ? Math.max(0, Number(patch.shipNDTQ) || 0) : o.shipNDTQ;
    // Tệ khách trả trên đơn = Σ(đơn giá NDT × số lượng) của các dòng hàng.
    const tongThuNDT = o.chiTiet.reduce((s, c) => s + c.donGiaNDT * c.soLuong, 0);
    const loiNhuanNDT = tongThuNDT - (vonNDT + shipNDTQ);
    // Góp ý NV #14: ghi chú riêng của GDV cho đơn hàng.
    const ghiChuGDV = patch?.ghiChuGDV !== undefined ? (String(patch.ghiChuGDV).trim() || null) : undefined;
    await prisma.donHang.update({ where: { maDH }, data: { vonNDT, shipNDTQ, loiNhuanNDT, ...(ghiChuGDV !== undefined && { ghiChuGDV }) } });
    await logActivity(user.email, 'UPDATE_VON_GDV', maDH, {
      vonNDT: { truoc: o.vonNDT, sau: vonNDT },
      shipNDTQ: { truoc: o.shipNDTQ, sau: shipNDTQ },
      loiNhuanNDT
    });
    return ok({ vonNDT, shipNDTQ, tongThuNDT, loiNhuanNDT });
  },

  // Góp ý NV #13: GDV nhập tiền tệ (¥) mua thực tế của TỪNG sản phẩm.
  // Nhập theo dòng thì giá vốn đơn = tổng các dòng (ô tổng chuyển sang chỉ đọc).
  async updateChiTietVon(args, user) {
    if (!allow(user.vaiTro, ['GDV', 'MuaHang'])) return err('Không có quyền');
    const [maDH, stt, vonNDT] = args;
    if (!maDH || !stt) return err('Thiếu thông tin dòng hàng');
    const don = await prisma.donHang.findUnique({ where: { maDH } });
    if (!don) return err('Đơn không tồn tại');
    if (donDaChot(don.trangThai)) return err('Đơn đã hoàn thành / đã hủy — không sửa được giá vốn');
    const von = Math.max(0, Number(vonNDT) || 0);
    const line = await prisma.chiTietDon.findFirst({ where: { maDH, stt: Number(stt) } });
    if (!line) return err('Không tìm thấy dòng hàng');
    await prisma.chiTietDon.update({ where: { id: line.id }, data: { vonNDT: von } });
    await recomputeVonGDV(maDH);
    await logActivity(user.email, 'SUA_VON_DONG', maDH, { stt, vonNDT: { truoc: line.vonNDT, sau: von } });
    const o = await prisma.donHang.findUnique({ where: { maDH } });
    return ok({ vonNDT: o?.vonNDT || 0, loiNhuanNDT: o?.loiNhuanNDT || 0 });
  },

  // Góp ý NV #12: CSKH giao đơn cho một GDV cụ thể xử lý.
  async assignGDV(args, user) {
    if (!allow(user.vaiTro, ['CSKH'])) return err('Không có quyền');
    const [maDH, gdvId] = args;
    const o = await prisma.donHang.findUnique({ where: { maDH } });
    if (!o) return err('Đơn không tồn tại');
    if (!gdvId) {
      await prisma.donHang.update({ where: { maDH }, data: { gdvId: null } });
      await logActivity(user.email, 'BO_GAN_GDV', maDH);
      return ok({ gdvId: null });
    }
    const gdv = await prisma.nhanVien.findUnique({ where: { id: Number(gdvId) } });
    if (!gdv || !['GDV', 'MuaHang'].includes(gdv.vaiTro)) return err('Nhân viên không phải GDV / Mua hàng');
    if (gdv.trangThai !== 'HoatDong') return err('Tài khoản GDV đang bị khoá');
    await prisma.donHang.update({ where: { maDH }, data: { gdvId: gdv.id } });
    await logActivity(user.email, 'GAN_GDV', maDH, { gdv: gdv.email });
    await pushNotify({
      vaiTro: ['GDV', 'MuaHang'], loai: 'info', maDH,
      tieuDe: `Đơn ${maDH} giao cho ${gdv.hoTen}`,
      noiDung: `${user.email} giao đơn này cho ${gdv.hoTen} xử lý.`,
      link: '/gdv', nguoiTao: user.email
    });
    return ok({ gdvId: gdv.id, hoTen: gdv.hoTen });
  },

  // Góp ý NV #9: Kế toán duyệt (hoặc từ chối) phí phát sinh khác do CSKH nhập.
  // Chỉ khi duyệt, phí mới được cộng vào tổng tiền của đơn.
  async duyetPhiPhatSinh(args, user) {
    if (!allow(user.vaiTro, ['KeToan'])) return err('Chỉ Kế toán duyệt phí phát sinh');
    const [maDH, accepted, note] = args;
    const o = await prisma.donHang.findUnique({ where: { maDH } });
    if (!o) return err('Đơn không tồn tại');
    if (o.phiPhatSinh <= 0) return err('Đơn không có phí phát sinh cần duyệt');
    await prisma.donHang.update({
      where: { maDH },
      data: accepted
        ? { phiPhatSinhDuyet: true, phiPhatSinhDuyetBy: user.email, phiPhatSinhDuyetAt: new Date() }
        // Từ chối → xoá phí khỏi đơn, ghi lại ai từ chối.
        : { phiPhatSinh: 0, phiPhatSinhDuyet: false, phiPhatSinhDuyetBy: user.email, phiPhatSinhDuyetAt: new Date() }
    });
    await recomputeDonHang(maDH);
    await recomputePhieuGiao(o.maPhieuGiao);
    await logActivity(user.email, accepted ? 'DUYET_PHI_PHAT_SINH' : 'TU_CHOI_PHI_PHAT_SINH', maDH, {
      duyet: { truoc: o.phiPhatSinhDuyet, sau: !!accepted },
      soTien: o.phiPhatSinh, note
    });
    await pushNotify({
      vaiTro: ['CSKH'], loai: accepted ? 'success' : 'warning', maDH,
      tieuDe: `Phí phát sinh đơn ${maDH} ${accepted ? 'đã được duyệt' : 'bị từ chối'}`,
      noiDung: `${Math.round(o.phiPhatSinh).toLocaleString('vi-VN')}đ${note ? ' — ' + note : ''}`,
      link: '/cskh', nguoiTao: user.email
    });
    return ok();
  },

  // Góp ý NV #17: GDV sửa số lượng còn của shop trong chi tiết đơn (shop hết hàng → giảm SL).
  async updateChiTietSoLuong(args, user) {
    if (!allow(user.vaiTro, ['GDV', 'MuaHang'])) return err('Không có quyền');
    const [maDH, stt, soLuong] = args;
    if (!maDH || !stt) return err('Thiếu thông tin dòng hàng');
    const sl = Math.floor(Number(soLuong));
    if (!Number.isFinite(sl) || sl < 0) return err('Số lượng không hợp lệ');
    const line = await prisma.chiTietDon.findFirst({ where: { maDH, stt: Number(stt) } });
    if (!line) return err('Không tìm thấy dòng hàng');
    if (sl === line.soLuong) return ok();
    await prisma.chiTietDon.update({
      where: { id: line.id },
      data: { soLuong: sl, thanhTien: line.donGiaVND * sl }
    });
    await recomputeDonHang(maDH);
    await logActivity(user.email, 'SUA_SO_LUONG', maDH, { stt, soLuong: { truoc: line.soLuong, sau: sl } });
    return ok();
  },

  // ============== KE TOAN ==============
  async confirmPayment(args, user) {
    if (!allow(user.vaiTro, ['KeToan'])) return err('Không có quyền');
    const [maDH, amountRaw, note] = args;
    const amount = Number(amountRaw) || 0;
    if (amount <= 0) return err('Số tiền không hợp lệ');
    const o = await prisma.donHang.findUnique({ where: { maDH } });
    if (!o) return err('Đơn không tồn tại');
    if (amount > o.conLai + 1) return err(`Số tiền (${amount}) lớn hơn còn lại (${o.conLai})`);
    const newPaid = o.daTra + amount;
    const newCon = o.tongTien - newPaid;
    let newStatus: TrangThaiDon = o.trangThai;
    if (newCon <= 0.5 && o.trangThai === 'ChoThanhToan') newStatus = 'GiaoHang';
    await prisma.$transaction([
      prisma.thanhToan.create({
        data: { maDH, loai: 'Thu', soTien: amount, ghiChu: note || '', nv: user.email, nvId: user.id }
      }),
      prisma.donHang.update({
        where: { maDH },
        data: { daTra: newPaid, conLai: newCon, trangThai: newStatus }
      })
    ]);
    await recomputePhieuGiao(o.maPhieuGiao);
    await logActivity(user.email, 'CONFIRM_PAYMENT', maDH, {
      amount,
      daTra: { truoc: o.daTra, sau: newPaid },
      conLai: { truoc: o.conLai, sau: newCon },
      trangThai: { truoc: o.trangThai, sau: newStatus }
    });
    if (newStatus === 'GiaoHang') {
      await pushNotify({
        vaiTro: ['KhoVN', 'CSKH'], loai: 'success', maDH,
        tieuDe: `Đơn ${maDH} đã thanh toán đủ`,
        noiDung: 'Sẵn sàng giao khách.', link: '/khovn', nguoiTao: user.email
      });
    }
    return ok({ daTra: newPaid, conLai: newCon, trangThai: newStatus });
  },

  // ============== KHO TQ ==============
  async confirmKhoTQ(args, user) {
    if (!allow(user.vaiTro, ['KhoTQ'])) return err('Không có quyền');
    const [maDH, imageBase64] = args;
    const o = await prisma.donHang.findUnique({ where: { maDH } });
    if (!o) return err('Đơn không tồn tại');
    if (o.trangThai !== 'NccGiaoHang') return err('Đơn chưa được NCC giao');
    await prisma.donHang.update({
      where: { maDH },
      data: { trangThai: 'KhoTqNhan', anhKhoTQ: imageBase64 || null, nguoiPhuTrachTQ: user.hoTen || user.email }
    });
    await logActivity(user.email, 'KHO_TQ_NHAN', maDH, { trangThai: { truoc: o.trangThai, sau: 'KhoTqNhan' } });
    return ok();
  },

  // Kho TQ kiểm đếm theo từng link sản phẩm: "Đủ" / "Thiếu" + ghi chú.
  async markKiemKe(args, user) {
    if (!allow(user.vaiTro, ['KhoTQ', 'KhoVN'])) return err('Không có quyền');
    const [maDH, stt, patch] = args;
    if (!maDH || !stt) return err('Thiếu thông tin dòng hàng');
    const line = await prisma.chiTietDon.findFirst({ where: { maDH, stt: Number(stt) } });
    if (!line) return err('Không tìm thấy dòng hàng');
    // Chỉ đụng vào trường nào client thực sự gửi lên: bấm "Đủ" mà không sửa ghi chú
    // thì ghi chú cũ phải còn nguyên, và ngược lại.
    const data: { kiemKe?: string | null; kiemKeNote?: string | null } = {};
    if (patch?.trangThai !== undefined) {
      const tt = patch.trangThai;
      if (tt !== 'Đủ' && tt !== 'Thiếu' && tt !== null && tt !== '') return err('Trạng thái kiểm đếm không hợp lệ');
      data.kiemKe = tt === 'Đủ' || tt === 'Thiếu' ? tt : null;
    }
    if (patch?.note !== undefined) data.kiemKeNote = patch.note || null;
    if (Object.keys(data).length === 0) return ok();
    await prisma.chiTietDon.update({ where: { id: line.id }, data });
    await logActivity(user.email, 'KIEM_KE', maDH, { stt, trangThai: patch?.trangThai });
    return ok();
  },

  // ===== Hàng vô chủ (kho TQ) =====
  async addHangVoChu(args, user) {
    if (!allow(user.vaiTro, ['KhoTQ', 'KhoVN'])) return err('Không có quyền');
    const d = args[0] || {};
    if (!d.maVD || !String(d.maVD).trim()) return err('Vui lòng nhập mã vận đơn');
    const dai = Number(d.dai) || 0, rong = Number(d.rong) || 0, cao = Number(d.cao) || 0;
    // m³ theo hệ số quy đổi trong Cài đặt (#33); nhập m³ trực tiếp thì ưu tiên giá trị đó.
    const m3 = Number(d.m3) || (await calcM3(dai, rong, cao));
    const r = await prisma.hangVoChu.create({
      data: {
        maVD: String(d.maVD).trim(),
        kg: Number(d.kg) || 0, dai, rong, cao, m3,
        anh: d.anh || null, ghiChu: d.ghiChu || null,
        nguoiNhap: user.hoTen || user.email,
      }
    });
    await logActivity(user.email, 'ADD_HANG_VO_CHU', String(r.id), { maVD: d.maVD });
    return ok({ id: r.id });
  },

  async matchHangVoChu(args, user) {
    if (!allow(user.vaiTro, ['KhoTQ', 'KhoVN'])) return err('Không có quyền');
    const [id, maDH] = args;
    if (!id || !maDH) return err('Thiếu id hàng vô chủ hoặc mã đơn');
    const o = await prisma.donHang.findUnique({ where: { maDH: String(maDH).trim() } });
    if (!o) return err('Đơn không tồn tại: ' + maDH);
    const h = await prisma.hangVoChu.findUnique({ where: { id: Number(id) } });
    if (!h) return err('Không tìm thấy hàng vô chủ');
    await prisma.hangVoChu.update({ where: { id: Number(id) }, data: { daGan: true, maDH: o.maDH } });
    // Gắn mã VĐ vào đơn nếu đơn chưa có
    if (!o.maVD) await prisma.donHang.update({ where: { maDH: o.maDH }, data: { maVD: h.maVD } });
    await logActivity(user.email, 'MATCH_HANG_VO_CHU', String(id), { maDH: o.maDH, maVD: h.maVD });
    return ok();
  },

  async deleteHangVoChu(args, user) {
    if (!allow(user.vaiTro, ['KhoTQ', 'KhoVN'])) return err('Không có quyền');
    const [id] = args;
    if (!id) return err('Thiếu id');
    await prisma.hangVoChu.delete({ where: { id: Number(id) } });
    await logActivity(user.email, 'DELETE_HANG_VO_CHU', String(id));
    return ok();
  },

  async markLeftTQ(args, user) {
    if (!allow(user.vaiTro, ['KhoTQ'])) return err('Không có quyền');
    const [maDH, imageBase64] = args;
    const o = await prisma.donHang.findUnique({ where: { maDH } });
    if (!o) return err('Đơn không tồn tại');
    if (o.trangThai !== 'KhoTqNhan') return err('Đơn không ở Kho TQ');
    await prisma.donHang.update({
      where: { maDH },
      data: { trangThai: 'DangVanChuyen', anhRoiTQ: imageBase64 || null }
    });
    await logActivity(user.email, 'ROI_TQ', maDH, { trangThai: { truoc: o.trangThai, sau: 'DangVanChuyen' } });
    await pushNotify({
      vaiTro: 'KhoVN', loai: 'info', maDH,
      tieuDe: `Đơn ${maDH} đã rời kho TQ`,
      noiDung: 'Hàng đang vận chuyển về VN.', link: '/khovn', nguoiTao: user.email
    });
    return ok();
  },

  // ============== KHO VN ==============
  async confirmKhoVN(args, user) {
    if (!allow(user.vaiTro, ['KhoVN'])) return err('Không có quyền');
    const [maDH, imageBase64] = args;
    const o = await prisma.donHang.findUnique({ where: { maDH } });
    if (!o) return err('Đơn không tồn tại');
    if (o.trangThai !== 'DangVanChuyen') return err('Đơn không đang vận chuyển');
    // Hàng về kho VN: trả đủ → sẵn sàng giao (KhoVnNhan); còn nợ → chờ thanh toán.
    const newStatus: TrangThaiDon = o.conLai <= 0.5 ? 'KhoVnNhan' : 'ChoThanhToan';
    // 3B — Kho VN xác nhận nhận hàng = mốc CHỐT CÂN: sau đây chỉ Admin sửa được cân.
    // Không đè lại nếu cân đã chốt trước đó (giữ nguyên người/thời điểm chốt gốc).
    await prisma.donHang.update({
      where: { maDH },
      data: {
        trangThai: newStatus, anhKhoVN: imageBase64 || null,
        ...(o.canDaChot ? {} : { canDaChot: true, canChotBy: user.hoTen || user.email, canChotAt: new Date() })
      }
    });
    // Xác nhận cả đơn = mọi kiện của đơn đã về. Không đồng bộ ở đây thì khối
    // "Giao khách theo kiện" (#37) sẽ chặn với lý do "kiện chưa về kho VN".
    if (o.maVD) {
      const dem = await prisma.kienHang.count({ where: { maDH } });
      if (dem === 0) await syncKienTheoMaVD(maDH, o.maVD);
    }
    await prisma.kienHang.updateMany({
      where: { maDH, trangThai: 'ChuaVe' },
      data: { trangThai: 'DaVeVN', ngayVeVN: new Date(), nguoiNhan: user.hoTen || user.email }
    });
    await logActivity(user.email, 'KHO_VN_NHAN', maDH, {
      trangThai: { truoc: o.trangThai, sau: newStatus },
      ...(o.canDaChot ? {} : { canDaChot: { truoc: false, sau: true } })
    });
    if (newStatus === 'ChoThanhToan') {
      await pushNotify({
        vaiTro: ['KeToan', 'CSKH'], loai: 'warning', maDH,
        tieuDe: `Đơn ${maDH} chờ thanh toán`,
        noiDung: `Hàng đã về kho VN, còn nợ ${Math.round(o.conLai).toLocaleString('vi-VN')}đ`,
        link: '/ketoan', nguoiTao: user.email
      });
    } else {
      await pushNotify({
        vaiTro: ['CSKH', 'KhoVN'], loai: 'success', maDH,
        tieuDe: `Đơn ${maDH} đã về kho VN`,
        noiDung: 'Đã thanh toán đủ — sẵn sàng giao khách', link: '/khovn', nguoiTao: user.email
      });
    }
    return ok();
  },

  // 3B — Chốt cân chủ động: nhân viên kho bấm để khóa cân trước khi Kho VN xác nhận
  // (vd cân xong ở kho TQ). Sau khi chốt, chỉ Admin được sửa cân/kích thước.
  async chotCan(args, user) {
    if (!allow(user.vaiTro, ['KhoTQ', 'KhoVN'])) return err('Không có quyền chốt cân');
    const [maDH] = args;
    const don = await prisma.donHang.findUnique({ where: { maDH } });
    if (!don) return err('Không tìm thấy đơn');
    if (don.canDaChot) return err('Cân đã được chốt trước đó');
    await prisma.donHang.update({
      where: { maDH },
      data: { canDaChot: true, canChotBy: user.hoTen || user.email, canChotAt: new Date() }
    });
    await logActivity(user.email, 'CHOT_CAN', maDH, { canDaChot: { truoc: false, sau: true } });
    return ok();
  },

  async confirmDelivered(args, user) {
    if (!allow(user.vaiTro, ['KhoVN'])) return err('Không có quyền');
    const [maDH, imageBase64] = args;
    const o = await prisma.donHang.findUnique({ where: { maDH } });
    if (!o) return err('Đơn không tồn tại');
    if (!['KhoVnNhan', 'GiaoHang'].includes(o.trangThai)) return err('Đơn chưa sẵn sàng giao');
    if (o.conLai > 0.5) return err('Đơn còn nợ, không thể giao');
    await prisma.donHang.update({
      where: { maDH },
      data: { trangThai: 'HoanThanh', anhGiaoKH: imageBase64 || null }
    });
    // Giao cả đơn = mọi kiện đã giao (giữ tab Kiện hàng khớp với trạng thái đơn).
    await prisma.kienHang.updateMany({
      where: { maDH, trangThai: { not: 'DaGiao' } },
      data: { trangThai: 'DaGiao', ngayGiao: new Date(), nguoiGiao: user.hoTen || user.email }
    });
    await prisma.khachHang.update({
      where: { maKH: o.maKH },
      data: { tongDon: { increment: 1 }, doanhThu: { increment: o.tongTien } }
    });
    await recomputePhieuGiao(o.maPhieuGiao);
    await logActivity(user.email, 'DELIVERED', maDH, { trangThai: { truoc: o.trangThai, sau: 'HoanThanh' } });
    await pushNotify({
      vaiTro: ['CSKH', 'KeToan'], loai: 'success', maDH,
      tieuDe: `Đơn ${maDH} đã hoàn thành`,
      noiDung: 'Đã giao khách thành công.', link: '/admin/don-hang', nguoiTao: user.email
    });
    return ok();
  },

  // ============== BAO TONG / LO-CHUYEN (Đợt 5) ==============
  async createBaoTong(args, user) {
    if (!allow(user.vaiTro, ['KhoTQ'])) return err('Không có quyền');
    const d = args[0] || {};
    // Mã theo mã lớn nhất đang có + 1: đếm số dòng thì xoá bao ở giữa là sinh trùng mã.
    const last = await prisma.baoTong.findFirst({
      where: { maBao: { startsWith: 'BAO' } },
      orderBy: { maBao: 'desc' },
      select: { maBao: true }
    });
    const n = last ? parseInt(last.maBao.slice(3), 10) : 0;
    const maBao = 'BAO' + String(n + 1).padStart(4, '0');
    await prisma.baoTong.create({
      data: { maBao, line: (d.line as LineVC) || 'LineThuong', ghiChu: d.ghiChu || null, nguoiTao: user.hoTen || user.email }
    });
    await logActivity(user.email, 'CREATE_BAO', maBao, { line: d.line });
    return ok({ maBao });
  },

  async addOrderToBao(args, user) {
    if (!allow(user.vaiTro, ['KhoTQ'])) return err('Không có quyền');
    const [maBao, maDH] = args;
    if (!maBao || !maDH) return err('Thiếu mã bao hoặc mã đơn');
    const bao = await prisma.baoTong.findUnique({ where: { maBao } });
    if (!bao) return err('Bao không tồn tại');
    if (bao.trangThai !== 'DangDong') return err('Bao đã xuất, không thêm đơn được');
    const o = await prisma.donHang.findUnique({ where: { maDH: String(maDH).trim() } });
    if (!o) return err('Đơn không tồn tại: ' + maDH);
    if (o.trangThai !== 'KhoTqNhan') return err('Chỉ gán được đơn đang ở "Kho TQ nhận"');
    await prisma.donHang.update({ where: { maDH: o.maDH }, data: { maBao } });
    // Các kiện của đơn đi cùng bao — kho VN quét bao rồi bắn từng mã kiện (#28).
    await prisma.kienHang.updateMany({ where: { maDH: o.maDH }, data: { maBao } });
    await recomputeBao(maBao);
    await logActivity(user.email, 'ADD_TO_BAO', maBao, { maDH: o.maDH });
    return ok();
  },

  async removeOrderFromBao(args, user) {
    if (!allow(user.vaiTro, ['KhoTQ'])) return err('Không có quyền');
    const [maDH] = args;
    const o = await prisma.donHang.findUnique({ where: { maDH } });
    if (!o || !o.maBao) return err('Đơn không thuộc bao nào');
    const maBao = o.maBao;
    await prisma.donHang.update({ where: { maDH }, data: { maBao: null } });
    // Kiện phải rời bao cùng đơn, nếu không bao vẫn "còn kiện chưa về" mãi (#29).
    await prisma.kienHang.updateMany({ where: { maDH }, data: { maBao: null } });
    await recomputeBao(maBao);
    await logActivity(user.email, 'REMOVE_FROM_BAO', maBao, { maDH });
    return ok();
  },

  async xuatBao(args, user) {
    if (!allow(user.vaiTro, ['KhoTQ'])) return err('Không có quyền');
    const [maBao] = args;
    const bao = await prisma.baoTong.findUnique({ where: { maBao } });
    if (!bao) return err('Bao không tồn tại');
    if (bao.trangThai !== 'DangDong') return err('Bao đã xuất rồi');
    const orders = await prisma.donHang.findMany({ where: { maBao, trangThai: 'KhoTqNhan' } });
    if (orders.length === 0) return err('Bao chưa có đơn nào ở kho TQ để xuất');
    await prisma.$transaction([
      prisma.donHang.updateMany({ where: { maBao, trangThai: 'KhoTqNhan' }, data: { trangThai: 'DangVanChuyen' } }),
      prisma.baoTong.update({ where: { maBao }, data: { trangThai: 'DaXuat', xuatAt: new Date() } }),
    ]);
    // Chốt lại tổng kg/m³ của bao theo các đơn thành viên tại thời điểm xuất
    // (phòng khi đơn được cân lại sau khi thêm vào bao).
    await recomputeBao(maBao);
    await logActivity(user.email, 'XUAT_BAO', maBao, { soDon: orders.length });
    // Ghi log riêng theo TỪNG đơn để nhật ký đơn thấy được mốc đổi trạng thái khi xuất bao.
    for (const o of orders) {
      await logActivity(user.email, 'CHUYEN_TRANG_THAI', o.maDH, { trangThai: { truoc: 'KhoTqNhan', sau: 'DangVanChuyen' }, maBao });
    }
    await pushNotify({
      vaiTro: ['KhoVN'], loai: 'info',
      tieuDe: `Bao ${maBao} đang về VN`,
      noiDung: `${orders.length} đơn (${bao.line}) đã xuất từ kho TQ`,
      link: '/khovn', nguoiTao: user.email
    });
    return ok({ soDon: orders.length });
  },

  // Kho VN nhận cả bao: xác nhận từng đơn trong bao đã về; cảnh báo nếu còn đơn chưa về.
  async receiveBaoAtVN(args, user) {
    if (!allow(user.vaiTro, ['KhoVN'])) return err('Không có quyền');
    const [maBao] = args;
    const bao = await prisma.baoTong.findUnique({ where: { maBao } });
    if (!bao) return err('Bao không tồn tại: ' + maBao);
    if (!['DaXuat', 'DaVeVN'].includes(bao.trangThai)) return err('Bao chưa xuất từ TQ');
    const orders = await prisma.donHang.findMany({ where: { maBao } });
    // Đơn cũ chưa tách kiện → sinh bù để tab Kiện hàng phản ánh đúng thực tế.
    for (const o of orders) {
      const dem = await prisma.kienHang.count({ where: { maDH: o.maDH } });
      if (dem === 0 && o.maVD) await syncKienTheoMaVD(o.maDH, o.maVD);
    }
    // #29: chỉ đơn nào đã bắn đủ mã kiện mới được coi là về VN. Đơn còn kiện "ChuaVe"
    // vẫn nằm nguyên trạng thái vận chuyển và bao chưa hoàn thành — không nhận vống.
    const kienBao = await prisma.kienHang.findMany({ where: { maBao } });
    const chuaVeTheoDon = new Map<string, number>();
    for (const k of kienBao) {
      if (k.trangThai === 'ChuaVe') chuaVeTheoDon.set(k.maDH, (chuaVeTheoDon.get(k.maDH) || 0) + 1);
    }

    let received = 0;
    for (const o of orders) {
      if (o.trangThai !== 'DangVanChuyen') continue;
      if (chuaVeTheoDon.get(o.maDH)) continue; // còn kiện chưa bắn mã → chưa nhận đơn này
      const next: TrangThaiDon = o.conLai <= 0.5 ? 'KhoVnNhan' : 'ChoThanhToan';
      await prisma.donHang.update({ where: { maDH: o.maDH }, data: { trangThai: next } });
      await logActivity(user.email, 'CHUYEN_TRANG_THAI', o.maDH, { trangThai: { truoc: 'DangVanChuyen', sau: next }, maBao });
      received++;
    }

    const kienConThieu = kienBao.filter((k) => k.trangThai === 'ChuaVe').length;
    const donConThieu = orders.filter((o) => chuaVeTheoDon.get(o.maDH)).length;
    await prisma.baoTong.update({
      where: { maBao },
      data: {
        trangThai: kienConThieu === 0 ? 'HoanThanh' : 'DaVeVN',
        veVNAt: new Date(), nguoiNhanVN: user.hoTen || user.email
      }
    });
    // Đồng bộ lại tổng kg/m³ của bao theo đơn thành viên (đơn có thể được cân lại ở VN).
    await recomputeBao(maBao);
    await logActivity(user.email, 'NHAN_BAO_VN', maBao, { received, kienConThieu });
    return ok({ received, total: orders.length, conChua: donConThieu, kienConThieu });
  },

  // ============== SO QUY (góp ý NV #22, #42, #43) ==============
  // quy = CongTy → bút toán thu-chi nội bộ (Kế toán).
  // quy = KhoVN / KhoTQ → quỹ của kho: thu hộ khách, chi tiền ship; kho tự xem sổ của mình.
  async addSoQuy(args, user) {
    const d = args[0] || {};
    const quy = String(d.quy || 'CongTy');
    if (!QUY_HOP_LE.includes(quy)) return err('Quỹ không hợp lệ');
    if (!quyChoPhep(user.vaiTro).includes(quy)) return err(`Bạn không được ghi sổ quỹ ${quy}`);
    const soTien = Math.round(Number(d.soTien) || 0);
    if (soTien <= 0) return err('Số tiền phải lớn hơn 0');
    const noiDung = String(d.noiDung || '').trim();
    if (!noiDung) return err('Nhập nội dung thu / chi');
    const loai = d.loai === 'Chi' ? 'Chi' : 'Thu';

    const row = await prisma.soQuy.create({
      data: {
        quy, loai, soTien, noiDung,
        danhMuc: d.danhMuc ? String(d.danhMuc) : null,
        maDH: d.maDH ? String(d.maDH) : null,
        maKH: d.maKH ? String(d.maKH) : null,
        nguoiTao: user.email
      }
    });
    await logActivity(user.email, 'GHI_SO_QUY', quy, { loai, soTien, noiDung });
    return ok({ id: row.id });
  },

  async deleteSoQuy(args, user) {
    if (!allow(user.vaiTro, ['KeToan'])) return err('Chỉ Kế toán được xoá bút toán');
    const [id] = args;
    const row = await prisma.soQuy.findUnique({ where: { id: Number(id) } });
    if (!row) return err('Bút toán không tồn tại');
    // Chỉ xoá được bút toán của quỹ mình được ghi (cùng chốt với addSoQuy).
    if (!quyChoPhep(user.vaiTro).includes(row.quy)) return err(`Bạn không được xoá bút toán sổ quỹ ${row.quy}`);
    await prisma.soQuy.delete({ where: { id: row.id } });
    await logActivity(user.email, 'XOA_SO_QUY', String(row.id), { quy: row.quy, soTien: row.soTien });
    return ok();
  },

  // Góp ý NV #32: kho TQ có 2 nhân viên → ghi rõ ai trực tiếp làm, ai phụ trách.
  async setNguoiKhoTQ(args, user) {
    if (!allow(user.vaiTro, ['KhoTQ'])) return err('Không có quyền');
    const [maDH, patch] = args;
    const o = await prisma.donHang.findUnique({ where: { maDH } });
    if (!o) return err('Đơn không tồn tại');
    await prisma.donHang.update({
      where: { maDH },
      data: {
        nguoiLamTQ: patch?.nguoiLam !== undefined ? (String(patch.nguoiLam).trim() || null) : undefined,
        nguoiPhuTrachTQ: patch?.nguoiPhuTrach !== undefined ? (String(patch.nguoiPhuTrach).trim() || null) : undefined
      }
    });
    await logActivity(user.email, 'SET_NGUOI_KHO_TQ', maDH, patch);
    return ok();
  },

  // Góp ý NV #52, #53: admin đặt % hoa hồng (GDV) và % thưởng (CSKH) cho từng nhân viên.
  async setPctNhanVien(args, user) {
    if (user.vaiTro !== 'Admin') return err('Chỉ Admin đặt tỉ lệ hoa hồng / thưởng');
    const [id, patch] = args;
    const nv = await prisma.nhanVien.findUnique({ where: { id: Number(id) } });
    if (!nv) return err('Nhân viên không tồn tại');
    const clamp = (v: any) => Math.min(100, Math.max(0, Number(v) || 0));
    await prisma.nhanVien.update({
      where: { id: nv.id },
      data: {
        pctHoaHong: patch?.pctHoaHong !== undefined ? clamp(patch.pctHoaHong) : undefined,
        pctThuong: patch?.pctThuong !== undefined ? clamp(patch.pctThuong) : undefined
      }
    });
    await logActivity(user.email, 'SET_PCT_NV', nv.email, patch);
    return ok();
  },

  async updateShipVN(args, user) {
    if (!allow(user.vaiTro, ['KhoVN', 'CSKH'])) return err('Không có quyền');
    // Góp ý NV #41: kho VN chọn line vận chuyển nội địa kèm phí ship.
    const [maDH, shipVN, lineNoiDia] = args;
    const o = await prisma.donHang.findUnique({ where: { maDH } });
    if (!o) return err('Đơn không tồn tại');
    if (donDaChot(o.trangThai)) return err('Đơn đã hoàn thành / đã hủy — không sửa được phí ship');
    const line = lineNoiDia !== undefined ? (String(lineNoiDia).trim() || null) : undefined;
    const shipNDMoi = Math.max(0, Number(shipVN) || 0);
    await prisma.donHang.update({
      where: { maDH },
      data: { shipND: shipNDMoi, ...(line !== undefined && { lineNoiDia: line }) }
    });
    await recomputeDonHang(maDH);
    await logActivity(user.email, 'UPDATE_SHIP_VN', maDH, {
      shipND: { truoc: o.shipND, sau: shipNDMoi },
      ...(line !== undefined && { lineNoiDia: { truoc: o.lineNoiDia, sau: line } })
    });
    return ok();
  },

  // ============== KIEN HANG (góp ý NV #28, #37, #38) ==============

  // #28 bước 1: quét mã bao → mở bao và trả về danh sách kiện cần bắn từng mã.
  async openBaoAtVN(args, user) {
    if (!allow(user.vaiTro, ['KhoVN'])) return err('Không có quyền');
    const [maBaoRaw] = args;
    const maBao = String(maBaoRaw || '').trim();
    if (!maBao) return err('Quét / nhập mã bao');
    const bao = await prisma.baoTong.findUnique({ where: { maBao } });
    if (!bao) return err('Bao không tồn tại: ' + maBao);
    if (!['DaXuat', 'DaVeVN', 'HoanThanh'].includes(bao.trangThai)) return err('Bao chưa xuất từ TQ');

    if (bao.trangThai === 'DaXuat') {
      await prisma.baoTong.update({
        where: { maBao },
        data: { trangThai: 'DaVeVN', veVNAt: new Date(), nguoiNhanVN: user.hoTen || user.email }
      });
    }

    // Đơn tạo trước khi có bảng kiện thì chưa được tách kiện — sinh bù ngay tại đây
    // để kho vẫn bắn được từng mã, không phải chạy script riêng.
    const orders = await prisma.donHang.findMany({ where: { maBao } });
    for (const o of orders) {
      const dem = await prisma.kienHang.count({ where: { maDH: o.maDH } });
      if (dem === 0 && o.maVD) await syncKienTheoMaVD(o.maDH, o.maVD);
    }

    const kien = await prisma.kienHang.findMany({ where: { maBao }, orderBy: [{ maDH: 'asc' }, { maVD: 'asc' }] });
    await logActivity(user.email, 'MO_BAO_VN', maBao, { soKien: kien.length });
    return ok({
      maBao, line: bao.line, soKien: kien.length,
      daVe: kien.filter((k) => k.trangThai !== 'ChuaVe').length,
      kien: kien.map((k) => ({ maVD: k.maVD, maDH: k.maDH, trangThai: k.trangThai }))
    });
  },

  // #28 bước 2: sau khi quét mã bao, kho VN bắn từng mã vận đơn để xác nhận nhận đúng kiện đó.
  // Đơn chỉ chuyển trạng thái khi TẤT CẢ kiện của nó đã về (#38: về một phần thì đơn vẫn đang vận chuyển).
  async receiveKienVN(args, user) {
    if (!allow(user.vaiTro, ['KhoVN'])) return err('Không có quyền');
    const [maVDRaw] = args;
    const maVD = String(maVDRaw || '').trim();
    if (!maVD) return err('Bắn / nhập mã vận đơn');
    const kien = await timHoacSinhKien(maVD);
    if (kien === 'TRUNG') return err(`Mã VĐ "${maVD}" đang gắn với nhiều đơn — kiểm tra lại`);
    if (!kien) return err(`Không tìm thấy kiện có mã VĐ "${maVD}"`);
    if (kien.trangThai === 'DaGiao') return err(`Kiện ${maVD} đã giao khách rồi`);
    if (kien.trangThai === 'DaVeVN') return err(`Kiện ${maVD} đã nhận trước đó`);

    await prisma.kienHang.update({
      where: { id: kien.id },
      data: { trangThai: 'DaVeVN', ngayVeVN: new Date(), nguoiNhan: user.hoTen || user.email }
    });

    const cacKien = await prisma.kienHang.findMany({ where: { maDH: kien.maDH } });
    const conThieu = cacKien.filter((k) => k.trangThai === 'ChuaVe').length;
    const o = await prisma.donHang.findUnique({ where: { maDH: kien.maDH } });
    let trangThaiDon = o?.trangThai;

    // Đủ kiện → đơn về kho VN (trả đủ thì sẵn sàng giao, còn nợ thì chờ thanh toán).
    if (conThieu === 0 && o && o.trangThai === 'DangVanChuyen') {
      trangThaiDon = o.conLai <= 0.5 ? 'KhoVnNhan' : 'ChoThanhToan';
      await prisma.donHang.update({ where: { maDH: o.maDH }, data: { trangThai: trangThaiDon } });
    }

    // #29: bao chỉ hoàn thành khi mọi kiện trong bao đã được nhận.
    let baoConThieu = 0;
    if (kien.maBao) {
      const kienBao = await prisma.kienHang.findMany({ where: { maBao: kien.maBao } });
      baoConThieu = kienBao.filter((k) => k.trangThai === 'ChuaVe').length;
      if (baoConThieu === 0) {
        await prisma.baoTong.update({ where: { maBao: kien.maBao }, data: { trangThai: 'HoanThanh' } }).catch(() => {});
      }
    }

    await logActivity(user.email, 'NHAN_KIEN_VN', kien.maDH, {
      maVD, conThieu,
      ...(o && trangThaiDon !== o.trangThai && { trangThai: { truoc: o.trangThai, sau: trangThaiDon } })
    });
    return ok({
      maDH: kien.maDH, maVD, conThieu, tongKien: cacKien.length,
      daVe: cacKien.length - conThieu, trangThaiDon,
      maBao: kien.maBao, baoConThieu
    });
  },

  // #37 + #38: bắn mã từng kiện đã về để giao cho khách. Đơn về một phần vẫn giao được
  // các kiện đã về; đơn chỉ hoàn thành khi mọi kiện đều đã giao.
  async giaoKienVN(args, user) {
    if (!allow(user.vaiTro, ['KhoVN'])) return err('Không có quyền');
    const [maVDRaw, imageBase64] = args;
    const maVD = String(maVDRaw || '').trim();
    if (!maVD) return err('Bắn / nhập mã vận đơn');
    const kien = await timHoacSinhKien(maVD);
    if (kien === 'TRUNG') return err(`Mã VĐ "${maVD}" đang gắn với nhiều đơn — kiểm tra lại`);
    if (!kien) return err(`Không tìm thấy kiện có mã VĐ "${maVD}"`);
    if (kien.trangThai === 'ChuaVe') return err(`Kiện ${maVD} chưa về kho VN`);
    if (kien.trangThai === 'DaGiao') return err(`Kiện ${maVD} đã giao rồi`);

    const o = await prisma.donHang.findUnique({ where: { maDH: kien.maDH } });
    if (!o) return err('Đơn không tồn tại');
    // #39: thu đủ tiền trước khi giao hàng.
    if (o.conLai > 0.5) return err(`Đơn ${o.maDH} còn nợ ${Math.round(o.conLai).toLocaleString('vi-VN')}đ — chưa giao được`);

    await prisma.kienHang.update({
      where: { id: kien.id },
      data: { trangThai: 'DaGiao', ngayGiao: new Date(), nguoiGiao: user.hoTen || user.email }
    });

    const cacKien = await prisma.kienHang.findMany({ where: { maDH: kien.maDH } });
    const conLaiKien = cacKien.filter((k) => k.trangThai !== 'DaGiao').length;
    let trangThaiMoi: TrangThaiDon = o.trangThai;

    if (conLaiKien === 0) {
      // Giao hết kiện → đơn hoàn thành (cùng hiệu lực với nút "Đã giao tới KH").
      if (o.trangThai !== 'HoanThanh') {
        trangThaiMoi = 'HoanThanh';
        await prisma.donHang.update({
          where: { maDH: o.maDH },
          data: { trangThai: 'HoanThanh', anhGiaoKH: imageBase64 || o.anhGiaoKH || null }
        });
        await prisma.khachHang.update({
          where: { maKH: o.maKH },
          data: { tongDon: { increment: 1 }, doanhThu: { increment: o.tongTien } }
        });
        await recomputePhieuGiao(o.maPhieuGiao);
        await pushNotify({
          vaiTro: ['CSKH', 'KeToan'], loai: 'success', maDH: o.maDH,
          tieuDe: `Đơn ${o.maDH} đã hoàn thành`,
          noiDung: `Đã giao đủ ${cacKien.length} kiện cho khách.`, link: '/admin/don-hang', nguoiTao: user.email
        });
      }
    } else if (o.trangThai === 'KhoVnNhan') {
      // Mới giao một phần → đánh dấu đơn đang giao hàng.
      trangThaiMoi = 'GiaoHang';
      await prisma.donHang.update({ where: { maDH: o.maDH }, data: { trangThai: 'GiaoHang' } });
    }

    await logActivity(user.email, 'GIAO_KIEN', kien.maDH, {
      maVD, conLaiKien,
      ...(trangThaiMoi !== o.trangThai && { trangThai: { truoc: o.trangThai, sau: trangThaiMoi } })
    });
    return ok({ maDH: kien.maDH, maVD, conLaiKien, tongKien: cacKien.length });
  },

  // ============== PHIEU GIAO (Đợt 6) ==============
  async createPhieuGiao(args, user) {
    if (!allow(user.vaiTro, ['CSKH', 'KhoVN', 'KeToan'])) return err('Không có quyền');
    const d = args[0] || {};
    const maKH = d.maKH;
    const maDHs: string[] = Array.isArray(d.maDHs) ? d.maDHs.filter(Boolean) : [];
    if (!maKH) return err('Thiếu mã KH');
    if (maDHs.length === 0) return err('Chọn ít nhất 1 đơn để gộp phiếu');
    const orders = await prisma.donHang.findMany({ where: { maDH: { in: maDHs } } });
    if (orders.length !== maDHs.length) return err('Có đơn không tồn tại');
    const wrong = orders.find((o) => o.maKH !== maKH);
    if (wrong) return err(`Đơn ${wrong.maDH} không thuộc khách ${maKH}`);
    const inPhieu = orders.find((o) => o.maPhieuGiao);
    if (inPhieu) return err(`Đơn ${inPhieu.maDH} đã nằm trong phiếu ${inPhieu.maPhieuGiao}`);

    const kh = await prisma.khachHang.findUnique({ where: { maKH } });
    // Mã theo mã lớn nhất đang có + 1: đếm số dòng thì xoá phiếu ở giữa là sinh trùng mã.
    const lastPG = await prisma.phieuGiao.findFirst({
      where: { maPhieu: { startsWith: 'PG' } },
      orderBy: { maPhieu: 'desc' },
      select: { maPhieu: true }
    });
    const n = lastPG ? parseInt(lastPG.maPhieu.slice(2), 10) : 0;
    const maPhieu = 'PG' + String(n + 1).padStart(4, '0');
    const tongTien = orders.reduce((s, o) => s + o.tongTien, 0);
    const daThu = orders.reduce((s, o) => s + o.daTra, 0);
    const conLai = tongTien - daThu;

    await prisma.$transaction([
      prisma.phieuGiao.create({
        data: {
          maPhieu, maKH, tenKH: kh?.tenKH || null, soDon: orders.length,
          tongTien, daThu, conLai, ghiChu: d.ghiChu || null, nguoiTao: user.hoTen || user.email,
        }
      }),
      prisma.donHang.updateMany({ where: { maDH: { in: maDHs } }, data: { maPhieuGiao: maPhieu } }),
    ]);
    await logActivity(user.email, 'CREATE_PHIEU_GIAO', maPhieu, { maKH, soDon: orders.length, conLai });
    return ok({ maPhieu, conLai });
  },

  async deletePhieuGiao(args, user) {
    if (!allow(user.vaiTro, ['CSKH', 'KhoVN', 'KeToan'])) return err('Không có quyền');
    const [maPhieu] = args;
    if (!maPhieu) return err('Thiếu mã phiếu');
    await prisma.$transaction([
      prisma.donHang.updateMany({ where: { maPhieuGiao: maPhieu }, data: { maPhieuGiao: null } }),
      prisma.phieuGiao.delete({ where: { maPhieu } }),
    ]);
    await logActivity(user.email, 'DELETE_PHIEU_GIAO', maPhieu);
    return ok();
  },

  async getPhieuGiaoDetail(args, user) {
    if (!allow(user.vaiTro, ['CSKH', 'KhoVN', 'KeToan'])) return err('Không có quyền');
    const [maPhieu] = args;
    const p = await prisma.phieuGiao.findUnique({ where: { maPhieu } });
    if (!p) return err('Phiếu không tồn tại');
    const orders = await prisma.donHang.findMany({
      where: { maPhieuGiao: maPhieu },
      include: { chiTiet: { orderBy: { stt: 'asc' } } },
      orderBy: { ngayTao: 'asc' }
    });
    const kh = await prisma.khachHang.findUnique({ where: { maKH: p.maKH } });
    return ok({
      data: {
        maPhieu: p.maPhieu, maKH: p.maKH, tenKH: p.tenKH || kh?.tenKH || '',
        sdt: kh?.sdt || '', diaChi: kh?.diaChi || '',
        soDon: p.soDon, tongTien: p.tongTien, daThu: p.daThu, conLai: p.conLai,
        nguoiTao: p.nguoiTao || '', ghiChu: p.ghiChu || '', createdAt: p.createdAt.toISOString(),
        orders: orders.map((o) => ({
          maDH: o.maDH, trangThai: o.trangThai,
          nguoiNhan: o.nguoiNhan || '', diaChiNhan: o.diaChiNhan || '',
          tongTien: o.tongTien, daTra: o.daTra, conLai: o.conLai,
          hang: o.chiTiet.map((c) => `${c.tenSP} (x${c.soLuong})`).join(', ')
        }))
      }
    });
  },

  // ============== KHIEU NAI ==============
  async createKhieuNai(args, user) {
    const d = args[0] || {};
    if (!d.moTa) return err('Vui lòng nhập mô tả');
    if (!d.loai) return err('Vui lòng chọn loại khiếu nại');
    // Chống gắn khiếu nại vào đơn của người khác: khai maDH thì đơn phải tồn tại,
    // và nếu khai cả maKH thì đơn phải thuộc đúng khách đó.
    if (d.maDH) {
      const od = await prisma.donHang.findUnique({ where: { maDH: String(d.maDH) } });
      if (!od) return err('Đơn không tồn tại: ' + d.maDH);
      if (d.maKH && od.maKH !== String(d.maKH).trim().toUpperCase()) return err('Đơn không thuộc khách này');
    }
    const maKN = await nextMaKN();
    await prisma.khieuNai.create({
      data: {
        maKN,
        maDH: d.maDH || null,
        maKH: d.maKH || null,
        nguoiTao: d.nguoiTao || user?.email || 'KH',
        loai: d.loai as LoaiKN,
        moTa: d.moTa,
        anhBangChung: d.anhBangChung || null,
        trangThai: 'ChoXuLy'
      }
    });
    await logActivity(user?.email || null, 'CREATE_KHIEU_NAI', maKN, { loai: d.loai });
    await pushNotify({
      vaiTro: ['CSKH', 'Admin'], loai: 'warning', maDH: d.maDH || undefined,
      tieuDe: `Khiếu nại mới ${maKN}`,
      noiDung: `${d.maDH ? 'Đơn ' + d.maDH + ' · ' : ''}${String(d.moTa).slice(0, 80)}`,
      link: '/admin/khieu-nai', nguoiTao: d.nguoiTao || user?.email || 'KH'
    });
    return ok({ maKN });
  },

  async updateKhieuNai(args, user) {
    // Góp ý NV #46: kho VN cũng cập nhật được phí đổi trả / phí xử lý — nhưng CHỈ hai
    // trường đó, không được đụng phương án, tiền hoàn hay trạng thái duyệt.
    if (!allow(user.vaiTro, ['CSKH', 'KeToan', 'GDV', 'MuaHang', 'KhoVN'])) return err('Không có quyền');
    const chiPhiVaGhiChu = user.vaiTro === 'KhoVN';
    // Số tiền hoàn / hoàn ví là quyết định của CSKH - Kế toán - Admin (màn khiếu nại của họ);
    // GDV không được đặt — màn GDV vốn không gửi 2 trường này nên chỉ bỏ qua, không báo lỗi.
    const duocDatTienHoan = allow(user.vaiTro, ['CSKH', 'KeToan']);
    const [maKN, patch] = args;
    if (!maKN) return err('Thiếu mã KN');
    const kn = await prisma.khieuNai.findUnique({ where: { maKN } });
    if (!kn) return err('Khiếu nại không tồn tại');
    const data: any = {};
    if (patch?.phiDoiTra !== undefined) data.phiDoiTra = Math.max(0, Number(patch.phiDoiTra) || 0);
    if (patch?.ghiChuXuLy !== undefined) data.ghiChuXuLy = patch.ghiChuXuLy;
    if (!chiPhiVaGhiChu) {
      // Các trạng thái thuộc luồng duyệt 2 cấp chỉ được đặt bởi chính nút duyệt cấp 1 / cấp 2.
      // (DuyetDoiTra / DuyetHoanTien / DuyetGiamGia không có bước duyệt nào đặt tới → chọn tay là kẹt đơn.)
      const TT_LUONG_DUYET: TrangThaiKN[] = ['DangDuyetCap1', 'DangDuyetCap2', 'DuyetDoiTra', 'DuyetHoanTien', 'DuyetGiamGia', 'DaXuLy'];
      if (patch?.trangThai && patch.trangThai !== kn.trangThai) {
        if (TT_LUONG_DUYET.includes(patch.trangThai as TrangThaiKN)) {
          return err('Trạng thái này chỉ đặt được qua bước duyệt khiếu nại');
        }
        data.trangThai = patch.trangThai as TrangThaiKN;
      }
      if (patch?.phuongAn !== undefined) data.phuongAn = patch.phuongAn;
      if (duocDatTienHoan) {
        if (patch?.soTienHoan !== undefined) data.soTienHoan = Number(patch.soTienHoan) || 0;
        if (patch?.hoanVi !== undefined) data.hoanVi = !!patch.hoanVi;
      }
      if (patch?.quyChiuPhi !== undefined) data.quyChiuPhi = patch.quyChiuPhi || null;
      if (patch?.doiTacNCC !== undefined) data.doiTacNCC = patch.doiTacNCC || null;
    }
    if (Object.keys(data).length === 0) return ok();
    await prisma.khieuNai.update({ where: { maKN }, data });
    await logActivity(user.email, 'UPDATE_KHIEU_NAI', maKN, data);
    return ok();
  },

  // Góp ý NV #9: CSKH sửa phí phát sinh sau khi đơn đã tạo → gửi lại Kế toán duyệt.
  async updatePhiPhatSinh(args, user) {
    if (!allow(user.vaiTro, ['CSKH'])) return err('Không có quyền');
    const [maDH, soTien] = args;
    const o = await prisma.donHang.findUnique({ where: { maDH } });
    if (!o) return err('Đơn không tồn tại');
    const v = Math.max(0, Math.round(Number(soTien) || 0));
    await prisma.donHang.update({
      where: { maDH },
      data: { phiPhatSinh: v, phiPhatSinhDuyet: false, phiPhatSinhDuyetBy: null, phiPhatSinhDuyetAt: null }
    });
    await recomputeDonHang(maDH);
    await recomputePhieuGiao(o.maPhieuGiao);
    await logActivity(user.email, 'SUA_PHI_PHAT_SINH', maDH, { cu: o.phiPhatSinh, moi: v });
    if (v > 0) {
      await pushNotify({
        vaiTro: ['KeToan'], loai: 'warning', maDH,
        tieuDe: `Phí phát sinh đơn ${maDH} chờ duyệt`,
        noiDung: `${user.email} nhập ${v.toLocaleString('vi-VN')}đ — cần Kế toán duyệt mới cộng vào đơn.`,
        link: '/ketoan', nguoiTao: user.email
      });
    }
    return ok();
  },

  // Góp ý NV #45: CSKH tiếp nhận kiện khiếu nại của khách rồi chuyển về kho VN,
  // kèm mã vận đơn khách gửi trả để kho còn đối chiếu khi hàng tới.
  async chuyenKNVeKhoVN(args, user) {
    if (!allow(user.vaiTro, ['CSKH'])) return err('Không có quyền');
    const [maKN, maVDTraHang] = args;
    const kn = await prisma.khieuNai.findUnique({ where: { maKN } });
    if (!kn) return err('Khiếu nại không tồn tại');
    const maVD = String(maVDTraHang || '').trim();
    if (!maVD) return err('Nhập mã vận đơn khách gửi trả');
    await prisma.khieuNai.update({
      where: { maKN },
      data: { maVDTraHang: maVD, chuyenKhoVN: true, chuyenKhoVNAt: new Date() }
    });
    await logActivity(user.email, 'CHUYEN_KN_KHO_VN', maKN, { maVDTraHang: maVD });
    await pushNotify({
      vaiTro: ['KhoVN'], loai: 'warning', maDH: kn.maDH || undefined,
      tieuDe: `Hàng khiếu nại ${maKN} sẽ về kho`,
      noiDung: `Khách gửi trả theo mã VĐ ${maVD}${kn.maDH ? ' (đơn ' + kn.maDH + ')' : ''}. Nhận hàng thì tích xác nhận.`,
      link: '/khovn', nguoiTao: user.email
    });
    return ok();
  },

  // Góp ý NV #44 + #46: kho VN bắn mã VĐ khách gửi trả, tích đã nhận hàng khiếu nại
  // và cập nhật phí đổi trả / phí xử lý.
  async khoVnNhanHangKN(args, user) {
    if (!allow(user.vaiTro, ['KhoVN'])) return err('Không có quyền');
    const [maVDRaw, patch] = args;
    const maVD = String(maVDRaw || '').trim();
    if (!maVD) return err('Bắn / nhập mã vận đơn hàng khiếu nại');
    const kn = await prisma.khieuNai.findFirst({ where: { maVDTraHang: maVD } });
    if (!kn) return err(`Không có khiếu nại nào gắn mã VĐ "${maVD}"`);
    if (kn.daNhanHangKN) return err(`Hàng khiếu nại ${kn.maKN} đã nhận trước đó`);

    const phiDoiTra = patch?.phiDoiTra !== undefined ? Math.max(0, Number(patch.phiDoiTra) || 0) : undefined;
    await prisma.khieuNai.update({
      where: { maKN: kn.maKN },
      data: {
        daNhanHangKN: true, ngayNhanKN: new Date(), nguoiNhanKN: user.hoTen || user.email,
        ...(phiDoiTra !== undefined && { phiDoiTra }),
        ...(patch?.ghiChu && { ghiChuXuLy: String(patch.ghiChu) })
      }
    });
    await logActivity(user.email, 'KHO_VN_NHAN_HANG_KN', kn.maKN, { maVD, phiDoiTra });
    await pushNotify({
      vaiTro: ['CSKH', 'KeToan'], loai: 'info', maDH: kn.maDH || undefined,
      tieuDe: `Kho VN đã nhận hàng khiếu nại ${kn.maKN}`,
      noiDung: `Mã VĐ ${maVD}${phiDoiTra ? ` · phí đổi trả ${Math.round(phiDoiTra).toLocaleString('vi-VN')}đ` : ''}`,
      link: '/admin/khieu-nai', nguoiTao: user.email
    });
    return ok({ maKN: kn.maKN, maDH: kn.maDH });
  },

  async duyetKhieuNaiCap1(args, user) {
    if (!allow(user.vaiTro, ['KeToan', 'CSKH'])) return err('Không có quyền');
    const [maKN, note] = args;
    // Chốt trạng thái server-side: chỉ duyệt cấp 1 khi KN đang chờ/đang xử lý,
    // tránh duyệt lại đơn đã qua cấp 2 / đã xử lý / đã từ chối bằng lệnh trực tiếp.
    const kn = await prisma.khieuNai.findUnique({ where: { maKN } });
    if (!kn) return err('Khiếu nại không tồn tại');
    if (!['ChoXuLy', 'DangXuLy'].includes(kn.trangThai)) {
      return err('Khiếu nại không ở trạng thái chờ duyệt cấp 1');
    }
    await prisma.khieuNai.update({
      where: { maKN },
      data: {
        duyetCap1By: user.email,
        duyetCap1At: new Date(),
        duyetCap1Note: note || '',
        trangThai: 'DangDuyetCap2'
      }
    });
    await logActivity(user.email, 'DUYET_KN_CAP1', maKN);
    return ok();
  },

  async duyetKhieuNaiCap2(args, user) {
    if (user.vaiTro !== 'Admin') return err('Chỉ Admin duyệt cấp 2');
    const [maKN, accepted, note] = args;
    const kn = await prisma.khieuNai.findUnique({ where: { maKN } });
    if (!kn) return err('Khiếu nại không tồn tại');
    // Chốt 2 cấp: chỉ duyệt cấp 2 khi đã qua cấp 1 (đang chờ duyệt cấp 2). Chặn
    // gọi API trực tiếp bỏ qua cấp 1, và chặn duyệt lại KN đã xử lý/từ chối.
    if (kn.trangThai !== 'DangDuyetCap2') {
      return err('Khiếu nại chưa qua duyệt cấp 1 (hoặc đã xử lý xong)');
    }

    // Gộp đổi trạng thái + hoàn ví + cấn trừ NCC vào MỘT transaction để sổ sách
    // không bao giờ lệch nửa chừng. Idempotent qua daHoanVi/daTruNCC.
    let hoanVi = 0;
    let truNCC = 0;
    let phiVeKhach = 0;
    await prisma.$transaction(async (tx) => {
      await tx.khieuNai.update({
        where: { maKN },
        data: {
          duyetCap2By: user.email,
          duyetCap2At: new Date(),
          duyetCap2Note: note || '',
          trangThai: accepted ? 'DaXuLy' : 'TuChoi'
        }
      });

      // Duyệt + chọn hoàn ví + có số tiền + chưa hoàn → nạp tự động vào ví KH.
      if (accepted && kn.hoanVi && !kn.daHoanVi && kn.soTienHoan > 0 && kn.maKH) {
        const khh = await tx.khachHang.findUnique({ where: { maKH: kn.maKH } });
        if (khh) {
          const newDu = khh.soDuVi + kn.soTienHoan;
          await tx.khachHang.update({ where: { maKH: kn.maKH }, data: { soDuVi: newDu } });
          await tx.giaoDichVi.create({
            data: {
              maKH: kn.maKH, loai: 'Nap', soTien: kn.soTienHoan, soDuSau: newDu,
              quy: kn.quyChiuPhi || 'QuyKho',
              ghiChu: `Hoàn tiền khiếu nại ${maKN}${kn.maDH ? ' (đơn ' + kn.maDH + ')' : ''}`,
              nv: user.email, nvId: user.id
            }
          });
          await tx.khieuNai.update({ where: { maKN }, data: { daHoanVi: true } });
          hoanVi = kn.soTienHoan;
        }
      }

      // Quỹ chịu = NCC → cấn trừ khoản bồi thường (tiền hoàn + phí đổi trả) vào
      // sổ công nợ NCC (giảm nợ phải trả NCC = đòi lại NCC). Idempotent qua daTruNCC.
      if (accepted && kn.quyChiuPhi === 'NCC' && kn.doiTacNCC && !kn.daTruNCC) {
        const boiThuong = (kn.soTienHoan || 0) + (kn.phiDoiTra || 0);
        if (boiThuong > 0) {
          await tx.congNoNCC.create({
            data: {
              doiTac: kn.doiTacNCC, maDH: kn.maDH || null, loai: 'ThanhToan',
              soTien: boiThuong,
              ghiChu: `NCC bồi thường khiếu nại ${maKN} (cấn trừ công nợ)`,
              nguoiTao: user.email
            }
          });
          await tx.khieuNai.update({ where: { maKN }, data: { daTruNCC: true } });
          truNCC = boiThuong;
        }
      }

      // Góp ý NV #47: quỹ chịu = Khách hàng → phí đổi trả cộng vào khoản phải thu của
      // đơn (cột riêng phi_khieu_nai để báo cáo vẫn tách được chi phí khiếu nại — #49).
      if (accepted && kn.quyChiuPhi === 'KhachHang' && kn.phiDoiTra > 0 && !kn.daTinhPhiKH && kn.maDH) {
        const don = await tx.donHang.findUnique({ where: { maDH: kn.maDH } });
        if (don) {
          await tx.donHang.update({
            where: { maDH: kn.maDH },
            data: { phiKhieuNai: don.phiKhieuNai + kn.phiDoiTra }
          });
          await tx.khieuNai.update({ where: { maKN }, data: { daTinhPhiKH: true } });
          await logActivity(user.email, 'CONG_PHI_KHIEU_NAI', kn.maDH, {
            phiKhieuNai: { truoc: don.phiKhieuNai, sau: don.phiKhieuNai + kn.phiDoiTra }, maKN
          });
          phiVeKhach = kn.phiDoiTra;
        }
      }
    });

    // recompute nằm ngoài transaction vì đọc lại đơn + bảng giá; idempotent.
    if (phiVeKhach > 0 && kn.maDH) {
      await recomputeDonHang(kn.maDH);
      const don = await prisma.donHang.findUnique({ where: { maDH: kn.maDH } });
      await recomputePhieuGiao(don?.maPhieuGiao);
      await pushNotify({
        vaiTro: ['KeToan', 'CSKH'], loai: 'warning', maDH: kn.maDH,
        tieuDe: `Phí đổi trả ${Math.round(phiVeKhach).toLocaleString('vi-VN')}đ cần thu của khách`,
        noiDung: `Khiếu nại ${maKN} — khách chịu phí, đã cộng vào khoản phải thu của đơn ${kn.maDH}.`,
        link: '/ketoan', nguoiTao: user.email
      });
    }

    await logActivity(user.email, 'DUYET_KN_CAP2', maKN, { accepted, hoanVi, quy: kn.quyChiuPhi, truNCC, phiVeKhach });
    return ok({ hoanVi, truNCC, phiVeKhach });
  },

  // ============== YEU CAU MUA (public) ==============
  async createYeuCauMua(args, user) {
    const d = args[0] || {};
    if (!d.hoTen || !String(d.hoTen).trim()) return err('Vui lòng nhập họ tên');
    if (!d.sdt || !String(d.sdt).trim()) return err('Vui lòng nhập số điện thoại');
    const items = Array.isArray(d.sanPham)
      ? d.sanPham.filter((it: any) => (it?.link && String(it.link).trim()) || (it?.ten && String(it.ten).trim()))
      : [];
    if (items.length === 0) return err('Vui lòng nhập ít nhất 1 sản phẩm (link hoặc tên)');
    const maYC = await nextMaYC();
    await prisma.yeuCauMua.create({
      data: {
        maYC,
        hoTen: String(d.hoTen).trim(),
        sdt: String(d.sdt).trim(),
        email: d.email ? String(d.email).trim() : null,
        maKH: d.maKH ? String(d.maKH).trim().toUpperCase() : null,
        tuyen: normTuyen(d.tuyen),
        sanPham: JSON.stringify(items.map((it: any) => ({
          link: String(it.link || '').trim(),
          ten: String(it.ten || '').trim(),
          soLuong: Number(it.soLuong) || 1,
          ghiChu: String(it.ghiChu || '').trim()
        }))),
        ghiChu: d.ghiChu ? String(d.ghiChu).trim() : null,
        trangThai: 'ChoXuLy'
      }
    });
    await logActivity(user?.email || null, 'CREATE_YEU_CAU', maYC, { hoTen: d.hoTen, items: items.length });
    return ok({ maYC });
  },

  async updateYeuCauMua(args, user) {
    if (!allow(user.vaiTro, ['CSKH'])) return err('Không có quyền');
    const [maYC, patch] = args;
    if (!maYC) return err('Thiếu mã yêu cầu');
    const data: any = { nvXuLy: user.email };
    if (patch?.trangThai) data.trangThai = patch.trangThai as TrangThaiYC;
    if (patch?.ghiChuXuLy !== undefined) data.ghiChuXuLy = patch.ghiChuXuLy;
    if (patch?.maDH !== undefined) data.maDH = patch.maDH || null;
    await prisma.yeuCauMua.update({ where: { maYC }, data });
    await logActivity(user.email, 'UPDATE_YEU_CAU', maYC, patch);
    return ok();
  },

  // ============== ADMIN: USERS ==============
  async createUser(args, user) {
    if (user.vaiTro !== 'Admin') return err('Chỉ Admin');
    const d = args[0] || {};
    if (!d.email || !d.password || !d.hoTen || !d.vaiTro) return err('Thiếu thông tin');
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.default.hash(d.password, 10);
    await prisma.nhanVien.create({
      data: {
        email: String(d.email).toLowerCase().trim(),
        passwordHash: hash,
        hoTen: d.hoTen,
        vaiTro: d.vaiTro as VaiTro
      }
    });
    await logActivity(user.email, 'CREATE_USER', d.email, { vaiTro: d.vaiTro });
    return ok();
  },

  async updateUser(args, user) {
    if (user.vaiTro !== 'Admin') return err('Chỉ Admin');
    const [id, patch] = args;
    const data: any = {};
    if (patch.hoTen) data.hoTen = patch.hoTen;
    if (patch.vaiTro) data.vaiTro = patch.vaiTro;
    if (patch.trangThai) data.trangThai = patch.trangThai;
    if (patch.password) {
      const bcrypt = await import('bcryptjs');
      data.passwordHash = await bcrypt.default.hash(patch.password, 10);
    }
    await prisma.nhanVien.update({ where: { id: Number(id) }, data });
    // Không ghi mật khẩu vào nhật ký — chỉ ghi là có đổi hay không.
    const { password, ...patchLog } = patch || {};
    await logActivity(user.email, 'UPDATE_USER', String(id), { ...patchLog, ...(password ? { doiMatKhau: true } : {}) });
    return ok();
  },

  // ============== ADMIN: CAI DAT ==============
  async setSetting(args, user) {
    if (user.vaiTro !== 'Admin') return err('Chỉ Admin');
    const [ten, giaTri, ghiChu] = args;
    const { setSetting } = await import('@/lib/settings');
    await setSetting(ten, String(giaTri ?? ''), ghiChu);
    await logActivity(user.email, 'SET_SETTING', ten, { giaTri });
    return ok();
  },

  // ============== KH update ==============
  async updateKhachHang(args, user) {
    if (!allow(user.vaiTro, ['CSKH'])) return err('Không có quyền');
    const [maKH, patch] = args;
    const data: any = {};
    if (patch.tenKH) data.tenKH = patch.tenKH;
    if (patch.sdt !== undefined) data.sdt = patch.sdt;
    if (patch.email !== undefined) data.email = patch.email;
    if (patch.diaChi !== undefined) data.diaChi = patch.diaChi;
    if (patch.tuyen) data.tuyen = normTuyen(patch.tuyen);
    if (patch.pctCoc !== undefined) data.pctCoc = Number(patch.pctCoc) || 70;
    // Đợt bổ sung — % phí riêng của khách (null = dùng % chung hệ thống). Kẹp trong [0,100].
    const clampPct = (v: any) => Math.min(100, Math.max(0, Number(v) || 0));
    if (patch.phiMuaPctRieng !== undefined)
      data.phiMuaPctRieng = patch.phiMuaPctRieng === null ? null : clampPct(patch.phiMuaPctRieng);
    if (patch.phiBhPctRieng !== undefined)
      data.phiBhPctRieng = patch.phiBhPctRieng === null ? null : clampPct(patch.phiBhPctRieng);
    // 3B — bật/tắt bảo hiểm mặc định của khách (tri-state; null = theo công ty).
    if (patch.baoHiemRieng !== undefined)
      data.baoHiemRieng = patch.baoHiemRieng === true ? true : patch.baoHiemRieng === false ? false : null;
    // GDV phụ trách (null = chưa phân). Ép về số nguyên hợp lệ, không thì để null.
    if (patch.gdvPhuTrachId !== undefined) {
      const gid = patch.gdvPhuTrachId === null ? null : Math.trunc(Number(patch.gdvPhuTrachId));
      data.gdvPhuTrachId = gid && gid > 0 ? gid : null;
    }
    // Nạp bản ghi cũ TRƯỚC khi cập nhật để log được "trước → sau" (không log mật khẩu).
    const cur = await prisma.khachHang.findUnique({ where: { maKH } });
    await prisma.khachHang.update({ where: { maKH }, data });
    await logActivity(user.email, 'UPDATE_CUSTOMER', maKH,
      cur ? diffFields(cur, data, ['tenKH', 'sdt', 'email', 'diaChi', 'tuyen', 'pctCoc', 'phiMuaPctRieng', 'phiBhPctRieng', 'baoHiemRieng', 'gdvPhuTrachId']) : {});
    return ok();
  },

  // ============== HUY DON (item 8) ==============
  // Hủy đơn + (tuỳ chọn) hoàn tiền đã thu vào ví KH — vd "Hủy – Khiếu nại NCC".
  async cancelOrder(args, user) {
    if (!allow(user.vaiTro, ['CSKH'])) return err('Không có quyền');
    const [maDH, opt] = args;
    const lyDo = String(opt?.lyDo || '').trim();
    const hoanVi = !!opt?.hoanVi;
    if (!maDH) return err('Thiếu mã đơn');
    if (!lyDo) return err('Vui lòng nhập lý do hủy');
    const o = await prisma.donHang.findUnique({ where: { maDH } });
    if (!o) return err('Đơn không tồn tại');
    if (o.trangThai === 'Huy') return err('Đơn đã hủy trước đó');
    if (o.trangThai === 'HoanThanh') return err('Đơn đã hoàn thành, không thể hủy');

    let hoanTien = 0;
    await prisma.$transaction(async (tx) => {
      await tx.donHang.update({
        where: { maDH },
        data: { trangThai: 'Huy', conLai: 0, ghiChu: (o.ghiChu ? o.ghiChu + ' · ' : '') + 'HỦY: ' + lyDo }
      });
      // Hoàn phần đã thu vào ví khách (idempotent tự nhiên: đơn chuyển Huy nên không hủy lại được).
      if (hoanVi && o.daTra > 0 && o.maKH) {
        const kh = await tx.khachHang.findUnique({ where: { maKH: o.maKH } });
        if (kh) {
          const newDu = kh.soDuVi + o.daTra;
          await tx.khachHang.update({ where: { maKH: o.maKH }, data: { soDuVi: newDu } });
          await tx.giaoDichVi.create({
            data: {
              maKH: o.maKH, loai: 'Nap', soTien: o.daTra, soDuSau: newDu, quy: 'QuyKho',
              ghiChu: `Hoàn tiền hủy đơn ${maDH}: ${lyDo}`, nv: user.email, nvId: user.id
            }
          });
          await tx.thanhToan.create({
            data: { maDH, loai: 'Chi', soTien: o.daTra, ghiChu: `Hoàn tiền hủy đơn (vào ví): ${lyDo}`, nv: user.email, nvId: user.id }
          });
          hoanTien = o.daTra;
        }
      }
    });
    await recomputePhieuGiao(o.maPhieuGiao);
    await logActivity(user.email, 'CANCEL_ORDER', maDH, { trangThai: { truoc: o.trangThai, sau: 'Huy' }, lyDo, hoanTien });
    await pushNotify({
      vaiTro: ['CSKH', 'KeToan', 'Admin'], loai: 'danger', maDH,
      tieuDe: `Đơn ${maDH} đã hủy`,
      noiDung: `${lyDo}${hoanTien ? ' · hoàn ví ' + Math.round(hoanTien).toLocaleString('vi-VN') + 'đ' : ''}`,
      link: '/admin/don-hang', nguoiTao: user.email
    });
    return ok({ hoanTien });
  },

  // ============== ORDER DETAIL ==============
  async getOrderDetail(args, user) {
    const [maDH] = args;
    const o = await prisma.donHang.findUnique({
      where: { maDH },
      include: {
        nv: true,
        khachHang: true,
        chiTiet: { orderBy: { stt: 'asc' } },
        payments: { orderBy: { ngay: 'asc' } }
      }
    });
    if (!o) return err('Đơn không tồn tại');
    // Chống IDOR: khách chỉ được xem đơn của CHÍNH mình (dò mã đơn tuần tự).
    if (user?.vaiTro === 'Customer') {
      const own = await prisma.khachHang.findFirst({ where: { email: user.email } });
      if (!own || own.maKH !== o.maKH) return err('Không có quyền xem đơn này');
    }
    const canSeeMoney = ['Admin', 'CSKH', 'KeToan', 'Customer'].includes(user?.vaiTro || 'Customer');
    // Góp ý NV #21: Kế toán làm việc trên số tiền, không cần thông tin liên lạc của khách.
    // Kho TQ không được biết danh tính khách (giấu xuyên suốt hệ thống) → giấu cả tên & địa chỉ.
    const canSeeLienHe = user?.vaiTro !== 'KeToan' && user?.vaiTro !== 'KhoTQ';
    const canSeeTenKH = user?.vaiTro !== 'KhoTQ';
    // Giá vốn & lợi nhuận: CHỈ Admin / Kế toán / GDV được xem (CSKH không thấy).
    const canSeeProfit = ['Admin', 'KeToan', 'GDV', 'MuaHang'].includes(user?.vaiTro || '');
    const tongThuNDT = o.chiTiet.reduce((s, c) => s + c.donGiaNDT * c.soLuong, 0);
    return ok({
      data: {
        maDH: o.maDH,
        ngayTao: o.ngayTao.toISOString(),
        maKH: o.maKH,
        tenKH: canSeeTenKH ? (o.khachHang?.tenKH || '') : '',
        sdt: canSeeLienHe ? (o.khachHang?.sdt || '') : '',
        tuyen: o.tuyen,
        lineVC: o.lineVC,
        loaiHang: o.loaiHang,
        trangThai: o.trangThai,
        maGD: o.maGD, maVD: o.maVD,
        nvName: o.nv?.hoTen || o.nvTao || '',
        tongKg: o.tongKg, tongM3: o.tongM3,
        pctCoc: o.pctCoc,
        chiTiet: o.chiTiet.map((c) => ({
          stt: c.stt, tenSP: c.tenSP, soLuong: c.soLuong,
          donGiaNDT: canSeeMoney ? c.donGiaNDT : 0,
          tyGia: c.tyGia,
          donGiaVND: canSeeMoney ? c.donGiaVND : 0,
          thanhTien: canSeeMoney ? c.thanhTien : 0,
          kg: c.kg, m3: c.m3, dai: c.dai, rong: c.rong, cao: c.cao,
          vonNDT: canSeeProfit ? c.vonNDT : 0,
          webNguon: c.webNguon, linkTaobao: c.linkTaobao, ghiChu: c.ghiChu
        })),
        tongGiaHang: canSeeMoney ? o.tongGiaHang : 0,
        phiMua: canSeeMoney ? o.phiMua : 0,
        phiBH: canSeeMoney ? o.phiBH : 0,
        phiPhatSinh: canSeeMoney ? o.phiPhatSinh : 0,
        phiPhatSinhDuyet: o.phiPhatSinhDuyet,
        phiKhieuNai: canSeeMoney ? o.phiKhieuNai : 0,
        phiVC: canSeeMoney ? o.phiVC : 0,
        shipND: canSeeMoney ? o.shipND : 0,
        dongGo: canSeeMoney ? o.dongGo : 0,
        phuThu: canSeeMoney ? o.phuThu : 0,
        thueNK: canSeeMoney ? o.thueNK : 0,
        vat: canSeeMoney ? o.vat : 0,
        phiKiemHoa: canSeeMoney ? o.phiKiemHoa : 0,
        phiLuuKho: canSeeMoney ? o.phiLuuKho : 0,
        ngachHQ: o.ngachHQ,
        kiemDem: o.kiemDem,
        // 3B — trạng thái bật/tắt bảo hiểm cấp đơn (null = theo khách/công ty) để UI hiển thị/sửa.
        coBaoHiem: o.coBaoHiem,
        // 3B — khóa cân: đơn đã chốt cân thì kho không sửa được nữa (chỉ Admin).
        canDaChot: o.canDaChot,
        canChotBy: o.canChotBy || '',
        canChotAt: o.canChotAt ? o.canChotAt.toISOString() : null,
        nguoiNhan: canSeeTenKH ? (o.nguoiNhan || '') : '',
        sdtNhan: canSeeLienHe ? (o.sdtNhan || '') : '',
        diaChiNhan: canSeeTenKH ? (o.diaChiNhan || '') : '',
        tongTien: canSeeMoney ? o.tongTien : 0,
        tienCoc: canSeeMoney ? o.tienCoc : 0,
        daTra: canSeeMoney ? o.daTra : 0,
        conLai: canSeeMoney ? o.conLai : 0,
        ghiChu: o.ghiChu || '',
        ghiChuGDV: o.ghiChuGDV || '',
        lineNoiDia: o.lineNoiDia || '',
        canSeeProfit,
        vonNDT: canSeeProfit ? o.vonNDT : 0,
        shipNDTQ: canSeeProfit ? o.shipNDTQ : 0,
        tongThuNDT: canSeeProfit ? tongThuNDT : 0,
        loiNhuanNDT: canSeeProfit ? o.loiNhuanNDT : 0,
        anh: {
          khoTQ: o.anhKhoTQ || undefined,
          roiTQ: o.anhRoiTQ || undefined,
          khoVN: o.anhKhoVN || undefined,
          giaoKH: o.anhGiaoKH || undefined
        },
        payments: canSeeMoney ? o.payments.map((p) => ({
          soTien: p.soTien, ghiChu: p.ghiChu,
          ngay: p.ngay.toISOString(), nv: p.nv || ''
        })) : []
      }
    });
  },

  // Chi tiết 1 khách hàng + danh sách đơn (drill-down từ báo cáo/danh sách KH).
  // Staff-only (thấy tiền/công nợ). Không cho Customer/kho gọi.
  async getCustomerDetail(args, user) {
    if (!allow(user.vaiTro, ['CSKH', 'KeToan'])) return err('Không có quyền');
    const ma = String(args[0] || '').trim().toUpperCase();
    if (!ma) return err('Thiếu mã KH');
    const kh = await prisma.khachHang.findUnique({ where: { maKH: ma } });
    if (!kh) return err('Không tìm thấy khách hàng: ' + ma);
    const dons = await prisma.donHang.findMany({
      where: { maKH: ma },
      orderBy: { ngayTao: 'desc' },
      take: 100,
      select: { maDH: true, ngayTao: true, trangThai: true, tongTien: true, daTra: true, conLai: true }
    });
    // Công nợ thật = tổng còn lại các đơn chưa hủy (không đọc field congNo có thể lệch).
    const noAgg = await prisma.donHang.aggregate({
      where: { maKH: ma, conLai: { gt: 0 }, trangThai: { not: 'Huy' } },
      _sum: { conLai: true }
    });
    const dtAgg = await prisma.donHang.aggregate({
      where: { maKH: ma, trangThai: { not: 'Huy' } },
      _sum: { tongTien: true }
    });
    // Kế toán không cần thông tin liên lạc (đồng bộ getOrderDetail — góp ý NV #21).
    const canSeeLienHe = user.vaiTro !== 'KeToan';
    return ok({
      data: {
        maKH: kh.maKH,
        tenKH: kh.tenKH,
        sdt: canSeeLienHe ? (kh.sdt || '') : '',
        diaChi: canSeeLienHe ? (kh.diaChi || '') : '',
        tuyen: kh.tuyen,
        soDuVi: kh.soDuVi,
        congNo: Math.round(noAgg._sum.conLai || 0),
        doanhThu: Math.round(dtAgg._sum.tongTien || 0),
        tongDon: dons.length,
        orders: dons.map((o) => ({
          maDH: o.maDH,
          ngayTao: o.ngayTao.toISOString(),
          trangThai: o.trangThai,
          tongTien: o.tongTien,
          daTra: o.daTra,
          conLai: o.conLai
        }))
      }
    });
  },

  // Chi tiết đơn PHÍA KHÁCH (trang tra-cuu công khai). Xác thực lại bằng
  // maKH + 4 số cuối SĐT (KHÔNG dùng session) và đơn phải thuộc chính KH đó.
  // Chỉ trả thông tin khách được xem: KHÔNG có giá vốn (¥)/lợi nhuận/đơn giá NDT.
  async getOrderDetailPublic(args) {
    const maDH = String(args[0] || '').trim();
    const ma = String(args[1] || '').trim().toUpperCase();
    const sdt4 = String(args[2] || '').trim();
    if (!maDH || !ma || sdt4.length < 4) return err('Thiếu thông tin xác thực');
    // Chống dò mã đơn/SĐT — rate-limit theo mã KH (không né được bằng đổi IP).
    const rl = rateLimit(`pubdetail:${ma}`, 30, 300_000);
    if (!rl.ok) return err(`Thử quá nhiều lần. Đợi ${rl.retryAfter}s rồi thử lại.`);
    const kh = await prisma.khachHang.findUnique({ where: { maKH: ma } });
    if (!kh || (kh.sdt || '').slice(-4) !== sdt4) return err('Xác thực không hợp lệ');
    const o = await prisma.donHang.findUnique({
      where: { maDH },
      include: { chiTiet: { orderBy: { stt: 'asc' } }, payments: { orderBy: { ngay: 'asc' } } }
    });
    if (!o || o.maKH !== ma) return err('Không tìm thấy đơn của bạn');
    return ok({
      data: {
        maDH: o.maDH,
        ngayTao: o.ngayTao.toISOString(),
        trangThai: o.trangThai,
        tuyen: o.tuyen, lineVC: o.lineVC, loaiHang: o.loaiHang,
        maVD: o.maVD || '',
        chiTiet: o.chiTiet.map((c) => ({
          stt: c.stt, tenSP: c.tenSP, soLuong: c.soLuong,
          thanhTien: c.thanhTien, kg: c.kg, m3: c.m3,
          webNguon: c.webNguon, linkTaobao: c.linkTaobao
        })),
        tongKg: o.tongKg, tongM3: o.tongM3,
        tongGiaHang: o.tongGiaHang, phiMua: o.phiMua, phiVC: o.phiVC, shipND: o.shipND,
        dongGo: o.dongGo, phuThu: o.phuThu, phiBH: o.phiBH,
        phiPhatSinh: o.phiPhatSinhDuyet ? o.phiPhatSinh : 0,
        phiKhieuNai: o.phiKhieuNai,
        thueNK: o.thueNK, vat: o.vat,
        tongTien: o.tongTien, tienCoc: o.tienCoc, pctCoc: o.pctCoc,
        daTra: o.daTra, conLai: o.conLai,
        ghiChu: o.ghiChu || '',
        payments: o.payments.map((p) => ({ soTien: p.soTien, ghiChu: p.ghiChu, ngay: p.ngay.toISOString() })),
        anh: {
          khoTQ: o.anhKhoTQ || undefined, roiTQ: o.anhRoiTQ || undefined,
          khoVN: o.anhKhoVN || undefined, giaoKH: o.anhGiaoKH || undefined
        }
      }
    });
  },

  // ============== MUA HANG: NGUON HANG / NCC ==============
  async addNguonHang(args, user) {
    if (!allow(user.vaiTro, ['MuaHang', 'GDV'])) return err('Không có quyền');
    const d = args[0] || {};
    if (!d.tenSP || !String(d.tenSP).trim()) return err('Vui lòng nhập tên sản phẩm');
    const n = await prisma.nguonHang.create({
      data: {
        tenSP: String(d.tenSP).trim(),
        danhMuc: d.danhMuc || null,
        tenNCC: d.tenNCC || null,
        linkTaobao: d.linkTaobao || null,
        giaNDT: d.giaNDT === '' || d.giaNDT == null ? null : Number(d.giaNDT),
        moq: Number(d.moq) || 1,
        thoiGianGiao: d.thoiGianGiao || null,
        chatLuong: d.chatLuong === '' || d.chatLuong == null ? null : Number(d.chatLuong),
        ghiChu: d.ghiChu || null,
        nguoiThem: user.email
      }
    });
    await logActivity(user.email, 'CREATE_NGUON_HANG', String(n.id), { tenSP: d.tenSP });
    return ok({ id: n.id });
  },

  async updateNguonHang(args, user) {
    if (!allow(user.vaiTro, ['MuaHang', 'GDV'])) return err('Không có quyền');
    const [id, patch] = args;
    if (!id) return err('Thiếu id');
    const data: any = {};
    if (patch?.tenSP !== undefined) data.tenSP = String(patch.tenSP).trim();
    if (patch?.danhMuc !== undefined) data.danhMuc = patch.danhMuc || null;
    if (patch?.tenNCC !== undefined) data.tenNCC = patch.tenNCC || null;
    if (patch?.linkTaobao !== undefined) data.linkTaobao = patch.linkTaobao || null;
    if (patch?.giaNDT !== undefined) data.giaNDT = patch.giaNDT === '' || patch.giaNDT == null ? null : Number(patch.giaNDT);
    if (patch?.moq !== undefined) data.moq = Number(patch.moq) || 1;
    if (patch?.thoiGianGiao !== undefined) data.thoiGianGiao = patch.thoiGianGiao || null;
    if (patch?.chatLuong !== undefined) data.chatLuong = patch.chatLuong === '' || patch.chatLuong == null ? null : Number(patch.chatLuong);
    if (patch?.ghiChu !== undefined) data.ghiChu = patch.ghiChu || null;
    await prisma.nguonHang.update({ where: { id: Number(id) }, data });
    await logActivity(user.email, 'UPDATE_NGUON_HANG', String(id), patch);
    return ok();
  },

  async deleteNguonHang(args, user) {
    if (!allow(user.vaiTro, ['MuaHang', 'GDV'])) return err('Không có quyền');
    const [id] = args;
    if (!id) return err('Thiếu id');
    await prisma.nguonHang.delete({ where: { id: Number(id) } });
    await logActivity(user.email, 'DELETE_NGUON_HANG', String(id));
    return ok();
  },

  async addNcc(args, user) {
    if (!allow(user.vaiTro, ['MuaHang', 'GDV'])) return err('Không có quyền');
    const d = args[0] || {};
    if (!d.tenNCC || !String(d.tenNCC).trim()) return err('Vui lòng nhập tên NCC');
    const maNCC = await nextMaNCC();
    const n = await prisma.nCC.create({
      data: { maNCC, tenNCC: String(d.tenNCC).trim(), wechat: d.wechat || null, ghiChu: d.ghiChu || null }
    });
    await logActivity(user.email, 'CREATE_NCC', maNCC, { tenNCC: d.tenNCC });
    return ok({ id: n.id, maNCC });
  },

  async updateNcc(args, user) {
    if (!allow(user.vaiTro, ['MuaHang', 'GDV'])) return err('Không có quyền');
    const [id, patch] = args;
    if (!id) return err('Thiếu id');
    const data: any = {};
    if (patch?.tenNCC !== undefined) data.tenNCC = String(patch.tenNCC).trim();
    if (patch?.wechat !== undefined) data.wechat = patch.wechat || null;
    if (patch?.ghiChu !== undefined) data.ghiChu = patch.ghiChu || null;
    await prisma.nCC.update({ where: { id: Number(id) }, data });
    await logActivity(user.email, 'UPDATE_NCC', String(id), patch);
    return ok();
  },

  async deleteNcc(args, user) {
    if (!allow(user.vaiTro, ['MuaHang', 'GDV'])) return err('Không có quyền');
    const [id] = args;
    if (!id) return err('Thiếu id');
    await prisma.nCC.delete({ where: { id: Number(id) } });
    await logActivity(user.email, 'DELETE_NCC', String(id));
    return ok();
  },

  // ============== GIO MUA HO (extension) ==============
  async deleteGioMuaHo(args, user) {
    if (!allow(user.vaiTro, ['MuaHang', 'GDV', 'CSKH'])) return err('Không có quyền');
    const [id] = args;
    if (!id) return err('Thiếu id');
    // Mua hàng/CSKH chỉ xóa item của mình; Admin xóa được tất cả.
    const where: any = { id: Number(id) };
    if (user.vaiTro !== 'Admin') where.nvId = user.id;
    const r = await prisma.gioMuaHo.deleteMany({ where });
    if (r.count === 0) return err('Không tìm thấy hoặc không có quyền xóa');
    await logActivity(user.email, 'DELETE_GIO_MUA_HO', String(id));
    return ok();
  },

  async clearGioMuaHo(_args, user) {
    if (!allow(user.vaiTro, ['MuaHang', 'GDV', 'CSKH'])) return err('Không có quyền');
    const where: any = user.vaiTro === 'Admin' ? {} : { nvId: user.id };
    const r = await prisma.gioMuaHo.deleteMany({ where });
    await logActivity(user.email, 'CLEAR_GIO_MUA_HO', String(r.count));
    return ok({ count: r.count });
  },

  // ============== ĐỢT 8: BANG GIA THEO WEB ==============
  async upsertBangGiaWeb(args, user) {
    if (user.vaiTro !== 'Admin') return err('Chỉ Admin sửa bảng giá web');
    const d = args[0] || {};
    const web = String(d.web || '').trim().toLowerCase();
    if (!web) return err('Vui lòng nhập tên web (vd: 1688, taobao, tmall)');
    const data = {
      tyGia: Number(d.tyGia) || 3650,
      phiMuaPct: Number(d.phiMuaPct) || 0,
      phiMuaMin: Number(d.phiMuaMin) || 0,
      ghiChu: d.ghiChu || null,
      hoatDong: d.hoatDong === undefined ? true : !!d.hoatDong
    };
    // Tên web hạ về chữ thường rồi làm khoá → gõ "Taobao" khi đã có "taobao" là ĐÈ dòng cũ.
    // Trả về cờ capNhat để màn hình báo rõ đang cập nhật dòng cũ, không đè lặng lẽ.
    const daCo = await prisma.bangGiaWeb.findUnique({ where: { web }, select: { web: true } });
    await prisma.bangGiaWeb.upsert({ where: { web }, update: data, create: { web, ...data } });
    await logActivity(user.email, daCo ? 'UPDATE_BANG_GIA_WEB' : 'UPSERT_BANG_GIA_WEB', web, data);
    return ok({ web, capNhat: !!daCo });
  },

  async deleteBangGiaWeb(args, user) {
    if (user.vaiTro !== 'Admin') return err('Chỉ Admin');
    const [web] = args;
    if (!web) return err('Thiếu web');
    await prisma.bangGiaWeb.delete({ where: { web: String(web) } });
    await logActivity(user.email, 'DEL_BANG_GIA_WEB', String(web));
    return ok();
  },

  // ============== ĐỢT 8: CONG NO NCC / SHOP ==============
  async addCongNoNCC(args, user) {
    if (!allow(user.vaiTro, ['MuaHang', 'GDV', 'KeToan'])) return err('Không có quyền');
    const d = args[0] || {};
    const doiTac = String(d.doiTac || '').trim();
    if (!doiTac) return err('Vui lòng nhập tên shop / NCC');
    const loai = d.loai === 'ThanhToan' ? 'ThanhToan' : 'PhatSinh';
    const ndt = Number(d.soTienNDT) || 0;
    const tyGia = Number(d.tyGia) || 0;
    let soTien = Number(d.soTien) || 0;
    if (!soTien && ndt && tyGia) soTien = Math.round(ndt * tyGia);
    if (soTien <= 0) return err('Số tiền không hợp lệ');
    await prisma.congNoNCC.create({
      data: {
        doiTac, web: d.web || null, maDH: d.maDH || null, loai,
        soTien, soTienNDT: ndt, tyGia,
        ghiChu: d.ghiChu || null, nguoiTao: user.email
      }
    });
    await logActivity(user.email, loai === 'ThanhToan' ? 'NCC_THANH_TOAN' : 'NCC_PHAT_SINH', doiTac, { soTien, maDH: d.maDH });
    return ok();
  },

  async deleteCongNoNCC(args, user) {
    if (!allow(user.vaiTro, ['KeToan'])) return err('Chỉ Kế toán / Admin được xoá bút toán công nợ NCC');
    const [id] = args;
    if (!id) return err('Thiếu id');
    const row = await prisma.congNoNCC.findUnique({ where: { id: Number(id) } });
    if (!row) return err('Bút toán không tồn tại');
    // Bút toán do duyệt khiếu nại tự sinh: xoá là mất khoản NCC phải bồi thường vĩnh viễn
    // (cờ daTruNCC đã bật nên không bao giờ sinh lại).
    if (row.ghiChu?.startsWith('NCC bồi thường khiếu nại ')) {
      return err('Bút toán này sinh từ duyệt khiếu nại — không xoá được');
    }
    await prisma.congNoNCC.delete({ where: { id: row.id } });
    await logActivity(user.email, 'NCC_XOA_BUT_TOAN', String(id));
    return ok();
  },

  // ============== KE TOAN: VI / DINH KHOAN QUY ==============
  async walletTxn(args, user) {
    if (!allow(user.vaiTro, ['KeToan'])) return err('Không có quyền');
    const d = args[0] || {};
    const maKH = d.maKH;
    const amt = Number(d.soTien) || 0;
    const loai: 'Nap' | 'Tru' = d.loai === 'Tru' ? 'Tru' : 'Nap';
    if (!maKH) return err('Thiếu mã KH');
    if (amt <= 0) return err('Số tiền không hợp lệ');
    const kh = await prisma.khachHang.findUnique({ where: { maKH } });
    if (!kh) return err('KH không tồn tại');
    if (loai === 'Tru' && amt > kh.soDuVi + 0.5) return err('Số dư ví không đủ để trừ');
    const newDu = loai === 'Nap' ? kh.soDuVi + amt : kh.soDuVi - amt;
    await prisma.$transaction([
      prisma.khachHang.update({ where: { maKH }, data: { soDuVi: newDu } }),
      prisma.giaoDichVi.create({
        data: {
          maKH, loai, soTien: amt, soDuSau: newDu,
          quy: d.quy || null,
          ghiChu: d.ghiChu || (loai === 'Nap' ? 'Nạp ví' : 'Rút/trừ ví'),
          nv: user.email, nvId: user.id
        }
      })
    ]);
    await logActivity(user.email, loai === 'Nap' ? 'WALLET_NAP' : 'WALLET_TRU', maKH, { amt, quy: d.quy });
    return ok({ soDuVi: newDu });
  },

  // Z1b — Khách yêu cầu rút ví. KHÔNG trừ ví ở đây; chỉ báo Kế toán vào trừ thủ công (walletTxn).
  async yeuCauRutVi(args, user) {
    if (user.vaiTro !== 'Customer') return err('Không có quyền');
    const [maKH, soTienRaw] = args;
    const soTien = Number(soTienRaw) || 0;
    // Khách chỉ rút được ví của chính mình: đối chiếu maKH với tài khoản đăng nhập.
    const kh = await prisma.khachHang.findFirst({ where: { email: user.email } });
    if (!kh) return err('Tài khoản chưa liên kết khách hàng. Liên hệ CSKH.');
    if (kh.maKH !== maKH) return err('Không có quyền');
    if (soTien <= 0) return err('Số tiền rút không hợp lệ');
    if (soTien > kh.soDuVi + 0.5) return err('Số dư ví không đủ để rút');
    await pushNotify({
      vaiTro: ['KeToan'], loai: 'info',
      tieuDe: `Khách ${kh.tenKH} yêu cầu rút ${Math.round(soTien).toLocaleString('vi-VN')} đ`,
      noiDung: `${kh.maKH} · ${kh.tenKH} · số dư ví ${Math.round(kh.soDuVi).toLocaleString('vi-VN')}đ. Kế toán kiểm tra rồi vào Ví khách trừ ${Math.round(soTien).toLocaleString('vi-VN')}đ để xử lý rút.`,
      link: '/ketoan', nguoiTao: user.email
    });
    await logActivity(user.email, 'YEU_CAU_RUT_VI', kh.maKH, { soTien });
    return ok();
  },

  // ============== KHO: SUA KG/M3 CO LICH SU ==============
  // Góp ý NV #25 (kho tự điền cân), #33 (kích thước → m³ theo công thức admin),
  // #34 (lưu lịch sử thay đổi + tự tính lại phí vận chuyển).
  async updateChiTietKg(args, user) {
    if (!allow(user.vaiTro, ['KhoVN', 'KhoTQ'])) return err('Không có quyền');
    const [maDH, stt, patch] = args;
    if (!maDH || !stt) return err('Thiếu thông tin dòng hàng');
    const don = await prisma.donHang.findUnique({ where: { maDH } });
    if (!don) return err('Đơn không tồn tại');
    if (donDaChot(don.trangThai)) return err('Đơn đã hoàn thành / đã hủy — không sửa được cân / kích thước');
    // 3B — khóa cân: sau khi cân đã chốt, chỉ Admin được chỉnh sửa (nhân viên kho bị chặn).
    if (don.canDaChot && user.vaiTro !== 'Admin') return err('Cân đã được chốt — chỉ Quản trị được chỉnh sửa. Vui lòng liên hệ quản trị.');
    const line = await prisma.chiTietDon.findFirst({ where: { maDH, stt: Number(stt) } });
    if (!line) return err('Không tìm thấy dòng hàng');
    const data: any = {};
    const changes: any = {};
    const num = (v: any) => Number(v) || 0;

    if (patch?.kg !== undefined) { const v = num(patch.kg); if (v !== line.kg) { changes.kg = { truoc: line.kg, sau: v }; data.kg = v; } }
    // Z2 — Kho TQ ghi chú sản phẩm lúc cân (chỉ lưu khi có gửi, không ghi đè rỗng).
    if (patch?.ghiChu !== undefined) {
      const v = String(patch.ghiChu || '').trim() || null;
      if (v !== line.ghiChu) { changes.ghiChu = { truoc: line.ghiChu, sau: v }; data.ghiChu = v; }
    }
    for (const k of ['dai', 'rong', 'cao'] as const) {
      if (patch?.[k] !== undefined) { const v = num(patch[k]); if (v !== line[k]) { changes[k] = { truoc: line[k], sau: v }; data[k] = v; } }
    }

    // Có đủ 3 chiều → m³ suy ra từ kích thước; không thì lấy m³ nhập tay.
    const dai = data.dai ?? line.dai, rong = data.rong ?? line.rong, cao = data.cao ?? line.cao;
    const m3TuKichThuoc = await calcM3(dai, rong, cao);
    if (m3TuKichThuoc > 0) {
      if (m3TuKichThuoc !== line.m3) { changes.m3 = { truoc: line.m3, sau: m3TuKichThuoc }; data.m3 = m3TuKichThuoc; }
    } else if (patch?.m3 !== undefined) {
      const v = num(patch.m3); if (v !== line.m3) { changes.m3 = { truoc: line.m3, sau: v }; data.m3 = v; }
    }

    if (Object.keys(data).length === 0) return ok();
    await prisma.chiTietDon.update({ where: { id: line.id }, data });
    await recomputeDonHang(maDH);
    const o = await prisma.donHang.findUnique({ where: { maDH } });
    await recomputePhieuGiao(o?.maPhieuGiao);
    // 3B — Admin sửa cân SAU khi đã chốt: gắn cờ để nhật ký tách bạch trường hợp này.
    await logActivity(user.email, 'SUA_KG', maDH, { stt, ...changes, ...(don.canDaChot ? { suaSauChot: true } : {}) });
    return ok({ m3: data.m3 ?? line.m3 });
  },

  // ============== ADMIN: SUA DON (kể cả khi đã hoàn thành/nhập kho) ==============
  async updateOrderFields(args, user) {
    if (user.vaiTro !== 'Admin') return err('Chỉ Admin được sửa đơn');
    const [maDH, patch] = args;
    if (!maDH) return err('Thiếu mã đơn');
    const o = await prisma.donHang.findUnique({ where: { maDH } });
    if (!o) return err('Đơn không tồn tại');
    const data: any = {};
    if (patch?.tuyen !== undefined) data.tuyen = normTuyen(patch.tuyen);
    if (patch?.lineVC !== undefined) data.lineVC = patch.lineVC as LineVC;
    if (patch?.loaiHang !== undefined) data.loaiHang = patch.loaiHang;
    if (patch?.pctCoc !== undefined) data.pctCoc = Number(patch.pctCoc) || o.pctCoc;
    if (patch?.shipND !== undefined) data.shipND = Number(patch.shipND) || 0;
    if (patch?.dongGo !== undefined) data.dongGo = Number(patch.dongGo) || 0;
    if (patch?.phuThu !== undefined) data.phuThu = Number(patch.phuThu) || 0;
    // Sửa lại phí phát sinh → quay về trạng thái chờ Kế toán duyệt (góp ý NV #9).
    if (patch?.phiPhatSinh !== undefined) {
      data.phiPhatSinh = Number(patch.phiPhatSinh) || 0;
      if (data.phiPhatSinh !== o.phiPhatSinh) {
        data.phiPhatSinhDuyet = false;
        data.phiPhatSinhDuyetBy = null;
        data.phiPhatSinhDuyetAt = null;
      }
    }
    if (patch?.ngachHQ !== undefined) data.ngachHQ = patch.ngachHQ || 'Tiểu ngạch';
    if (patch?.thueNK !== undefined) data.thueNK = Number(patch.thueNK) || 0;
    if (patch?.vat !== undefined) data.vat = Number(patch.vat) || 0;
    if (patch?.phiKiemHoa !== undefined) data.phiKiemHoa = Number(patch.phiKiemHoa) || 0;
    if (patch?.phiLuuKho !== undefined) data.phiLuuKho = Number(patch.phiLuuKho) || 0;
    if (patch?.kiemDem !== undefined) data.kiemDem = !!patch.kiemDem;
    // 3B — Admin đè bật/tắt bảo hiểm cho đơn đã tạo (tri-state; null = theo khách/công ty).
    if (patch?.coBaoHiem !== undefined) {
      data.coBaoHiem = patch.coBaoHiem === true ? true : patch.coBaoHiem === false ? false : null;
    }
    if (patch?.nguoiNhan !== undefined) data.nguoiNhan = patch.nguoiNhan || null;
    if (patch?.sdtNhan !== undefined) data.sdtNhan = patch.sdtNhan || null;
    if (patch?.diaChiNhan !== undefined) data.diaChiNhan = patch.diaChiNhan || null;
    if (patch?.ghiChu !== undefined) data.ghiChu = patch.ghiChu || null;
    if (Object.keys(data).length) await prisma.donHang.update({ where: { maDH }, data });
    await recomputeDonHang(maDH);
    // So sánh giá trị đã chuẩn hoá (data) với bản ghi cũ (o) → log "trước → sau" chuẩn.
    await logActivity(user.email, 'SUA_DON', maDH, diffFields(o, data, [
      'tuyen', 'lineVC', 'loaiHang', 'pctCoc', 'shipND', 'dongGo', 'phuThu',
      'ngachHQ', 'thueNK', 'vat', 'phiKiemHoa', 'phiLuuKho', 'kiemDem', 'coBaoHiem',
      'nguoiNhan', 'sdtNhan', 'diaChiNhan', 'ghiChu'
    ]));
    return ok();
  },

  // ============== TRA CUU PUBLIC ==============
  async lookupCustomer(args) {
    const [maKH, sdtLast4] = args;
    if (!maKH || !maKH.trim()) return err('Vui lòng nhập Mã KH');
    if (!sdtLast4 || sdtLast4.length < 4) return err('Vui lòng nhập 4 số cuối SĐT');
    const ma = String(maKH).trim().toUpperCase();
    // Chặn brute-force 4 số cuối SĐT (10^4) theo TỪNG Mã KH — không phụ thuộc IP
    // nên không né được bằng cách đổi/giả IP.
    const rlMa = rateLimit(`lookup:makh:${ma}`, 8, 300_000);
    if (!rlMa.ok) return err(`Thử quá nhiều lần với mã này. Đợi ${rlMa.retryAfter}s rồi thử lại.`);
    const kh = await prisma.khachHang.findUnique({ where: { maKH: ma } });
    if (!kh) return err('Không tìm thấy Mã KH: ' + ma);
    if ((kh.sdt || '').slice(-4) !== String(sdtLast4).trim()) {
      return err('SĐT không khớp. Vui lòng liên hệ shop.');
    }
    const since = new Date();
    since.setFullYear(since.getFullYear() - 3);
    const dons = await prisma.donHang.findMany({
      where: { maKH: ma, ngayTao: { gte: since }, trangThai: { not: 'Huy' } },
      orderBy: { ngayTao: 'desc' },
      take: 50
    });
    // Công nợ thật = tổng còn lại của các đơn chưa hủy (field congNo trên KH không được ghi).
    const noAgg = await prisma.donHang.aggregate({
      where: { maKH: ma, conLai: { gt: 0 }, trangThai: { not: 'Huy' } },
      _sum: { conLai: true }
    });
    const congNo = Math.round(noAgg._sum.conLai || 0);
    return ok({
      customer: {
        maKH: kh.maKH, tenKH: kh.tenKH, sdt: kh.sdt,
        tuyen: kh.tuyen, soDuVi: kh.soDuVi, congNo, tongDon: kh.tongDon
      },
      orders: dons.map((o) => ({
        maDH: o.maDH, ngayTao: o.ngayTao.toISOString(),
        tongTien: o.tongTien, daTra: o.daTra, conLai: o.conLai,
        trangThai: o.trangThai
      }))
    });
  }
};

export async function POST(req: Request) {
  try {
    const fresh = await getSessionFresh();
    if (fresh === 'blocked') {
      return NextResponse.json(err('Tài khoản đã bị khoá. Liên hệ quản trị viên.'), { status: 403 });
    }
    const user = fresh;
    const body = await req.json();
    const action = String(body.action || '');
    const args = Array.isArray(body.args) ? body.args : [];
    const h = handlers[action];
    if (!h) return NextResponse.json(err(`Hành động không hợp lệ: ${action}`), { status: 400 });

    const PUBLIC = new Set(['lookupCustomer', 'createKhieuNai', 'createYeuCauMua', 'getOrderDetailPublic']);
    if (!user && !PUBLIC.has(action)) {
      return NextResponse.json(err('Phiên đăng nhập đã hết'), { status: 401 });
    }
    // Rate-limit hành động công khai (chống dò 4-số-cuối SĐT / spam khiếu nại, yêu cầu).
    if (!user && PUBLIC.has(action)) {
      const limits: Record<string, [number, number]> = {
        lookupCustomer: [12, 60_000],
        createKhieuNai: [6, 60_000],
        createYeuCauMua: [20, 60_000]
      };
      const [lim, win] = limits[action] || [30, 60_000];
      const rl = rateLimit(`act:${action}:${clientIp(req)}`, lim, win);
      if (!rl.ok) return NextResponse.json(err(`Thao tác quá nhanh. Thử lại sau ${rl.retryAfter}s.`), { status: 429 });
    }
    const res = await h(args, user as any);
    return NextResponse.json(res);
  } catch (e: any) {
    console.error('[/api/action]', e);
    return NextResponse.json(err(e?.message || 'Lỗi server'), { status: 500 });
  }
}
