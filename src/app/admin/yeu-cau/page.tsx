import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import AppShell from '@/components/AppShell';
import YeuCauClient from './YeuCauClient';

export const dynamic = 'force-dynamic';

type SP = { link: string; ten: string; soLuong: number; ghiChu: string };

function parseSP(json: string): SP[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export default async function AdminYeuCauPage() {
  const user = await requireRole(['Admin', 'CSKH']);
  const list = await prisma.yeuCauMua.findMany({ orderBy: { ngayTao: 'desc' }, take: 300 });
  const pending = list.filter((y) => y.trangThai === 'ChoXuLy').length;

  return (
    <AppShell user={user} subtitle={`${pending} chờ xử lý · ${list.length} tổng`}>
      <YeuCauClient list={list.map((y) => ({
        maYC: y.maYC, ngayTao: y.ngayTao.toISOString(),
        hoTen: y.hoTen, sdt: y.sdt, email: y.email || '',
        maKH: y.maKH || '', tuyen: y.tuyen,
        sanPham: parseSP(y.sanPham), ghiChu: y.ghiChu || '',
        trangThai: y.trangThai, nvXuLy: y.nvXuLy || '',
        ghiChuXuLy: y.ghiChuXuLy || '', maDH: y.maDH || ''
      }))} />
    </AppShell>
  );
}
