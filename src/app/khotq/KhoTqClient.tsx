'use client';

import {
  FiInfo, FiClock, FiPackage, FiTruck, FiCheckCircle, FiDownload, FiCheck, FiLock
} from 'react-icons/fi';
import type { SessionUser } from '@/lib/auth';
import AppShell from '@/components/AppShell';
import Tabs from '@/components/Tabs';
import OrderDetailModalHost from '@/components/OrderDetailModal';
import ImageUploadModalHost from '@/components/ImageUploadModal';
import { showToast } from '@/components/Toast';
import { callServer, reload } from '@/lib/client';

type Row = {
  maDH: string; maVD: string; tenHang: string;
  kg: number; m3: number; web: string; tuyen: string;
};

export default function KhoTqClient({ user, pendingArrivals, atWarehouse }:
  { user: SessionUser; pendingArrivals: Row[]; atWarehouse: Row[] }) {

  function confirmKhoTQ(maDH: string) {
    (window as any).openImageUploadModal?.('Xác nhận nhận hàng tại Kho TQ', maDH, async (img: string | null) => {
      const r = await callServer('confirmKhoTQ', maDH, img);
      if (r?.success) {
        showToast(img ? 'Đã xác nhận + lưu ảnh' : 'Đã xác nhận', 'success');
        reload();
      } else showToast(r?.message || 'Lỗi', 'error');
    });
  }

  function markLeftTQ(maDH: string) {
    (window as any).openImageUploadModal?.('Đánh dấu hàng rời TQ', maDH, async (img: string | null) => {
      const r = await callServer('markLeftTQ', maDH, img);
      if (r?.success) {
        showToast(img ? 'Hàng đã rời TQ + lưu ảnh' : 'Hàng đã rời TQ', 'success');
        reload();
      } else showToast(r?.message || 'Lỗi', 'error');
    });
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
          <div className="ac-meta">
            Đơn: <b style={{ cursor: 'pointer', textDecoration: 'underline', color: '#1E3A8A' }}
                    onClick={() => (window as any).openOrderDetail?.(o.maDH)}>{o.maDH}</b> ·
            Hàng: {o.tenHang} · {o.kg}kg · {o.m3}m³ · {o.web}
          </div>
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
            <th>Mã VĐ</th><th>Mã đơn</th><th>Hàng</th><th>Kg/M³</th><th>Tuyến</th><th>Thao tác</th>
          </tr></thead>
          <tbody>
            {atWarehouse.map((o) => (
              <tr key={o.maDH}>
                <td className="ma-don">{o.maVD}</td>
                <td>{o.maDH}</td>
                <td>{o.tenHang}</td>
                <td>{o.kg} / {o.m3}</td>
                <td>{o.tuyen}</td>
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
        <div className="kpi" style={{ ['--primary' as any]: '#3b82f6' }}>
          <div className="kpi-label"><FiTruck /> Đang VC về VN</div>
          <div className="kpi-value">-</div>
        </div>
        <div className="kpi" style={{ ['--primary' as any]: '#10b981' }}>
          <div className="kpi-label"><FiCheckCircle /> Xử lý hôm nay</div>
          <div className="kpi-value">-</div>
        </div>
      </div>

      <Tabs tabs={[
        { id: 'tab-receive', label: <><FiDownload /> Chờ nhận từ NCC ({pendingArrivals.length})</>, content: tabReceive },
        { id: 'tab-ship', label: <><FiTruck /> Chuyển về VN ({atWarehouse.length})</>, content: tabShip }
      ]} />

      <div className="alert alert-lock">
        <FiLock /><span><b>Bạn KHÔNG thấy:</b> Giá tiền · Tên KH · Phí · Thông tin tài chính</span>
      </div>

      <OrderDetailModalHost canSeeMoney={false} />
      <ImageUploadModalHost />
    </AppShell>
  );
}
