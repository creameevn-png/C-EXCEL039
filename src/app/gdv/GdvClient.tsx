'use client';

import { useState } from 'react';
import {
  FiInfo, FiEdit3, FiClock, FiTruck, FiPackage, FiSave, FiLock, FiFileText
} from 'react-icons/fi';
import type { SessionUser } from '@/lib/auth';
import AppShell from '@/components/AppShell';
import Tabs from '@/components/Tabs';
import OrderDetailModalHost from '@/components/OrderDetailModal';
import { showToast } from '@/components/Toast';
import { callServer, reload } from '@/lib/client';
import { fmtVND } from '@/lib/format';

type Pending = {
  maDH: string; tenKH: string; web: string; tongKg: number; tuyen: string;
  tongTien: number; daTra: number; tenHang: string;
  maGD: string; maVD: string; trangThai: string;
};

export default function GdvClient({ user, pendingOrders }: { user: SessionUser; pendingOrders: Pending[] }) {
  const ordersDeposit = pendingOrders.filter((o) => o.trangThai === 'DatCoc');
  const ordersBought = pendingOrders.filter((o) => o.trangThai === 'DaMuaHang');

  const [gdInputs, setGdInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(pendingOrders.map((o) => [o.maDH, o.maGD || ''])));
  const [vdInputs, setVdInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(pendingOrders.map((o) => [o.maDH, o.maVD || ''])));
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  async function submitMaGD(maDH: string) {
    const maGD = (gdInputs[maDH] || '').trim();
    if (!maGD) return showToast('Vui lòng nhập mã GD', 'error');
    if (!confirm(`Lưu Mã GD "${maGD}" cho đơn ${maDH}?`)) return;
    setBusy((p) => ({ ...p, [maDH]: true }));
    const r = await callServer('updateMaGD', maDH, maGD);
    setBusy((p) => ({ ...p, [maDH]: false }));
    if (r?.success) { showToast(`Đã lưu mã GD cho ${maDH}`, 'success'); reload(); }
    else showToast(r?.message || 'Lỗi', 'error');
  }

  async function submitMaVD(maDH: string) {
    const maVD = (vdInputs[maDH] || '').trim();
    if (!maVD) return showToast('Vui lòng nhập mã VĐ', 'error');
    if (!confirm(`Lưu Mã VĐ "${maVD}" cho đơn ${maDH}?`)) return;
    setBusy((p) => ({ ...p, [maDH]: true }));
    const r = await callServer('updateMaVD', maDH, maVD);
    setBusy((p) => ({ ...p, [maDH]: false }));
    if (r?.success) { showToast(`Đã lưu mã VĐ cho ${maDH}`, 'success'); reload(); }
    else showToast(r?.message || 'Lỗi', 'error');
  }

  const tabDeposit = (
    <div className="form-section">
      <div className="section-title"><FiEdit3 /> Đơn đặt cọc — cần mua hàng từ NCC</div>
      {ordersDeposit.length === 0 ? (
        <div className="empty-state"><FiPackage /><p>Không có đơn nào chờ mua.</p></div>
      ) : ordersDeposit.map((o) => (
        <div key={o.maDH} className="action-card" style={{ opacity: busy[o.maDH] ? 0.5 : 1 }}>
          <div className="ac-header">
            <div className="ac-title" style={{ cursor: 'pointer', textDecoration: 'underline' }}
                 onClick={() => (window as any).openOrderDetail?.(o.maDH)}>{o.maDH}</div>
            <span className="status-badge s-deposit">Đặt cọc</span>
          </div>
          <div className="ac-meta">KH: <b>{o.tenKH}</b> · Web: <b>{o.web}</b> · {o.tongKg}kg · {o.tuyen === 'HCM' ? 'HCM' : 'Hà Nội'}</div>
          <div className="ac-amount">
            <div>Tổng tiền: <b>{fmtVND(o.tongTien)}đ</b></div>
            <div>Đã cọc: <b style={{ color: '#059669' }}>{fmtVND(o.daTra)}đ</b></div>
          </div>
          <div className="ac-meta icon-inline" style={{ marginTop: 8 }}><FiFileText /><b>Hàng:</b> {o.tenHang}</div>
          <div className="form-grid" style={{ margin: '12px 0' }}>
            <div className="form-field">
              <label className="required">Mã giao dịch (NCC)</label>
              <input type="text" value={gdInputs[o.maDH] ?? ''}
                onChange={(e) => setGdInputs((p) => ({ ...p, [o.maDH]: e.target.value }))}
                placeholder="VD: TB1234567890" disabled={busy[o.maDH]} />
              <div className="hint">Mã đơn hàng bên NCC (Taobao/1688/Tmall)</div>
            </div>
          </div>
          <div className="ac-actions">
            <button className="btn btn-primary" onClick={() => submitMaGD(o.maDH)} disabled={busy[o.maDH]}>
              <FiSave /> Lưu mã GD + chuyển sang "Đã mua"
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  const tabBought = (
    <div className="form-section">
      <div className="section-title"><FiClock /> Đã mua — chờ NCC phát hàng và nhập mã VĐ</div>
      {ordersBought.length === 0 ? (
        <div className="empty-state"><FiPackage /><p>Không có đơn nào chờ mã VĐ.</p></div>
      ) : ordersBought.map((o) => (
        <div key={o.maDH} className="action-card" style={{ opacity: busy[o.maDH] ? 0.5 : 1 }}>
          <div className="ac-header">
            <div className="ac-title" style={{ cursor: 'pointer', textDecoration: 'underline' }}
                 onClick={() => (window as any).openOrderDetail?.(o.maDH)}>{o.maDH}</div>
            <span className="status-badge s-bought">Đã mua hàng</span>
          </div>
          <div className="ac-meta">KH: <b>{o.tenKH}</b> · Web: <b>{o.web}</b> · Mã GD: <b>{o.maGD || '(chưa có)'}</b></div>
          <div className="form-grid" style={{ margin: '12px 0' }}>
            <div className="form-field">
              <label className="required">Mã vận đơn (từ NCC)</label>
              <input type="text" value={vdInputs[o.maDH] ?? ''}
                onChange={(e) => setVdInputs((p) => ({ ...p, [o.maDH]: e.target.value }))}
                placeholder="VD: VD26050042"
                style={{ borderColor: '#F59E0B', background: '#FEF3C7' }} disabled={busy[o.maDH]} />
              <div className="hint" style={{ color: '#92400E' }}>NCC gửi mã này khi phát hàng đi kho Bằng Tường</div>
            </div>
          </div>
          <div className="ac-actions">
            <button className="btn btn-warning" onClick={() => submitMaVD(o.maDH)} disabled={busy[o.maDH]}>
              <FiSave /> Lưu mã VĐ + chuyển sang "NCC giao hàng"
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <AppShell user={user}>
      <div className="alert alert-info">
        <FiInfo /><span>Bạn là <b>GDV</b>. Chỉ được sửa <b>Mã GD</b> và <b>Mã VĐ</b>.</span>
      </div>

      <div className="kpi-row">
        <div className="kpi" style={{ ['--primary' as any]: '#0891b2' }}>
          <div className="kpi-label"><FiEdit3 /> Đơn cần mua</div>
          <div className="kpi-value">{ordersDeposit.length}</div>
          <div className="kpi-sub">Đặt cọc, chờ mua</div>
        </div>
        <div className="kpi" style={{ ['--primary' as any]: '#f59e0b' }}>
          <div className="kpi-label"><FiClock /> Chờ mã VĐ</div>
          <div className="kpi-value">{ordersBought.length}</div>
          <div className="kpi-sub">NCC chưa phát hàng</div>
        </div>
        <div className="kpi" style={{ ['--primary' as any]: '#3b82f6' }}>
          <div className="kpi-label"><FiTruck /> Đang VC</div>
          <div className="kpi-value">-</div>
        </div>
        <div className="kpi" style={{ ['--primary' as any]: '#10b981' }}>
          <div className="kpi-label"><FiPackage /> Tổng hôm nay</div>
          <div className="kpi-value">{pendingOrders.length}</div>
        </div>
      </div>

      <Tabs tabs={[
        { id: 'tab-deposit', label: <><FiEdit3 /> Đơn cần mua ({ordersDeposit.length})</>, content: tabDeposit },
        { id: 'tab-bought', label: <><FiClock /> Chờ mã VĐ ({ordersBought.length})</>, content: tabBought }
      ]} />

      <div className="alert alert-lock">
        <FiLock /><span><b>Bạn KHÔNG được sửa:</b> Tổng tiền · Tiền cọc · Trạng thái · Tên KH · Giá hàng · Phí</span>
      </div>

      <OrderDetailModalHost canSeeMoney={false} />
    </AppShell>
  );
}
