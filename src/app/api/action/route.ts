import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { computeOrderTotals } from '@/lib/shipping-fee';
import { nextMaDH, nextMaKH, nextMaSP, nextMaKN, nextMaYC, nextMaNCC } from '@/lib/codes';
import { logActivity } from '@/lib/audit';
import { getNumber } from '@/lib/settings';
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
  return (v === 'HCM' || v === 'HCM' || String(v).toUpperCase() === 'HCM') ? 'HCM' : 'HaNoi';
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

  const totals = await computeOrderTotals({
    giaHang: tongGiaHang,
    kg: tongKg, m3: tongM3,
    tuyen: o.tuyen,
    phiShipND: o.shipND, phiDongGoi: o.dongGo, phiPhuThu: o.phuThu,
    phiPhatSinh: o.phiBH,
    thueNK: o.thueNK, vat: o.vat, phiKiemHoa: o.phiKiemHoa, phiLuuKho: o.phiLuuKho,
    pctCoc: o.pctCoc,
    lineVC: o.lineVC, loaiHang: o.loaiHang
  });

  await prisma.donHang.update({
    where: { maDH },
    data: {
      tongGiaHang, tongKg, tongM3,
      phiMua: totals.phiMua, phiBH: totals.phiBH, phiVC: totals.phiVC,
      tongTien: totals.tongTien,
      tienCoc: totals.coc,
      conLai: totals.tongTien - o.daTra
    }
  });
}

