import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import AppShell from '@/components/AppShell';
import UsersClient from './UsersClient';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const user = await requireRole(['Admin']);
  const users = await prisma.nhanVien.findMany({ orderBy: { id: 'asc' } });
  return (
    <AppShell user={user} subtitle={`${users.length} nhân viên`}>
      <UsersClient users={users.map((u) => ({
        id: u.id, email: u.email, hoTen: u.hoTen, vaiTro: u.vaiTro, trangThai: u.trangThai,
        pctHoaHong: u.pctHoaHong, pctThuong: u.pctThuong
      }))} />
    </AppShell>
  );
}
