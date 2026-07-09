import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import KhoVnClient from './KhoVnClient';

export const dynamic = 'force-dynamic';

export default async function KhoVnPage() {
  const user = await requireRole(['KhoVN']);

  const [incoming, atVN, ready, baos, kienRows, knRows, quyRows] = await Promise.all([
    prisma.donHang.findMany({
      where: { trangThai: 'DangVanChuyen' },
      include: { khachHang: true, chiTiet: { take: 2, orderBy: { stt: 'asc' } } },
      orderBy: { ngayTao: 'desc' }
    }),
    prisma.donHang.findMany({
      where: { trangThai: 'ChoThanhToan' },
      include: { khachHang: true, chiTiet: { take: 2, orderBy: { stt: 'asc' } } },
      orderBy: { ngayTao: 'desc' }
    }),
    prisma.donHang.findMany({
      where: { trangThai: { in: ['KhoVnNhan', 'GiaoHang'] } },
      include: { khachHang: true, chiTiet: { take: 2, orderBy: { stt: 'asc' } } },
      orderBy: { ngayTao: 'desc' }
    }),
    prisma.baoTong.findMany({
      where: { trangThai: { in: ['DaXuat', 'DaVeVN'] } },
      orderBy: { xuatAt: 'desc' },
      take: 100,
    }),
    // Kiện của các đơn đang xử lý ở kho VN (đang về / chờ TT / đã nhận / đang giao).
    prisma.kienHang.findMany({
      where: { donHang: { trangThai: { in: ['DangVanChuyen', 'ChoThanhToan', 'KhoVnNhan', 'GiaoHang'] } } },
      orderBy: [{ maDH: 'asc' }, { maVD: 'asc' }],
      take: 500,
    }),
    // Hàng khiếu nại CSKH đã chuyển về kho VN (kèm mã VĐ khách gửi trả).
    prisma.khieuNai.findMany({
      where: { chuyenKhoVN: true },
      include: { khachHang: true },
      orderBy: { chuyenKhoVNAt: 'desc' },
      take: 100,
    }),
    prisma.soQuy.findMany({
      where: { quy: 'KhoVN' },
      orderBy: { ngay: 'desc' },
      take: 200,
    }),
  ]);

  // Đếm số đơn đã/chưa nhận theo bao
  const baoOrders = await prisma.donHang.findMany({
    where: { maBao: { in: baos.map((b) => b.maBao) } },
    select: { maBao: true, trangThai: true }
  });

  const mapO = (o: any) => ({
    maDH: o.maDH, maVD: o.maVD || '', maBao: o.maBao || '',
    tenKH: o.khachHang?.tenKH || '',
    tenHang: o.chiTiet.map((c: any) => `${c.tenSP} (x${c.soLuong})`).join(' · '),
    tuyen: o.tuyen,
    conLai: o.conLai, shipND: o.shipND,
    diaChiNhan: o.diaChiNhan || '', nguoiNhan: o.nguoiNhan || '', sdtNhan: o.sdtNhan || '',
    lineNoiDia: o.lineNoiDia || ''
  });

  return <KhoVnClient user={user}
    incomingShipments={incoming.map(mapO)}
    atWarehouse={atVN.map(mapO)}
    readyToDeliver={ready.map(mapO)}
    kienList={kienRows.map((k) => ({
      maVD: k.maVD, maDH: k.maDH, maBao: k.maBao || '',
      trangThai: k.trangThai,
      ngayVeVN: k.ngayVeVN ? k.ngayVeVN.toISOString() : '',
      ngayGiao: k.ngayGiao ? k.ngayGiao.toISOString() : ''
    }))}
    knList={knRows.map((k) => ({
      maKN: k.maKN, maDH: k.maDH || '', maKH: k.maKH || '',
      tenKH: k.khachHang?.tenKH || '',
      maVDTraHang: k.maVDTraHang || '',
      daNhanHangKN: k.daNhanHangKN,
      phiDoiTra: k.phiDoiTra,
      ghiChuXuLy: k.ghiChuXuLy || '',
      ngayNhanKN: k.ngayNhanKN ? k.ngayNhanKN.toISOString() : '',
      chuyenKhoVNAt: k.chuyenKhoVNAt ? k.chuyenKhoVNAt.toISOString() : ''
    }))}
    quyList={quyRows.map((s) => ({
      id: s.id, ngay: s.ngay.toISOString(), loai: s.loai,
      soTien: s.soTien, danhMuc: s.danhMuc || '', noiDung: s.noiDung,
      maDH: s.maDH || '', nguoiTao: s.nguoiTao || ''
    }))}
    baos={baos.map((b) => {
      const ords = baoOrders.filter((o) => o.maBao === b.maBao);
      return {
        maBao: b.maBao, line: b.line, trangThai: b.trangThai,
        tongKg: b.tongKg, tongM3: b.tongM3, soKien: b.soKien,
        daNhan: ords.filter((o) => o.trangThai !== 'DangVanChuyen').length,
        tong: ords.length
      };
    })} />;
}
