import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { setSessionCookie, roleHomePath } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ success: false, message: 'Thiếu email hoặc mật khẩu' }, { status: 400 });
    }
    const user = await prisma.nhanVien.findUnique({ where: { email: String(email).toLowerCase().trim() } });
    if (!user) {
      return NextResponse.json({ success: false, message: 'Sai email hoặc mật khẩu' }, { status: 401 });
    }
    const ok = await bcrypt.compare(String(password), user.passwordHash);
    if (!ok) {
      return NextResponse.json({ success: false, message: 'Sai email hoặc mật khẩu' }, { status: 401 });
    }
    await setSessionCookie({ id: user.id, email: user.email, hoTen: user.hoTen, vaiTro: user.vaiTro });
    return NextResponse.json({ success: true, redirect: roleHomePath(user.vaiTro) });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Lỗi server' }, { status: 500 });
  }
}
