import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import AppShell from '@/components/AppShell';
import KnClient from './KnClient';
import OrderDetailModalHost from '@/components/OrderDetailModal';

export const dynamic = 'force-dynamic';

export default async function AdminKhieuNaiPage() {
  const user = await requireRole(['Admin', 'CSKH', 'KeToan']);
  const list = await prisma.khieuNai.findMany({ orderBy: { ngayTao: 'desc' }, take: 200 });

  return (
    <AppShell user={user} subtitle="Duyệt 2 tầng · quyết định phương án">
      <KnClient userVaiTro={user.vaiTro} list={list.map((k) => ({
        maKN: k.maKN, ngayTao: k.ngayTao.toISOString(),
        maDH: k.maDH || '', maKH: k.maKH || '', nguoiTao: k.nguoiTao || '',
        loai: k.loai, moTa: k.moTa,
        anh: k.anhBangChung || '', trangThai: k.trangThai,
        phuongAn: k.phuongAn || '', soTienHoan: k.soTienHoan,
        phiDoiTra: k.phiDoiTra, hoanVi: k.hoanVi, daHoanVi: k.daHoanVi,
        quyChiuPhi: k.quyChiuPhi || '',
        doiTacNCC: k.doiTacNCC || '', daTruNCC: k.daTruNCC,
        ghiChuXuLy: k.ghiChuXuLy || '',
        maVDTraHang: k.maVDTraHang || '', chuyenKhoVN: k.chuyenKhoVN,
        daNhanHangKN: k.daNhanHangKN,
        ngayNhanKN: k.ngayNhanKN ? k.ngayNhanKN.toISOString() : '',
        nguoiNhanKN: k.nguoiNhanKN || ''
      }))} />
      <OrderDetailModalHost canSeeMoney={['Admin', 'CSKH', 'KeToan'].includes(user.vaiTro)} canSeeProfit={['Admin', 'KeToan', 'GDV', 'MuaHang'].includes(user.vaiTro)} />
    </AppShell>
  );
}
