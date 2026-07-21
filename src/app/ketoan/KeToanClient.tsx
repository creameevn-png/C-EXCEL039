'use client';

import { useMemo, useState } from 'react';
import {
  FiLock, FiClock, FiDollarSign, FiCheckCircle, FiBarChart2, FiCreditCard, FiCheck,
  FiInfo, FiAlertCircle, FiArrowUpCircle, FiArrowDownCircle, FiInbox,
  FiThumbsUp, FiThumbsDown, FiTrash2, FiFileText, FiHome, FiPackage
} from 'react-icons/fi';
import type { SessionUser } from '@/lib/auth';
import AppShell from '@/components/AppShell';
import Tabs from '@/components/Tabs';
import Combobox from '@/components/Combobox';
import OrderDetailModalHost from '@/components/OrderDetailModal';
import CustomerDetailModalHost from '@/components/CustomerDetailModal';
import { showToast } from '@/components/Toast';
import { callServer, reload } from '@/lib/client';
import { fmtVND, shortMoney, formatDateTime } from '@/lib/format';
import { statusToClass, statusToLabel } from '@/lib/status';

type Pending = {
  maDH: string; maKH: string; tenKH: string; maGD: string; nv: string;
  tongTien: number; daTra: number; conLai: number; phiKhieuNai: number; trangThai: string;
};
type Cust = { maKH: string; tenKH: string; soDuVi: number };
type WalletTxn = {
  id: number; ngay: string; maKH: string; tenKH: string;
  loai: string; soTien: number; soDuSau: number; quy: string; ghiChu: string; nv: string;
};
type PendingFee = {
  maDH: string; maKH: string; tenKH: string; phiPhatSinh: number; nguoiTao: string; ngayTao: string;
};
type SoQuyRow = {
  id: number; ngay: string; quy: string; loai: 'Thu' | 'Chi';
  soTien: number; danhMuc: string; noiDung: string; maDH: string; maKH: string; nguoiTao: string;
};

const QUY = ['Tiền mặt', 'Ngân hàng', 'Ví điện tử', 'Hoàn tiền KH', 'Bù trừ đơn', 'Điều chỉnh', 'Khác'];
const DINH_KHOAN_CONGTY = ['Lương nhân viên', 'Thuê văn phòng', 'Điện nước', 'Marketing', 'Thiết bị', 'Thu khác', 'Chi khác'];

function quyLabel(q: string) {
  if (q === 'KhoVN') return 'Quỹ kho VN';
  if (q === 'KhoTQ') return 'Quỹ kho TQ';
  if (q === 'CongTy') return 'Quỹ công ty';
  return q;
}

