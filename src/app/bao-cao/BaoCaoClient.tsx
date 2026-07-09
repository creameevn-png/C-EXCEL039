'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  FiCalendar, FiTruck, FiUsers, FiUserCheck, FiTrendingUp, FiTrendingDown, FiInbox,
  FiMapPin, FiDollarSign, FiAlertTriangle, FiDownload, FiPrinter, FiBarChart2,
  FiPackage, FiRepeat, FiAward, FiBookOpen
} from 'react-icons/fi';
import Tabs from '@/components/Tabs';
import { fmtVND } from '@/lib/format';
import { LINE_LABEL } from '@/lib/status';

type Row = {
  maDH: string; ngayTao: string; maKH: string; tenKH: string; nv: string;
  nvId: number | null; gdvId: number | null;
  lineVC: string; tuyen: string; trangThai: string;
  tongKg: number; tongM3: number; tongGiaHang: number;
  phiMua: number; phiBH: number; phiPhatSinh: number; phiVC: number;
  shipND: number; dongGo: number; phuThu: number;
  phiKhieuNai: number;
  vonNDT: number; shipNDTQ: number; loiNhuanNDT: number;
  tongTien: number; daTra: number; conLai: number;
};
type NvRow = { id: number; hoTen: string; vaiTro: string; pctHoaHong: number; pctThuong: number };
type SoQuyRow = { id: number; ngay: string; quy: string; loai: string; soTien: number; danhMuc: string; noiDung: string; maDH: string; nguoiTao: string };
type KnRow = {
  maKN: string; ngayTao: string; maKH: string; maDH: string;
  loai: string; trangThai: string; soTienHoan: number; phiDoiTra: number;
};
type CashRow = { ngay: string; maDH: string; loai: string; soTien: number; ghiChu: string; nv: string };
type TonKhoRow = { maDH: string; maKH: string; tenKH: string; trangThai: string; tongKg: number; tongM3: number };

const LOAI_KN_LABEL: Record<string, string> = {
  HangLoi: 'Hàng lỗi', ThieuHang: 'Thiếu hàng', GiaoSai: 'Giao sai', KhongNhan: 'Không nhận', Khac: 'Khác'
};
const VAITRO_LABEL: Record<string, string> = { GDV: 'GDV', MuaHang: 'Mua hàng', CSKH: 'CSKH' };
const QUY_LABEL: Record<string, string> = { CongTy: 'Công ty', KhoVN: 'Kho VN', KhoTQ: 'Kho TQ' };

function monthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function prevMonth(m: string) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function monthLabel(m: string) {
  const [y, mo] = m.split('-');
  return `${mo}/${y}`;
}
function quarterInfo(m: string) {
  const [y, mo] = m.split('-').map(Number);
  return { y, q: Math.floor((mo - 1) / 3) + 1 };
}
function inQuarter(iso: string, y: number, q: number) {
  const d = new Date(iso);
  return d.getFullYear() === y && Math.floor(d.getMonth() / 3) + 1 === q;
}

const lineLabel = (l: string) => (LINE_LABEL as Record<string, string>)[l] || l;
const tuyenLabel = (t: string) => (t === 'HCM' ? 'HCM' : 'Hà Nội');

function agg(rows: Row[]) {
  return rows.reduce(
    (a, r) => ({
      soDon: a.soDon + 1,
      tongKg: a.tongKg + r.tongKg,
      tongM3: a.tongM3 + r.tongM3,
      tongGiaHang: a.tongGiaHang + r.tongGiaHang,
      phiMua: a.phiMua + r.phiMua,
      phiBH: a.phiBH + r.phiBH,
      phiPhatSinh: a.phiPhatSinh + r.phiPhatSinh,
      phiVC: a.phiVC + r.phiVC,
      shipND: a.shipND + r.shipND,
      dongGo: a.dongGo + r.dongGo,
      phuThu: a.phuThu + r.phuThu,
      vonNDT: a.vonNDT + r.vonNDT,
      loiNhuanNDT: a.loiNhuanNDT + r.loiNhuanNDT,
      tongTien: a.tongTien + r.tongTien,
      daTra: a.daTra + r.daTra,
      conLai: a.conLai + r.conLai
    }),
    { soDon: 0, tongKg: 0, tongM3: 0, tongGiaHang: 0, phiMua: 0, phiBH: 0, phiPhatSinh: 0, phiVC: 0, shipND: 0, dongGo: 0, phuThu: 0, vonNDT: 0, loiNhuanNDT: 0, tongTien: 0, daTra: 0, conLai: 0 }
  );
}

function groupBy<T>(rows: T[], key: (r: T) => string) {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    (m.get(k) || m.set(k, []).get(k)!).push(r);
  }
  return m;
}

function Delta({ now, prev }: { now: number; prev: number }) {
  if (!prev) return <span className="muted" style={{ fontSize: 11 }}>{now ? 'mới' : '—'}</span>;
  const pct = ((now - prev) / prev) * 100;
  const up = pct >= 0;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: up ? 'var(--success-dark)' : 'var(--danger-dark)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      {up ? <FiTrendingUp /> : <FiTrendingDown />}{Math.abs(pct).toFixed(0)}%
    </span>
  );
}

