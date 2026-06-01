'use client';

import { useMemo, useState } from 'react';
import {
  FiPackage, FiHome, FiStar, FiExternalLink, FiInbox, FiSearch,
  FiPlus, FiEdit2, FiTrash2, FiX, FiCheck, FiClock
} from 'react-icons/fi';
import { formatNDT, formatDate } from '@/lib/format';
import { callServer, reload } from '@/lib/client';
import { showToast } from '@/components/Toast';
import Combobox from '@/components/Combobox';

type Nguon = {
  id: number; tenSP: string; danhMuc: string; tenNCC: string; linkTaobao: string;
  giaNDT: number | null; moq: number; thoiGianGiao: string; chatLuong: number; createdAt: string;
};
type Ncc = { id: number; maNCC: string; tenNCC: string; wechat: string; ghiChu: string };

const emptyNguon = { tenSP: '', danhMuc: '', tenNCC: '', linkTaobao: '', giaNDT: '', moq: '1', thoiGianGiao: '', chatLuong: '', ghiChu: '' };
const emptyNcc = { tenNCC: '', wechat: '', ghiChu: '' };

function Stars({ n }: { n: number }) {
  if (!n) return <span>-</span>;
  return (
    <span className="icon-inline" style={{ color: '#f59e0b' }}>
      {Array.from({ length: n }).map((_, i) => <FiStar key={i} fill="#f59e0b" />)}
    </span>
  );
}

