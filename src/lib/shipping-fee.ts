import type { LineVC, Tuyen } from '@prisma/client';
import { prisma } from './db';
import { getNumber, getBool } from './settings';

const PRICE_KG: Array<[number, number, number, number]> = [
  [0, 100, 4000, 6500],
  [100, 500, 3500, 6000],
  [500, 1000, 3000, 5500],
  [1000, 3000, 2500, 5000],
  [3000, 999999, 2000, 4500]
];
const PRICE_M3: Array<[number, number, number, number]> = [
  [0, 1, 1000000, 1300000],
  [1, 5, 900000, 1200000],
  [5, 10, 850000, 1150000],
  [10, 15, 800000, 1100000],
  [15, 9999, 700000, 1000000]
];

export function calcPhiVCPanama(kg: number, m3: number, tuyen: Tuyen | string): number {
  const colIdx = tuyen === 'HCM' ? 3 : 2;
  let phiKg = 0;
  for (const r of PRICE_KG) {
    if ((kg > r[0] && kg <= r[1]) || (r[0] === 0 && kg <= r[1])) { phiKg = kg * r[colIdx]; break; }
  }
  let phiM3 = 0;
  for (const r of PRICE_M3) {
    if ((m3 > r[0] && m3 <= r[1]) || (r[0] === 0 && m3 <= r[1])) { phiM3 = m3 * r[colIdx]; break; }
  }
  return Math.round(Math.max(phiKg, phiM3) / 1000) * 1000;
}

export const calcPhiVC = calcPhiVCPanama;

export async function calcPhiVCByLine(
  kg: number, m3: number, line: LineVC, loaiHang: string
): Promise<number> {
  const bg = await prisma.bangGia.findUnique({
    where: { uq_bang_gia_line_loai: { line, loaiHang } }
  });
  if (!bg || !bg.hoatDong) return 0;
  let phiKg = 0;
  if (kg < 5) phiKg = kg * bg.giaKgDuoi5;
  else if (kg <= 20) phiKg = kg * bg.giaKg5To20;
  else phiKg = kg * bg.giaKgTren20;
  const phiM3 = m3 * bg.giaM3;
  const base = Math.max(phiKg, phiM3);
  const phu = (base * bg.phiPhuPct) / 100;
  return Math.round(base + phu);
}

/**
 * Phí mua theo TỪNG SÀN (per-web): mỗi dòng hàng tính
 *   max(giáHàngDòng × phiMuaPct% của sàn, phiMuaMin của sàn);
 * sàn không cấu hình trong BangGiaWeb → fallback % chung (phi_mua_pct, mặc định 2%),
 * min = 0. Tổng làm tròn tới 1.000đ (giữ nguyên hành vi cũ khi chưa cấu hình sàn nào).
 */
export async function calcPhiMua(lines: { webNguon?: string | null; thanhTien: number }[]): Promise<number> {
  const pctGlobal = await getNumber('phi_mua_pct', 2);
  const webs = await prisma.bangGiaWeb.findMany({ where: { hoatDong: true } });
  const normKey = (s: any) => String(s || '').toLowerCase().replace(/\s+/g, '').replace(/\.com.*$/, '');
  const cfgByKey = new Map<string, { pct: number; min: number }>();
  for (const w of webs) cfgByKey.set(normKey(w.web), { pct: w.phiMuaPct, min: w.phiMuaMin });

  // Gom giá hàng theo từng sàn → phí mua tối thiểu áp 1 lần / sàn / đơn (không nhân số dòng).
  const sumByKey = new Map<string, number>();
  for (const ln of lines) {
    const key = normKey(ln.webNguon);
    sumByKey.set(key, (sumByKey.get(key) || 0) + (Number(ln.thanhTien) || 0));
  }
  let total = 0;
  for (const [key, sum] of sumByKey) {
    const cfg = cfgByKey.get(key);
    // Có cấu hình VÀ pct>0 → dùng % + min của sàn; còn lại (chưa cấu hình, hoặc dòng
    // BangGiaWeb chỉ để đặt tỉ giá nên pct=0) → dùng % chung, min 0 (giữ hành vi cũ).
    const usePerWeb = !!cfg && cfg.pct > 0;
    const pct = usePerWeb ? cfg!.pct : pctGlobal;
    const min = usePerWeb ? cfg!.min : 0;
    total += Math.max((sum * pct) / 100, min);
  }
  return Math.round(total / 1000) * 1000;
}

