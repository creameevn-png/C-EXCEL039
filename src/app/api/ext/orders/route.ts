import { prisma } from '@/lib/db';
import { getExtUser } from '@/lib/extauth';
import { corsJson, corsPreflight } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() { return corsPreflight(); }

// Danh sách đơn gần đây để xem/quản lý ngay trong extension ("Đơn đã đặt").
export async function GET(req: Request) {
  const user = await getExtUser(req);
  if (!user) return corsJson({ message: 'Chưa đăng nhập' }, { status: 401 });

  const rows = await prisma.donHang.findMany({
    where: { trangThai: { not: 'Huy' } },
    include: { khachHang: true },
    orderBy: { ngayTao: 'desc' },
    take: 30,
  });

  const items = rows.map((o) => ({
    maDH: o.maDH,
    ngayTao: o.ngayTao.toISOString(),
    maKH: o.maKH,
    tenKH: o.khachHang?.tenKH || '',
    trangThai: o.trangThai,
    tongTien: o.tongTien,
    daTra: o.daTra,
    conLai: o.conLai,
    maGD: o.maGD,
    maVD: o.maVD,
  }));

  return corsJson({ items });
}
