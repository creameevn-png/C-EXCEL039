import { prisma } from './db';
import type { VaiTro } from '@prisma/client';

type NotifyInput = {
  /** Vai trò nhận thông báo (null/'' = mọi người). Có thể truyền 1 hoặc nhiều. */
  vaiTro?: VaiTro | VaiTro[] | null;
  loai?: 'info' | 'success' | 'warning' | 'danger';
  tieuDe: string;
  noiDung?: string;
  link?: string;
  maDH?: string;
  nguoiTao?: string | null;
};

/**
 * Đẩy 1 thông báo nội bộ (Đợt 10). Không bao giờ throw — lỗi notify không được
 * làm hỏng nghiệp vụ chính, nên mọi lỗi đều nuốt + log.
 */
export async function pushNotify(input: NotifyInput): Promise<void> {
  try {
    const roles = Array.isArray(input.vaiTro)
      ? input.vaiTro
      : input.vaiTro
        ? [input.vaiTro]
        : [null];
    await prisma.thongBao.createMany({
      data: roles.map((r) => ({
        vaiTro: r,
        loai: input.loai || 'info',
        tieuDe: input.tieuDe,
        noiDung: input.noiDung || null,
        link: input.link || null,
        maDH: input.maDH || null,
        nguoiTao: input.nguoiTao || null
      }))
    });
  } catch (e) {
    console.error('[notify]', e);
  }
}
