'use client';

import { useMemo, useState } from 'react';
import {
  FiBox, FiSearch, FiPlus, FiEdit2, FiTrash2, FiX, FiSave, FiCheck, FiExternalLink, FiInbox
} from 'react-icons/fi';
import { callServer, reload } from '@/lib/client';
import { showToast } from '@/components/Toast';
import { formatCurrency } from '@/lib/format';

type SP = {
  maSP: string; tenSP: string; danhMuc: string; webNguon: string;
  kgGoiY: number; m3GoiY: number; giaThamKhao: number; linkTaobao: string; ghiChu: string;
};

const EMPTY = { tenSP: '', danhMuc: '', webNguon: '', kg: 0, m3: 0, gia: 0, linkTaobao: '', ghiChu: '' };

export default function SanPhamClient({ list, canDelete }: { list: SP[]; canDelete: boolean }) {
  const [q, setQ] = useState('');
  const [webF, setWebF] = useState('');
  const [busy, setBusy] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [editMaSP, setEditMaSP] = useState<string | null>(null);

  const webs = useMemo(() => Array.from(new Set(list.map((p) => p.webNguon).filter(Boolean))), [list]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return list.filter((p) => {
      if (webF && p.webNguon !== webF) return false;
      if (!s) return true;
      return [p.maSP, p.tenSP, p.danhMuc].some((v) => (v || '').toLowerCase().includes(s));
    });
  }, [list, q, webF]);

  function openCreate() { setEditMaSP(null); setForm({ ...EMPTY }); setCreateOpen(true); }
  function openEdit(p: SP) {
    setEditMaSP(p.maSP);
    setForm({ tenSP: p.tenSP, danhMuc: p.danhMuc, webNguon: p.webNguon, kg: p.kgGoiY, m3: p.m3GoiY, gia: p.giaThamKhao, linkTaobao: p.linkTaobao, ghiChu: p.ghiChu });
    setCreateOpen(true);
  }

  async function submit() {
    if (!form.tenSP.trim()) return showToast('Vui lòng nhập tên SP', 'error');
    setBusy(true);
    const r = editMaSP
      ? await callServer('updateSanPham', editMaSP, form)
      : await callServer('addProduct', form);
    setBusy(false);
    if (r?.success) { showToast(editMaSP ? 'Đã cập nhật SP' : 'Đã thêm SP', 'success'); setCreateOpen(false); reload(); }
    else showToast(r?.message || 'Lỗi', 'error');
  }

  async function del(p: SP) {
    if (!confirm(`Xóa sản phẩm ${p.maSP} - ${p.tenSP}?`)) return;
    const r = await callServer('deleteSanPham', p.maSP);
    if (r?.success) { showToast('Đã xóa SP', 'success'); reload(); }
    else showToast(r?.message || 'Lỗi', 'error');
  }

  return (
    <div className="form-section">
      <div className="section-title" style={{ justifyContent: 'space-between' }}>
        <span className="icon-inline"><FiBox /> Sản phẩm ({filtered.length}/{list.length})</span>
        <button className="btn btn-success btn-sm" onClick={openCreate}><FiPlus /> Thêm SP</button>
      </div>

      <div className="form-grid" style={{ marginBottom: 16 }}>
        <div className="form-field">
          <div style={{ position: 'relative' }}>
            <FiSearch style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-faint)' }} />
            <input style={{ paddingLeft: 32 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm mã SP / tên / danh mục..." />
          </div>
        </div>
        <div className="form-field">
          <select value={webF} onChange={(e) => setWebF(e.target.value)}>
            <option value="">Tất cả nguồn</option>
            {webs.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state"><FiInbox /><p>Không có sản phẩm khớp.</p></div>
      ) : (
        <table className="data-table">
          <thead><tr>
            <th>Mã SP</th><th>Tên SP</th><th>Danh mục</th><th>Web</th>
            <th className="number">Kg gợi ý</th><th className="number">m³ gợi ý</th><th className="number">Giá tham khảo</th>
            <th>Thao tác</th>
          </tr></thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.maSP}>
                <td className="ma-don">{p.maSP}</td>
                <td>{p.tenSP}{p.linkTaobao && <a href={p.linkTaobao} target="_blank" className="icon-inline" style={{ marginLeft: 6, color: 'var(--primary)' }}><FiExternalLink /></a>}</td>
                <td>{p.danhMuc || '-'}</td>
                <td>{p.webNguon || '-'}</td>
                <td className="number">{p.kgGoiY}</td>
                <td className="number">{p.m3GoiY}</td>
                <td className="number">{formatCurrency(p.giaThamKhao)}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-primary btn-sm" onClick={() => openEdit(p)}><FiEdit2 /></button>
                    {canDelete && <button className="btn btn-danger btn-sm" onClick={() => del(p)}><FiTrash2 /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className={`modal-overlay ${createOpen ? 'show' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setCreateOpen(false); }}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>{editMaSP ? <><FiEdit2 /> Sửa SP {editMaSP}</> : <><FiPlus /> Thêm sản phẩm</>}</h2>
            <button className="modal-close" onClick={() => setCreateOpen(false)}><FiX /></button>
          </div>
          <div className="modal-body">
            <div className="form-field"><label className="required">Tên sản phẩm</label>
              <input value={form.tenSP} onChange={(e) => setForm({ ...form, tenSP: e.target.value })} autoFocus /></div>
            <div className="form-grid" style={{ marginTop: 10 }}>
              <div className="form-field"><label>Danh mục</label>
                <input value={form.danhMuc} onChange={(e) => setForm({ ...form, danhMuc: e.target.value })} /></div>
              <div className="form-field"><label>Web nguồn</label>
                <select value={form.webNguon} onChange={(e) => setForm({ ...form, webNguon: e.target.value })}>
                  <option value="">--</option><option value="Taobao">Taobao</option>
                  <option value="1688">1688</option><option value="Tmall">Tmall</option>
                </select></div>
            </div>
            <div className="form-grid-3" style={{ marginTop: 10 }}>
              <div className="form-field"><label>Kg gợi ý</label>
                <input type="number" step="0.01" value={form.kg} onChange={(e) => setForm({ ...form, kg: parseFloat(e.target.value) || 0 })} /></div>
              <div className="form-field"><label>m³ gợi ý</label>
                <input type="number" step="0.0001" value={form.m3} onChange={(e) => setForm({ ...form, m3: parseFloat(e.target.value) || 0 })} /></div>
              <div className="form-field"><label>Giá tham khảo (VNĐ)</label>
                <input type="number" step="10000" value={form.gia} onChange={(e) => setForm({ ...form, gia: parseFloat(e.target.value) || 0 })} /></div>
            </div>
            <div className="form-field" style={{ marginTop: 10 }}><label>Link Taobao/1688</label>
              <input value={form.linkTaobao} onChange={(e) => setForm({ ...form, linkTaobao: e.target.value })} placeholder="https://..." /></div>
            <div className="form-field" style={{ marginTop: 10 }}><label>Ghi chú</label>
              <input value={form.ghiChu} onChange={(e) => setForm({ ...form, ghiChu: e.target.value })} /></div>
          </div>
          <div className="btn-row">
            <button className="btn btn-secondary" onClick={() => setCreateOpen(false)}>Hủy</button>
            <button className="btn btn-success" onClick={submit} disabled={busy}>
              {editMaSP ? <><FiSave /> Lưu</> : <><FiCheck /> Thêm</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