// ===== Xuất Excel (CSV BOM UTF-8) + In =====
function csvEsc(v: any) {
  const s = String(v ?? '');
  return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function downloadCSV(name: string, headers: string[], rows: (string | number)[][]) {
  const body = [headers, ...rows].map((r) => r.map(csvEsc).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name.replace(/[^\w-]+/g, '_') + '.csv';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
function printReport(title: string, headers: string[], rows: (string | number)[][]) {
  const th = headers.map((h) => `<th>${h}</th>`).join('');
  const tr = rows.map((r) => '<tr>' + r.map((c, i) => `<td${i === 0 ? '' : ' class="n"'}>${String(c ?? '')}</td>`).join('') + '</tr>').join('');
  const w = window.open('', '_blank', 'width=1000,height=720');
  if (!w) { alert('Trình duyệt chặn popup. Cho phép rồi thử lại.'); return; }
  w.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${title}</title>
    <style>body{font-family:Arial,sans-serif;padding:20px;color:#111;font-size:12px}
    h1{font-size:17px;margin:0 0 10px}table{width:100%;border-collapse:collapse}
    th,td{border:1px solid #999;padding:5px 7px;text-align:left}th{background:#f1f5f9}
    td.n{text-align:right}</style></head><body>
    <h1>${title}</h1><table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>
    <script>window.onload=function(){window.print()}</script></body></html>`);
  w.document.close();
}

function ReportTools({ name, headers, rows }: { name: string; headers: string[]; rows: (string | number)[][] }) {
  return (
    <div className="btn-row" style={{ justifyContent: 'flex-end', marginBottom: 10 }}>
      <button className="btn btn-secondary btn-sm" onClick={() => downloadCSV(name, headers, rows)} disabled={!rows.length}><FiDownload /> Xuất Excel</button>
      <button className="btn btn-secondary btn-sm" onClick={() => printReport(name, headers, rows)} disabled={!rows.length}><FiPrinter /> In</button>
    </div>
  );
}

export default function BaoCaoClient({ rows, knRows, cashRows, tonKhoRows, nvList, soQuyRows }: { rows: Row[]; knRows: KnRow[]; cashRows: CashRow[]; tonKhoRows: TonKhoRow[]; nvList: NvRow[]; soQuyRows: SoQuyRow[] }) {
  const [month, setMonth] = useState('');

  useEffect(() => {
    const d = new Date();
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }, []);

  const cur = useMemo(() => rows.filter((r) => monthKey(r.ngayTao) === month), [rows, month]);
  const prev = useMemo(() => rows.filter((r) => monthKey(r.ngayTao) === prevMonth(month)), [rows, month]);
  const quarter = useMemo(() => {
    const { y, q } = quarterInfo(month || '2000-01');
    return rows.filter((r) => inQuarter(r.ngayTao, y, q));
  }, [rows, month]);
  const curKN = useMemo(() => knRows.filter((k) => monthKey(k.ngayTao) === month), [knRows, month]);

  const aCur = agg(cur), aPrev = agg(prev), aQ = agg(quarter);
  const q = quarterInfo(month || '2000-01');
  const ml = monthLabel(month || '—');

  // ===== 1. KQKD =====
  const kqkdRows: { k: string; now: number; prev: number; money?: boolean }[] = [
    { k: 'Số đơn', now: aCur.soDon, prev: aPrev.soDon },
    { k: 'Tổng KG', now: Math.round(aCur.tongKg), prev: Math.round(aPrev.tongKg) },
    { k: 'Doanh thu (giá trị đơn)', now: aCur.tongTien, prev: aPrev.tongTien, money: true },
    { k: 'Đã thu thực tế', now: aCur.daTra, prev: aPrev.daTra, money: true },
    { k: 'Công nợ còn lại', now: aCur.conLai, prev: aPrev.conLai, money: true },
    { k: 'Tiền hàng', now: aCur.tongGiaHang, prev: aPrev.tongGiaHang, money: true },
    { k: 'Phí mua hàng', now: aCur.phiMua, prev: aPrev.phiMua, money: true },
    { k: 'Phí bảo hiểm (1%)', now: aCur.phiBH, prev: aPrev.phiBH, money: true },
    { k: 'Phí phát sinh khác', now: aCur.phiPhatSinh, prev: aPrev.phiPhatSinh, money: true },
    { k: 'Phí vận chuyển', now: aCur.phiVC, prev: aPrev.phiVC, money: true },
    { k: 'Phí ship VN + đóng gỗ + phụ thu', now: aCur.shipND + aCur.dongGo + aCur.phuThu, prev: aPrev.shipND + aPrev.dongGo + aPrev.phuThu, money: true }
  ];
  const tabKqkd = (
    <div className="form-section">
      <div className="section-title"><FiTrendingUp /> Kết quả kinh doanh — tháng {ml}</div>
      <ReportTools name={`KQKD_${ml}`} headers={['Chỉ tiêu', 'Tháng này', 'Tháng trước']} rows={kqkdRows.map((r) => [r.k, r.now, r.prev])} />
      <table className="data-table">
        <thead><tr><th>Chỉ tiêu</th><th className="number">Tháng này</th><th className="number">Tháng trước</th><th className="number">Thay đổi</th></tr></thead>
        <tbody>
          {kqkdRows.map((r) => (
            <tr key={r.k}>
              <td>{r.k}</td>
              <td className="number"><b>{r.money ? fmtVND(r.now) + 'đ' : fmtVND(r.now)}</b></td>
              <td className="number muted">{r.money ? fmtVND(r.prev) + 'đ' : fmtVND(r.prev)}</td>
              <td className="number"><Delta now={r.now} prev={r.prev} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="fee-summary" style={{ marginTop: 14 }}>
        <div className="fee-row"><span><b>Quý {q.q}/{q.y}</b> — số đơn</span><span className="fee-value">{aQ.soDon}</span></div>
        <div className="fee-row"><span>Doanh thu quý</span><span className="fee-value">{fmtVND(aQ.tongTien)}đ</span></div>
        <div className="fee-row"><span>Phí mua quý</span><span className="fee-value">{fmtVND(aQ.phiMua)}đ</span></div>
        <div className="fee-row"><span>Phí vận chuyển quý</span><span className="fee-value">{fmtVND(aQ.phiVC)}đ</span></div>
      </div>
    </div>
  );

  // ===== 2. Theo line =====
  const lineGroups = groupBy(cur, (r) => r.lineVC);
  const linePrev = groupBy(prev, (r) => r.lineVC);
  const lineData = [...lineGroups.entries()].sort((a, b) => agg(b[1]).tongTien - agg(a[1]).tongTien)
    .map(([line, rs]) => ({ line, a: agg(rs), p: agg(linePrev.get(line) || []) }));
  const tabLine = (
    <div className="form-section">
      <div className="section-title"><FiTruck /> Sản lượng theo line — tháng {ml}</div>
      <ReportTools name={`Theo_line_${ml}`} headers={['Line', 'Số đơn', 'Tổng KG', 'Tổng M3', 'Phí VC', 'Doanh thu']}
        rows={lineData.map((d) => [lineLabel(d.line), d.a.soDon, d.a.tongKg.toFixed(1), d.a.tongM3.toFixed(3), d.a.phiVC, d.a.tongTien])} />
      {cur.length === 0 ? <div className="empty-state"><FiInbox /><p>Không có đơn trong tháng.</p></div> : (
        <table className="data-table">
          <thead><tr><th>Line</th><th className="number">Số đơn</th><th className="number">Tổng KG</th><th className="number">Tổng M³</th><th className="number">Phí VC</th><th className="number">Doanh thu</th><th className="number">So tháng trước</th></tr></thead>
          <tbody>
            {lineData.map((d) => (
              <tr key={d.line}>
                <td>{lineLabel(d.line)}</td>
                <td className="number">{d.a.soDon}</td>
                <td className="number">{d.a.tongKg.toFixed(1)}</td>
                <td className="number">{d.a.tongM3.toFixed(3)}</td>
                <td className="number">{fmtVND(d.a.phiVC)}đ</td>
                <td className="number"><b>{fmtVND(d.a.tongTien)}đ</b></td>
                <td className="number"><Delta now={d.a.tongTien} prev={d.p.tongTien} /></td>
              </tr>
            ))}
            <tr style={{ fontWeight: 700, background: 'var(--surface-2)' }}>
              <td>Σ Tổng</td><td className="number">{aCur.soDon}</td><td className="number">{aCur.tongKg.toFixed(1)}</td>
              <td className="number">{aCur.tongM3.toFixed(3)}</td><td className="number">{fmtVND(aCur.phiVC)}đ</td>
              <td className="number">{fmtVND(aCur.tongTien)}đ</td><td></td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );

  // ===== 3. Theo tuyến =====
  const tuyenGroups = groupBy(cur, (r) => r.tuyen);
  const tuyenData = [...tuyenGroups.entries()].map(([t, rs]) => ({ t, a: agg(rs) })).sort((a, b) => b.a.tongTien - a.a.tongTien);
  const tabTuyen = (
    <div className="form-section">
      <div className="section-title"><FiMapPin /> Sản lượng theo tuyến (Hà Nội / HCM) — tháng {ml}</div>
      <ReportTools name={`Theo_tuyen_${ml}`} headers={['Tuyến', 'Số đơn', 'Tổng KG', 'Tổng M3', 'Phí VC', 'Doanh thu']}
        rows={tuyenData.map((d) => [tuyenLabel(d.t), d.a.soDon, d.a.tongKg.toFixed(1), d.a.tongM3.toFixed(3), d.a.phiVC, d.a.tongTien])} />
      {cur.length === 0 ? <div className="empty-state"><FiInbox /><p>Không có đơn trong tháng.</p></div> : (
        <table className="data-table">
          <thead><tr><th>Tuyến</th><th className="number">Số đơn</th><th className="number">Tổng KG</th><th className="number">Tổng M³</th><th className="number">Phí VC</th><th className="number">Doanh thu</th></tr></thead>
          <tbody>
            {tuyenData.map((d) => (
              <tr key={d.t}>
                <td><b>{tuyenLabel(d.t)}</b></td>
                <td className="number">{d.a.soDon}</td>
                <td className="number">{d.a.tongKg.toFixed(1)}</td>
                <td className="number">{d.a.tongM3.toFixed(3)}</td>
                <td className="number">{fmtVND(d.a.phiVC)}đ</td>
                <td className="number"><b>{fmtVND(d.a.tongTien)}đ</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  // ===== 4. Theo nhân viên =====
  const nvGroups = groupBy(cur, (r) => r.nv);
  const nvData = [...nvGroups.entries()].map(([nv, rs]) => ({ nv, a: agg(rs) })).sort((a, b) => b.a.phiMua - a.a.phiMua);
  const tabNv = (
    <div className="form-section">
      <div className="section-title"><FiUserCheck /> Doanh thu & phí mua theo nhân viên — tháng {ml}</div>
      <ReportTools name={`Theo_nhan_vien_${ml}`} headers={['Nhân viên', 'Số đơn', 'Doanh thu', 'Phí mua', '% phí mua']}
        rows={nvData.map((d) => [d.nv, d.a.soDon, d.a.tongTien, d.a.phiMua, (d.a.tongGiaHang ? (d.a.phiMua / d.a.tongGiaHang) * 100 : 0).toFixed(1) + '%'])} />
      {cur.length === 0 ? <div className="empty-state"><FiInbox /><p>Không có đơn trong tháng.</p></div> : (
        <table className="data-table">
          <thead><tr><th>Nhân viên tạo đơn</th><th className="number">Số đơn</th><th className="number">Doanh thu</th><th className="number">Phí mua hàng</th><th className="number">% phí mua</th></tr></thead>
          <tbody>
            {nvData.map((d) => (
              <tr key={d.nv}>
                <td>{d.nv}</td>
                <td className="number">{d.a.soDon}</td>
                <td className="number">{fmtVND(d.a.tongTien)}đ</td>
                <td className="number"><b>{fmtVND(d.a.phiMua)}đ</b></td>
                <td className="number">{(d.a.tongGiaHang ? (d.a.phiMua / d.a.tongGiaHang) * 100 : 0).toFixed(1)}%</td>
              </tr>
            ))}
            <tr style={{ fontWeight: 700, background: 'var(--surface-2)' }}>
              <td>Σ Tổng</td><td className="number">{aCur.soDon}</td><td className="number">{fmtVND(aCur.tongTien)}đ</td><td className="number">{fmtVND(aCur.phiMua)}đ</td><td></td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );

  // ===== 5. Theo khách hàng =====
  const khGroups = groupBy(cur, (r) => r.maKH);
  const khData = [...khGroups.entries()].map(([maKH, rs]) => ({ maKH, tenKH: rs[0].tenKH, a: agg(rs) })).sort((x, y) => y.a.tongTien - x.a.tongTien);
  const tabKh = (
    <div className="form-section">
      <div className="section-title"><FiUsers /> Sản lượng theo khách hàng — tháng {ml}</div>
      <ReportTools name={`Theo_khach_hang_${ml}`} headers={['Mã KH', 'Tên KH', 'Số đơn', 'Tổng KG', 'Tổng M3', 'Doanh thu']}
        rows={khData.map((d) => [d.maKH, d.tenKH, d.a.soDon, d.a.tongKg.toFixed(1), d.a.tongM3.toFixed(3), d.a.tongTien])} />
      {cur.length === 0 ? <div className="empty-state"><FiInbox /><p>Không có đơn trong tháng.</p></div> : (
        <table className="data-table">
          <thead><tr><th>Khách hàng</th><th className="number">Số đơn</th><th className="number">Tổng KG</th><th className="number">Tổng M³</th><th className="number">Doanh thu</th></tr></thead>
          <tbody>
            {khData.map((d) => (
              <tr key={d.maKH}>
                <td>{d.tenKH}<br /><span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{d.maKH}</span></td>
                <td className="number">{d.a.soDon}</td>
                <td className="number">{d.a.tongKg.toFixed(1)}</td>
                <td className="number">{d.a.tongM3.toFixed(3)}</td>
                <td className="number"><b>{fmtVND(d.a.tongTien)}đ</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  // ===== 6. Công nợ khách hàng (toàn kỳ, không lọc tháng) =====
  const congNoData = useMemo(() => {
    const g = groupBy(rows.filter((r) => r.conLai > 0.5), (r) => r.maKH);
    return [...g.entries()].map(([maKH, rs]) => ({ maKH, tenKH: rs[0].tenKH, soDonNo: rs.length, conLai: rs.reduce((s, r) => s + r.conLai, 0), tongTien: rs.reduce((s, r) => s + r.tongTien, 0) }))
      .sort((a, b) => b.conLai - a.conLai);
  }, [rows]);
  const tongCongNo = congNoData.reduce((s, r) => s + r.conLai, 0);
  const tabCongNo = (
    <div className="form-section">
      <div className="section-title"><FiDollarSign /> Công nợ khách hàng (toàn bộ đơn chưa thu đủ)</div>
      <ReportTools name="Cong_no_khach_hang" headers={['Mã KH', 'Tên KH', 'Số đơn nợ', 'Giá trị đơn', 'Còn nợ']}
        rows={congNoData.map((d) => [d.maKH, d.tenKH, d.soDonNo, d.tongTien, d.conLai])} />
      <div className="fee-summary" style={{ marginBottom: 14 }}>
        <div className="fee-row" style={{ fontWeight: 700 }}><span>TỔNG CÔNG NỢ KH</span><span className="fee-value" style={{ color: '#DC2626' }}>{fmtVND(tongCongNo)}đ</span></div>
      </div>
      {congNoData.length === 0 ? <div className="empty-state"><FiInbox /><p>Không có công nợ.</p></div> : (
        <table className="data-table">
          <thead><tr><th>Khách hàng</th><th className="number">Số đơn nợ</th><th className="number">Giá trị đơn</th><th className="number">Còn nợ</th></tr></thead>
          <tbody>
            {congNoData.map((d) => (
              <tr key={d.maKH}>
                <td>{d.tenKH}<br /><span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{d.maKH}</span></td>
                <td className="number">{d.soDonNo}</td>
                <td className="number">{fmtVND(d.tongTien)}đ</td>
                <td className="number" style={{ color: '#DC2626', fontWeight: 700 }}>{fmtVND(d.conLai)}đ</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  // ===== 7. Lợi nhuận (giá vốn GDV, đơn vị tệ NDT) =====
  const lnData = [...nvGroups.entries()].map(([nv, rs]) => ({ nv, a: agg(rs) })).filter((d) => d.a.vonNDT || d.a.loiNhuanNDT).sort((a, b) => b.a.loiNhuanNDT - a.a.loiNhuanNDT);
  // Lãi/lỗ TỪNG ĐƠN (PL02 #18): mỗi đơn có nhập giá vốn → thu¥ = vốn + ship nội địa TQ + lợi nhuận.
  const lnOrders = cur
    .filter((r) => r.vonNDT || r.loiNhuanNDT || r.shipNDTQ)
    .map((r) => ({ ...r, thuNDT: r.vonNDT + r.shipNDTQ + r.loiNhuanNDT }))
    .sort((a, b) => b.loiNhuanNDT - a.loiNhuanNDT);
  const lnOrdTong = lnOrders.reduce(
    (s, r) => ({ thu: s.thu + r.thuNDT, von: s.von + r.vonNDT, ship: s.ship + r.shipNDTQ, ln: s.ln + r.loiNhuanNDT }),
    { thu: 0, von: 0, ship: 0, ln: 0 }
  );
  const tabLoiNhuan = (
    <div className="form-section">
      <div className="section-title"><FiBarChart2 /> Lợi nhuận theo nhân viên (giá vốn GDV — tệ NDT) — tháng {ml}</div>
      <ReportTools name={`Loi_nhuan_${ml}`} headers={['Nhân viên', 'Số đơn', 'Vốn (NDT)', 'Lợi nhuận (NDT)', 'Doanh thu (đ)']}
        rows={lnData.map((d) => [d.nv, d.a.soDon, d.a.vonNDT.toFixed(1), d.a.loiNhuanNDT.toFixed(1), d.a.tongTien])} />
      <div className="alert alert-info" style={{ marginBottom: 12 }}><FiBarChart2 /><span>Lợi nhuận tính theo giá vốn GDV nhập (đơn vị <b>tệ NDT</b>): tệ khách trả − (vốn mua + ship nội địa TQ).</span></div>
      {lnData.length === 0 ? <div className="empty-state"><FiInbox /><p>Chưa có dữ liệu giá vốn trong tháng.</p></div> : (
        <table className="data-table">
          <thead><tr><th>Nhân viên</th><th className="number">Số đơn</th><th className="number">Vốn (¥)</th><th className="number">Lợi nhuận (¥)</th><th className="number">Doanh thu</th></tr></thead>
          <tbody>
            {lnData.map((d) => (
              <tr key={d.nv}>
                <td>{d.nv}</td>
                <td className="number">{d.a.soDon}</td>
                <td className="number">{d.a.vonNDT.toLocaleString()} ¥</td>
                <td className="number" style={{ color: d.a.loiNhuanNDT >= 0 ? 'var(--success-dark)' : 'var(--danger-dark)', fontWeight: 700 }}>{d.a.loiNhuanNDT.toLocaleString()} ¥</td>
                <td className="number">{fmtVND(d.a.tongTien)}đ</td>
              </tr>
            ))}
            <tr style={{ fontWeight: 700, background: 'var(--surface-2)' }}>
              <td>Σ Tổng</td><td className="number">{lnData.reduce((s, d) => s + d.a.soDon, 0)}</td>
              <td className="number">{lnData.reduce((s, d) => s + d.a.vonNDT, 0).toLocaleString()} ¥</td>
              <td className="number">{lnData.reduce((s, d) => s + d.a.loiNhuanNDT, 0).toLocaleString()} ¥</td><td></td>
            </tr>
          </tbody>
        </table>
      )}

      <div className="section-title" style={{ marginTop: 20 }}><FiBarChart2 /> Lãi/lỗ TỪNG ĐƠN (giá vốn GDV — tệ NDT) — tháng {ml}</div>
      <ReportTools name={`Lai_lo_tung_don_${ml}`} headers={['Mã đơn', 'Khách', 'NV', 'Thu (¥)', 'Vốn (¥)', 'Ship nội địa TQ (¥)', 'Lãi/lỗ (¥)']}
        rows={lnOrders.map((r) => [r.maDH, r.tenKH, r.nv, r.thuNDT.toFixed(1), r.vonNDT.toFixed(1), r.shipNDTQ.toFixed(1), r.loiNhuanNDT.toFixed(1)])} />
      {lnOrders.length === 0 ? <div className="empty-state"><FiInbox /><p>Chưa có đơn nào nhập giá vốn trong tháng.</p></div> : (
        <table className="data-table">
          <thead><tr><th>Mã đơn</th><th>Khách</th><th className="number">Thu (¥)</th><th className="number">Vốn (¥)</th><th className="number">Ship TQ (¥)</th><th className="number">Lãi/lỗ (¥)</th></tr></thead>
          <tbody>
            {lnOrders.map((r) => (
              <tr key={r.maDH}>
                <td className="ma-don" style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => (window as any).openOrderDetail?.(r.maDH)}>{r.maDH}</td>
                <td>{r.tenKH}</td>
                <td className="number">{r.thuNDT.toLocaleString()} ¥</td>
                <td className="number">{r.vonNDT.toLocaleString()} ¥</td>
                <td className="number">{r.shipNDTQ.toLocaleString()} ¥</td>
                <td className="number" style={{ color: r.loiNhuanNDT >= 0 ? 'var(--success-dark)' : 'var(--danger-dark)', fontWeight: 700 }}>{r.loiNhuanNDT.toLocaleString()} ¥</td>
              </tr>
            ))}
            <tr style={{ fontWeight: 700, background: 'var(--surface-2)' }}>
              <td colSpan={2}>Σ Tổng ({lnOrders.length} đơn)</td>
              <td className="number">{lnOrdTong.thu.toLocaleString()} ¥</td>
              <td className="number">{lnOrdTong.von.toLocaleString()} ¥</td>
              <td className="number">{lnOrdTong.ship.toLocaleString()} ¥</td>
              <td className="number" style={{ color: lnOrdTong.ln >= 0 ? 'var(--success-dark)' : 'var(--danger-dark)' }}>{lnOrdTong.ln.toLocaleString()} ¥</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );

  // ===== 8. Khiếu nại =====
  const knByLoai = [...groupBy(curKN, (k) => k.loai).entries()].map(([loai, ks]) => ({
    loai, n: ks.length, hoan: ks.reduce((s, k) => s + k.soTienHoan, 0), phi: ks.reduce((s, k) => s + k.phiDoiTra, 0)
  })).sort((a, b) => b.n - a.n);
  const tongHoan = curKN.reduce((s, k) => s + k.soTienHoan, 0);
  const tongPhiDT = curKN.reduce((s, k) => s + k.phiDoiTra, 0);
  // #47/#49 — phí đổi trả khách phải chịu, đã cộng vào tổng tiền đơn nhưng ghi tách khỏi
  // chi phí đơn hàng thường (tính trên các đơn của tháng đang xem).
  const tongPhiKN = cur.reduce((s, r) => s + r.phiKhieuNai, 0);
  const tabKN = (
    <div className="form-section">
      <div className="section-title"><FiAlertTriangle /> Khiếu nại / đổi trả — tháng {ml}</div>
      <ReportTools name={`Khieu_nai_${ml}`} headers={['Loại khiếu nại', 'Số vụ', 'Tiền hoàn', 'Phí đổi trả']}
        rows={knByLoai.map((d) => [LOAI_KN_LABEL[d.loai] || d.loai, d.n, d.hoan, d.phi])} />
      <div className="fee-summary" style={{ marginBottom: 14 }}>
        <div className="fee-row"><span>Tổng số khiếu nại</span><span className="fee-value">{curKN.length}</span></div>
        <div className="fee-row"><span>Tổng tiền hoàn KH</span><span className="fee-value" style={{ color: '#DC2626' }}>{fmtVND(tongHoan)}đ</span></div>
        <div className="fee-row"><span>Tổng phí đổi/trả (theo khiếu nại)</span><span className="fee-value">{fmtVND(tongPhiDT)}đ</span></div>
        <div className="fee-row"><span>Phí khiếu nại tính vào đơn — khách chịu (phiKhieuNai)</span><span className="fee-value">{fmtVND(tongPhiKN)}đ</span></div>
      </div>
      <div className="alert alert-info" style={{ marginBottom: 12 }}><FiAlertTriangle /><span>Chi phí khiếu nại được ghi <b>tách khỏi chi phí đơn hàng thường</b>: khoản <b>phí khiếu nại (phiKhieuNai) = {fmtVND(tongPhiKN)}đ</b> là phần khách phải chịu, đã cộng vào tổng tiền các đơn phát sinh đổi/trả trong tháng nhưng theo dõi riêng để đối chiếu.</span></div>
      {knByLoai.length === 0 ? <div className="empty-state"><FiInbox /><p>Không có khiếu nại trong tháng.</p></div> : (
        <table className="data-table">
          <thead><tr><th>Loại khiếu nại</th><th className="number">Số vụ</th><th className="number">Tiền hoàn</th><th className="number">Phí đổi/trả</th></tr></thead>
          <tbody>
            {knByLoai.map((d) => (
              <tr key={d.loai}>
                <td><b>{LOAI_KN_LABEL[d.loai] || d.loai}</b></td>
                <td className="number">{d.n}</td>
                <td className="number">{fmtVND(d.hoan)}đ</td>
                <td className="number">{fmtVND(d.phi)}đ</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  // ===== 9. Tồn kho TQ & VN (ảnh chụp hiện tại, không lọc tháng) =====
  const TON_BUCKETS = [
    { label: 'Kho TQ (đã nhận)', statuses: ['KhoTqNhan'] },
    { label: 'Đang vận chuyển TQ→VN', statuses: ['DangVanChuyen'] },
    { label: 'Kho VN (chờ giao / thanh toán)', statuses: ['KhoVnNhan', 'ChoThanhToan', 'GiaoHang'] }
  ];
  const TT_LABEL: Record<string, string> = {
    KhoTqNhan: 'Kho TQ', DangVanChuyen: 'Đang VC', KhoVnNhan: 'Kho VN', ChoThanhToan: 'Chờ TT', GiaoHang: 'Sẵn giao'
  };
  const tonByBucket = TON_BUCKETS.map((b) => {
    const rs = tonKhoRows.filter((r) => b.statuses.includes(r.trangThai));
    return { label: b.label, soDon: rs.length, kg: rs.reduce((s, r) => s + r.tongKg, 0), m3: rs.reduce((s, r) => s + r.tongM3, 0) };
  });
  const tonTongKg = tonKhoRows.reduce((s, r) => s + r.tongKg, 0);
  const tonTongM3 = tonKhoRows.reduce((s, r) => s + r.tongM3, 0);
  const tabTonKho = (
    <div className="form-section">
      <div className="section-title"><FiPackage /> Tồn kho TQ &amp; VN (hiện tại)</div>
      <ReportTools name="Ton_kho_TQ_VN" headers={['Khu vực', 'Số đơn', 'Tổng KG', 'Tổng M3']}
        rows={[...tonByBucket.map((b) => [b.label, b.soDon, b.kg.toFixed(1), b.m3.toFixed(3)]), ['Σ Tổng tồn', tonKhoRows.length, tonTongKg.toFixed(1), tonTongM3.toFixed(3)]]} />
      <table className="data-table" style={{ marginBottom: 16 }}>
        <thead><tr><th>Khu vực</th><th className="number">Số đơn</th><th className="number">Tổng KG</th><th className="number">Tổng M³</th></tr></thead>
        <tbody>
          {tonByBucket.map((b) => (
            <tr key={b.label}><td><b>{b.label}</b></td><td className="number">{b.soDon}</td><td className="number">{b.kg.toFixed(1)}</td><td className="number">{b.m3.toFixed(3)}</td></tr>
          ))}
          <tr style={{ fontWeight: 700, background: 'var(--surface-2)' }}>
            <td>Σ Tổng tồn</td><td className="number">{tonKhoRows.length}</td><td className="number">{tonTongKg.toFixed(1)}</td><td className="number">{tonTongM3.toFixed(3)}</td>
          </tr>
        </tbody>
      </table>
      {tonKhoRows.length === 0 ? <div className="empty-state"><FiInbox /><p>Kho trống.</p></div> : (
        <table className="data-table">
          <thead><tr><th>Mã đơn</th><th>Khách</th><th>Khu vực</th><th className="number">KG</th><th className="number">M³</th></tr></thead>
          <tbody>
            {tonKhoRows.map((r) => (
              <tr key={r.maDH}>
                <td className="ma-don" style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => (window as any).openOrderDetail?.(r.maDH)}>{r.maDH}</td>
                <td>{r.tenKH}<br /><span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{r.maKH}</span></td>
                <td>{TT_LABEL[r.trangThai] || r.trangThai}</td>
                <td className="number">{r.tongKg.toFixed(1)}</td>
                <td className="number">{r.tongM3.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  // ===== 10. Dòng tiền thu – chi (theo tháng chọn) =====
  const cashCur = cashRows.filter((c) => monthKey(c.ngay) === month);
  const tongThu = cashCur.filter((c) => c.loai === 'Thu').reduce((s, c) => s + c.soTien, 0);
  const tongChi = cashCur.filter((c) => c.loai === 'Chi').reduce((s, c) => s + c.soTien, 0);

  // #22/#42 — sổ quỹ: bút toán thu-chi KHÔNG gắn đơn hàng, tách theo quỹ (ảnh chụp toàn
  // bộ bút toán quỹ gần đây, không lọc theo tháng — tồn = tổng thu − tổng chi).
  const quyData = (['CongTy', 'KhoVN', 'KhoTQ'] as const).map((q) => {
    const rs = soQuyRows.filter((s) => s.quy === q);
    const thu = rs.filter((s) => s.loai === 'Thu').reduce((a, s) => a + s.soTien, 0);
    const chi = rs.filter((s) => s.loai === 'Chi').reduce((a, s) => a + s.soTien, 0);
    return { q, soBt: rs.length, thu, chi, ton: thu - chi };
  });
  const quyTong = quyData.reduce((a, d) => ({ soBt: a.soBt + d.soBt, thu: a.thu + d.thu, chi: a.chi + d.chi, ton: a.ton + d.ton }), { soBt: 0, thu: 0, chi: 0, ton: 0 });
  const tabDongTien = (
    <div className="form-section">
      <div className="section-title"><FiRepeat /> Dòng tiền thu – chi (sổ thu–chi) — tháng {ml}</div>
      <div className="alert alert-info" style={{ marginBottom: 12 }}><FiRepeat /><span>Báo cáo phản ánh <b>bút toán Thu/Chi đã ghi trong sổ thu–chi</b> (chủ yếu là tiền khách nạp cọc/thanh toán, và khoản Chi khi hoàn tiền huỷ đơn). Khoản <b>chi trả nhà cung cấp</b> được theo dõi riêng ở báo cáo <b>Công nợ NCC</b>; biến động <b>ví khách</b> ở sổ ví — không gộp vào đây để tránh trùng.</span></div>
      <ReportTools name={`Dong_tien_${ml}`} headers={['Ngày', 'Mã đơn', 'Loại', 'Số tiền', 'Ghi chú']}
        rows={cashCur.map((c) => [new Date(c.ngay).toLocaleDateString('vi-VN'), c.maDH, c.loai === 'Thu' ? 'Thu' : 'Chi', c.soTien, c.ghiChu])} />
      <div className="fee-summary" style={{ marginBottom: 14 }}>
        <div className="fee-row"><span>Tổng THU</span><span className="fee-value" style={{ color: 'var(--success-dark)' }}>{fmtVND(tongThu)}đ</span></div>
        <div className="fee-row"><span>Tổng CHI</span><span className="fee-value" style={{ color: '#DC2626' }}>{fmtVND(tongChi)}đ</span></div>
        <div className="fee-row" style={{ fontWeight: 700 }}><span>RÒNG (Thu − Chi)</span><span className="fee-value">{fmtVND(tongThu - tongChi)}đ</span></div>
      </div>
      {cashCur.length === 0 ? <div className="empty-state"><FiInbox /><p>Không có giao dịch trong tháng.</p></div> : (
        <table className="data-table">
          <thead><tr><th>Ngày</th><th>Mã đơn</th><th>Loại</th><th className="number">Số tiền</th><th>Ghi chú</th></tr></thead>
          <tbody>
            {cashCur.map((c, i) => (
              <tr key={i}>
                <td>{new Date(c.ngay).toLocaleDateString('vi-VN')}</td>
                <td className="ma-don">{c.maDH ? <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => (window as any).openOrderDetail?.(c.maDH)}>{c.maDH}</span> : ''}</td>
                <td><span style={{ color: c.loai === 'Thu' ? 'var(--success-dark)' : '#DC2626', fontWeight: 700 }}>{c.loai === 'Thu' ? 'Thu' : 'Chi'}</span></td>
                <td className="number">{fmtVND(c.soTien)}đ</td>
                <td style={{ fontSize: 12 }}>{c.ghiChu}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="section-title" style={{ marginTop: 22 }}><FiBookOpen /> Thu chi ngoài đơn hàng (sổ quỹ)</div>
      <div className="alert alert-info" style={{ marginBottom: 12 }}><FiBookOpen /><span>Đây là các <b>bút toán quỹ KHÔNG gắn đơn hàng</b> (thu chi nội bộ công ty, thu hộ / chi ship của kho), <b>tách khỏi dòng tiền của đơn</b> ở trên. Ảnh chụp toàn bộ bút toán quỹ gần đây (tối đa 500), không lọc theo tháng; tồn = tổng thu − tổng chi.</span></div>
      <ReportTools name="So_quy_theo_quy" headers={['Quỹ', 'Số bút toán', 'Tổng thu', 'Tổng chi', 'Tồn']}
        rows={quyData.map((d) => [QUY_LABEL[d.q] || d.q, d.soBt, d.thu, d.chi, d.ton])} />
      {quyTong.soBt === 0 ? <div className="empty-state"><FiInbox /><p>Chưa có bút toán sổ quỹ.</p></div> : (
        <table className="data-table">
          <thead><tr><th>Quỹ</th><th className="number">Số bút toán</th><th className="number">Tổng thu</th><th className="number">Tổng chi</th><th className="number">Tồn</th></tr></thead>
          <tbody>
            {quyData.map((d) => (
              <tr key={d.q}>
                <td><b>{QUY_LABEL[d.q] || d.q}</b></td>
                <td className="number">{d.soBt}</td>
                <td className="number" style={{ color: 'var(--success-dark)' }}>{fmtVND(d.thu)}đ</td>
                <td className="number" style={{ color: '#DC2626' }}>{fmtVND(d.chi)}đ</td>
                <td className="number" style={{ fontWeight: 700 }}>{fmtVND(d.ton)}đ</td>
              </tr>
            ))}
            <tr style={{ fontWeight: 700, background: 'var(--surface-2)' }}>
              <td>Σ Tổng 3 quỹ</td><td className="number">{quyTong.soBt}</td>
              <td className="number">{fmtVND(quyTong.thu)}đ</td><td className="number">{fmtVND(quyTong.chi)}đ</td><td className="number">{fmtVND(quyTong.ton)}đ</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );

  // ===== 11. Hoa hồng & thưởng (#52/#53) — theo tháng chọn =====
  // Hoa hồng GDV = doanh số (Σ tongTien) các đơn được giao phụ trách (gdvId) × pctHoaHong%.
  // Thưởng CSKH = Σ các loại phí (phiMua+phiVC+phiBH+phiPhatSinh+phuThu+dongGo+shipND) của
  // các đơn do người đó tạo (nvId) × pctThuong%.
  const hhData = nvList.filter((n) => n.vaiTro === 'GDV' || n.vaiTro === 'MuaHang').map((n) => {
    const os = cur.filter((r) => r.gdvId === n.id);
    const doanhSo = os.reduce((s, r) => s + r.tongTien, 0);
    const loiNhuan = os.reduce((s, r) => s + r.loiNhuanNDT, 0);
    return { ...n, soDon: os.length, doanhSo, loiNhuan, hoaHong: doanhSo * n.pctHoaHong / 100 };
  }).sort((a, b) => b.hoaHong - a.hoaHong);
  const hhTong = hhData.reduce((s, d) => ({ soDon: s.soDon + d.soDon, doanhSo: s.doanhSo + d.doanhSo, hoaHong: s.hoaHong + d.hoaHong, loiNhuan: s.loiNhuan + d.loiNhuan }), { soDon: 0, doanhSo: 0, hoaHong: 0, loiNhuan: 0 });

  const thData = nvList.filter((n) => n.vaiTro === 'CSKH').map((n) => {
    const os = cur.filter((r) => r.nvId === n.id);
    const doanhSo = os.reduce((s, r) => s + r.tongTien, 0);
    const tongPhi = os.reduce((s, r) => s + r.phiMua + r.phiVC + r.phiBH + r.phiPhatSinh + r.phuThu + r.dongGo + r.shipND, 0);
    return { ...n, soDon: os.length, doanhSo, tongPhi, thuong: tongPhi * n.pctThuong / 100 };
  }).sort((a, b) => b.thuong - a.thuong);
  const thTong = thData.reduce((s, d) => ({ soDon: s.soDon + d.soDon, doanhSo: s.doanhSo + d.doanhSo, tongPhi: s.tongPhi + d.tongPhi, thuong: s.thuong + d.thuong }), { soDon: 0, doanhSo: 0, tongPhi: 0, thuong: 0 });

  const chuaDatTiLe = (
    <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>chưa đặt tỉ lệ — cấu hình ở Quản trị › Nhân viên</div>
  );
  const tabHoaHong = (
    <div className="form-section">
      <div className="section-title"><FiAward /> Hoa hồng GDV — tháng {ml}</div>
      <ReportTools name={`Hoa_hong_GDV_${ml}`} headers={['Nhân viên', 'Vai trò', 'Số đơn phụ trách', 'Doanh số', '% hoa hồng', 'Hoa hồng', 'Lợi nhuận (¥)']}
        rows={hhData.map((d) => [d.hoTen, VAITRO_LABEL[d.vaiTro] || d.vaiTro, d.soDon, d.doanhSo, d.pctHoaHong + '%', Math.round(d.hoaHong), d.loiNhuan.toFixed(1)])} />
      {hhData.length === 0 ? <div className="empty-state"><FiInbox /><p>Chưa có nhân viên GDV / Mua hàng.</p></div> : (
        <table className="data-table">
          <thead><tr><th>Nhân viên</th><th className="number">Số đơn phụ trách</th><th className="number">Doanh số</th><th className="number">% hoa hồng</th><th className="number">Hoa hồng</th><th className="number">Lợi nhuận (¥)</th></tr></thead>
          <tbody>
            {hhData.map((d) => (
              <tr key={d.id}>
                <td>{d.hoTen}<br /><span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{VAITRO_LABEL[d.vaiTro] || d.vaiTro}</span></td>
                <td className="number">{d.soDon}</td>
                <td className="number">{fmtVND(d.doanhSo)}đ</td>
                <td className="number">{d.pctHoaHong}%{d.pctHoaHong === 0 && chuaDatTiLe}</td>
                <td className="number" style={{ fontWeight: 700, color: 'var(--success-dark)' }}>{fmtVND(Math.round(d.hoaHong))}đ</td>
                <td className="number" style={{ color: d.loiNhuan >= 0 ? 'var(--success-dark)' : 'var(--danger-dark)' }}>{d.loiNhuan.toLocaleString()} ¥</td>
              </tr>
            ))}
            <tr style={{ fontWeight: 700, background: 'var(--surface-2)' }}>
              <td>Σ Tổng</td><td className="number">{hhTong.soDon}</td><td className="number">{fmtVND(hhTong.doanhSo)}đ</td><td></td>
              <td className="number">{fmtVND(Math.round(hhTong.hoaHong))}đ</td><td className="number">{hhTong.loiNhuan.toLocaleString()} ¥</td>
            </tr>
          </tbody>
        </table>
      )}

      <div className="section-title" style={{ marginTop: 22 }}><FiAward /> Thưởng CSKH — tháng {ml}</div>
      <ReportTools name={`Thuong_CSKH_${ml}`} headers={['Nhân viên', 'Số đơn tạo', 'Doanh số', 'Tổng phí dịch vụ', '% thưởng', 'Thưởng']}
        rows={thData.map((d) => [d.hoTen, d.soDon, d.doanhSo, d.tongPhi, d.pctThuong + '%', Math.round(d.thuong)])} />
      {thData.length === 0 ? <div className="empty-state"><FiInbox /><p>Chưa có nhân viên CSKH.</p></div> : (
        <table className="data-table">
          <thead><tr><th>Nhân viên</th><th className="number">Số đơn tạo</th><th className="number">Doanh số</th><th className="number">Tổng phí dịch vụ</th><th className="number">% thưởng</th><th className="number">Thưởng</th></tr></thead>
          <tbody>
            {thData.map((d) => (
              <tr key={d.id}>
                <td>{d.hoTen}</td>
                <td className="number">{d.soDon}</td>
                <td className="number">{fmtVND(d.doanhSo)}đ</td>
                <td className="number">{fmtVND(d.tongPhi)}đ</td>
                <td className="number">{d.pctThuong}%{d.pctThuong === 0 && chuaDatTiLe}</td>
                <td className="number" style={{ fontWeight: 700, color: 'var(--success-dark)' }}>{fmtVND(Math.round(d.thuong))}đ</td>
              </tr>
            ))}
            <tr style={{ fontWeight: 700, background: 'var(--surface-2)' }}>
              <td>Σ Tổng</td><td className="number">{thTong.soDon}</td><td className="number">{fmtVND(thTong.doanhSo)}đ</td>
              <td className="number">{fmtVND(thTong.tongPhi)}đ</td><td></td><td className="number">{fmtVND(Math.round(thTong.thuong))}đ</td>
            </tr>
          </tbody>
        </table>
      )}

      <div className="alert alert-info" style={{ marginTop: 12 }}><FiAward /><span><b>Hoa hồng</b> tính trên doanh số (Σ giá trị đơn) các đơn được <b>giao phụ trách</b> (gdvId) × % hoa hồng. <b>Thưởng CSKH</b> tính trên tổng các loại phí (phí mua + vận chuyển + bảo hiểm + phát sinh + phụ thu + đóng gỗ + ship nội địa) của đơn <b>do người đó tạo</b> × % thưởng. Tỉ lệ % đặt ở Quản trị › Nhân viên.</span></div>
    </div>
  );

  return (
    <>
      <div className="form-field" style={{ maxWidth: 220, marginBottom: 14 }}>
        <label className="icon-inline" style={{ fontWeight: 700 }}><FiCalendar /> Chọn tháng báo cáo</label>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </div>

      <Tabs tabs={[
        { id: 'kqkd', label: <><FiTrendingUp /> KQKD</>, content: tabKqkd },
        { id: 'line', label: <><FiTruck /> Theo line</>, content: tabLine },
        { id: 'tuyen', label: <><FiMapPin /> Theo tuyến</>, content: tabTuyen },
        { id: 'nv', label: <><FiUserCheck /> Theo NV</>, content: tabNv },
        { id: 'kh', label: <><FiUsers /> Theo KH</>, content: tabKh },
        { id: 'congno', label: <><FiDollarSign /> Công nợ KH</>, content: tabCongNo },
        { id: 'loinhuan', label: <><FiBarChart2 /> Lợi nhuận</>, content: tabLoiNhuan },
        { id: 'tonkho', label: <><FiPackage /> Tồn kho</>, content: tabTonKho },
        { id: 'dongtien', label: <><FiRepeat /> Dòng tiền</>, content: tabDongTien },
        { id: 'hoahong', label: <><FiAward /> Hoa hồng &amp; thưởng</>, content: tabHoaHong },
        { id: 'kn', label: <><FiAlertTriangle /> Khiếu nại</>, content: tabKN }
      ]} />
    </>
  );
}
