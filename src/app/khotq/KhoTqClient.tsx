'use client';

import { useState } from 'react';
import {
  FiInfo, FiClock, FiPackage, FiTruck, FiCheckCircle, FiDownload, FiCheck, FiLock,
  FiAlertTriangle, FiPlus, FiLink, FiTrash2, FiHelpCircle
} from 'react-icons/fi';
import type { SessionUser } from '@/lib/auth';
import AppShell from '@/components/AppShell';
import Tabs from '@/components/Tabs';
import OrderDetailModalHost from '@/components/OrderDetailModal';
import ImageUploadModalHost from '@/components/ImageUploadModal';
import { showToast } from '@/components/Toast';
import { callServer, reload } from '@/lib/client';

type Line = { stt: number; tenSP: string; soLuong: number; kiemKe: string; kiemKeNote: string };
type Row = {
  maDH: string; maVD: string; tenHang: string;
  kg: number; m3: number; web: string; tuyen: string;
  kiemDem: boolean; dongGo: boolean; nguoiPhuTrachTQ: string; lines: Line[];
};
type VoChu = {
  id: number; maVD: string; kg: number; dai: number; rong: number; cao: number; m3: number;
  ghiChu: string; nguoiNhap: string; createdAt: string;
};

export default function KhoTqClient({ user, pendingArrivals, atWarehouse, voChu }:
  { user: SessionUser; pendingArrivals: Row[]; atWarehouse: Row[]; voChu: VoChu[] }) {

  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [keNote, setKeNote] = useState<Record<string, string>>({});

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

  function ServiceBadges({ o }: { o: Row }) {
    if (!o.kiemDem && !o.dongGo) return null;
    return (
      <div style={{ display: 'flex', gap: 6, margin: '6px 0' }}>
        {o.kiemDem && <span className="status-badge" style={{ background: '#FEF3C7', color: '#92400E' }}><FiAlertTriangle /> Cần KIỂM ĐẾM</span>}
        {o.dongGo && <span className="status-badge" style={{ background: '#DBEAFE', color: '#1E40AF' }}><FiPackage /> Đóng gỗ</span>}
      </div>
    );
  }

  function KiemKe({ o }: { o: Row }) {
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

  const tabReceive = (
    <div className="form-section">
      <div className="section-title"><FiDownload /> Hàng chờ nhận từ NCC</div>
      {pendingArrivals.length === 0 ? (
        <div className="empty-state"><FiCheckCircle /><p>Không có hàng nào đang chờ.</p></div>
      ) : pendingArrivals.map((o) => (
        <div key={o.maDH} className="action-card">
          <div className="ac-header">
            <div className="ac-title">Mã VĐ: {o.maVD || '(chưa có)'}</div>
            <span className="status-badge s-tq">NCC đã giao</span>
          </div>
          <ServiceBadges o={o} />
          <div className="ac-meta">
            Đơn: <b style={{ cursor: 'pointer', textDecoration: 'underline', color: '#1E3A8A' }}
                    onClick={() => (window as any).openOrderDetail?.(o.maDH)}>{o.maDH}</b> ·
            Hàng: {o.tenHang} · {o.kg}kg · {o.m3}m³ · {o.web}
          </div>
          <KiemKe o={o} />
          <div className="ac-actions">
            <button className="btn btn-success" onClick={() => confirmKhoTQ(o.maDH)}>
              <FiCheck /> Xác nhận đã nhận tại kho TQ
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  const tabShip = (
    <div className="form-section">
      <div className="section-title"><FiTruck /> Hàng tại kho TQ — chuẩn bị chuyển về VN</div>
      {atWarehouse.length === 0 ? (
        <div className="empty-state"><FiPackage /><p>Không có hàng tại kho.</p></div>
      ) : (
        <table className="data-table">
          <thead><tr>
            <th>Mã VĐ</th><th>Mã đơn</th><th>Hàng</th><th>Kg/M³</th><th>Người nhận TQ</th><th>DV</th><th>Thao tác</th>
          </tr></thead>
          <tbody>
            {atWarehouse.map((o) => (
              <tr key={o.maDH}>
                <td className="ma-don">{o.maVD}</td>
                <td>{o.maDH}</td>
                <td>{o.tenHang}</td>
                <td>{o.kg} / {o.m3}</td>
                <td>{o.nguoiPhuTrachTQ || '-'}</td>
                <td>{o.kiemDem && '✔KĐ'}{o.kiemDem && o.dongGo && ' '}{o.dongGo && '📦'}</td>
                <td>
                  <button className="btn btn-primary btn-sm" onClick={() => markLeftTQ(o.maDH)}>
                    <FiTruck /> Đánh dấu rời TQ
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
        { id: 'tab-vochu', label: <><FiHelpCircle /> Hàng vô chủ ({voChu.length})</>, content: tabVoChu }
      ]} />

      <div className="alert alert-lock">
        <FiLock /><span><b>Bạn KHÔNG thấy:</b> Giá tiền · Tên KH · Phí · Thông tin tài chính</span>
      </div>

      <OrderDetailModalHost canSeeMoney={false} />
      <ImageUploadModalHost />
    </AppShell>
  );
}
