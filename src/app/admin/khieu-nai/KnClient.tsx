'use client';

import { useMemo, useState } from 'react';
import {
  FiAlertTriangle, FiFileText, FiUser, FiX, FiSave, FiSend, FiCheckCircle, FiXCircle, FiSearch, FiRotateCcw
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
  soTienHoan: number;
  phiDoiTra: number; hoanVi: boolean; daHoanVi: boolean; quyChiuPhi: string;
  doiTacNCC: string; daTruNCC: boolean;
  ghiChuXuLy: string;
  // Luồng khách gửi trả hàng về kho VN.
  maVDTraHang: string; chuyenKhoVN: boolean;
  daNhanHangKN: boolean; ngayNhanKN: string; nguoiNhanKN: string;
};

const LOAI_LABEL: Record<string, string> = {
  HangLoi: 'Hàng lỗi', ThieuHang: 'Thiếu hàng', GiaoSai: 'Giao sai', KhongNhan: 'Không nhận', Khac: 'Khác'
};

const QUY_LABEL: Record<string, string> = {
  QuyKho: 'Quỹ kho (shop tự chịu)', NCC: 'NCC chịu', VanChuyen: 'Đơn vị VC chịu', KhachHang: 'Khách hàng chịu'
};

export default function KnClient({ userVaiTro, list }: { userVaiTro: string; list: KN[] }) {
  const [editing, setEditing] = useState<KN | null>(null);
  const [patch, setPatch] = useState({ trangThai: 'DangXuLy', phuongAn: '', soTienHoan: 0, phiDoiTra: 0, hoanVi: false, quyChiuPhi: 'QuyKho', doiTacNCC: '', ghiChuXuLy: '' });
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [statusF, setStatusF] = useState('');
  const [maVDTra, setMaVDTra] = useState('');

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
    setMaVDTra(k.maVDTraHang || '');
    setPatch({
      trangThai: k.trangThai, phuongAn: k.phuongAn || 'HoanTien',
      soTienHoan: k.soTienHoan || 0, phiDoiTra: k.phiDoiTra || 0,
      hoanVi: !!k.hoanVi, quyChiuPhi: k.quyChiuPhi || 'QuyKho',
      doiTacNCC: k.doiTacNCC || '',
      ghiChuXuLy: k.ghiChuXuLy || ''
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

  async function chuyenVeKhoVN() {
    if (!editing) return;
    const maVD = maVDTra.trim();
    if (!maVD) return showToast('Nhập mã vận đơn khách gửi trả', 'error');
    setBusy(true);
    const r = await callServer('chuyenKNVeKhoVN', editing.maKN, maVD);
    setBusy(false);
    if (r?.success) { showToast(`Đã báo kho VN nhận hàng theo mã ${maVD}`, 'success'); setEditing(null); reload(); }
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
      let msg = accepted ? 'Đã duyệt cấp 2 - hoàn tất' : 'Đã từ chối';
      if (accepted) {
        const parts: string[] = [];
        if (r.hoanVi > 0) parts.push(`hoàn ${formatCurrency(r.hoanVi)}đ vào ví KH`);
        if (r.truNCC > 0) parts.push(`cấn trừ ${formatCurrency(r.truNCC)}đ công nợ NCC`);
        if (parts.length) msg = 'Đã duyệt + ' + parts.join(' + ');
      }
      showToast(msg, accepted ? 'success' : 'info');
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
              {k.maDH && <> · Đơn: <b style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--primary)' }} onClick={(e) => { e.stopPropagation(); (window as any).openOrderDetail?.(k.maDH); }}>{k.maDH}</b></>}
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
                  {editing.maDH && <><b>Đơn:</b> <span style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--primary)' }} onClick={() => (window as any).openOrderDetail?.(editing.maDH)}>{editing.maDH}</span> · </>}
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
                <div className="form-grid" style={{ marginTop: 10 }}>
                  <div className="form-field">
                    <label>Số tiền hoàn KH (nếu có)</label>
                    <input type="number" value={patch.soTienHoan} onChange={(e) => setPatch({ ...patch, soTienHoan: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div className="form-field">
                    <label>Phí đổi/trả (ship đổi-trả)</label>
                    <input type="number" value={patch.phiDoiTra} onChange={(e) => setPatch({ ...patch, phiDoiTra: parseFloat(e.target.value) || 0 })} />
                  </div>
                </div>
                <div className="form-grid" style={{ marginTop: 10 }}>
                  <div className="form-field">
                    <label>Quỹ chịu chi phí khiếu nại</label>
                    <select value={patch.quyChiuPhi} onChange={(e) => setPatch({ ...patch, quyChiuPhi: e.target.value })}>
                      {Object.keys(QUY_LABEL).map((k) => <option key={k} value={k}>{QUY_LABEL[k]}</option>)}
                    </select>
                    {patch.quyChiuPhi === 'NCC' && (
                      <>
                        <input style={{ marginTop: 6 }} value={patch.doiTacNCC} onChange={(e) => setPatch({ ...patch, doiTacNCC: e.target.value })} placeholder="Tên NCC/shop chịu (để cấn trừ công nợ)" />
                        <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                          → Khi duyệt sẽ tự cấn trừ <b>{formatCurrency((patch.soTienHoan || 0) + (patch.phiDoiTra || 0))}đ</b> vào công nợ NCC «{patch.doiTacNCC || '…'}».
                        </div>
                        {editing.daTruNCC && <div style={{ fontSize: 11, marginTop: 4, color: 'var(--success-dark)' }}>✓ Đã cấn trừ công nợ NCC.</div>}
                      </>
                    )}
                  </div>
                  <div className="form-field">
                    <label className="icon-inline" style={{ cursor: 'pointer' }}>
                      <input type="checkbox" checked={patch.hoanVi} onChange={(e) => setPatch({ ...patch, hoanVi: e.target.checked })} style={{ width: 'auto', marginRight: 6 }} />
                      Hoàn tiền vào ví KH khi duyệt
                    </label>
                    {patch.hoanVi && patch.soTienHoan > 0 && (
                      <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                        → Khi Admin duyệt cấp 2, hệ thống tự nạp <b>{formatCurrency(patch.soTienHoan)}đ</b> vào ví KH (quỹ {QUY_LABEL[patch.quyChiuPhi] || patch.quyChiuPhi}).
                      </div>
                    )}
                    {editing.daHoanVi && <div style={{ fontSize: 11, marginTop: 4, color: 'var(--success-dark)' }}>✓ Đã hoàn vào ví.</div>}
                  </div>
                </div>
                {/* Khách gửi trả hàng về kho VN: CSKH ghi mã vận đơn rồi báo kho nhận. */}
                <div style={{ marginTop: 12, padding: 10, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                    <FiRotateCcw /> Hàng khách gửi trả về kho VN
                  </div>
                  {editing.daNhanHangKN ? (
                    <div style={{ fontSize: 12, color: 'var(--success-dark)' }}>
                      ✓ Kho VN đã nhận hàng (mã VĐ <b>{editing.maVDTraHang}</b>
                      {editing.nguoiNhanKN ? ` · ${editing.nguoiNhanKN}` : ''}
                      {editing.ngayNhanKN ? ` · ${formatDateTime(editing.ngayNhanKN)}` : ''})
                    </div>
                  ) : editing.chuyenKhoVN ? (
                    <div style={{ fontSize: 12, color: '#92400E' }}>
                      Đã báo kho VN — chờ nhận hàng theo mã VĐ <b>{editing.maVDTraHang}</b>.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                      <div className="form-field" style={{ flex: 1, margin: 0 }}>
                        <label>Mã vận đơn khách gửi trả</label>
                        <input value={maVDTra} onChange={(e) => setMaVDTra(e.target.value)} placeholder="VD: VD26071234" />
                      </div>
                      <button className="btn btn-warning" disabled={busy} onClick={chuyenVeKhoVN}>
                        <FiRotateCcw /> Chuyển về kho VN
                      </button>
                    </div>
                  )}
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
