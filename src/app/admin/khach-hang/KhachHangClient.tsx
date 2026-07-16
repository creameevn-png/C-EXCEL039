'use client';

import { useMemo, useState } from 'react';
import { FiUsers, FiSearch, FiEdit2, FiX, FiSave, FiInbox } from 'react-icons/fi';
import { callServer, reload } from '@/lib/client';
import { showToast } from '@/components/Toast';
import { formatCurrency } from '@/lib/format';

type KH = {
  maKH: string; tenKH: string; sdt: string; email: string; tuyen: string;
  pctCoc: number; soDuVi: number; congNo: number; tongDon: number; doanhThu: number;
};

export default function KhachHangClient({ list, canEdit }: { list: KH[]; canEdit: boolean }) {
  const [q, setQ] = useState('');
  const [tuyenF, setTuyenF] = useState('');
  const [editing, setEditing] = useState<KH | null>(null);
  const [edit, setEdit] = useState({ tenKH: '', sdt: '', email: '', diaChi: '', tuyen: 'HaNoi', pctCoc: 70 });
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return list.filter((c) => {
      if (tuyenF && c.tuyen !== tuyenF) return false;
      if (!s) return true;
      return [c.maKH, c.tenKH, c.sdt, c.email].some((v) => (v || '').toLowerCase().includes(s));
    });
  }, [list, q, tuyenF]);

  function openEdit(c: KH) {
    setEditing(c);
    setEdit({ tenKH: c.tenKH, sdt: c.sdt, email: c.email, diaChi: '', tuyen: c.tuyen, pctCoc: c.pctCoc });
  }

  async function save() {
    if (!editing) return;
    if (!edit.tenKH.trim()) return showToast('Tên KH không được trống', 'error');
    setBusy(true);
    const patch: any = { tenKH: edit.tenKH, sdt: edit.sdt, email: edit.email, tuyen: edit.tuyen, pctCoc: edit.pctCoc };
    if (edit.diaChi.trim()) patch.diaChi = edit.diaChi;
    const r = await callServer('updateKhachHang', editing.maKH, patch);
    setBusy(false);
    if (r?.success) { showToast('Đã cập nhật khách hàng', 'success'); setEditing(null); reload(); }
    else showToast(r?.message || 'Lỗi', 'error');
  }

  return (
    <div className="form-section">
      <div className="section-title" style={{ justifyContent: 'space-between' }}>
        <span className="icon-inline"><FiUsers /> Khách hàng ({filtered.length}/{list.length})</span>
      </div>

      <div className="form-grid" style={{ marginBottom: 16 }}>
        <div className="form-field">
          <div style={{ position: 'relative' }}>
            <FiSearch style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-faint)' }} />
            <input style={{ paddingLeft: 32 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm mã KH / tên / SĐT / email..." />
          </div>
        </div>
        <div className="form-field">
          <select value={tuyenF} onChange={(e) => setTuyenF(e.target.value)}>
            <option value="">Tất cả tuyến</option>
            <option value="HaNoi">Hà Nội</option>
            <option value="HCM">HCM</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state"><FiInbox /><p>Không có khách hàng khớp.</p></div>
      ) : (
        <table className="data-table">
          <thead><tr>
            <th>Mã KH</th><th>Tên</th><th>SĐT</th><th>Email</th><th>Tuyến</th>
            <th>% Cọc</th><th className="number">Số dư ví</th><th className="number">Công nợ</th>
            <th className="number">Tổng đơn</th><th className="number">Doanh thu</th>
            {canEdit && <th>Thao tác</th>}
          </tr></thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.maKH}>
                <td className="ma-don"><span style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--primary)' }} onClick={() => (window as any).openCustomerDetail?.(c.maKH)}>{c.maKH}</span></td>
                <td><span style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--primary)' }} onClick={() => (window as any).openCustomerDetail?.(c.maKH)}>{c.tenKH}</span></td>
                <td>{c.sdt || '-'}</td>
                <td>{c.email || '-'}</td>
                <td>{c.tuyen === 'HCM' ? 'HCM' : 'Hà Nội'}</td>
                <td>{Math.round(c.pctCoc)}%</td>
                <td className="number text-success" style={{ fontWeight: 600 }}>{formatCurrency(c.soDuVi)}</td>
                <td className="number" title="Xem đơn của khách" style={{ cursor: 'pointer', color: c.congNo > 0 ? 'var(--danger-dark)' : undefined, fontWeight: c.congNo > 0 ? 600 : 400 }} onClick={() => (window as any).openCustomerDetail?.(c.maKH)}>{formatCurrency(c.congNo)}</td>
                <td className="number" title="Xem đơn của khách" style={{ cursor: 'pointer' }} onClick={() => (window as any).openCustomerDetail?.(c.maKH)}>{c.tongDon}</td>
                <td className="number" title="Xem đơn của khách" style={{ cursor: 'pointer' }} onClick={() => (window as any).openCustomerDetail?.(c.maKH)}>{formatCurrency(c.doanhThu)}</td>
                {canEdit && <td><button className="btn btn-primary btn-sm" onClick={() => openEdit(c)}><FiEdit2 /> Sửa</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className={`modal-overlay ${editing ? 'show' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setEditing(null); }}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header"><h2><FiEdit2 /> Sửa KH {editing?.maKH}</h2><button className="modal-close" onClick={() => setEditing(null)}><FiX /></button></div>
          <div className="modal-body">
            <div className="form-field"><label className="required">Tên khách hàng</label>
              <input value={edit.tenKH} onChange={(e) => setEdit({ ...edit, tenKH: e.target.value })} /></div>
            <div className="form-grid" style={{ marginTop: 10 }}>
              <div className="form-field"><label>Số điện thoại</label>
                <input value={edit.sdt} onChange={(e) => setEdit({ ...edit, sdt: e.target.value })} /></div>
              <div className="form-field"><label>Tuyến</label>
                <select value={edit.tuyen} onChange={(e) => setEdit({ ...edit, tuyen: e.target.value })}>
                  <option value="HaNoi">Hà Nội</option><option value="HCM">HCM</option>
                </select></div>
            </div>
            <div className="form-grid" style={{ marginTop: 10 }}>
              <div className="form-field"><label>Email</label>
                <input type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></div>
              <div className="form-field"><label>% Cọc</label>
                <input type="number" min={0} max={100} value={edit.pctCoc} onChange={(e) => setEdit({ ...edit, pctCoc: parseFloat(e.target.value) || 0 })} /></div>
            </div>
            <div className="form-field" style={{ marginTop: 10 }}><label>Địa chỉ</label>
              <input value={edit.diaChi} onChange={(e) => setEdit({ ...edit, diaChi: e.target.value })} placeholder="(để trống nếu không đổi)" /></div>
          </div>
          <div className="btn-row">
            <button className="btn btn-secondary" onClick={() => setEditing(null)}>Hủy</button>
            <button className="btn btn-success" onClick={save} disabled={busy}><FiSave /> Lưu</button>
          </div>
        </div>
      </div>
    </div>
  );
}
