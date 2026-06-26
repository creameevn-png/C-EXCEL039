import { prisma } from '@/lib/db';
import { corsJson, corsPreflight } from '@/lib/cors';
import { nextMaYC } from '@/lib/codes';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import type { Tuyen } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function OPTIONS() { return corsPreflight(); }

function normTuyen(v: any): Tuyen {
  return String(v).toUpperCase() === 'HCM' ? 'HCM' : 'HaNoi';
}

// Gói thông tin phụ của sản phẩm vào ghi chú để NV bên Cừ thấy đủ.
function packGhiChu(p: any): string {
  const bits: string[] = [];
  if (p.danhMuc) bits.push('DM: ' + p.danhMuc);
  if (p.priceText) bits.push('Giá: ' + p.priceText + ' ' + (p.currency || 'CNY'));
  if (p.skuText) bits.push('Phân loại: ' + p.skuText);
  if (p.note) bits.push('KH ghi: ' + p.note);
  if (p.ghiChuRiengTu) bits.push('Riêng tư: ' + p.ghiChuRiengTu);
  return bits.join(' · ');
}

// POST /api/ext/yeu-cau — khách bấm "tôi muốn SP này" trên 1688/Taobao/Tmall →
// đẩy thành YÊU CẦU ĐẶT HÀNG về hệ thống. Gộp các SP cùng phiên của 1 khách
// (cùng SĐT, còn "Chờ xử lý") vào 1 yêu cầu; chưa có thì tạo mới.
export async function POST(req: Request) {
  const rl = rateLimit(`yc:post:${clientIp(req)}`, 20, 60_000);
  if (!rl.ok) return corsJson({ message: `Thao tác quá nhanh. Thử lại sau ${rl.retryAfter}s.` }, { status: 429 });
  const b = await req.json().catch(() => ({} as any));
  const hoTen = String(b.hoTen || '').trim();
  const sdt = String(b.sdt || '').trim();
  const product = b.product || {};

  if (!hoTen || !sdt) return corsJson({ message: 'Thiếu họ tên hoặc số điện thoại khách' }, { status: 400 });
  if (!product.url && !product.title) return corsJson({ message: 'Thiếu thông tin sản phẩm' }, { status: 400 });

  // Nếu khách khai Mã KH → xác minh khớp SĐT (4 số cuối) cho chắc.
  let maKH: string | null = null;
  if (b.maKH && String(b.maKH).trim()) {
    const ma = String(b.maKH).trim().toUpperCase();
    const kh = await prisma.khachHang.findUnique({ where: { maKH: ma } });
    if (kh && (kh.sdt || '').slice(-4) === sdt.slice(-4)) maKH = ma;
    else return corsJson({ message: 'Mã KH không khớp số điện thoại. Bỏ trống nếu là khách mới.' }, { status: 400 });
  }

  const item = {
    link: String(product.url || '').trim(),
    ten: String(product.titleVi || product.title || '').trim(),
    soLuong: Number(product.quantity) || 1,
    ghiChu: packGhiChu(product)
  };

  // Tìm yêu cầu đang mở của khách (theo SĐT) để gộp; không có thì tạo mới.
  // Bọc đọc→ghi trong 1 transaction để 2 lần bấm nhanh không ghi đè mất nhau.
  const emailIn = b.email ? String(b.email).trim() : null;
  const tuyenIn = normTuyen(b.tuyen);
  const result = await prisma.$transaction(async (tx) => {
    const open = await tx.yeuCauMua.findFirst({
      where: { sdt, trangThai: 'ChoXuLy' },
      orderBy: { ngayTao: 'desc' }
    });
    if (open) {
      let arr: any[] = [];
      try { arr = JSON.parse(open.sanPham || '[]'); } catch { arr = []; }
      arr.push(item);
      await tx.yeuCauMua.update({
        where: { id: open.id },
        data: { sanPham: JSON.stringify(arr), hoTen, email: emailIn || open.email, maKH: maKH || open.maKH }
      });
      return { maYC: open.maYC, count: arr.length, merged: true };
    }
    const maYC = await nextMaYC();
    await tx.yeuCauMua.create({
      data: {
        maYC, hoTen, sdt,
        email: emailIn,
        maKH,
        tuyen: tuyenIn,
        sanPham: JSON.stringify([item]),
        ghiChu: 'Gửi từ Extension Mua hộ',
        trangThai: 'ChoXuLy'
      }
    });
    return { maYC, count: 1, merged: false };
  });
  return corsJson({ success: true, ...result });
}

// GET /api/ext/yeu-cau?sdt=... — "Yêu cầu của tôi": liệt kê yêu cầu gần đây của khách.
export async function GET(req: Request) {
  const rl = rateLimit(`yc:get:${clientIp(req)}`, 30, 60_000);
  if (!rl.ok) return corsJson({ items: [], message: `Thao tác quá nhanh. Thử lại sau ${rl.retryAfter}s.` }, { status: 429 });
  const sdt = new URL(req.url).searchParams.get('sdt')?.trim() || '';
  if (!sdt) return corsJson({ items: [] });
  const rows = await prisma.yeuCauMua.findMany({
    where: { sdt },
    orderBy: { ngayTao: 'desc' },
    take: 20
  });
  const items = rows.map((y) => {
    let n = 0;
    try { n = JSON.parse(y.sanPham || '[]').length; } catch { n = 0; }
    return { maYC: y.maYC, ngayTao: y.ngayTao.toISOString(), trangThai: y.trangThai, soSP: n };
  });
  return corsJson({ items });
}
