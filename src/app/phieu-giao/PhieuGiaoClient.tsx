'use client';

import { useMemo, useState } from 'react';
import {
  FiFileText, FiUsers, FiPlus, FiPrinter, FiTrash2, FiInbox, FiCheckCircle, FiClock
} from 'react-icons/fi';
import type { SessionUser } from '@/lib/auth';
import AppShell from '@/components/AppShell';
import Tabs from '@/components/Tabs';
import { showToast } from '@/components/Toast';
import { callServer, reload } from '@/lib/client';
import { fmtVND, formatDate } from '@/lib/format';
import { statusToLabel } from '@/lib/status';

type Cand = { maDH: string; maKH: string; tenKH: string; hang: string; tongTien: number; daTra: number; conLai: number; trangThai: string };
type Phieu = { maPhieu: string; maKH: string; tenKH: string; soDon: number; tongTien: number; daThu: number; conLai: number; nguoiTao: string; createdAt: string };

export default function PhieuGiaoClient({ user, candidates, phieus }:
  { user: SessionUser; candidates: Cand[]; phieus: Phieu[] }) {

  const byKH = useMemo(() => {
    const m: Record<string, Cand[]> = {};
    for (const c of candidates) (m[c.maKH] ||= []).push(c);
    return m;
  }, [candidates]);
  const khList = Object.keys(byKH);

  const [selKH, setSelKH] = useState('');
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [ghiChu, setGhiChu] = useState('');
  const [busy, setBusy] = useState(false);

  const orders = selKH ? byKH[selKH] || [] : [];
  const pickedList = orders.filter((o) => picked[o.maDH]);
  const sumTien = pickedList.reduce((s, o) => s + o.tongTien, 0);
  const sumCon = pickedList.reduce((s, o) => s + o.conLai, 0);

  function toggle(maDH: string) { setPicked((p) => ({ ...p, [maDH]: !p[maDH] })); }

  async function createPhieu() {
    if (!selKH) return showToast('Chọn khách hàng', 'error');
    const maDHs = pickedList.map((o) => o.maDH);
    if (maDHs.length === 0) return showToast('Chọn ít nhất 1 đơn', 'error');
    setBusy(true);
    const r = await callServer('createPhieuGiao', { maKH: selKH, maDHs, ghiChu });
    setBusy(false);
    if (r?.success) { showToast(`Đã tạo phiếu ${r.maPhieu} · công nợ ${fmtVND(r.conLai)}đ`, 'success'); reload(); }
    else showToast(r?.message || 'Lỗi', 'error');
  }

  async function deletePhieu(maPhieu: string) {
    if (!confirm(`Xoá phiếu ${maPhieu}? Các đơn sẽ được gỡ khỏi phiếu.`)) return;
    const r = await callServer('deletePhieuGiao', maPhieu);
    if (r?.success) { showToast('Đã xoá phiếu', 'success'); reload(); }
    else showToast(r?.message || 'Lỗi', 'error');
  }

  async function printPhieu(maPhieu: string) {
    const r = await callServer('getPhieuGiaoDetail', maPhieu);
    if (!r?.success) return showToast(r?.message || 'Không tải được phiếu', 'error');
    const d = r.data;
    const rows = d.orders.map((o: any, i: number) => `
      <tr>
        <td>${i + 1}</td><td>${o.maDH}</td><td>${esc(o.hang)}</td>
        <td style="text-align:right">${fmtVND(o.tongTien)}</td>
        <td style="text-align:right">${fmtVND(o.daTra)}</td>
        <td style="text-align:right">${fmtVND(o.conLai)}</td>
      </tr>`).join('');
    const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${d.maPhieu}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px;color:#111;font-size:13px}
        h1{font-size:20px;margin:0 0 4px} .muted{color:#555}
        table{width:100%;border-collapse:collapse;margin-top:12px}
        th,td{border:1px solid #999;padding:6px 8px;text-align:left}
        th{background:#f1f5f9}
        .tot{font-weight:bold;background:#f8fafc}
        .sign{margin-top:36px;display:flex;justify-content:space-between;text-align:center}
      </style></head><body>
      <h1>PHIẾU GIAO HÀNG — ${d.maPhieu}</h1>
      <div class="muted">Ngày: ${formatDate(d.createdAt)} · NV lập: ${esc(d.nguoiTao)}</div>
      <div style="margin-top:8px">
        <b>Khách:</b> ${d.maKH} - ${esc(d.tenKH)} ${d.sdt ? '· ' + esc(d.sdt) : ''}<br>
        ${d.diaChi ? '<b>Địa chỉ:</b> ' + esc(d.diaChi) : ''}
      </div>
      <table>
        <thead><tr><th>#</th><th>Mã đơn</th><th>Hàng</th><th style="text-align:right">Tổng tiền</th><th style="text-align:right">Đã trả</th><th style="text-align:right">Còn lại</th></tr></thead>
        <tbody>${rows}
          <tr class="tot"><td colspan="3">TỔNG CỘNG (${d.soDon} đơn)</td>
            <td style="text-align:right">${fmtVND(d.tongTien)}</td>
            <td style="text-align:right">${fmtVND(d.daThu)}</td>
            <td style="text-align:right">${fmtVND(d.conLai)}</td></tr>
        </tbody>
      </table>
      ${d.ghiChu ? '<p><b>Ghi chú:</b> ' + esc(d.ghiChu) + '</p>' : ''}
      <p style="margin-top:10px"><b>CÔNG NỢ CÒN LẠI THEO PHIẾU: ${fmtVND(d.conLai)}đ</b></p>
      <div class="sign"><div>Người giao<br><br><br>______________</div><div>Người nhận<br><br><br>______________</div></div>
      <script>window.onload=function(){window.print()}</script>
      </body></html>`;
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) return showToast('Trình duyệt chặn cửa sổ in. Cho phép popup rồi thử lại.', 'error');
    w.document.write(html); w.document.close();
  }

  const tabCreate = (
    <div className="form-section">
      <div className="section-title"><FiPlus /> Tạo phiếu giao — gộp nhiều đơn của 1 khách</div>
      <div className="form-grid" style={{ marginBottom: 12 }}>
        <div className="form-field">
          <label>Khách hàng (có đơn chờ giao)</label>
          <select value={selKH} onChange={(e) => { setSelKH(e.target.value); setPicked({}); }}>
            <option value="">— Chọn khách —</option>
            {khList.map((k) => <option key={k} value={k}>{k} - {byKH[k][0].tenKH} ({byKH[k].length} đơn)</option>)}
          </select>
        </div>
        <div className="form-field"><label>Ghi chú phiếu</label>
          <input value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} placeholder="vd: giao đợt 1" /></div>
      </div>

      {!selKH ? (
        <div className="empty-state"><FiUsers /><p>Chọn khách hàng để xem các đơn có thể gộp.</p></div>
      ) : orders.length === 0 ? (
        <div className="empty-state"><FiInbox /><p>Khách này không có đơn nào chờ giao.</p></div>
      ) : (
        <>
          <table className="data-table">
            <thead><tr><th></th><th>Mã đơn</th><th>Hàng</th><th className="number">Tổng tiền</th><th className="number">Còn lại</th><th>Trạng thái</th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.maDH}>
                  <td><input type="checkbox" checked={!!picked[o.maDH]} onChange={() => toggle(o.maDH)} /></td>
                  <td className="ma-don" style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => (window as any).openOrderDetail?.(o.maDH)}>{o.maDH}</td>
                  <td>{o.hang}</td>
                  <td className="number">{fmtVND(o.tongTien)}</td>
                  <td className="number" style={{ color: o.conLai > 0 ? '#DC2626' : '#059669' }}>{fmtVND(o.conLai)}</td>
                  <td>{statusToLabel(o.trangThai)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="action-card" style={{ marginTop: 12 }}>
            <div className="ac-meta">Đã chọn <b>{pickedList.length}</b> đơn · Tổng tiền <b>{fmtVND(sumTien)}đ</b> · Công nợ còn <b style={{ color: '#DC2626' }}>{fmtVND(sumCon)}đ</b></div>
            <div className="ac-actions">
              <button className="btn btn-success" onClick={createPhieu} disabled={busy || pickedList.length === 0}>
                {busy ? <FiClock /> : <FiFileText />} Tạo phiếu giao
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );

  const tabList = (
    <div className="form-section">
      <div className="section-title"><FiFileText /> Danh sách phiếu giao ({phieus.length})</div>
      {phieus.length === 0 ? (
        <div className="empty-state"><FiInbox /><p>Chưa có phiếu giao nào.</p></div>
      ) : (
        <table className="data-table">
          <thead><tr>
            <th>Mã phiếu</th><th>Ngày</th><th>Khách</th><th className="number">Số đơn</th>
            <th className="number">Tổng tiền</th><th className="number">Đã thu</th><th className="number">Công nợ</th><th>Thao tác</th>
          </tr></thead>
          <tbody>
            {phieus.map((p) => (
              <tr key={p.maPhieu}>
                <td className="ma-don">{p.maPhieu}</td>
                <td>{formatDate(p.createdAt)}</td>
                <td>{p.maKH ? (
                  <span style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--primary)' }} onClick={() => (window as any).openCustomerDetail?.(p.maKH)}>{p.maKH} - {p.tenKH}</span>
                ) : `${p.maKH} - ${p.tenKH}`}</td>
                <td className="number">{p.soDon}</td>
                <td className="number">{fmtVND(p.tongTien)}</td>
                <td className="number" style={{ color: '#059669' }}>{fmtVND(p.daThu)}</td>
                <td className="number" style={{ color: p.conLai > 0 ? '#DC2626' : '#059669', fontWeight: 600 }}>{fmtVND(p.conLai)}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn btn-primary btn-sm" onClick={() => printPhieu(p.maPhieu)}><FiPrinter /> In</button>{' '}
                  <button className="btn btn-danger btn-sm" onClick={() => deletePhieu(p.maPhieu)}><FiTrash2 /></button>
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
        <FiCheckCircle /><span>Gộp nhiều đơn của <b>cùng 1 khách</b> thành <b>1 phiếu giao</b> · in phiếu · theo dõi <b>công nợ theo phiếu</b>.</span>
      </div>
      <Tabs tabs={[
        { id: 'tab-create', label: <><FiPlus /> Tạo phiếu</>, content: tabCreate },
        { id: 'tab-list', label: <><FiFileText /> Danh sách phiếu ({phieus.length})</>, content: tabList }
      ]} />
    </AppShell>
  );
}

function esc(s: string) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
