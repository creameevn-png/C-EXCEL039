'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  FiPlusCircle, FiPlus, FiX, FiPackage, FiDollarSign, FiUsers, FiUserPlus,
  FiInbox, FiClipboard, FiCheckCircle, FiClock, FiLock, FiCheck, FiEdit3, FiShoppingCart,
  FiUser, FiBox, FiSend, FiRefreshCw, FiDatabase
} from 'react-icons/fi';
import type { SessionUser } from '@/lib/auth';
import { detectWeb } from '@/lib/source';
import AppShell from '@/components/AppShell';
import Tabs from '@/components/Tabs';
import ErpSection from '@/components/ErpSection';
import Combobox from '@/components/Combobox';
import OrderDetailModalHost from '@/components/OrderDetailModal';
import ImageUploadModalHost from '@/components/ImageUploadModal';
import { showToast } from '@/components/Toast';
import { callServer, reload } from '@/lib/client';
import { fmtVND, fmtDateDDMM, formatNDT } from '@/lib/format';
import { statusToLabel, statusToClass } from '@/lib/status';
import { calcPhiVCPanama } from '@/lib/shipping-fee';

type Customer = { maKH: string; tenKH: string; sdt: string; diaChi: string; pctCoc: number; soDuVi: number; congNo: number };
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
  const [phiPhatSinh, setPhiPhatSinh] = useState(0);
  const [ngachHQ, setNgachHQ] = useState('Tiểu ngạch');
  const [thueNK, setThueNK] = useState(0);
  const [vat, setVat] = useState(0);
  const [phiKiemHoa, setPhiKiemHoa] = useState(0);
  const [phiLuuKho, setPhiLuuKho] = useState(0);
  const [kiemDem, setKiemDem] = useState(false);
  const [nguoiNhan, setNguoiNhan] = useState('');
  const [sdtNhan, setSdtNhan] = useState('');
  const [diaChiNhan, setDiaChiNhan] = useState('');
  const [pctCoc, setPctCoc] = useState(70);
  const [ghiChu, setGhiChu] = useState('');
  const [hintCoc, setHintCoc] = useState('% cọc sẽ tự động lấy từ thông tin KH');
  const [submitting, setSubmitting] = useState(false);

  const [items, setItems] = useState<LineItem[]>([mkLine({}, tyGia)]);

  // ===== Tạo đơn từ "Yêu cầu mua hàng" (điền sẵn) =====
  const [fromYC, setFromYC] = useState('');
  const [ycInfo, setYcInfo] = useState<{ hoTen: string; sdt: string; email: string } | null>(null);

  useEffect(() => {
    let raw: string | null = null;
    try { raw = sessionStorage.getItem('yc_to_order'); } catch {}
    if (!raw) return;
    let yc: any;
    try { yc = JSON.parse(raw); } catch { return; }
    try { sessionStorage.removeItem('yc_to_order'); } catch {}
    try { window.history.replaceState(null, '', '/cskh'); } catch {}

    setFromYC(yc.maYC || '');
    setYcInfo({ hoTen: yc.hoTen || '', sdt: yc.sdt || '', email: yc.email || '' });

    const t: 'HaNoi' | 'HCM' = yc.tuyen === 'HCM' ? 'HCM' : 'HaNoi';
    setTuyen(t);
    if (yc.ghiChu) setGhiChu(yc.ghiChu);

    const sp: any[] = Array.isArray(yc.sanPham) ? yc.sanPham : [];
    if (sp.length) {
      setItems(sp.map((s) => mkLine({
        spId: '__custom__',
        tenSP: String(s.ten || s.link || '').trim(),
        soLuong: Number(s.soLuong) || 1,
        linkTaobao: String(s.link || '').trim(),
        webNguon: detectWeb(String(s.link || ''))
      }, tyGia)));
    }

    // Tự khớp khách hàng theo mã KH, hoặc theo SĐT
    let matched: Customer | undefined;
    if (yc.maKH) matched = customers.find((c) => c.maKH === String(yc.maKH).toUpperCase());
    if (!matched && yc.sdt) {
      const digits = String(yc.sdt).replace(/\D/g, '');
      if (digits) {
        const cands = customers.filter((c) => (c.sdt || '').replace(/\D/g, '') === digits);
        if (cands.length === 1) matched = cands[0];
      }
    }
    if (matched) {
      setMaKH(matched.maKH);
      setPctCoc(matched.pctCoc);
      setHintCoc(`Đã khớp KH ${matched.maKH} từ yêu cầu · cọc ${matched.pctCoc}%`);
    } else {
      // Điền sẵn modal "Thêm KH" để tạo nhanh từ thông tin yêu cầu
      setAddKh({ tenKH: yc.hoTen || '', sdt: yc.sdt || '', tuyen: t, diaChi: '', email: yc.email || '', pctCoc: 70 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    // Điền sẵn người nhận theo KH (sửa được sau)
    setNguoiNhan(c.tenKH || '');
    setSdtNhan(c.sdt || '');
    setDiaChiNhan(c.diaChi || '');
    setHintCoc(`Đã lấy ${c.pctCoc}% cọc + thông tin nhận hàng từ KH`);
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
    const tongNDT = items.reduce((s, it) =>
      s + (Number(it.donGiaNDT) || 0) * (Number(it.soLuong) || 0), 0);
    const tongSL = items.reduce((s, it) => s + (Number(it.soLuong) || 0), 0);
    const totalKg = items.reduce((s, it) => s + (Number(it.kg) || 0) * (Number(it.soLuong) || 0), 0);
    const totalM3 = items.reduce((s, it) => s + (Number(it.m3) || 0) * (Number(it.soLuong) || 0), 0);
    const phiMua = Math.round((tongGiaHang * 0.02) / 1000) * 1000;
    const phiBH = Math.round(Number(phiPhatSinh) || 0);
    const phiVC = calcPhiVCPanama(totalKg, totalM3, tuyen);
    const phiThue = (Number(thueNK) || 0) + (Number(vat) || 0) + (Number(phiKiemHoa) || 0) + (Number(phiLuuKho) || 0);
    const tong = tongGiaHang + phiMua + phiBH + phiVC + (Number(shipND) || 0) + (Number(dongGoi) || 0) + (Number(phuThu) || 0) + phiThue;
    const coc = Math.round((tong * pctCoc) / 100 / 1000) * 1000;
    return { tongGiaHang, tongNDT, tongSL, totalKg, totalM3, phiMua, phiBH, phiVC, phiThue, tong, coc };
  }, [items, tuyen, shipND, dongGoi, phuThu, phiPhatSinh, thueNK, vat, phiKiemHoa, phiLuuKho, pctCoc]);

  function resetCreateForm() {
    setMaKH(''); setTuyen('HaNoi'); setLineVC('LineThuong'); setLoaiHang('Thường');
    setShipND(0); setDongGoi(0); setPhuThu(0); setPctCoc(70); setGhiChu('');
    setPhiPhatSinh(0); setNgachHQ('Tiểu ngạch'); setThueNK(0); setVat(0); setPhiKiemHoa(0); setPhiLuuKho(0);
    setKiemDem(false); setNguoiNhan(''); setSdtNhan(''); setDiaChiNhan('');
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
      phiPhatSinh, ngachHQ, thueNK, vat, phiKiemHoa, phiLuuKho,
      kiemDem, nguoiNhan, sdtNhan, diaChiNhan,
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
    if (r?.success) {
      showToast('Đã tạo đơn ' + r.maDH, 'success');
      if (fromYC) {
        await callServer('updateYeuCauMua', fromYC, {
          trangThai: 'DaTaoDon',
          maDH: r.maDH,
          ghiChuXuLy: `Đã tạo đơn ${r.maDH} từ yêu cầu (CSKH: ${user.email})`
        });
      }
      setSubmitting(false);
      reload();
    } else {
      setSubmitting(false);
      showToast(r?.message || 'Có lỗi xảy ra', 'error');
    }
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
      setCustomers((prev) => [...prev, { maKH: r.maKH, tenKH: r.tenKH, sdt: addKh.sdt, diaChi: addKh.diaChi, pctCoc: r.pctCoc, soDuVi: 0, congNo: 0 }]);
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
  const selectedKH = customers.find((c) => c.maKH === maKH);
  const tabCreate = (
    <div className="erp-doc">
      {/* Thanh trên cùng: tiêu đề + chip tổng tiền */}
      <div className="erp-bar">
        <div className="erp-bar-title">
          <FiShoppingCart />
          <div>
            Tạo đơn hàng mới
            <div className="sub">{selectedKH ? `${selectedKH.maKH} · ${selectedKH.tenKH}` : 'Chưa chọn khách hàng'}</div>
          </div>
        </div>
        <div className="erp-chips">
          <div className="erp-chip accent"><span className="k">Σ Tổng tiền</span><span className="v">{fmtVND(totals.tong)}đ</span></div>
          <div className="erp-chip warn"><span className="k">Σ Cọc ({pctCoc}%)</span><span className="v">{fmtVND(totals.coc)}đ</span></div>
        </div>
      </div>

      <div className="erp-layout">
        <div className="erp-main">
          {fromYC && (
            <div className="alert alert-info" style={{ marginBottom: 0 }}>
              <FiShoppingCart />
              <div>
                <div>Đang tạo đơn từ <b>yêu cầu {fromYC}</b>{ycInfo && <> · KH: <b>{ycInfo.hoTen}</b> · {ycInfo.sdt}{ycInfo.email ? ` · ${ycInfo.email}` : ''}</>}.</div>
                <div style={{ marginTop: 4, fontSize: 12 }}>
                  Đã điền sẵn sản phẩm & tuyến. Chỉ cần {maKH ? 'nhập' : 'chọn/tạo KH rồi nhập'} giá NDT, kg/m³ còn thiếu rồi bấm <b>Tạo đơn</b>. Yêu cầu sẽ tự chuyển sang "Đã tạo đơn" & gắn mã đơn.
                </div>
                {!maKH && ycInfo && (
                  <button type="button" className="btn btn-success btn-sm" style={{ marginTop: 8 }} onClick={() => setAddKhOpen(true)}>
                    <FiUserPlus /> Tạo KH từ yêu cầu
                  </button>
                )}
              </div>
            </div>
          )}

          {/* KHÁCH HÀNG & VẬN CHUYỂN */}
          <ErpSection
            icon={<FiUser />}
            title="Khách hàng & vận chuyển"
            right={<button type="button" className="btn btn-sm btn-success" onClick={openAddCustomerModal}><FiUserPlus /> Thêm KH</button>}
          >
            <div className="erp-fields">
              <div className="erp-field w-lg">
                <label>Khách hàng <span style={{ color: 'var(--danger-dark)' }}>*</span></label>
                <Combobox
                  value={maKH}
                  onChange={onCustomerChange}
                  placeholder="Gõ tên / mã KH / SĐT…"
                  options={customers.map((c) => ({ value: c.maKH, label: `${c.maKH} - ${c.tenKH}`, sub: `Ví ${fmtVND(c.soDuVi)}đ`, keywords: c.sdt }))}
                />
              </div>
              <div className="erp-field w-md">
                <label>Tuyến</label>
                <select value={tuyen} onChange={(e) => setTuyen(e.target.value as any)}>
                  <option value="HaNoi">Hà Nội</option><option value="HCM">HCM</option>
                </select>
              </div>
              <div className="erp-field">
                <label>Line vận chuyển</label>
                <select value={lineVC} onChange={(e) => setLineVC(e.target.value as any)}>
                  <option value="LineNhanh">Nhanh (3-5 ngày)</option>
                  <option value="LineThuong">Thường (7-10 ngày)</option>
                  <option value="LineRe">Tiết kiệm (15-20 ngày)</option>
                </select>
              </div>
              <div className="erp-field w-md">
                <label>Loại hàng</label>
                <select value={loaiHang} onChange={(e) => setLoaiHang(e.target.value)}>
                  <option value="Thường">Thường</option>
                  <option value="Hàng dễ vỡ">Hàng dễ vỡ</option>
                  <option value="Mỹ phẩm">Mỹ phẩm</option>
                </select>
              </div>
              <div className="erp-field w-sm">
                <label>% Cọc</label>
                <input type="number" min={0} max={100} value={pctCoc} onChange={(e) => setPctCoc(parseFloat(e.target.value) || 0)} />
              </div>
            </div>
            <div className="hint" style={{ marginTop: 6 }}>{hintCoc}</div>
          </ErpSection>

          {/* NGƯỜI NHẬN HÀNG & DỊCH VỤ */}
          <ErpSection icon={<FiPackage />} title="Người nhận hàng & dịch vụ">
            <div className="erp-fields">
              <div className="erp-field w-md"><label>Tên người nhận</label>
                <input value={nguoiNhan} onChange={(e) => setNguoiNhan(e.target.value)} placeholder="Mặc định theo KH (sửa được)" /></div>
              <div className="erp-field w-sm"><label>SĐT nhận</label>
                <input value={sdtNhan} onChange={(e) => setSdtNhan(e.target.value)} placeholder="SĐT người nhận" /></div>
              <div className="erp-field w-lg"><label>Địa chỉ nhận hàng</label>
                <input value={diaChiNhan} onChange={(e) => setDiaChiNhan(e.target.value)} placeholder="Địa chỉ chi tiết để giao hàng VN" /></div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={kiemDem} onChange={(e) => setKiemDem(e.target.checked)} style={{ width: 16, height: 16 }} />
              <span>Dịch vụ <b>kiểm đếm (GTGT)</b> — kho TQ mở kiểm tra số lượng/chất lượng từng link hàng</span>
            </label>
          </ErpSection>

          {/* SẢN PHẨM */}
          <ErpSection
            icon={<FiBox />}
            title={`Sản phẩm (${items.length})`}
            right={<button type="button" className="btn btn-sm btn-success" onClick={addItem}><FiPlus /> Thêm dòng</button>}
          >
            <div className="erp-items-wrap">
              <table className="erp-items" style={{ minWidth: 960 }}>
                <thead>
                  <tr>
                    <th rowSpan={2} style={{ width: 46 }}>#</th>
                    <th rowSpan={2}>Sản phẩm</th>
                    <th rowSpan={2} className="num" style={{ width: 70 }}>SL</th>
                    <th rowSpan={2} style={{ width: 52 }}>ĐVT</th>
                    <th colSpan={2} className="grp">Đơn giá nhập</th>
                    <th colSpan={2} className="grp">TL / sản phẩm</th>
                    <th rowSpan={2} style={{ width: 100 }}>Nguồn</th>
                    <th rowSpan={2} className="num" style={{ width: 124 }}>Thành tiền (đ)</th>
                    <th rowSpan={2} style={{ width: 52 }}></th>
                  </tr>
                  <tr>
                    <th className="num" style={{ width: 92 }}>¥ / sp</th>
                    <th className="num" style={{ width: 86 }}>Tỷ giá</th>
                    <th className="num" style={{ width: 70 }}>Kg</th>
                    <th className="num" style={{ width: 78 }}>M³</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => {
                    const tt = Math.round((Number(it.donGiaNDT) || 0) * (Number(it.tyGia) || 0) * (Number(it.soLuong) || 0));
                    return (
                      <tr key={it.tempId}>
                        <td><span className="erp-rownum"><FiBox />{i + 1}</span></td>
                        <td>
                          <Combobox
                            className="in-cell"
                            value={it.spId}
                            onChange={(v) => onPickProduct(it.tempId, v)}
                            placeholder="— Chọn SP từ DB / gõ để tìm —"
                            options={[
                              ...products.map((p) => ({ value: p.maSP, label: `${p.maSP} - ${p.tenSP}` })),
                              { value: '__custom__', label: 'Tự nhập (không lưu DB)' },
                            ]}
                          />
                          <input className="erp-cell" value={it.tenSP} placeholder="Tên hàng ghi vào đơn"
                            onChange={(e) => updateItem(it.tempId, { tenSP: e.target.value })} />
                          <input className="erp-cell erp-cell-sub" value={it.linkTaobao} placeholder="Link Taobao / 1688 (nếu có)"
                            onChange={(e) => updateItem(it.tempId, { linkTaobao: e.target.value })} />
                        </td>
                        <td className="num">
                          <input className="erp-cell num" type="number" min={1} value={it.soLuong}
                            onChange={(e) => updateItem(it.tempId, { soLuong: parseInt(e.target.value) || 1 })} />
                        </td>
                        <td><span className="erp-uom">cái</span></td>
                        <td className="num">
                          <input className="erp-cell num" type="number" step="0.01" inputMode="decimal" value={it.donGiaNDT}
                            onChange={(e) => updateItem(it.tempId, { donGiaNDT: parseFloat(e.target.value) || 0 })} />
                        </td>
                        <td className="num">
                          <input className="erp-cell num" type="number" inputMode="decimal" value={it.tyGia}
                            onChange={(e) => updateItem(it.tempId, { tyGia: parseFloat(e.target.value) || 0 })} />
                        </td>
                        <td className="num">
                          <input className="erp-cell num" type="number" step="0.01" inputMode="decimal" value={it.kg}
                            onChange={(e) => updateItem(it.tempId, { kg: parseFloat(e.target.value) || 0 })} />
                        </td>
                        <td className="num">
                          <input className="erp-cell num" type="number" step="0.0001" inputMode="decimal" value={it.m3}
                            onChange={(e) => updateItem(it.tempId, { m3: parseFloat(e.target.value) || 0 })} />
                        </td>
                        <td>
                          <select className="erp-cell" value={it.webNguon} onChange={(e) => updateItem(it.tempId, { webNguon: e.target.value })}>
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
                          <div className="erp-actcell">
                            <button type="button" className="erp-iconbtn db" title="Lưu sản phẩm này vào DB" onClick={() => openAddProductModal(it.tempId)}><FiDatabase /></button>
                            {items.length > 1 && (
                              <button type="button" className="erp-iconbtn rm" title="Xoá dòng" onClick={() => removeItem(it.tempId)}><FiX /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td><button type="button" className="erp-add" onClick={addItem} title="Thêm dòng"><FiPlus /></button></td>
                    <td className="erp-foot-lbl"># {items.length} dòng</td>
                    <td className="num">Σ {totals.tongSL}</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td className="num">Σ {totals.totalKg.toFixed(2)}</td>
                    <td className="num">Σ {totals.totalM3.toFixed(4)}</td>
                    <td></td>
                    <td className="num">
                      <div className="erp-amt">
                        <b>Σ {fmtVND(totals.tongGiaHang)}đ</b>
                        <div className="erp-amt-sub">{formatNDT(totals.tongNDT)}</div>
                      </div>
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </ErpSection>

          {/* CHI PHÍ & THANH TOÁN */}
          <ErpSection icon={<FiDollarSign />} title="Chi phí & thanh toán">
            <div className="erp-fields">
              <div className="erp-field"><label>Phí ship VN (VNĐ)</label>
                <input type="number" value={shipND} onChange={(e) => setShipND(parseFloat(e.target.value) || 0)} /></div>
              <div className="erp-field"><label>Phí đóng gỗ / bọt khí</label>
                <select value={dongGoi} onChange={(e) => setDongGoi(parseFloat(e.target.value) || 0)}>
                  <option value={0}>Không</option><option value={5000}>5.000đ</option><option value={10000}>10.000đ</option>
                </select></div>
              <div className="erp-field"><label>Phí phụ thu khác (VNĐ)</label>
                <input type="number" value={phuThu} onChange={(e) => setPhuThu(parseFloat(e.target.value) || 0)} /></div>
              <div className="erp-field"><label>Phí phát sinh khác (VNĐ)</label>
                <input type="number" value={phiPhatSinh} onChange={(e) => setPhiPhatSinh(parseFloat(e.target.value) || 0)} /></div>
            </div>
            <div className="erp-fields" style={{ marginTop: 10 }}>
              <div className="erp-field w-md"><label>Ngạch hải quan</label>
                <select value={ngachHQ} onChange={(e) => setNgachHQ(e.target.value)}>
                  <option value="Tiểu ngạch">Tiểu ngạch</option>
                  <option value="Chính ngạch">Chính ngạch</option>
                </select></div>
              <div className="erp-field"><label>Thuế nhập khẩu (VNĐ)</label>
                <input type="number" value={thueNK} onChange={(e) => setThueNK(parseFloat(e.target.value) || 0)} /></div>
              <div className="erp-field"><label>VAT (VNĐ)</label>
                <input type="number" value={vat} onChange={(e) => setVat(parseFloat(e.target.value) || 0)} /></div>
              <div className="erp-field"><label>Phí kiểm hóa (VNĐ)</label>
                <input type="number" value={phiKiemHoa} onChange={(e) => setPhiKiemHoa(parseFloat(e.target.value) || 0)} /></div>
              <div className="erp-field"><label>Phí lưu kho (VNĐ)</label>
                <input type="number" value={phiLuuKho} onChange={(e) => setPhiLuuKho(parseFloat(e.target.value) || 0)} /></div>
            </div>
            <div style={{ marginTop: 14 }}>
              <div className="erp-fee-row"><span className="lbl">Tổng giá hàng</span><span className="v">{fmtVND(totals.tongGiaHang)}đ <small style={{ color: 'var(--text-faint)', fontWeight: 500 }}>≈ {formatNDT(totals.tongNDT)}</small></span></div>
              <div className="erp-fee-row"><span className="lbl">Tổng KG / M³</span><span className="v">{totals.totalKg.toFixed(2)} kg / {totals.totalM3.toFixed(4)} m³</span></div>
              <div className="erp-fee-row"><span className="lbl">Phí mua (2%)</span><span className="v">{fmtVND(totals.phiMua)}đ</span></div>
              <div className="erp-fee-row"><span className="lbl">Phí vận chuyển (Panama)</span><span className="v">{fmtVND(totals.phiVC)}đ</span></div>
              {totals.phiBH > 0 && <div className="erp-fee-row"><span className="lbl">Phí phát sinh khác</span><span className="v">{fmtVND(totals.phiBH)}đ</span></div>}
              {totals.phiThue > 0 && <div className="erp-fee-row"><span className="lbl">Thuế / VAT / kiểm hóa / lưu kho ({ngachHQ})</span><span className="v">{fmtVND(totals.phiThue)}đ</span></div>}
              <div className="erp-fee-row total"><span className="lbl">Tổng tiền</span><span className="v">{fmtVND(totals.tong)}đ</span></div>
              <div className="erp-fee-row coc"><span className="lbl">Cọc ({pctCoc}%)</span><span className="v">{fmtVND(totals.coc)}đ</span></div>
            </div>
          </ErpSection>

          {/* GHI CHÚ */}
          <ErpSection icon={<FiEdit3 />} title="Ghi chú đơn">
            <div className="form-field">
              <textarea value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} placeholder="Ghi chú thêm cho đơn (nếu có)…" />
            </div>
          </ErpSection>
        </div>

        {/* THANH TÁC VỤ */}
        <aside className="erp-rail">
          <button type="button" className="erp-rail-btn primary" onClick={submitCreateOrder} disabled={submitting}>
            {submitting ? <FiClock /> : <FiSend />}
            {submitting ? 'Đang tạo…' : 'Tạo đơn'}
          </button>
          <button type="button" className="erp-rail-btn" onClick={addItem}><FiPlus /> Thêm dòng</button>
          <button type="button" className="erp-rail-btn danger" onClick={resetCreateForm}><FiRefreshCw /> Làm mới</button>
        </aside>
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
