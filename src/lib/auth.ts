import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { VaiTro } from '@prisma/client';
import { prisma } from './db';
import { getSessionSecret } from './secret';

const COOKIE = 'session';
const MAX_AGE = 60 * 60 * 24 * 7;

export type SessionUser = {
  id: number;
  email: string;
  hoTen: string;
  vaiTro: VaiTro;
};

export async function signSession(user: SessionUser) {
  return new SignJWT(user as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(getSessionSecret());
}

export async function setSessionCookie(user: SessionUser) {
  const token = await signSession(user);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, sameSite: 'lax', path: '/',
    maxAge: MAX_AGE, secure: process.env.NODE_ENV === 'production'
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSessionSecret());
    return {
      id: payload.id as number,
      email: payload.email as string,
      hoTen: payload.hoTen as string,
      vaiTro: payload.vaiTro as VaiTro
    };
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const u = await getSession();
  if (!u) redirect('/login');
  const fresh = await prisma.nhanVien.findUnique({ where: { id: u.id } });
  if (!fresh || fresh.trangThai !== 'HoatDong') {
    await clearSessionCookie();
    redirect('/login?error=blocked');
  }
  return u;
}

export async function requireRole(allowed: VaiTro[]): Promise<SessionUser> {
  const u = await requireUser();
  if (u.vaiTro === 'Admin') return u;
  if (!allowed.includes(u.vaiTro)) redirect('/dashboard?error=forbidden');
  return u;
}

export function roleHomePath(role: VaiTro): string {
  switch (role) {
    case 'Admin': return '/admin';
    case 'CSKH': return '/cskh';
    case 'GDV': return '/gdv';
    case 'KeToan': return '/ketoan';
    case 'MuaHang': return '/mua-hang';
    case 'KhoTQ': return '/khotq';
    case 'KhoVN': return '/khovn';
    case 'Customer': return '/customer';
  }
}

export function roleLabel(role: VaiTro): string {
  const map: Record<VaiTro, string> = {
    Admin: 'ADMIN', CSKH: 'CSKH', GDV: 'GDV', KeToan: 'KẾ TOÁN',
    MuaHang: 'MUA HÀNG', KhoTQ: 'KHO TQ', KhoVN: 'KHO VN', Customer: 'KHÁCH'
  };
  return map[role];
}
