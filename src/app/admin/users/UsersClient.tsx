'use client';

import { useMemo, useState } from 'react';
import { FiUserCheck, FiUserPlus, FiEdit2, FiX, FiCheck, FiSave, FiSearch, FiInbox, FiInfo } from 'react-icons/fi';
import { callServer, reload } from '@/lib/client';
import { showToast } from '@/components/Toast';
import { VAITRO_LABEL } from '@/lib/status';

type U = {
  id: number; email: string; hoTen: string; vaiTro: string; trangThai: string;
  pctHoaHong: number; pctThuong: number;
};

/**
 * 'MuaHang' đã gộp vào 'GDV' (một người làm cả hai) nên KHÔNG còn là lựa chọn khi
 * tạo/sửa. Các tài khoản cũ mang vai trò 'MuaHang' vẫn chạy bình thường (alias) và
 * sẽ tự chuẩn hoá về 'GDV' ở lần lưu tiếp theo.
 */
const ROLES = ['Admin', 'CSKH', 'GDV', 'KeToan', 'KhoTQ', 'KhoVN', 'Customer'] as const;

/** Lọc theo 'GDV' phải bắt cả các tài khoản còn mang vai trò cũ 'MuaHang'. */
function roleMatches(vaiTro: string, filter: string): boolean {
  if (filter === 'GDV') return vaiTro === 'GDV' || vaiTro === 'MuaHang';
  return vaiTro === filter;
}

