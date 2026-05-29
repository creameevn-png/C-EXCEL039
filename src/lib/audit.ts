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
