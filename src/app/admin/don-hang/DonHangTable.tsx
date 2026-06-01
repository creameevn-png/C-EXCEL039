'use client';

import { useMemo, useState } from 'react';
import { FiSearch, FiInbox, FiEdit2, FiX, FiCheck, FiClock } from 'react-icons/fi';
import { formatCurrency, formatDate } from '@/lib/format';
import { statusToClass, statusToLabel, LINE_LABEL } from '@/lib/status';
import { callServer, reload } from '@/lib/client';
import { showToast } from '@/components/Toast';

type Row = {
  maDH: string; ngayTao: string; tenKH: string; maKH: string;
  tongTien: number; conLai: number; trangThai: string;
  nvTao: string; maGD: string; maVD: string;
  tuyen: string; lineVC: string; loaiHang: string; pctCoc: number;
  shipND: number; dongGo: number; phuThu: number; ghiChu: string;
};

export default function DonHangTable({ orders }: { orders: Row[] }) {
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Row | null>(null);
  const [form, setForm] = useState<any>({});
  const [busy, setBusy] = useState(false);

  function openEdit(o: Row) {
    setEdit(o);
    setForm({
      tuyen: o.tuyen, lineVC: o.lineVC, loaiHang: o.loaiHang, pctCoc: String(o.pctCoc),
      shipND: String(o.shipND), dongGo: String(o.dongGo), phuThu: String(o.phuThu), ghiChu: o.ghiChu
    });
  }
  async function saveEdit() {
    if (!edit) return;
    setBusy(true);
    const r = await callServer('updateOrderFields', edit.maDH, {
      tuyen: form.tuyen, lineVC: form.lineVC, loaiHang: form.loaiHang,
      pctCoc: parseFloat(form.pctCoc) || 0, shipND: parseFloat(form.shipND) || 0,
      dongGo: parseFloat(form.dongGo) || 0, phuThu: parseFloat(form.phuThu) || 0, ghiChu: form.ghiChu
    });
    setBusy(false);
    if (r?.success) { showToast(`Đã sửa đơn ${edit.maDH}`, 'success'); reload(); }
    else showToast(r?.message || 'Lỗi', 'error');
  }

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
            <th>Trạng thái</th><th>NV</th><th>Mã GD/VĐ</th><th></th>
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
                <td>
                  <button className="erp-iconbtn" title="Sửa đơn (Admin)" onClick={() => openEdit(o)}><FiEdit2 /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Modal sửa đơn (Admin) — sửa được kể cả khi đã hoàn thành */}
      <div className={`modal-overlay ${edit ? 'show' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setEdit(null); }}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2><FiEdit2 /> Sửa đơn {edit?.maDH}</h2>
            <button className="modal-close" onClick={() => setEdit(null)}><FiX /></button>
          </div>
          <div className="modal-body">
            <div className="form-grid">
              <div className="form-field"><label>Tuyến</label>
                <select value={form.tuyen} onChange={(e) => setForm({ ...form, tuyen: e.target.value })}>
                  <option value="HaNoi">Hà Nội</option><option value="HCM">HCM</option>
                </select></div>
              <div className="form-field"><label>Line vận chuyển</label>
                <select value={form.lineVC} onChange={(e) => setForm({ ...form, lineVC: e.target.value })}>
                  {Object.entries(LINE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></div>
            </div>
            <div className="form-grid" style={{ marginTop: 10 }}>
              <div className="form-field"><label>Loại hàng</label>
                <select value={form.loaiHang} onChange={(e) => setForm({ ...form, loaiHang: e.target.value })}>
                  <option value="Thường">Thường</option><option value="Hàng dễ vỡ">Hàng dễ vỡ</option><option value="Mỹ phẩm">Mỹ phẩm</option>
                </select></div>
              <div className="form-field"><label>% Cọc</label>
                <input type="number" value={form.pctCoc} onChange={(e) => setForm({ ...form, pctCoc: e.target.value })} /></div>
            </div>
            <div className="form-grid-3" style={{ marginTop: 10 }}>
              <div className="form-field"><label>Phí ship VN</label>
                <input type="number" value={form.shipND} onChange={(e) => setForm({ ...form, shipND: e.target.value })} /></div>
              <div className="form-field"><label>Phí đóng gỗ</label>
                <input type="number" value={form.dongGo} onChange={(e) => setForm({ ...form, dongGo: e.target.value })} /></div>
              <div className="form-field"><label>Phí phụ thu</label>
                <input type="number" value={form.phuThu} onChange={(e) => setForm({ ...form, phuThu: e.target.value })} /></div>
            </div>
            <div className="form-field" style={{ marginTop: 10 }}><label>Ghi chú</label>
              <input value={form.ghiChu} onChange={(e) => setForm({ ...form, ghiChu: e.target.value })} /></div>
            <div className="hint" style={{ marginTop: 8 }}>Tổng tiền & cọc sẽ tự tính lại. Thay đổi được ghi vào Audit log.</div>
          </div>
          <div className="btn-row">
            <button className="btn btn-secondary" onClick={() => setEdit(null)}>Hủy</button>
            <button className="btn btn-primary" onClick={saveEdit} disabled={busy}>{busy ? <FiClock /> : <><FiCheck /> Lưu</>}</button>
          </div>
        </div>
      </div>
    </>
  );
}
