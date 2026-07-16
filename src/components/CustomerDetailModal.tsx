'use client';

import { useEffect, useState, useCallback } from 'react';
import { FiUser, FiX } from 'react-icons/fi';
import { callServer } from '@/lib/client';
import { fmtVND, formatDate } from '@/lib/format';
import { statusToClass, statusToLabel } from '@/lib/status';

type OrderRow = {
  maDH: string; ngayTao: string; trangThai: string;
  tongTien: number; daTra: number; conLai: number;
};
type CustomerDetail = {
  maKH: string; tenKH: string; sdt: string; diaChi: string; tuyen: string;
  soDuVi: number; congNo: number; doanhThu: number; tongDon: number;
  orders: OrderRow[];
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
 * Modal chi tiết khách hàng — mở bằng global `window.openCustomerDetail(maKH)`.
 * Cùng khuôn với OrderDetailModal. Mỗi mã đơn trong danh sách lại bấm được để
 * mở tiếp chi tiết đơn (openOrderDetail) — nên trang cần có CẢ HAI host, và đặt
 * OrderDetailModalHost SAU host này để modal đơn nổi lên trên.
 */
export default function CustomerDetailModalHost({ canSeeMoney = true }: { canSeeMoney?: boolean }) {
  const [data, setData] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const open = useCallback(async (maKH: string) => {
    if (!maKH) return;
    setLoading(true);
    setData(null);
    const res = await callServer('getCustomerDetail', maKH);
    setLoading(false);
    if (res?.success) setData(res.data);
    else if (typeof window !== 'undefined' && (window as any).__showToast) {
      (window as any).__showToast(res?.message || 'Không tải được khách hàng', 'error');
    }
  }, []);

  useEffect(() => {
    (window as any).openCustomerDetail = open;
    return () => { delete (window as any).openCustomerDetail; };
  }, [open]);

  function close() { setData(null); }

  return (
    <div className={`modal-overlay ${data || loading ? 'show' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal-content" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2><FiUser /> Khách hàng {data?.maKH || ''}</h2>
          <button className="modal-close" onClick={close}><FiX /></button>
        </div>
        <div className="modal-body">
          {loading && <p style={{ textAlign: 'center', color: '#94A3B8' }}>Đang tải...</p>}
          {data && (
            <>
              <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{data.tenKH}</div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                  Mã KH: <b>{data.maKH}</b>
                  {data.sdt && <> · SĐT: {data.sdt}</>}
                  {' '}· Tuyến: <b>{data.tuyen === 'HCM' ? 'HCM' : 'Hà Nội'}</b>
                </div>
                {data.diaChi && <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Địa chỉ: {data.diaChi}</div>}
              </div>

              {canSeeMoney && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 12 }}>
                  <StatBox label="Tổng đơn" value={String(data.tongDon)} />
                  <StatBox label="Doanh thu" value={fmtVND(data.doanhThu) + 'đ'} />
                  <StatBox label="Còn nợ" value={fmtVND(data.congNo) + 'đ'} color={data.congNo > 0 ? '#DC2626' : '#059669'} />
                  <StatBox label="Số dư ví" value={fmtVND(data.soDuVi) + 'đ'} />
                </div>
              )}

              <div className="icon-inline" style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                Đơn hàng ({data.orders.length})
              </div>
              <table className="data-table" style={{ fontSize: 12 }}>
                <thead><tr>
                  <th>Mã đơn</th><th>Ngày</th><th>Trạng thái</th>
                  {canSeeMoney && <><th className="number">Tổng tiền</th><th className="number">Còn lại</th></>}
                </tr></thead>
                <tbody>
                  {data.orders.map((o) => (
                    <tr key={o.maDH}>
                      <td className="ma-don">
                        <span style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--primary)' }}
                          onClick={() => (window as any).openOrderDetail?.(o.maDH)}>{o.maDH}</span>
                      </td>
                      <td>{formatDate(o.ngayTao)}</td>
                      <td><span className={`status-badge ${statusToClass(o.trangThai)}`}>{statusToLabel(o.trangThai)}</span></td>
                      {canSeeMoney && <>
                        <td className="number">{fmtVND(o.tongTien)}đ</td>
                        <td className="number" style={{ color: o.conLai > 0 ? '#DC2626' : '#059669' }}>{fmtVND(o.conLai)}đ</td>
                      </>}
                    </tr>
                  ))}
                  {data.orders.length === 0 && (
                    <tr><td colSpan={canSeeMoney ? 5 : 3} style={{ textAlign: 'center', color: '#94A3B8' }}>Chưa có đơn</td></tr>
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
