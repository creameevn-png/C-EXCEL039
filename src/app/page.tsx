import { redirect } from 'next/navigation';
import { getSession, roleHomePath } from '@/lib/auth';

export default async function RootPage() {
  const u = await getSession();
  if (!u) redirect('/tra-cuu');
  redirect(roleHomePath(u.vaiTro));
}
