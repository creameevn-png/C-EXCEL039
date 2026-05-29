'use client';

import { useMemo, useState } from 'react';
import {
  FiPlusCircle, FiPlus, FiX, FiPackage, FiDollarSign, FiUsers, FiUserPlus,
  FiInbox, FiClipboard, FiCheckCircle, FiClock, FiLock, FiCheck, FiEdit3
} from 'react-icons/fi';
import type { SessionUser } from '@/lib/auth';
import AppShell from '@/components/AppShell';
import Tabs from '@/components/Tabs';
import OrderDetailModalHost from '@/components/OrderDetailModal';
import ImageUploadModalHost from '@/components/ImageUploadModal';
import { showToast } from '@/components/Toast';
import { callServer, reload } from '@/lib/client';
import { fmtVND, fmtDateDDMM, formatNDT } from '@/lib/format';
import { statusToLabel, statusToClass } from '@/lib/status';
import { calcPhiVCPanama } from '@/lib/shipping-fee';

type Customer = { maKH: string; tenKH: string; sdt: string; pctCoc: number; soDuVi: number; congNo: number };
type Product = { maSP: string; tenSP: string; kgGoiY: number; m3GoiY: number; giaThamKhao: number; webNguon: string };
type MyOrder = { maDH: string; ngayTao: string; tenKH: string; tenHang: string; tongTien: number; daTra: number; conLai: number; trangThai: string };

type LineItem = {
  tempId: number;
  spId: string;
  tenSP: string;
  soLuong: number;
  donGiaNDT: number;
  tyGia: number;
  kg: number;
  m3: number;
  webNguon: string;
  linkTaobao: string;
};

type Props = {
  initial: {
    user: SessionUser;
    appName: string;
    tyGia: number;
    customers: Customer[];
    products: Product[];
    myOrders: MyOrder[];
    kpi: { myOrdersToday: number; completed: number; inProgress: number; customers: number };
  };
};

let LINE_SEQ = 1;
function mkLine(p?: Partial<LineItem>, tyGia = 3650): LineItem {
  return {
    tempId: LINE_SEQ++,
    spId: '', tenSP: '', soLuong: 1,
    donGiaNDT: 0, tyGia,
    kg: 0, m3: 0, webNguon: '', linkTaobao: '',
    ...p
  };
}

