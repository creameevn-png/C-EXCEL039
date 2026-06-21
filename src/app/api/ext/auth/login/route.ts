import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { signExtToken, extRoleAllowed } from '@/lib/extauth';
import { corsJson, corsPreflight } from '@/lib/cors';
import { logActivity } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function OPTIONS() { return corsPreflight(); }

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const username = String(body.username || body.email || '').toLowerCase().trim();
    const password = String(body.password || '');
    if (!username || !password) {
      return corsJson({ message: 'Thiếu tài khoản hoặc mật khẩu' }, { status: 400 });
    }
    const user = await prisma.nhanVien.findUnique({ where: { email: username } });
    if (!user || user.trangThai !== 'HoatDong') {
      return corsJson({ message: 'Sai tài khoản hoặc mật khẩu' }, { status: 401 });
    }
    const okPw = await bcrypt.compare(password, user.passwordHash);
    if (!okPw) {
      return corsJson({ message: 'Sai tài khoản hoặc mật khẩu' }, { status: 401 });
    }
    if (!extRoleAllowed(user.vaiTro)) {
      return corsJson({ message: 'Tài khoản không có quyền dùng extension mua hộ' }, { status: 403 });
    }
    const sUser = { id: user.id, email: user.email, hoTen: user.hoTen, vaiTro: user.vaiTro };
    const token = await signExtToken(sUser);
    await logActivity(user.email, 'EXT_LOGIN', user.email);
    return corsJson({ token, user: sUser });
  } catch (e: any) {
    return corsJson({ message: e?.message || 'Lỗi server' }, { status: 500 });
  }
}
