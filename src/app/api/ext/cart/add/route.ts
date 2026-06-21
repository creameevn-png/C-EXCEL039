import { prisma } from '@/lib/db';
import { getExtUser } from '@/lib/extauth';
import { corsJson, corsPreflight } from '@/lib/cors';
import { logActivity } from '@/lib/audit';

export const dynamic = 'force-dynamic';

function asJson(v: any): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  try { return JSON.stringify(v); } catch { return null; }
}

function parseDate(v: any): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export async function OPTIONS() { return corsPreflight(); }

export async function POST(req: Request) {
  const user = await getExtUser(req);
  if (!user) return corsJson({ message: 'Phiên đăng nhập hết hạn. Đăng nhập lại.' }, { status: 401 });

  const b = await req.json().catch(() => ({} as any));
  const title = String(b.title || '').trim() || '(không tên)';

  try {
    const row = await prisma.gioMuaHo.create({
      data: {
        nvId: user.id,
        source: String(b.source || ''),
        productId: b.productId != null ? String(b.productId) : null,
        productUrl: b.productUrl != null ? String(b.productUrl) : null,
        title,
        image: b.image != null ? String(b.image) : null,
        images: asJson(b.images),
        priceText: b.priceText != null ? String(b.priceText) : null,
        priceValue: b.priceValue != null && b.priceValue !== '' ? Number(b.priceValue) : null,
        currency: b.currency != null ? String(b.currency) : 'CNY',
        quantity: Number(b.quantity) || 1,
        minQuantity: Number(b.minQuantity) || 1,
        sku: asJson(b.sku),
        skuText: b.skuText != null ? String(b.skuText) : null,
        note: b.note != null ? String(b.note) : null,
        fromListing: !!b.fromListing,
        raw: asJson(b.raw),
        capturedAt: parseDate(b.capturedAt),
      },
    });
    await logActivity(user.email, 'EXT_ADD_CART', String(row.id), { source: b.source, title });
    return corsJson({ success: true, cartItemId: row.id, message: 'Đã thêm vào giỏ mua hộ.' });
  } catch (e: any) {
    return corsJson({ success: false, message: e?.message || 'Thêm thất bại' }, { status: 500 });
  }
}