export default function UsersClient({ users }: { users: U[] }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [c, setC] = useState({ email: '', password: '', hoTen: '', vaiTro: 'CSKH' });
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<U | null>(null);
  const [edit, setEdit] = useState({ hoTen: '', vaiTro: 'CSKH', trangThai: 'HoatDong', password: '' });
  const [q, setQ] = useState('');
  const [roleF, setRoleF] = useState('');
  const [statusF, setStatusF] = useState('');
  const [pctEdit, setPctEdit] = useState<Record<number, { pctHoaHong: string; pctThuong: string }>>(() =>
    Object.fromEntries(users.map((u) => [u.id, { pctHoaHong: String(u.pctHoaHong ?? 0), pctThuong: String(u.pctThuong ?? 0) }]))
  );
  const [pctBusy, setPctBusy] = useState<Record<number, boolean>>({});

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return users.filter((u) => {
      if (roleF && !roleMatches(u.vaiTro, roleF)) return false;
      if (statusF && u.trangThai !== statusF) return false;
      if (!s) return true;
      return [u.email, u.hoTen].some((v) => (v || '').toLowerCase().includes(s));
    });
  }, [users, q, roleF, statusF]);

  async function create() {
    if (!c.email || !c.password || !c.hoTen) return showToast('Thiếu thông tin', 'error');
    setBusy(true);
    const r = await callServer('createUser', c);
    setBusy(false);
    if (r?.success) { showToast('Đã tạo nhân viên', 'success'); reload(); }
    else showToast(r?.message || 'Lỗi', 'error');
  }

  function openEdit(u: U) {
    setEditing(u);
    // Vai trò cũ 'MuaHang' không còn trong danh sách chọn → quy về 'GDV'.
    const vaiTro = u.vaiTro === 'MuaHang' ? 'GDV' : u.vaiTro;
    setEdit({ hoTen: u.hoTen, vaiTro, trangThai: u.trangThai, password: '' });
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    const patch: any = { hoTen: edit.hoTen, vaiTro: edit.vaiTro, trangThai: edit.trangThai };
    if (edit.password) patch.password = edit.password;
    const r = await callServer('updateUser', editing.id, patch);
    setBusy(false);
    if (r?.success) { showToast('Đã cập nhật', 'success'); setEditing(null); reload(); }
    else showToast(r?.message || 'Lỗi', 'error');
  }

  // Hoa hồng chỉ áp cho GDV (gồm alias 'MuaHang'); thưởng chỉ áp cho CSKH.
  const isGDV = (vaiTro: string) => roleMatches(vaiTro, 'GDV');
  const canPct = (vaiTro: string) => isGDV(vaiTro) || vaiTro === 'CSKH';

  function setPctField(id: number, field: 'pctHoaHong' | 'pctThuong', val: string) {
    setPctEdit((p) => ({ ...p, [id]: { ...(p[id] ?? { pctHoaHong: '', pctThuong: '' }), [field]: val } }));
  }

  function pctCell(u: U, field: 'pctHoaHong' | 'pctThuong', applies: boolean) {
    if (!applies) return <span style={{ color: 'var(--text-faint)' }}>—</span>;
    const e = pctEdit[u.id] ?? { pctHoaHong: '', pctThuong: '' };
    return (
      <input type="number" min={0} max={100} step="0.1" style={{ width: 74, textAlign: 'right' }}
        value={e[field] ?? ''} disabled={pctBusy[u.id]}
        onChange={(ev) => setPctField(u.id, field, ev.target.value)} />
    );
  }

  async function savePct(u: U) {
    const e = pctEdit[u.id] ?? { pctHoaHong: '', pctThuong: '' };
    const patch: { pctHoaHong?: number; pctThuong?: number } = {};
    if (isGDV(u.vaiTro)) {
      const v = Number(e.pctHoaHong);
      if (!Number.isFinite(v) || v < 0 || v > 100) return showToast('% hoa hồng phải từ 0 đến 100', 'error');
      patch.pctHoaHong = v;
    }
    if (u.vaiTro === 'CSKH') {
      const v = Number(e.pctThuong);
      if (!Number.isFinite(v) || v < 0 || v > 100) return showToast('% thưởng phải từ 0 đến 100', 'error');
      patch.pctThuong = v;
    }
    setPctBusy((p) => ({ ...p, [u.id]: true }));
    const r = await callServer('setPctNhanVien', u.id, patch);
    setPctBusy((p) => ({ ...p, [u.id]: false }));
    if (r?.success) { showToast('Đã lưu tỉ lệ', 'success'); reload(); }
    else showToast(r?.message || 'Lỗi', 'error');
  }

  return (
    <>
      <div className="form-section">
        <div className="section-title" style={{ justifyContent: 'space-between' }}>
          <span className="icon-inline"><FiUserCheck /> Nhân viên ({filtered.length}/{users.length})</span>
          <button className="btn btn-success btn-sm" onClick={() => setCreateOpen(true)}><FiUserPlus /> Thêm NV</button>
        </div>

        <div className="form-grid-3" style={{ marginBottom: 16 }}>
          <div className="form-field">
            <div style={{ position: 'relative' }}>
              <FiSearch style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-faint)' }} />
              <input style={{ paddingLeft: 32 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm email / họ tên..." />
            </div>
          </div>
          <div className="form-field">
            <select value={roleF} onChange={(e) => setRoleF(e.target.value)}>
              <option value="">Tất cả vai trò</option>
              {ROLES.map((r) => <option key={r} value={r}>{VAITRO_LABEL[r]}</option>)}
            </select>
          </div>
          <div className="form-field">
            <select value={statusF} onChange={(e) => setStatusF(e.target.value)}>
              <option value="">Tất cả trạng thái</option>
              <option value="HoatDong">Hoạt động</option>
              <option value="TamKhoa">Tạm khóa</option>
            </select>
          </div>
        </div>

        <p className="hint icon-inline" style={{ marginBottom: 12 }}>
          <FiInfo /> Hoa hồng GDV tính trên doanh số các đơn được giao phụ trách; thưởng CSKH tính trên tổng phí dịch vụ của đơn do người đó tạo. Xem kết quả ở Báo cáo › Hoa hồng &amp; thưởng.
        </p>

        {filtered.length === 0 ? <div className="empty-state"><FiInbox /><p>Không có nhân viên khớp.</p></div> :
        <table className="data-table">
          <thead><tr>
            <th>ID</th><th>Email</th><th>Họ tên</th><th>Vai trò</th><th>% hoa hồng</th><th>% thưởng</th><th>Trạng thái</th><th>Thao tác</th>
          </tr></thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>{u.email}</td>
                <td>{u.hoTen}</td>
                <td><span className="role-badge" style={{ background: '#DBEAFE', color: '#1E40AF' }}>{VAITRO_LABEL[u.vaiTro as keyof typeof VAITRO_LABEL]}</span></td>
                <td>{pctCell(u, 'pctHoaHong', isGDV(u.vaiTro))}</td>
                <td>{pctCell(u, 'pctThuong', u.vaiTro === 'CSKH')}</td>
                <td>
                  <span className="status-badge" style={u.trangThai === 'HoatDong' ? { background: '#DCFCE7', color: '#166534' } : { background: '#FEE2E2', color: '#991B1B' }}>
                    {u.trangThai === 'HoatDong' ? 'Hoạt động' : 'Tạm khóa'}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button className="btn btn-primary btn-sm" onClick={() => openEdit(u)}><FiEdit2 /> Sửa</button>
                    {canPct(u.vaiTro) && (
                      <button className="btn btn-secondary btn-sm" onClick={() => savePct(u)} disabled={pctBusy[u.id]}><FiSave /> Lưu %</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>}
      </div>

      {/* Modal: Tạo */}
      <div className={`modal-overlay ${createOpen ? 'show' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setCreateOpen(false); }}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header"><h2><FiUserPlus /> Thêm nhân viên</h2><button className="modal-close" onClick={() => setCreateOpen(false)}><FiX /></button></div>
          <div className="modal-body">
            <div className="form-field"><label className="required">Email</label>
              <input type="email" value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} placeholder="nv@demo.vn" /></div>
            <div className="form-field" style={{ marginTop: 10 }}><label className="required">Mật khẩu</label>
              <input type="text" value={c.password} onChange={(e) => setC({ ...c, password: e.target.value })} /></div>
            <div className="form-field" style={{ marginTop: 10 }}><label className="required">Họ tên</label>
              <input type="text" value={c.hoTen} onChange={(e) => setC({ ...c, hoTen: e.target.value })} /></div>
            <div className="form-field" style={{ marginTop: 10 }}><label className="required">Vai trò</label>
              <select value={c.vaiTro} onChange={(e) => setC({ ...c, vaiTro: e.target.value })}>
                {ROLES.map((r) => <option key={r} value={r}>{VAITRO_LABEL[r]}</option>)}
              </select></div>
          </div>
          <div className="btn-row">
            <button className="btn btn-secondary" onClick={() => setCreateOpen(false)}>Hủy</button>
            <button className="btn btn-success" onClick={create} disabled={busy}><FiCheck /> Tạo</button>
          </div>
        </div>
      </div>

      {/* Modal: Sửa */}
      <div className={`modal-overlay ${editing ? 'show' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setEditing(null); }}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header"><h2><FiEdit2 /> Sửa NV {editing?.email}</h2><button className="modal-close" onClick={() => setEditing(null)}><FiX /></button></div>
          <div className="modal-body">
            <div className="form-field"><label>Họ tên</label>
              <input type="text" value={edit.hoTen} onChange={(e) => setEdit({ ...edit, hoTen: e.target.value })} /></div>
            <div className="form-grid" style={{ marginTop: 10 }}>
              <div className="form-field"><label>Vai trò</label>
                <select value={edit.vaiTro} onChange={(e) => setEdit({ ...edit, vaiTro: e.target.value })}>
                  {ROLES.map((r) => <option key={r} value={r}>{VAITRO_LABEL[r]}</option>)}
                </select></div>
              <div className="form-field"><label>Trạng thái</label>
                <select value={edit.trangThai} onChange={(e) => setEdit({ ...edit, trangThai: e.target.value })}>
                  <option value="HoatDong">Hoạt động</option>
                  <option value="TamKhoa">Tạm khóa</option>
                </select></div>
            </div>
            <div className="form-field" style={{ marginTop: 10 }}><label>Đổi mật khẩu (để trống nếu không đổi)</label>
              <input type="text" value={edit.password} onChange={(e) => setEdit({ ...edit, password: e.target.value })} /></div>
          </div>
          <div className="btn-row">
            <button className="btn btn-secondary" onClick={() => setEditing(null)}>Hủy</button>
            <button className="btn btn-success" onClick={save} disabled={busy}><FiSave /> Lưu</button>
          </div>
        </div>
      </div>
    </>
  );
}