export default function MuaHangClient({ nguonHang, ncc }: { nguonHang: Nguon[]; ncc: Ncc[] }) {
  const [q, setQ] = useState('');
  const [danhMuc, setDanhMuc] = useState('');
  const [busy, setBusy] = useState(false);

  // modal nguồn hàng
  const [nOpen, setNOpen] = useState(false);
  const [nEditId, setNEditId] = useState<number | null>(null);
  const [nForm, setNForm] = useState<any>(emptyNguon);

  // modal NCC
  const [cOpen, setCOpen] = useState(false);
  const [cEditId, setCEditId] = useState<number | null>(null);
  const [cForm, setCForm] = useState<any>(emptyNcc);

  const danhMucList = useMemo(
    () => Array.from(new Set(nguonHang.map((n) => n.danhMuc).filter(Boolean))).sort(),
    [nguonHang]
  );

  const filteredNguon = useMemo(() => {
    const s = q.trim().toLowerCase();
    return nguonHang.filter((n) =>
      (!danhMuc || n.danhMuc === danhMuc) &&
      (!s || [n.tenSP, n.tenNCC, n.danhMuc].some((v) => (v || '').toLowerCase().includes(s)))
    );
  }, [nguonHang, q, danhMuc]);

  const filteredNcc = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return ncc;
    return ncc.filter((n) => [n.maNCC, n.tenNCC, n.wechat].some((v) => (v || '').toLowerCase().includes(s)));
  }, [ncc, q]);

  function openAddNguon() { setNEditId(null); setNForm(emptyNguon); setNOpen(true); }
  function openEditNguon(n: Nguon) {
    setNEditId(n.id);
    setNForm({
      tenSP: n.tenSP, danhMuc: n.danhMuc, tenNCC: n.tenNCC, linkTaobao: n.linkTaobao,
      giaNDT: n.giaNDT ?? '', moq: String(n.moq), thoiGianGiao: n.thoiGianGiao,
      chatLuong: n.chatLuong ? String(n.chatLuong) : '', ghiChu: ''
    });
    setNOpen(true);
  }
  async function saveNguon() {
    if (!nForm.tenSP.trim()) return showToast('Nhập tên sản phẩm', 'error');
    setBusy(true);
    const r = nEditId
      ? await callServer('updateNguonHang', nEditId, nForm)
      : await callServer('addNguonHang', nForm);
    setBusy(false);
    if (r?.success) { showToast(nEditId ? 'Đã cập nhật nguồn' : 'Đã thêm nguồn', 'success'); reload(); }
    else showToast(r?.message || 'Lỗi', 'error');
  }
  async function delNguon(n: Nguon) {
    if (!confirm(`Xoá nguồn hàng "${n.tenSP}"?`)) return;
    const r = await callServer('deleteNguonHang', n.id);
    if (r?.success) { showToast('Đã xoá', 'success'); reload(); } else showToast(r?.message || 'Lỗi', 'error');
  }

  function openAddNcc() { setCEditId(null); setCForm(emptyNcc); setCOpen(true); }
  function openEditNcc(n: Ncc) { setCEditId(n.id); setCForm({ tenNCC: n.tenNCC, wechat: n.wechat, ghiChu: n.ghiChu }); setCOpen(true); }
  async function saveNcc() {
    if (!cForm.tenNCC.trim()) return showToast('Nhập tên NCC', 'error');
    setBusy(true);
    const r = cEditId ? await callServer('updateNcc', cEditId, cForm) : await callServer('addNcc', cForm);
    setBusy(false);
    if (r?.success) { showToast(cEditId ? 'Đã cập nhật NCC' : 'Đã thêm NCC', 'success'); reload(); }
    else showToast(r?.message || 'Lỗi', 'error');
  }
  async function delNcc(n: Ncc) {
    if (!confirm(`Xoá NCC "${n.tenNCC}"?`)) return;
    const r = await callServer('deleteNcc', n.id);
    if (r?.success) { showToast('Đã xoá', 'success'); reload(); } else showToast(r?.message || 'Lỗi', 'error');
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="form-field" style={{ flex: '1 1 300px', maxWidth: 380 }}>
          <div style={{ position: 'relative' }}>
            <FiSearch style={{ position: 'absolute', left: 10, top: 9, color: 'var(--text-faint)' }} />
            <input style={{ paddingLeft: 32 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm sản phẩm / NCC / WeChat..." />
          </div>
        </div>
        <div className="form-field" style={{ width: 200 }}>
          <Combobox
            value={danhMuc}
            onChange={setDanhMuc}
            placeholder="Tất cả danh mục"
            options={[{ value: '', label: 'Tất cả danh mục' }, ...danhMucList.map((d) => ({ value: d, label: d }))]}
          />
        </div>
      </div>

      <div className="form-section">
        <div className="flex-between" style={{ marginBottom: 12 }}>
          <div className="section-title" style={{ margin: 0, border: 0, padding: 0 }}><FiPackage /> Nguồn hàng ({filteredNguon.length}/{nguonHang.length})</div>
          <button className="btn btn-sm btn-success" onClick={openAddNguon}><FiPlus /> Thêm nguồn</button>
        </div>
        {filteredNguon.length === 0 ? (
          <div className="empty-state"><FiInbox /><p>Không có nguồn hàng khớp.</p></div>
        ) : (
          <table className="data-table">
            <thead><tr>
              <th>Tên SP</th><th>Danh mục</th><th>NCC</th><th className="number">¥ Giá</th>
              <th className="number">MOQ</th><th>TG giao</th><th>Đánh giá</th><th>Ngày</th><th></th>
            </tr></thead>
            <tbody>
              {filteredNguon.map((n) => (
                <tr key={n.id}>
                  <td>{n.tenSP} {n.linkTaobao && <a href={n.linkTaobao} target="_blank" className="icon-inline" style={{ color: 'var(--primary)' }}><FiExternalLink /></a>}</td>
                  <td>{n.danhMuc || '-'}</td>
                  <td>{n.tenNCC || '-'}</td>
                  <td className="number">{n.giaNDT ? formatNDT(n.giaNDT) : '-'}</td>
                  <td className="number">{n.moq}</td>
                  <td>{n.thoiGianGiao || '-'}</td>
                  <td><Stars n={n.chatLuong || 0} /></td>
                  <td>{formatDate(n.createdAt)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="erp-iconbtn" title="Sửa" onClick={() => openEditNguon(n)}><FiEdit2 /></button>
                      <button className="erp-iconbtn rm" title="Xoá" onClick={() => delNguon(n)}><FiTrash2 /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="form-section">
        <div className="flex-between" style={{ marginBottom: 12 }}>
          <div className="section-title" style={{ margin: 0, border: 0, padding: 0 }}><FiHome /> Nhà cung cấp ({filteredNcc.length}/{ncc.length})</div>
          <button className="btn btn-sm btn-success" onClick={openAddNcc}><FiPlus /> Thêm NCC</button>
        </div>
        {filteredNcc.length === 0 ? (
          <div className="empty-state"><FiInbox /><p>Không có NCC khớp.</p></div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Mã NCC</th><th>Tên</th><th>WeChat</th><th>Ghi chú</th><th></th></tr></thead>
            <tbody>
              {filteredNcc.map((n) => (
                <tr key={n.id}>
                  <td className="ma-don">{n.maNCC || '-'}</td>
                  <td>{n.tenNCC}</td>
                  <td>{n.wechat || '-'}</td>
                  <td>{n.ghiChu || '-'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="erp-iconbtn" title="Sửa" onClick={() => openEditNcc(n)}><FiEdit2 /></button>
                      <button className="erp-iconbtn rm" title="Xoá" onClick={() => delNcc(n)}><FiTrash2 /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal nguồn hàng */}
      <div className={`modal-overlay ${nOpen ? 'show' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setNOpen(false); }}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header"><h2><FiPackage /> {nEditId ? 'Sửa nguồn hàng' : 'Thêm nguồn hàng'}</h2><button className="modal-close" onClick={() => setNOpen(false)}><FiX /></button></div>
          <div className="modal-body">
            <div className="form-field"><label className="required">Tên sản phẩm</label>
              <input value={nForm.tenSP} onChange={(e) => setNForm({ ...nForm, tenSP: e.target.value })} autoFocus /></div>
            <div className="form-grid" style={{ marginTop: 10 }}>
              <div className="form-field"><label>Danh mục / nhóm hàng</label>
                <input list="dm-list" value={nForm.danhMuc} onChange={(e) => setNForm({ ...nForm, danhMuc: e.target.value })} placeholder="VD: Quần áo, Giày dép..." />
                <datalist id="dm-list">{danhMucList.map((d) => <option key={d} value={d} />)}</datalist>
              </div>
              <div className="form-field"><label>Nhà cung cấp</label>
                <input list="ncc-list" value={nForm.tenNCC} onChange={(e) => setNForm({ ...nForm, tenNCC: e.target.value })} />
                <datalist id="ncc-list">{ncc.map((c) => <option key={c.id} value={c.tenNCC} />)}</datalist>
              </div>
            </div>
            <div className="form-field" style={{ marginTop: 10 }}><label>Link Taobao/1688</label>
              <input value={nForm.linkTaobao} onChange={(e) => setNForm({ ...nForm, linkTaobao: e.target.value })} placeholder="https://..." /></div>
            <div className="form-grid-3" style={{ marginTop: 10 }}>
              <div className="form-field"><label>¥ Giá báo</label>
                <input type="number" step="0.01" value={nForm.giaNDT} onChange={(e) => setNForm({ ...nForm, giaNDT: e.target.value })} /></div>
              <div className="form-field"><label>MOQ</label>
                <input type="number" value={nForm.moq} onChange={(e) => setNForm({ ...nForm, moq: e.target.value })} /></div>
              <div className="form-field"><label>Đánh giá (1-5)</label>
                <input type="number" min={0} max={5} value={nForm.chatLuong} onChange={(e) => setNForm({ ...nForm, chatLuong: e.target.value })} /></div>
            </div>
            <div className="form-grid" style={{ marginTop: 10 }}>
              <div className="form-field"><label>Thời gian giao</label>
                <input value={nForm.thoiGianGiao} onChange={(e) => setNForm({ ...nForm, thoiGianGiao: e.target.value })} placeholder="VD: 3-5 ngày" /></div>
              <div className="form-field"><label>Ghi chú đàm phán</label>
                <input value={nForm.ghiChu} onChange={(e) => setNForm({ ...nForm, ghiChu: e.target.value })} placeholder="Giá đã chốt, điều kiện..." /></div>
            </div>
          </div>
          <div className="btn-row">
            <button className="btn btn-secondary" onClick={() => setNOpen(false)}>Hủy</button>
            <button className="btn btn-success" onClick={saveNguon} disabled={busy}>{busy ? <FiClock /> : <><FiCheck /> Lưu</>}</button>
          </div>
        </div>
      </div>

      {/* Modal NCC */}
      <div className={`modal-overlay ${cOpen ? 'show' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setCOpen(false); }}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header"><h2><FiHome /> {cEditId ? 'Sửa NCC' : 'Thêm NCC'}</h2><button className="modal-close" onClick={() => setCOpen(false)}><FiX /></button></div>
          <div className="modal-body">
            <div className="form-field"><label className="required">Tên nhà cung cấp</label>
              <input value={cForm.tenNCC} onChange={(e) => setCForm({ ...cForm, tenNCC: e.target.value })} autoFocus /></div>
            <div className="form-field" style={{ marginTop: 10 }}><label>WeChat / liên hệ</label>
              <input value={cForm.wechat} onChange={(e) => setCForm({ ...cForm, wechat: e.target.value })} /></div>
            <div className="form-field" style={{ marginTop: 10 }}><label>Ghi chú</label>
              <input value={cForm.ghiChu} onChange={(e) => setCForm({ ...cForm, ghiChu: e.target.value })} /></div>
          </div>
          <div className="btn-row">
            <button className="btn btn-secondary" onClick={() => setCOpen(false)}>Hủy</button>
            <button className="btn btn-success" onClick={saveNcc} disabled={busy}>{busy ? <FiClock /> : <><FiCheck /> Lưu</>}</button>
          </div>
        </div>
      </div>
    </>
  );
}
