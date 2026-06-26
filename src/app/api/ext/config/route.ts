import { prisma } from '@/lib/db';
import { getExtUser } from '@/lib/extauth';
import { corsJson, corsPreflight } from '@/lib/cors';
import { getNumber } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function OPTIONS() { return corsPreflight(); }

// GET /api/ext/config — tỉ giá hệ thống để extension hiển thị giá VNĐ trực tiếp
// (giống "tỉ giá do công ty cung cấp"). tyGia = mặc định; byWeb = riêng từng sàn.
export async function GET(req: Request) {
  const user = await getExtUser(req);
  if (!user) return corsJson({ message: 'Chưa đăng nhập' }, { status: 401 });

  const tyGia = await getNumber('ty_gia_ndt_vnd', 3650);
  const webs = await prisma.bangGiaWeb.findMany({
    where: { hoatDong: true },
    select: { web: true, tyGia: true }
  });
  const byWeb: Record<string, number> = {};
  for (const w of webs) if (w.tyGia > 0) byWeb[w.web.toLowerCase()] = w.tyGia;

  return corsJson({
    tyGia,
    byWeb,
    // Danh mục gợi ý cho extension (phân loại hàng hoá).
    danhMucs: ['Thời trang', 'Mỹ phẩm', 'Điện tử - Phụ kiện', 'Gia dụng', 'Đồ chơi', 'Văn phòng phẩm', 'Phụ kiện', 'Khác']
  });
}
