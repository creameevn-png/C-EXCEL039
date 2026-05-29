'use client';

import { useState } from 'react';
import { FiSettings, FiSave, FiInfo, FiClock } from 'react-icons/fi';
import { callServer } from '@/lib/client';
import { showToast } from '@/components/Toast';

type Row = { ten: string; giaTri: string; ghiChu: string };

const KNOWN = [
  { ten: 'ty_gia_ndt_vnd', ghiChu: 'Tỷ giá NDT → VND' },
  { ten: 'phi_mua_pct', ghiChu: 'Phí mua hàng (%)' },
  { ten: 'phi_bh_pct', ghiChu: 'Phí bảo hiểm (%)' },
  { ten: 'ten_cong_ty', ghiChu: 'Tên doanh nghiệp' },
  { ten: 'zalo_lien_he', ghiChu: 'Zalo liên hệ' }
];

export default function CaiDatClient({ rows }: { rows: Row[] }) {
  const map = new Map(rows.map((r) => [r.ten, r]));
  const display = KNOWN.map((k) => ({
    ten: k.ten,
    giaTri: map.get(k.ten)?.giaTri || '',
    ghiChu: map.get(k.ten)?.ghiChu || k.ghiChu
  }));

  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(display.map((r) => [r.ten, r.giaTri]))
  );
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  async function save(ten: string, ghiChu: string) {
    setBusy((p) => ({ ...p, [ten]: true }));
    const r = await callServer('setSetting', ten, values[ten], ghiChu);
    setBusy((p) => ({ ...p, [ten]: false }));
    if (r?.success) showToast('Đã lưu ' + ten, 'success');
    else showToast(r?.message || 'Lỗi', 'error');
  }

  return (
    <div className="form-section">
      <div className="section-title"><FiSettings /> Cài đặt hệ thống</div>
      <p className="hint icon-inline" style={{ marginBottom: 14 }}>
        <FiInfo /> Các cài đặt áp dụng ngay sau khi lưu (cache 30s).
      </p>
      {display.map((r) => (
        <div key={r.ten} className="form-grid" style={{ marginBottom: 12, alignItems: 'end' }}>
          <div className="form-field">
            <label>{r.ten}</label>
            <input type="text" value={values[r.ten] ?? ''}
              onChange={(e) => setValues({ ...values, [r.ten]: e.target.value })}
              disabled={busy[r.ten]} />
            <div className="hint">{r.ghiChu}</div>
          </div>
          <div className="form-field">
            <label>&nbsp;</label>
            <button className="btn btn-primary" onClick={() => save(r.ten, r.ghiChu)} disabled={busy[r.ten]}>
              {busy[r.ten] ? <FiClock /> : <><FiSave /> Lưu</>}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
