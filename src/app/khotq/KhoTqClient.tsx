'use client';

import { useState } from 'react';
import {
  FiInfo, FiClock, FiPackage, FiTruck, FiCheckCircle, FiDownload, FiCheck, FiLock,
  FiAlertTriangle, FiPlus, FiLink, FiTrash2, FiHelpCircle, FiBox, FiSend, FiTarget,
  FiEdit2, FiX, FiSave, FiUser, FiUsers, FiDollarSign
} from 'react-icons/fi';
import type { SessionUser } from '@/lib/auth';
import AppShell from '@/components/AppShell';
import Tabs from '@/components/Tabs';
import OrderDetailModalHost from '@/components/OrderDetailModal';
import ImageUploadModalHost from '@/components/ImageUploadModal';
import { showToast } from '@/components/Toast';
import { callServer, reload } from '@/lib/client';
import { fmtVND } from '@/lib/format';

type Line = { stt: number; tenSP: string; soLuong: number; kiemKe: string; kiemKeNote: string };
type Row = {
  maDH: string; maVD: string; tenHang: string;
  kg: number; m3: number; web: string; tuyen: string;
  kiemDem: boolean; dongGo: boolean;
  nguoiLamTQ: string; nguoiPhuTrachTQ: string; maBao: string; lines: Line[];
};
type VoChu = {
  id: number; maVD: string; kg: number; dai: number; rong: number; cao: number; m3: number;
  ghiChu: string; nguoiNhap: string; createdAt: string;
};
type Bao = {
  maBao: string; line: string; trangThai: string;
  tongKg: number; tongM3: number; soKien: number; orders: string[];
};
type NhanVien = { id: number; hoTen: string };
type Quy = {
  id: number; ngay: string; loai: string; soTien: number;
  danhMuc: string; noiDung: string; maDH: string; nguoiTao: string;
};
// Góp ý NV #25/#33: kho TQ tự nhập cân & kích thước từng dòng hàng.
type WeighLine = { stt: number; tenSP: string; soLuong: number; kg: string; dai: string; rong: string; cao: string; m3: string };
const QUY_DANH_MUC = ['Thu hộ khách', 'Chi ship nội địa TQ', 'Chi đóng gói', 'Chi khác'];
const LINE_LABEL: Record<string, string> = { LineNhanh: 'Nhanh', LineThuong: 'Thường', LineRe: 'Tiết kiệm' };

// Góp ý NV #35: bắn (quét) mã vận đơn để tìm nhanh đơn trong danh sách kho.
function filterByScan(rows: Row[], q: string) {
  const k = q.trim().toLowerCase();
  if (!k) return rows;
  return rows.filter((o) =>
    o.maVD.toLowerCase().includes(k) || o.maDH.toLowerCase().includes(k) ||
    o.maBao.toLowerCase().includes(k) || o.tenHang.toLowerCase().includes(k));
}

