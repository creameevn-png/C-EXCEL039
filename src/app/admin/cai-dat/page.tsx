import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import AppShell from '@/components/AppShell';
import CaiDatClient from './CaiDatClient';

export const dynamic = 'force-dynamic';

export default async function AdminCaiDatPage() {
  const user = await requireRole(['Admin']);
  const rows = await prisma.caiDat.findMany({ orderBy: { ten: 'asc' } });
  // Cảnh báo cho cài đặt "GDV chỉ thấy đơn của mình": khách chưa phân công GDV và
  // đơn "mồ côi" (không GDV nào nhìn thấy khi bật) = đơn không có GDV và khách cũng chưa phân.
  const soKhachChuaPhan = await prisma.khachHang.count({ where: { gdvPhuTrachId: null } });
  const soDonMoCoi = await prisma.donHang.count({
    where: { gdvId: null, khachHang: { is: { gdvPhuTrachId: null } }, trangThai: { in: ['DatCoc', 'DaMuaHang'] } }
  });
  return (
    <AppShell user={user}>
      <CaiDatClient
        rows={rows.map((r) => ({ ten: r.ten, giaTri: r.giaTri || '', ghiChu: r.ghiChu || '' }))}
        soKhachChuaPhan={soKhachChuaPhan}
        soDonMoCoi={soDonMoCoi}
      />
    </AppShell>
  );
}
