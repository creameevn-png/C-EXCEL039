import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import AppShell from '@/components/AppShell';
import CongNoNccClient from './CongNoNccClient';
import OrderDetailModalHost from '@/components/OrderDetailModal';

export const dynamic = 'force-dynamic';

export default async function CongNoNccPage() {
  const user = await requireRole(['MuaHang', 'GDV', 'KeToan']);

  const [ledger, nccs, webs, tongDong, agg] = await Promise.all([
    prisma.congNoNCC.findMany({ orderBy: { ngay: 'desc' }, take: 500 }),
    prisma.nCC.findMany({ orderBy: { tenNCC: 'asc' }, take: 300 }),
    prisma.bangGiaWeb.findMany({ where: { hoatDong: true }, select: { web: true } }),
    prisma.congNoNCC.count(),
    // Tổng hợp công nợ tính trên TOÀN BỘ sổ (sổ chi tiết chỉ tải 500 dòng mới nhất để nhẹ trang).
    prisma.congNoNCC.groupBy({ by: ['doiTac', 'loai'], _sum: { soTien: true }, _count: { _all: true } })
  ]);

  // Tên shop gõ tay nên hay lệch hoa/thường + thừa khoảng trắng → gộp về cùng một dòng nợ.
  const gop = new Map<string, { doiTac: string; phatSinh: number; thanhToan: number; n: number }>();
  for (const g of agg) {
    const ten = (g.doiTac || '').trim();
    const key = ten.toLowerCase();
    const s = gop.get(key) || { doiTac: ten, phatSinh: 0, thanhToan: 0, n: 0 };
    const v = g._sum.soTien || 0;
    if (g.loai === 'ThanhToan') s.thanhToan += v; else s.phatSinh += v;
    s.n += g._count._all;
    gop.set(key, s);
  }
  const summary = [...gop.values()]
    .map((s) => ({ ...s, conNo: s.phatSinh - s.thanhToan }))
    .sort((a, b) => b.conNo - a.conNo);

  return (
    <AppShell user={user}>
      <CongNoNccClient
        ledger={ledger.map((e) => ({
          id: e.id, ngay: e.ngay.toISOString(), doiTac: e.doiTac, web: e.web || '',
          maDH: e.maDH || '', loai: e.loai, soTien: e.soTien, soTienNDT: e.soTienNDT,
          tyGia: e.tyGia, ghiChu: e.ghiChu || '', nguoiTao: e.nguoiTao || '',
          nguon: e.nguon || '', maGiaoDich: e.maGiaoDich || ''
        }))}
        partners={nccs.map((n) => n.tenNCC)}
        webs={webs.map((w) => w.web)}
        summary={summary}
        tongDong={tongDong}
        canDelete={['KeToan', 'Admin'].includes(user.vaiTro)}
      />
      <OrderDetailModalHost canSeeMoney={['Admin', 'CSKH', 'KeToan'].includes(user.vaiTro)} canSeeProfit={['Admin', 'KeToan', 'GDV', 'MuaHang'].includes(user.vaiTro)} />
    </AppShell>
  );
}
