'use client';

import { useEffect, useState, useCallback } from 'react';
import { FiBox, FiX } from 'react-icons/fi';
import { callServer } from '@/lib/client';
import { formatDate } from '@/lib/format';
import { statusToClass, statusToLabel } from '@/lib/status';

type OrderRow = { maDH: string; trangThai: string; tongKg: number; tongM3: number };
type KienRow = { maDH: string; maVD: string; kg: number; m3: number; trangThai: string };
type BaoDetail = {
  maBao: string; line: string; trangThai: string;
  tongKg: number; tongM3: number; soKien: number;
  ghiChu: string; nguoiTao: string; nguoiNhanVN: string;
  createdAt: string; xuatAt: string | null; veVNAt: string | null;
  orders: OrderRow[]; kien: KienRow[];
};

const LINE_TEXT: Record<string, string> = {
  LineNhanh: 'Line Nhanh', LineThuong: 'Line Thường', LineRe: 'Line Tiết kiệm'
};
const BAO_TT: Record<string, { label: string; cls: string }> = {
  DangDong: { label: 'Đang đóng', cls: 's-new' },
  DaXuat: { label: 'Đã xuất', cls: 's-shipping' },
  DaVeVN: { label: 'Đã về VN', cls: 's-vn' },
  HoanThanh: { label: 'Hoàn thành', cls: 's-done' }
};
const KIEN_TT: Record<string, { label: string; cls: string }> = {
  ChuaVe: { label: 'Chưa về', cls: 's-shipping' },
  DaVeVN: { label: 'Đã về VN', cls: 's-vn' },
  DaGiao: { label: 'Đã giao', cls: 's-done' }
};

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#F8FAFC', padding: '8px 10px', borderRadius: 8 }}>
      <div style={{ fontSize: 10, color: '#64748B' }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 13, color: '#0F172A' }}>{value}</div>
    </div>
  );
}

/**
 * Modal chi tiết BAO TỔNG — mở bằng global `window.openBaoDetail(maBao)`.
 * Cùng khuôn với CustomerDetailModal. Mã đơn/mã VĐ trong danh sách bấm được để
 * mở tiếp (openOrderDetail / openVanDonDetail) — trang cần mount thêm các host đó.
 */
export default function BaoDetailModalHost() {
  const [data, setData] = useState<BaoDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const open = useCallback(async (maBao: string) => {
    if (!maBao) return;
    setLoading(true);
    setData(null);
    const res = await callServer('getBaoDetail', maBao);
    setLoading(false);
    if (res?.success) setData(res.data);
    else if (typeof window !== 'undefined' && (window as any).__showToast) {
      (window as any).__showToast(res?.message || 'Không tải được bao', 'error');
    }
  }, []);

  useEffect(() => {
    (window as any).openBaoDetail = open;
    return () => { delete (window as any).openBaoDetail; };
  }, [open]);

  function close() { setData(null); }

  const tt = data ? (BAO_TT[data.trangThai] || { label: data.trangThai, cls: 's-new' }) : null;

  return (
    <div className={`modal-overlay ${data || loading ? 'show' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal-content" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2><FiBox /> Bao tổng {data?.maBao || ''}</h2>
          <button className="modal-close" onClick={close}><FiX /></button>
        </div>
        <div className="modal-body">
          {loading && <p style={{ textAlign: 'center', color: '#94A3B8' }}>Đang tải...</p>}
          {data && tt && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: '#64748B' }}>
                  Line: <b>{LINE_TEXT[data.line] || data.line}</b>
                  {data.nguoiTao && <> · Người tạo: <b>{data.nguoiTao}</b></>}
                  {data.nguoiNhanVN && <> · Người nhận VN: <b>{data.nguoiNhanVN}</b></>}
                </div>
                <span className={`status-badge ${tt.cls}`}>{tt.label}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
                <StatBox label="Tổng kg" value={`${Number(data.tongKg).toFixed(2)} kg`} />
                <StatBox label="Tổng m³" value={`${Number(data.tongM3).toFixed(4)} m³`} />
                <StatBox label="Số kiện" value={String(data.soKien)} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12, fontSize: 12 }}>
                <div><b>Ngày tạo:</b> {formatDate(data.createdAt)}</div>
                <div><b>Xuất TQ:</b> {data.xuatAt ? formatDate(data.xuatAt) : '(chưa)'}</div>
                <div><b>Về VN:</b> {data.veVNAt ? formatDate(data.veVNAt) : '(chưa)'}</div>
              </div>

              <div className="icon-inline" style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                Đơn trong bao ({data.orders.length})
              </div>
              <table className="data-table" style={{ fontSize: 12 }}>
                <thead><tr><th>Mã đơn</th><th>Trạng thái</th><th className="number">Kg</th><th className="number">m³</th></tr></thead>
                <tbody>
                  {data.orders.map((o) => (
                    <tr key={o.maDH}>
                      <td className="ma-don">
                        <span style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--primary)' }}
                          onClick={() => (window as any).openOrderDetail?.(o.maDH)}>{o.maDH}</span>
                      </td>
                      <td><span className={`status-badge ${statusToClass(o.trangThai)}`}>{statusToLabel(o.trangThai)}</span></td>
                      <td className="number">{Number(o.tongKg).toFixed(2)}</td>
                      <td className="number">{Number(o.tongM3).toFixed(4)}</td>
                    </tr>
                  ))}
                  {data.orders.length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', color: '#94A3B8' }}>Chưa có đơn</td></tr>
                  )}
                </tbody>
              </table>

              <div className="icon-inline" style={{ fontWeight: 700, fontSize: 13, margin: '14px 0 6px' }}>
                Kiện trong bao ({data.kien.length})
              </div>
              <table className="data-table" style={{ fontSize: 12 }}>
                <thead><tr><th>Mã đơn</th><th>Mã VĐ</th><th className="number">Kg</th><th className="number">m³</th><th>Trạng thái</th></tr></thead>
                <tbody>
                  {data.kien.map((k, i) => {
                    const kt = KIEN_TT[k.trangThai] || { label: k.trangThai, cls: 's-new' };
                    return (
                      <tr key={`${k.maDH}-${k.maVD}-${i}`}>
                        <td className="ma-don">
                          {k.maDH
                            ? <span style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--primary)' }}
                                onClick={() => (window as any).openOrderDetail?.(k.maDH)}>{k.maDH}</span>
                            : <span style={{ color: '#94A3B8' }}>—</span>}
                        </td>
                        <td>
                          {k.maVD
                            ? <span style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--primary)' }}
                                onClick={() => (window as any).openVanDonDetail?.(k.maVD)}>{k.maVD}</span>
                            : <span style={{ color: '#94A3B8' }}>—</span>}
                        </td>
                        <td className="number">{Number(k.kg).toFixed(2)}</td>
                        <td className="number">{Number(k.m3).toFixed(4)}</td>
                        <td><span className={`status-badge ${kt.cls}`}>{kt.label}</span></td>
                      </tr>
                    );
                  })}
                  {data.kien.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: '#94A3B8' }}>Chưa có kiện</td></tr>
                  )}
                </tbody>
              </table>

              {data.ghiChu && (
                <div style={{ marginTop: 12, padding: 8, background: '#F8FAFC', borderRadius: 6, fontSize: 12 }}>
                  <b>Ghi chú:</b> {data.ghiChu}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
