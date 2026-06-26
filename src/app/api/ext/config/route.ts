import { prisma } from '@/lib/db';
import { corsJson, corsPreflight } from '@/lib/cors';
import { getNumber } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function OPTIONS() { return corsPreflight(); }

// GET /api/ext/config — CÔNG KHAI cho extension phía khách. Khách không đăng nhập nên
// không thể có token nhân viên; endpoint chỉ lộ tỉ giá + danh mục (cùng mức nhạy cảm
// như /api/ext/yeu-cau). tyGia = mặc định; byWeb = tỉ giá riêng từng sàn.
export async function GET() {
  const tyGia = await getNumber('ty_gia_ndt_vnd', 3650);
  const webs = await prisma.bangGiaWeb.findMany({
    where: { hoatDong: true },
    select: { web: true, tyGia: true }
  });
  const byWeb: Record<string, number> = {};
  for (const w of webs) {
    // Chuẩn hoá key về 1688 / taobao / tmall để khớp source của extension dù admin
    // gõ "Taobao", "1688.com"...
    const key = w.web.toLowerCase().replace(/\s+/g, '').replace(/\.com.*$/, '');
    if (w.tyGia > 0) byWeb[key] = w.tyGia;
  }

  return corsJson({
    tyGia,
    byWeb,
    // Danh mục gợi ý cho extension (phân loại hàng hoá).
    danhMucs: ['Thời trang', 'Mỹ phẩm', 'Điện tử - Phụ kiện', 'Gia dụng', 'Đồ chơi', 'Văn phòng phẩm', 'Phụ kiện', 'Khác']
  });
}
