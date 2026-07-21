'use client';

import { useState } from 'react';
import {
  FiInfo, FiEdit3, FiClock, FiTruck, FiPackage, FiSave, FiLock, FiFileText,
  FiAlertTriangle, FiMessageSquare, FiExternalLink, FiInbox, FiUser, FiList
} from 'react-icons/fi';
import type { SessionUser } from '@/lib/auth';
import AppShell from '@/components/AppShell';
import Tabs from '@/components/Tabs';
import OrderDetailModalHost from '@/components/OrderDetailModal';
import VanDonDetailModalHost from '@/components/VanDonDetailModal';
import KhieuNaiDetailModalHost from '@/components/KhieuNaiDetailModal';
import { showToast } from '@/components/Toast';
import { callServer, reload } from '@/lib/client';
import { fmtVND, fmtDateDDMM } from '@/lib/format';
import { KN_LABEL, TRANG_THAI_LABEL, statusToLabel, statusToClass } from '@/lib/status';

type ChiTiet = { stt: number; tenSP: string; soLuong: number; donGiaNDT: number; vonNDT: number; linkTaobao: string };
type Pending = {
  maDH: string; maKH: string; tenKH: string; web: string; tongKg: number; tuyen: string;
  tongTien: number; daTra: number; tenHang: string;
  maGD: string; maVD: string; trangThai: string;
  gdvId: number | null; gdvTen: string;
  vonNDT: number; shipNDTQ: number; loiNhuanNDT: number; tongThuNDT: number;
  teKhachNDT: number | null; shipKhachNDT: number;
  ghiChuGDV: string; chiTiet: ChiTiet[];
};
type AllOrder = {
  maDH: string; maKH: string; tenKH: string; maVD: string;
  trangThai: string; tongTien: number; ngayTao: string;
};
type KhieuNai = {
  maKN: string; ngayTao: string; maDH: string; maKH: string; tenKH: string;
  loai: string; moTa: string; trangThai: string; phuongAn: string; ghiChuXuLy: string; anhBangChung: string;
};

const KN_LOAI: Record<string, string> = {
  HangLoi: 'Hàng lỗi / dập vỡ', ThieuHang: 'Thiếu hàng', GiaoSai: 'Giao sai', KhongNhan: 'Không nhận', Khac: 'Khác'
};
const PHUONG_AN = ['Hoàn tiền', 'Đổi/trả hàng', 'Bồi thường', 'Giảm giá đơn sau', 'Hỗ trợ trao đổi NCC', 'Từ chối'];
const KN_STATUS = ['ChoXuLy', 'DangXuLy', 'DaXuLy', 'TuChoi'];

