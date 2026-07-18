import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import InTemClient from './InTemClient';

export const dynamic = 'force-dynamic';

export default async function InTemPage({ searchParams }: { searchParams: Promise<{ ma?: string; bao?: string }> }) {
  const user = await requireRole(['KhoTQ', 'KhoVN', 'CSKH']);
  const sp = await searchParams;
  const ma = sp.ma;
  const maBao = sp.bao;
  let don = null;
  if (ma) {
    don = await prisma.donHang.findUnique({
      where: { maDH: ma },
      include: { khachHang: true, chiTiet: { orderBy: { stt: 'asc' } } }
    });
  }

  // Đợt in tem: cho phép in tem cho cả BAO TỔNG (?bao=...)
  let bao = null;
  if (maBao) {
    const b = await prisma.baoTong.findUnique({ where: { maBao } });
    if (b) {
      const donTrongBao = await prisma.donHang.findMany({
        where: { maBao },
        orderBy: { maDH: 'asc' },
        select: { maDH: true }
      });
      const lineTxt = b.line === 'LineNhanh' ? 'NHANH' : b.line === 'LineRe' ? 'RẺ' : 'THƯỜNG';
      bao = {
        maBao: b.maBao, line: lineTxt, trangThai: b.trangThai,
        tongKg: b.tongKg, tongM3: b.tongM3, soKien: b.soKien,
        orders: donTrongBao.map((o) => o.maDH)
      };
    }
  }

  // Kho TQ chỉ cần biết hàng nào của đơn nào, không được biết danh tính khách.
  const anKH = user.vaiTro === 'KhoTQ';
  return <InTemClient initialMa={ma || ''} initialBaoMa={maBao || ''} anKH={anKH} initialBao={bao} initialDon={don ? {
    maDH: don.maDH,
    maVD: don.maVD || '',
    maGD: don.maGD || '',
    tenKH: anKH ? '' : (don.khachHang?.tenKH || ''),
    sdt: anKH ? '' : (don.khachHang?.sdt || ''),
    diaChi: anKH ? '' : (don.khachHang?.diaChi || ''),
    tuyen: don.tuyen,
    tongKg: don.tongKg,
    tongM3: don.tongM3,
    items: don.chiTiet.map((c) => `${c.tenSP} (x${c.soLuong})`)
  } : null} />;
}
