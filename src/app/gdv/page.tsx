import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import GdvClient from './GdvClient';

export const dynamic = 'force-dynamic';

export default async function GdvPage() {
  const user = await requireRole(['GDV', 'MuaHang']);
  const [pending, khieuNai] = await Promise.all([
    prisma.donHang.findMany({
      where: { trangThai: { in: ['DatCoc', 'DaMuaHang'] } },
      include: { khachHang: true, chiTiet: { orderBy: { stt: 'asc' } } },
      orderBy: { ngayTao: 'desc' }
    }),
    prisma.khieuNai.findMany({
      where: { trangThai: { notIn: ['DaXuLy', 'TuChoi'] } },
      include: { khachHang: true },
      orderBy: { ngayTao: 'desc' },
      take: 100
    })
  ]);
  return <GdvClient
    user={user}
    pendingOrders={pending.map((o) => ({
      maDH: o.maDH, tenKH: o.khachHang?.tenKH || '',
      web: o.chiTiet[0]?.webNguon || '',
      tongKg: o.tongKg, tuyen: o.tuyen,
      tongTien: o.tongTien, daTra: o.daTra,
      tenHang: o.chiTiet.slice(0, 3).map((c) => `${c.tenSP} (x${c.soLuong})`).join(' · '),
      maGD: o.maGD || '', maVD: o.maVD || '', trangThai: o.trangThai,
      vonNDT: o.vonNDT, shipNDTQ: o.shipNDTQ, loiNhuanNDT: o.loiNhuanNDT,
      ghiChuGDV: o.ghiChuGDV || '',
      tongThuNDT: o.chiTiet.reduce((s, c) => s + c.donGiaNDT * c.soLuong, 0),
      chiTiet: o.chiTiet.map((c) => ({
        stt: c.stt, tenSP: c.tenSP, soLuong: c.soLuong,
        donGiaNDT: c.donGiaNDT, linkTaobao: c.linkTaobao || ''
      }))
    }))}
    khieuNai={khieuNai.map((k) => ({
      maKN: k.maKN, ngayTao: k.ngayTao.toISOString(), maDH: k.maDH || '', maKH: k.maKH || '',
      tenKH: k.khachHang?.tenKH || '', loai: k.loai, moTa: k.moTa,
      trangThai: k.trangThai, phuongAn: k.phuongAn || '', ghiChuXuLy: k.ghiChuXuLy || '',
      anhBangChung: k.anhBangChung || ''
    }))}
  />;
}
