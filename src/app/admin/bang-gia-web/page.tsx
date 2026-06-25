import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import AppShell from '@/components/AppShell';
import BangGiaWebClient from './BangGiaWebClient';

export const dynamic = 'force-dynamic';

export default async function AdminBangGiaWebPage() {
  const user = await requireRole(['Admin']);
  const rows = await prisma.bangGiaWeb.findMany({ orderBy: { web: 'asc' } });

  return (
    <AppShell user={user}>
      <BangGiaWebClient rows={rows.map((r) => ({
        web: r.web, tyGia: r.tyGia, phiMuaPct: r.phiMuaPct, phiMuaMin: r.phiMuaMin,
        ghiChu: r.ghiChu || '', hoatDong: r.hoatDong, updatedAt: r.updatedAt.toISOString()
      }))} />
    </AppShell>
  );
}
