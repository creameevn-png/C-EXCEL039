import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import AppShell from '@/components/AppShell';
import CaiDatClient from './CaiDatClient';

export const dynamic = 'force-dynamic';

export default async function AdminCaiDatPage() {
  const user = await requireRole(['Admin']);
  const rows = await prisma.caiDat.findMany({ orderBy: { ten: 'asc' } });
  return (
    <AppShell user={user}>
      <CaiDatClient rows={rows.map((r) => ({ ten: r.ten, giaTri: r.giaTri || '', ghiChu: r.ghiChu || '' }))} />
    </AppShell>
  );
}
