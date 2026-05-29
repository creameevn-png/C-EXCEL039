import { requireUser, roleHomePath } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const u = await requireUser();
  redirect(roleHomePath(u.vaiTro));
}
