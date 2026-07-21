'use client';

import { useEffect, useState, useCallback } from 'react';
import { FiTruck, FiX } from 'react-icons/fi';
import { callServer } from '@/lib/client';
import { fmtVND, formatDate } from '@/lib/format';
import { statusToClass, statusToLabel } from '@/lib/status';

type PgOrderRow = {
  maDH: string;
  trangThai: string;
  nguoiNhan: string;
  diaChiNhan: string;
  tongTien: number;
  daTra: number;
  conLai: number;
  hang: string;
};
type PhieuGiaoDetail = {
  maPhieu: string;
  maKH: string;
  tenKH: string;
  sdt: string;
  diaChi: string;
  soDon: number;
  tongTien: number;
  daThu: number;
  conLai: number;
  nguoiTao: string;
  ghiChu: string;
  createdAt: string;
  orders: PgOrderRow[];
};

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: '#F8FAFC', padding: '8px 10px', borderRadius: 8 }}>
      <div style={{ fontSize: 10, color: '#64748B' }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 13, color: color || '#0F172A' }}>{value}</div>
    </div>
  );
}

/**
 * Modal chi tiết phiếu giao — mở bằng global `window.openPhieuGiao(maPhieu)`.
 * Cũng đăng ký `window.openPhieuGiaoDetail` (bí danh) để bước Nối gọi tên nào cũng chạy.
 * TÁI DÙNG action server getPhieuGiaoDetail (không tạo handler mới). Handler cũ trả đủ
 * sđt/địa chỉ/tiền cho cả 3 vai (CSKH/KhoVN/KeToan) và KHÔNG mask theo vai — modal
 * hiển thị đúng theo server trả. Mã đơn / mã khách bấm được để mở tiếp.
 */
export default function PhieuGiaoDetailModalHost() {
  const [data, setData] = useState<PhieuGiaoDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const open = useCallback(async (maPhieu: string) => {
    if (!maPhieu) return;
    setLoading(true);
    setData(null);
    const res = await callServer('getPhieuGiaoDetail', maPhieu);
    setLoading(false);
    if (res?.success) setData(res.data);
    else if (typeof window !== 'undefined' && (window as any).__showToast) {
      (window as any).__showToast(res?.message || 'Không tải được phiếu giao', 'error');
    }
  }, []);

  useEffect(() => {
    (window as any).openPhieuGiao = open;
    (window as any).openPhieuGiaoDetail = open;
    return () => {
      delete (window as any).openPhieuGiao;
      delete (window as any).openPhieuGiaoDetail;
    };
  }, [open]);

  function close() { setData(null); }

  return (
    <div className={`modal-overlay ${data || loading ? 'show' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal-content" style={{ maxWidth: 760 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2><FiTruck /> Phiếu giao {data?.maPhieu || ''}</h2>
          <button className="modal-close" onClick={close}><FiX /></button>
        </div>
        <div className="modal-body">
          {loading && <p style={{ textAlign: 'center', color: '#94A3B8' }}>Đang tải...</p>}
          {data && (
            <>
              <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{data.tenKH}</div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                  Mã KH: <b>{data.maKH
                    ? <span style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--primary)' }}
                        onClick={() => (window as any).openCustomerDetail?.(data.maKH)}>{data.maKH}</span>
                    : '-'}</b>
                  {data.sdt && <> · SĐT: {data.sdt}</>}
                </div>
                {data.diaChi && <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Địa chỉ: {data.diaChi}</div>}
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                  Ngày lập: <b>{formatDate(data.createdAt)}</b>
                  {data.nguoiTao && <> · Người lập: <b>{data.nguoiTao}</b></>}
                </div>
                {data.ghiChu && <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Ghi chú: {data.ghiChu}</div>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 12 }}>
                <StatBox label="Số đơn" value={String(data.soDon)} />
                <StatBox label="Tổng tiền" value={fmtVND(data.tongTien) + 'đ'} />
                <StatBox label="Đã thu" value={fmtVND(data.daThu) + 'đ'} color="#059669" />
                <StatBox label="Còn lại" value={fmtVND(data.conLai) + 'đ'} color={data.conLai > 0 ? '#DC2626' : '#059669'} />
              </div>

              <div className="icon-inline" style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                Đơn trong phiếu ({data.orders.length})
              </div>
              <table className="data-table" style={{ fontSize: 12 }}>
                <thead><tr>
                  <th>Mã đơn</th><th>Trạng thái</th><th>Người nhận</th><th>Hàng</th>
                  <th className="number">Tổng tiền</th><th className="number">Còn lại</th>
                </tr></thead>
                <tbody>
                  {data.orders.map((o) => (
                    <tr key={o.maDH}>
                      <td className="ma-don">
                        <span style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--primary)' }}
                          onClick={() => (window as any).openOrderDetail?.(o.maDH)}>{o.maDH}</span>
                      </td>
                      <td><span className={`status-badge ${statusToClass(o.trangThai)}`}>{statusToLabel(o.trangThai)}</span></td>
                      <td>
                        {o.nguoiNhan || '-'}
                        {o.diaChiNhan && <div style={{ fontSize: 10, color: '#94A3B8' }}>{o.diaChiNhan}</div>}
                      </td>
                      <td style={{ maxWidth: 200 }}>{o.hang || '-'}</td>
                      <td className="number">{fmtVND(o.tongTien)}đ</td>
                      <td className="number" style={{ color: o.conLai > 0 ? '#DC2626' : '#059669' }}>{fmtVND(o.conLai)}đ</td>
                    </tr>
                  ))}
                  {data.orders.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: '#94A3B8' }}>Chưa có đơn</td></tr>
                  )}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
