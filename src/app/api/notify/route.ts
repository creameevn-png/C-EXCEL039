import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/notify — trả thông báo gần đây cho vai trò của người đăng nhập
// (kèm thông báo chung vaiTro=null). Bell ở topbar poll endpoint này.
export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ success: false, items: [] }, { status: 401 });

  const items = await prisma.thongBao.findMany({
    where: { OR: [{ vaiTro: user.vaiTro }, { vaiTro: null }] },
    orderBy: { ngay: 'desc' },
    take: 40
  });

  return NextResponse.json({
    success: true,
    items: items.map((t) => ({
      id: t.id, ngay: t.ngay.toISOString(), loai: t.loai,
      tieuDe: t.tieuDe, noiDung: t.noiDung || '', link: t.link || '', maDH: t.maDH || ''
    }))
  });
}
