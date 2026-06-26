import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getNumber } from '@/lib/settings';
import AppShell from '@/components/AppShell';
import GioMuaHoClient from './GioMuaHoClient';

export const dynamic = 'force-dynamic';

export default async function GioMuaHoPage() {
  const user = await requireRole(['MuaHang', 'CSKH']);

  const where: any = user.vaiTro === 'Admin' ? { daXuLy: false } : { nvId: user.id, daXuLy: false };

  const [rows, tyGia] = await Promise.all([
    prisma.gioMuaHo.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 300,
      include: { nhanVien: true },
    }),
    getNumber('ty_gia_ndt_vnd', 3650),
  ]);

  const items = rows.map((r) => ({
    id: r.id,
    source: r.source || '',
    productId: r.productId || '',
    productUrl: r.productUrl || '',
    title: r.title,
    titleVi: r.titleVi || '',
    image: r.image || '',
    priceText: r.priceText || '',
    priceValue: r.priceValue,
    currency: r.currency || 'CNY',
    quantity: r.quantity,
    minQuantity: r.minQuantity,
    skuText: r.skuText || '',
    note: r.note || '',
    nguoiThem: r.nhanVien?.hoTen || '',
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <AppShell user={user} title={`Giỏ mua hộ (${items.length})`}>
      <GioMuaHoClient items={items} tyGia={tyGia} isAdmin={user.vaiTro === 'Admin'} />
    </AppShell>
  );
}
