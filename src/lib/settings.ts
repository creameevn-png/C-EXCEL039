import { prisma } from './db';

const DEFAULTS: Record<string, string> = {
  ty_gia_ndt_vnd: '3650',
  phi_mua_pct: '2',
  phi_bh_pct: '1',
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

export async function setSetting(key: string, value: string, note?: string): Promise<void> {
  await prisma.caiDat.upsert({
    where: { ten: key },
    update: { giaTri: value, ghiChu: note },
    create: { ten: key, giaTri: value, ghiChu: note ?? null }
  });
  cache = null;
}

export function invalidateSettingsCache() { cache = null; }