const handlers: Record<string, (args: any[], user: NonNullable<Awaited<ReturnType<typeof getSession>>>) => Promise<Resp>> = {
  // ============== CSKH ==============
  async createOrder(args, user) {
    if (!allow(user.vaiTro, ['CSKH'])) return err('Không có quyền');
    const d = args[0] || {};
    if (!d.maKH) return err('Vui lòng chọn khách hàng');
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

    const kh = await prisma.khachHang.findUnique({ where: { maKH: d.maKH } });
    if (!kh) return err('KH không tồn tại');

    const maDH = await nextMaDH();
    const tuyen = normTuyen(d.tuyen ?? kh.tuyen);

    await prisma.donHang.create({
      data: {
        maDH,
        maKH: kh.maKH,
        nvTao: user.email,
        nvId: user.id,
        tuyen,
        lineVC: (d.lineVC as LineVC) || 'LineThuong',
        loaiHang: d.loaiHang || 'Thường',
        pctCoc: Number(d.pctCoc) || kh.pctCoc || 70,
        shipND: Number(d.phiShipND) || 0,
        dongGo: Number(d.phiDongGoi) || 0,
        phuThu: Number(d.phiPhuThu) || 0,
        phiBH: Number(d.phiPhatSinh) || 0,
        ngachHQ: d.ngachHQ || 'Tiểu ngạch',
        thueNK: Number(d.thueNK) || 0,
        vat: Number(d.vat) || 0,
        phiKiemHoa: Number(d.phiKiemHoa) || 0,
        phiLuuKho: Number(d.phiLuuKho) || 0,
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
    await logActivity(user.email, 'CREATE_ORDER', maDH, { maKH: kh.maKH, items: items.length });
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
    if (!allow(user.vaiTro, ['CSKH', 'MuaHang'])) return err('Không có quyền');
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
    if (!allow(user.vaiTro, ['CSKH', 'KeToan'])) return err('Không có quyền');
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
    await logActivity(user.email, 'CONFIRM_DEPOSIT', maDH, { tienCoc: coc });
    return ok({ tienCoc: coc });
  },

  // ============== GDV ==============
  async updateMaGD(args, user) {
    if (!allow(user.vaiTro, ['GDV'])) return err('Không có quyền');
    const [maDH, maGD] = args;
    if (!maGD) return err('Thiếu mã GD');
    const o = await prisma.donHang.findUnique({ where: { maDH } });
    if (!o) return err('Đơn không tồn tại');
    if (o.trangThai !== 'DatCoc') return err('Đơn không ở trạng thái Đặt cọc');
    await prisma.donHang.update({ where: { maDH }, data: { maGD, trangThai: 'DaMuaHang' } });
    await logActivity(user.email, 'UPDATE_MA_GD', maDH, { maGD });
    return ok();
  },

  async updateMaVD(args, user) {
    if (!allow(user.vaiTro, ['GDV'])) return err('Không có quyền');
    const [maDH, maVD] = args;
    if (!maVD) return err('Thiếu mã VĐ');
    const o = await prisma.donHang.findUnique({ where: { maDH } });
    if (!o) return err('Đơn không tồn tại');
    if (o.trangThai !== 'DaMuaHang') return err('Đơn không ở trạng thái Đã mua');
    await prisma.donHang.update({ where: { maDH }, data: { maVD, trangThai: 'NccGiaoHang' } });
    await logActivity(user.email, 'UPDATE_MA_VD', maDH, { maVD });
    return ok();
  },

  // GDV nhập giá vốn thực mua (tệ) + ship nội địa TQ → tự tính lợi nhuận GDV.
  async updateVonGDV(args, user) {
    if (!allow(user.vaiTro, ['GDV', 'KeToan'])) return err('Không có quyền');
    const [maDH, patch] = args;
    if (!maDH) return err('Thiếu mã đơn');
    const o = await prisma.donHang.findUnique({ where: { maDH }, include: { chiTiet: true } });
    if (!o) return err('Đơn không tồn tại');
    const vonNDT = Math.max(0, Number(patch?.vonNDT) || 0);
    const shipNDTQ = Math.max(0, Number(patch?.shipNDTQ) || 0);
    // Tệ khách trả trên đơn = Σ(đơn giá NDT × số lượng) của các dòng hàng.
    const tongThuNDT = o.chiTiet.reduce((s, c) => s + c.donGiaNDT * c.soLuong, 0);
    const loiNhuanNDT = tongThuNDT - (vonNDT + shipNDTQ);
    await prisma.donHang.update({ where: { maDH }, data: { vonNDT, shipNDTQ, loiNhuanNDT } });
    await logActivity(user.email, 'UPDATE_VON_GDV', maDH, { vonNDT, shipNDTQ, loiNhuanNDT });
    return ok({ vonNDT, shipNDTQ, tongThuNDT, loiNhuanNDT });
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
    await logActivity(user.email, 'CONFIRM_PAYMENT', maDH, { amount, newCon, newStatus });
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
    await logActivity(user.email, 'KHO_TQ_NHAN', maDH);
    return ok();
  },

  // Kho TQ kiểm đếm theo từng link sản phẩm: "Đủ" / "Thiếu" + ghi chú.
  async markKiemKe(args, user) {
    if (!allow(user.vaiTro, ['KhoTQ', 'KhoVN'])) return err('Không có quyền');
    const [maDH, stt, patch] = args;
    if (!maDH || !stt) return err('Thiếu thông tin dòng hàng');
    const line = await prisma.chiTietDon.findFirst({ where: { maDH, stt: Number(stt) } });
    if (!line) return err('Không tìm thấy dòng hàng');
    await prisma.chiTietDon.update({
      where: { id: line.id },
      data: {
        kiemKe: patch?.trangThai === 'Đủ' || patch?.trangThai === 'Thiếu' ? patch.trangThai : null,
        kiemKeNote: patch?.note ?? line.kiemKeNote,
      }
    });
    await logActivity(user.email, 'KIEM_KE', maDH, { stt, trangThai: patch?.trangThai });
    return ok();
  },

  // ===== Hàng vô chủ (kho TQ) =====
  async addHangVoChu(args, user) {
    if (!allow(user.vaiTro, ['KhoTQ', 'KhoVN'])) return err('Không có quyền');
    const d = args[0] || {};
    if (!d.maVD || !String(d.maVD).trim()) return err('Vui lòng nhập mã vận đơn');
    const dai = Number(d.dai) || 0, rong = Number(d.rong) || 0, cao = Number(d.cao) || 0;
    // m3 = dài×rộng×cao (cm) / 1.000.000; nếu nhập m3 trực tiếp thì ưu tiên giá trị đó.
    const m3 = Number(d.m3) || (dai && rong && cao ? Math.round((dai * rong * cao) / 1000000 * 10000) / 10000 : 0);
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
    await logActivity(user.email, 'ROI_TQ', maDH);
    return ok();
  },

  // ============== KHO VN ==============
  async confirmKhoVN(args, user) {
    if (!allow(user.vaiTro, ['KhoVN'])) return err('Không có quyền');
    const [maDH, imageBase64] = args;
    const o = await prisma.donHang.findUnique({ where: { maDH } });
    if (!o) return err('Đơn không tồn tại');
    if (o.trangThai !== 'DangVanChuyen') return err('Đơn không đang vận chuyển');
    const newStatus: TrangThaiDon = o.conLai <= 0.5 ? 'GiaoHang' : 'ChoThanhToan';
    await prisma.donHang.update({
      where: { maDH },
      data: { trangThai: newStatus === 'GiaoHang' ? 'KhoVnNhan' : 'ChoThanhToan', anhKhoVN: imageBase64 || null }
    });
    await logActivity(user.email, 'KHO_VN_NHAN', maDH, { newStatus });
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
    await prisma.khachHang.update({
      where: { maKH: o.maKH },
      data: { tongDon: { increment: 1 }, doanhThu: { increment: o.tongTien } }
    });
    await logActivity(user.email, 'DELIVERED', maDH);
    return ok();
  },

  // ============== KHIEU NAI ==============
  async createKhieuNai(args, user) {
    const d = args[0] || {};
    if (!d.moTa) return err('Vui lòng nhập mô tả');
    if (!d.loai) return err('Vui lòng chọn loại khiếu nại');
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
    return ok({ maKN });
  },

  async updateKhieuNai(args, user) {
    if (!allow(user.vaiTro, ['CSKH', 'KeToan', 'GDV'])) return err('Không có quyền');
    const [maKN, patch] = args;
    if (!maKN) return err('Thiếu mã KN');
    const data: any = {};
    if (patch?.trangThai) data.trangThai = patch.trangThai as TrangThaiKN;
    if (patch?.phuongAn !== undefined) data.phuongAn = patch.phuongAn;
    if (patch?.soTienHoan !== undefined) data.soTienHoan = Number(patch.soTienHoan) || 0;
    if (patch?.ghiChuXuLy !== undefined) data.ghiChuXuLy = patch.ghiChuXuLy;
    await prisma.khieuNai.update({ where: { maKN }, data });
    await logActivity(user.email, 'UPDATE_KHIEU_NAI', maKN, patch);
    return ok();
  },

  async duyetKhieuNaiCap1(args, user) {
    if (!allow(user.vaiTro, ['KeToan', 'CSKH'])) return err('Không có quyền');
    const [maKN, note] = args;
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
    await prisma.khieuNai.update({
      where: { maKN },
      data: {
        duyetCap2By: user.email,
        duyetCap2At: new Date(),
        duyetCap2Note: note || '',
        trangThai: accepted ? 'DaXuLy' : 'TuChoi'
      }
    });
    await logActivity(user.email, 'DUYET_KN_CAP2', maKN, { accepted });
    return ok();
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
    await logActivity(user.email, 'UPDATE_USER', String(id), patch);
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
    await prisma.khachHang.update({ where: { maKH }, data });
    await logActivity(user.email, 'UPDATE_CUSTOMER', maKH, patch);
    return ok();
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
    const canSeeMoney = ['Admin', 'CSKH', 'KeToan', 'Customer'].includes(user?.vaiTro || 'Customer');
    // Giá vốn & lợi nhuận: CHỈ Admin / Kế toán / GDV được xem (CSKH không thấy).
    const canSeeProfit = ['Admin', 'KeToan', 'GDV'].includes(user?.vaiTro || '');
    const tongThuNDT = o.chiTiet.reduce((s, c) => s + c.donGiaNDT * c.soLuong, 0);
    return ok({
      data: {
        maDH: o.maDH,
        ngayTao: o.ngayTao.toISOString(),
        maKH: o.maKH,
        tenKH: o.khachHang?.tenKH || '',
        sdt: o.khachHang?.sdt || '',
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
          kg: c.kg, m3: c.m3,
          webNguon: c.webNguon, linkTaobao: c.linkTaobao, ghiChu: c.ghiChu
        })),
        tongGiaHang: canSeeMoney ? o.tongGiaHang : 0,
        phiMua: canSeeMoney ? o.phiMua : 0,
        phiBH: canSeeMoney ? o.phiBH : 0,
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
        nguoiNhan: o.nguoiNhan || '',
        sdtNhan: o.sdtNhan || '',
        diaChiNhan: o.diaChiNhan || '',
        tongTien: canSeeMoney ? o.tongTien : 0,
        tienCoc: canSeeMoney ? o.tienCoc : 0,
        daTra: canSeeMoney ? o.daTra : 0,
        conLai: canSeeMoney ? o.conLai : 0,
        ghiChu: o.ghiChu || '',
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

  // ============== MUA HANG: NGUON HANG / NCC ==============
  async addNguonHang(args, user) {
    if (!allow(user.vaiTro, ['MuaHang'])) return err('Không có quyền');
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
    if (!allow(user.vaiTro, ['MuaHang'])) return err('Không có quyền');
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
    if (!allow(user.vaiTro, ['MuaHang'])) return err('Không có quyền');
    const [id] = args;
    if (!id) return err('Thiếu id');
    await prisma.nguonHang.delete({ where: { id: Number(id) } });
    await logActivity(user.email, 'DELETE_NGUON_HANG', String(id));
    return ok();
  },

  async addNcc(args, user) {
    if (!allow(user.vaiTro, ['MuaHang'])) return err('Không có quyền');
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
    if (!allow(user.vaiTro, ['MuaHang'])) return err('Không có quyền');
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
    if (!allow(user.vaiTro, ['MuaHang'])) return err('Không có quyền');
    const [id] = args;
    if (!id) return err('Thiếu id');
    await prisma.nCC.delete({ where: { id: Number(id) } });
    await logActivity(user.email, 'DELETE_NCC', String(id));
    return ok();
  },

  // ============== GIO MUA HO (extension) ==============
  async deleteGioMuaHo(args, user) {
    if (!allow(user.vaiTro, ['MuaHang', 'CSKH'])) return err('Không có quyền');
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
    if (!allow(user.vaiTro, ['MuaHang', 'CSKH'])) return err('Không có quyền');
    const where: any = user.vaiTro === 'Admin' ? {} : { nvId: user.id };
    const r = await prisma.gioMuaHo.deleteMany({ where });
    await logActivity(user.email, 'CLEAR_GIO_MUA_HO', String(r.count));
    return ok({ count: r.count });
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

  // ============== KHO: SUA KG/M3 CO LICH SU ==============
  async updateChiTietKg(args, user) {
    if (!allow(user.vaiTro, ['KhoVN', 'KhoTQ'])) return err('Không có quyền');
    const [maDH, stt, patch] = args;
    if (!maDH || !stt) return err('Thiếu thông tin dòng hàng');
    const line = await prisma.chiTietDon.findFirst({ where: { maDH, stt: Number(stt) } });
    if (!line) return err('Không tìm thấy dòng hàng');
    const data: any = {};
    const changes: any = {};
    if (patch?.kg !== undefined) { const v = Number(patch.kg) || 0; if (v !== line.kg) { changes.kg = `${line.kg}→${v}`; data.kg = v; } }
    if (patch?.m3 !== undefined) { const v = Number(patch.m3) || 0; if (v !== line.m3) { changes.m3 = `${line.m3}→${v}`; data.m3 = v; } }
    if (Object.keys(data).length === 0) return ok();
    await prisma.chiTietDon.update({ where: { id: line.id }, data });
    await recomputeDonHang(maDH);
    await logActivity(user.email, 'SUA_KG', maDH, { stt, ...changes });
    return ok();
  },

  // ============== ADMIN: SUA DON (kể cả khi đã hoàn thành/nhập kho) ==============
  async updateOrderFields(args, user) {
    if (user.vaiTro !== 'Admin') return err('Chỉ Admin được sửa đơn');
    const [maDH, patch] = args;
    if (!maDH) return err('Thiếu mã đơn');
    const o = await prisma.donHang.findUnique({ where: { maDH } });
    if (!o) return err('Đơn không tồn tại');
    const data: any = {};
    const changes: any = {};
    if (patch?.tuyen !== undefined) { data.tuyen = normTuyen(patch.tuyen); changes.tuyen = `${o.tuyen}→${data.tuyen}`; }
    if (patch?.lineVC !== undefined) { data.lineVC = patch.lineVC as LineVC; changes.lineVC = `${o.lineVC}→${patch.lineVC}`; }
    if (patch?.loaiHang !== undefined) { data.loaiHang = patch.loaiHang; changes.loaiHang = patch.loaiHang; }
    if (patch?.pctCoc !== undefined) { data.pctCoc = Number(patch.pctCoc) || o.pctCoc; changes.pctCoc = data.pctCoc; }
    if (patch?.shipND !== undefined) { data.shipND = Number(patch.shipND) || 0; changes.shipND = data.shipND; }
    if (patch?.dongGo !== undefined) { data.dongGo = Number(patch.dongGo) || 0; changes.dongGo = data.dongGo; }
    if (patch?.phuThu !== undefined) { data.phuThu = Number(patch.phuThu) || 0; changes.phuThu = data.phuThu; }
    if (patch?.phiPhatSinh !== undefined) { data.phiBH = Number(patch.phiPhatSinh) || 0; changes.phiPhatSinh = data.phiBH; }
    if (patch?.ngachHQ !== undefined) { data.ngachHQ = patch.ngachHQ || 'Tiểu ngạch'; changes.ngachHQ = data.ngachHQ; }
    if (patch?.thueNK !== undefined) { data.thueNK = Number(patch.thueNK) || 0; changes.thueNK = data.thueNK; }
    if (patch?.vat !== undefined) { data.vat = Number(patch.vat) || 0; changes.vat = data.vat; }
    if (patch?.phiKiemHoa !== undefined) { data.phiKiemHoa = Number(patch.phiKiemHoa) || 0; changes.phiKiemHoa = data.phiKiemHoa; }
    if (patch?.phiLuuKho !== undefined) { data.phiLuuKho = Number(patch.phiLuuKho) || 0; changes.phiLuuKho = data.phiLuuKho; }
    if (patch?.kiemDem !== undefined) { data.kiemDem = !!patch.kiemDem; changes.kiemDem = data.kiemDem; }
    if (patch?.nguoiNhan !== undefined) { data.nguoiNhan = patch.nguoiNhan || null; changes.nguoiNhan = 'updated'; }
    if (patch?.sdtNhan !== undefined) { data.sdtNhan = patch.sdtNhan || null; changes.sdtNhan = 'updated'; }
    if (patch?.diaChiNhan !== undefined) { data.diaChiNhan = patch.diaChiNhan || null; changes.diaChiNhan = 'updated'; }
    if (patch?.ghiChu !== undefined) { data.ghiChu = patch.ghiChu || null; changes.ghiChu = 'updated'; }
    if (Object.keys(data).length) await prisma.donHang.update({ where: { maDH }, data });
    await recomputeDonHang(maDH);
    await logActivity(user.email, 'SUA_DON', maDH, changes);
    return ok();
  },

  // ============== TRA CUU PUBLIC ==============
  async lookupCustomer(args) {
    const [maKH, sdtLast4] = args;
    if (!maKH || !maKH.trim()) return err('Vui lòng nhập Mã KH');
    if (!sdtLast4 || sdtLast4.length < 4) return err('Vui lòng nhập 4 số cuối SĐT');
    const ma = String(maKH).trim().toUpperCase();
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
    return ok({
      customer: {
        maKH: kh.maKH, tenKH: kh.tenKH, sdt: kh.sdt,
        tuyen: kh.tuyen, soDuVi: kh.soDuVi, congNo: kh.congNo, tongDon: kh.tongDon
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
    const user = await getSession();
    const body = await req.json();
    const action = String(body.action || '');
    const args = Array.isArray(body.args) ? body.args : [];
    const h = handlers[action];
    if (!h) return NextResponse.json(err(`Hành động không hợp lệ: ${action}`), { status: 400 });

    const PUBLIC = new Set(['lookupCustomer', 'createKhieuNai', 'createYeuCauMua']);
    if (!user && !PUBLIC.has(action)) {
      return NextResponse.json(err('Phiên đăng nhập đã hết'), { status: 401 });
    }
    const res = await h(args, user as any);
    return NextResponse.json(res);
  } catch (e: any) {
    console.error('[/api/action]', e);
    return NextResponse.json(err(e?.message || 'Lỗi server'), { status: 500 });
  }
}
