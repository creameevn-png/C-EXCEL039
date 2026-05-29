import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import AppShell from '@/components/AppShell';
import DatHangClient from './DatHangClient';
import { FiInbox } from 'react-icons/fi';

export const dynamic = 'force-dynamic';

export default async function DatHangPage({ searchParams }: { searchParams: Promise<{ ma?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  let kh = null;
  if (user.vaiTro === 'Customer') {
    kh = await prisma.khachHang.findFirst({ where: { email: user.email } });
  } else if (sp.ma) {
    kh = await prisma.khachHang.findUnique({ where: { maKH: sp.ma } });
  }

  return (
    <AppShell user={user} subtitle={kh ? `KH ${kh.maKH} - ${kh.tenKH}` : 'Khách tự đặt'}>
      {!kh && user.vaiTro === 'Customer' ? (
        <div className="form-section">
          <div className="empty-state"><FiInbox /><p>Tài khoản chưa liên kết KH. Liên hệ CSKH.</p></div>
        </div>
      ) : (
        <DatHangClient kh={kh ? { maKH: kh.maKH, tenKH: kh.tenKH, pctCoc: kh.pctCoc, tuyen: kh.tuyen } : null} />
      )}
    </AppShell>
  );
}