export default function KhoTqClient({ user, pendingArrivals, atWarehouse, voChu, baos, nhanViens, soQuy }:
  { user: SessionUser; pendingArrivals: Row[]; atWarehouse: Row[]; voChu: VoChu[]; baos: Bao[];
    nhanViens: NhanVien[]; soQuy: Quy[] }) {

  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [keNote, setKeNote] = useState<Record<string, string>>({});
  // Ô bắn mã vận đơn — lọc nhanh (góp ý #35).
  const [scan, setScan] = useState('');

  function confirmKhoTQ(maDH: string) {
    (window as any).openImageUploadModal?.('Xác nhận nhận hàng tại Kho TQ', maDH, async (img: string | null) => {
      const r = await callServer('confirmKhoTQ', maDH, img);
      if (r?.success) { showToast(img ? 'Đã xác nhận + lưu ảnh' : 'Đã xác nhận', 'success'); reload(); }
      else showToast(r?.message || 'Lỗi', 'error');
    });
  }

  function markLeftTQ(maDH: string) {
    (window as any).openImageUploadModal?.('Đánh dấu hàng rời TQ', maDH, async (img: string | null) => {
      const r = await callServer('markLeftTQ', maDH, img);
      if (r?.success) { showToast(img ? 'Hàng đã rời TQ + lưu ảnh' : 'Hàng đã rời TQ', 'success'); reload(); }
      else showToast(r?.message || 'Lỗi', 'error');
    });
  }

  async function markKiemKe(maDH: string, stt: number, trangThai: 'Đủ' | 'Thiếu') {
    const key = `${maDH}-${stt}`;
    const note = keNote[key] ?? '';
    setBusy((p) => ({ ...p, [key]: true }));
    const r = await callServer('markKiemKe', maDH, stt, { trangThai, note });
    setBusy((p) => ({ ...p, [key]: false }));
    if (r?.success) { showToast(`Đã đánh dấu link ${stt}: ${trangThai}`, 'success'); reload(); }
    else showToast(r?.message || 'Lỗi', 'error');
  }

  // ===== Nhập cân & kích thước (góp ý #25/#33) =====
  const [weighMaDH, setWeighMaDH] = useState<string | null>(null);
  const [weighLines, setWeighLines] = useState<WeighLine[]>([]);
  const [weighBusy, setWeighBusy] = useState<Record<number, boolean>>({});

  async function openWeigh(maDH: string) {
    setWeighMaDH(maDH); setWeighLines([]); setWeighBusy({});
    const r = await callServer('getOrderDetail', maDH);
    if (r?.success) {
      // Server chưa trả dài/rộng/cao → để trống cho kho TQ nhập mới.
      setWeighLines(r.data.chiTiet.map((c: any) => ({
        stt: c.stt, tenSP: c.tenSP, soLuong: c.soLuong,
        kg: String(c.kg ?? ''), dai: '', rong: '', cao: '', m3: String(c.m3 ?? '')
      })));
    } else { showToast(r?.message || 'Lỗi tải đơn', 'error'); setWeighMaDH(null); }
  }
  function patchWeigh(stt: number, p: Partial<WeighLine>) {
    setWeighLines((ls) => ls.map((l) => (l.stt === stt ? { ...l, ...p } : l)));
  }
  async function saveWeighLine(l: WeighLine) {
    if (!weighMaDH) return;
    const kg = parseFloat(l.kg) || 0;
    const dai = parseFloat(l.dai) || 0, rong = parseFloat(l.rong) || 0, cao = parseFloat(l.cao) || 0;
    const hasKT = dai > 0 && rong > 0 && cao > 0;
    const payload = hasKT ? { kg, dai, rong, cao } : { kg, m3: parseFloat(l.m3) || 0 };
    setWeighBusy((p) => ({ ...p, [l.stt]: true }));
    const r = await callServer('updateChiTietKg', weighMaDH, l.stt, payload);
    setWeighBusy((p) => ({ ...p, [l.stt]: false }));
    if (r?.success) {
      // m³ do server tính lại (từ kích thước nếu có) — cập nhật ngược lên ô m³.
      if (r.m3 !== undefined) patchWeigh(l.stt, { m3: String(r.m3) });
      showToast(`Đã lưu dòng ${l.stt} (kg / m³)`, 'success');
    } else showToast(r?.message || 'Lỗi', 'error');
  }

  // ===== Người làm / phụ trách kho TQ (góp ý #32) =====
  async function saveNguoiTQ(maDH: string, patch: { nguoiLam?: string; nguoiPhuTrach?: string }) {
    const r = await callServer('setNguoiKhoTQ', maDH, patch);
    if (r?.success) { showToast('Đã lưu người phụ trách kho TQ', 'success'); reload(); }
    else showToast(r?.message || 'Lỗi', 'error');
  }
  function nguoiSelect(maDH: string, current: string, field: 'nguoiLam' | 'nguoiPhuTrach') {
    const names = nhanViens.map((nv) => nv.hoTen);
    const opts = current && !names.includes(current) ? [current, ...names] : names;
    return (
      <select value={current} onChange={(e) => saveNguoiTQ(maDH,
        field === 'nguoiLam' ? { nguoiLam: e.target.value } : { nguoiPhuTrach: e.target.value })}>
        <option value="">-- Chưa chọn --</option>
        {opts.map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
    );
  }
  function nguoiTQ(o: Row) {
    return (
      <div className="form-grid" style={{ marginTop: 8 }}>
        <div className="form-field"><label><FiUser /> Người làm</label>{nguoiSelect(o.maDH, o.nguoiLamTQ, 'nguoiLam')}</div>
        <div className="form-field"><label><FiUsers /> Người phụ trách</label>{nguoiSelect(o.maDH, o.nguoiPhuTrachTQ, 'nguoiPhuTrach')}</div>
      </div>
    );
  }

  // ===== Quỹ kho TQ (góp ý #43) =====
  const [quyForm, setQuyForm] = useState({ loai: 'Thu', soTien: '', danhMuc: '', noiDung: '', maDH: '' });
  const tongThu = soQuy.filter((q) => q.loai === 'Thu').reduce((s, q) => s + q.soTien, 0);
  const tongChi = soQuy.filter((q) => q.loai === 'Chi').reduce((s, q) => s + q.soTien, 0);
  const tonQuy = tongThu - tongChi;

  async function addQuy() {
    const soTien = parseFloat(quyForm.soTien) || 0;
    if (soTien <= 0) return showToast('Số tiền phải lớn hơn 0', 'error');
    if (!quyForm.noiDung.trim()) return showToast('Nhập nội dung thu / chi', 'error');
    setBusy((p) => ({ ...p, quy: true }));
    const r = await callServer('addSoQuy', {
      quy: 'KhoTQ', loai: quyForm.loai, soTien, noiDung: quyForm.noiDung,
      danhMuc: quyForm.danhMuc || undefined, maDH: quyForm.maDH.trim() || undefined
    });
    setBusy((p) => ({ ...p, quy: false }));
    if (r?.success) { showToast('Đã ghi bút toán quỹ kho TQ', 'success'); reload(); }
    else showToast(r?.message || 'Lỗi', 'error');
  }

  // ===== Hàng vô chủ =====
  const [vc, setVc] = useState({ maVD: '', kg: '', dai: '', rong: '', cao: '', ghiChu: '' });
  const [matchInput, setMatchInput] = useState<Record<number, string>>({});

  async function addVoChu() {
    if (!vc.maVD.trim()) return showToast('Nhập mã vận đơn', 'error');
    setBusy((p) => ({ ...p, voChu: true }));
    const r = await callServer('addHangVoChu', {
      maVD: vc.maVD, kg: parseFloat(vc.kg) || 0,
      dai: parseFloat(vc.dai) || 0, rong: parseFloat(vc.rong) || 0, cao: parseFloat(vc.cao) || 0,
      ghiChu: vc.ghiChu
    });
    setBusy((p) => ({ ...p, voChu: false }));
    if (r?.success) { showToast('Đã thêm hàng vô chủ', 'success'); reload(); }
    else showToast(r?.message || 'Lỗi', 'error');
  }

  async function matchVoChu(id: number) {
    const maDH = (matchInput[id] || '').trim();
    if (!maDH) return showToast('Nhập mã đơn để gán', 'error');
    setBusy((p) => ({ ...p, [`vc${id}`]: true }));
    const r = await callServer('matchHangVoChu', id, maDH);
    setBusy((p) => ({ ...p, [`vc${id}`]: false }));
    if (r?.success) { showToast(`Đã gán mã VĐ vào đơn ${maDH}`, 'success'); reload(); }
    else showToast(r?.message || 'Lỗi', 'error');
  }

  async function deleteVoChu(id: number) {
    if (!confirm('Xoá kiện hàng vô chủ này?')) return;
    const r = await callServer('deleteHangVoChu', id);
    if (r?.success) { showToast('Đã xoá', 'success'); reload(); }
    else showToast(r?.message || 'Lỗi', 'error');
  }

  // ===== Bao tổng =====
  const [baoLine, setBaoLine] = useState('LineThuong');
  const [baoGhiChu, setBaoGhiChu] = useState('');
  const [addBaoInput, setAddBaoInput] = useState<Record<string, string>>({});

  async function createBao() {
    setBusy((p) => ({ ...p, bao: true }));
    const r = await callServer('createBaoTong', { line: baoLine, ghiChu: baoGhiChu });
    setBusy((p) => ({ ...p, bao: false }));
    if (r?.success) { showToast(`Đã tạo bao ${r.maBao}`, 'success'); reload(); }
    else showToast(r?.message || 'Lỗi', 'error');
  }
  async function addToBao(maBao: string) {
    const maDH = (addBaoInput[maBao] || '').trim();
    if (!maDH) return showToast('Nhập/quét mã đơn để gán', 'error');
    const r = await callServer('addOrderToBao', maBao, maDH);
    if (r?.success) { showToast(`Đã gán ${maDH} vào ${maBao}`, 'success'); reload(); }
    else showToast(r?.message || 'Lỗi', 'error');
  }
  async function xuatBao(maBao: string) {
    if (!confirm(`Xuất bao ${maBao} về VN? Tất cả đơn trong bao sẽ chuyển sang "Đang vận chuyển".`)) return;
    const r = await callServer('xuatBao', maBao);
    if (r?.success) { showToast(`Đã xuất ${maBao} (${r.soDon} đơn)`, 'success'); reload(); }
    else showToast(r?.message || 'Lỗi', 'error');
  }

  function serviceBadges(o: Row) {
    if (!o.kiemDem && !o.dongGo) return null;
    return (
      <div style={{ display: 'flex', gap: 6, margin: '6px 0' }}>
        {o.kiemDem && <span className="status-badge" style={{ background: '#FEF3C7', color: '#92400E' }}><FiAlertTriangle /> Cần KIỂM ĐẾM</span>}
        {o.dongGo && <span className="status-badge" style={{ background: '#DBEAFE', color: '#1E40AF' }}><FiPackage /> Đóng gỗ</span>}
      </div>
    );
  }

  function kiemKe(o: Row) {
    if (!o.kiemDem) return null;
    return (
      <div style={{ marginTop: 8, padding: 10, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}><FiAlertTriangle /> Kiểm đếm từng link (đủ/thiếu)</div>
        <table className="data-table" style={{ fontSize: 12 }}>
          <thead><tr><th>#</th><th>Sản phẩm</th><th>SL</th><th>Ghi chú thiếu</th><th>Đánh dấu</th></tr></thead>
          <tbody>
            {o.lines.map((l) => {
              const key = `${o.maDH}-${l.stt}`;
              return (
                <tr key={l.stt}>
                  <td>{l.stt}</td>
                  <td>{l.tenSP}</td>
                  <td>{l.soLuong}</td>
                  <td>
                    <input style={{ width: '100%', fontSize: 12 }} placeholder="thiếu gì..."
                      defaultValue={l.kiemKeNote}
                      onChange={(e) => setKeNote((p) => ({ ...p, [key]: e.target.value }))} />
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn btn-success btn-sm" disabled={busy[key]} onClick={() => markKiemKe(o.maDH, l.stt, 'Đủ')}>Đủ</button>{' '}
                    <button className="btn btn-warning btn-sm" disabled={busy[key]} onClick={() => markKiemKe(o.maDH, l.stt, 'Thiếu')}>Thiếu</button>
                    {l.kiemKe && <div style={{ fontSize: 11, marginTop: 2, color: l.kiemKe === 'Đủ' ? '#059669' : '#DC2626' }}>● {l.kiemKe}</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // JSX const (không phải component con) để ô quét không bị remount và mất focus mỗi lần gõ.
  const scanBox = (
    <div className="form-field" style={{ marginBottom: 12 }}>
      <label><FiTarget /> Bắn / nhập mã vận đơn để tìm nhanh</label>
      <input value={scan} onChange={(e) => setScan(e.target.value)}
        placeholder="Quét mã VĐ, mã đơn, mã bao hoặc tên hàng…" />
      {scan.trim() && <div className="hint">Đang lọc theo “{scan.trim()}” — xoá ô để xem lại tất cả.</div>}
    </div>
  );

  const pendingFiltered = filterByScan(pendingArrivals, scan);
  const atWarehouseFiltered = filterByScan(atWarehouse, scan);

  const tabReceive = (
    <div className="form-section">
      <div className="section-title"><FiDownload /> Hàng chờ nhận từ NCC</div>
      {scanBox}
      {pendingFiltered.length === 0 ? (
        <div className="empty-state"><FiCheckCircle /><p>{scan.trim() ? 'Không có đơn khớp mã đã bắn.' : 'Không có hàng nào đang chờ.'}</p></div>
      ) : pendingFiltered.map((o) => (
        <div key={o.maDH} className="action-card">
          <div className="ac-header">
            <div className="ac-title">Mã VĐ: {o.maVD || '(chưa có)'}</div>
            <span className="status-badge s-tq">NCC đã giao</span>
          </div>
          {serviceBadges(o)}
          <div className="ac-meta">
            Đơn: <b style={{ cursor: 'pointer', textDecoration: 'underline', color: '#1E3A8A' }}
                    onClick={() => (window as any).openOrderDetail?.(o.maDH)}>{o.maDH}</b> ·
            Hàng: {o.tenHang} · {o.kg}kg · {o.m3}m³ · {o.web}
          </div>
          {kiemKe(o)}
          {nguoiTQ(o)}
          <div className="ac-actions">
            <button className="btn btn-success" onClick={() => confirmKhoTQ(o.maDH)}>
              <FiCheck /> Xác nhận đã nhận tại kho TQ
            </button>
            <button className="btn btn-secondary" onClick={() => openWeigh(o.maDH)}>
              <FiEdit2 /> Nhập cân (KG / kích thước)
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  const tabShip = (
    <div className="form-section">
      <div className="section-title"><FiTruck /> Hàng tại kho TQ — chuẩn bị chuyển về VN</div>
      {scanBox}
      {atWarehouseFiltered.length === 0 ? (
        <div className="empty-state"><FiPackage /><p>{scan.trim() ? 'Không có đơn khớp mã đã bắn.' : 'Không có hàng tại kho.'}</p></div>
      ) : (
        <table className="data-table">
          <thead><tr>
            <th>Mã VĐ</th><th>Mã đơn</th><th>Hàng</th><th>Kg/M³</th><th>Người làm / phụ trách</th><th>DV</th><th>Thao tác</th>
          </tr></thead>
          <tbody>
            {atWarehouseFiltered.map((o) => (
              <tr key={o.maDH}>
                <td className="ma-don">{o.maVD}</td>
                <td><span className="ma-don" style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => (window as any).openOrderDetail?.(o.maDH)}>{o.maDH}</span></td>
                <td>{o.tenHang}</td>
                <td>{o.kg} / {o.m3}</td>
                <td style={{ minWidth: 180 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div className="icon-inline" style={{ fontSize: 12 }}><FiUser /> {nguoiSelect(o.maDH, o.nguoiLamTQ, 'nguoiLam')}</div>
                    <div className="icon-inline" style={{ fontSize: 12 }}><FiUsers /> {nguoiSelect(o.maDH, o.nguoiPhuTrachTQ, 'nguoiPhuTrach')}</div>
                  </div>
                </td>
                <td>{o.kiemDem && '✔KĐ'}{o.kiemDem && o.dongGo && ' '}{o.dongGo && '📦'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => openWeigh(o.maDH)}>
                    <FiEdit2 /> Nhập cân
                  </button>{' '}
                  <button className="btn btn-primary btn-sm" onClick={() => markLeftTQ(o.maDH)}>
                    <FiTruck /> Rời TQ
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  const tabVoChu = (
    <div className="form-section">
      <div className="section-title"><FiHelpCircle /> Hàng vô chủ — mã VĐ về kho nhưng chưa khớp đơn</div>
      <div className="action-card">
        <div className="ac-header"><div className="ac-title"><FiPlus /> Thêm kiện vô chủ</div></div>
        <div className="form-grid-3" style={{ marginTop: 8 }}>
          <div className="form-field"><label className="required">Mã vận đơn</label>
            <input value={vc.maVD} onChange={(e) => setVc({ ...vc, maVD: e.target.value })} placeholder="VD: SF123..." /></div>
          <div className="form-field"><label>Cân nặng (kg)</label>
            <input type="number" step="0.01" value={vc.kg} onChange={(e) => setVc({ ...vc, kg: e.target.value })} /></div>
          <div className="form-field"><label>Ghi chú</label>
            <input value={vc.ghiChu} onChange={(e) => setVc({ ...vc, ghiChu: e.target.value })} placeholder="màu thùng, đặc điểm..." /></div>
        </div>
        <div className="form-grid-3" style={{ marginTop: 10 }}>
          <div className="form-field"><label>Dài (cm)</label>
            <input type="number" value={vc.dai} onChange={(e) => setVc({ ...vc, dai: e.target.value })} /></div>
          <div className="form-field"><label>Rộng (cm)</label>
            <input type="number" value={vc.rong} onChange={(e) => setVc({ ...vc, rong: e.target.value })} /></div>
          <div className="form-field"><label>Cao (cm)</label>
            <input type="number" value={vc.cao} onChange={(e) => setVc({ ...vc, cao: e.target.value })} /></div>
        </div>
        <div className="hint" style={{ marginTop: 4 }}>m³ tự tính = dài × rộng × cao (cm) ÷ 1.000.000</div>
        <div className="ac-actions">
          <button className="btn btn-success" onClick={addVoChu} disabled={busy.voChu}><FiPlus /> Thêm kiện vô chủ</button>
        </div>
      </div>

      {voChu.length === 0 ? (
        <div className="empty-state"><FiCheckCircle /><p>Không có hàng vô chủ.</p></div>
      ) : (
        <table className="data-table" style={{ marginTop: 12 }}>
          <thead><tr>
            <th>Mã VĐ</th><th>Kg</th><th>KT (D×R×C)</th><th>m³</th><th>Ghi chú</th><th>Người nhập</th><th>Gán vào đơn</th><th></th>
          </tr></thead>
          <tbody>
            {voChu.map((h) => (
              <tr key={h.id}>
                <td className="ma-don">{h.maVD}</td>
                <td>{h.kg}</td>
                <td>{h.dai}×{h.rong}×{h.cao}</td>
                <td>{h.m3}</td>
                <td>{h.ghiChu}</td>
                <td>{h.nguoiNhap}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <input style={{ width: 120, fontSize: 12 }} placeholder="Mã đơn DH-..."
                    value={matchInput[h.id] || ''} onChange={(e) => setMatchInput((p) => ({ ...p, [h.id]: e.target.value }))} />{' '}
                  <button className="btn btn-primary btn-sm" disabled={busy[`vc${h.id}`]} onClick={() => matchVoChu(h.id)}><FiLink /> Gán</button>
                </td>
                <td><button className="btn btn-danger btn-sm" onClick={() => deleteVoChu(h.id)}><FiTrash2 /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  const openBaos = baos.filter((b) => b.trangThai === 'DangDong');
  const exportedBaos = baos.filter((b) => b.trangThai === 'DaXuat');
  const unbagged = atWarehouse.filter((o) => !o.maBao);

  const tabBao = (
    <div className="form-section">
      <div className="section-title"><FiBox /> Bao tổng — gộp đơn theo line, xuất về VN</div>
      <div className="action-card">
        <div className="ac-header"><div className="ac-title"><FiPlus /> Tạo bao mới</div></div>
        <div className="form-grid" style={{ marginTop: 8 }}>
          <div className="form-field"><label>Line vận chuyển</label>
            <select value={baoLine} onChange={(e) => setBaoLine(e.target.value)}>
              <option value="LineNhanh">Nhanh</option><option value="LineThuong">Thường</option><option value="LineRe">Tiết kiệm</option>
            </select></div>
          <div className="form-field"><label>Ghi chú</label>
            <input value={baoGhiChu} onChange={(e) => setBaoGhiChu(e.target.value)} placeholder="vd: chuyến 25/06" /></div>
        </div>
        <div className="ac-actions"><button className="btn btn-success" onClick={createBao} disabled={busy.bao}><FiPlus /> Tạo bao</button></div>
      </div>

      <div className="hint" style={{ margin: '8px 0' }}>Đơn ở kho TQ chưa vào bao: <b>{unbagged.length ? unbagged.map((o, i) => <span key={o.maDH}>{i > 0 ? ', ' : ''}<span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => (window as any).openOrderDetail?.(o.maDH)}>{o.maDH}</span></span>) : 'không có'}</b></div>

      {openBaos.length === 0 ? <div className="empty-state"><FiBox /><p>Chưa có bao đang mở.</p></div> :
        openBaos.map((b) => (
          <div key={b.maBao} className="action-card">
            <div className="ac-header">
              <div className="ac-title"><FiBox /> {b.maBao} · Line {LINE_LABEL[b.line] || b.line}</div>
              <span className="status-badge s-tq">Đang đóng</span>
            </div>
            <div className="ac-meta">{b.soKien} đơn · {b.tongKg}kg · {b.tongM3}m³ · Đơn: <b>{b.orders.length ? b.orders.map((m, i) => <span key={m}>{i > 0 ? ', ' : ''}<span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => (window as any).openOrderDetail?.(m)}>{m}</span></span>) : '(trống)'}</b></div>
            <div className="form-grid" style={{ margin: '10px 0' }}>
              <div className="form-field"><label>Gán đơn vào bao (nhập / quét mã đơn)</label>
                <input value={addBaoInput[b.maBao] || ''} onChange={(e) => setAddBaoInput((p) => ({ ...p, [b.maBao]: e.target.value }))} placeholder="DH-..." /></div>
            </div>
            <div className="ac-actions">
              <button className="btn btn-primary" onClick={() => addToBao(b.maBao)}><FiLink /> Gán đơn</button>
              <button className="btn btn-success" onClick={() => xuatBao(b.maBao)}><FiSend /> Xuất bao về VN</button>
            </div>
          </div>
        ))}

      {exportedBaos.length > 0 && <>
        <div className="section-title" style={{ marginTop: 16 }}><FiTruck /> Bao đã xuất (đang về VN)</div>
        <table className="data-table"><thead><tr><th>Mã bao</th><th>Line</th><th>Số đơn</th><th>Kg/M³</th></tr></thead>
          <tbody>{exportedBaos.map((b) => (<tr key={b.maBao}><td className="ma-don">{b.maBao}</td><td>{LINE_LABEL[b.line] || b.line}</td><td>{b.soKien}</td><td>{b.tongKg}/{b.tongM3}</td></tr>))}</tbody></table>
      </>}
    </div>
  );

  const tabQuy = (
    <div className="form-section">
      <div className="section-title"><FiDollarSign /> Quỹ kho TQ — thu hộ khách, chi phí nội địa TQ</div>

      <div className="kpi-row">
        <div className="kpi" style={{ ['--primary' as any]: '#16a34a' }}>
          <div className="kpi-label"><FiPlus /> Tổng thu</div>
          <div className="kpi-value">{fmtVND(tongThu)}</div>
        </div>
        <div className="kpi" style={{ ['--primary' as any]: '#ef4444' }}>
          <div className="kpi-label"><FiSend /> Tổng chi</div>
          <div className="kpi-value">{fmtVND(tongChi)}</div>
        </div>
        <div className="kpi" style={{ ['--primary' as any]: '#0f766e' }}>
          <div className="kpi-label"><FiDollarSign /> Tồn quỹ</div>
          <div className="kpi-value">{fmtVND(tonQuy)}</div>
          <div className="kpi-sub">thu − chi</div>
        </div>
      </div>

      <div className="action-card">
        <div className="ac-header"><div className="ac-title"><FiPlus /> Thêm bút toán quỹ</div></div>
        <div className="form-grid-3" style={{ marginTop: 8 }}>
          <div className="form-field"><label>Loại</label>
            <select value={quyForm.loai} onChange={(e) => setQuyForm({ ...quyForm, loai: e.target.value })}>
              <option value="Thu">Thu</option><option value="Chi">Chi</option>
            </select></div>
          <div className="form-field"><label className="required">Số tiền (VNĐ)</label>
            <input type="number" value={quyForm.soTien} onChange={(e) => setQuyForm({ ...quyForm, soTien: e.target.value })} placeholder="0" /></div>
          <div className="form-field"><label>Danh mục</label>
            <input list="quy-danh-muc" value={quyForm.danhMuc} onChange={(e) => setQuyForm({ ...quyForm, danhMuc: e.target.value })} placeholder="Thu hộ khách..." />
            <datalist id="quy-danh-muc">{QUY_DANH_MUC.map((d) => <option key={d} value={d} />)}</datalist></div>
        </div>
        <div className="form-grid" style={{ marginTop: 10 }}>
          <div className="form-field"><label className="required">Nội dung</label>
            <input value={quyForm.noiDung} onChange={(e) => setQuyForm({ ...quyForm, noiDung: e.target.value })} placeholder="mô tả thu / chi" /></div>
          <div className="form-field"><label>Mã đơn (tuỳ chọn)</label>
            <input value={quyForm.maDH} onChange={(e) => setQuyForm({ ...quyForm, maDH: e.target.value })} placeholder="DH-..." /></div>
        </div>
        <div className="ac-actions">
          <button className="btn btn-success" onClick={addQuy} disabled={busy.quy}><FiPlus /> Ghi bút toán</button>
        </div>
      </div>

      {soQuy.length === 0 ? (
        <div className="empty-state"><FiDollarSign /><p>Chưa có bút toán quỹ nào.</p></div>
      ) : (
        <table className="data-table" style={{ marginTop: 12 }}>
          <thead><tr>
            <th>Ngày</th><th>Loại</th><th className="number">Số tiền</th><th>Danh mục</th><th>Nội dung</th><th>Mã đơn</th><th>Người tạo</th>
          </tr></thead>
          <tbody>
            {soQuy.map((q) => (
              <tr key={q.id}>
                <td>{new Date(q.ngay).toLocaleDateString('vi-VN')}</td>
                <td><span className={`status-badge ${q.loai === 'Thu' ? 's-vn' : 's-waiting'}`}>{q.loai}</span></td>
                <td className="number" style={{ color: q.loai === 'Thu' ? '#059669' : '#DC2626', fontWeight: 700 }}>
                  {q.loai === 'Thu' ? '+' : '−'}{fmtVND(q.soTien)}
                </td>
                <td>{q.danhMuc || '-'}</td>
                <td>{q.noiDung}</td>
                <td className="ma-don">{q.maDH || '-'}</td>
                <td>{q.nguoiTao}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <AppShell user={user}>
      <div className="alert alert-info">
        <FiInfo /><span>Bạn là nhân viên <b>Kho TQ</b>. <b>Không thấy tiền/phí/giá vốn</b>.</span>
      </div>

      <div className="kpi-row">
        <div className="kpi" style={{ ['--primary' as any]: '#f59e0b' }}>
          <div className="kpi-label"><FiClock /> Chờ NCC giao</div>
          <div className="kpi-value">{pendingArrivals.length}</div>
        </div>
        <div className="kpi" style={{ ['--primary' as any]: '#0f766e' }}>
          <div className="kpi-label"><FiPackage /> Hàng tại kho TQ</div>
          <div className="kpi-value">{atWarehouse.length}</div>
          <div className="kpi-sub">đang chờ chuyển</div>
        </div>
        <div className="kpi" style={{ ['--primary' as any]: '#ef4444' }}>
          <div className="kpi-label"><FiHelpCircle /> Hàng vô chủ</div>
          <div className="kpi-value">{voChu.length}</div>
          <div className="kpi-sub">chưa khớp đơn</div>
        </div>
        <div className="kpi" style={{ ['--primary' as any]: '#10b981' }}>
          <div className="kpi-label"><FiCheckCircle /> Xử lý hôm nay</div>
          <div className="kpi-value">-</div>
        </div>
      </div>

      <Tabs tabs={[
        { id: 'tab-receive', label: <><FiDownload /> Chờ nhận từ NCC ({pendingArrivals.length})</>, content: tabReceive },
        { id: 'tab-ship', label: <><FiTruck /> Chuyển về VN ({atWarehouse.length})</>, content: tabShip },
        { id: 'tab-bao', label: <><FiBox /> Bao tổng ({openBaos.length})</>, content: tabBao },
        { id: 'tab-vochu', label: <><FiHelpCircle /> Hàng vô chủ ({voChu.length})</>, content: tabVoChu },
        { id: 'tab-quy', label: <><FiDollarSign /> Quỹ kho TQ</>, content: tabQuy }
      ]} />

      <div className="alert alert-lock">
        <FiLock /><span><b>Bạn KHÔNG thấy:</b> Giá tiền · Tên KH · Phí · Thông tin tài chính</span>
      </div>

      {/* Modal nhập cân & kích thước từng dòng (góp ý #25/#33) */}
      <div className={`modal-overlay ${weighMaDH ? 'show' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setWeighMaDH(null); }}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 760 }}>
          <div className="modal-header">
            <h2><FiEdit2 /> Nhập cân & kích thước — {weighMaDH}</h2>
            <button className="modal-close" onClick={() => setWeighMaDH(null)}><FiX /></button>
          </div>
          <div className="modal-body">
            <div className="alert alert-info" style={{ marginBottom: 12 }}>
              <FiInfo /><span>Nhập đủ <b>Dài × Rộng × Cao (cm)</b> thì ô <b>M³</b> tự tính theo công thức trong Cài đặt và bị khoá. Bỏ trống kích thước thì gõ M³ tay. Bấm <FiSave /> để lưu từng dòng.</span>
            </div>
            {weighLines.length === 0 ? (
              <div className="empty-state"><FiClock /><p>Đang tải dòng hàng…</p></div>
            ) : (
              <table className="data-table" style={{ fontSize: 13 }}>
                <thead><tr>
                  <th>Sản phẩm</th><th className="number">SL</th><th className="number">Kg</th>
                  <th className="number">Dài</th><th className="number">Rộng</th><th className="number">Cao (cm)</th>
                  <th className="number">M³</th><th></th>
                </tr></thead>
                <tbody>
                  {weighLines.map((l) => {
                    const dai = parseFloat(l.dai) || 0, rong = parseFloat(l.rong) || 0, cao = parseFloat(l.cao) || 0;
                    const hasKT = dai > 0 && rong > 0 && cao > 0;
                    return (
                      <tr key={l.stt}>
                        <td>{l.tenSP}</td>
                        <td className="number">{l.soLuong}</td>
                        <td className="number"><input type="number" step="0.01" value={l.kg} style={{ width: 72, textAlign: 'right' }} onChange={(e) => patchWeigh(l.stt, { kg: e.target.value })} /></td>
                        <td className="number"><input type="number" value={l.dai} style={{ width: 60, textAlign: 'right' }} onChange={(e) => patchWeigh(l.stt, { dai: e.target.value })} /></td>
                        <td className="number"><input type="number" value={l.rong} style={{ width: 60, textAlign: 'right' }} onChange={(e) => patchWeigh(l.stt, { rong: e.target.value })} /></td>
                        <td className="number"><input type="number" value={l.cao} style={{ width: 60, textAlign: 'right' }} onChange={(e) => patchWeigh(l.stt, { cao: e.target.value })} /></td>
                        <td className="number">
                          <input type="number" step="0.0001" value={l.m3} readOnly={hasKT}
                            title={hasKT ? 'm³ tự tính từ kích thước theo công thức trong Cài đặt' : undefined}
                            style={{ width: 84, textAlign: 'right', background: hasKT ? '#F3F4F6' : undefined, cursor: hasKT ? 'not-allowed' : 'text' }}
                            onChange={(e) => patchWeigh(l.stt, { m3: e.target.value })} />
                          {hasKT && <div className="hint" style={{ fontSize: 10 }}>tự tính từ KT</div>}
                        </td>
                        <td><button className="btn btn-success btn-sm" disabled={weighBusy[l.stt]} onClick={() => saveWeighLine(l)}><FiSave /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <div className="hint" style={{ marginTop: 8 }}>m³ tự tính từ kích thước theo công thức trong Cài đặt.</div>
          </div>
          <div className="btn-row">
            <button className="btn btn-secondary" onClick={() => setWeighMaDH(null)}>Đóng</button>
          </div>
        </div>
      </div>

      <OrderDetailModalHost canSeeMoney={false} />
      <ImageUploadModalHost />
    </AppShell>
  );
}
