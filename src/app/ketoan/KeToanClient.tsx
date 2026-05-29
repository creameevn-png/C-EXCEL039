'use client';

import { useState } from 'react';
import {
  FiLock, FiClock, FiDollarSign, FiCheckCircle, FiBarChart2, FiCreditCard, FiCheck, FiInfo, FiAlertCircle
} from 'react-icons/fi';
import type { SessionUser } from '@/lib/auth';
import AppShell from '@/components/AppShell';
import OrderDetailModalHost from '@/components/OrderDetailModal';
import { showToast } from '@/components/Toast';
import { callServer, reload } from '@/lib/client';
import { fmtVND, shortMoney } from '@/lib/format';
import { statusToClass, statusToLabel } from '@/lib/status';

type Pending = {
  maDH: string; tenKH: string; maGD: string; nv: string;
  tongTien: number; daTra: number; conLai: number; trangThai: string;
};

export default function KeToanClient({ user, pendingPayments }: { user: SessionUser; pendingPayments: Pending[] }) {
  const totalToCollect = pendingPayments.reduce((s, o) => s + (o.conLai || 0), 0);

  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(pendingPayments.map((o) => [o.maDH, String(o.conLai)])));
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  async function confirmPayment(maDH: string) {
    const amount = parseFloat(amounts[maDH] || '0');
    const note = notes[maDH] || '';
    if (!amount || amount <= 0) return showToast('Số tiền không hợp lệ', 'error');
    if (!confirm(`Đã nhận ${amount.toLocaleString('vi-VN')}đ cho ${maDH}?`)) return;
    setBusy((p) => ({ ...p, [maDH]: true }));
    const r = await callServer('confirmPayment', maDH, amount, note);
    setBusy((p) => ({ ...p, [maDH]: false }));
    if (r?.success) { showToast(`Đã nhận ${amount.toLocaleString('vi-VN')}đ`, 'success'); reload(); }
    else showToast(r?.message || 'Lỗi', 'error');
  }

  return (
    <AppShell user={user}>
      <div className="alert alert-warning">
        <FiLock /><span>Bạn là <b>Kế toán</b>. CHỈ được phép xác nhận thanh toán. KHÔNG sửa được nội dung đơn hàng.</span>
      </div>

      <div className="kpi-row">
        <div className="kpi" style={{ ['--primary' as any]: '#f59e0b' }}>
          <div className="kpi-label"><FiClock /> Chờ xác nhận TT</div>
          <div className="kpi-value">{pendingPayments.length}</div>
        </div>
        <div className="kpi" style={{ ['--primary' as any]: '#ef4444' }}>
          <div className="kpi-label"><FiDollarSign /> Tổng cần thu</div>
          <div className="kpi-value">{shortMoney(totalToCollect)}</div>
        </div>
        <div className="kpi" style={{ ['--primary' as any]: '#10b981' }}>
          <div className="kpi-label"><FiCheckCircle /> Hoàn thành</div>
          <div className="kpi-value">-</div>
        </div>
        <div className="kpi">
          <div className="kpi-label"><FiBarChart2 /> Hôm nay</div>
          <div className="kpi-value">-</div>
        </div>
      </div>

      <div className="form-section">
        <div className="section-title"><FiCreditCard /> Đơn chờ xác nhận thanh toán ({pendingPayments.length} đơn)</div>
        {pendingPayments.length === 0 ? (
          <div className="empty-state"><FiCheckCircle /><p>Không có đơn nào chờ xác nhận.</p></div>
        ) : pendingPayments.map((o) => (
            <div key={o.maDH} className="action-card" style={{ opacity: busy[o.maDH] ? 0.5 : 1 }}>
              <div className="ac-header">
                <div className="ac-title" style={{ cursor: 'pointer', textDecoration: 'underline' }}
                     onClick={() => (window as any).openOrderDetail?.(o.maDH)}>{o.maDH}</div>
                <span className={`status-badge ${statusToClass(o.trangThai)}`}>{statusToLabel(o.trangThai)}</span>
              </div>
              <div className="ac-meta">
                KH: <b>{o.tenKH}</b> · Mã GD: <b>{o.maGD || '(chưa có)'}</b> · NV: {o.nv}
              </div>
              <div className="ac-amount">
                <div>Tổng tiền: <b>{fmtVND(o.tongTien)}đ</b></div>
                <div>Đã trả: <b className="text-success">{fmtVND(o.daTra)}đ</b></div>
              </div>
              <div className="icon-inline" style={{ background: '#FEE2E2', color: '#991b1b', padding: 10, borderRadius: 6, margin: '10px 0', fontSize: 13 }}>
                <FiAlertCircle /> <b>Còn lại cần thu: {fmtVND(o.conLai)}đ</b>
              </div>
              <div className="form-grid" style={{ margin: '12px 0' }}>
                <div className="form-field">
                  <label className="required">Số tiền nhận thêm (VNĐ)</label>
                  <input type="number" value={amounts[o.maDH] ?? ''}
                    onChange={(e) => setAmounts((p) => ({ ...p, [o.maDH]: e.target.value }))}
                    disabled={busy[o.maDH]} />
                  <div className="hint">Mặc định = Còn lại. Có thể sửa nếu khách trả 1 phần.</div>
                </div>
                <div className="form-field">
                  <label>Ghi chú</label>
                  <input type="text" value={notes[o.maDH] ?? ''}
                    onChange={(e) => setNotes((p) => ({ ...p, [o.maDH]: e.target.value }))}
                    placeholder="VD: Chuyển khoản Vietcombank" />
                </div>
              </div>
              <div className="ac-actions">
                <button className="btn btn-success" onClick={() => confirmPayment(o.maDH)} disabled={busy[o.maDH]}>
                  <FiCheck /> Xác nhận đã nhận tiền
                </button>
                <button className="btn" style={{ color: 'var(--text-faint)', cursor: 'not-allowed' }} disabled>
                  <FiLock /> Sửa đơn (cấm)
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="alert alert-info">
          <FiInfo /><span>Sau khi xác nhận: cột "Đã trả" tăng, "Còn lại" tự tính. Nếu đủ tiền → chuyển sang "Giao hàng".</span>
        </div>

      <OrderDetailModalHost canSeeMoney={true} />
    </AppShell>
  );
}
