import { SignJWT, jwtVerify } from 'jose';
import type { VaiTro } from '@prisma/client';
import { prisma } from './db';
import type { SessionUser } from './auth';
import { getSessionSecret } from './secret';

/**
 * Auth cho Chrome Extension "Mua hộ".
 * Khác với web (cookie HttpOnly): extension cần token trả về trong body để gắn
 * vào header `Authorization: Bearer <token>`. Dùng chung SESSION_SECRET + jose.
 */

const MAX_AGE = 60 * 60 * 24 * 30; // 30 ngày

/** Vai trò được phép dùng extension mua hộ. (Admin luôn được.) */
export const EXT_ALLOWED_ROLES: VaiTro[] = ['MuaHang', 'CSKH'];

export function extRoleAllowed(role: VaiTro): boolean {
  return role === 'Admin' || EXT_ALLOWED_ROLES.includes(role);
}

export async function signExtToken(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user, scope: 'ext' } as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(getSessionSecret());
}

/** Đọc Bearer token từ request, verify, trả SessionUser hoặc null. */
export async function getExtUser(req: Request): Promise<SessionUser | null> {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  try {
    const { payload } = await jwtVerify(m[1], getSessionSecret());
    if (payload.scope !== 'ext') return null;
    const id = payload.id as number;
    // Xác nhận tài khoản còn hoạt động + đúng quyền.
    const fresh = await prisma.nhanVien.findUnique({ where: { id } });
    if (!fresh || fresh.trangThai !== 'HoatDong' || !extRoleAllowed(fresh.vaiTro)) return null;
    return { id: fresh.id, email: fresh.email, hoTen: fresh.hoTen, vaiTro: fresh.vaiTro };
  } catch {
    return null;
  }
}
