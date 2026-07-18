import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import AppShell from '@/components/AppShell';
import SanPhamClient from './SanPhamClient';

export const dynamic = 'force-dynamic';

export default async function AdminSanPhamPage() {
  const user = await requireRole(['Admin', 'CSKH', 'MuaHang', 'GDV']);
  const products = await prisma.sanPham.findMany({ orderBy: { maSP: 'asc' } });

  return (
    <AppShell user={user} subtitle={`${products.length} sản phẩm`}>
      <SanPhamClient
        canAdd={user.vaiTro === 'CSKH' || user.vaiTro === 'Admin'}
        canDelete={user.vaiTro === 'Admin'}
        list={products.map((p) => ({
          maSP: p.maSP, tenSP: p.tenSP, danhMuc: p.danhMuc || '', webNguon: p.webNguon || '',
          kgGoiY: p.kgGoiY, m3GoiY: p.m3GoiY, giaThamKhao: p.giaThamKhao,
          linkTaobao: p.linkTaobao || '', ghiChu: p.ghiChu || ''
        }))}
      />
    </AppShell>
  );
}
