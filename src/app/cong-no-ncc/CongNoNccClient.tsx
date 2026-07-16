'use client';

import { useMemo, useState } from 'react';
import {
  FiTruck, FiPlus, FiSave, FiTrash2, FiInfo, FiInbox, FiArrowUpCircle, FiArrowDownCircle, FiSearch,
  FiDownload, FiPrinter, FiX
} from 'react-icons/fi';
import Tabs from '@/components/Tabs';
import { callServer, reload } from '@/lib/client';
import { showToast } from '@/components/Toast';
import { fmtVND, formatDate } from '@/lib/format';
import { exportToCSV } from '@/lib/export';

type Entry = {
  id: number; ngay: string; doiTac: string; web: string; maDH: string;
  loai: string; soTien: number; soTienNDT: number; tyGia: number; ghiChu: string; nguoiTao: string;
};

const blank = { doiTac: '', web: '', maDH: '', loai: 'PhatSinh', soTienNDT: 0, tyGia: 3650, soTien: 0, ghiChu: '' };

export default function CongNoNccClient({ ledger, partners, webs }:
  { ledger: Entry[]; partners: string[]; webs: string[] }) {

  const [form, setForm] = useState({ ...blank });
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  // Đối tác đang xem chi tiết (bấm tên shop/NCC để mở). Tái dùng dữ liệu + phép
  // tính công nợ đã có ngay trong client — không cần backend, không nối fuzzy.
  const [nccView, setNccView] = useState<string | null>(null);

  // Tổng hợp công nợ theo đối tác: phát sinh − đã trả = còn nợ.
  const summary = useMemo(() => {
    const m = new Map<string, { phatSinh: number; thanhToan: number; n: number }>();
    for (const e of ledger) {
      const s = m.get(e.doiTac) || { phatSinh: 0, thanhToan: 0, n: 0 };
      if (e.loai === 'ThanhToan') s.thanhToan += e.soTien; else s.phatSinh += e.soTien;
      s.n++;
      m.set(e.doiTac, s);
    }
    return [...m.entries()]
      .map(([doiTac, s]) => ({ doiTac, ...s, conNo: s.phatSinh - s.thanhToan }))
      .sort((a, b) => b.conNo - a.conNo);
  }, [ledger]);

  const tongConNo = summary.reduce((s, r) => s + r.conNo, 0);
  const tongPhatSinh = summary.reduce((s, r) => s + r.phatSinh, 0);
  const tongThanhToan = summary.reduce((s, r) => s + r.thanhToan, 0);

  const filteredLedger = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return ledger;
    return ledger.filter((e) => [e.doiTac, e.web, e.maDH, e.ghiChu].some((v) => (v || '').toLowerCase().includes(s)));
  }, [ledger, q]);

  const previewVND = (!form.soTien && form.soTienNDT && form.tyGia) ? Math.round(form.soTienNDT * form.tyGia) : form.soTien;

  async function save() {
    if (!form.doiTac.trim()) return showToast('Nhập tên shop / NCC', 'error');
    if (!previewVND) return showToast('Nhập số tiền (VND hoặc tệ × tỷ giá)', 'error');
    setBusy(true);
    const r = await callServer('addCongNoNCC', form);
    setBusy(false);
    if (r?.success) { showToast('Đã ghi sổ công nợ', 'success'); reload(); }
    else showToast(r?.message || 'Lỗi', 'error');
  }

  async function del(id: number) {
    if (!confirm('Xoá bút toán này?')) return;
    const r = await callServer('deleteCongNoNCC', id);
    if (r?.success) { showToast('Đã xoá', 'success'); reload(); }
    else showToast(r?.message || 'Lỗi', 'error');
  }

  // ===== In báo cáo (mở cửa sổ in) =====
  function printTable(title: string, headers: string[], rows: (string | number)[][]) {
    if (!rows.length) return showToast('Không có dữ liệu để in', 'error');
    const esc = (v: any) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const th = headers.map((h) => `<th>${esc(h)}</th>`).join('');
    const tr = rows.map((r) => '<tr>' + r.map((c, i) => `<td${i === 0 ? '' : ' class="n"'}>${esc(c)}</td>`).join('') + '</tr>').join('');
    const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${esc(title)}</title>
      <style>body{font-family:Arial,sans-serif;padding:20px;color:#111;font-size:12px}
      h1{font-size:17px;margin:0 0 10px}table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #999;padding:5px 7px;text-align:left}th{background:#f1f5f9}
      td.n{text-align:right}</style></head><body>
      <h1>${esc(title)}</h1><table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>
      <script>window.onload=function(){window.print()}</script></body></html>`;
    const w = window.open('', '_blank', 'width=1000,height=720');
    if (!w) return showToast('Trình duyệt chặn cửa sổ in. Cho phép popup rồi thử lại.', 'error');
    w.document.write(html); w.document.close();
  }

  // ----- Xuất / In: Tổng hợp công nợ theo đối tác -----
  function exportSummary() {
    const ok = exportToCSV(
      summary.map((r) => ({
        doiTac: r.doiTac, n: r.n, phatSinh: r.phatSinh, thanhToan: r.thanhToan, conNo: r.conNo
      })),
      'cong-no-ncc-tong-hop.csv',
      { doiTac: 'Shop / NCC', n: 'Số bút toán', phatSinh: 'Phát sinh', thanhToan: 'Đã trả', conNo: 'Còn nợ' }
    );
    if (!ok) showToast('Chưa có dữ liệu công nợ.', 'error');
  }
  function printSummary() {
    printTable(
      'Tổng hợp công nợ NCC / shop',
      ['Shop / NCC', 'Số bút toán', 'Phát sinh', 'Đã trả', 'Còn nợ'],
      summary.map((r) => [r.doiTac, r.n, fmtVND(r.phatSinh), fmtVND(r.thanhToan), fmtVND(r.conNo)])
    );
  }

  // ----- Xuất / In: Sổ chi tiết -----
  function exportLedger() {
    const ok = exportToCSV(
      filteredLedger.map((e) => ({
        ngay: formatDate(e.ngay), doiTac: e.doiTac, web: e.web, maDH: e.maDH,
        loai: e.loai === 'ThanhToan' ? 'Trả NCC' : 'Phát sinh',
        soTienNDT: e.soTienNDT || '', soTien: e.soTien, ghiChu: e.ghiChu
      })),
      'cong-no-ncc-so-chi-tiet.csv',
      { ngay: 'Ngày', doiTac: 'Shop / NCC', web: 'Web', maDH: 'Đơn', loai: 'Loại', soTienNDT: 'Tệ', soTien: 'Số tiền', ghiChu: 'Ghi chú' }
    );
    if (!ok) showToast('Không có bút toán.', 'error');
  }
  function printLedger() {
    printTable(
      'Sổ chi tiết công nợ NCC / shop',
      ['Ngày', 'Shop / NCC', 'Web', 'Đơn', 'Loại', 'Tệ', 'Số tiền', 'Ghi chú'],
      filteredLedger.map((e) => [
        formatDate(e.ngay), e.doiTac, e.web, e.maDH,
        e.loai === 'ThanhToan' ? 'Trả NCC' : 'Phát sinh',
        e.soTienNDT ? e.soTienNDT.toLocaleString() : '', fmtVND(e.soTien) + 'đ', e.ghiChu
      ])
    );
  }

  const tabAdd = (
    <div className="form-section">
      <div className="section-title"><FiPlus /> Ghi sổ công nợ NCC / shop</div>
      <div className="form-grid">
        <div className="form-field">
          <label>Shop / NCC *</label>
          <input list="partnerlist" value={form.doiTac} onChange={(e) => setForm({ ...form, doiTac: e.target.value })} placeholder="Tên shop trên 1688 / NCC" />
          <datalist id="partnerlist">{partners.map((p) => <option key={p} value={p} />)}</datalist>
        </div>
        <div className="form-field">
          <label>Website</label>
          <input list="weblist2" value={form.web} onChange={(e) => setForm({ ...form, web: e.target.value })} placeholder="1688 / taobao…" />
          <datalist id="weblist2">{[...new Set([...webs, '1688', 'taobao', 'tmall', 'alibaba'])].map((w) => <option key={w} value={w} />)}</datalist>
        </div>
        <div className="form-field">
          <label>Đơn liên quan (tuỳ chọn)</label>
          <input value={form.maDH} onChange={(e) => setForm({ ...form, maDH: e.target.value })} placeholder="DH-..." />
        </div>
        <div className="form-field">
          <label>Loại bút toán</label>
          <select value={form.loai} onChange={(e) => setForm({ ...form, loai: e.target.value })}>
            <option value="PhatSinh">Phát sinh nợ (mua hàng)</option>
            <option value="ThanhToan">Thanh toán NCC (trả nợ)</option>
          </select>
        </div>
      </div>
      <div className="form-grid" style={{ marginTop: 10 }}>
        <div className="form-field">
          <label>Số tệ (NDT)</label>
          <input type="number" value={form.soTienNDT} onChange={(e) => setForm({ ...form, soTienNDT: parseFloat(e.target.value) || 0 })} />
        </div>
        <div className="form-field">
          <label>Tỷ giá</label>
          <input type="number" value={form.tyGia} onChange={(e) => setForm({ ...form, tyGia: parseFloat(e.target.value) || 0 })} />
        </div>
        <div className="form-field">
          <label>Hoặc nhập thẳng VND</label>
          <input type="number" value={form.soTien} onChange={(e) => setForm({ ...form, soTien: parseFloat(e.target.value) || 0 })} placeholder="bỏ trống nếu nhập tệ" />
        </div>
        <div className="form-field">
          <label>Ghi chú</label>
          <input value={form.ghiChu} onChange={(e) => setForm({ ...form, ghiChu: e.target.value })} />
        </div>
      </div>
      <div className="action-card" style={{ marginTop: 12 }}>
        <div className="ac-meta">
          {form.loai === 'PhatSinh' ? 'Tăng nợ phải trả' : 'Giảm nợ (đã trả)'} <b style={{ color: form.loai === 'PhatSinh' ? '#DC2626' : '#059669' }}>{fmtVND(previewVND)}đ</b>
          {form.doiTac && <> · {form.doiTac}</>}
        </div>
        <div className="ac-actions">
          <button className="btn btn-secondary" onClick={() => setForm({ ...blank })}>Làm mới</button>
          <button className="btn btn-primary" onClick={save} disabled={busy}><FiSave /> Ghi sổ</button>
        </div>
      </div>
    </div>
  );

  const tabSummary = (
    <div className="form-section">
      <div className="section-title"><FiTruck /> Công nợ theo shop / NCC</div>
      <div className="btn-row" style={{ justifyContent: 'flex-end', marginBottom: 10 }}>
        <button className="btn btn-secondary btn-sm" onClick={exportSummary} disabled={!summary.length}><FiDownload /> Xuất Excel (CSV)</button>
        <button className="btn btn-secondary btn-sm" onClick={printSummary} disabled={!summary.length}><FiPrinter /> In</button>
      </div>
      <div className="fee-summary" style={{ marginBottom: 14 }}>
        <div className="fee-row"><span>Tổng phát sinh</span><span className="fee-value">{fmtVND(tongPhatSinh)}đ</span></div>
        <div className="fee-row"><span>Tổng đã thanh toán</span><span className="fee-value" style={{ color: '#059669' }}>{fmtVND(tongThanhToan)}đ</span></div>
        <div className="fee-row" style={{ fontWeight: 700 }}><span>CÒN NỢ NCC</span><span className="fee-value" style={{ color: '#DC2626' }}>{fmtVND(tongConNo)}đ</span></div>
      </div>
      {summary.length === 0 ? <div className="empty-state"><FiInbox /><p>Chưa có dữ liệu công nợ.</p></div> : (
        <table className="data-table">
          <thead><tr>
            <th>Shop / NCC</th><th className="number">Số bút toán</th><th className="number">Phát sinh</th>
            <th className="number">Đã trả</th><th className="number">Còn nợ</th>
          </tr></thead>
          <tbody>
            {summary.map((r) => (
              <tr key={r.doiTac}>
                <td><b style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--primary)' }} onClick={() => setNccView(r.doiTac)}>{r.doiTac}</b></td>
                <td className="number">{r.n}</td>
                <td className="number">{fmtVND(r.phatSinh)}đ</td>
                <td className="number" style={{ color: '#059669' }}>{fmtVND(r.thanhToan)}đ</td>
                <td className="number" style={{ color: r.conNo > 0.5 ? '#DC2626' : '#059669', fontWeight: 700 }}>{fmtVND(r.conNo)}đ</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  const tabLedger = (
    <div className="form-section">
      <div className="section-title"><FiInbox /> Sổ chi tiết ({filteredLedger.length})</div>
      <div className="btn-row" style={{ justifyContent: 'flex-end', marginBottom: 10 }}>
        <button className="btn btn-secondary btn-sm" onClick={exportLedger} disabled={!filteredLedger.length}><FiDownload /> Xuất Excel (CSV)</button>
        <button className="btn btn-secondary btn-sm" onClick={printLedger} disabled={!filteredLedger.length}><FiPrinter /> In</button>
      </div>
      <div className="form-field" style={{ marginBottom: 12, maxWidth: 360 }}>
        <div style={{ position: 'relative' }}>
          <FiSearch style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-faint)' }} />
          <input style={{ paddingLeft: 32 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm shop / đơn / ghi chú…" />
        </div>
      </div>
      {filteredLedger.length === 0 ? <div className="empty-state"><FiInbox /><p>Không có bút toán.</p></div> : (
        <table className="data-table">
          <thead><tr>
            <th>Ngày</th><th>Shop / NCC</th><th>Web</th><th>Đơn</th><th>Loại</th>
            <th className="number">Tệ</th><th className="number">Số tiền</th><th>Ghi chú</th><th></th>
          </tr></thead>
          <tbody>
            {filteredLedger.map((e) => (
              <tr key={e.id}>
                <td style={{ fontSize: 12 }}>{formatDate(e.ngay)}</td>
                <td><b style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--primary)' }} onClick={() => setNccView(e.doiTac)}>{e.doiTac}</b></td>
                <td>{e.web}</td>
                <td className="ma-don">{e.maDH ? <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => (window as any).openOrderDetail?.(e.maDH)}>{e.maDH}</span> : ''}</td>
                <td>{e.loai === 'ThanhToan'
                  ? <span className="icon-inline" style={{ color: '#059669' }}><FiArrowDownCircle /> Trả NCC</span>
                  : <span className="icon-inline" style={{ color: '#DC2626' }}><FiArrowUpCircle /> Phát sinh</span>}</td>
                <td className="number">{e.soTienNDT ? e.soTienNDT.toLocaleString() : ''}</td>
                <td className="number"><b>{fmtVND(e.soTien)}đ</b></td>
                <td style={{ fontSize: 12 }}>{e.ghiChu}</td>
                <td><button className="btn btn-danger btn-sm" onClick={() => del(e.id)}><FiTrash2 /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <>
      <div className="alert alert-info">
        <FiInfo /><span>Theo dõi <b>công nợ phải trả NCC / shop TQ</b> theo từng shop và từng đơn. Nhập tệ × tỷ giá hoặc nhập thẳng VND.</span>
      </div>
      <Tabs tabs={[
        { id: 'sum', label: <><FiTruck /> Tổng hợp công nợ</>, content: tabSummary },
        { id: 'add', label: <><FiPlus /> Ghi sổ</>, content: tabAdd },
        { id: 'led', label: <><FiInbox /> Sổ chi tiết</>, content: tabLedger }
      ]} />

      {/* Chi tiết công nợ 1 đối tác — tái dùng ledger + summary đã tính ở client */}
      {nccView && (() => {
        const entries = ledger.filter((e) => e.doiTac === nccView);
        const s = summary.find((x) => x.doiTac === nccView);
        return (
          <div className="modal-overlay show" onClick={(e) => { if (e.target === e.currentTarget) setNccView(null); }}>
            <div className="modal-content" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header"><h2><FiTruck /> {nccView}</h2><button className="modal-close" onClick={() => setNccView(null)}><FiX /></button></div>
              <div className="modal-body">
                {s && (
                  <div className="fee-summary" style={{ marginBottom: 12 }}>
                    <div className="fee-row"><span>Tổng phát sinh</span><span className="fee-value">{fmtVND(s.phatSinh)}đ</span></div>
                    <div className="fee-row"><span>Đã thanh toán</span><span className="fee-value" style={{ color: '#059669' }}>{fmtVND(s.thanhToan)}đ</span></div>
                    <div className="fee-row" style={{ fontWeight: 700 }}><span>CÒN NỢ</span><span className="fee-value" style={{ color: s.conNo > 0.5 ? '#DC2626' : '#059669' }}>{fmtVND(s.conNo)}đ</span></div>
                  </div>
                )}
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Bút toán ({entries.length})</div>
                <table className="data-table" style={{ fontSize: 12 }}>
                  <thead><tr><th>Ngày</th><th>Đơn</th><th>Loại</th><th className="number">Tệ</th><th className="number">Số tiền</th><th>Ghi chú</th></tr></thead>
                  <tbody>
                    {entries.map((e) => (
                      <tr key={e.id}>
                        <td>{formatDate(e.ngay)}</td>
                        <td className="ma-don">{e.maDH ? <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => (window as any).openOrderDetail?.(e.maDH)}>{e.maDH}</span> : ''}</td>
                        <td>{e.loai === 'ThanhToan' ? 'Trả NCC' : 'Phát sinh'}</td>
                        <td className="number">{e.soTienNDT ? e.soTienNDT.toLocaleString() : ''}</td>
                        <td className="number">{fmtVND(e.soTien)}đ</td>
                        <td>{e.ghiChu}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
