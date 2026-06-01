'use client';

import { useMemo, useState } from 'react';
import {
  FiLock, FiClock, FiDollarSign, FiCheckCircle, FiBarChart2, FiCreditCard, FiCheck,
  FiInfo, FiAlertCircle, FiArrowUpCircle, FiArrowDownCircle, FiInbox
} from 'react-icons/fi';
import type { SessionUser } from '@/lib/auth';
import AppShell from '@/components/AppShell';
import Tabs from '@/components/Tabs';
import Combobox from '@/components/Combobox';
import OrderDetailModalHost from '@/components/OrderDetailModal';
import { showToast } from '@/components/Toast';
import { callServer, reload } from '@/lib/client';
import { fmtVND, shortMoney, formatDateTime } from '@/lib/format';
import { statusToClass, statusToLabel } from '@/lib/status';

type Pending = {
  maDH: string; tenKH: string; maGD: string; nv: string;
  tongTien: number; daTra: number; conLai: number; trangThai: string;
};
type Cust = { maKH: string; tenKH: string; sdt: string; soDuVi: number };
type WalletTxn = {
  id: number; ngay: string; maKH: string; tenKH: string;
  loai: string; soTien: number; soDuSau: number; quy: string; ghiChu: string; nv: string;
};

const QUY = ['Tiền mặt', 'Ngân hàng', 'Ví điện tử', 'Hoàn tiền KH', 'Bù trừ đơn', 'Điều chỉnh', 'Khác'];

