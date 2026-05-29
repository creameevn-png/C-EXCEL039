'use client';

import {
  FiInfo, FiTruck, FiPackage, FiCheckCircle, FiDownload, FiClock, FiCheck, FiAlertCircle, FiTarget
} from 'react-icons/fi';
import type { SessionUser } from '@/lib/auth';
import AppShell from '@/components/AppShell';
import Tabs from '@/components/Tabs';
import OrderDetailModalHost from '@/components/OrderDetailModal';
import ImageUploadModalHost from '@/components/ImageUploadModal';
import { showToast } from '@/components/Toast';
import { callServer, reload } from '@/lib/client';
import { fmtVND } from '@/lib/format';

type Row = {
  maDH: string; maVD: string; tenKH: string;
  tenHang: string; tuyen: string; conLai: number;
};

export default function KhoVnClient({ user, incomingShipments, atWarehouse, readyToDeliver }:
  { user: SessionUser; incomingShipments: Row[]; atWarehouse: Row[]; readyToDeliver: Row[] }) {

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

      <OrderDetailModalHost canSeeMoney={false} />
      <ImageUploadModalHost />
    </AppShell>
  );
}
