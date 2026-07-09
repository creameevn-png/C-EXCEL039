import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import KhoTqClient from './KhoTqClient';

export const dynamic = 'force-dynamic';

export default async function KhoTqPage() {
  const user = await requireRole(['KhoTQ']);

  const [pending, atW, voChu, baos, nhanViens, soQuy] = await Promise.all([
    prisma.donHang.findMany({
      where: { trangThai: 'NccGiaoHang' },
      include: { chiTiet: { orderBy: { stt: 'asc' } } },
      orderBy: { ngayTao: 'desc' }
    }),
    prisma.donHang.findMany({
      where: { trangThai: 'KhoTqNhan' },
      include: { chiTiet: { orderBy: { stt: 'asc' } } },
      orderBy: { ngayTao: 'desc' }
    }),
    prisma.hangVoChu.findMany({
      where: { daGan: false },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    prisma.baoTong.findMany({
      where: { trangThai: { in: ['DangDong', 'DaXuat'] } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    // Góp ý NV #32: kho TQ có người trực tiếp làm và người phụ trách — chọn theo danh sách nhân viên kho.
    prisma.nhanVien.findMany({
      where: { vaiTro: 'KhoTQ', trangThai: 'HoatDong' },
      select: { id: true, hoTen: true }
    }),
    // Góp ý NV #43: kho TQ xem & ghi quỹ kho của chính mình.
    prisma.soQuy.findMany({
      where: { quy: 'KhoTQ' },
      orderBy: { ngay: 'desc' },
      take: 200,
    })
  ]);

  // Đơn theo từng bao đang mở
  const ordersByBao: Record<string, string[]> = {};
  for (const o of atW) { if (o.maBao) { (ordersByBao[o.maBao] ||= []).push(o.maDH); } }

  const map = (o: any) => ({
    maDH: o.maDH, maVD: o.maVD || '',
    tenHang: o.chiTiet.slice(0, 3).map((c: any) => `${c.tenSP} (x${c.soLuong})`).join(' · '),
    kg: o.tongKg, m3: o.tongM3,
    web: o.chiTiet[0]?.webNguon || '',
    tuyen: o.tuyen,
    kiemDem: o.kiemDem, dongGo: o.dongGo > 0,
    nguoiLamTQ: o.nguoiLamTQ || '',
    nguoiPhuTrachTQ: o.nguoiPhuTrachTQ || '',
    maBao: o.maBao || '',
    lines: o.chiTiet.map((c: any) => ({
      stt: c.stt, tenSP: c.tenSP, soLuong: c.soLuong,
      kiemKe: c.kiemKe || '', kiemKeNote: c.kiemKeNote || ''
    }))
  });

  return <KhoTqClient
    user={user}
    pendingArrivals={pending.map(map)}
    atWarehouse={atW.map(map)}
    voChu={voChu.map((h) => ({
      id: h.id, maVD: h.maVD, kg: h.kg, dai: h.dai, rong: h.rong, cao: h.cao, m3: h.m3,
      ghiChu: h.ghiChu || '', nguoiNhap: h.nguoiNhap || '', createdAt: h.createdAt.toISOString()
    }))}
    baos={baos.map((b) => ({
      maBao: b.maBao, line: b.line, trangThai: b.trangThai,
      tongKg: b.tongKg, tongM3: b.tongM3, soKien: b.soKien,
      orders: ordersByBao[b.maBao] || []
    }))}
    nhanViens={nhanViens}
    soQuy={soQuy.map((q) => ({
      id: q.id, ngay: q.ngay.toISOString(), loai: q.loai, soTien: q.soTien,
      danhMuc: q.danhMuc || '', noiDung: q.noiDung, maDH: q.maDH || '', nguoiTao: q.nguoiTao || ''
    }))}
  />;
}
