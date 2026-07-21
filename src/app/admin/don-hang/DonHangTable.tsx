'use client';

import { useMemo, useState } from 'react';
import { FiSearch, FiInbox, FiEdit2, FiX, FiCheck, FiClock, FiFilter, FiDownload, FiSlash, FiAlertTriangle } from 'react-icons/fi';
import { formatCurrency, formatDate } from '@/lib/format';
import { statusToClass, statusToLabel, LINE_LABEL, TRANG_THAI_LABEL, TUYEN_LABEL } from '@/lib/status';
import { callServer, reload } from '@/lib/client';
import { showToast } from '@/components/Toast';

function exportOrdersCSV(rows: Row[]) {
  const esc = (v: any) => { const s = String(v ?? ''); return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const headers = ['Mã đơn', 'Ngày', 'Mã KH', 'Khách hàng', 'Tổng tiền', 'Còn lại', 'Trạng thái', 'Tuyến', 'Line', 'NV', 'Mã GD', 'Mã VĐ'];
  const body = rows.map((o) => [o.maDH, formatDate(o.ngayTao), o.maKH, o.tenKH, o.tongTien, o.conLai,
    (TRANG_THAI_LABEL as any)[o.trangThai] || o.trangThai, (TUYEN_LABEL as any)[o.tuyen] || o.tuyen,
    (LINE_LABEL as any)[o.lineVC] || o.lineVC, o.nvTao, o.maGD, o.maVD]);
  const csv = [headers, ...body].map((r) => r.map(esc).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'don_hang.csv'; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

type Row = {
  maDH: string; ngayTao: string; tenKH: string; maKH: string;
  tongTien: number; conLai: number; trangThai: string;
  nvTao: string; maGD: string; maVD: string;
  gdvId: number | null;
  tuyen: string; lineVC: string; loaiHang: string; pctCoc: number;
  shipND: number; dongGo: number; phuThu: number; ghiChu: string;
};

type Gdv = { id: number; hoTen: string };

export default function DonHangTable({ orders, gdvs = [] }: { orders: Row[]; gdvs?: Gdv[] }) {
  const [q, setQ] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fLine, setFLine] = useState('');
  const [fTuyen, setFTuyen] = useState('');
  const [fNo, setFNo] = useState(''); // '' | 'con' | 'het'
  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');
  const [edit, setEdit] = useState<Row | null>(null);
  const [form, setForm] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const [cancelT, setCancelT] = useState<Row | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelHoanVi, setCancelHoanVi] = useState(true);
  const [busyC, setBusyC] = useState(false);
  // Z7: gán GDV xử lý ngay trên bảng — bản ghi đè cục bộ để đổi tức thì trước khi reload.
  const [gdvOf, setGdvOf] = useState<Record<string, number | null>>({});

  async function assignGDVToOrder(maDH: string, val: string) {
    const gid = val ? Number(val) : null;
    setGdvOf((m) => ({ ...m, [maDH]: gid }));
    const r = await callServer('assignGDV', maDH, gid);
    if (r?.success) { showToast(gid ? 'Đã gán GDV xử lý' : 'Đã bỏ gán GDV', 'success'); reload(); }
    else showToast(r?.message || 'Có lỗi khi gán GDV', 'error');
  }

  async function doCancel() {
    if (!cancelT) return;
    if (!cancelReason.trim()) { showToast('Nhập lý do hủy', 'error'); return; }
    setBusyC(true);
    const r = await callServer('cancelOrder', cancelT.maDH, { lyDo: cancelReason.trim(), hoanVi: cancelHoanVi });
    setBusyC(false);
    if (r?.success) { showToast(`Đã hủy đơn ${cancelT.maDH}${r.hoanTien ? ' · hoàn ví ' + formatCurrency(r.hoanTien) : ''}`, 'success'); reload(); }
    else showToast(r?.message || 'Lỗi', 'error');
  }

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
    const from = fFrom ? new Date(fFrom + 'T00:00:00').getTime() : 0;
    const to = fTo ? new Date(fTo + 'T23:59:59').getTime() : 0;
    return orders.filter((o) => {
      if (s && ![o.maDH, o.tenKH, o.maKH, o.maGD, o.maVD].some((v) => (v || '').toLowerCase().includes(s))) return false;
      if (fStatus && o.trangThai !== fStatus) return false;
      if (fLine && o.lineVC !== fLine) return false;
      if (fTuyen && o.tuyen !== fTuyen) return false;
      if (fNo === 'con' && o.conLai <= 0.5) return false;
      if (fNo === 'het' && o.conLai > 0.5) return false;
      if (from || to) {
        const t = new Date(o.ngayTao).getTime();
        if (from && t < from) return false;
        if (to && t > to) return false;
      }
      return true;
    });
  }, [orders, q, fStatus, fLine, fTuyen, fNo, fFrom, fTo]);

  const sumTongTien = filtered.reduce((s, o) => s + o.tongTien, 0);
  const sumConLai = filtered.reduce((s, o) => s + o.conLai, 0);
  const hasFilter = q || fStatus || fLine || fTuyen || fNo || fFrom || fTo;
  function clearFilters() { setQ(''); setFStatus(''); setFLine(''); setFTuyen(''); setFNo(''); setFFrom(''); setFTo(''); }

  return (
    <>
      <div className="form-grid" style={{ marginBottom: 10 }}>
        <div className="form-field">
          <div style={{ position: 'relative' }}>
            <FiSearch style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-faint)' }} />
            <input style={{ paddingLeft: 32 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm mã đơn / KH / mã GD / VĐ..." />
          </div>
        </div>
        <div className="form-field">
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
            <option value="">— Mọi trạng thái —</option>
            {Object.entries(TRANG_THAI_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="form-field">
          <select value={fLine} onChange={(e) => setFLine(e.target.value)}>
            <option value="">— Mọi line —</option>
            {Object.entries(LINE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="form-field">
          <select value={fTuyen} onChange={(e) => setFTuyen(e.target.value)}>
            <option value="">— Mọi tuyến —</option>
            {Object.entries(TUYEN_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      <div className="form-grid" style={{ marginBottom: 14, alignItems: 'end' }}>
        <div className="form-field">
          <label style={{ fontSize: 11 }}>Công nợ</label>
          <select value={fNo} onChange={(e) => setFNo(e.target.value)}>
            <option value="">— Tất cả —</option>
            <option value="con">Còn nợ</option>
            <option value="het">Đã thu đủ</option>
          </select>
        </div>
        <div className="form-field"><label style={{ fontSize: 11 }}>Từ ngày</label><input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} /></div>
        <div className="form-field"><label style={{ fontSize: 11 }}>Đến ngày</label><input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} /></div>
        <div className="form-field" style={{ display: 'flex', gap: 6, alignItems: 'end' }}>
          {hasFilter && <button className="btn btn-secondary btn-sm" onClick={clearFilters}><FiX /> Xoá lọc</button>}
          <button className="btn btn-secondary btn-sm" onClick={() => exportOrdersCSV(filtered)} disabled={!filtered.length}><FiDownload /> Excel</button>
        </div>
      </div>

      <div className="icon-inline" style={{ marginBottom: 10, fontSize: 12, color: 'var(--text-muted)' }}>
        <FiFilter /> <b>{filtered.length}</b>/{orders.length} đơn · Tổng tiền <b>{formatCurrency(sumTongTien)}</b> · Còn nợ <b style={{ color: sumConLai > 0 ? 'var(--danger-dark)' : 'var(--success-dark)' }}>{formatCurrency(sumConLai)}</b>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state"><FiInbox /><p>Không có đơn khớp.</p></div>
      ) : (
        <table className="data-table">
          <thead><tr>
            <th>Mã đơn</th><th>Ngày</th><th>Khách hàng</th>
            <th className="number">Tổng tiền</th><th className="number">Còn lại</th>
            <th>Trạng thái</th><th>NV</th><th>GDV xử lý</th><th>Mã GD/VĐ</th><th></th>
          </tr></thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.maDH}>
                <td className="ma-don" style={{ cursor: 'pointer', textDecoration: 'underline' }}>
                  <span onClick={() => (window as any).openOrderDetail?.(o.maDH)}>{o.maDH}</span>
                </td>
                <td>{formatDate(o.ngayTao)}</td>
                <td>
                  {o.maKH ? (
                    <span style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--primary)' }}
                      onClick={() => (window as any).openCustomerDetail?.(o.maKH)}>{o.tenKH}</span>
                  ) : o.tenKH}
                  <br /><span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{o.maKH}</span>
                </td>
                <td className="number">{formatCurrency(o.tongTien)}</td>
                <td className="number" style={{ color: o.conLai > 0 ? 'var(--danger-dark)' : 'var(--success-dark)', fontWeight: o.conLai > 0 ? 600 : 400 }}>
                  {formatCurrency(o.conLai)}
                </td>
                <td><span className={`status-badge ${statusToClass(o.trangThai)}`}>{statusToLabel(o.trangThai, o.ngayTao)}</span></td>
                <td style={{ fontSize: 11 }}>{o.nvTao || '-'}</td>
                <td style={{ minWidth: 150 }}>
                  <select className="erp-cell" value={gdvOf[o.maDH] ?? o.gdvId ?? ''} onChange={(e) => assignGDVToOrder(o.maDH, e.target.value)}>
                    <option value="">— Chưa gán —</option>
                    {gdvs.map((g) => <option key={g.id} value={g.id}>{g.hoTen}</option>)}
                  </select>
                </td>
                <td style={{ fontSize: 11 }}>
                  {o.maGD && <div>GD: {o.maGD}</div>}
                  {o.maVD && <div>VĐ: {o.maVD}</div>}
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="erp-iconbtn" title="Sửa đơn (Admin)" onClick={() => openEdit(o)}><FiEdit2 /></button>
                  {o.trangThai !== 'Huy' && o.trangThai !== 'HoanThanh' && (
                    <button className="erp-iconbtn" title="Hủy đơn" style={{ color: 'var(--danger-dark)' }}
                      onClick={() => { setCancelT(o); setCancelReason(''); setCancelHoanVi(true); }}><FiSlash /></button>
                  )}
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

      {/* Modal hủy đơn */}
      <div className={`modal-overlay ${cancelT ? 'show' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setCancelT(null); }}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2><FiAlertTriangle /> Hủy đơn {cancelT?.maDH}</h2>
            <button className="modal-close" onClick={() => setCancelT(null)}><FiX /></button>
          </div>
          <div className="modal-body">
            <div className="alert alert-warning" style={{ marginBottom: 12 }}>
              <FiAlertTriangle />
              <span>Đơn sẽ chuyển sang <b>Hủy</b>. Đã thu của đơn: <b>{formatCurrency((cancelT?.tongTien || 0) - (cancelT?.conLai || 0))}</b>.</span>
            </div>
            <div className="form-field"><label>Lý do hủy <span style={{ color: 'var(--danger-dark)' }}>*</span></label>
              <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="VD: Khiếu nại NCC / khách đổi ý..." autoFocus /></div>
            <label className="icon-inline" style={{ marginTop: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={cancelHoanVi} onChange={(e) => setCancelHoanVi(e.target.checked)} />
              <span>Hoàn phần đã thu vào <b>ví khách</b> (Hủy – Khiếu nại NCC)</span>
            </label>
          </div>
          <div className="btn-row">
            <button className="btn btn-secondary" onClick={() => setCancelT(null)}>Đóng</button>
            <button className="btn btn-danger" onClick={doCancel} disabled={busyC}>{busyC ? <FiClock /> : <><FiSlash /> Xác nhận hủy</>}</button>
          </div>
        </div>
      </div>
    </>
  );
}
