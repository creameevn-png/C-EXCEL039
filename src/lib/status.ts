import type { TrangThaiDon, TrangThaiKN, LineVC, VaiTro, Tuyen } from '@prisma/client';

export const TRANG_THAI_LABEL: Record<TrangThaiDon, string> = {
  DonMoiTao: 'Đơn mới tạo',
  DatCoc: 'Đặt cọc',
  DaMuaHang: 'Đã mua hàng',
  NccGiaoHang: 'NCC giao hàng',
  KhoTqNhan: 'Kho TQ nhận',
  DangVanChuyen: 'Đang vận chuyển',
  KhoVnNhan: 'Kho VN nhận',
  ChoThanhToan: 'Chờ thanh toán',
  GiaoHang: 'Giao hàng',
  HoanThanh: 'Hoàn thành',
  Huy: 'Hủy',
  KHTuDat: 'KH tự đặt'
};

export const TRANG_THAI_CLASS: Record<TrangThaiDon, string> = {
  DonMoiTao: 's-new',
  DatCoc: 's-deposit',
  DaMuaHang: 's-bought',
  NccGiaoHang: 's-tq',
  KhoTqNhan: 's-tq',
  DangVanChuyen: 's-shipping',
  KhoVnNhan: 's-vn',
  ChoThanhToan: 's-waiting',
  GiaoHang: 's-vn',
  HoanThanh: 's-done',
  Huy: 's-cancel',
  KHTuDat: 's-new'
};

export const KN_LABEL: Record<TrangThaiKN, string> = {
  ChoXuLy: 'Chờ xử lý',
  DangXuLy: 'Đang xử lý',
  DangDuyetCap1: 'Chờ duyệt cấp 1 (Manager)',
  DangDuyetCap2: 'Chờ duyệt cấp 2 (Admin)',
  DuyetDoiTra: 'Duyệt: Đổi/trả hàng',
  DuyetHoanTien: 'Duyệt: Hoàn tiền',
  DuyetGiamGia: 'Duyệt: Giảm giá đơn sau',
  TuChoi: 'Từ chối',
  DaXuLy: 'Đã xử lý'
};

export const KN_CLASS: Record<TrangThaiKN, string> = {
  ChoXuLy: 's-deposit',
  DangXuLy: 's-bought',
  DangDuyetCap1: 's-tq',
  DangDuyetCap2: 's-shipping',
  DuyetDoiTra: 's-vn',
  DuyetHoanTien: 's-vn',
  DuyetGiamGia: 's-paid',
  TuChoi: 's-cancel',
  DaXuLy: 's-done'
};

export const LINE_LABEL: Record<LineVC, string> = {
  LineNhanh: 'Line Nhanh (3-5 ngày)',
  LineThuong: 'Line Thường (7-10 ngày)',
  LineRe: 'Line Tiết kiệm (15-20 ngày)'
};

export const VAITRO_LABEL: Record<VaiTro, string> = {
  Admin: 'Admin',
  CSKH: 'CSKH',
  GDV: 'GDV',
  KeToan: 'Kế toán',
  MuaHang: 'Mua hàng',
  KhoTQ: 'Kho TQ',
  KhoVN: 'Kho VN',
  Customer: 'Khách hàng'
};

export const TUYEN_LABEL: Record<Tuyen, string> = {
  HaNoi: 'Hà Nội',
  HCM: 'HCM'
};

export function statusToClass(s: TrangThaiDon | string | null | undefined): string {
  if (!s) return 's-new';
  if (s in TRANG_THAI_CLASS) return TRANG_THAI_CLASS[s as TrangThaiDon];
  return 's-new';
}

export function statusToLabel(
  s: TrangThaiDon | string | null | undefined,
  date?: Date | string | null
): string {
  let base = '';
  if (!s) base = '';
  else if (s in TRANG_THAI_LABEL) base = TRANG_THAI_LABEL[s as TrangThaiDon];
  else base = String(s);

  if (date) {
    const d = date instanceof Date ? date : new Date(date);
    if (!isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      return `${base} (${dd}.${mm})`;
    }
  }
  return base;
}