export async function computeOrderTotals(input: {
  giaHang: number;
  kg: number;
  m3: number;
  tuyen: Tuyen | string;
  phiShipND: number;
  phiDongGoi: number;
  phiPhuThu: number;
  pctCoc: number;
  lineVC?: LineVC;
  loaiHang?: string;
  /** Phí phát sinh khác (CSKH nhập tay) — TÁCH RIÊNG khỏi bảo hiểm.
   *  Người gọi chỉ truyền vào khi Kế toán ĐÃ duyệt (góp ý NV #9). */
  phiPhatSinh?: number;
  /** Phí đổi trả khách phải chịu, chuyển từ khiếu nại sang (góp ý NV #47). */
  phiKhieuNai?: number;
  /** Phí mua tính sẵn theo từng sàn (calcPhiMua). Có thì dùng, không thì tính theo % chung. */
  phiMuaOverride?: number;
  /** Z6 — % phí mua RIÊNG của khách (KhachHang.phiMuaPctRieng). null/undefined → dùng % chung
   *  (phi_mua_pct). Chỉ áp khi KHÔNG có phiMuaOverride (override theo sàn ưu tiên cao nhất). */
  phiMuaPctKH?: number;
  /** Z6 — % phí bảo hiểm RIÊNG của khách (KhachHang.phiBhPctRieng). null/undefined → % chung (phi_bh_pct). */
  phiBhPctKH?: number;
  /** Đợt 3B — bật/tắt bảo hiểm ở cấp ĐƠN (DonHang.coBaoHiem). null/undefined = không đè
   *  cấp đơn → xuống khách rồi công ty. true = bật · false = tắt (phiBH = 0). */
  coBaoHiem?: boolean | null;
  /** Đợt 3B — bật/tắt bảo hiểm ở cấp KHÁCH (KhachHang.baoHiemRieng). null/undefined = không
   *  đặt riêng cho khách → xuống mặc định công ty (bh_mac_dinh). Chỉ xét khi đơn không đè. */
  baoHiemKH?: boolean | null;
  thueNK?: number;
  vat?: number;
  phiKiemHoa?: number;
  phiLuuKho?: number;
}) {
  const giaHang = Number(input.giaHang) || 0;
  // Z6 — % phí mua: ưu tiên override theo sàn > % riêng của khách > % chung hệ thống.
  // % riêng chỉ đổi CON SỐ %, vẫn tính THUẦN từ giaHang nên idempotent như cũ.
  const pctMua = input.phiMuaPctKH != null ? input.phiMuaPctKH : await getNumber('phi_mua_pct', 2);
  const phiMua = input.phiMuaOverride != null
    ? Math.round(input.phiMuaOverride)
    : Math.round((giaHang * pctMua) / 100 / 1000) * 1000;
  // Bảo hiểm: % theo cài đặt (mặc định 1% giá hàng) — tính THUẦN từ giá hàng nên
  // idempotent qua mọi lần recompute (không cộng dồn). Z6: khách có % riêng thì dùng % riêng.
  // Đợt 3B — bật/tắt bảo hiểm theo ưu tiên: ĐƠN (coBaoHiem) > KHÁCH (baoHiemKH) > CÔNG TY
  // (bh_mac_dinh). Dùng ?? nên chỉ khi cấp trên = null mới xuống cấp dưới. Khi mọi toggle
  // null + bh_mac_dinh '1' + phi_bh_pct 1 ⇒ bhOn=true, pctBH=1 ⇒ phiBH giữ nguyên như cũ.
  const bhCompanyOn = await getBool('bh_mac_dinh', true);
  const bhOn = input.coBaoHiem ?? input.baoHiemKH ?? bhCompanyOn;
  const pctBH = bhOn ? (input.phiBhPctKH != null ? input.phiBhPctKH : await getNumber('phi_bh_pct', 1)) : 0;
  const phiBH = Math.round((giaHang * pctBH) / 100 / 1000) * 1000;
  // Phí phát sinh khác do CSKH nhập tay (lưu ở cột riêng phi_phat_sinh).
  const phiPhatSinh = Math.round(Number(input.phiPhatSinh) || 0);
  // Phí đổi trả do khách chịu, đẩy sang từ khiếu nại đã duyệt.
  const phiKhieuNai = Math.round(Number(input.phiKhieuNai) || 0);

  let phiVC = 0;
  if (input.lineVC) phiVC = await calcPhiVCByLine(input.kg, input.m3, input.lineVC, input.loaiHang || 'Thường');
  if (!phiVC) phiVC = calcPhiVCPanama(input.kg, input.m3, input.tuyen);

  const thueNK = Number(input.thueNK) || 0;
  const vat = Number(input.vat) || 0;
  const phiKiemHoa = Number(input.phiKiemHoa) || 0;
  const phiLuuKho = Number(input.phiLuuKho) || 0;

  const tongTien =
    giaHang + phiMua + phiBH + phiPhatSinh + phiKhieuNai + phiVC +
    (input.phiShipND || 0) + (input.phiDongGoi || 0) + (input.phiPhuThu || 0) +
    thueNK + vat + phiKiemHoa + phiLuuKho;
  // Cọc tính trên tiền hàng + phí ban đầu, KHÔNG tính phí đổi trả phát sinh sau khi
  // khách đã đặt cọc — nếu không, mỗi lần duyệt khiếu nại tiền cọc lại nhảy.
  const coc = Math.round(((tongTien - phiKhieuNai) * input.pctCoc) / 100 / 1000) * 1000;
  return { giaHang, phiMua, phiBH, phiPhatSinh, phiKhieuNai, phiVC, thueNK, vat, phiKiemHoa, phiLuuKho, tongTien, coc };
}

/** Góp ý NV #33 — m³ suy ra từ kích thước thực đo (cm), hệ số quy đổi do admin cài đặt. */
export async function calcM3(dai: number, rong: number, cao: number): Promise<number> {
  const d = Number(dai) || 0, r = Number(rong) || 0, c = Number(cao) || 0;
  if (d <= 0 || r <= 0 || c <= 0) return 0;
  const chia = await getNumber('m3_chia', 1_000_000);
  if (!chia) return 0;
  return Math.round((d * r * c / chia) * 10000) / 10000;
}
