'use client';

import { useEffect, useMemo, useState } from 'react';
import { FiCalendar, FiTruck, FiUsers, FiUserCheck, FiTrendingUp, FiTrendingDown, FiInbox } from 'react-icons/fi';
import Tabs from '@/components/Tabs';
import { fmtVND } from '@/lib/format';
import { LINE_LABEL } from '@/lib/status';

type Row = {
  maDH: string; ngayTao: string; maKH: string; tenKH: string; nv: string;
  lineVC: string; tuyen: string;
  tongKg: number; tongM3: number; tongGiaHang: number;
  phiMua: number; phiBH: number; phiVC: number;
  shipND: number; dongGo: number; phuThu: number;
  tongTien: number; daTra: number;
};

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
      phiVC: a.phiVC + r.phiVC,
      shipND: a.shipND + r.shipND,
      dongGo: a.dongGo + r.dongGo,
      phuThu: a.phuThu + r.phuThu,
      tongTien: a.tongTien + r.tongTien,
      daTra: a.daTra + r.daTra
    }),
    { soDon: 0, tongKg: 0, tongM3: 0, tongGiaHang: 0, phiMua: 0, phiBH: 0, phiVC: 0, shipND: 0, dongGo: 0, phuThu: 0, tongTien: 0, daTra: 0 }
  );
}

