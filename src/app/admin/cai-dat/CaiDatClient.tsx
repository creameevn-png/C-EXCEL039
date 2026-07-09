'use client';

import { useState } from 'react';
import { FiSettings, FiSave, FiInfo, FiClock } from 'react-icons/fi';
import { callServer } from '@/lib/client';
import { showToast } from '@/components/Toast';

type Row = { ten: string; giaTri: string; ghiChu: string };
type Known = { ten: string; nhan: string; ghiChu: string; macDinh?: string };

const KNOWN: Known[] = [
  { ten: 'ty_gia_ndt_vnd', nhan: 'Tỷ giá NDT → VND', ghiChu: 'Tỷ giá NDT → VND' },
  { ten: 'phi_mua_pct', nhan: 'Phí mua hàng (%)', ghiChu: 'Phí mua hàng (%)' },
  { ten: 'phi_bh_pct', nhan: 'Phí bảo hiểm (%)', ghiChu: 'Đặt 0 để bỏ thu phí bảo hiểm.' },
  { ten: 'm3_chia', nhan: 'Hệ số quy đổi m³', ghiChu: 'm³ = dài × rộng × cao (cm) ÷ hệ số. Mặc định 1.000.000 (đơn vị cm).', macDinh: '1000000' },
  { ten: 'ten_cong_ty', nhan: 'Tên doanh nghiệp', ghiChu: 'Tên doanh nghiệp' },
  { ten: 'zalo_lien_he', nhan: 'Zalo liên hệ', ghiChu: 'Zalo liên hệ' }
];

export default function CaiDatClient({ rows }: { rows: Row[] }) {
  const map = new Map(rows.map((r) => [r.ten, r]));
  const display = KNOWN.map((k) => ({
    ten: k.ten,
    nhan: k.nhan,
    giaTri: map.get(k.ten)?.giaTri || k.macDinh || '',
    ghiChu: k.ghiChu
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
            <label>{r.nhan}</label>
            <input type="text" value={values[r.ten] ?? ''}
              onChange={(e) => setValues({ ...values, [r.ten]: e.target.value })}
              disabled={busy[r.ten]} />
            <div className="hint"><code>{r.ten}</code> · {r.ghiChu}</div>
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
