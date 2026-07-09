'use client';

import { useState } from 'react';
import {
  FiInfo, FiTruck, FiPackage, FiCheckCircle, FiDownload, FiClock, FiCheck, FiAlertCircle, FiTarget,
  FiEdit2, FiX, FiBox, FiMapPin, FiSave
} from 'react-icons/fi';
import type { SessionUser } from '@/lib/auth';
import AppShell from '@/components/AppShell';
import Tabs from '@/components/Tabs';
import OrderDetailModalHost from '@/components/OrderDetailModal';
import ImageUploadModalHost from '@/components/ImageUploadModal';
import { showToast } from '@/components/Toast';
import { callServer, reload } from '@/lib/client';
import { fmtVND } from '@/lib/format';

type WeighLine = { stt: number; tenSP: string; soLuong: number; kg: string; m3: string };

type Row = {
  maDH: string; maVD: string; maBao: string; tenKH: string;
  tenHang: string; tuyen: string; conLai: number; shipND: number;
  diaChiNhan: string; nguoiNhan: string; sdtNhan: string; lineNoiDia: string;
};
type Bao = {
  maBao: string; line: string; trangThai: string;
  tongKg: number; tongM3: number; soKien: number; daNhan: number; tong: number;
};
const LINE_LABEL: Record<string, string> = { LineNhanh: 'Nhanh', LineThuong: 'Thường', LineRe: 'Tiết kiệm' };
// Góp ý NV #41: line vận chuyển nội địa VN do kho VN chọn khi giao hàng.
const LINE_NOI_DIA = ['Viettel Post', 'GHTK', 'J&T Express', 'Xe khách', 'Xe tải nhà', 'Khách tự lấy'];

// Góp ý NV #35: bắn (quét) mã vận đơn để tìm nhanh đơn trong danh sách kho.
function filterByScan(rows: Row[], q: string) {
  const k = q.trim().toLowerCase();
  if (!k) return rows;
  return rows.filter((o) =>
    o.maVD.toLowerCase().includes(k) || o.maDH.toLowerCase().includes(k) ||
    o.maBao.toLowerCase().includes(k) || o.tenKH.toLowerCase().includes(k));
}

