'use client';

import { useMemo, useState } from 'react';
import {
  FiShoppingCart, FiSearch, FiX, FiSave, FiInbox, FiPhone, FiUser, FiExternalLink, FiFileText, FiArrowRight
} from 'react-icons/fi';
import { callServer, reload } from '@/lib/client';
import { showToast } from '@/components/Toast';
import { formatDateTime } from '@/lib/format';

type SP = { link: string; ten: string; soLuong: number; ghiChu: string };
type YC = {
  maYC: string; ngayTao: string; hoTen: string; sdt: string; email: string;
  maKH: string; tuyen: string; sanPham: SP[]; ghiChu: string;
  trangThai: string; nvXuLy: string; ghiChuXuLy: string; maDH: string;
};

const YC_LABEL: Record<string, string> = {
  ChoXuLy: 'Chờ xử lý', DaLienHe: 'Đã liên hệ', DaTaoDon: 'Đã tạo đơn', TuChoi: 'Từ chối'
};
const YC_CLASS: Record<string, string> = {
  ChoXuLy: 's-deposit', DaLienHe: 's-bought', DaTaoDon: 's-done', TuChoi: 's-cancel'
};

export default function YeuCauClient({ list }: { list: YC[] }) {
  const [q, setQ] = useState('');
  const [statusF, setStatusF] = useState('');
  const [editing, setEditing] = useState<YC | null>(null);
  const [patch, setPatch] = useState({ trangThai: 'ChoXuLy', ghiChuXuLy: '', maDH: '' });
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return list.filter((y) => {
      if (statusF && y.trangThai !== statusF) return false;
      if (!s) return true;
      return [y.maYC, y.hoTen, y.sdt, y.maKH, y.ghiChu].some((v) => (v || '').toLowerCase().includes(s));
    });
  }, [list, q, statusF]);

  function open(y: YC) {
    setEditing(y);
    setPatch({ trangThai: y.trangThai, ghiChuXuLy: y.ghiChuXuLy || '', maDH: y.maDH || '' });
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    const r = await callServer('updateYeuCauMua', editing.maYC, patch);
    setBusy(false);
    if (r?.success) { showToast('Đã cập nhật yêu cầu', 'success'); setEditing(null); reload(); }
    else showToast(r?.message || 'Lỗi', 'error');
  }

  // Chuyển yêu cầu sang form Tạo đơn (CSKH) với dữ liệu điền sẵn
  function convertToOrder(y: YC) {
    try {
      sessionStorage.setItem('yc_to_order', JSON.stringify({
        maYC: y.maYC, hoTen: y.hoTen, sdt: y.sdt, email: y.email,
        maKH: y.maKH, tuyen: y.tuyen, ghiChu: y.ghiChu, sanPham: y.sanPham
      }));
    } catch {}
    window.location.href = '/cskh?fromYC=' + encodeURIComponent(y.maYC);
  }

  return (
    <div className="form-section">
      <div className="section-title"><FiShoppingCart /> Yêu cầu mua hàng ({filtered.length}/{list.length})</div>

      <div className="form-grid" style={{ marginBottom: 16 }}>
        <div className="form-field">
          <div style={{ position: 'relative' }}>
            <FiSearch style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-faint)' }} />
            <input style={{ paddingLeft: 32 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm mã YC / tên / SĐT / mã KH..." />
          </div>
        </div>
        <div className="form-field">
          <select value={statusF} onChange={(e) => setStatusF(e.target.value)}>
            <option value="">Tất cả trạng thái</option>
            {Object.keys(YC_LABEL).map((k) => <option key={k} value={k}>{YC_LABEL[k]}</option>)}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state"><FiInbox /><p>Không có yêu cầu nào.</p></div>
      ) : filtered.map((y) => (
        <div key={y.maYC} className="action-card" style={{ cursor: 'pointer' }} onClick={() => open(y)}>
          <div className="ac-header">
            <div className="ac-title">{y.maYC}</div>
            <span className={`status-badge ${YC_CLASS[y.trangThai] || 's-new'}`}>{YC_LABEL[y.trangThai] || y.trangThai}</span>
          </div>
          <div className="ac-meta icon-inline"><FiUser /> {y.hoTen} · <FiPhone /> {y.sdt}{y.maKH && <> · KH: <b>{y.maKH}</b></>} · {y.tuyen === 'HCM' ? 'HCM' : 'Hà Nội'}</div>
          <div className="ac-meta" style={{ marginTop: 6 }}>{formatDateTime(y.ngayTao)} · <b>{y.sanPham.length} sản phẩm</b>{y.maDH && <> · Đơn: <b style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--primary)' }} onClick={(e) => { e.stopPropagation(); (window as any).openOrderDetail?.(y.maDH); }}>{y.maDH}</b></>}</div>
          {y.ghiChu && <div className="ac-meta icon-inline" style={{ marginTop: 4, color: '#334155' }}><FiFileText /> {y.ghiChu.slice(0, 160)}</div>}
          <div className="ac-actions">
            <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); convertToOrder(y); }}>
              <FiArrowRight /> Chuyển thành đơn
            </button>
            <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); open(y); }}>
              Xem / xử lý
            </button>
          </div>
        </div>
      ))}

      <div className={`modal-overlay ${editing ? 'show' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setEditing(null); }}>
        <div className="modal-content" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
          <div className="modal-header"><h2><FiShoppingCart /> {editing?.maYC}</h2><button className="modal-close" onClick={() => setEditing(null)}><FiX /></button></div>
          <div className="modal-body">
            {editing && (
              <>
                <div style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
                  <div className="icon-inline"><FiUser /> <b>{editing.hoTen}</b> · <FiPhone /> <a href={`tel:${editing.sdt}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>{editing.sdt}</a>{editing.email && <> · {editing.email}</>}</div>
                  <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>
                    {editing.maKH && <>Mã KH: <b>{editing.maKH}</b> · </>}
                    Tuyến: <b>{editing.tuyen === 'HCM' ? 'HCM' : 'Hà Nội'}</b> · {formatDateTime(editing.ngayTao)}
                  </div>
                </div>

                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Sản phẩm yêu cầu ({editing.sanPham.length})</div>
                <table className="data-table" style={{ fontSize: 12, marginBottom: 12 }}>
                  <thead><tr><th>#</th><th>Sản phẩm</th><th className="number">SL</th><th>Ghi chú</th></tr></thead>
                  <tbody>
                    {editing.sanPham.map((s, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td>
                          {s.ten || <span className="muted">(không tên)</span>}
                          {s.link && <a href={s.link} target="_blank" className="icon-inline" style={{ marginLeft: 6, color: 'var(--primary)' }}><FiExternalLink /> link</a>}
                        </td>
                        <td className="number">{s.soLuong}</td>
                        <td>{s.ghiChu || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {editing.ghiChu && (
                  <div className="icon-inline" style={{ background: 'var(--surface-2)', padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 13 }}>
                    <FiFileText /> {editing.ghiChu}
                  </div>
                )}

                <div className="form-grid">
                  <div className="form-field">
                    <label>Trạng thái xử lý</label>
                    <select value={patch.trangThai} onChange={(e) => setPatch({ ...patch, trangThai: e.target.value })}>
                      {Object.keys(YC_LABEL).map((k) => <option key={k} value={k}>{YC_LABEL[k]}</option>)}
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Mã đơn đã tạo (nếu có)</label>
                    <input value={patch.maDH} onChange={(e) => setPatch({ ...patch, maDH: e.target.value })} placeholder="VD: DH-260529-001" />
                  </div>
                </div>
                <div className="form-field" style={{ marginTop: 10 }}>
                  <label>Ghi chú xử lý</label>
                  <textarea rows={2} value={patch.ghiChuXuLy} onChange={(e) => setPatch({ ...patch, ghiChuXuLy: e.target.value })} />
                </div>

                <div style={{ marginTop: 12, padding: 10, background: 'var(--primary-soft)', borderRadius: 8, fontSize: 12.5 }} className="icon-inline">
                  <FiArrowRight /> Bấm <b>Chuyển thành đơn hàng</b> để mở form Tạo đơn đã điền sẵn KH, tuyến & sản phẩm — chỉ cần nhập giá và thông tin còn thiếu. Đơn tạo xong sẽ tự gắn mã & đổi trạng thái thành "Đã tạo đơn".
                </div>
              </>
            )}
          </div>
          <div className="btn-row">
            <button className="btn btn-secondary" onClick={() => setEditing(null)}>Đóng</button>
            <button className="btn btn-success" onClick={save} disabled={busy}><FiSave /> Lưu</button>
            {editing && (
              <button className="btn btn-primary" onClick={() => convertToOrder(editing)}>
                <FiArrowRight /> Chuyển thành đơn hàng
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
