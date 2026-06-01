'use client';

import { useState } from 'react';
import {
  FiInfo, FiTruck, FiPackage, FiCheckCircle, FiDownload, FiClock, FiCheck, FiAlertCircle, FiTarget,
  FiEdit2, FiX
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
  maDH: string; maVD: string; tenKH: string;
  tenHang: string; tuyen: string; conLai: number;
};

export default function KhoVnClient({ user, incomingShipments, atWarehouse, readyToDeliver }:
  { user: SessionUser; incomingShipments: Row[]; atWarehouse: Row[]; readyToDeliver: Row[] }) {

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

  const tabIncoming = (
    <div className="form-section">
      <div className="section-title"><FiDownload /> Hàng từ TQ đang về kho VN</div>
      {incomingShipments.length === 0 ? (
        <div className="empty-state"><FiPackage /><p>Không có hàng đang về.</p></div>
      ) : incomingShipments.map((o) => (
        <div key={o.maDH} className="action-card">
          <div className="ac-header">
            <div className="ac-title">Mã VĐ: {o.maVD || '(chưa có)'}</div>
            <span className="status-badge s-shipping">Đang vận chuyển</span>
          </div>
          <div className="ac-meta">
            Đơn: <b style={{ cursor: 'pointer', textDecoration: 'underline', color: '#1E3A8A' }}
                    onClick={() => (window as any).openOrderDetail?.(o.maDH)}>{o.maDH}</b> ·
            KH: {o.tenKH} · {o.tenHang} · Tuyến: <b>{o.tuyen === 'HCM' ? 'HCM' : 'Hà Nội'}</b>
          </div>
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
      {atWarehouse.length === 0 ? (
        <div className="empty-state"><FiCheckCircle /><p>Không có đơn chờ thanh toán.</p></div>
      ) : atWarehouse.map((o) => (
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
      {readyToDeliver.length === 0 ? (
        <div className="empty-state"><FiPackage /><p>Không có đơn nào chờ giao.</p></div>
      ) : readyToDeliver.map((o) => (
        <div key={o.maDH} className="action-card">
          <div className="ac-header">
            <div className="ac-title">Đơn: <b style={{ cursor: 'pointer', textDecoration: 'underline', color: '#1E3A8A' }}
                                            onClick={() => (window as any).openOrderDetail?.(o.maDH)}>{o.maDH}</b></div>
            <span className="status-badge s-vn">Sẵn sàng giao</span>
          </div>
          <div className="ac-meta">KH: <b>{o.tenKH}</b> · {o.tenHang} · Tuyến: <b>{o.tuyen === 'HCM' ? 'HCM' : 'Hà Nội'}</b></div>
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
