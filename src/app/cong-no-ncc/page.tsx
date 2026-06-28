import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import AppShell from '@/components/AppShell';
import CongNoNccClient from './CongNoNccClient';
import OrderDetailModalHost from '@/components/OrderDetailModal';

export const dynamic = 'force-dynamic';

export default async function CongNoNccPage() {
  const user = await requireRole(['MuaHang', 'KeToan']);

  const [ledger, nccs, webs] = await Promise.all([
    prisma.congNoNCC.findMany({ orderBy: { ngay: 'desc' }, take: 500 }),
    prisma.nCC.findMany({ orderBy: { tenNCC: 'asc' }, take: 300 }),
    prisma.bangGiaWeb.findMany({ where: { hoatDong: true }, select: { web: true } })
  ]);

  return (
    <AppShell user={user}>
      <CongNoNccClient
        ledger={ledger.map((e) => ({
          id: e.id, ngay: e.ngay.toISOString(), doiTac: e.doiTac, web: e.web || '',
          maDH: e.maDH || '', loai: e.loai, soTien: e.soTien, soTienNDT: e.soTienNDT,
          tyGia: e.tyGia, ghiChu: e.ghiChu || '', nguoiTao: e.nguoiTao || ''
        }))}
        partners={nccs.map((n) => n.tenNCC)}
        webs={webs.map((w) => w.web)}
      />
      <OrderDetailModalHost canSeeMoney={['Admin', 'CSKH', 'KeToan'].includes(user.vaiTro)} canSeeProfit={['Admin', 'KeToan', 'GDV'].includes(user.vaiTro)} />
    </AppShell>
  );
}
