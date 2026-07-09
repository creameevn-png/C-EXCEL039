'use client';

import { useState } from 'react';
import {
  FiInfo, FiEdit3, FiClock, FiTruck, FiPackage, FiSave, FiLock, FiFileText,
  FiAlertTriangle, FiMessageSquare, FiExternalLink, FiInbox
} from 'react-icons/fi';
import type { SessionUser } from '@/lib/auth';
import AppShell from '@/components/AppShell';
import Tabs from '@/components/Tabs';
import OrderDetailModalHost from '@/components/OrderDetailModal';
import { showToast } from '@/components/Toast';
import { callServer, reload } from '@/lib/client';
import { fmtVND, fmtDateDDMM } from '@/lib/format';
import { KN_LABEL } from '@/lib/status';

type ChiTiet = { stt: number; tenSP: string; soLuong: number; donGiaNDT: number; linkTaobao: string };
type Pending = {
  maDH: string; tenKH: string; web: string; tongKg: number; tuyen: string;
  tongTien: number; daTra: number; tenHang: string;
  maGD: string; maVD: string; trangThai: string;
  vonNDT: number; shipNDTQ: number; loiNhuanNDT: number; tongThuNDT: number;
  ghiChuGDV: string; chiTiet: ChiTiet[];
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

export default function GdvClient({ user, pendingOrders, khieuNai }: { user: SessionUser; pendingOrders: Pending[]; khieuNai: KhieuNai[] }) {
  const ordersDeposit = pendingOrders.filter((o) => o.trangThai === 'DatCoc');
  const ordersBought = pendingOrders.filter((o) => o.trangThai === 'DaMuaHang');

  const [gdInputs, setGdInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(pendingOrders.map((o) => [o.maDH, o.maGD || ''])));
  const [vdInputs, setVdInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(pendingOrders.map((o) => [o.maDH, o.maVD || ''])));
  const [vonInputs, setVonInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(pendingOrders.map((o) => [o.maDH, o.vonNDT ? String(o.vonNDT) : ''])));
  const [shipTqInputs, setShipTqInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(pendingOrders.map((o) => [o.maDH, o.shipNDTQ ? String(o.shipNDTQ) : ''])));
  // Góp ý NV #14: ghi chú riêng của GDV cho từng đơn.
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(pendingOrders.map((o) => [o.maDH, o.ghiChuGDV || ''])));
  // Góp ý NV #17: số lượng còn của shop theo từng dòng hàng — khoá "maDH:stt".
  const [slInputs, setSlInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(pendingOrders.flatMap((o) => o.chiTiet.map((c) => [`${o.maDH}:${c.stt}`, String(c.soLuong)]))));
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  function fmtNDT(n: number) { return Number(n || 0).toLocaleString('zh-CN') + '¥'; }

  async function submitVonGDV(maDH: string) {
    const vonNDT = parseFloat(vonInputs[maDH] || '0') || 0;
    const shipNDTQ = parseFloat(shipTqInputs[maDH] || '0') || 0;
    if (vonNDT <= 0) return showToast('Nhập tổng tệ mua thực tế (¥)', 'error');
    setBusy((p) => ({ ...p, [maDH]: true }));
    const r = await callServer('updateVonGDV', maDH, { vonNDT, shipNDTQ, ghiChuGDV: noteInputs[maDH] ?? '' });
    setBusy((p) => ({ ...p, [maDH]: false }));
    if (r?.success) { showToast(`Đã lưu giá vốn ${maDH} · LN ${fmtNDT(r.loiNhuanNDT)}`, 'success'); reload(); }
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
          <b>Số lượng còn của shop</b> — sửa nếu shop hết hàng; tổng tiền đơn tự tính lại.
        </div>
        <table className="data-table">
          <thead><tr><th>#</th><th>Sản phẩm</th><th className="number">Giá tệ</th><th style={{ width: 150 }}>SL còn</th><th style={{ width: 60 }}></th></tr></thead>
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
                  <input type="number" min={0} value={slInputs[`${o.maDH}:${c.stt}`] ?? ''}
                    onChange={(e) => setSlInputs((p) => ({ ...p, [`${o.maDH}:${c.stt}`]: e.target.value }))}
                    disabled={busy[o.maDH]} />
                </td>
                <td>
                  <button className="btn btn-secondary btn-sm" onClick={() => submitSoLuong(o.maDH, c.stt)} disabled={busy[o.maDH]}>
                    <FiSave />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function vonGDV(o: Pending) {
    const von = parseFloat(vonInputs[o.maDH] || '0') || 0;
    const shipTq = parseFloat(shipTqInputs[o.maDH] || '0') || 0;
    const ln = o.tongThuNDT - (von + shipTq);
    return (
      <div style={{ marginTop: 10, padding: 10, background: 'var(--surface-2)', borderRadius: 8 }}>
        <div className="ac-meta" style={{ marginBottom: 8 }}>
          <b>Giá vốn (¥) — phục vụ lãi/lỗ.</b> Tệ khách trả trên đơn: <b>{fmtNDT(o.tongThuNDT)}</b>
        </div>
        <div className="form-grid">
          <div className="form-field">
            <label>Tổng tệ MUA thực tế (¥)</label>
            <input type="number" step="0.01" value={vonInputs[o.maDH] ?? ''}
              onChange={(e) => setVonInputs((p) => ({ ...p, [o.maDH]: e.target.value }))}
              placeholder="VD: 1250" disabled={busy[o.maDH]} />
          </div>
          <div className="form-field">
            <label>Ship nội địa TQ (¥)</label>
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
        <div className="ac-meta" style={{ marginTop: 8 }}>
          Lợi nhuận GDV (ước tính): <b style={{ color: ln >= 0 ? '#059669' : '#DC2626' }}>{fmtNDT(ln)}</b>
          <button className="btn btn-secondary btn-sm" style={{ marginLeft: 10 }} onClick={() => submitVonGDV(o.maDH)} disabled={busy[o.maDH]}>
            <FiSave /> Lưu giá vốn + ghi chú
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

  const tabDeposit = (
    <div className="form-section">
      <div className="section-title"><FiEdit3 /> Đơn đặt cọc — cần mua hàng từ NCC</div>
      {ordersDeposit.length === 0 ? (
        <div className="empty-state"><FiPackage /><p>Không có đơn nào chờ mua.</p></div>
      ) : ordersDeposit.map((o) => (
        <div key={o.maDH} className="action-card" style={{ opacity: busy[o.maDH] ? 0.5 : 1 }}>
          <div className="ac-header">
            <div className="ac-title" style={{ cursor: 'pointer', textDecoration: 'underline' }}
                 onClick={() => (window as any).openOrderDetail?.(o.maDH)}>{o.maDH}</div>
            <span className="status-badge s-deposit">Đặt cọc</span>
          </div>
          <div className="ac-meta">KH: <b>{o.tenKH}</b> · Web: <b>{o.web}</b> · {o.tongKg}kg · {o.tuyen === 'HCM' ? 'HCM' : 'Hà Nội'}</div>
          <div className="ac-amount">
            <div>Tổng tiền: <b>{fmtVND(o.tongTien)}đ</b></div>
            <div>Đã cọc: <b style={{ color: '#059669' }}>{fmtVND(o.daTra)}đ</b></div>
          </div>
          <div className="ac-meta icon-inline" style={{ marginTop: 8 }}><FiFileText /><b>Hàng:</b> {o.tenHang}</div>
          <div className="form-grid" style={{ margin: '12px 0' }}>
            <div className="form-field">
              <label className="required">Mã giao dịch (NCC)</label>
              <input type="text" value={gdInputs[o.maDH] ?? ''}
                onChange={(e) => setGdInputs((p) => ({ ...p, [o.maDH]: e.target.value }))}
                placeholder="VD: TB1234567890" disabled={busy[o.maDH]} />
              <div className="hint">Mã đơn hàng bên NCC — có thể nhập nhiều mã, cách nhau dấu phẩy</div>
            </div>
          </div>
          {chiTietSL(o)}
          {vonGDV(o)}
          <div className="ac-actions">
            <button className="btn btn-primary" onClick={() => submitMaGD(o.maDH)} disabled={busy[o.maDH]}>
              <FiSave /> Lưu mã GD + chuyển sang "Đã mua"
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  const tabBought = (
    <div className="form-section">
      <div className="section-title"><FiClock /> Đã mua — chờ NCC phát hàng và nhập mã VĐ</div>
      {ordersBought.length === 0 ? (
        <div className="empty-state"><FiPackage /><p>Không có đơn nào chờ mã VĐ.</p></div>
      ) : ordersBought.map((o) => (
        <div key={o.maDH} className="action-card" style={{ opacity: busy[o.maDH] ? 0.5 : 1 }}>
          <div className="ac-header">
            <div className="ac-title" style={{ cursor: 'pointer', textDecoration: 'underline' }}
                 onClick={() => (window as any).openOrderDetail?.(o.maDH)}>{o.maDH}</div>
            <span className="status-badge s-bought">Đã mua hàng</span>
          </div>
          <div className="ac-meta">KH: <b>{o.tenKH}</b> · Web: <b>{o.web}</b> · Mã GD: <b>{o.maGD || '(chưa có)'}</b></div>
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
          {chiTietSL(o)}
          {vonGDV(o)}
          <div className="ac-actions">
            <button className="btn btn-warning" onClick={() => submitMaVD(o.maDH)} disabled={busy[o.maDH]}>
              <FiSave /> Lưu mã VĐ + chuyển sang "NCC giao hàng"
            </button>
          </div>
        </div>
      ))}
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
            <div className="ac-title">{k.maKN}</div>
            <span className={`status-badge ${k.trangThai === 'TuChoi' ? 's-cancel' : 's-deposit'}`}>
              {(KN_LABEL as Record<string, string>)[k.trangThai] || k.trangThai}
            </span>
          </div>
          <div className="ac-meta">
            Loại: <b>{KN_LOAI[k.loai] || k.loai}</b> · Đơn: <b>{k.maDH || '-'}</b> · KH: <b>{k.tenKH || k.maKH || '-'}</b> · {fmtDateDDMM(k.ngayTao)}
            {k.maDH && <> · <span style={{ cursor: 'pointer', color: 'var(--primary)', textDecoration: 'underline' }} onClick={() => (window as any).openOrderDetail?.(k.maDH)}>Xem đơn</span></>}
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
        { id: 'tab-kn', label: <><FiAlertTriangle /> Khiếu nại ({khieuNai.length})</>, content: tabKhieuNai }
      ]} />

      <div className="alert alert-lock">
        <FiLock /><span><b>Bạn KHÔNG được sửa:</b> Tổng tiền · Tiền cọc · Trạng thái · Tên KH · Giá hàng · Phí</span>
      </div>

      <OrderDetailModalHost canSeeMoney={false} canSeeProfit={true} />
    </AppShell>
  );
}
