import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import AppShell from '@/components/AppShell';
import KhachHangClient from './KhachHangClient';

export const dynamic = 'force-dynamic';

export default async function AdminKhachHangPage() {
  const user = await requireRole(['Admin', 'CSKH', 'KeToan']);
  const customers = await prisma.khachHang.findMany({ orderBy: { maKH: 'asc' } });
  // Công nợ thật theo từng KH = tổng còn lại của đơn chưa hủy (field congNo không được ghi).
  const noRows = await prisma.donHang.groupBy({
    by: ['maKH'],
    where: { conLai: { gt: 0 }, trangThai: { not: 'Huy' } },
    _sum: { conLai: true }
  });
  const noMap = new Map(noRows.map((r) => [r.maKH, Math.round(r._sum.conLai || 0)]));
  const canEdit = user.vaiTro === 'Admin' || user.vaiTro === 'CSKH';

  return (
    <AppShell user={user} subtitle={`${customers.length} khách hàng`}>
      <KhachHangClient
        canEdit={canEdit}
        list={customers.map((c) => ({
          maKH: c.maKH, tenKH: c.tenKH, sdt: c.sdt || '', email: c.email || '',
          tuyen: c.tuyen, pctCoc: c.pctCoc, soDuVi: c.soDuVi, congNo: noMap.get(c.maKH) || 0,
          tongDon: c.tongDon, doanhThu: c.doanhThu
        }))}
      />
    </AppShell>
  );
}
