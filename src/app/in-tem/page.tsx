import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import InTemClient from './InTemClient';

export const dynamic = 'force-dynamic';

export default async function InTemPage({ searchParams }: { searchParams: Promise<{ ma?: string }> }) {
  await requireRole(['KhoTQ', 'KhoVN', 'CSKH']);
  const sp = await searchParams;
  const ma = sp.ma;
  let don = null;
  if (ma) {
    don = await prisma.donHang.findUnique({
      where: { maDH: ma },
      include: { khachHang: true, chiTiet: { orderBy: { stt: 'asc' } } }
    });
  }
  return <InTemClient initialMa={ma || ''} initialDon={don ? {
    maDH: don.maDH,
    maVD: don.maVD || '',
    maGD: don.maGD || '',
    tenKH: don.khachHang?.tenKH || '',
    sdt: don.khachHang?.sdt || '',
    diaChi: don.khachHang?.diaChi || '',
    tuyen: don.tuyen,
    tongKg: don.tongKg,
    tongM3: don.tongM3,
    items: don.chiTiet.map((c) => `${c.tenSP} (x${c.soLuong})`)
  } : null} />;
}