export default function GdvClient({ user, pendingOrders, allOrders, khieuNai }: { user: SessionUser; pendingOrders: Pending[]; allOrders: AllOrder[]; khieuNai: KhieuNai[] }) {
  const ordersDeposit = pendingOrders.filter((o) => o.trangThai === 'DatCoc');
  const ordersBought = pendingOrders.filter((o) => o.trangThai === 'DaMuaHang');
  const myOrders = pendingOrders.filter((o) => o.gdvId === user.id);

  const [gdInputs, setGdInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(pendingOrders.map((o) => [o.maDH, o.maGD || ''])));
  const [vdInputs, setVdInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(pendingOrders.map((o) => [o.maDH, o.maVD || ''])));
  const [vonInputs, setVonInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(pendingOrders.map((o) => [o.maDH, o.vonNDT ? String(o.vonNDT) : ''])));
  const [shipTqInputs, setShipTqInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(pendingOrders.map((o) => [o.maDH, o.shipNDTQ ? String(o.shipNDTQ) : ''])));
  // Đợt 4 — doanh thu khách trả bên TQ (¥): tiền hàng khách (nhập tay, để trống = tự tính) + ship khách.
  const [teKhachInputs, setTeKhachInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(pendingOrders.map((o) => [o.maDH, o.teKhachNDT != null ? String(o.teKhachNDT) : ''])));
  const [shipKhachInputs, setShipKhachInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(pendingOrders.map((o) => [o.maDH, o.shipKhachNDT ? String(o.shipKhachNDT) : ''])));
  // Góp ý NV #14: ghi chú riêng của GDV cho từng đơn.
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(pendingOrders.map((o) => [o.maDH, o.ghiChuGDV || ''])));
  // Góp ý NV #17: số lượng còn của shop theo từng dòng hàng — khoá "maDH:stt".
  const [slInputs, setSlInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(pendingOrders.flatMap((o) => o.chiTiet.map((c) => [`${o.maDH}:${c.stt}`, String(c.soLuong)]))));
  // Góp ý NV #13: tệ mua thực tế theo từng dòng hàng — khoá "maDH:stt".
  const [vonLineInputs, setVonLineInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(pendingOrders.flatMap((o) => o.chiTiet.map((c) => [`${o.maDH}:${c.stt}`, c.vonNDT ? String(c.vonNDT) : '']))));
  // Góp ý NV #20: tìm & lọc trạng thái ở tab "Tất cả đơn".
  const [allSearch, setAllSearch] = useState('');
  const [allStatus, setAllStatus] = useState('');
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  function fmtNDT(n: number) { return Number(n || 0).toLocaleString('zh-CN') + '¥'; }

  async function submitVonGDV(maDH: string) {
    // Nếu GDV đã nhập giá vốn theo từng dòng (#13) thì giữ tổng đó, không để ô tổng ghi đè.
    const o = pendingOrders.find((x) => x.maDH === maDH);
    const tongVonDong = o ? o.chiTiet.reduce((s, c) => s + (c.vonNDT || 0), 0) : 0;
    const vonNDT = tongVonDong > 0 ? tongVonDong : (parseFloat(vonInputs[maDH] || '0') || 0);
    // Chỉ gửi vốn khi GDV thực sự có nhập (ô tổng có số — kể cả "0" — hoặc đã nhập theo dòng);
    // ô trống = lưu ghi chú trước lúc mua → KHÔNG gửi để giữ vốn cũ. Cho phép đưa vốn về 0.
    const vonTouched = (vonInputs[maDH] ?? '').trim() !== '' || tongVonDong > 0;
    const shipNDTQ = parseFloat(shipTqInputs[maDH] || '0') || 0;
    const shipKhachNDT = parseFloat(shipKhachInputs[maDH] || '0') || 0;
    // Tiền hàng khách trả (¥): để trống → gửi '' để server về tự tính theo dòng; có số → override.
    const teRaw = (teKhachInputs[maDH] ?? '').trim();
    // Chưa mua hàng thì GDV vẫn phải ghi chú được (#14) — không chặn ở đây; server giữ
    // nguyên giá vốn cũ khi client không gửi lên.
    setBusy((p) => ({ ...p, [maDH]: true }));
    const r = await callServer('updateVonGDV', maDH, {
      ...(vonTouched && { vonNDT }),
      shipNDTQ,
      shipKhachNDT,
      teKhachNDT: teRaw === '' ? '' : (parseFloat(teRaw) || 0),
      ghiChuGDV: noteInputs[maDH] ?? ''
    });
    setBusy((p) => ({ ...p, [maDH]: false }));
    if (r?.success) { showToast(`Đã lưu giá vốn ${maDH} · LN ${fmtNDT(r.loiNhuanNDT)}`, 'success'); reload(); }
    else showToast(r?.message || 'Lỗi', 'error');
  }

  // Góp ý NV #13: lưu tệ mua thực tế của một dòng hàng; server tự tính lại giá vốn + lợi nhuận đơn.
  async function submitVonLine(maDH: string, stt: number) {
    const von = parseFloat(vonLineInputs[`${maDH}:${stt}`] || '0') || 0;
    if (von < 0) return showToast('Giá vốn không hợp lệ', 'error');
    setBusy((p) => ({ ...p, [maDH]: true }));
    const r = await callServer('updateChiTietVon', maDH, stt, von);
    setBusy((p) => ({ ...p, [maDH]: false }));
    if (r?.success) { showToast(`Đã lưu tệ mua dòng ${stt} · giá vốn đơn ${fmtNDT(r.vonNDT)} · LN ${fmtNDT(r.loiNhuanNDT)}`, 'success'); reload(); }
    else showToast(r?.message || 'Lỗi', 'error');
  }

  // Shop báo hết hàng / còn ít → GDV sửa số lượng thực đặt, hệ thống tự tính lại tiền đơn.
  async function submitSoLuong(maDH: string, stt: number) {
    const sl = parseInt(slInputs[`${maDH}:${stt}`] ?? '', 10);
    if (!Number.isFinite(sl) || sl < 0) return showToast('Số lượng không hợp lệ', 'error');
    setBusy((p) => ({ ...p, [maDH]: true }));
    const r = await callServer('updateChiTietSoLuong', maDH, stt, sl);
    setBusy((p) => ({ ...p, [maDH]: false }));
    if (r?.success) { showToast(`Đã cập nhật SL dòng ${stt} · đơn ${maDH}`, 'success'); reload(); }
    else showToast(r?.message || 'Lỗi', 'error');
  }

  function chiTietSL(o: Pending) {
    if (o.chiTiet.length === 0) return null;
    return (
      <div style={{ marginTop: 10 }}>
        <div className="ac-meta" style={{ marginBottom: 6 }}>
          <b>Số lượng còn & tệ mua thực tế từng sản phẩm</b> — sửa SL nếu shop hết hàng (tổng tiền tự tính lại); nhập tệ mua thực tế (¥) để tính giá vốn theo dòng.
        </div>
        <table className="data-table">
          <thead><tr>
            <th>#</th><th>Sản phẩm</th><th className="number">Giá tệ</th>
            <th style={{ width: 170 }}>SL còn</th>
            <th style={{ width: 190 }}>Tệ mua thực tế (¥)</th>
          </tr></thead>
          <tbody>
            {o.chiTiet.map((c) => (
              <tr key={c.stt}>
                <td>{c.stt}</td>
                <td>
                  {c.tenSP}
                  {c.linkTaobao && <> · <a href={c.linkTaobao} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}><FiExternalLink /></a></>}
                </td>
                <td className="number">{fmtNDT(c.donGiaNDT)}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input type="number" min={0} value={slInputs[`${o.maDH}:${c.stt}`] ?? ''}
                      onChange={(e) => setSlInputs((p) => ({ ...p, [`${o.maDH}:${c.stt}`]: e.target.value }))}
                      disabled={busy[o.maDH]} />
                    <button className="btn btn-secondary btn-sm" onClick={() => submitSoLuong(o.maDH, c.stt)} disabled={busy[o.maDH]}>
                      <FiSave />
                    </button>
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input type="number" min={0} step="0.01" value={vonLineInputs[`${o.maDH}:${c.stt}`] ?? ''}
                      onChange={(e) => setVonLineInputs((p) => ({ ...p, [`${o.maDH}:${c.stt}`]: e.target.value }))}
                      placeholder="¥ / dòng" disabled={busy[o.maDH]} />
                    <button className="btn btn-secondary btn-sm" onClick={() => submitVonLine(o.maDH, c.stt)} disabled={busy[o.maDH]}>
                      <FiSave />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Góp ý NV #12: nhãn GDV phụ trách đơn (hiện ở các tab khác khi không phải đơn của mình).
  function gdvPhuTrach(o: Pending) {
    if (o.gdvId == null || o.gdvId === user.id) return null;
    return (
      <div className="ac-meta" style={{ marginTop: 4, fontSize: 12, color: 'var(--text-muted)' }}>
        <FiUser /> GDV phụ trách: <b>{o.gdvTen || `#${o.gdvId}`}</b>
      </div>
    );
  }

  function vonGDV(o: Pending) {
    // Góp ý NV #13: nếu đã nhập tệ mua theo từng dòng thì tổng giá vốn = Σ các dòng, ô tổng chỉ đọc.
    const tongVonDong = o.chiTiet.reduce((s, c) => s + (c.vonNDT || 0), 0);
    const theoDong = tongVonDong > 0;
    const von = theoDong ? tongVonDong : (parseFloat(vonInputs[o.maDH] || '0') || 0);
    const shipTq = parseFloat(shipTqInputs[o.maDH] || '0') || 0;
    // Doanh thu khách trả (¥): tiền hàng khách (nhập tay ưu tiên, để trống = tự tính theo dòng) + ship khách.
    const teRaw = (teKhachInputs[o.maDH] ?? '').trim();
    const teKhach = teRaw === '' ? o.tongThuNDT : (parseFloat(teRaw) || 0);
    const shipKhach = parseFloat(shipKhachInputs[o.maDH] || '0') || 0;
    // Lợi nhuận = (tiền hàng khách + ship khách) − (vốn NCC + phí ship thực).
    const ln = teKhach + shipKhach - (von + shipTq);
    return (
      <div style={{ marginTop: 10, padding: 10, background: 'var(--surface-2)', borderRadius: 8 }}>
        <div className="ac-meta" style={{ marginBottom: 8 }}>
          <b>Lãi/lỗ đơn (¥).</b> Tiền hàng khách theo giá đơn: <b>{fmtNDT(o.tongThuNDT)}</b> <span style={{ color: 'var(--text-faint)' }}>(để trống ô dưới = dùng số này)</span>
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#059669', margin: '4px 0 2px' }}>① Khách trả (doanh thu)</div>
        <div className="form-grid">
          <div className="form-field">
            <label>Tiền hàng khách trả (¥)</label>
            <input type="number" step="0.01" value={teKhachInputs[o.maDH] ?? ''}
              onChange={(e) => setTeKhachInputs((p) => ({ ...p, [o.maDH]: e.target.value }))}
              placeholder={`Tự tính: ${o.tongThuNDT}`} disabled={busy[o.maDH]} />
          </div>
          <div className="form-field">
            <label>Ship nội địa TQ khách trả (¥)</label>
            <input type="number" step="0.01" value={shipKhachInputs[o.maDH] ?? ''}
              onChange={(e) => setShipKhachInputs((p) => ({ ...p, [o.maDH]: e.target.value }))}
              placeholder="VD: 40" disabled={busy[o.maDH]} />
          </div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#DC2626', margin: '8px 0 2px' }}>② Mình trả NCC (chi phí)</div>
        <div className="form-grid">
          <div className="form-field">
            <label>Tiền hàng thực trả NCC (¥)</label>
            <input type="number" step="0.01"
              value={theoDong ? String(tongVonDong) : (vonInputs[o.maDH] ?? '')}
              onChange={(e) => setVonInputs((p) => ({ ...p, [o.maDH]: e.target.value }))}
              placeholder="VD: 1250" readOnly={theoDong} disabled={busy[o.maDH]} />
            {theoDong && <div className="hint">Đang tính theo giá vốn từng sản phẩm</div>}
          </div>
          <div className="form-field">
            <label>Phí ship nội địa TQ thực (¥)</label>
            <input type="number" step="0.01" value={shipTqInputs[o.maDH] ?? ''}
              onChange={(e) => setShipTqInputs((p) => ({ ...p, [o.maDH]: e.target.value }))}
              placeholder="VD: 30" disabled={busy[o.maDH]} />
          </div>
        </div>
        <div className="form-field" style={{ marginTop: 8 }}>
          <label>Ghi chú đơn hàng (GDV)</label>
          <textarea value={noteInputs[o.maDH] ?? ''} rows={2}
            onChange={(e) => setNoteInputs((p) => ({ ...p, [o.maDH]: e.target.value }))}
            placeholder="VD: shop hết màu đỏ, đã đổi sang xanh; hẹn phát hàng 12/07…" disabled={busy[o.maDH]} />
        </div>
        <div className="ac-meta" style={{ marginTop: 8, fontSize: 11 }}>
          ({fmtNDT(teKhach)} + {fmtNDT(shipKhach)}) − ({fmtNDT(von)} + {fmtNDT(shipTq)})
        </div>
        <div className="ac-meta" style={{ marginTop: 4 }}>
          Lợi nhuận GDV: <b style={{ color: ln >= 0 ? '#059669' : '#DC2626' }}>{fmtNDT(ln)}</b>
          <button className="btn btn-secondary btn-sm" style={{ marginLeft: 10 }} onClick={() => submitVonGDV(o.maDH)} disabled={busy[o.maDH]}>
            <FiSave /> Lưu lãi/lỗ + ghi chú
          </button>
        </div>
      </div>
    );
  }

  async function submitMaGD(maDH: string) {
    const maGD = (gdInputs[maDH] || '').trim();
    if (!maGD) return showToast('Vui lòng nhập mã GD', 'error');
    if (!confirm(`Lưu Mã GD "${maGD}" cho đơn ${maDH}?`)) return;
    setBusy((p) => ({ ...p, [maDH]: true }));
    const r = await callServer('updateMaGD', maDH, maGD);
    setBusy((p) => ({ ...p, [maDH]: false }));
    if (r?.success) { showToast(`Đã lưu mã GD cho ${maDH}`, 'success'); reload(); }
    else showToast(r?.message || 'Lỗi', 'error');
  }

  async function submitMaVD(maDH: string) {
    const maVD = (vdInputs[maDH] || '').trim();
    if (!maVD) return showToast('Vui lòng nhập mã VĐ', 'error');
    if (!confirm(`Lưu Mã VĐ "${maVD}" cho đơn ${maDH}?`)) return;
    setBusy((p) => ({ ...p, [maDH]: true }));
    const r = await callServer('updateMaVD', maDH, maVD);
    setBusy((p) => ({ ...p, [maDH]: false }));
    if (r?.success) { showToast(`Đã lưu mã VĐ cho ${maDH}`, 'success'); reload(); }
    else showToast(r?.message || 'Lỗi', 'error');
  }

  // ===== Khiếu nại =====
  const [knStatus, setKnStatus] = useState<Record<string, string>>(() =>
    Object.fromEntries(khieuNai.map((k) => [k.maKN, k.trangThai])));
  const [knPa, setKnPa] = useState<Record<string, string>>(() =>
    Object.fromEntries(khieuNai.map((k) => [k.maKN, k.phuongAn])));
  const [knNote, setKnNote] = useState<Record<string, string>>(() =>
    Object.fromEntries(khieuNai.map((k) => [k.maKN, k.ghiChuXuLy])));

  async function submitKN(maKN: string) {
    setBusy((p) => ({ ...p, [maKN]: true }));
    const r = await callServer('updateKhieuNai', maKN, {
      trangThai: knStatus[maKN], phuongAn: knPa[maKN], ghiChuXuLy: knNote[maKN]
    });
    setBusy((p) => ({ ...p, [maKN]: false }));
    if (r?.success) { showToast(`Đã cập nhật ${maKN}`, 'success'); reload(); }
    else showToast(r?.message || 'Lỗi', 'error');
  }

  // Thẻ đơn dùng chung cho các tab "Đơn cần mua", "Chờ mã VĐ" và "Đơn của tôi".
  function orderCard(o: Pending) {
    const isDeposit = o.trangThai === 'DatCoc';
    return (
      <div key={o.maDH} className="action-card" style={{ opacity: busy[o.maDH] ? 0.5 : 1 }}>
        <div className="ac-header">
          <div className="ac-title" style={{ cursor: 'pointer', textDecoration: 'underline' }}
               onClick={() => (window as any).openOrderDetail?.(o.maDH)}>{o.maDH}</div>
          <span className={`status-badge ${isDeposit ? 's-deposit' : 's-bought'}`}>{isDeposit ? 'Đặt cọc' : 'Đã mua hàng'}</span>
        </div>
        {isDeposit ? (
          <>
            <div className="ac-meta">KH: <b>{o.maKH ? <span style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--primary)' }} onClick={() => (window as any).openCustomerDetail?.(o.maKH)}>{o.tenKH}</span> : o.tenKH}</b> · Web: <b>{o.web}</b> · {o.tongKg}kg · {o.tuyen === 'HCM' ? 'HCM' : 'Hà Nội'}</div>
            <div className="ac-amount">
              <div>Tổng tiền: <b>{fmtVND(o.tongTien)}đ</b></div>
              <div>Đã cọc: <b style={{ color: '#059669' }}>{fmtVND(o.daTra)}đ</b></div>
            </div>
            <div className="ac-meta icon-inline" style={{ marginTop: 8 }}><FiFileText /><b>Hàng:</b> {o.tenHang}</div>
          </>
        ) : (
          <div className="ac-meta">KH: <b>{o.maKH ? <span style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--primary)' }} onClick={() => (window as any).openCustomerDetail?.(o.maKH)}>{o.tenKH}</span> : o.tenKH}</b> · Web: <b>{o.web}</b> · Mã GD: <b>{o.maGD || '(chưa có)'}</b></div>
        )}
        {gdvPhuTrach(o)}
        {isDeposit ? (
          <div className="form-grid" style={{ margin: '12px 0' }}>
            <div className="form-field">
              <label className="required">Mã giao dịch (NCC)</label>
              <input type="text" value={gdInputs[o.maDH] ?? ''}
                onChange={(e) => setGdInputs((p) => ({ ...p, [o.maDH]: e.target.value }))}
                placeholder="VD: TB1234567890" disabled={busy[o.maDH]} />
              <div className="hint">Mã đơn hàng bên NCC — có thể nhập nhiều mã, cách nhau dấu phẩy</div>
            </div>
          </div>
        ) : (
          <div className="form-grid" style={{ margin: '12px 0' }}>
            <div className="form-field">
              <label className="required">Mã vận đơn (từ NCC)</label>
              <input type="text" value={vdInputs[o.maDH] ?? ''}
                onChange={(e) => setVdInputs((p) => ({ ...p, [o.maDH]: e.target.value }))}
                placeholder="VD: VD26050042"
                style={{ borderColor: '#F59E0B', background: '#FEF3C7' }} disabled={busy[o.maDH]} />
              <div className="hint" style={{ color: '#92400E' }}>NCC gửi mã này khi phát hàng — có thể nhập nhiều mã VĐ, cách nhau dấu phẩy</div>
            </div>
          </div>
        )}
        {chiTietSL(o)}
        {vonGDV(o)}
        <div className="ac-actions">
          {isDeposit ? (
            <button className="btn btn-primary" onClick={() => submitMaGD(o.maDH)} disabled={busy[o.maDH]}>
              <FiSave /> Lưu mã GD + chuyển sang "Đã mua"
            </button>
          ) : (
            <button className="btn btn-warning" onClick={() => submitMaVD(o.maDH)} disabled={busy[o.maDH]}>
              <FiSave /> Lưu mã VĐ + chuyển sang "NCC giao hàng"
            </button>
          )}
        </div>
      </div>
    );
  }

  const tabDeposit = (
    <div className="form-section">
      <div className="section-title"><FiEdit3 /> Đơn đặt cọc — cần mua hàng từ NCC</div>
      {ordersDeposit.length === 0 ? (
        <div className="empty-state"><FiPackage /><p>Không có đơn nào chờ mua.</p></div>
      ) : ordersDeposit.map((o) => orderCard(o))}
    </div>
  );

  const tabBought = (
    <div className="form-section">
      <div className="section-title"><FiClock /> Đã mua — chờ NCC phát hàng và nhập mã VĐ</div>
      {ordersBought.length === 0 ? (
        <div className="empty-state"><FiPackage /><p>Không có đơn nào chờ mã VĐ.</p></div>
      ) : ordersBought.map((o) => orderCard(o))}
    </div>
  );

  const tabMine = (
    <div className="form-section">
      <div className="section-title"><FiUser /> Đơn của tôi — bạn được giao phụ trách</div>
      {myOrders.length === 0 ? (
        <div className="empty-state"><FiInbox /><p>Chưa có đơn nào được giao cho bạn.</p></div>
      ) : myOrders.map((o) => orderCard(o))}
    </div>
  );

  const allFiltered = allOrders.filter((o) => {
    if (allStatus && o.trangThai !== allStatus) return false;
    const q = allSearch.trim().toLowerCase();
    if (!q) return true;
    return o.maDH.toLowerCase().includes(q)
      || o.maKH.toLowerCase().includes(q)
      || o.tenKH.toLowerCase().includes(q)
      || o.maVD.toLowerCase().includes(q);
  });

  const tabAll = (
    <div className="form-section">
      <div className="section-title"><FiList /> Tất cả đơn — chỉ để xem ({allOrders.length})</div>
      <div className="form-grid" style={{ marginBottom: 12 }}>
        <div className="form-field">
          <label>Tìm đơn</label>
          <input type="text" value={allSearch} onChange={(e) => setAllSearch(e.target.value)}
            placeholder="Mã đơn / mã KH / tên KH / mã VĐ" />
        </div>
        <div className="form-field">
          <label>Lọc theo trạng thái</label>
          <select value={allStatus} onChange={(e) => setAllStatus(e.target.value)}>
            <option value="">Tất cả trạng thái</option>
            {Object.entries(TRANG_THAI_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      {allFiltered.length === 0 ? (
        <div className="empty-state"><FiInbox /><p>Không có đơn khớp bộ lọc.</p></div>
      ) : (
        <table className="data-table">
          <thead><tr>
            <th>Mã đơn</th><th>Mã KH</th><th>Khách hàng</th><th>Mã VĐ</th>
            <th>Trạng thái</th><th className="number">Tổng tiền</th><th>Ngày tạo</th>
          </tr></thead>
          <tbody>
            {allFiltered.map((o) => (
              <tr key={o.maDH}>
                <td>
                  <span style={{ cursor: 'pointer', color: 'var(--primary)', textDecoration: 'underline' }}
                    onClick={() => (window as any).openOrderDetail?.(o.maDH)}>{o.maDH}</span>
                </td>
                <td>{o.maKH ? <span style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--primary)' }} onClick={() => (window as any).openCustomerDetail?.(o.maKH)}>{o.maKH}</span> : '-'}</td>
                <td>{o.maKH ? <span style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--primary)' }} onClick={() => (window as any).openCustomerDetail?.(o.maKH)}>{o.tenKH}</span> : o.tenKH}</td>
                <td>{o.maVD ? <span style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--primary)' }} onClick={() => (window as any).openVanDonDetail?.(o.maVD)}>{o.maVD}</span> : '-'}</td>
                <td><span className={`status-badge ${statusToClass(o.trangThai)}`}>{statusToLabel(o.trangThai)}</span></td>
                <td className="number">{fmtVND(o.tongTien)}đ</td>
                <td>{fmtDateDDMM(o.ngayTao)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  const tabKhieuNai = (
    <div className="form-section">
      <div className="section-title"><FiAlertTriangle /> Khiếu nại cần xử lý với NCC ({khieuNai.length})</div>
      {khieuNai.length === 0 ? (
        <div className="empty-state"><FiInbox /><p>Không có khiếu nại nào đang mở.</p></div>
      ) : khieuNai.map((k) => (
        <div key={k.maKN} className="action-card" style={{ opacity: busy[k.maKN] ? 0.5 : 1 }}>
          <div className="ac-header">
            <div className="ac-title" style={{ cursor: 'pointer', textDecoration: 'underline' }}
                 onClick={() => (window as any).openKhieuNaiDetail?.(k.maKN)}>{k.maKN}</div>
            <span className={`status-badge ${k.trangThai === 'TuChoi' ? 's-cancel' : 's-deposit'}`}>
              {(KN_LABEL as Record<string, string>)[k.trangThai] || k.trangThai}
            </span>
          </div>
          <div className="ac-meta">
            Loại: <b>{KN_LOAI[k.loai] || k.loai}</b> · Đơn: <b>{k.maDH ? <span style={{ cursor: 'pointer', color: 'var(--primary)', textDecoration: 'underline' }} onClick={() => (window as any).openOrderDetail?.(k.maDH)}>{k.maDH}</span> : '-'}</b> · KH: <b>{k.maKH ? <span style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--primary)' }} onClick={() => (window as any).openCustomerDetail?.(k.maKH)}>{k.tenKH || k.maKH}</span> : (k.tenKH || '-')}</b> · {fmtDateDDMM(k.ngayTao)}
          </div>
          <div style={{ background: 'var(--surface-2)', padding: 10, borderRadius: 8, margin: '10px 0', fontSize: 13 }}>
            <b>Khách phản ánh:</b> {k.moTa}
            {k.anhBangChung && <> · <a href={k.anhBangChung} target="_blank" className="icon-inline" style={{ color: 'var(--primary)' }}><FiExternalLink /> ảnh</a></>}
          </div>
          <div className="form-grid-3">
            <div className="form-field">
              <label>Trạng thái</label>
              <select value={knStatus[k.maKN] ?? k.trangThai} onChange={(e) => setKnStatus((p) => ({ ...p, [k.maKN]: e.target.value }))} disabled={busy[k.maKN]}>
                {KN_STATUS.map((s) => <option key={s} value={s}>{(KN_LABEL as Record<string, string>)[s]}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>Phương án hỗ trợ</label>
              <select value={knPa[k.maKN] ?? ''} onChange={(e) => setKnPa((p) => ({ ...p, [k.maKN]: e.target.value }))} disabled={busy[k.maKN]}>
                <option value="">-- Chọn --</option>
                {PHUONG_AN.map((pa) => <option key={pa} value={pa}>{pa}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>Phản hồi khách / ghi chú xử lý</label>
              <input value={knNote[k.maKN] ?? ''} onChange={(e) => setKnNote((p) => ({ ...p, [k.maKN]: e.target.value }))} placeholder="Đã trao đổi NCC, phương án..." disabled={busy[k.maKN]} />
            </div>
          </div>
          <div className="ac-actions">
            <button className="btn btn-primary" onClick={() => submitKN(k.maKN)} disabled={busy[k.maKN]}>
              <FiMessageSquare /> Lưu phản hồi
            </button>
          </div>
        </div>
      ))}
      <div className="alert alert-info" style={{ marginTop: 12 }}>
        <FiInfo /><span>GDV xử lý với NCC & phản hồi khách. Hoàn tiền cho khách cần lệnh riêng gửi Kế toán duyệt (đang phát triển).</span>
      </div>
    </div>
  );

  return (
    <AppShell user={user}>
      <div className="alert alert-info">
        <FiInfo /><span>Bạn là <b>GDV / Mua hàng</b>. Sửa <b>Mã GD</b>, <b>Mã VĐ</b>, nhập <b>giá vốn</b> và xử lý <b>khiếu nại</b> với NCC. Quản lý nguồn hàng / NCC ở <b>Trang Mua hàng</b>.</span>
      </div>

      <div className="kpi-row">
        <div className="kpi" style={{ ['--primary' as any]: '#0891b2' }}>
          <div className="kpi-label"><FiEdit3 /> Đơn cần mua</div>
          <div className="kpi-value">{ordersDeposit.length}</div>
          <div className="kpi-sub">Đặt cọc, chờ mua</div>
        </div>
        <div className="kpi" style={{ ['--primary' as any]: '#f59e0b' }}>
          <div className="kpi-label"><FiClock /> Chờ mã VĐ</div>
          <div className="kpi-value">{ordersBought.length}</div>
          <div className="kpi-sub">NCC chưa phát hàng</div>
        </div>
        <div className="kpi" style={{ ['--primary' as any]: '#3b82f6' }}>
          <div className="kpi-label"><FiTruck /> Đang VC</div>
          <div className="kpi-value">-</div>
        </div>
        <div className="kpi" style={{ ['--primary' as any]: '#10b981' }}>
          <div className="kpi-label"><FiPackage /> Tổng hôm nay</div>
          <div className="kpi-value">{pendingOrders.length}</div>
        </div>
      </div>

      <Tabs tabs={[
        { id: 'tab-deposit', label: <><FiEdit3 /> Đơn cần mua ({ordersDeposit.length})</>, content: tabDeposit },
        { id: 'tab-bought', label: <><FiClock /> Chờ mã VĐ ({ordersBought.length})</>, content: tabBought },
        { id: 'tab-mine', label: <><FiUser /> Đơn của tôi ({myOrders.length})</>, content: tabMine },
        { id: 'tab-all', label: <><FiList /> Tất cả đơn ({allOrders.length})</>, content: tabAll },
        { id: 'tab-kn', label: <><FiAlertTriangle /> Khiếu nại ({khieuNai.length})</>, content: tabKhieuNai }
      ]} />

      <div className="alert alert-lock">
        <FiLock /><span><b>Bạn KHÔNG được sửa:</b> Tổng tiền · Tiền cọc · Trạng thái · Tên KH · Giá hàng · Phí</span>
      </div>

      <OrderDetailModalHost canSeeMoney={false} canSeeProfit={true} />
      {/* Khiếu nại + vận đơn bấm từ trong màn; đặt sau OrderDetailModalHost để nổi lên
          trên; VĐ đặt sau KN vì KN có thể mở tiếp mã VĐ khách gửi trả. */}
      <KhieuNaiDetailModalHost />
      <VanDonDetailModalHost />
    </AppShell>
  );
}
