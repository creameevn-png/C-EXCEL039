'use client';

import { useState } from 'react';
import { FiDollarSign, FiX, FiSend } from 'react-icons/fi';
import { callServer } from '@/lib/client';
import { showToast } from '@/components/Toast';
import { formatCurrency } from '@/lib/format';

// Z1c — nút "Yêu cầu rút tiền": khách nhập số tiền, gửi cho Kế toán xử lý.
export default function RutTienButton({ maKH, soDuVi }: { maKH: string; soDuVi: number }) {
  const [open, setOpen] = useState(false);
  const [soTien, setSoTien] = useState('');
  const [busy, setBusy] = useState(false);

  async function gui() {
    const tien = parseFloat(soTien) || 0;
    if (tien <= 0) return showToast('Số tiền rút phải lớn hơn 0', 'error');
    if (tien > soDuVi) return showToast('Số tiền rút vượt quá số dư ví', 'error');
    setBusy(true);
    const r = await callServer('yeuCauRutVi', maKH, tien);
    setBusy(false);
    if (r?.success) {
      showToast('Đã gửi yêu cầu rút, Kế toán sẽ xử lý.', 'success');
      setOpen(false);
      setSoTien('');
    } else {
      showToast(r?.message || 'Không gửi được yêu cầu rút', 'error');
    }
  }

  return (
    <>
      <button type="button" className="btn btn-primary" style={{ padding: 18, fontSize: 14 }} onClick={() => setOpen(true)}>
        <FiDollarSign /> Yêu cầu rút tiền
      </button>

      <div className={`modal-overlay ${open ? 'show' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header"><h2><FiDollarSign /> Yêu cầu rút tiền</h2><button className="modal-close" onClick={() => setOpen(false)}><FiX /></button></div>
          <div className="modal-body">
            <div className="form-field"><label className="required">Số tiền rút</label>
              <input type="number" min={0} value={soTien} onChange={(e) => setSoTien(e.target.value)} placeholder="Nhập số tiền..." /></div>
            <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-faint)' }}>Số dư ví: {formatCurrency(soDuVi)}</div>
          </div>
          <div className="btn-row">
            <button className="btn btn-secondary" onClick={() => setOpen(false)}>Hủy</button>
            <button className="btn btn-success" onClick={gui} disabled={busy}><FiSend /> Gửi yêu cầu</button>
          </div>
        </div>
      </div>
    </>
  );
}
