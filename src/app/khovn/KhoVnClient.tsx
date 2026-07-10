'use client';

import { useState } from 'react';
import {
  FiInfo, FiTruck, FiPackage, FiCheckCircle, FiDownload, FiClock, FiCheck, FiAlertCircle, FiTarget,
  FiEdit2, FiX, FiBox, FiMapPin, FiSave, FiLayers, FiRotateCcw, FiDollarSign, FiPlus
} from 'react-icons/fi';
import type { SessionUser } from '@/lib/auth';
import AppShell from '@/components/AppShell';
import Tabs from '@/components/Tabs';
import OrderDetailModalHost from '@/components/OrderDetailModal';
import ImageUploadModalHost from '@/components/ImageUploadModal';
import { showToast } from '@/components/Toast';
import { callServer, reload } from '@/lib/client';
import { fmtVND, formatDate } from '@/lib/format';

type WeighLine = { stt: number; tenSP: string; soLuong: number; kg: string; dai: string; rong: string; cao: string; m3: string };

type Row = {
  maDH: string; maVD: string; maBao: string; tenKH: string;
  tenHang: string; tuyen: string; conLai: number; shipND: number;
  diaChiNhan: string; nguoiNhan: string; sdtNhan: string; lineNoiDia: string;
};
type Bao = {
  maBao: string; line: string; trangThai: string;
  tongKg: number; tongM3: number; soKien: number; daNhan: number; tong: number;
};
type Kien = { maVD: string; maDH: string; maBao: string; trangThai: string; ngayVeVN: string; ngayGiao: string };
type KnRow = {
  maKN: string; maDH: string; maKH: string; tenKH: string; maVDTraHang: string;
  daNhanHangKN: boolean; phiDoiTra: number; ghiChuXuLy: string; ngayNhanKN: string; chuyenKhoVNAt: string;
};
type Quy = { id: number; ngay: string; loai: string; soTien: number; danhMuc: string; noiDung: string; maDH: string; nguoiTao: string };
type BaoOpen = { maBao: string; line: string; soKien: number; daVe: number; kien: { maVD: string; maDH: string; trangThai: string }[] };

const LINE_LABEL: Record<string, string> = { LineNhanh: 'Nhanh', LineThuong: 'Thường', LineRe: 'Tiết kiệm' };
const KIEN_LABEL: Record<string, string> = { ChuaVe: 'Chưa về', DaVeVN: 'Đã về VN', DaGiao: 'Đã giao' };
const KIEN_CLASS: Record<string, string> = { ChuaVe: 's-waiting', DaVeVN: 's-shipping', DaGiao: 's-done' };
// Danh mục quỹ kho VN gợi ý (góp ý NV #43): kho thu hộ khách, chi ship nội địa, bốc xếp…
const DANH_MUC_QUY = ['Thu hộ khách', 'Chi ship nội địa VN', 'Chi bốc xếp', 'Chi khác'];
// Góp ý NV #41: line vận chuyển nội địa VN do kho VN chọn khi giao hàng.
const LINE_NOI_DIA = ['Viettel Post', 'GHTK', 'J&T Express', 'Xe khách', 'Xe tải nhà', 'Khách tự lấy'];

// Góp ý NV #35: bắn (quét) mã vận đơn để tìm nhanh đơn trong danh sách kho.
function filterByScan(rows: Row[], q: string) {
  const k = q.trim().toLowerCase();
  if (!k) return rows;
  return rows.filter((o) =>
    o.maVD.toLowerCase().includes(k) || o.maDH.toLowerCase().includes(k) ||
    o.maBao.toLowerCase().includes(k) || o.tenKH.toLowerCase().includes(k));
}