function groupBy(rows: Row[], key: (r: Row) => string) {
  const m = new Map<string, Row[]>();
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

export default function BaoCaoClient({ rows }: { rows: Row[] }) {
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

  const aCur = agg(cur), aPrev = agg(prev), aQ = agg(quarter);
  const q = quarterInfo(month || '2000-01');

  // ===== Tab KQKD =====
  const kqkdRows: { k: string; now: number; prev: number; money?: boolean }[] = [
    { k: 'Số đơn', now: aCur.soDon, prev: aPrev.soDon },
    { k: 'Tổng KG', now: Math.round(aCur.tongKg), prev: Math.round(aPrev.tongKg) },
    { k: 'Doanh thu (giá trị đơn)', now: aCur.tongTien, prev: aPrev.tongTien, money: true },
    { k: 'Đã thu thực tế', now: aCur.daTra, prev: aPrev.daTra, money: true },
    { k: 'Tiền hàng', now: aCur.tongGiaHang, prev: aPrev.tongGiaHang, money: true },
    { k: 'Phí mua hàng', now: aCur.phiMua, prev: aPrev.phiMua, money: true },
    { k: 'Phí bảo hiểm', now: aCur.phiBH, prev: aPrev.phiBH, money: true },
    { k: 'Phí vận chuyển', now: aCur.phiVC, prev: aPrev.phiVC, money: true },
    { k: 'Phí ship VN + đóng gỗ + phụ thu', now: aCur.shipND + aCur.dongGo + aCur.phuThu, prev: aPrev.shipND + aPrev.dongGo + aPrev.phuThu, money: true }
  ];

  const tabKqkd = (
    <div className="form-section">
      <div className="section-title"><FiTrendingUp /> Kết quả kinh doanh — tháng {monthLabel(month || '—')}</div>
      <table className="data-table">
        <thead><tr>
          <th>Chỉ tiêu</th><th className="number">Tháng này</th><th className="number">Tháng trước</th><th className="number">Thay đổi</th>
        </tr></thead>
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

  // ===== Tab theo Line =====
  const lineGroups = groupBy(cur, (r) => r.lineVC);
  const linePrev = groupBy(prev, (r) => r.lineVC);
  const tabLine = (
    <div className="form-section">
      <div className="section-title"><FiTruck /> Sản lượng theo line — tháng {monthLabel(month || '—')}</div>
      {cur.length === 0 ? <div className="empty-state"><FiInbox /><p>Không có đơn trong tháng.</p></div> : (
        <table className="data-table">
          <thead><tr>
            <th>Line vận chuyển</th><th className="number">Số đơn</th><th className="number">Tổng KG</th>
            <th className="number">Tổng M³</th><th className="number">Phí VC</th><th className="number">Doanh thu</th><th className="number">So tháng trước</th>
          </tr></thead>
          <tbody>
            {[...lineGroups.entries()].sort((a, b) => agg(b[1]).tongTien - agg(a[1]).tongTien).map(([line, rs]) => {
              const a = agg(rs); const p = agg(linePrev.get(line) || []);
              return (
                <tr key={line}>
                  <td>{lineLabel(line)}</td>
                  <td className="number">{a.soDon}</td>
                  <td className="number">{a.tongKg.toFixed(1)}</td>
                  <td className="number">{a.tongM3.toFixed(3)}</td>
                  <td className="number">{fmtVND(a.phiVC)}đ</td>
                  <td className="number"><b>{fmtVND(a.tongTien)}đ</b></td>
                  <td className="number"><Delta now={a.tongTien} prev={p.tongTien} /></td>
                </tr>
              );
            })}
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

  // ===== Tab theo NV (CSKH) =====
  const nvGroups = groupBy(cur, (r) => r.nv);
  const tabNv = (
    <div className="form-section">
      <div className="section-title"><FiUserCheck /> Doanh thu & phí mua theo nhân viên — tháng {monthLabel(month || '—')}</div>
      {cur.length === 0 ? <div className="empty-state"><FiInbox /><p>Không có đơn trong tháng.</p></div> : (
        <table className="data-table">
          <thead><tr>
            <th>Nhân viên tạo đơn</th><th className="number">Số đơn</th><th className="number">Doanh thu</th>
            <th className="number">Phí mua hàng</th><th className="number">% phí mua</th>
          </tr></thead>
          <tbody>
            {[...nvGroups.entries()].sort((a, b) => agg(b[1]).phiMua - agg(a[1]).phiMua).map(([nv, rs]) => {
              const a = agg(rs);
              const pct = a.tongGiaHang ? (a.phiMua / a.tongGiaHang) * 100 : 0;
              return (
                <tr key={nv}>
                  <td>{nv}</td>
                  <td className="number">{a.soDon}</td>
                  <td className="number">{fmtVND(a.tongTien)}đ</td>
                  <td className="number"><b>{fmtVND(a.phiMua)}đ</b></td>
                  <td className="number">{pct.toFixed(1)}%</td>
                </tr>
              );
            })}
            <tr style={{ fontWeight: 700, background: 'var(--surface-2)' }}>
              <td>Σ Tổng</td><td className="number">{aCur.soDon}</td><td className="number">{fmtVND(aCur.tongTien)}đ</td>
              <td className="number">{fmtVND(aCur.phiMua)}đ</td><td></td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );

  // ===== Tab theo Khách hàng =====
  const khGroups = groupBy(cur, (r) => r.maKH);
  const tabKh = (
    <div className="form-section">
      <div className="section-title"><FiUsers /> Sản lượng theo khách hàng — tháng {monthLabel(month || '—')}</div>
      {cur.length === 0 ? <div className="empty-state"><FiInbox /><p>Không có đơn trong tháng.</p></div> : (
        <table className="data-table">
          <thead><tr>
            <th>Khách hàng</th><th className="number">Số đơn</th><th className="number">Tổng KG</th>
            <th className="number">Tổng M³</th><th className="number">Doanh thu</th>
          </tr></thead>
          <tbody>
            {[...khGroups.entries()].map(([maKH, rs]) => ({ maKH, rs, a: agg(rs) }))
              .sort((x, y) => y.a.tongTien - x.a.tongTien)
              .map(({ maKH, rs, a }) => (
                <tr key={maKH}>
                  <td>{rs[0].tenKH}<br /><span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{maKH}</span></td>
                  <td className="number">{a.soDon}</td>
                  <td className="number">{a.tongKg.toFixed(1)}</td>
                  <td className="number">{a.tongM3.toFixed(3)}</td>
                  <td className="number"><b>{fmtVND(a.tongTien)}đ</b></td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <>
      <div className="form-field" style={{ maxWidth: 220, marginBottom: 14 }}>
        <label className="icon-inline" style={{ fontWeight: 700 }}><FiCalendar /> Chọn tháng báo cáo</label>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </div>

      <Tabs tabs={[
        { id: 'kqkd', label: <><FiTrendingUp /> KQKD tháng/quý</>, content: tabKqkd },
        { id: 'line', label: <><FiTruck /> Theo line</>, content: tabLine },
        { id: 'nv', label: <><FiUserCheck /> Theo nhân viên</>, content: tabNv },
        { id: 'kh', label: <><FiUsers /> Theo khách hàng</>, content: tabKh }
      ]} />
    </>
  );
}
