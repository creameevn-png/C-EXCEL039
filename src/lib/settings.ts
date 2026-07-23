import { prisma } from './db';

const DEFAULTS: Record<string, string> = {
  ty_gia_ndt_vnd: '3650',
  phi_mua_pct: '2',
  phi_bh_pct: '1',
  bh_mac_dinh: '1',
  hoa_hong_pct: '8',
  // Đợt 5 — phí dịch vụ khách chốt 21/07: đóng gỗ (70k kg đầu + 3.5k/kg tiếp),
  // kiểm đếm (500đ/sản phẩm × số lượng), lưu kho (1.000đ × kg × ngày, miễn phí 7 ngày đầu).
  phi_dong_go_kg_dau: '70000',
  phi_dong_go_kg_tiep: '3500',
  phi_kiem_dem_sp: '500',
  // Chỉ thu phí kiểm đếm cho đơn TẠO từ ngày này trở đi (đơn cũ dùng kiểm đếm miễn phí → giữ nguyên tiền).
  phi_kiem_dem_tu_ngay: '2026-07-21',
  phi_luu_kho_ngay: '1000',
  luu_kho_free_ngay: '7',
  ten_cong_ty: 'Quản Lý Ship Trung Việt',
  zalo_lien_he: '',
  gdv_chi_thay_don_minh: '0'
};

let cache: Record<string, string> | null = null;
let cacheAt = 0;
const TTL = 30_000;

export async function getAllSettings(): Promise<Record<string, string>> {
  if (cache && Date.now() - cacheAt < TTL) return cache;
  const rows = await prisma.caiDat.findMany();
  const out: Record<string, string> = { ...DEFAULTS };
  for (const r of rows) out[r.ten] = r.giaTri ?? '';
  cache = out;
  cacheAt = Date.now();
  return out;
}

export async function getSetting(key: string): Promise<string> {
  const all = await getAllSettings();
  return all[key] ?? DEFAULTS[key] ?? '';
}

export async function getNumber(key: string, fallback = 0): Promise<number> {
  const v = parseFloat(await getSetting(key));
  return isNaN(v) ? fallback : v;
}

/** Cài đặt bật/tắt (lưu dạng '1'/'0'). Trả fallback khi key chưa có giá trị nào
 *  (getSetting trả '' — không có trong DB lẫn DEFAULTS); '1' → true, còn lại → false. */
export async function getBool(key: string, fb: boolean): Promise<boolean> {
  const v = await getSetting(key);
  return v === '' ? fb : v === '1';
}

export async function setSetting(key: string, value: string, note?: string): Promise<void> {
  await prisma.caiDat.upsert({
    where: { ten: key },
    update: { giaTri: value, ghiChu: note },
    create: { ten: key, giaTri: value, ghiChu: note ?? null }
  });
  cache = null;
}

export function invalidateSettingsCache() { cache = null; }
