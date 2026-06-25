'use client';

import { useState } from 'react';
import { FiGlobe, FiPlus, FiSave, FiTrash2, FiInfo, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import { callServer, reload } from '@/lib/client';
import { showToast } from '@/components/Toast';
import { fmtVND, formatDate } from '@/lib/format';

type Row = { web: string; tyGia: number; phiMuaPct: number; phiMuaMin: number; ghiChu: string; hoatDong: boolean; updatedAt: string };

const WEB_GOIY = ['1688', 'taobao', 'tmall', 'alibaba', 'pinduoduo'];
const blank = { web: '', tyGia: 3650, phiMuaPct: 0, phiMuaMin: 0, ghiChu: '', hoatDong: true };

export default function BangGiaWebClient({ rows }: { rows: Row[] }) {
  const [form, setForm] = useState<Row>(blank as Row);
  const [busy, setBusy] = useState(false);

  function edit(r: Row) { setForm({ ...r }); window.scrollTo({ top: 0, behavior: 'smooth' }); }

  async function save() {
    if (!form.web.trim()) return showToast('Nhập tên web', 'error');
    setBusy(true);
    const r = await callServer('upsertBangGiaWeb', form);
    setBusy(false);
    if (r?.success) { showToast('Đã lưu bảng giá ' + form.web, 'success'); reload(); }
    else showToast(r?.message || 'Lỗi', 'error');
  }

  async function del(web: string) {
    if (!confirm(`Xoá bảng giá web "${web}"?`)) return;
    const r = await callServer('deleteBangGiaWeb', web);
    if (r?.success) { showToast('Đã xoá', 'success'); reload(); }
    else showToast(r?.message || 'Lỗi', 'error');
  }

  return (
    <>
      <div className="alert alert-info">
        <FiInfo /><span>Tỷ giá + % phí mua hàng theo từng <b>website nguồn</b>. CSKH/Mua hàng dùng để báo giá nhất quán cho khách.</span>
      </div>

      <div className="form-section">
        <div className="section-title"><FiPlus /> Thêm / sửa bảng giá theo web</div>
        <div className="form-grid">
          <div className="form-field">
            <label>Website nguồn</label>
            <input list="weblist" value={form.web} onChange={(e) => setForm({ ...form, web: e.target.value })} placeholder="1688 / taobao / tmall…" />
            <datalist id="weblist">{WEB_GOIY.map((w) => <option key={w} value={w} />)}</datalist>
          </div>
          <div className="form-field">
            <label>Tỷ giá (1 tệ = ? đ)</label>
            <input type="number" value={form.tyGia} onChange={(e) => setForm({ ...form, tyGia: parseFloat(e.target.value) || 0 })} />
          </div>
          <div className="form-field">
            <label>% phí mua hàng</label>
            <input type="number" value={form.phiMuaPct} onChange={(e) => setForm({ ...form, phiMuaPct: parseFloat(e.target.value) || 0 })} />
          </div>
          <div className="form-field">
            <label>Phí mua tối thiểu (đ)</label>
            <input type="number" value={form.phiMuaMin} onChange={(e) => setForm({ ...form, phiMuaMin: parseFloat(e.target.value) || 0 })} />
          </div>
        </div>
        <div className="form-grid" style={{ marginTop: 10 }}>
          <div className="form-field" style={{ gridColumn: '1 / -2' }}>
            <label>Ghi chú</label>
            <input value={form.ghiChu} onChange={(e) => setForm({ ...form, ghiChu: e.target.value })} placeholder="vd: Tmall hàng chính hãng, phí cao hơn" />
          </div>
          <div className="form-field">
            <label className="icon-inline" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={form.hoatDong} onChange={(e) => setForm({ ...form, hoatDong: e.target.checked })} style={{ width: 'auto', marginRight: 6 }} />
              Đang áp dụng
            </label>
          </div>
        </div>
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button className="btn btn-secondary" onClick={() => setForm(blank as Row)}>Làm mới</button>
          <button className="btn btn-primary" onClick={save} disabled={busy}><FiSave /> Lưu</button>
        </div>
      </div>

      <div className="form-section">
        <div className="section-title"><FiGlobe /> Bảng giá theo web ({rows.length})</div>
        {rows.length === 0 ? <p className="muted">Chưa có web nào.</p> : (
          <table className="data-table">
            <thead><tr>
              <th>Web</th><th className="number">Tỷ giá</th><th className="number">% phí mua</th>
              <th className="number">Phí tối thiểu</th><th>Ghi chú</th><th>Áp dụng</th><th>Cập nhật</th><th></th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.web} style={{ cursor: 'pointer' }} onClick={() => edit(r)}>
                  <td><b>{r.web}</b></td>
                  <td className="number">{fmtVND(r.tyGia)}</td>
                  <td className="number">{r.phiMuaPct}%</td>
                  <td className="number">{fmtVND(r.phiMuaMin)}đ</td>
                  <td style={{ fontSize: 12 }}>{r.ghiChu}</td>
                  <td>{r.hoatDong ? <FiCheckCircle style={{ color: 'var(--success)' }} /> : <FiXCircle style={{ color: 'var(--danger-dark)' }} />}</td>
                  <td style={{ fontSize: 11 }}>{formatDate(r.updatedAt)}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button className="btn btn-danger btn-sm" onClick={() => del(r.web)}><FiTrash2 /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