export default function KeToanClient({ user, pendingPayments, customers, walletTxns }: {
  user: SessionUser; pendingPayments: Pending[]; customers: Cust[]; walletTxns: WalletTxn[];
}) {
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

  // ===== Ví khách hàng =====
  const [wMaKH, setWMaKH] = useState('');
  const [wLoai, setWLoai] = useState<'Nap' | 'Tru'>('Nap');
  const [wTien, setWTien] = useState('');
  const [wQuy, setWQuy] = useState('Ngân hàng');
  const [wNote, setWNote] = useState('');
  const [wBusy, setWBusy] = useState(false);
  const selectedCust = customers.find((c) => c.maKH === wMaKH);

  async function submitWallet() {
    const soTien = parseFloat(wTien || '0');
    if (!wMaKH) return showToast('Chọn khách hàng', 'error');
    if (!soTien || soTien <= 0) return showToast('Số tiền không hợp lệ', 'error');
    if (!confirm(`${wLoai === 'Nap' ? 'NẠP' : 'TRỪ'} ${soTien.toLocaleString('vi-VN')}đ ${wLoai === 'Nap' ? 'vào' : 'khỏi'} ví ${wMaKH} (quỹ: ${wQuy})?`)) return;
    setWBusy(true);
    const r = await callServer('walletTxn', { maKH: wMaKH, loai: wLoai, soTien, quy: wQuy, ghiChu: wNote });
    setWBusy(false);
    if (r?.success) { showToast('Đã ghi giao dịch ví', 'success'); reload(); }
    else showToast(r?.message || 'Lỗi', 'error');
  }

  const quyTotals = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of walletTxns) {
      const k = t.quy || '(không định khoản)';
      m.set(k, (m.get(k) || 0) + (t.loai === 'Nap' ? t.soTien : -t.soTien));
    }
    return [...m.entries()];
  }, [walletTxns]);

  // ===== Tab 1: thanh toán =====
  const tabPay = (
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
          <div className="ac-meta">KH: <b>{o.tenKH}</b> · Mã GD: <b>{o.maGD || '(chưa có)'}</b> · NV: {o.nv}</div>
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
                onChange={(e) => setAmounts((p) => ({ ...p, [o.maDH]: e.target.value }))} disabled={busy[o.maDH]} />
              <div className="hint">Mặc định = Còn lại. Có thể sửa nếu khách trả 1 phần.</div>
            </div>
            <div className="form-field">
              <label>Ghi chú</label>
              <input type="text" value={notes[o.maDH] ?? ''}
                onChange={(e) => setNotes((p) => ({ ...p, [o.maDH]: e.target.value }))} placeholder="VD: Chuyển khoản Vietcombank" />
            </div>
          </div>
          <div className="ac-actions">
            <button className="btn btn-success" onClick={() => confirmPayment(o.maDH)} disabled={busy[o.maDH]}>
              <FiCheck /> Xác nhận đã nhận tiền
            </button>
          </div>
        </div>
      ))}
      <div className="alert alert-info" style={{ marginTop: 12 }}>
        <FiInfo /><span>Sau khi xác nhận: cột "Đã trả" tăng, "Còn lại" tự tính. Nếu đủ tiền → chuyển sang "Giao hàng".</span>
      </div>
    </div>
  );

  // ===== Tab 2: ví =====
  const tabWallet = (
    <>
      <div className="form-section">
        <div className="section-title"><FiDollarSign /> Nạp / trừ ví khách hàng (định khoản quỹ)</div>
        <div className="erp-fields">
          <div className="erp-field w-lg">
            <label>Khách hàng</label>
            <Combobox value={wMaKH} onChange={setWMaKH} placeholder="Gõ tên / mã KH…"
              options={customers.map((c) => ({ value: c.maKH, label: `${c.maKH} - ${c.tenKH}`, sub: `Ví ${fmtVND(c.soDuVi)}đ`, keywords: c.sdt }))} />
          </div>
          <div className="erp-field w-md">
            <label>Loại</label>
            <select value={wLoai} onChange={(e) => setWLoai(e.target.value as any)}>
              <option value="Nap">Nạp (+)</option><option value="Tru">Trừ (−)</option>
            </select>
          </div>
          <div className="erp-field w-md">
            <label>Số tiền (VNĐ)</label>
            <input type="number" value={wTien} onChange={(e) => setWTien(e.target.value)} placeholder="VD: 5000000" />
          </div>
          <div className="erp-field w-md">
            <label>Định khoản quỹ</label>
            <select value={wQuy} onChange={(e) => setWQuy(e.target.value)}>
              {QUY.map((q) => <option key={q} value={q}>{q}</option>)}
            </select>
          </div>
          <div className="erp-field w-lg">
            <label>Ghi chú</label>
            <input value={wNote} onChange={(e) => setWNote(e.target.value)} placeholder="VD: CK Vietcombank, hoàn tiền KN-..." />
          </div>
        </div>
        {selectedCust && (
          <div className="hint" style={{ marginTop: 8 }}>Số dư ví hiện tại của {selectedCust.maKH}: <b>{fmtVND(selectedCust.soDuVi)}đ</b></div>
        )}
        <div className="btn-row">
          <button className="btn btn-primary" onClick={submitWallet} disabled={wBusy}>
            {wBusy ? <FiClock /> : (wLoai === 'Nap' ? <FiArrowUpCircle /> : <FiArrowDownCircle />)} Ghi giao dịch
          </button>
        </div>
      </div>

      <div className="form-section">
        <div className="section-title"><FiBarChart2 /> Tổng theo định khoản quỹ (120 giao dịch gần nhất)</div>
        <div className="erp-fields">
          {quyTotals.map(([q, v]) => (
            <div key={q} className="erp-chip" style={{ minWidth: 150 }}>
              <span className="k">{q}</span>
              <span className="v" style={{ color: v >= 0 ? 'var(--success-dark)' : 'var(--danger-dark)' }}>{fmtVND(v)}đ</span>
            </div>
          ))}
          {quyTotals.length === 0 && <span className="muted">Chưa có giao dịch ví.</span>}
        </div>
      </div>

      <div className="form-section">
        <div className="section-title"><FiCreditCard /> Sổ giao dịch ví</div>
        {walletTxns.length === 0 ? (
          <div className="empty-state"><FiInbox /><p>Chưa có giao dịch ví nào.</p></div>
        ) : (
          <table className="data-table">
            <thead><tr>
              <th>Thời gian</th><th>Khách hàng</th><th>Loại</th><th className="number">Số tiền</th>
              <th>Định khoản</th><th className="number">Số dư sau</th><th>NV</th><th>Ghi chú</th>
            </tr></thead>
            <tbody>
              {walletTxns.map((t) => (
                <tr key={t.id}>
                  <td>{formatDateTime(t.ngay)}</td>
                  <td>{t.tenKH}<br /><span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{t.maKH}</span></td>
                  <td>
                    <span className={`status-badge ${t.loai === 'Nap' ? 's-paid' : 's-cancel'}`}>{t.loai === 'Nap' ? 'Nạp +' : 'Trừ −'}</span>
                  </td>
                  <td className="number" style={{ color: t.loai === 'Nap' ? 'var(--success-dark)' : 'var(--danger-dark)', fontWeight: 700 }}>
                    {t.loai === 'Nap' ? '+' : '−'}{fmtVND(t.soTien)}đ
                  </td>
                  <td>{t.quy || '-'}</td>
                  <td className="number">{fmtVND(t.soDuSau)}đ</td>
                  <td style={{ fontSize: 11 }}>{t.nv}</td>
                  <td style={{ fontSize: 12 }}>{t.ghiChu || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );

  return (
    <AppShell user={user}>
      <div className="alert alert-warning">
        <FiLock /><span>Bạn là <b>Kế toán</b>. Xác nhận thanh toán + quản lý ví/định khoản quỹ. KHÔNG sửa được nội dung đơn hàng.</span>
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
          <div className="kpi-label"><FiCheckCircle /> Số KH</div>
          <div className="kpi-value">{customers.length}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label"><FiBarChart2 /> GD ví gần đây</div>
          <div className="kpi-value">{walletTxns.length}</div>
        </div>
      </div>

      <Tabs tabs={[
        { id: 'pay', label: <><FiCreditCard /> Xác nhận thanh toán</>, content: tabPay },
        { id: 'wallet', label: <><FiDollarSign /> Ví khách hàng</>, content: tabWallet }
      ]} />

      <OrderDetailModalHost canSeeMoney={true} />
    </AppShell>
  );
}
