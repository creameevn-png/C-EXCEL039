'use client';

import { useState, useMemo } from 'react';
import { FiCheckCircle, FiArrowLeft, FiPlusCircle, FiPlus, FiX, FiClock, FiSend } from 'react-icons/fi';
import { callServer } from '@/lib/client';
import { showToast } from '@/components/Toast';
import { fmtVND, formatNDT } from '@/lib/format';
import { calcPhiVCPanama } from '@/lib/shipping-fee';

type Item = {
  tempId: number; tenSP: string; soLuong: number;
  donGiaNDT: number; tyGia: number; kg: number; m3: number;
  webNguon: string; linkTaobao: string;
};

let SEQ = 1;
const mk = (): Item => ({ tempId: SEQ++, tenSP: '', soLuong: 1, donGiaNDT: 0, tyGia: 3650, kg: 0, m3: 0, webNguon: '', linkTaobao: '' });

export default function DatHangClient({ kh }: { kh: { maKH: string; tenKH: string; pctCoc: number; tuyen: string } | null }) {
  const [items, setItems] = useState<Item[]>([mk()]);
  const [tuyen, setTuyen] = useState<'HaNoi' | 'HCM'>((kh?.tuyen as any) || 'HaNoi');
  const [pctCoc, setPctCoc] = useState(kh?.pctCoc || 70);
  const [ghiChu, setGhiChu] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  function patch(id: number, p: Partial<Item>) { setItems((prev) => prev.map((x) => x.tempId === id ? { ...x, ...p } : x)); }
  function add() { setItems((p) => [...p, mk()]); }
  function rm(id: number) { setItems((p) => p.length > 1 ? p.filter((x) => x.tempId !== id) : p); }

  const tot = useMemo(() => {
    const giaHang = items.reduce((s, it) => s + it.donGiaNDT * it.tyGia * it.soLuong, 0);
    const kg = items.reduce((s, it) => s + it.kg * it.soLuong, 0);
    const m3 = items.reduce((s, it) => s + it.m3 * it.soLuong, 0);
    const phiMua = Math.round(giaHang * 0.02 / 1000) * 1000;
    const phiBH = Math.round(giaHang * 0.01 / 1000) * 1000;
    const phiVC = calcPhiVCPanama(kg, m3, tuyen);
    const tong = giaHang + phiMua + phiBH + phiVC;
    const coc = Math.round(tong * pctCoc / 100 / 1000) * 1000;
    return { giaHang, kg, m3, phiMua, phiBH, phiVC, tong, coc };
  }, [items, tuyen, pctCoc]);

  async function submit() {
    if (!kh) return showToast('Cần chọn KH', 'error');
    const valid = items.filter((it) => it.tenSP.trim() && it.donGiaNDT > 0);
    if (valid.length === 0) return showToast('Cần ít nhất 1 SP', 'error');
    setBusy(true);
    const r = await callServer('createOrder', {
      maKH: kh.maKH, tuyen, pctCoc, ghiChu,
      chiTiet: valid.map((it) => ({
        tenSP: it.tenSP, soLuong: it.soLuong,
        donGiaNDT: it.donGiaNDT, tyGia: it.tyGia,
        kg: it.kg, m3: it.m3,
        webNguon: it.webNguon, linkTaobao: it.linkTaobao
      }))
    });
    setBusy(false);
    if (r?.success) setDone(r.maDH);
    else showToast(r?.message || 'Lỗi', 'error');
  }

  if (done) return (
    <div className="form-section">
      <div className="empty-state">
        <FiCheckCircle style={{ color: 'var(--success)' }} />
        <h2 style={{ color: 'var(--success-dark)', marginTop: 10 }}>Đã tạo đơn {done}</h2>
        <p style={{ marginTop: 8 }}>CSKH sẽ liên hệ xác nhận và hướng dẫn đặt cọc.</p>
        <a href={kh?.maKH ? `/customer` : '/tra-cuu'} className="btn btn-primary" style={{ marginTop: 16 }}><FiArrowLeft /> Về</a>
      </div>
    </div>
  );

  return (
    <div className="form-section">
      <div className="section-title"><FiPlusCircle /> Đặt đơn hàng mới</div>
      {kh && (
        <div style={{ background: '#F0FDF4', padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 13, color: '#065F46' }}>
          Khách hàng: <b>{kh.maKH} - {kh.tenKH}</b>
        </div>
      )}

      <div className="form-grid">
        <div className="form-field"><label>Tuyến</label>
          <select value={tuyen} onChange={(e) => setTuyen(e.target.value as any)}>
            <option value="HaNoi">Hà Nội</option><option value="HCM">HCM</option>
          </select></div>
        <div className="form-field"><label>% Cọc</label>
          <input type="number" min={0} max={100} value={pctCoc} onChange={(e) => setPctCoc(parseFloat(e.target.value) || 70)} /></div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <b>Sản phẩm ({items.length})</b>
          <button type="button" className="btn btn-success btn-sm" onClick={add}><FiPlus /> Thêm</button>
        </div>
        {items.map((it) => (
          <div key={it.tempId} style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: 10, marginBottom: 8, background: '#F8FAFC' }}>
            <div className="form-field">
              <label className="required">Tên sản phẩm</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="text" value={it.tenSP} onChange={(e) => patch(it.tempId, { tenSP: e.target.value })} style={{ flex: 1 }} placeholder="VD: Áo thun nam form rộng size L" />
                {items.length > 1 && <button type="button" className="btn btn-danger btn-sm" onClick={() => rm(it.tempId)}><FiX /></button>}
              </div>
            </div>
            <div className="form-grid-3" style={{ marginTop: 8 }}>
              <div className="form-field"><label>Số lượng</label>
                <input type="number" min={1} value={it.soLuong} onChange={(e) => patch(it.tempId, { soLuong: parseInt(e.target.value) || 1 })} /></div>
              <div className="form-field"><label>¥ Đơn giá NDT</label>
                <input type="number" step="0.01" value={it.donGiaNDT} onChange={(e) => patch(it.tempId, { donGiaNDT: parseFloat(e.target.value) || 0 })} /></div>
              <div className="form-field"><label>Tỷ giá</label>
                <input type="number" value={it.tyGia} onChange={(e) => patch(it.tempId, { tyGia: parseFloat(e.target.value) || 0 })} /></div>
            </div>
            <div className="form-grid-3" style={{ marginTop: 8 }}>
              <div className="form-field"><label>Kg/sp</label>
                <input type="number" step="0.01" value={it.kg} onChange={(e) => patch(it.tempId, { kg: parseFloat(e.target.value) || 0 })} /></div>
              <div className="form-field"><label>m³/sp</label>
                <input type="number" step="0.0001" value={it.m3} onChange={(e) => patch(it.tempId, { m3: parseFloat(e.target.value) || 0 })} /></div>
              <div className="form-field"><label>Web nguồn</label>
                <select value={it.webNguon} onChange={(e) => patch(it.tempId, { webNguon: e.target.value })}>
                  <option value="">--</option><option value="Taobao">Taobao</option>
                  <option value="1688">1688</option><option value="Tmall">Tmall</option>
                </select></div>
            </div>
            <div className="form-field" style={{ marginTop: 8 }}>
              <label>Link Taobao/1688</label>
              <input type="text" value={it.linkTaobao} onChange={(e) => patch(it.tempId, { linkTaobao: e.target.value })} placeholder="https://..." />
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: '#475569', textAlign: 'right' }}>
              Thành tiền: <b>{fmtVND(Math.round(it.donGiaNDT * it.tyGia * it.soLuong))}đ</b> ({formatNDT(it.donGiaNDT * it.soLuong)})
            </div>
          </div>
        ))}
      </div>

      <div className="form-field" style={{ marginTop: 12 }}>
        <label>Ghi chú</label>
        <input type="text" value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} placeholder="Ghi chú thêm cho đơn (nếu có)" />
      </div>

      <div className="fee-summary">
        <div className="fee-row"><span>Tổng giá hàng</span><span className="fee-value">{fmtVND(tot.giaHang)}đ</span></div>
        <div className="fee-row"><span>KG / M³</span><span className="fee-value">{tot.kg.toFixed(2)} / {tot.m3.toFixed(4)}</span></div>
        <div className="fee-row"><span>Phí VC ước tính</span><span className="fee-value">{fmtVND(tot.phiVC)}đ</span></div>
        <div className="fee-row"><span><b>Tổng tiền (ước tính)</b></span><span className="fee-value" style={{ color: '#1E3A8A' }}>{fmtVND(tot.tong)}đ</span></div>
        <div className="fee-row"><span>Cọc ({pctCoc}%)</span><span className="fee-value" style={{ color: '#92400E' }}>{fmtVND(tot.coc)}đ</span></div>
      </div>

      <div className="btn-row">
        <button className="btn btn-primary" onClick={submit} disabled={busy}>{busy ? <><FiClock /> Đang gửi...</> : <><FiSend /> Gửi đơn</>}</button>
      </div>
    </div>
  );
}