export default function CskhClient({ initial }: Props) {
  const { user, customers: customersInit, products: productsInit, myOrders, kpi, tyGia } = initial;
  const [customers, setCustomers] = useState<Customer[]>(customersInit);
  const [products, setProducts] = useState<Product[]>(productsInit);

  const [maKH, setMaKH] = useState('');
  const [tuyen, setTuyen] = useState<'HaNoi' | 'HCM'>('HaNoi');
  const [lineVC, setLineVC] = useState<'LineNhanh' | 'LineThuong' | 'LineRe'>('LineThuong');
  const [loaiHang, setLoaiHang] = useState('Thường');
  const [shipND, setShipND] = useState(0);
  const [dongGoi, setDongGoi] = useState(0);
  const [phuThu, setPhuThu] = useState(0);
  const [pctCoc, setPctCoc] = useState(70);
  const [ghiChu, setGhiChu] = useState('');
  const [hintCoc, setHintCoc] = useState('% cọc sẽ tự động lấy từ thông tin KH');
  const [submitting, setSubmitting] = useState(false);

  const [items, setItems] = useState<LineItem[]>([mkLine({}, tyGia)]);

  // ===== Topup modal =====
  const [topupOpen, setTopupOpen] = useState(false);
  const [topupMaKH, setTopupMaKH] = useState('');
  const [topupName, setTopupName] = useState('');
  const [topupAmount, setTopupAmount] = useState('');
  const [topupNote, setTopupNote] = useState('');

  // ===== Add KH modal =====
  const [addKhOpen, setAddKhOpen] = useState(false);
  const [addKh, setAddKh] = useState({ tenKH: '', sdt: '', tuyen: 'HaNoi', diaChi: '', email: '', pctCoc: 70 });
  const [addKhBusy, setAddKhBusy] = useState(false);

  // ===== Add SP modal =====
  const [addSpOpen, setAddSpOpen] = useState(false);
  const [addSp, setAddSp] = useState({ tenSP: '', danhMuc: '', webNguon: '', kg: 0, m3: 0, gia: 0, ghiChu: '' });
  const [addSpBusy, setAddSpBusy] = useState(false);
  const [addSpTargetLine, setAddSpTargetLine] = useState<number | null>(null);

  function onCustomerChange(v: string) {
    setMaKH(v);
    const c = customers.find((x) => x.maKH === v);
    if (!c) { setHintCoc('% cọc sẽ tự động lấy từ thông tin KH'); return; }
    setPctCoc(c.pctCoc);
    setHintCoc(`Đã lấy ${c.pctCoc}% cọc từ KH`);
  }

  function updateItem(tempId: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((x) => x.tempId === tempId ? { ...x, ...patch } : x));
  }
  function addItem() { setItems((prev) => [...prev, mkLine({}, tyGia)]); }
  function removeItem(id: number) {
    setItems((prev) => prev.length > 1 ? prev.filter((x) => x.tempId !== id) : prev);
  }
  function onPickProduct(itemId: number, spId: string) {
    if (!spId) { updateItem(itemId, { spId: '', tenSP: '' }); return; }
    if (spId === '__custom__') { updateItem(itemId, { spId: '__custom__', tenSP: '' }); return; }
    const p = products.find((x) => x.maSP === spId);
    if (!p) return;
    updateItem(itemId, {
      spId,
      tenSP: p.tenSP,
      kg: p.kgGoiY || 0,
      m3: p.m3GoiY || 0,
      donGiaNDT: p.giaThamKhao && tyGia ? Math.round(p.giaThamKhao / tyGia * 100) / 100 : 0,
      webNguon: p.webNguon
    });
  }

  const totals = useMemo(() => {
    const tongGiaHang = items.reduce((s, it) =>
      s + (Number(it.donGiaNDT) || 0) * (Number(it.tyGia) || 0) * (Number(it.soLuong) || 0), 0);
    const totalKg = items.reduce((s, it) => s + (Number(it.kg) || 0) * (Number(it.soLuong) || 0), 0);
    const totalM3 = items.reduce((s, it) => s + (Number(it.m3) || 0) * (Number(it.soLuong) || 0), 0);
    const phiMua = Math.round((tongGiaHang * 0.02) / 1000) * 1000;
    const phiBH = Math.round((tongGiaHang * 0.01) / 1000) * 1000;
    const phiVC = calcPhiVCPanama(totalKg, totalM3, tuyen);
    const tong = tongGiaHang + phiMua + phiBH + phiVC + (Number(shipND) || 0) + (Number(dongGoi) || 0) + (Number(phuThu) || 0);
    const coc = Math.round((tong * pctCoc) / 100 / 1000) * 1000;
    return { tongGiaHang, totalKg, totalM3, phiMua, phiBH, phiVC, tong, coc };
  }, [items, tuyen, shipND, dongGoi, phuThu, pctCoc]);

  function resetCreateForm() {
    setMaKH(''); setTuyen('HaNoi'); setLineVC('LineThuong'); setLoaiHang('Thường');
    setShipND(0); setDongGoi(0); setPhuThu(0); setPctCoc(70); setGhiChu('');
    setItems([mkLine({}, tyGia)]);
  }

  async function submitCreateOrder() {
    const c = customers.find((x) => x.maKH === maKH);
    if (!c) return showToast('Vui lòng chọn khách hàng', 'error');
    const validItems = items.filter((it) => it.tenSP.trim() && it.donGiaNDT > 0);
    if (validItems.length === 0) return showToast('Cần ít nhất 1 SP có tên + giá NDT', 'error');
    setSubmitting(true);
    const r = await callServer('createOrder', {
      maKH, tuyen, lineVC, loaiHang,
      pctCoc,
      phiShipND: shipND, phiDongGoi: dongGoi, phiPhuThu: phuThu,
      ghiChu,
      chiTiet: validItems.map((it) => ({
        tenSP: it.tenSP,
        soLuong: it.soLuong,
        donGiaNDT: it.donGiaNDT,
        tyGia: it.tyGia,
        kg: it.kg, m3: it.m3,
        webNguon: it.webNguon, linkTaobao: it.linkTaobao
      }))
    });
    setSubmitting(false);
    if (r?.success) {
      showToast('Đã tạo đơn ' + r.maDH, 'success');
      reload();
    } else showToast(r?.message || 'Có lỗi xảy ra', 'error');
  }

  async function confirmDepositOrder(maDH: string) {
    if (!confirm(`Xác nhận khách đã chuyển cọc cho đơn ${maDH}?\n\nĐơn sẽ chuyển sang "Đặt cọc" để GDV mua hàng.`)) return;
    const r = await callServer('confirmDeposit', maDH);
    if (r?.success) { showToast(`Đã xác nhận cọc cho ${maDH} (${fmtVND(r.tienCoc)}đ)`, 'success'); reload(); }
    else showToast(r?.message || 'Lỗi', 'error');
  }

  function openTopupModal(c: Customer) {
    setTopupMaKH(c.maKH); setTopupName(`${c.maKH} - ${c.tenKH}`);
    setTopupAmount(''); setTopupNote(''); setTopupOpen(true);
  }
  async function submitTopup() {
    const amount = parseFloat(topupAmount);
    if (!amount || amount <= 0) return showToast('Số tiền không hợp lệ', 'error');
    if (!confirm(`Nạp ${amount.toLocaleString('vi-VN')}đ cho ${topupMaKH}?`)) return;
    const r = await callServer('topupWallet', topupMaKH, amount, topupNote || 'Nạp ví');
    if (r?.success) { showToast(`Đã nạp ${amount.toLocaleString('vi-VN')}đ`, 'success'); setTopupOpen(false); reload(); }
    else showToast(r?.message || 'Có lỗi', 'error');
  }

  function openAddCustomerModal() {
    setAddKh({ tenKH: '', sdt: '', tuyen: 'HaNoi', diaChi: '', email: '', pctCoc: 70 }); setAddKhOpen(true);
  }
  async function submitAddCustomer() {
    if (!addKh.tenKH.trim()) return showToast('Vui lòng nhập tên KH', 'error');
    setAddKhBusy(true);
    const r = await callServer('addCustomer', addKh);
    setAddKhBusy(false);
    if (r?.success) {
      showToast(`Đã tạo KH ${r.maKH} - ${r.tenKH}`, 'success');
      setCustomers((prev) => [...prev, { maKH: r.maKH, tenKH: r.tenKH, sdt: addKh.sdt, pctCoc: r.pctCoc, soDuVi: 0, congNo: 0 }]);
      setMaKH(r.maKH);
      setPctCoc(r.pctCoc);
      setHintCoc(`Đã lấy ${r.pctCoc}% cọc từ KH`);
      setAddKhOpen(false);
    } else showToast(r?.message || 'Có lỗi', 'error');
  }

  function openAddProductModal(itemId: number) {
    const it = items.find((x) => x.tempId === itemId);
    setAddSp({
      tenSP: it?.tenSP || '', danhMuc: '',
      webNguon: it?.webNguon || '',
      kg: it?.kg || 0, m3: it?.m3 || 0,
      gia: (it?.donGiaNDT || 0) * (it?.tyGia || tyGia),
      ghiChu: ''
    });
    setAddSpTargetLine(itemId);
    setAddSpOpen(true);
  }
  async function submitAddProduct() {
    if (!addSp.tenSP.trim()) return showToast('Vui lòng nhập tên SP', 'error');
    setAddSpBusy(true);
    const r = await callServer('addProduct', addSp);
    setAddSpBusy(false);
    if (r?.success) {
      showToast(`Đã thêm SP ${r.maSP}`, 'success');
      const newP: Product = {
        maSP: r.maSP, tenSP: r.tenSP, kgGoiY: r.kg, m3GoiY: r.m3,
        giaThamKhao: r.gia, webNguon: addSp.webNguon
      };
      setProducts((prev) => [...prev, newP]);
      if (addSpTargetLine !== null) onPickProduct(addSpTargetLine, r.maSP);
      setAddSpOpen(false);
    } else showToast(r?.message || 'Có lỗi', 'error');
  }

  // ============== RENDER ==============
  const tabCreate = (
    <div className="form-section">
      <div className="section-title"><FiPlusCircle /> Tạo đơn hàng mới (đa sản phẩm)</div>

      <div className="form-grid">
        <div className="form-field">
          <label className="required">Khách hàng</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <select value={maKH} onChange={(e) => onCustomerChange(e.target.value)} style={{ flex: 1 }}>
              <option value="">-- Chọn khách hàng --</option>
              {customers.map((c) => (
                <option key={c.maKH} value={c.maKH}>
                  {c.maKH} - {c.tenKH} (Ví: {fmtVND(c.soDuVi)}đ)
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-success btn-sm" onClick={openAddCustomerModal}><FiUserPlus /> Thêm KH</button>
          </div>
          <div className="hint">{hintCoc}</div>
        </div>
        <div className="form-field">
          <label className="required">Tuyến</label>
          <select value={tuyen} onChange={(e) => setTuyen(e.target.value as any)}>
            <option value="HaNoi">Hà Nội</option><option value="HCM">HCM</option>
          </select>
        </div>
      </div>

      <div className="form-grid-3" style={{ marginTop: 12 }}>
        <div className="form-field">
          <label>Line vận chuyển</label>
          <select value={lineVC} onChange={(e) => setLineVC(e.target.value as any)}>
            <option value="LineNhanh">Nhanh (3-5 ngày)</option>
            <option value="LineThuong">Thường (7-10 ngày)</option>
            <option value="LineRe">Tiết kiệm (15-20 ngày)</option>
          </select>
        </div>
        <div className="form-field">
          <label>Loại hàng</label>
          <select value={loaiHang} onChange={(e) => setLoaiHang(e.target.value)}>
            <option value="Thường">Thường</option>
            <option value="Hàng dễ vỡ">Hàng dễ vỡ</option>
            <option value="Mỹ phẩm">Mỹ phẩm</option>
          </select>
        </div>
        <div className="form-field">
          <label>% Cọc</label>
          <input type="number" min={0} max={100} value={pctCoc} onChange={(e) => setPctCoc(parseFloat(e.target.value) || 0)} />
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div className="icon-inline" style={{ fontWeight: 700, fontSize: 13 }}><FiPackage /> Chi tiết sản phẩm ({items.length})</div>
          <button type="button" className="btn btn-success btn-sm" onClick={addItem}><FiPlus /> Thêm dòng</button>
        </div>
        {items.map((it) => (
          <div key={it.tempId} style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: 10, marginBottom: 8, background: '#F8FAFC' }}>
            <div className="form-grid" style={{ alignItems: 'end' }}>
              <div className="form-field" style={{ gridColumn: 'span 2' }}>
                <label className="required">SP từ DB / Tự nhập</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <select value={it.spId} onChange={(e) => onPickProduct(it.tempId, e.target.value)} style={{ flex: 1 }}>
                    <option value="">-- Chọn từ DB --</option>
                    {products.map((p) => (<option key={p.maSP} value={p.maSP}>{p.maSP} - {p.tenSP}</option>))}
                    <option value="__custom__">Tự nhập (không lưu DB)</option>
                  </select>
                  <button type="button" className="btn btn-success btn-sm" onClick={() => openAddProductModal(it.tempId)}><FiPlus /> DB</button>
                  {items.length > 1 && (
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => removeItem(it.tempId)}><FiX /></button>
                  )}
                </div>
              </div>
            </div>
            <div className="form-field" style={{ marginTop: 8 }}>
              <input type="text" value={it.tenSP} onChange={(e) => updateItem(it.tempId, { tenSP: e.target.value })} placeholder="Tên hàng ghi vào đơn" />
            </div>
            <div className="form-grid-3" style={{ marginTop: 8 }}>
              <div className="form-field"><label>Số lượng</label>
                <input type="number" min={1} value={it.soLuong} onChange={(e) => updateItem(it.tempId, { soLuong: parseInt(e.target.value) || 1 })} /></div>
              <div className="form-field"><label>Đơn giá (¥ NDT)</label>
                <input type="number" step="0.01" value={it.donGiaNDT} onChange={(e) => updateItem(it.tempId, { donGiaNDT: parseFloat(e.target.value) || 0 })} /></div>
              <div className="form-field"><label>Tỷ giá</label>
                <input type="number" value={it.tyGia} onChange={(e) => updateItem(it.tempId, { tyGia: parseFloat(e.target.value) || 0 })} /></div>
            </div>
            <div className="form-grid-3" style={{ marginTop: 8 }}>
              <div className="form-field"><label>Kg/sp</label>
                <input type="number" step="0.01" value={it.kg} onChange={(e) => updateItem(it.tempId, { kg: parseFloat(e.target.value) || 0 })} /></div>
              <div className="form-field"><label>m³/sp</label>
                <input type="number" step="0.0001" value={it.m3} onChange={(e) => updateItem(it.tempId, { m3: parseFloat(e.target.value) || 0 })} /></div>
              <div className="form-field"><label>Web nguồn</label>
                <select value={it.webNguon} onChange={(e) => updateItem(it.tempId, { webNguon: e.target.value })}>
                  <option value="">--</option>
                  <option value="Taobao">Taobao</option>
                  <option value="1688">1688</option>
                  <option value="Tmall">Tmall</option>
                </select></div>
            </div>
            <div className="form-field" style={{ marginTop: 8 }}>
              <label>Link Taobao/1688</label>
              <input type="text" value={it.linkTaobao} onChange={(e) => updateItem(it.tempId, { linkTaobao: e.target.value })} placeholder="https://..." />
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: '#475569', textAlign: 'right' }}>
              Thành tiền: <b>{fmtVND(Math.round(it.donGiaNDT * it.tyGia * it.soLuong))}đ</b>
              <span style={{ color: '#94A3B8' }}> ({formatNDT(it.donGiaNDT * it.soLuong)})</span>
            </div>
          </div>
        ))}
      </div>

      <div className="form-grid-3" style={{ marginTop: 12 }}>
        <div className="form-field"><label>Phí ship VN (VNĐ)</label>
          <input type="number" value={shipND} onChange={(e) => setShipND(parseFloat(e.target.value) || 0)} /></div>
        <div className="form-field"><label>Phí đóng gỗ/bọt khí</label>
          <select value={dongGoi} onChange={(e) => setDongGoi(parseFloat(e.target.value) || 0)}>
            <option value={0}>Không</option><option value={5000}>5.000đ</option><option value={10000}>10.000đ</option>
          </select></div>
        <div className="form-field"><label>Phí phụ thu khác (VNĐ)</label>
          <input type="number" value={phuThu} onChange={(e) => setPhuThu(parseFloat(e.target.value) || 0)} /></div>
      </div>

      <div className="form-field" style={{ marginTop: 12 }}>
        <label>Ghi chú đơn</label>
        <input type="text" value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} placeholder="Ghi chú thêm cho đơn" />
      </div>

      <div className="fee-summary">
        <div className="fee-row"><span>Tổng giá hàng</span><span className="fee-value">{fmtVND(totals.tongGiaHang)}đ</span></div>
        <div className="fee-row"><span>Tổng KG / M³</span><span className="fee-value">{totals.totalKg.toFixed(2)}kg / {totals.totalM3.toFixed(4)}m³</span></div>
        <div className="fee-row"><span>Phí mua (2%)</span><span className="fee-value">{fmtVND(totals.phiMua)}đ</span></div>
        <div className="fee-row"><span>Phí BH (1%)</span><span className="fee-value">{fmtVND(totals.phiBH)}đ</span></div>
        <div className="fee-row"><span>Phí VC (Panama)</span><span className="fee-value">{fmtVND(totals.phiVC)}đ</span></div>
        <div className="fee-row"><span><b>Tổng tiền</b></span><span className="fee-value" style={{ color: 'var(--primary)' }}>{fmtVND(totals.tong)}đ</span></div>
        <div className="fee-row"><span>Cọc ({pctCoc}%)</span><span className="fee-value" style={{ color: '#92400E' }}>{fmtVND(totals.coc)}đ</span></div>
      </div>

      <div className="btn-row">
        <button className="btn btn-secondary" onClick={resetCreateForm}>Hủy</button>
        <button className="btn btn-primary" onClick={submitCreateOrder} disabled={submitting}>
          {submitting ? <><FiClock /> Đang tạo...</> : <><FiPlus /> Tạo đơn</>}
        </button>
      </div>
    </div>
  );

  const tabOrders = (
    <div className="form-section">
      <div className="section-title"><FiClipboard /> Đơn hàng tôi đã tạo ({myOrders.length} đơn)</div>
      {myOrders.length === 0 ? (
        <div className="empty-state"><FiInbox /><p>Bạn chưa tạo đơn nào.</p></div>
      ) : (
        <table className="data-table">
          <thead><tr>
            <th>Mã đơn</th><th>Ngày</th><th>Khách hàng</th><th>Hàng (đầu tiên)</th>
            <th className="number">Tổng tiền</th><th className="number">Đã trả</th><th className="number">Còn lại</th>
            <th>Trạng thái</th><th>Thao tác</th>
          </tr></thead>
          <tbody>
            {myOrders.map((o) => (
              <tr key={o.maDH}>
                <td className="ma-don" style={{ cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() => (window as any).openOrderDetail?.(o.maDH)}>{o.maDH}</td>
                <td>{fmtDateDDMM(o.ngayTao)}</td>
                <td>{o.tenKH}</td>
                <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.tenHang}</td>
                <td className="number">{fmtVND(o.tongTien)}</td>
                <td className="number">{fmtVND(o.daTra)}</td>
                <td className="number" style={{ color: o.conLai > 0 ? '#DC2626' : '#059669', fontWeight: o.conLai > 0 ? 600 : 400 }}>
                  {fmtVND(o.conLai)}
                </td>
                <td><span className={`status-badge ${statusToClass(o.trangThai)}`}>{statusToLabel(o.trangThai)}</span></td>
                <td>
                  {o.trangThai === 'DonMoiTao' ? (
                    <button className="btn btn-success btn-sm" onClick={() => confirmDepositOrder(o.maDH)}>
                      <FiDollarSign /> Xác nhận cọc
                    </button>
                  ) : <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  const tabCustomers = (
    <div className="form-section">
      <div className="section-title"><FiUsers /> Danh sách khách hàng ({customers.length} KH)</div>
      <table className="data-table">
        <thead><tr>
          <th>Mã KH</th><th>Tên KH</th><th>SĐT</th><th>% Cọc</th>
          <th className="number">Số dư ví</th><th className="number">Công nợ</th><th>Thao tác</th>
        </tr></thead>
        <tbody>
          {customers.map((c) => (
            <tr key={c.maKH}>
              <td className="ma-don">{c.maKH}</td>
              <td>{c.tenKH}</td>
              <td>{c.sdt}</td>
              <td>{Math.round(c.pctCoc)}%</td>
              <td className="number" style={{ color: '#059669', fontWeight: 600 }}>{fmtVND(c.soDuVi)}</td>
              <td className="number" style={{ color: c.congNo > 0 ? '#DC2626' : undefined, fontWeight: c.congNo > 0 ? 600 : 400 }}>
                {fmtVND(c.congNo)}
              </td>
              <td>
                <button className="btn btn-success btn-sm" onClick={() => openTopupModal(c)}>
                  <FiDollarSign /> Nạp ví
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <AppShell user={user} appName={initial.appName}>
      <div className="alert alert-info">
        <FiLock /><span>Bạn đang ở vai trò <b>CSKH</b>. Không thấy giá vốn / lợi nhuận / công nợ NCC.</span>
      </div>

      <div className="kpi-row">
        <div className="kpi">
          <div className="kpi-label"><FiEdit3 /> Đơn hôm nay</div>
          <div className="kpi-value">{kpi.myOrdersToday}</div>
        </div>
        <div className="kpi" style={{ ['--primary' as any]: '#10b981' }}>
          <div className="kpi-label"><FiCheckCircle /> Đã hoàn thành</div>
          <div className="kpi-value">{kpi.completed}</div>
        </div>
        <div className="kpi" style={{ ['--primary' as any]: '#f59e0b' }}>
          <div className="kpi-label"><FiClock /> Đang xử lý</div>
          <div className="kpi-value">{kpi.inProgress}</div>
        </div>
        <div className="kpi" style={{ ['--primary' as any]: '#7c3aed' }}>
          <div className="kpi-label"><FiUsers /> Khách hàng</div>
          <div className="kpi-value">{kpi.customers}</div>
        </div>
      </div>

      <Tabs tabs={[
        { id: 'tab-create', label: <><FiPlusCircle /> Tạo đơn mới</>, content: tabCreate },
        { id: 'tab-orders', label: <><FiClipboard /> Đơn của tôi</>, content: tabOrders },
        { id: 'tab-customers', label: <><FiUsers /> Khách hàng</>, content: tabCustomers }
      ]} />

      {/* Modal nạp ví */}
      <div className={`modal-overlay ${topupOpen ? 'show' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setTopupOpen(false); }}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header"><h2><FiDollarSign /> Nạp ví khách hàng</h2><button className="modal-close" onClick={() => setTopupOpen(false)}><FiX /></button></div>
          <div className="modal-body">
            <div className="form-field"><label>Khách hàng</label><input type="text" value={topupName} readOnly className="locked" /></div>
            <div className="form-field" style={{ marginTop: 12 }}><label className="required">Số tiền nạp (VNĐ)</label>
              <input type="number" value={topupAmount} onChange={(e) => setTopupAmount(e.target.value)} placeholder="VD: 5000000" step="100000" /></div>
            <div className="form-field" style={{ marginTop: 12 }}><label>Ghi chú</label>
              <input type="text" value={topupNote} onChange={(e) => setTopupNote(e.target.value)} placeholder="VD: KH chuyển khoản Vietcombank" /></div>
          </div>
          <div className="btn-row">
            <button className="btn btn-secondary" onClick={() => setTopupOpen(false)}>Hủy</button>
            <button className="btn btn-success" onClick={submitTopup}><FiCheck /> Xác nhận nạp ví</button>
          </div>
        </div>
      </div>

      {/* Modal thêm KH */}
      <div className={`modal-overlay ${addKhOpen ? 'show' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setAddKhOpen(false); }}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header"><h2><FiUserPlus /> Thêm khách hàng mới</h2><button className="modal-close" onClick={() => setAddKhOpen(false)}><FiX /></button></div>
          <div className="modal-body">
            <div className="form-field"><label className="required">Tên khách hàng</label>
              <input type="text" value={addKh.tenKH} onChange={(e) => setAddKh({ ...addKh, tenKH: e.target.value })} placeholder="VD: Anh Tuấn - Shop ABC" autoFocus /></div>
            <div className="form-grid" style={{ marginTop: 12 }}>
              <div className="form-field"><label>Số điện thoại</label>
                <input type="text" value={addKh.sdt} onChange={(e) => setAddKh({ ...addKh, sdt: e.target.value })} placeholder="0901234567" /></div>
              <div className="form-field"><label>Tuyến</label>
                <select value={addKh.tuyen} onChange={(e) => setAddKh({ ...addKh, tuyen: e.target.value })}>
                  <option value="HaNoi">Hà Nội</option><option value="HCM">HCM</option>
                </select></div>
            </div>
            <div className="form-field" style={{ marginTop: 12 }}><label>Địa chỉ</label>
              <input type="text" value={addKh.diaChi} onChange={(e) => setAddKh({ ...addKh, diaChi: e.target.value })} /></div>
            <div className="form-grid" style={{ marginTop: 12 }}>
              <div className="form-field"><label>Email (Customer login)</label>
                <input type="email" value={addKh.email} onChange={(e) => setAddKh({ ...addKh, email: e.target.value })} placeholder="kh@gmail.com" /></div>
              <div className="form-field"><label>% Cọc mặc định</label>
                <input type="number" min={0} max={100} value={addKh.pctCoc} onChange={(e) => setAddKh({ ...addKh, pctCoc: parseFloat(e.target.value) || 70 })} /></div>
            </div>
          </div>
          <div className="btn-row">
            <button className="btn btn-secondary" onClick={() => setAddKhOpen(false)}>Hủy</button>
            <button className="btn btn-success" onClick={submitAddCustomer} disabled={addKhBusy}>{addKhBusy ? <FiClock /> : <><FiCheck /> Tạo KH mới</>}</button>
          </div>
        </div>
      </div>

      {/* Modal thêm SP */}
      <div className={`modal-overlay ${addSpOpen ? 'show' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setAddSpOpen(false); }}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header"><h2><FiPackage /> Thêm sản phẩm vào DB</h2><button className="modal-close" onClick={() => setAddSpOpen(false)}><FiX /></button></div>
          <div className="modal-body">
            <div className="form-field"><label className="required">Tên sản phẩm</label>
              <input type="text" value={addSp.tenSP} onChange={(e) => setAddSp({ ...addSp, tenSP: e.target.value })} autoFocus /></div>
            <div className="form-grid" style={{ marginTop: 12 }}>
              <div className="form-field"><label>Danh mục</label>
                <input type="text" value={addSp.danhMuc} onChange={(e) => setAddSp({ ...addSp, danhMuc: e.target.value })} /></div>
              <div className="form-field"><label>Web nguồn</label>
                <select value={addSp.webNguon} onChange={(e) => setAddSp({ ...addSp, webNguon: e.target.value })}>
                  <option value="">--</option><option value="Taobao">Taobao</option>
                  <option value="1688">1688</option><option value="Tmall">Tmall</option>
                </select></div>
            </div>
            <div className="form-grid-3" style={{ marginTop: 12 }}>
              <div className="form-field"><label>Kg gợi ý</label>
                <input type="number" step="0.01" value={addSp.kg} onChange={(e) => setAddSp({ ...addSp, kg: parseFloat(e.target.value) || 0 })} /></div>
              <div className="form-field"><label>m³ gợi ý</label>
                <input type="number" step="0.0001" value={addSp.m3} onChange={(e) => setAddSp({ ...addSp, m3: parseFloat(e.target.value) || 0 })} /></div>
              <div className="form-field"><label>Giá tham khảo (VNĐ)</label>
                <input type="number" step="10000" value={addSp.gia} onChange={(e) => setAddSp({ ...addSp, gia: parseFloat(e.target.value) || 0 })} /></div>
            </div>
            <div className="form-field" style={{ marginTop: 12 }}><label>Ghi chú</label>
              <input type="text" value={addSp.ghiChu} onChange={(e) => setAddSp({ ...addSp, ghiChu: e.target.value })} /></div>
          </div>
          <div className="btn-row">
            <button className="btn btn-secondary" onClick={() => setAddSpOpen(false)}>Hủy</button>
            <button className="btn btn-success" onClick={submitAddProduct} disabled={addSpBusy}>{addSpBusy ? <FiClock /> : <><FiCheck /> Thêm vào DB</>}</button>
          </div>
        </div>
      </div>

      <OrderDetailModalHost canSeeMoney={true} />
      <ImageUploadModalHost />
    </AppShell>
  );
}