export default function KeToanClient({ user, pendingPayments, customers, walletTxns, pendingFees, soQuyCongTy, soQuyKho }: {
  user: SessionUser; pendingPayments: Pending[]; customers: Cust[]; walletTxns: WalletTxn[];
  pendingFees: PendingFee[]; soQuyCongTy: SoQuyRow[]; soQuyKho: SoQuyRow[];
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

  // ===== Duyệt phí phát sinh (#9) =====
  const [feeNotes, setFeeNotes] = useState<Record<string, string>>({});
  const [feeBusy, setFeeBusy] = useState<Record<string, boolean>>({});
  const totalPendingFee = pendingFees.reduce((s, o) => s + (o.phiPhatSinh || 0), 0);

  async function decidePhi(maDH: string, accepted: boolean) {
    const note = feeNotes[maDH] || '';
    if (!accepted && !confirm(`Từ chối phí phát sinh đơn ${maDH}? Phí sẽ bị xoá khỏi đơn.`)) return;
    setFeeBusy((p) => ({ ...p, [maDH]: true }));
    const r = await callServer('duyetPhiPhatSinh', maDH, accepted, note);
    setFeeBusy((p) => ({ ...p, [maDH]: false }));
    if (r?.success) { showToast(accepted ? 'Đã duyệt phí phát sinh' : 'Đã từ chối phí phát sinh', 'success'); reload(); }
    else showToast(r?.message || 'Lỗi', 'error');
  }

  // ===== Thu chi nội bộ — quỹ công ty (#22) =====
  const [sqLoai, setSqLoai] = useState<'Thu' | 'Chi'>('Chi');
  const [sqTien, setSqTien] = useState('');
  const [sqDanhMuc, setSqDanhMuc] = useState(DINH_KHOAN_CONGTY[0]);
  const [sqNoiDung, setSqNoiDung] = useState('');
  const [sqMaDH, setSqMaDH] = useState('');
  const [sqMaKH, setSqMaKH] = useState('');
  const [sqBusy, setSqBusy] = useState(false);

  async function submitSoQuy() {
    const soTien = parseFloat(sqTien || '0');
    if (!soTien || soTien <= 0) return showToast('Số tiền không hợp lệ', 'error');
    if (!sqNoiDung.trim()) return showToast('Nhập nội dung bút toán', 'error');
    setSqBusy(true);
    const r = await callServer('addSoQuy', {
      quy: 'CongTy', loai: sqLoai, soTien, noiDung: sqNoiDung.trim(),
      danhMuc: sqDanhMuc, maDH: sqMaDH.trim() || undefined, maKH: sqMaKH.trim() || undefined
    });
    setSqBusy(false);
    if (r?.success) {
      showToast('Đã ghi bút toán', 'success');
      setSqTien(''); setSqNoiDung(''); setSqMaDH(''); setSqMaKH('');
      reload();
    } else showToast(r?.message || 'Lỗi', 'error');
  }

  async function removeSoQuy(id: number) {
    if (!confirm('Xoá bút toán này khỏi sổ quỹ?')) return;
    const r = await callServer('deleteSoQuy', id);
    if (r?.success) { showToast('Đã xoá bút toán', 'success'); reload(); }
    else showToast(r?.message || 'Lỗi', 'error');
  }

  const congTyTotals = useMemo(() => {
    let thu = 0, chi = 0;
    for (const r of soQuyCongTy) { if (r.loai === 'Thu') thu += r.soTien; else chi += r.soTien; }
    return { thu, chi, chenh: thu - chi };
  }, [soQuyCongTy]);

  // ===== Quỹ kho — chỉ đọc (#42) =====
  const khoTotals = useMemo(() => {
    const m = new Map<string, { thu: number; chi: number }>();
    for (const r of soQuyKho) {
      const cur = m.get(r.quy) || { thu: 0, chi: 0 };
      if (r.loai === 'Thu') cur.thu += r.soTien; else cur.chi += r.soTien;
      m.set(r.quy, cur);
    }
    return [...m.entries()];
  }, [soQuyKho]);

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
          <div className="ac-meta">KH: <b>{o.maKH
            ? <span style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--primary)' }} onClick={() => (window as any).openCustomerDetail?.(o.maKH)}>{o.tenKH}</span>
            : o.tenKH}</b> · Mã GD: <b>{o.maGD || '(chưa có)'}</b> · NV: {o.nv}</div>
          <div className="ac-amount">
            <div>Tổng tiền: <b>{fmtVND(o.tongTien)}đ</b></div>
            <div>Đã trả: <b className="text-success">{fmtVND(o.daTra)}đ</b></div>
          </div>
          <div className="icon-inline" style={{ background: '#FEE2E2', color: '#991b1b', padding: 10, borderRadius: 6, margin: '10px 0', fontSize: 13 }}>
            <FiAlertCircle /> <b>Còn lại cần thu: {fmtVND(o.conLai)}đ</b>
            {/* Góp ý NV #47: nói rõ vì sao đơn đã giao vẫn còn khoản phải thu. */}
            {o.phiKhieuNai > 0 && <span style={{ marginLeft: 8 }}>· trong đó phí đổi trả (khiếu nại): <b>{fmtVND(o.phiKhieuNai)}đ</b></span>}
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
              options={customers.map((c) => ({ value: c.maKH, label: `${c.maKH} - ${c.tenKH}`, sub: `Ví ${fmtVND(c.soDuVi)}đ` }))} />
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
                  <td>{t.maKH
                    ? <span style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--primary)' }} onClick={() => (window as any).openCustomerDetail?.(t.maKH)}>{t.tenKH}</span>
                    : t.tenKH}<br /><span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{t.maKH}</span></td>
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

  // ===== Tab 3: duyệt phí phát sinh (#9) =====
  const tabPhi = (
    <div className="form-section">
      <div className="section-title"><FiThumbsUp /> Đơn chờ duyệt phí phát sinh ({pendingFees.length} đơn · {fmtVND(totalPendingFee)}đ)</div>
      <div className="alert alert-info" style={{ marginBottom: 12 }}>
        <FiInfo /><span>Phí phát sinh chỉ được cộng vào tổng tiền đơn <b>sau khi Kế toán duyệt</b>. Từ chối sẽ xoá phí khỏi đơn.</span>
      </div>
      {pendingFees.length === 0 ? (
        <div className="empty-state"><FiCheckCircle /><p>Không có phí phát sinh nào chờ duyệt.</p></div>
      ) : pendingFees.map((o) => (
        <div key={o.maDH} className="action-card" style={{ opacity: feeBusy[o.maDH] ? 0.5 : 1 }}>
          <div className="ac-header">
            <div className="ac-title" style={{ cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => (window as any).openOrderDetail?.(o.maDH)}>{o.maDH}</div>
            <span className="status-badge s-waiting">Chờ duyệt</span>
          </div>
          <div className="ac-meta">KH: <b>{o.tenKH}</b> · Mã KH: <b>{o.maKH
            ? <span style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--primary)' }} onClick={() => (window as any).openCustomerDetail?.(o.maKH)}>{o.maKH}</span>
            : '-'}</b> · Người tạo đơn: {o.nguoiTao || '-'} · {formatDateTime(o.ngayTao)}</div>
          <div className="icon-inline" style={{ background: '#FEF3C7', color: '#92400e', padding: 10, borderRadius: 6, margin: '10px 0', fontSize: 14 }}>
            <FiDollarSign /> <b>Phí phát sinh chờ duyệt: {fmtVND(o.phiPhatSinh)}đ</b>
          </div>
          <div className="form-field" style={{ margin: '12px 0' }}>
            <label>Ghi chú (lý do duyệt / từ chối)</label>
            <input type="text" value={feeNotes[o.maDH] ?? ''}
              onChange={(e) => setFeeNotes((p) => ({ ...p, [o.maDH]: e.target.value }))}
              placeholder="VD: Đã xác nhận với CSKH" disabled={feeBusy[o.maDH]} />
          </div>
          <div className="ac-actions">
            <button className="btn btn-success" onClick={() => decidePhi(o.maDH, true)} disabled={feeBusy[o.maDH]}>
              <FiThumbsUp /> Duyệt
            </button>
            <button className="btn btn-danger" onClick={() => decidePhi(o.maDH, false)} disabled={feeBusy[o.maDH]}>
              <FiThumbsDown /> Từ chối
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  // ===== Tab 4: thu chi nội bộ (#22) + quỹ kho chỉ đọc (#42) =====
  const tabQuy = (
    <>
      <div className="form-section">
        <div className="section-title"><FiFileText /> Thêm bút toán quỹ công ty</div>
        <div className="erp-fields">
          <div className="erp-field w-md">
            <label>Loại</label>
            <select value={sqLoai} onChange={(e) => setSqLoai(e.target.value as any)}>
              <option value="Thu">Thu (+)</option><option value="Chi">Chi (−)</option>
            </select>
          </div>
          <div className="erp-field w-md">
            <label>Số tiền (VNĐ)</label>
            <input type="number" value={sqTien} onChange={(e) => setSqTien(e.target.value)} placeholder="VD: 5000000" />
          </div>
          <div className="erp-field w-md">
            <label>Định khoản</label>
            <select value={sqDanhMuc} onChange={(e) => setSqDanhMuc(e.target.value)}>
              {DINH_KHOAN_CONGTY.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="erp-field w-lg">
            <label>Nội dung</label>
            <input value={sqNoiDung} onChange={(e) => setSqNoiDung(e.target.value)} placeholder="VD: Trả lương tháng 6" />
          </div>
          <div className="erp-field w-md">
            <label>Mã đơn (tuỳ chọn)</label>
            <input value={sqMaDH} onChange={(e) => setSqMaDH(e.target.value)} placeholder="VD: DH-..." />
          </div>
          <div className="erp-field w-md">
            <label>Mã KH (tuỳ chọn)</label>
            <input value={sqMaKH} onChange={(e) => setSqMaKH(e.target.value)} placeholder="VD: KH-..." />
          </div>
        </div>
        <div className="btn-row">
          <button className="btn btn-primary" onClick={submitSoQuy} disabled={sqBusy}>
            {sqBusy ? <FiClock /> : <FiCheck />} Ghi bút toán
          </button>
        </div>
      </div>

      <div className="form-section">
        <div className="section-title"><FiBarChart2 /> Tổng thu chi quỹ công ty</div>
        <div className="erp-fields">
          <div className="erp-chip" style={{ minWidth: 160 }}>
            <span className="k">Tổng thu</span>
            <span className="v" style={{ color: 'var(--success-dark)' }}>{fmtVND(congTyTotals.thu)}đ</span>
          </div>
          <div className="erp-chip" style={{ minWidth: 160 }}>
            <span className="k">Tổng chi</span>
            <span className="v" style={{ color: 'var(--danger-dark)' }}>{fmtVND(congTyTotals.chi)}đ</span>
          </div>
          <div className="erp-chip" style={{ minWidth: 160 }}>
            <span className="k">Chênh lệch</span>
            <span className="v" style={{ color: congTyTotals.chenh >= 0 ? 'var(--success-dark)' : 'var(--danger-dark)' }}>{fmtVND(congTyTotals.chenh)}đ</span>
          </div>
        </div>
      </div>

      <div className="form-section">
        <div className="section-title"><FiFileText /> Sổ quỹ công ty (200 bút toán gần nhất)</div>
        {soQuyCongTy.length === 0 ? (
          <div className="empty-state"><FiInbox /><p>Chưa có bút toán nào.</p></div>
        ) : (
          <table className="data-table">
            <thead><tr>
              <th>Thời gian</th><th>Loại</th><th className="number">Số tiền</th>
              <th>Định khoản</th><th>Nội dung</th><th>Người tạo</th><th></th>
            </tr></thead>
            <tbody>
              {soQuyCongTy.map((r) => (
                <tr key={r.id}>
                  <td>{formatDateTime(r.ngay)}</td>
                  <td><span className={`status-badge ${r.loai === 'Thu' ? 's-paid' : 's-cancel'}`}>{r.loai === 'Thu' ? 'Thu +' : 'Chi −'}</span></td>
                  <td className="number" style={{ color: r.loai === 'Thu' ? 'var(--success-dark)' : 'var(--danger-dark)', fontWeight: 700 }}>
                    {r.loai === 'Thu' ? '+' : '−'}{fmtVND(r.soTien)}đ
                  </td>
                  <td>{r.danhMuc || '-'}</td>
                  <td style={{ fontSize: 12 }}>
                    {r.noiDung || '-'}
                    {(r.maDH || r.maKH) && <span style={{ fontSize: 10, color: 'var(--text-faint)' }}><br />
                      {r.maDH && <span style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--primary)' }} onClick={() => (window as any).openOrderDetail?.(r.maDH)}>{r.maDH}</span>}
                      {r.maDH && r.maKH ? ' · ' : ''}{r.maKH
                        ? <span style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--primary)' }} onClick={() => (window as any).openCustomerDetail?.(r.maKH)}>{r.maKH}</span>
                        : ''}</span>}
                  </td>
                  <td style={{ fontSize: 11 }}>{r.nguoiTao || '-'}</td>
                  <td>
                    <button className="btn btn-sm btn-danger" onClick={() => removeSoQuy(r.id)} title="Xoá bút toán"><FiTrash2 /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="form-section">
        <div className="section-title"><FiHome /> Quỹ kho (chỉ đọc)</div>
        <div className="alert alert-info" style={{ marginBottom: 12 }}>
          <FiInfo /><span>Kế toán chỉ <b>xem</b> quỹ kho VN / kho TQ. Việc ghi quỹ kho do chính tài khoản kho thực hiện.</span>
        </div>
        <div className="erp-fields">
          {khoTotals.map(([q, v]) => (
            <div key={q} className="erp-chip" style={{ minWidth: 180 }}>
              <span className="k">{quyLabel(q)} — tồn quỹ</span>
              <span className="v" style={{ color: (v.thu - v.chi) >= 0 ? 'var(--success-dark)' : 'var(--danger-dark)' }}>{fmtVND(v.thu - v.chi)}đ</span>
            </div>
          ))}
          {khoTotals.length === 0 && <span className="muted">Chưa có bút toán quỹ kho.</span>}
        </div>
        {soQuyKho.length === 0 ? (
          <div className="empty-state"><FiPackage /><p>Chưa có bút toán quỹ kho nào.</p></div>
        ) : (
          <table className="data-table" style={{ marginTop: 12 }}>
            <thead><tr>
              <th>Thời gian</th><th>Quỹ</th><th>Loại</th><th className="number">Số tiền</th>
              <th>Định khoản</th><th>Nội dung</th><th>Người tạo</th>
            </tr></thead>
            <tbody>
              {soQuyKho.map((r) => (
                <tr key={r.id}>
                  <td>{formatDateTime(r.ngay)}</td>
                  <td>{quyLabel(r.quy)}</td>
                  <td><span className={`status-badge ${r.loai === 'Thu' ? 's-paid' : 's-cancel'}`}>{r.loai === 'Thu' ? 'Thu +' : 'Chi −'}</span></td>
                  <td className="number" style={{ color: r.loai === 'Thu' ? 'var(--success-dark)' : 'var(--danger-dark)', fontWeight: 700 }}>
                    {r.loai === 'Thu' ? '+' : '−'}{fmtVND(r.soTien)}đ
                  </td>
                  <td>{r.danhMuc || '-'}</td>
                  <td style={{ fontSize: 12 }}>
                    {r.noiDung || '-'}
                    {(r.maDH || r.maKH) && <span style={{ fontSize: 10, color: 'var(--text-faint)' }}><br />
                      {r.maDH && <span style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--primary)' }} onClick={() => (window as any).openOrderDetail?.(r.maDH)}>{r.maDH}</span>}
                      {r.maDH && r.maKH ? ' · ' : ''}{r.maKH
                        ? <span style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--primary)' }} onClick={() => (window as any).openCustomerDetail?.(r.maKH)}>{r.maKH}</span>
                        : ''}</span>}
                  </td>
                  <td style={{ fontSize: 11 }}>{r.nguoiTao || '-'}</td>
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
        <div className="kpi" style={{ ['--primary' as any]: '#d97706' }}>
          <div className="kpi-label"><FiThumbsUp /> Phí chờ duyệt</div>
          <div className="kpi-value">{pendingFees.length}</div>
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
        { id: 'phi', label: <><FiThumbsUp /> Duyệt phí phát sinh{pendingFees.length > 0 ? ` (${pendingFees.length})` : ''}</>, content: tabPhi },
        { id: 'quy', label: <><FiFileText /> Thu chi nội bộ</>, content: tabQuy },
        { id: 'wallet', label: <><FiDollarSign /> Ví khách hàng</>, content: tabWallet }
      ]} />

      <CustomerDetailModalHost canSeeMoney={true} />
      <OrderDetailModalHost canSeeMoney={true} />
    </AppShell>
  );
}
