'use client';

import { useEffect, useState, useCallback } from 'react';
import { FiTruck, FiX } from 'react-icons/fi';
import { callServer } from '@/lib/client';
import { formatDate } from '@/lib/format';

type KienRow = {
  maDH: string; maKH: string; tenKH: string;
  kg: number; m3: number; trangThai: string; maBao: string;
  ngayVeVN: string | null; ngayGiao: string | null;
};
type VoChuRow = { id: number; kg: number; m3: number; maDH: string; ghiChu: string };
type VanDonDetail = { maVD: string; kien: KienRow[]; voChu: VoChuRow[] };

const KIEN_TT: Record<string, { label: string; cls: string }> = {
  ChuaVe: { label: 'Chưa về', cls: 's-shipping' },
  DaVeVN: { label: 'Đã về VN', cls: 's-vn' },
  DaGiao: { label: 'Đã giao', cls: 's-done' }
};

/**
 * Modal chi tiết VẬN ĐƠN / KIỆN — mở bằng global `window.openVanDonDetail(maVD)`.
 * 1 mã VĐ có thể gắn nhiều kiện (nhiều đơn). Danh tính khách ĐÃ ẩn ở SERVER cho
 * vai Kho TQ (maKH/tenKH rỗng) — modal chỉ hiển thị những gì server trả.
 */
export default function VanDonDetailModalHost() {
  const [data, setData] = useState<VanDonDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const open = useCallback(async (maVD: string) => {
    if (!maVD) return;
    setLoading(true);
    setData(null);
    const res = await callServer('getVanDonDetail', maVD);
    setLoading(false);
    if (res?.success) setData(res.data);
    else if (typeof window !== 'undefined' && (window as any).__showToast) {
      (window as any).__showToast(res?.message || 'Không tải được vận đơn', 'error');
    }
  }, []);

  useEffect(() => {
    (window as any).openVanDonDetail = open;
    return () => { delete (window as any).openVanDonDetail; };
  }, [open]);

  function close() { setData(null); }

  // Chỉ hiện cột khách khi server thực sự trả tên (vai bị ẩn sẽ luôn rỗng).
  const showKH = !!data && data.kien.some((k) => k.maKH || k.tenKH);

  return (
    <div className={`modal-overlay ${data || loading ? 'show' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal-content" style={{ maxWidth: 760 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2><FiTruck /> Vận đơn {data?.maVD || ''}</h2>
          <button className="modal-close" onClick={close}><FiX /></button>
        </div>
        <div className="modal-body">
          {loading && <p style={{ textAlign: 'center', color: '#94A3B8' }}>Đang tải...</p>}
          {data && (
            <>
              <div className="icon-inline" style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                Kiện gắn mã VĐ ({data.kien.length})
              </div>
              <table className="data-table" style={{ fontSize: 12 }}>
                <thead><tr>
                  <th>Mã đơn</th>
                  {showKH && <th>Khách</th>}
                  <th className="number">Kg</th><th className="number">m³</th>
                  <th>Trạng thái</th><th>Mã bao</th><th>Về VN</th><th>Giao</th>
                </tr></thead>
                <tbody>
                  {data.kien.map((k, i) => {
                    const kt = KIEN_TT[k.trangThai] || { label: k.trangThai, cls: 's-new' };
                    return (
                      <tr key={`${k.maDH}-${i}`}>
                        <td className="ma-don">
                          {k.maDH
                            ? <span style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--primary)' }}
                                onClick={() => (window as any).openOrderDetail?.(k.maDH)}>{k.maDH}</span>
                            : <span style={{ color: '#94A3B8' }}>—</span>}
                        </td>
                        {showKH && (
                          <td>
                            {k.maKH
                              ? <span style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--primary)' }}
                                  onClick={() => (window as any).openCustomerDetail?.(k.maKH)}>{k.maKH}</span>
                              : ''}
                            {k.tenKH ? <span style={{ color: '#64748B' }}> {k.maKH ? '· ' : ''}{k.tenKH}</span> : ''}
                          </td>
                        )}
                        <td className="number">{Number(k.kg).toFixed(2)}</td>
                        <td className="number">{Number(k.m3).toFixed(4)}</td>
                        <td><span className={`status-badge ${kt.cls}`}>{kt.label}</span></td>
                        <td>
                          {k.maBao
                            ? <span style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--primary)' }}
                                onClick={() => (window as any).openBaoDetail?.(k.maBao)}>{k.maBao}</span>
                            : <span style={{ color: '#94A3B8' }}>—</span>}
                        </td>
                        <td>{k.ngayVeVN ? formatDate(k.ngayVeVN) : '—'}</td>
                        <td>{k.ngayGiao ? formatDate(k.ngayGiao) : '—'}</td>
                      </tr>
                    );
                  })}
                  {data.kien.length === 0 && (
                    <tr><td colSpan={showKH ? 8 : 7} style={{ textAlign: 'center', color: '#94A3B8' }}>Chưa có kiện khớp đơn</td></tr>
                  )}
                </tbody>
              </table>

              {data.voChu.length > 0 && (
                <>
                  <div className="icon-inline" style={{ fontWeight: 700, fontSize: 13, margin: '14px 0 6px', color: '#B45309' }}>
                    Hàng vô chủ ({data.voChu.length}) — mã VĐ về kho nhưng chưa khớp đơn
                  </div>
                  <table className="data-table" style={{ fontSize: 12 }}>
                    <thead><tr><th>#</th><th className="number">Kg</th><th className="number">m³</th><th>Đơn dự kiến</th><th>Ghi chú</th></tr></thead>
                    <tbody>
                      {data.voChu.map((v) => (
                        <tr key={v.id}>
                          <td>{v.id}</td>
                          <td className="number">{Number(v.kg).toFixed(2)}</td>
                          <td className="number">{Number(v.m3).toFixed(4)}</td>
                          <td>
                            {v.maDH
                              ? <span style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--primary)' }}
                                  onClick={() => (window as any).openOrderDetail?.(v.maDH)}>{v.maDH}</span>
                              : <span style={{ color: '#94A3B8' }}>—</span>}
                          </td>
                          <td>{v.ghiChu || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