export default function KhoVnClient({ user, incomingShipments, atWarehouse, readyToDeliver, baos, kienList, knList, quyList }:
  {
    user: SessionUser; incomingShipments: Row[]; atWarehouse: Row[]; readyToDeliver: Row[]; baos: Bao[];
    kienList: Kien[]; knList: KnRow[]; quyList: Quy[];
  }) {

  const [weighMaDH, setWeighMaDH] = useState<string | null>(null);
  const [weighLines, setWeighLines] = useState<WeighLine[]>([]);
  const [weighBusy, setWeighBusy] = useState(false);

  const soHoacRong = (v: any) => (Number(v) > 0 ? String(v) : '');

  async function openWeigh(maDH: string) {
    setWeighMaDH(maDH); setWeighLines([]);
    const r = await callServer('getOrderDetail', maDH);
    if (r?.success) {
      setWeighLines(r.data.chiTiet.map((c: any) => ({
        stt: c.stt, tenSP: c.tenSP, soLuong: c.soLuong,
        kg: String(c.kg ?? ''),
        dai: soHoacRong(c.dai), rong: soHoacRong(c.rong), cao: soHoacRong(c.cao),
        m3: String(c.m3 ?? '')
      })));
    } else { showToast(r?.message || 'Lỗi tải đơn', 'error'); setWeighMaDH(null); }
  }
  function patchWeigh(stt: number, p: Partial<WeighLine>) {
    setWeighLines((ls) => ls.map((l) => (l.stt === stt ? { ...l, ...p } : l)));
  }
  // Góp ý NV #33: nhập đủ dài×rộng×cao thì m³ do server tính theo hệ số trong Cài đặt.
  async function saveWeigh() {
    if (!weighMaDH) return;
    setWeighBusy(true);
    for (const l of weighLines) {
      const kg = parseFloat(l.kg) || 0;
      const dai = parseFloat(l.dai) || 0, rong = parseFloat(l.rong) || 0, cao = parseFloat(l.cao) || 0;
      const hasKT = dai > 0 && rong > 0 && cao > 0;
      const payload = hasKT ? { kg, dai, rong, cao } : { kg, m3: parseFloat(l.m3) || 0 };
      const r = await callServer('updateChiTietKg', weighMaDH, l.stt, payload);
      if (r?.success && r.m3 !== undefined) patchWeigh(l.stt, { m3: String(r.m3) });
    }
    setWeighBusy(false);
    showToast('Đã cập nhật cân nặng (lưu lịch sử sửa)', 'success');
    reload();
  }

  function confirmKhoVN(maDH: string) {
    (window as any).openImageUploadModal?.('Xác nhận nhận hàng tại Kho VN', maDH, async (img: string | null) => {
      const r = await callServer('confirmKhoVN', maDH, img);
      if (r?.success) { showToast(img ? 'Đã xác nhận + lưu ảnh' : 'Đã xác nhận', 'success'); reload(); }
      else showToast(r?.message || 'Lỗi', 'error');
    });
  }

  function confirmDelivered(maDH: string) {
    (window as any).openImageUploadModal?.('Xác nhận đã giao tới KH', maDH, async (img: string | null) => {
      const r = await callServer('confirmDelivered', maDH, img);
      if (r?.success) { showToast(img ? 'Đã giao + lưu ảnh' : 'Đã giao', 'success'); reload(); }
      else showToast(r?.message || 'Lỗi', 'error');
    });
  }

  // Đợt 5 — nhận cả bao + ship nội địa VN
  const [baoInput, setBaoInput] = useState('');
  const [shipInputs, setShipInputs] = useState<Record<string, string>>({});
  const [lineInputs, setLineInputs] = useState<Record<string, string>>({});
  // Ô bắn mã vận đơn — lọc nhanh mọi tab (góp ý #35).
  const [scan, setScan] = useState('');

  async function receiveBao(maBao: string) {
    const ma = (maBao || baoInput).trim();
    if (!ma) return showToast('Nhập/quét mã bao', 'error');
    const r = await callServer('receiveBaoAtVN', ma);
    if (r?.success) {
      // #29: đơn còn kiện chưa bắn mã thì KHÔNG được nhận — báo rõ để kho sang tab Kiện hàng.
      const thieu = r.kienConThieu > 0;
      const warn = thieu ? ` ⚠ còn ${r.kienConThieu} kiện chưa bắn mã (${r.conChua} đơn) — vào tab "Kiện hàng" để bắn từng mã` : '';
      showToast(`Nhận bao ${ma}: ${r.received}/${r.total} đơn${warn}`, thieu ? 'error' : 'success');
      reload();
    } else showToast(r?.message || 'Lỗi', 'error');
  }

  async function saveShipVN(maDH: string) {
    const v = parseFloat(shipInputs[maDH] || '0') || 0;
    const r = await callServer('updateShipVN', maDH, v, lineInputs[maDH] ?? '');
    if (r?.success) { showToast('Đã cập nhật ship nội địa VN', 'success'); reload(); }
    else showToast(r?.message || 'Lỗi', 'error');
  }

  // ===== Tab Kiện hàng (#28/#37/#38): nhận & giao theo từng mã vận đơn =====
  const [baoScan, setBaoScan] = useState('');
  const [baoOpen, setBaoOpen] = useState<BaoOpen | null>(null);
  const [baoConThieu, setBaoConThieu] = useState(0);
  const [nhanKienScan, setNhanKienScan] = useState('');
  const [giaoKienScan, setGiaoKienScan] = useState('');

  async function openBaoKien() {
    const ma = baoScan.trim();
    if (!ma) return showToast('Quét / nhập mã bao', 'error');
    const r = await callServer('openBaoAtVN', ma);
    if (r?.success) {
      setBaoOpen({ maBao: r.maBao, line: r.line, soKien: r.soKien, daVe: r.daVe, kien: r.kien });
      setBaoConThieu(r.soKien - r.daVe);
    } else showToast(r?.message || 'Lỗi', 'error');
  }

  async function nhanKien() {
    const maVD = nhanKienScan.trim();
    if (!maVD) return showToast('Bắn / nhập mã vận đơn', 'error');
    const r = await callServer('receiveKienVN', maVD);
    if (!r?.success) return showToast(r?.message || 'Lỗi', 'error');
    setNhanKienScan('');
    // Cập nhật checklist tại chỗ — không reload toàn trang (#28).
    setBaoOpen((prev) => {
      if (!prev) return prev;
      const kien = prev.kien.map((k) => (k.maVD === r.maVD ? { ...k, trangThai: 'DaVeVN' } : k));
      return { ...prev, kien, daVe: kien.filter((k) => k.trangThai !== 'ChuaVe').length };
    });
    if (baoOpen && r.maBao === baoOpen.maBao) setBaoConThieu(r.baoConThieu || 0);
    showToast(`Đã nhận kiện ${r.maVD} — đơn ${r.maDH}: ${r.daVe}/${r.tongKien} kiện`, 'success');
  }

  async function giaoKien() {
    const maVD = giaoKienScan.trim();
    if (!maVD) return showToast('Bắn / nhập mã vận đơn', 'error');
    const r = await callServer('giaoKienVN', maVD);
    if (!r?.success) return showToast(r?.message || 'Lỗi', 'error');
    setGiaoKienScan('');
    if (r.conLaiKien === 0) showToast(`Đơn ${r.maDH} đã giao đủ ${r.tongKien} kiện — hoàn thành`, 'success');
    else showToast(`Đã giao kiện ${r.maVD} — đơn ${r.maDH} còn ${r.conLaiKien} kiện`, 'success');
    reload();
  }

  // ===== Tab Hàng khiếu nại (#44/#46) =====
  const [knVDScan, setKnVDScan] = useState('');
  const [knPhi, setKnPhi] = useState('');
  const [knGhiChu, setKnGhiChu] = useState('');
  const [knEditPhi, setKnEditPhi] = useState<Record<string, string>>({});
  const [knEditNote, setKnEditNote] = useState<Record<string, string>>({});

  async function nhanHangKN() {
    const maVD = knVDScan.trim();
    if (!maVD) return showToast('Bắn / nhập mã VĐ hàng khiếu nại', 'error');
    const r = await callServer('khoVnNhanHangKN', maVD, { phiDoiTra: parseFloat(knPhi) || 0, ghiChu: knGhiChu.trim() });
    if (r?.success) { showToast(`Đã nhận hàng khiếu nại ${r.maKN}${r.maDH ? ' — đơn ' + r.maDH : ''}`, 'success'); reload(); }
    else showToast(r?.message || 'Lỗi', 'error');
  }

  async function saveKnPhi(k: KnRow) {
    const phiRaw = knEditPhi[k.maKN];
    const patch: { phiDoiTra: number; ghiChuXuLy?: string } = {
      phiDoiTra: phiRaw !== undefined ? (parseFloat(phiRaw) || 0) : k.phiDoiTra
    };
    // Kho VN chỉ được gửi 2 trường; không đụng note nếu chưa sửa (tránh xoá ghi chú cũ).
    if (knEditNote[k.maKN] !== undefined) patch.ghiChuXuLy = knEditNote[k.maKN];
    const r = await callServer('updateKhieuNai', k.maKN, patch);
    if (r?.success) { showToast('Đã cập nhật phí đổi trả', 'success'); reload(); }
    else showToast(r?.message || 'Lỗi', 'error');
  }

  // ===== Tab Quỹ kho VN (#43) =====
  const [quyLoai, setQuyLoai] = useState<'Thu' | 'Chi'>('Thu');
  const [quySoTien, setQuySoTien] = useState('');
  const [quyNoiDung, setQuyNoiDung] = useState('');
  const [quyDanhMuc, setQuyDanhMuc] = useState('');
  const [quyMaDH, setQuyMaDH] = useState('');

  const tongThuQuy = quyList.filter((q) => q.loai === 'Thu').reduce((s, q) => s + q.soTien, 0);
  const tongChiQuy = quyList.filter((q) => q.loai === 'Chi').reduce((s, q) => s + q.soTien, 0);
  const tonQuy = tongThuQuy - tongChiQuy;

  async function addQuy() {
    const soTien = parseFloat(quySoTien) || 0;
    if (soTien <= 0) return showToast('Số tiền phải lớn hơn 0', 'error');
    if (!quyNoiDung.trim()) return showToast('Nhập nội dung thu / chi', 'error');
    const r = await callServer('addSoQuy', {
      quy: 'KhoVN', loai: quyLoai, soTien, noiDung: quyNoiDung.trim(),
      danhMuc: quyDanhMuc || undefined, maDH: quyMaDH.trim() || undefined
    });
    if (r?.success) {
      showToast('Đã ghi bút toán quỹ kho VN', 'success');
      setQuySoTien(''); setQuyNoiDung(''); setQuyDanhMuc(''); setQuyMaDH('');
      reload();
    } else showToast(r?.message || 'Lỗi', 'error');
  }

  function shipVN(o: Row) {
    return (
      <div className="form-grid" style={{ marginTop: 8 }}>
        <div className="form-field">
          <label>Line vận chuyển nội địa</label>
          <select value={lineInputs[o.maDH] ?? o.lineNoiDia ?? ''}
            onChange={(e) => setLineInputs((p) => ({ ...p, [o.maDH]: e.target.value }))}>
            <option value="">-- Chọn line --</option>
            {LINE_NOI_DIA.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label>Ship nội địa VN (VNĐ)</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input type="number" defaultValue={o.shipND || ''} placeholder="phí giao VN"
              onChange={(e) => setShipInputs((p) => ({ ...p, [o.maDH]: e.target.value }))} />
            <button className="btn btn-secondary btn-sm" onClick={() => saveShipVN(o.maDH)}><FiSave /></button>
          </div>
        </div>
      </div>
    );
  }

  // JSX const (không phải component con) để ô quét không bị remount và mất focus mỗi lần gõ.
  const scanBox = (
    <div className="form-field" style={{ marginBottom: 12 }}>
      <label><FiTarget /> Bắn / nhập mã vận đơn để tìm nhanh</label>
      <input value={scan} onChange={(e) => setScan(e.target.value)}
        placeholder="Quét mã VĐ, mã bao, mã đơn hoặc tên khách…" />
      {scan.trim() && <div className="hint">Đang lọc theo “{scan.trim()}” — xoá ô để xem lại tất cả.</div>}
    </div>
  );

  function diaChi(o: Row) {
    if (!o.diaChiNhan && !o.nguoiNhan) return null;
    return (
      <div className="icon-inline" style={{ background: '#ECFDF5', padding: 8, borderRadius: 6, marginTop: 8, fontSize: 12, color: '#065F46' }}>
        <FiMapPin /> Giao: <b>{o.nguoiNhan || o.tenKH}</b>{o.sdtNhan ? ` · ${o.sdtNhan}` : ''}{o.diaChiNhan ? ` · ${o.diaChiNhan}` : ''}
      </div>
    );
  }

  const incomingFiltered = filterByScan(incomingShipments, scan);
  const atWarehouseFiltered = filterByScan(atWarehouse, scan);
  const readyFiltered = filterByScan(readyToDeliver, scan);

  const tabIncoming = (
    <div className="form-section">
      <div className="section-title"><FiDownload /> Hàng từ TQ đang về kho VN</div>
      {scanBox}
      {incomingFiltered.length === 0 ? (
        <div className="empty-state"><FiPackage /><p>{scan.trim() ? 'Không có đơn khớp mã đã bắn.' : 'Không có hàng đang về.'}</p></div>
      ) : incomingFiltered.map((o) => (
        <div key={o.maDH} className="action-card">
          <div className="ac-header">
            <div className="ac-title">Mã VĐ: {o.maVD || '(chưa có)'}</div>
            <span className="status-badge s-shipping">Đang vận chuyển</span>
          </div>
          <div className="ac-meta">
            Đơn: <b style={{ cursor: 'pointer', textDecoration: 'underline', color: '#1E3A8A' }}
                    onClick={() => (window as any).openOrderDetail?.(o.maDH)}>{o.maDH}</b> ·
            KH: {o.tenKH} · {o.tenHang} · Tuyến: <b>{o.tuyen === 'HCM' ? 'HCM' : 'Hà Nội'}</b>
            {o.maBao && <> · Bao: <b>{o.maBao}</b></>}
          </div>
          {diaChi(o)}
          {shipVN(o)}
          <div className="ac-actions">
            <button className="btn btn-success" onClick={() => confirmKhoVN(o.maDH)}>
              <FiCheck /> Xác nhận đã nhận tại VN
            </button>
            <button className="btn btn-secondary" onClick={() => openWeigh(o.maDH)}>
              <FiEdit2 /> Sửa cân (KG / kích thước)
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  const tabAtVN = (
    <div className="form-section">
      <div className="section-title"><FiPackage /> Hàng tại kho VN — chờ KH thanh toán</div>
      {scanBox}
      {atWarehouseFiltered.length === 0 ? (
        <div className="empty-state"><FiCheckCircle /><p>{scan.trim() ? 'Không có đơn khớp mã đã bắn.' : 'Không có đơn chờ thanh toán.'}</p></div>
      ) : atWarehouseFiltered.map((o) => (
        <div key={o.maDH} className="action-card">
          <div className="ac-header">
            <div className="ac-title">Đơn: <b style={{ cursor: 'pointer', textDecoration: 'underline', color: '#1E3A8A' }}
                                            onClick={() => (window as any).openOrderDetail?.(o.maDH)}>{o.maDH}</b></div>
            <span className="status-badge s-waiting">Chờ thanh toán</span>
          </div>
          <div className="ac-meta">KH: <b>{o.tenKH}</b> · {o.tenHang} · Tuyến: <b>{o.tuyen === 'HCM' ? 'HCM' : 'Hà Nội'}</b></div>
          <div className="icon-inline" style={{ background: '#FEF3C7', padding: 8, borderRadius: 6, marginTop: 8, fontSize: 12, color: '#92400E' }}>
            <FiClock /> Đợi Kế toán xác nhận khách đã thanh toán đủ trước khi giao.
          </div>
          <div className="ac-actions">
            <button className="btn btn-secondary btn-sm" onClick={() => openWeigh(o.maDH)}>
              <FiEdit2 /> Sửa cân (KG / kích thước)
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  const tabReady = (
    <div className="form-section">
      <div className="section-title"><FiTruck /> Đơn đã thanh toán đủ — chờ giao khách</div>
      {scanBox}
      {readyFiltered.length === 0 ? (
        <div className="empty-state"><FiPackage /><p>{scan.trim() ? 'Không có đơn khớp mã đã bắn.' : 'Không có đơn nào chờ giao.'}</p></div>
      ) : readyFiltered.map((o) => (
        <div key={o.maDH} className="action-card">
          <div className="ac-header">
            <div className="ac-title">Đơn: <b style={{ cursor: 'pointer', textDecoration: 'underline', color: '#1E3A8A' }}
                                            onClick={() => (window as any).openOrderDetail?.(o.maDH)}>{o.maDH}</b></div>
            <span className="status-badge s-vn">Sẵn sàng giao</span>
          </div>
          <div className="ac-meta">KH: <b>{o.tenKH}</b> · {o.tenHang} · Tuyến: <b>{o.tuyen === 'HCM' ? 'HCM' : 'Hà Nội'}</b></div>
          {diaChi(o)}
          {o.conLai > 0.5 && (
            <div className="icon-inline" style={{ background: '#FEE2E2', padding: 8, borderRadius: 6, marginTop: 8, fontSize: 12, color: '#991B1B' }}>
              <FiAlertCircle /> Còn nợ {fmtVND(o.conLai)}đ — không thể giao đến khi thanh toán đủ
            </div>
          )}
          <div className="ac-actions">
            <button className="btn btn-success" onClick={() => confirmDelivered(o.maDH)} disabled={o.conLai > 0.5}>
              <FiTarget /> Đã giao tới KH
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  const tabBao = (
    <div className="form-section">
      <div className="section-title"><FiBox /> Nhận bao tổng — quét mã bao để nhận cả lô</div>
      <div className="action-card">
        <div className="form-grid" style={{ marginTop: 4 }}>
          <div className="form-field"><label>Quét / nhập mã bao</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={baoInput} onChange={(e) => setBaoInput(e.target.value)} placeholder="BAO0001" />
              <button className="btn btn-success" onClick={() => receiveBao('')}><FiCheck /> Nhận bao</button>
            </div>
          </div>
        </div>
        <div className="hint">Chỉ những đơn đã bắn đủ mã kiện mới được xác nhận về VN. Còn kiện chưa bắn thì hệ thống cảnh báo và bao <b>chưa hoàn thành</b> — vào tab “Kiện hàng” bắn từng mã.</div>
      </div>

      {baos.length === 0 ? <div className="empty-state"><FiBox /><p>Không có bao nào đang về.</p></div> :
        baos.map((b) => {
          const thieu = b.tong - b.daNhan;
          return (
            <div key={b.maBao} className="action-card">
              <div className="ac-header">
                <div className="ac-title"><FiBox /> {b.maBao} · Line {LINE_LABEL[b.line] || b.line}</div>
                <span className={`status-badge ${thieu > 0 ? 's-waiting' : 's-vn'}`}>{b.trangThai === 'DaVeVN' ? 'Đang nhận' : 'Đã xuất'}</span>
              </div>
              <div className="ac-meta">{b.soKien} đơn · {b.tongKg}kg · {b.tongM3}m³ · Đã nhận: <b>{b.daNhan}/{b.tong}</b></div>
              {thieu > 0 && (
                <div className="icon-inline" style={{ background: '#FEF3C7', padding: 8, borderRadius: 6, marginTop: 8, fontSize: 12, color: '#92400E' }}>
                  <FiAlertCircle /> Còn <b>{thieu}</b> đơn trong bao chưa về VN — bao chưa hoàn thành.
                </div>
              )}
              <div className="ac-actions">
                <button className="btn btn-success" onClick={() => receiveBao(b.maBao)}><FiCheck /> Xác nhận nhận bao này</button>
              </div>
            </div>
          );
        })}
    </div>
  );

  function knCard(k: KnRow) {
    return (
      <div key={k.maKN} className="action-card">
        <div className="ac-header">
          <div className="ac-title"><FiRotateCcw /> {k.maKN}</div>
          <span className={`status-badge ${k.daNhanHangKN ? 's-done' : 's-deposit'}`}>
            {k.daNhanHangKN ? 'Đã nhận hàng trả' : 'Chờ nhận hàng trả'}
          </span>
        </div>
        <div className="ac-meta">
          {k.maDH && <>Đơn: <b style={{ cursor: 'pointer', textDecoration: 'underline', color: '#1E3A8A' }}
            onClick={() => (window as any).openOrderDetail?.(k.maDH)}>{k.maDH}</b> · </>}
          KH: <b>{k.tenKH || k.maKH || '—'}</b> · Mã VĐ trả: <b>{k.maVDTraHang || '(chưa có)'}</b>
        </div>
        {k.daNhanHangKN && k.ngayNhanKN && (
          <div className="ac-meta" style={{ fontSize: 12 }}>
            Đã nhận: {formatDate(k.ngayNhanKN)} · Phí đổi trả hiện tại: <b>{fmtVND(k.phiDoiTra)}đ</b>
          </div>
        )}
        {k.daNhanHangKN ? (
          <div className="form-grid" style={{ marginTop: 8 }}>
            <div className="form-field">
              <label>Sửa phí đổi trả (VNĐ)</label>
              <input type="number" defaultValue={k.phiDoiTra || ''} placeholder="0"
                onChange={(e) => setKnEditPhi((p) => ({ ...p, [k.maKN]: e.target.value }))} />
            </div>
            <div className="form-field">
              <label>Ghi chú xử lý</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input defaultValue={k.ghiChuXuLy} placeholder="ghi chú kho VN"
                  onChange={(e) => setKnEditNote((p) => ({ ...p, [k.maKN]: e.target.value }))} />
                <button className="btn btn-secondary btn-sm" onClick={() => saveKnPhi(k)}><FiSave /></button>
              </div>
            </div>
          </div>
        ) : (
          <div className="icon-inline" style={{ background: '#FEF3C7', padding: 8, borderRadius: 6, marginTop: 8, fontSize: 12, color: '#92400E' }}>
            <FiAlertCircle /> Bắn mã VĐ <b>{k.maVDTraHang || '—'}</b> ở ô trên để xác nhận đã nhận hàng khách gửi trả.
          </div>
        )}
      </div>
    );
  }

  const tabKien = (
    <div className="form-section">
      <div className="section-title"><FiLayers /> Kiện hàng — nhận & giao theo từng mã vận đơn</div>

      <div className="action-card">
        <div className="ac-title"><FiDownload /> Nhận hàng theo bao</div>
        <div className="form-grid" style={{ marginTop: 8 }}>
          <div className="form-field"><label>Quét / nhập mã bao</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={baoScan} onChange={(e) => setBaoScan(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') openBaoKien(); }} placeholder="BAO0001" />
              <button className="btn btn-primary" onClick={openBaoKien}><FiBox /> Mở bao</button>
            </div>
          </div>
        </div>

        {baoOpen && (
          <>
            <div className="ac-meta" style={{ marginTop: 10 }}>
              Bao <b>{baoOpen.maBao}</b> · Line {LINE_LABEL[baoOpen.line] || baoOpen.line} · Đã về: <b>{baoOpen.daVe}/{baoOpen.soKien}</b> kiện
            </div>
            <div className="form-field" style={{ marginTop: 8 }}>
              <label>Bắn mã vận đơn (nhận từng kiện)</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={nhanKienScan} onChange={(e) => setNhanKienScan(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') nhanKien(); }} placeholder="Quét mã VĐ trên kiện…" />
                <button className="btn btn-success" onClick={nhanKien}><FiCheck /> Nhận kiện</button>
              </div>
            </div>
            {baoConThieu > 0 && (
              <div className="icon-inline" style={{ background: '#FEF3C7', padding: 8, borderRadius: 6, marginTop: 8, fontSize: 12, color: '#92400E' }}>
                <FiAlertCircle /> Bao còn <b>{baoConThieu}</b> kiện chưa nhận.
              </div>
            )}
            <table className="data-table" style={{ marginTop: 10 }}>
              <thead><tr><th>Mã VĐ</th><th>Mã đơn</th><th>Trạng thái</th></tr></thead>
              <tbody>
                {baoOpen.kien.map((k) => (
                  <tr key={k.maVD}>
                    <td><b>{k.maVD}</b></td>
                    <td>{k.maDH}</td>
                    <td><span className={`status-badge ${KIEN_CLASS[k.trangThai] || 's-waiting'}`}>{KIEN_LABEL[k.trangThai] || k.trangThai}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        <div className="hint">Mở bao rồi bắn từng mã VĐ. Đơn chỉ về kho khi mọi kiện của nó đã nhận.</div>
      </div>

      <div className="action-card">
        <div className="ac-title"><FiTruck /> Giao khách theo kiện</div>
        <div className="form-field" style={{ marginTop: 8 }}>
          <label>Bắn mã vận đơn (giao từng kiện)</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={giaoKienScan} onChange={(e) => setGiaoKienScan(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') giaoKien(); }} placeholder="Quét mã VĐ kiện giao khách…" />
            <button className="btn btn-success" onClick={giaoKien}><FiTarget /> Giao kiện</button>
          </div>
        </div>
        <div className="hint">Đơn về một phần vẫn giao được kiện đã về. Đơn còn nợ tiền sẽ không giao được.</div>
      </div>

      <div className="section-title" style={{ marginTop: 16 }}><FiLayers /> Kiện của các đơn đang xử lý ({kienList.length})</div>
      {kienList.length === 0 ? (
        <div className="empty-state"><FiLayers /><p>Chưa có kiện nào.</p></div>
      ) : (
        <table className="data-table">
          <thead><tr><th>Mã VĐ</th><th>Mã đơn</th><th>Mã bao</th><th>Trạng thái</th><th>Ngày về</th><th>Ngày giao</th></tr></thead>
          <tbody>
            {kienList.map((k) => (
              <tr key={`${k.maDH}-${k.maVD}`}>
                <td><b>{k.maVD}</b></td>
                <td style={{ cursor: 'pointer', textDecoration: 'underline', color: '#1E3A8A' }}
                  onClick={() => (window as any).openOrderDetail?.(k.maDH)}>{k.maDH}</td>
                <td>{k.maBao || '—'}</td>
                <td><span className={`status-badge ${KIEN_CLASS[k.trangThai] || 's-waiting'}`}>{KIEN_LABEL[k.trangThai] || k.trangThai}</span></td>
                <td>{k.ngayVeVN ? formatDate(k.ngayVeVN) : '—'}</td>
                <td>{k.ngayGiao ? formatDate(k.ngayGiao) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  const tabKN = (
    <div className="form-section">
      <div className="section-title"><FiRotateCcw /> Hàng khiếu nại khách gửi trả</div>

      <div className="action-card">
        <div className="ac-title"><FiCheck /> Nhận hàng khiếu nại</div>
        <div className="form-grid" style={{ marginTop: 8 }}>
          <div className="form-field"><label>Bắn mã VĐ hàng khiếu nại</label>
            <input value={knVDScan} onChange={(e) => setKnVDScan(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') nhanHangKN(); }} placeholder="Quét mã VĐ khách gửi trả…" />
          </div>
          <div className="form-field"><label>Phí đổi trả (VNĐ)</label>
            <input type="number" value={knPhi} onChange={(e) => setKnPhi(e.target.value)} placeholder="0" />
          </div>
        </div>
        <div className="form-field" style={{ marginTop: 8 }}><label>Ghi chú</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={knGhiChu} onChange={(e) => setKnGhiChu(e.target.value)} placeholder="tình trạng hàng nhận về…" />
            <button className="btn btn-success" onClick={nhanHangKN}><FiCheck /> Xác nhận nhận</button>
          </div>
        </div>
        <div className="hint">Bắn mã VĐ khách gửi trả để tích đã nhận và ghi phí đổi trả. Kế toán / CSKH sẽ nhận thông báo.</div>
      </div>

      {knList.length === 0 ? (
        <div className="empty-state"><FiRotateCcw /><p>Không có hàng khiếu nại nào chuyển về kho.</p></div>
      ) : knList.map((k) => knCard(k))}
    </div>
  );

  const tabQuy = (
    <div className="form-section">
      <div className="section-title"><FiDollarSign /> Quỹ kho VN — thu hộ / chi ship nội địa</div>

      <div className="kpi-row">
        <div className="kpi" style={{ ['--primary' as any]: '#16a34a' }}>
          <div className="kpi-label"><FiDownload /> Tổng thu</div>
          <div className="kpi-value">{fmtVND(tongThuQuy)}đ</div>
        </div>
        <div className="kpi" style={{ ['--primary' as any]: '#dc2626' }}>
          <div className="kpi-label"><FiTruck /> Tổng chi</div>
          <div className="kpi-value">{fmtVND(tongChiQuy)}đ</div>
        </div>
        <div className="kpi" style={{ ['--primary' as any]: '#2563eb' }}>
          <div className="kpi-label"><FiDollarSign /> Tồn quỹ</div>
          <div className="kpi-value">{fmtVND(tonQuy)}đ</div>
        </div>
      </div>

      <div className="action-card">
        <div className="ac-title"><FiPlus /> Thêm bút toán</div>
        <div className="form-grid" style={{ marginTop: 8 }}>
          <div className="form-field"><label>Loại</label>
            <select value={quyLoai} onChange={(e) => setQuyLoai(e.target.value as 'Thu' | 'Chi')}>
              <option value="Thu">Thu</option>
              <option value="Chi">Chi</option>
            </select>
          </div>
          <div className="form-field"><label>Số tiền (VNĐ)</label>
            <input type="number" value={quySoTien} onChange={(e) => setQuySoTien(e.target.value)} placeholder="0" />
          </div>
          <div className="form-field"><label>Danh mục</label>
            <select value={quyDanhMuc} onChange={(e) => setQuyDanhMuc(e.target.value)}>
              <option value="">-- Chọn danh mục --</option>
              {DANH_MUC_QUY.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="form-field"><label>Mã đơn (nếu có)</label>
            <input value={quyMaDH} onChange={(e) => setQuyMaDH(e.target.value)} placeholder="DH..." />
          </div>
        </div>
        <div className="form-field" style={{ marginTop: 8 }}><label>Nội dung</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={quyNoiDung} onChange={(e) => setQuyNoiDung(e.target.value)} placeholder="diễn giải thu / chi" />
            <button className="btn btn-primary" onClick={addQuy}><FiSave /> Ghi sổ</button>
          </div>
        </div>
      </div>

      {quyList.length === 0 ? (
        <div className="empty-state"><FiDollarSign /><p>Chưa có bút toán quỹ kho VN.</p></div>
      ) : (
        <table className="data-table">
          <thead><tr><th>Ngày</th><th>Loại</th><th>Danh mục</th><th>Nội dung</th><th>Mã đơn</th><th className="number">Số tiền</th></tr></thead>
          <tbody>
            {quyList.map((q) => (
              <tr key={q.id}>
                <td>{formatDate(q.ngay)}</td>
                <td><span className={`status-badge ${q.loai === 'Thu' ? 's-done' : 's-cancel'}`}>{q.loai === 'Thu' ? 'Thu' : 'Chi'}</span></td>
                <td>{q.danhMuc || '—'}</td>
                <td>{q.noiDung}</td>
                <td>{q.maDH || '—'}</td>
                <td className="number" style={{ color: q.loai === 'Thu' ? '#166534' : '#991B1B', fontWeight: 700 }}>
                  {q.loai === 'Thu' ? '+' : '−'}{fmtVND(q.soTien)}đ
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <AppShell user={user}>
      <div className="alert alert-info">
        <FiInfo /><span>Bạn là <b>Kho VN</b>. Nhận hàng từ TQ về và giao cho khách (yêu cầu đơn đã thanh toán đủ).</span>
      </div>

      <div className="kpi-row">
        <div className="kpi" style={{ ['--primary' as any]: '#3b82f6' }}>
          <div className="kpi-label"><FiTruck /> Đang VC về</div>
          <div className="kpi-value">{incomingShipments.length}</div>
        </div>
        <div className="kpi" style={{ ['--primary' as any]: '#f59e0b' }}>
          <div className="kpi-label"><FiPackage /> Tại kho VN</div>
          <div className="kpi-value">{atWarehouse.length}</div>
        </div>
        <div className="kpi" style={{ ['--primary' as any]: '#16a34a' }}>
          <div className="kpi-label"><FiCheckCircle /> Sẵn sàng giao</div>
          <div className="kpi-value">{readyToDeliver.length}</div>
        </div>
        <div className="kpi" style={{ ['--primary' as any]: '#10b981' }}>
          <div className="kpi-label"><FiTarget /> Đã giao hôm nay</div>
          <div className="kpi-value">-</div>
        </div>
      </div>

      <Tabs tabs={[
        { id: 'tab-bao', label: <><FiBox /> Nhận bao ({baos.length})</>, content: tabBao },
        { id: 'tab-incoming', label: <><FiDownload /> Đang về VN ({incomingShipments.length})</>, content: tabIncoming },
        { id: 'tab-at-vn', label: <><FiPackage /> Tại VN - chờ TT ({atWarehouse.length})</>, content: tabAtVN },
        { id: 'tab-ready', label: <><FiTruck /> Sẵn sàng giao ({readyToDeliver.length})</>, content: tabReady },
        { id: 'tab-kien', label: <><FiLayers /> Kiện hàng ({kienList.length})</>, content: tabKien },
        { id: 'tab-kn', label: <><FiRotateCcw /> Hàng khiếu nại ({knList.length})</>, content: tabKN },
        { id: 'tab-quy', label: <><FiDollarSign /> Quỹ kho VN ({quyList.length})</>, content: tabQuy }
      ]} />

      {/* Modal sửa cân nặng (có lưu lịch sử) */}
      <div className={`modal-overlay ${weighMaDH ? 'show' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setWeighMaDH(null); }}>
        {/* 760px: 7 cột (SP · SL · KG · D · R · C · M³) không lọt bề ngang mặc định 560px. */}
        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 760 }}>
          <div className="modal-header">
            <h2><FiEdit2 /> Sửa cân & kích thước — {weighMaDH}</h2>
            <button className="modal-close" onClick={() => setWeighMaDH(null)}><FiX /></button>
          </div>
          <div className="modal-body">
            <div className="alert alert-warning" style={{ marginBottom: 12 }}>
              <FiInfo /><span>Kho VN cân lại thực tế. Mỗi thay đổi được <b>lưu lịch sử</b> (Audit log) và tự tính lại phí VC.
                Nhập đủ <b>Dài × Rộng × Cao (cm)</b> thì ô <b>M³</b> tự tính theo hệ số trong Cài đặt và bị khoá; bỏ trống kích thước thì gõ M³ tay.</span>
            </div>
            {weighLines.length === 0 ? (
              <div className="empty-state"><FiClock /><p>Đang tải dòng hàng…</p></div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ minWidth: 620 }}>
                <thead><tr>
                  <th>Sản phẩm</th><th className="number">SL</th><th className="number">KG/sp</th>
                  <th className="number">Dài</th><th className="number">Rộng</th><th className="number">Cao (cm)</th>
                  <th className="number">M³/sp</th>
                </tr></thead>
                <tbody>
                  {weighLines.map((l) => {
                    const hasKT = (parseFloat(l.dai) || 0) > 0 && (parseFloat(l.rong) || 0) > 0 && (parseFloat(l.cao) || 0) > 0;
                    return (
                      <tr key={l.stt}>
                        <td>{l.tenSP}</td>
                        <td className="number">{l.soLuong}</td>
                        <td className="number"><input type="number" step="0.01" value={l.kg} style={{ width: 80, textAlign: 'right' }} onChange={(e) => patchWeigh(l.stt, { kg: e.target.value })} /></td>
                        <td className="number"><input type="number" value={l.dai} style={{ width: 60, textAlign: 'right' }} onChange={(e) => patchWeigh(l.stt, { dai: e.target.value })} /></td>
                        <td className="number"><input type="number" value={l.rong} style={{ width: 60, textAlign: 'right' }} onChange={(e) => patchWeigh(l.stt, { rong: e.target.value })} /></td>
                        <td className="number"><input type="number" value={l.cao} style={{ width: 60, textAlign: 'right' }} onChange={(e) => patchWeigh(l.stt, { cao: e.target.value })} /></td>
                        <td className="number"><input type="number" step="0.0001" value={l.m3} readOnly={hasKT} style={{ width: 100, textAlign: 'right', background: hasKT ? '#F3F4F6' : undefined }} onChange={(e) => patchWeigh(l.stt, { m3: e.target.value })} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            )}
          </div>
          <div className="btn-row">
            <button className="btn btn-secondary" onClick={() => setWeighMaDH(null)}>Hủy</button>
            <button className="btn btn-success" onClick={saveWeigh} disabled={weighBusy || weighLines.length === 0}>
              {weighBusy ? <FiClock /> : <FiCheck />} Lưu cân nặng
            </button>
          </div>
        </div>
      </div>

      <OrderDetailModalHost canSeeMoney={false} />
      <ImageUploadModalHost />
    </AppShell>
  );
}
