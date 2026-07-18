import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import AppShell from '@/components/AppShell';
import KhachHangClient from './KhachHangClient';
import OrderDetailModalHost from '@/components/OrderDetailModal';
import CustomerDetailModalHost from '@/components/CustomerDetailModal';

export const dynamic = 'force-dynamic';

export default async function AdminKhachHangPage() {
  const user = await requireRole(['Admin', 'CSKH', 'KeToan']);
  const customers = await prisma.khachHang.findMany({ orderBy: { maKH: 'asc' } });
  // Danh sách GDV để Admin phân công phụ trách khách (null = chưa phân).
  const gdvList = await prisma.nhanVien.findMany({
    where: { vaiTro: { in: ['GDV', 'MuaHang'] } },
    select: { id: true, hoTen: true },
    orderBy: { hoTen: 'asc' }
  });
  // Công nợ thật theo từng KH = tổng còn lại của đơn chưa hủy (field congNo không được ghi).
  const noRows = await prisma.donHang.groupBy({
    by: ['maKH'],
    where: { conLai: { gt: 0 }, trangThai: { not: 'Huy' } },
    _sum: { conLai: true }
  });
  const noMap = new Map(noRows.map((r) => [r.maKH, Math.round(r._sum.conLai || 0)]));
  const canEdit = user.vaiTro === 'Admin' || user.vaiTro === 'CSKH';
  // Góp ý NV #21: Kế toán không cần nhìn SĐT / email khách. Lớp /api/action đã ẩn
  // (canSeeLienHe), nhưng trang này query Prisma thẳng nên phải tự chặn ở đây.
  const canSeeLienHe = user.vaiTro !== 'KeToan';

  return (
    <AppShell user={user} subtitle={`${customers.length} khách hàng`}>
      <KhachHangClient
        canEdit={canEdit}
        canSeeLienHe={canSeeLienHe}
        gdvList={gdvList.map((g) => ({ id: g.id, hoTen: g.hoTen }))}
        list={customers.map((c) => ({
          maKH: c.maKH, tenKH: c.tenKH,
          sdt: canSeeLienHe ? (c.sdt || '') : '',
          email: canSeeLienHe ? (c.email || '') : '',
          tuyen: c.tuyen, pctCoc: c.pctCoc, soDuVi: c.soDuVi, congNo: noMap.get(c.maKH) || 0,
          tongDon: c.tongDon, doanhThu: c.doanhThu,
          phiMuaPctRieng: c.phiMuaPctRieng ?? null,
          phiBhPctRieng: c.phiBhPctRieng ?? null,
          gdvPhuTrachId: c.gdvPhuTrachId ?? null
        }))}
      />
      {/* Customer host TRƯỚC, Order host SAU: bấm đơn trong modal KH thì modal đơn nổi lên trên. */}
      <CustomerDetailModalHost canSeeMoney />
      <OrderDetailModalHost
        canSeeMoney={['Admin', 'CSKH', 'KeToan'].includes(user.vaiTro)}
        canSeeProfit={['Admin', 'KeToan', 'GDV', 'MuaHang'].includes(user.vaiTro)}
      />
    </AppShell>
  );
}