export default function KhoVnClient({ user, incomingShipments, atWarehouse, readyToDeliver, baos }:
  { user: SessionUser; incomingShipments: Row[]; atWarehouse: Row[]; readyToDeliver: Row[]; baos: Bao[] }) {

  const [weighMaDH, setWeighMaDH] = useState<string | null>(null);
  const [weighLines, setWeighLines] = useState<WeighLine[]>([]);
  const [weighBusy, setWeighBusy] = useState(false);

  async function openWeigh(maDH: string) {
    setWeighMaDH(maDH); setWeighLines([]);
    const r = await callServer('getOrderDetail', maDH);
    if (r?.success) {
      setWeighLines(r.data.chiTiet.map((c: any) => ({ stt: c.stt, tenSP: c.tenSP, soLuong: c.soLuong, kg: String(c.kg), m3: String(c.m3) })));
    } else { showToast(r?.message || 'Lỗi tải đơn', 'error'); setWeighMaDH(null); }
  }
  function patchWeigh(stt: number, p: Partial<WeighLine>) {
    setWeighLines((ls) => ls.map((l) => (l.stt === stt ? { ...l, ...p } : l)));
  }
  async function saveWeigh() {
    if (!weighMaDH) return;
    setWeighBusy(true);
    for (const l of weighLines) {
      await callServer('updateChiTietKg', weighMaDH, l.stt, { kg: parseFloat(l.kg) || 0, m3: parseFloat(l.m3) || 0 });
    }
    setWeighBusy(false);
    showToast('Đã cập nhật cân nặng (lưu lịch sử sửa)', 'success');
    reload();
  }

  function confirmKhoVN(maDH: string) {
    (window as any).openImageUploadModal?.('Xác nhận nhận hàng tại Kho VN', maDH, async (img: string | null) => {
      const r = await callServer('confirmKhoVN', maDH, img);
      if (r?.success) { showToast(img ? 'Đã xác nhận + lưu ảnh' : 'Đã xác nhận', 'success'); reload(); }
      else showToast(r?.message || 'Lỗi', 'error');
    });
  }

  function confirmDelivered(maDH: string) {
    (window as any).openImageUploadModal?.('Xác nhận đã giao tới KH', maDH, async (img: string | null) => {
      const r = await callServer('confirmDelivered', maDH, img);
      if (r?.success) { showToast(img ? 'Đã giao + lưu ảnh' : 'Đã giao', 'success'); reload(); }
      else showToast(r?.message || 'Lỗi', 'error');
    });
  }

  // Đợt 5 — nhận cả bao + ship nội địa VN
  const [baoInput, setBaoInput] = useState('');
  const [shipInputs, setShipInputs] = useState<Record<string, string>>({});
  const [lineInputs, setLineInputs] = useState<Record<string, string>>({});
  // Ô bắn mã vận đơn — lọc nhanh mọi tab (góp ý #35).
  const [scan, setScan] = useState('');

  async function receiveBao(maBao: string) {
    const ma = (maBao || baoInput).trim();
    if (!ma) return showToast('Nhập/quét mã bao', 'error');
    const r = await callServer('receiveBaoAtVN', ma);
    if (r?.success) {
      const warn = r.conChua > 0 ? ` ⚠ còn ${r.conChua} đơn chưa về` : '';
      showToast(`Nhận bao ${ma}: ${r.received}/${r.total} đơn${warn}`, r.conChua > 0 ? 'error' : 'success');
      reload();
    } else showToast(r?.message || 'Lỗi', 'error');
  }

  async function saveShipVN(maDH: string) {
    const v = parseFloat(shipInputs[maDH] || '0') || 0;
    const r = await callServer('updateShipVN', maDH, v, lineInputs[maDH] ?? '');
    if (r?.success) { showToast('Đã cập nhật ship nội địa VN', 'success'); reload(); }
    else showToast(r?.message || 'Lỗi', 'error');
  }

  function shipVN(o: Row) {
    return (
      <div className="form-grid" style={{ marginTop: 8 }}>
        <div className="form-field">
          <label>Line vận chuyển nội địa</label>
          <select value={lineInputs[o.maDH] ?? o.lineNoiDia ?? ''}
            onChange={(e) => setLineInputs((p) => ({ ...p, [o.maDH]: e.target.value }))}>
            <option value="">-- Chọn line --</option>
            {LINE_NOI_DIA.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label>Ship nội địa VN (VNĐ)</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input type="number" defaultValue={o.shipND || ''} placeholder="phí giao VN"
              onChange={(e) => setShipInputs((p) => ({ ...p, [o.maDH]: e.target.value }))} />
            <button className="btn btn-secondary btn-sm" onClick={() => saveShipVN(o.maDH)}><FiSave /></button>
          </div>
        </div>
      </div>
    );
  }

  // JSX const (không phải component con) để ô quét không bị remount và mất focus mỗi lần gõ.
  const scanBox = (
    <div className="form-field" style={{ marginBottom: 12 }}>
      <label><FiTarget /> Bắn / nhập mã vận đơn để tìm nhanh</label>
      <input value={scan} onChange={(e) => setScan(e.target.value)}
        placeholder="Quét mã VĐ, mã bao, mã đơn hoặc tên khách…" />
      {scan.trim() && <div className="hint">Đang lọc theo “{scan.trim()}” — xoá ô để xem lại tất cả.</div>}
    </div>
  );

  function diaChi(o: Row) {
    if (!o.diaChiNhan && !o.nguoiNhan) return null;
    return (
      <div className="icon-inline" style={{ background: '#ECFDF5', padding: 8, borderRadius: 6, marginTop: 8, fontSize: 12, color: '#065F46' }}>
        <FiMapPin /> Giao: <b>{o.nguoiNhan || o.tenKH}</b>{o.sdtNhan ? ` · ${o.sdtNhan}` : ''}{o.diaChiNhan ? ` · ${o.diaChiNhan}` : ''}
      </div>
    );
  }

  const incomingFiltered = filterByScan(incomingShipments, scan);
  const atWarehouseFiltered = filterByScan(atWarehouse, scan);
  const readyFiltered = filterByScan(readyToDeliver, scan);

  const tabIncoming = (
    <div className="form-section">
      <div className="section-title"><FiDownload /> Hàng từ TQ đang về kho VN</div>
      {scanBox}
      {incomingFiltered.length === 0 ? (
        <div className="empty-state"><FiPackage /><p>{scan.trim() ? 'Không có đơn khớp mã đã bắn.' : 'Không có hàng đang về.'}</p></div>
      ) : incomingFiltered.map((o) => (
        <div key={o.maDH} className="action-card">
          <div className="ac-header">
            <div className="ac-title">Mã VĐ: {o.maVD || '(chưa có)'}</div>
            <span className="status-badge s-shipping">Đang vận chuyển</span>
          </div>
          <div className="ac-meta">
            Đơn: <b style={{ cursor: 'pointer', textDecoration: 'underline', color: '#1E3A8A' }}
                    onClick={() => (window as any).openOrderDetail?.(o.maDH)}>{o.maDH}</b> ·
            KH: {o.tenKH} · {o.tenHang} · Tuyến: <b>{o.tuyen === 'HCM' ? 'HCM' : 'Hà Nội'}</b>
            {o.maBao && <> · Bao: <b>{o.maBao}</b></>}
          </div>
          {diaChi(o)}
          {shipVN(o)}
          <div className="ac-actions">
            <button className="btn btn-success" onClick={() => confirmKhoVN(o.maDH)}>
              <FiCheck /> Xác nhận đã nhận tại VN
            </button>
            <button className="btn btn-secondary" onClick={() => openWeigh(o.maDH)}>
              <FiEdit2 /> Sửa cân (KG/M³)
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  const tabAtVN = (
    <div className="form-section">
      <div className="section-title"><FiPackage /> Hàng tại kho VN — chờ KH thanh toán</div>
      {scanBox}
      {atWarehouseFiltered.length === 0 ? (
        <div className="empty-state"><FiCheckCircle /><p>{scan.trim() ? 'Không có đơn khớp mã đã bắn.' : 'Không có đơn chờ thanh toán.'}</p></div>
      ) : atWarehouseFiltered.map((o) => (
        <div key={o.maDH} className="action-card">
          <div className="ac-header">
            <div className="ac-title">Đơn: <b style={{ cursor: 'pointer', textDecoration: 'underline', color: '#1E3A8A' }}
                                            onClick={() => (window as any).openOrderDetail?.(o.maDH)}>{o.maDH}</b></div>
            <span className="status-badge s-waiting">Chờ thanh toán</span>
          </div>
          <div className="ac-meta">KH: <b>{o.tenKH}</b> · {o.tenHang} · Tuyến: <b>{o.tuyen === 'HCM' ? 'HCM' : 'Hà Nội'}</b></div>
          <div className="icon-inline" style={{ background: '#FEF3C7', padding: 8, borderRadius: 6, marginTop: 8, fontSize: 12, color: '#92400E' }}>
            <FiClock /> Đợi Kế toán xác nhận khách đã thanh toán đủ trước khi giao.
          </div>
          <div className="ac-actions">
            <button className="btn btn-secondary btn-sm" onClick={() => openWeigh(o.maDH)}>
              <FiEdit2 /> Sửa cân (KG/M³)
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  const tabReady = (
    <div className="form-section">
      <div className="section-title"><FiTruck /> Đơn đã thanh toán đủ — chờ giao khách</div>
      {scanBox}
      {readyFiltered.length === 0 ? (
        <div className="empty-state"><FiPackage /><p>{scan.trim() ? 'Không có đơn khớp mã đã bắn.' : 'Không có đơn nào chờ giao.'}</p></div>
      ) : readyFiltered.map((o) => (
        <div key={o.maDH} className="action-card">
          <div className="ac-header">
            <div className="ac-title">Đơn: <b style={{ cursor: 'pointer', textDecoration: 'underline', color: '#1E3A8A' }}
                                            onClick={() => (window as any).openOrderDetail?.(o.maDH)}>{o.maDH}</b></div>
            <span className="status-badge s-vn">Sẵn sàng giao</span>
          </div>
          <div className="ac-meta">KH: <b>{o.tenKH}</b> · {o.tenHang} · Tuyến: <b>{o.tuyen === 'HCM' ? 'HCM' : 'Hà Nội'}</b></div>
          {diaChi(o)}
          {o.conLai > 0.5 && (
            <div className="icon-inline" style={{ background: '#FEE2E2', padding: 8, borderRadius: 6, marginTop: 8, fontSize: 12, color: '#991B1B' }}>
              <FiAlertCircle /> Còn nợ {fmtVND(o.conLai)}đ — không thể giao đến khi thanh toán đủ
            </div>
          )}
          <div className="ac-actions">
            <button className="btn btn-success" onClick={() => confirmDelivered(o.maDH)} disabled={o.conLai > 0.5}>
              <FiTarget /> Đã giao tới KH
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  const tabBao = (
    <div className="form-section">
      <div className="section-title"><FiBox /> Nhận bao tổng — quét mã bao để nhận cả lô</div>
      <div className="action-card">
        <div className="form-grid" style={{ marginTop: 4 }}>
          <div className="form-field"><label>Quét / nhập mã bao</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={baoInput} onChange={(e) => setBaoInput(e.target.value)} placeholder="BAO0001" />
              <button className="btn btn-success" onClick={() => receiveBao('')}><FiCheck /> Nhận bao</button>
            </div>
          </div>
        </div>
        <div className="hint">Nhận bao sẽ xác nhận tất cả đơn trong bao đã về VN. Nếu còn đơn chưa về sẽ cảnh báo.</div>
      </div>

      {baos.length === 0 ? <div className="empty-state"><FiBox /><p>Không có bao nào đang về.</p></div> :
        baos.map((b) => {
          const thieu = b.tong - b.daNhan;
          return (
            <div key={b.maBao} className="action-card">
              <div className="ac-header">
                <div className="ac-title"><FiBox /> {b.maBao} · Line {LINE_LABEL[b.line] || b.line}</div>
                <span className={`status-badge ${thieu > 0 ? 's-waiting' : 's-vn'}`}>{b.trangThai === 'DaVeVN' ? 'Đang nhận' : 'Đã xuất'}</span>
              </div>
              <div className="ac-meta">{b.soKien} đơn · {b.tongKg}kg · {b.tongM3}m³ · Đã nhận: <b>{b.daNhan}/{b.tong}</b></div>
              {thieu > 0 && (
                <div className="icon-inline" style={{ background: '#FEF3C7', padding: 8, borderRadius: 6, marginTop: 8, fontSize: 12, color: '#92400E' }}>
                  <FiAlertCircle /> Còn <b>{thieu}</b> đơn trong bao chưa về VN — bao chưa hoàn thành.
                </div>
              )}
              <div className="ac-actions">
                <button className="btn btn-success" onClick={() => receiveBao(b.maBao)}><FiCheck /> Xác nhận nhận bao này</button>
              </div>
            </div>
          );
        })}
    </div>
  );

  return (
    <AppShell user={user}>
      <div className="alert alert-info">
        <FiInfo /><span>Bạn là <b>Kho VN</b>. Nhận hàng từ TQ về và giao cho khách (yêu cầu đơn đã thanh toán đủ).</span>
      </div>

      <div className="kpi-row">
        <div className="kpi" style={{ ['--primary' as any]: '#3b82f6' }}>
          <div className="kpi-label"><FiTruck /> Đang VC về</div>
          <div className="kpi-value">{incomingShipments.length}</div>
        </div>
        <div className="kpi" style={{ ['--primary' as any]: '#f59e0b' }}>
          <div className="kpi-label"><FiPackage /> Tại kho VN</div>
          <div className="kpi-value">{atWarehouse.length}</div>
        </div>
        <div className="kpi" style={{ ['--primary' as any]: '#16a34a' }}>
          <div className="kpi-label"><FiCheckCircle /> Sẵn sàng giao</div>
          <div className="kpi-value">{readyToDeliver.length}</div>
        </div>
        <div className="kpi" style={{ ['--primary' as any]: '#10b981' }}>
          <div className="kpi-label"><FiTarget /> Đã giao hôm nay</div>
          <div className="kpi-value">-</div>
        </div>
      </div>

      <Tabs tabs={[
        { id: 'tab-bao', label: <><FiBox /> Nhận bao ({baos.length})</>, content: tabBao },
        { id: 'tab-incoming', label: <><FiDownload /> Đang về VN ({incomingShipments.length})</>, content: tabIncoming },
        { id: 'tab-at-vn', label: <><FiPackage /> Tại VN - chờ TT ({atWarehouse.length})</>, content: tabAtVN },
        { id: 'tab-ready', label: <><FiTruck /> Sẵn sàng giao ({readyToDeliver.length})</>, content: tabReady }
      ]} />

      {/* Modal sửa cân nặng (có lưu lịch sử) */}
      <div className={`modal-overlay ${weighMaDH ? 'show' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setWeighMaDH(null); }}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2><FiEdit2 /> Sửa cân nặng — {weighMaDH}</h2>
            <button className="modal-close" onClick={() => setWeighMaDH(null)}><FiX /></button>
          </div>
          <div className="modal-body">
            <div className="alert alert-warning" style={{ marginBottom: 12 }}>
              <FiInfo /><span>Kho VN cân lại thực tế. Mỗi thay đổi được <b>lưu lịch sử</b> (Audit log) và tự tính lại phí VC.</span>
            </div>
            {weighLines.length === 0 ? (
              <div className="empty-state"><FiClock /><p>Đang tải dòng hàng…</p></div>
            ) : (
              <table className="data-table">
                <thead><tr><th>Sản phẩm</th><th className="number">SL</th><th className="number">KG/sp</th><th className="number">M³/sp</th></tr></thead>
                <tbody>
                  {weighLines.map((l) => (
                    <tr key={l.stt}>
                      <td>{l.tenSP}</td>
                      <td className="number">{l.soLuong}</td>
                      <td className="number"><input type="number" step="0.01" value={l.kg} style={{ width: 90, textAlign: 'right' }} onChange={(e) => patchWeigh(l.stt, { kg: e.target.value })} /></td>
                      <td className="number"><input type="number" step="0.0001" value={l.m3} style={{ width: 100, textAlign: 'right' }} onChange={(e) => patchWeigh(l.stt, { m3: e.target.value })} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="btn-row">
            <button className="btn btn-secondary" onClick={() => setWeighMaDH(null)}>Hủy</button>
            <button className="btn btn-success" onClick={saveWeigh} disabled={weighBusy || weighLines.length === 0}>
              {weighBusy ? <FiClock /> : <FiCheck />} Lưu cân nặng
            </button>
          </div>
        </div>
      </div>

      <OrderDetailModalHost canSeeMoney={false} />
      <ImageUploadModalHost />
    </AppShell>
  );
}
