import type { LineVC, Tuyen } from '@prisma/client';
import { prisma } from './db';
import { getNumber } from './settings';

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
  /** Phí phát sinh khác (CSKH nhập tay, thay cho phí bảo hiểm tự động 1% cũ). */
  phiPhatSinh?: number;
  thueNK?: number;
  vat?: number;
  phiKiemHoa?: number;
  phiLuuKho?: number;
}) {
  const giaHang = Number(input.giaHang) || 0;
  const pctMua = await getNumber('phi_mua_pct', 2);
  const phiMua = Math.round((giaHang * pctMua) / 100 / 1000) * 1000;
  // "Phí phát sinh khác" do CSKH nhập tay (kế toán duyệt). Mặc định 0 (không còn ép bảo hiểm 1%).
  const phiBH = Math.round(Number(input.phiPhatSinh) || 0);

  let phiVC = 0;
  if (input.lineVC) phiVC = await calcPhiVCByLine(input.kg, input.m3, input.lineVC, input.loaiHang || 'Thường');
  if (!phiVC) phiVC = calcPhiVCPanama(input.kg, input.m3, input.tuyen);

  const thueNK = Number(input.thueNK) || 0;
  const vat = Number(input.vat) || 0;
  const phiKiemHoa = Number(input.phiKiemHoa) || 0;
  const phiLuuKho = Number(input.phiLuuKho) || 0;

  const tongTien =
    giaHang + phiMua + phiBH + phiVC +
    (input.phiShipND || 0) + (input.phiDongGoi || 0) + (input.phiPhuThu || 0) +
    thueNK + vat + phiKiemHoa + phiLuuKho;
  const coc = Math.round((tongTien * input.pctCoc) / 100 / 1000) * 1000;
  return { giaHang, phiMua, phiBH, phiVC, thueNK, vat, phiKiemHoa, phiLuuKho, tongTien, coc };
}
