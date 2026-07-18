'use client';

import { useState } from 'react';
import { FiSettings, FiSave, FiInfo, FiClock, FiAlertTriangle } from 'react-icons/fi';
import { callServer } from '@/lib/client';
import { showToast } from '@/components/Toast';

type Row = { ten: string; giaTri: string; ghiChu: string };
type Known = { ten: string; nhan: string; ghiChu: string; macDinh?: string };

const KNOWN: Known[] = [
  { ten: 'ty_gia_ndt_vnd', nhan: 'Tỷ giá NDT → VND', ghiChu: 'Tỷ giá NDT → VND' },
  { ten: 'phi_mua_pct', nhan: 'Phí mua hàng (%)', ghiChu: 'Phí mua hàng (%)' },
  { ten: 'phi_bh_pct', nhan: 'Phí bảo hiểm (%)', ghiChu: 'Đặt 0 để bỏ thu phí bảo hiểm.' },
  { ten: 'bh_mac_dinh', nhan: 'Mặc định có tính bảo hiểm', ghiChu: '1 = có tính bảo hiểm cho mọi đơn (trừ khách/đơn tắt riêng); 0 = mặc định không tính.', macDinh: '1' },
  { ten: 'm3_chia', nhan: 'Hệ số quy đổi m³', ghiChu: 'm³ = dài × rộng × cao (cm) ÷ hệ số. Mặc định 1.000.000 (đơn vị cm).', macDinh: '1000000' },
  { ten: 'ten_cong_ty', nhan: 'Tên doanh nghiệp', ghiChu: 'Tên doanh nghiệp' },
  { ten: 'zalo_lien_he', nhan: 'Zalo liên hệ', ghiChu: 'Zalo liên hệ' },
  { ten: 'vi_bat_buoc', nhan: 'Bắt buộc ví khi khách tự đặt', ghiChu: 'Đặt 1 để bắt buộc khách có đủ số dư ví mới đặt được đơn; 0 = tắt.', macDinh: '0' },
  { ten: 'vi_coc_toi_thieu', nhan: 'Ví tối thiểu khi đặt (đ)', ghiChu: 'Mức ví tối thiểu khách phải có để đặt đơn (lấy số lớn hơn giữa mức này và tiền cọc). Chỉ áp dụng khi bật "Bắt buộc ví".', macDinh: '0' },
  { ten: 'gdv_chi_thay_don_minh', nhan: 'GDV chỉ thấy đơn của mình', ghiChu: 'Đặt 1 để mỗi giao dịch viên chỉ thấy đơn do mình phụ trách hoặc đơn của khách mình phụ trách; 0 = thấy mọi đơn.', macDinh: '0' }
];

export default function CaiDatClient(
  { rows, soKhachChuaPhan = 0, soDonMoCoi = 0 }:
  { rows: Row[]; soKhachChuaPhan?: number; soDonMoCoi?: number }
) {
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
    // Bật "GDV chỉ thấy đơn của mình" khi còn khách chưa phân công GDV → cảnh báo, không chặn cứng.
    if (ten === 'gdv_chi_thay_don_minh' && values[ten] === '1' && soKhachChuaPhan > 0) {
      const ok = confirm(
        `Còn ${soKhachChuaPhan} khách chưa phân công GDV. Khi bật, ${soDonMoCoi} đơn của họ sẽ không giao dịch viên nào nhìn thấy.\n\nVẫn muốn bật?`
      );
      if (!ok) return;
    }
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
            {r.ten === 'gdv_chi_thay_don_minh' && values[r.ten] === '1' && soKhachChuaPhan > 0 && (
              <div style={{
                marginTop: 8, padding: '10px 12px', borderRadius: 8,
                background: 'var(--danger-bg, #fef2f2)', border: '1px solid var(--danger, #ef4444)',
                color: 'var(--danger-dark, #b91c1c)', fontSize: 13, lineHeight: 1.5
              }}>
                <span className="icon-inline" style={{ fontWeight: 600 }}>
                  <FiAlertTriangle /> Còn {soKhachChuaPhan} khách chưa phân công GDV — {soDonMoCoi} đơn của họ sẽ không giao dịch viên nào nhìn thấy khi bật.
                </span>
                <div style={{ marginTop: 4 }}>
                  <a href="/admin/khach-hang" style={{ color: 'var(--primary)', fontWeight: 600 }}>Phân công ngay →</a>
                </div>
              </div>
            )}
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
