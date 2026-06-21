import { prisma } from '@/lib/db';
import { getExtUser } from '@/lib/extauth';
import { corsJson, corsPreflight } from '@/lib/cors';

export const dynamic = 'force-dynamic';

function jsonArr(s: string | null): any[] {
  if (!s) return [];
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; }
}

export async function OPTIONS() { return corsPreflight(); }

export async function GET(req: Request) {
  const user = await getExtUser(req);
  if (!user) return corsJson({ message: 'Chưa đăng nhập' }, { status: 401 });
  const rows = await prisma.gioMuaHo.findMany({
    where: { nvId: user.id, daXuLy: false },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  const items = rows.map((r) => ({
    id: r.id,
    source: r.source,
    productId: r.productId,
    productUrl: r.productUrl,
    title: r.title,
    image: r.image,
    images: jsonArr(r.images),
    priceText: r.priceText,
    priceValue: r.priceValue,
    currency: r.currency,
    quantity: r.quantity,
    minQuantity: r.minQuantity,
    sku: jsonArr(r.sku),
    skuText: r.skuText,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
  }));
  return corsJson({ items });
}
