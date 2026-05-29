import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import AppShell from '@/components/AppShell';
import KhachHangClient from './KhachHangClient';

export const dynamic = 'force-dynamic';

export default async function AdminKhachHangPage() {
  const user = await requireRole(['Admin', 'CSKH', 'KeToan']);
  const customers = await prisma.khachHang.findMany({ orderBy: { maKH: 'asc' } });
  const canEdit = user.vaiTro === 'Admin' || user.vaiTro === 'CSKH';

  return (
    <AppShell user={user} subtitle={`${customers.length} khách hàng`}>
      <KhachHangClient
        canEdit={canEdit}
        list={customers.map((c) => ({
          maKH: c.maKH, tenKH: c.tenKH, sdt: c.sdt || '', email: c.email || '',
          tuyen: c.tuyen, pctCoc: c.pctCoc, soDuVi: c.soDuVi, congNo: c.congNo,
          tongDon: c.tongDon, doanhThu: c.doanhThu
        }))}
      />
    </AppShell>
  );
}
