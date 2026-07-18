import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getNumber } from '@/lib/settings';
import AppShell from '@/components/AppShell';
import DatHangClient from './DatHangClient';
import { FiInbox } from 'react-icons/fi';

export const dynamic = 'force-dynamic';

export default async function DatHangPage({ searchParams }: { searchParams: Promise<{ ma?: string }> }) {
  // Chỉ CSKH (+ Admin) và khách tự đặt đơn của mình. Vai kho/kế toán không được
  // xem hồ sơ KH qua ?ma=. Trùng với quyền tạo đơn ở /api/action.
  const user = await requireRole(['CSKH', 'Customer']);
  const sp = await searchParams;
  let kh = null;
  if (user.vaiTro === 'Customer') {
    kh = await prisma.khachHang.findFirst({ where: { email: user.email } });
  } else if (sp.ma) {
    kh = await prisma.khachHang.findUnique({ where: { maKH: sp.ma } });
  }

  // Tạm tính phía khách phải dùng ĐÚNG % của Cài đặt, nếu không tổng khách nhìn
  // thấy sẽ lệch với tổng server tính lại (shipping-fee.ts).
  const [pctMua, pctBH] = await Promise.all([
    getNumber('phi_mua_pct', 2),
    getNumber('phi_bh_pct', 1)
  ]);

  return (
    <AppShell user={user} subtitle={kh ? `KH ${kh.maKH} - ${kh.tenKH}` : 'Khách tự đặt'}>
      {!kh && user.vaiTro === 'Customer' ? (
        <div className="form-section">
          <div className="empty-state"><FiInbox /><p>Tài khoản chưa liên kết KH. Liên hệ CSKH.</p></div>
        </div>
      ) : (
        <DatHangClient
          isCustomer={user.vaiTro === 'Customer'}
          pctMua={pctMua}
          pctBH={pctBH}
          kh={kh ? {
            maKH: kh.maKH, tenKH: kh.tenKH, pctCoc: kh.pctCoc, tuyen: kh.tuyen,
            sdt: kh.sdt || '', diaChi: kh.diaChi || ''
          } : null}
        />
      )}
    </AppShell>
  );
}
