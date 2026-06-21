import { getExtUser } from '@/lib/extauth';
import { corsJson, corsPreflight } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() { return corsPreflight(); }

export async function GET(req: Request) {
  const user = await getExtUser(req);
  if (!user) return corsJson({ message: 'Token không hợp lệ / chưa đăng nhập' }, { status: 401 });
  return corsJson({ user });
}
