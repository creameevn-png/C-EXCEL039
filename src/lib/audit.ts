import { prisma } from './db';

export async function logActivity(
  email: string | null,
  hanhDong: string,
  doiTuong: string | null,
  chiTiet?: Record<string, any> | null
): Promise<void> {
  try {
    await prisma.hoatDong.create({
      data: {
        email,
        hanhDong,
        doiTuong,
        chiTiet: chiTiet ? JSON.stringify(chiTiet) : null
      }
    });
  } catch {
    // never throw from audit
  }
}

// So sánh bản ghi cũ (before) với các trường thay đổi (patch) trên danh sách field.
// Chỉ trả về field thực sự đổi, dạng { truoc, sau } — dùng cho trang xem log dựng "trước → sau".
export function diffFields(
  before: Record<string, any>,
  patch: Record<string, any>,
  fields: string[]
): Record<string, { truoc: any; sau: any }> {
  const out: Record<string, { truoc: any; sau: any }> = {};
  for (const k of fields) {
    if (patch[k] === undefined) continue;
    if (before[k] !== patch[k]) out[k] = { truoc: before[k] ?? null, sau: patch[k] ?? null };
  }
  return out;
}
