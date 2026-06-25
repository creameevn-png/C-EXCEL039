'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  FiCheckCircle, FiArrowLeft, FiSend, FiClock, FiPlus, FiX,
  FiFileText, FiUser, FiShoppingCart, FiDollarSign, FiEdit3, FiBox, FiRefreshCw
} from 'react-icons/fi';
import { callServer } from '@/lib/client';
import { showToast } from '@/components/Toast';
import ErpSection from '@/components/ErpSection';
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
  const [today, setToday] = useState('');

  useEffect(() => { setToday(new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })); }, []);

  function patch(id: number, p: Partial<Item>) { setItems((prev) => prev.map((x) => x.tempId === id ? { ...x, ...p } : x)); }
  function add() { setItems((p) => [...p, mk()]); }
  function rm(id: number) { setItems((p) => p.length > 1 ? p.filter((x) => x.tempId !== id) : p); }
  function reset() { setItems([mk()]); setGhiChu(''); }

  const tot = useMemo(() => {
    const giaHang = items.reduce((s, it) => s + it.donGiaNDT * it.tyGia * it.soLuong, 0);
    const sl = items.reduce((s, it) => s + it.soLuong, 0);
    const kg = items.reduce((s, it) => s + it.kg * it.soLuong, 0);
    const m3 = items.reduce((s, it) => s + it.m3 * it.soLuong, 0);
    const phiMua = Math.round(giaHang * 0.02 / 1000) * 1000;
    const phiVC = calcPhiVCPanama(kg, m3, tuyen);
    const tong = giaHang + phiMua + phiVC;
    const coc = Math.round(tong * pctCoc / 100 / 1000) * 1000;
    return { giaHang, sl, kg, m3, phiMua, phiVC, tong, coc };
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

  const backHref = kh?.maKH ? '/customer' : '/tra-cuu';

  if (done) return (
    <div className="erp-sec">
      <div className="empty-state">
        <FiCheckCircle style={{ color: 'var(--success)' }} />
        <h2 style={{ color: 'var(--success-dark)', marginTop: 10 }}>Đã tạo đơn {done}</h2>
        <p style={{ marginTop: 8 }}>CSKH sẽ liên hệ xác nhận và hướng dẫn đặt cọc.</p>
        <a href={backHref} className="btn btn-primary" style={{ marginTop: 16 }}><FiArrowLeft /> Về</a>
      </div>
    </div>
  );

  return (
    <div className="erp-doc">
      {/* Thanh trên cùng: tiêu đề + chip tổng tiền */}
      <div className="erp-bar">
        <div className="erp-bar-title">
          <FiShoppingCart />
          <div>
            Đơn đặt hàng mới
            <div className="sub">{kh ? `${kh.maKH} · ${kh.tenKH}` : 'Khách tự đặt'}</div>
          </div>
        </div>
        <div className="erp-chips">
          <div className="erp-chip accent">
            <span className="k">Σ Tổng tiền</span>
            <span className="v">{fmtVND(tot.tong)}đ</span>
          </div>
          <div className="erp-chip warn">
            <span className="k">Σ Cọc ({pctCoc}%)</span>
            <span className="v">{fmtVND(tot.coc)}đ</span>
          </div>
        </div>
      </div>

      <div className="erp-layout">
        <div className="erp-main">
          {/* THÔNG TIN ĐƠN & KHÁCH HÀNG */}
          <ErpSection icon={<FiFileText />} title="Thông tin đơn & khách hàng">
            <div className="erp-fields">
              <div className="erp-field locked w-md"><label>Số đơn</label><input readOnly value="Tự động" /></div>
              <div className="erp-field locked w-md"><label>Ngày tạo</label><input readOnly value={today} /></div>
              <div className="erp-field w-md">
                <label>Tuyến</label>
                <select value={tuyen} onChange={(e) => setTuyen(e.target.value as any)}>
                  <option value="HaNoi">Hà Nội</option><option value="HCM">HCM</option>
                </select>
              </div>
              <div className="erp-field w-sm">
                <label>% Cọc</label>
                <input type="number" min={0} max={100} value={pctCoc} onChange={(e) => setPctCoc(parseFloat(e.target.value) || 70)} />
              </div>
              {kh && <>
                <div className="erp-field locked w-md"><label>Mã KH</label><input readOnly value={kh.maKH} /></div>
                <div className="erp-field locked w-lg"><label>Tên khách hàng</label><input readOnly value={kh.tenKH} /></div>
              </>}
            </div>
            {!kh && (
              <div className="alert alert-info" style={{ marginTop: 8, marginBottom: 0 }}>
                <FiUser /> Đơn khách tự đặt — CSKH sẽ xác nhận và gán mã khách hàng.
              </div>
            )}
          </ErpSection>

          {/* ITEMS */}
          <ErpSection
            icon={<FiBox />}
            title={`Sản phẩm (${items.length})`}
            right={<button type="button" className="btn btn-sm btn-success" onClick={add}><FiPlus /> Thêm dòng</button>}
          >
            <div className="erp-items-wrap">
              <table className="erp-items">
                <thead>
                  <tr>
                    <th rowSpan={2} style={{ width: 46 }}>#</th>
                    <th rowSpan={2}>Sản phẩm</th>
                    <th rowSpan={2} className="num" style={{ width: 72 }}>SL</th>
                    <th rowSpan={2} style={{ width: 56 }}>ĐVT</th>
                    <th colSpan={2} className="grp">Đơn giá nhập</th>
                    <th colSpan={2} className="grp">TL / sản phẩm</th>
                    <th rowSpan={2} style={{ width: 104 }}>Nguồn</th>
                    <th rowSpan={2} className="num" style={{ width: 128 }}>Thành tiền (đ)</th>
                    <th rowSpan={2} style={{ width: 42 }}></th>
                  </tr>
                  <tr>
                    <th className="num" style={{ width: 96 }}>¥ / sp</th>
                    <th className="num" style={{ width: 90 }}>Tỷ giá</th>
                    <th className="num" style={{ width: 72 }}>Kg</th>
                    <th className="num" style={{ width: 80 }}>M³</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => {
                    const tt = Math.round(it.donGiaNDT * it.tyGia * it.soLuong);
                    return (
                      <tr key={it.tempId}>
                        <td><span className="erp-rownum"><FiBox />{i + 1}</span></td>
                        <td>
                          <input className="erp-cell" value={it.tenSP} placeholder="Tên sản phẩm…"
                            onChange={(e) => patch(it.tempId, { tenSP: e.target.value })} />
                          <input className="erp-cell erp-cell-sub" value={it.linkTaobao} placeholder="Link Taobao / 1688 (nếu có)"
                            onChange={(e) => patch(it.tempId, { linkTaobao: e.target.value })} />
                        </td>
                        <td className="num">
                          <input className="erp-cell num" type="number" min={1} value={it.soLuong}
                            onChange={(e) => patch(it.tempId, { soLuong: parseInt(e.target.value) || 1 })} />
                        </td>
                        <td><span className="erp-uom">cái</span></td>
                        <td className="num">
                          <input className="erp-cell num" type="number" step="0.01" inputMode="decimal" value={it.donGiaNDT}
                            onChange={(e) => patch(it.tempId, { donGiaNDT: parseFloat(e.target.value) || 0 })} />
                        </td>
                        <td className="num">
                          <input className="erp-cell num" type="number" inputMode="decimal" value={it.tyGia}
                            onChange={(e) => patch(it.tempId, { tyGia: parseFloat(e.target.value) || 0 })} />
                        </td>
                        <td className="num">
                          <input className="erp-cell num" type="number" step="0.01" inputMode="decimal" value={it.kg}
                            onChange={(e) => patch(it.tempId, { kg: parseFloat(e.target.value) || 0 })} />
                        </td>
                        <td className="num">
                          <input className="erp-cell num" type="number" step="0.0001" inputMode="decimal" value={it.m3}
                            onChange={(e) => patch(it.tempId, { m3: parseFloat(e.target.value) || 0 })} />
                        </td>
                        <td>
                          <select className="erp-cell" value={it.webNguon} onChange={(e) => patch(it.tempId, { webNguon: e.target.value })}>
                            <option value="">—</option><option value="Taobao">Taobao</option>
                            <option value="1688">1688</option><option value="Tmall">Tmall</option>
                          </select>
                        </td>
                        <td className="num">
                          <div className="erp-amt">
                            <b>{fmtVND(tt)}</b>
                            <div className="erp-amt-sub">{formatNDT(it.donGiaNDT * it.soLuong)}</div>
                          </div>
                        </td>
                        <td>
                          {items.length > 1 && (
                            <button type="button" className="erp-rm" onClick={() => rm(it.tempId)} title="Xoá dòng"><FiX /></button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td><button type="button" className="erp-add" onClick={add} title="Thêm dòng"><FiPlus /></button></td>
                    <td className="erp-foot-lbl"># {items.length} dòng</td>
                    <td className="num">Σ {tot.sl}</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td className="num">Σ {tot.kg.toFixed(2)}</td>
                    <td className="num">Σ {tot.m3.toFixed(4)}</td>
                    <td></td>
                    <td className="num"><b>Σ {fmtVND(tot.giaHang)}</b></td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </ErpSection>

          {/* FEES */}
          <ErpSection icon={<FiDollarSign />} title="Chi phí & thanh toán">
            <div className="erp-fee-row"><span className="lbl">Tiền hàng</span><span className="v">{fmtVND(tot.giaHang)}đ</span></div>
            <div className="erp-fee-row"><span className="lbl">Phí mua hàng (2%)</span><span className="v">{fmtVND(tot.phiMua)}đ</span></div>
            <div className="erp-fee-row"><span className="lbl">Phí vận chuyển ({tot.kg.toFixed(2)} kg / {tot.m3.toFixed(4)} m³)</span><span className="v">{fmtVND(tot.phiVC)}đ</span></div>
            <div className="erp-fee-row total"><span className="lbl">Tổng tiền (ước tính)</span><span className="v">{fmtVND(tot.tong)}đ</span></div>
            <div className="erp-fee-row coc"><span className="lbl">Cọc ({pctCoc}%)</span><span className="v">{fmtVND(tot.coc)}đ</span></div>
          </ErpSection>

          {/* NOTE */}
          <ErpSection icon={<FiEdit3 />} title="Ghi chú">
            <div className="form-field">
              <textarea value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} placeholder="Ghi chú thêm cho đơn (nếu có)…" />
            </div>
          </ErpSection>
        </div>

        {/* THANH TÁC VỤ */}
        <aside className="erp-rail">
          <button type="button" className="erp-rail-btn primary" onClick={submit} disabled={busy}>
            {busy ? <FiClock /> : <FiSend />}
            {busy ? 'Đang gửi…' : 'Gửi đơn'}
          </button>
          <button type="button" className="erp-rail-btn" onClick={add}><FiPlus /> Thêm dòng</button>
          <button type="button" className="erp-rail-btn danger" onClick={reset}><FiRefreshCw /> Làm mới</button>
          <a href={backHref} className="erp-rail-btn"><FiArrowLeft /> Quay lại</a>
        </aside>
      </div>
    </div>
  );
}
