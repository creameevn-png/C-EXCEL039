'use client';

import { useMemo, useState } from 'react';
import {
  FiAlertTriangle, FiFileText, FiUser, FiX, FiSave, FiSend, FiCheckCircle, FiXCircle, FiSearch
} from 'react-icons/fi';
import { callServer, reload } from '@/lib/client';
import { showToast } from '@/components/Toast';
import { KN_LABEL, KN_CLASS } from '@/lib/status';
import { formatDateTime, formatCurrency } from '@/lib/format';
import type { TrangThaiKN } from '@prisma/client';

type KN = {
  maKN: string; ngayTao: string;
  maDH: string; maKH: string; nguoiTao: string;
  loai: string; moTa: string; anh: string;
  trangThai: string; phuongAn: string;
  soTienHoan: number; ghiChuXuLy: string;
};

const LOAI_LABEL: Record<string, string> = {
  HangLoi: 'Hàng lỗi', ThieuHang: 'Thiếu hàng', GiaoSai: 'Giao sai', KhongNhan: 'Không nhận', Khac: 'Khác'
};

export default function KnClient({ userVaiTro, list }: { userVaiTro: string; list: KN[] }) {
  const [editing, setEditing] = useState<KN | null>(null);
  const [patch, setPatch] = useState({ trangThai: 'DangXuLy', phuongAn: '', soTienHoan: 0, ghiChuXuLy: '' });
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [statusF, setStatusF] = useState('');

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return list.filter((k) => {
      if (statusF && k.trangThai !== statusF) return false;
      if (!s) return true;
      return [k.maKN, k.maDH, k.maKH, k.nguoiTao, k.moTa].some((v) => (v || '').toLowerCase().includes(s));
    });
  }, [list, q, statusF]);

  function open(k: KN) {
    setEditing(k);
    setPatch({
      trangThai: k.trangThai, phuongAn: k.phuongAn || 'HoanTien',
      soTienHoan: k.soTienHoan || 0, ghiChuXuLy: k.ghiChuXuLy || ''
    });
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    const r = await callServer('updateKhieuNai', editing.maKN, patch);
    setBusy(false);
    if (r?.success) { showToast('Đã cập nhật', 'success'); setEditing(null); reload(); }
    else showToast(r?.message || 'Lỗi', 'error');
  }

  async function cap1() {
    if (!editing) return;
    setBusy(true);
    const r = await callServer('duyetKhieuNaiCap1', editing.maKN, patch.ghiChuXuLy);
    setBusy(false);
    if (r?.success) { showToast('Đã duyệt cấp 1 - chờ Admin cấp 2', 'success'); setEditing(null); reload(); }
    else showToast(r?.message || 'Lỗi', 'error');
  }

  async function cap2(accepted: boolean) {
    if (!editing) return;
    setBusy(true);
    const r = await callServer('duyetKhieuNaiCap2', editing.maKN, accepted, patch.ghiChuXuLy);
    setBusy(false);
    if (r?.success) {
      showToast(accepted ? 'Đã duyệt cấp 2 - hoàn tất' : 'Đã từ chối', accepted ? 'success' : 'info');
      setEditing(null); reload();
    } else showToast(r?.message || 'Lỗi', 'error');
  }

  return (
    <>
      <div className="form-section">
        <div className="section-title"><FiAlertTriangle /> Khiếu nại ({filtered.length}/{list.length})</div>

        <div className="form-grid" style={{ marginBottom: 16 }}>
          <div className="form-field">
            <div style={{ position: 'relative' }}>
              <FiSearch style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-faint)' }} />
              <input style={{ paddingLeft: 32 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm mã KN / đơn / KH / mô tả..." />
            </div>
          </div>
          <div className="form-field">
            <select value={statusF} onChange={(e) => setStatusF(e.target.value)}>
              <option value="">Tất cả trạng thái</option>
              {(Object.keys(KN_LABEL) as TrangThaiKN[]).map((k) => <option key={k} value={k}>{KN_LABEL[k]}</option>)}
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state"><FiCheckCircle /><p>Không có khiếu nại khớp.</p></div>
        ) : filtered.map((k) => (
          <div key={k.maKN} className="action-card" style={{ cursor: 'pointer' }} onClick={() => open(k)}>
            <div className="ac-header">
              <div className="ac-title">{k.maKN}</div>
              <span className={`status-badge ${KN_CLASS[k.trangThai as TrangThaiKN]}`}>{KN_LABEL[k.trangThai as TrangThaiKN]}</span>
            </div>
            <div className="ac-meta">
              {formatDateTime(k.ngayTao)} · Loại: <b>{LOAI_LABEL[k.loai] || k.loai}</b>
              {k.maDH && <> · Đơn: <b>{k.maDH}</b></>}
              {k.maKH && <> · KH: <b>{k.maKH}</b></>}
            </div>
            <div className="ac-meta icon-inline" style={{ marginTop: 6, color: '#334155' }}>
              <FiFileText /> {k.moTa.slice(0, 200)}{k.moTa.length > 200 ? '…' : ''}
            </div>
            {k.nguoiTao && <div className="ac-meta icon-inline" style={{ marginTop: 4, fontSize: 11 }}><FiUser /> {k.nguoiTao}</div>}
          </div>
        ))}
      </div>

      <div className={`modal-overlay ${editing ? 'show' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setEditing(null); }}>
        <div className="modal-content" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2><FiAlertTriangle /> Xử lý {editing?.maKN}</h2>
            <button className="modal-close" onClick={() => setEditing(null)}><FiX /></button>
          </div>
          <div className="modal-body">
            {editing && (
              <>
                <div style={{ marginBottom: 10, fontSize: 13 }}>
                  <b>Loại:</b> {LOAI_LABEL[editing.loai]} · <b>Ngày:</b> {formatDateTime(editing.ngayTao)}
                  <br />
                  {editing.maDH && <><b>Đơn:</b> {editing.maDH} · </>}
                  {editing.maKH && <><b>KH:</b> {editing.maKH}</>}
                </div>
                <div className="icon-inline" style={{ background: '#F8FAFC', padding: 10, borderRadius: 6, marginBottom: 10, fontSize: 13 }}>
                  <FiFileText /> {editing.moTa}
                </div>
                {editing.anh && <img src={editing.anh} alt="bằng chứng" style={{ maxWidth: '100%', borderRadius: 6, marginBottom: 10 }} />}
                <div className="form-grid">
                  <div className="form-field">
                    <label>Trạng thái</label>
                    <select value={patch.trangThai} onChange={(e) => setPatch({ ...patch, trangThai: e.target.value })}>
                      {(Object.keys(KN_LABEL) as TrangThaiKN[]).map((k) => <option key={k} value={k}>{KN_LABEL[k]}</option>)}
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Phương án</label>
                    <select value={patch.phuongAn} onChange={(e) => setPatch({ ...patch, phuongAn: e.target.value })}>
                      <option value="HoanTien">Hoàn tiền</option>
                      <option value="DoiTra">Đổi/trả hàng</option>
                      <option value="GiamGia">Giảm giá đơn sau</option>
                      <option value="Khac">Khác</option>
                    </select>
                  </div>
                </div>
                <div className="form-field" style={{ marginTop: 10 }}>
                  <label>Số tiền hoàn (nếu có)</label>
                  <input type="number" value={patch.soTienHoan} onChange={(e) => setPatch({ ...patch, soTienHoan: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="form-field" style={{ marginTop: 10 }}>
                  <label>Ghi chú xử lý / duyệt</label>
                  <textarea rows={3} value={patch.ghiChuXuLy} onChange={(e) => setPatch({ ...patch, ghiChuXuLy: e.target.value })} />
                </div>
              </>
            )}
          </div>
          <div className="btn-row" style={{ flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={() => setEditing(null)}>Đóng</button>
            <button className="btn btn-primary" onClick={save} disabled={busy}><FiSave /> Lưu</button>
            {userVaiTro !== 'Admin' && (
              <button className="btn btn-warning" onClick={cap1} disabled={busy}><FiSend /> Duyệt cấp 1 → Admin</button>
            )}
            {userVaiTro === 'Admin' && editing?.trangThai === 'DangDuyetCap2' && (
              <>
                <button className="btn btn-success" onClick={() => cap2(true)} disabled={busy}><FiCheckCircle /> Duyệt cấp 2</button>
                <button className="btn btn-danger" onClick={() => cap2(false)} disabled={busy}><FiXCircle /> Từ chối</button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
