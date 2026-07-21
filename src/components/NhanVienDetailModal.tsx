'use client';

import { useEffect, useState, useCallback } from 'react';
import { FiUsers, FiX } from 'react-icons/fi';
import { callServer } from '@/lib/client';
import { formatDate } from '@/lib/format';
import { statusToClass, statusToLabel, VAITRO_LABEL } from '@/lib/status';

type OrderRow = { maDH: string; trangThai: string; ngayTao: string };
type NhanVienDetail = {
  id: number; hoTen: string; vaiTro: string;
  trangThai: string; tongDon: number; orders: OrderRow[];
};

/**
 * Modal chi tiết nhân viên / GDV — mở bằng global `window.openNhanVienDetail(id)`.
 * Cùng khuôn với CustomerDetailModal. Xem hiệu suất NV: tổng đơn phụ trách +
 * danh sách đơn (maDH bấm được → openOrderDetail; trang cần mount
 * OrderDetailModalHost đặt SAU host này).
 * MASK ở server: KHÔNG có tiền khách/doanh số — chỉ maDH + trạng thái + ngày.
 */
export default function NhanVienDetailModalHost() {
  const [data, setData] = useState<NhanVienDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const open = useCallback(async (id: number | string) => {
    const k = String(id || '').trim();
    if (!k) return;
    setLoading(true);
    setData(null);
    const res = await callServer('getNhanVienDetail', k);
    setLoading(false);
    if (res?.success) setData(res.data);
    else if (typeof window !== 'undefined' && (window as any).__showToast) {
      (window as any).__showToast(res?.message || 'Không tải được nhân viên', 'error');
    }
  }, []);

  useEffect(() => {
    (window as any).openNhanVienDetail = open;
    return () => { delete (window as any).openNhanVienDetail; };
  }, [open]);

  function close() { setData(null); }

  const active = data?.trangThai === 'HoatDong';

  return (
    <div className={`modal-overlay ${data || loading ? 'show' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal-content" style={{ maxWidth: 620 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2><FiUsers /> Nhân viên {data?.hoTen || ''}</h2>
          <button className="modal-close" onClick={close}><FiX /></button>
        </div>
        <div className="modal-body">
          {loading && <p style={{ textAlign: 'center', color: '#94A3B8' }}>Đang tải...</p>}
          {data && (
            <>
              <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{data.hoTen}</div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                  Vai trò: <b>{VAITRO_LABEL[data.vaiTro as keyof typeof VAITRO_LABEL] || data.vaiTro}</b>
                  {' '}· Trạng thái:{' '}
                  <b style={{ color: active ? '#059669' : '#DC2626' }}>{active ? 'Đang hoạt động' : 'Tạm khóa'}</b>
                  {' '}· Tổng đơn phụ trách: <b>{data.tongDon}</b>
                </div>
              </div>

              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                Đơn phụ trách ({data.orders.length}{data.tongDon > data.orders.length ? ` / ${data.tongDon}` : ''})
              </div>
              <table className="data-table" style={{ fontSize: 12 }}>
                <thead><tr>
                  <th>Mã đơn</th><th>Trạng thái</th><th>Ngày tạo</th>
                </tr></thead>
                <tbody>
                  {data.orders.map((o) => (
                    <tr key={o.maDH}>
                      <td className="ma-don">
                        <span style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--primary)' }}
                          onClick={() => (window as any).openOrderDetail?.(o.maDH)}>{o.maDH}</span>
                      </td>
                      <td><span className={`status-badge ${statusToClass(o.trangThai)}`}>{statusToLabel(o.trangThai)}</span></td>
                      <td>{formatDate(o.ngayTao)}</td>
                    </tr>
                  ))}
                  {data.orders.length === 0 && (
                    <tr><td colSpan={3} style={{ textAlign: 'center', color: '#94A3B8' }}>Chưa phụ trách đơn nào</td></tr>
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
