'use client';

import { useMemo, useState } from 'react';
import { FiSearch, FiInbox } from 'react-icons/fi';
import { formatCurrency, formatDate } from '@/lib/format';
import { statusToClass, statusToLabel } from '@/lib/status';

type Row = {
  maDH: string; ngayTao: string; tenKH: string; maKH: string;
  tongTien: number; conLai: number; trangThai: string;
  nvTao: string; maGD: string; maVD: string;
};

export default function DonHangTable({ orders }: { orders: Row[] }) {
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return orders;
    return orders.filter((o) =>
      [o.maDH, o.tenKH, o.maKH, o.maGD, o.maVD].some((v) => (v || '').toLowerCase().includes(s))
    );
  }, [orders, q]);

  return (
    <>
      <div className="form-field" style={{ maxWidth: 360, marginBottom: 14 }}>
        <div style={{ position: 'relative' }}>
          <FiSearch style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-faint)' }} />
          <input style={{ paddingLeft: 32 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm mã đơn / KH / mã GD / VĐ..." />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state"><FiInbox /><p>Không có đơn khớp.</p></div>
      ) : (
        <table className="data-table">
          <thead><tr>
            <th>Mã đơn</th><th>Ngày</th><th>Khách hàng</th>
            <th className="number">Tổng tiền</th><th className="number">Còn lại</th>
            <th>Trạng thái</th><th>NV</th><th>Mã GD/VĐ</th>
          </tr></thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.maDH}>
                <td className="ma-don" style={{ cursor: 'pointer', textDecoration: 'underline' }}>
                  <span onClick={() => (window as any).openOrderDetail?.(o.maDH)}>{o.maDH}</span>
                </td>
                <td>{formatDate(o.ngayTao)}</td>
                <td>{o.tenKH}<br /><span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{o.maKH}</span></td>
                <td className="number">{formatCurrency(o.tongTien)}</td>
                <td className="number" style={{ color: o.conLai > 0 ? 'var(--danger-dark)' : 'var(--success-dark)', fontWeight: o.conLai > 0 ? 600 : 400 }}>
                  {formatCurrency(o.conLai)}
                </td>
                <td><span className={`status-badge ${statusToClass(o.trangThai)}`}>{statusToLabel(o.trangThai, o.ngayTao)}</span></td>
                <td style={{ fontSize: 11 }}>{o.nvTao || '-'}</td>
                <td style={{ fontSize: 11 }}>
                  {o.maGD && <div>GD: {o.maGD}</div>}
                  {o.maVD && <div>VĐ: {o.maVD}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
