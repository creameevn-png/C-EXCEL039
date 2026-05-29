'use client';

import { useMemo, useState } from 'react';
import { FiPackage, FiHome, FiStar, FiExternalLink, FiInbox, FiSearch } from 'react-icons/fi';
import { formatNDT, formatDate } from '@/lib/format';

type Nguon = {
  id: number; tenSP: string; tenNCC: string; linkTaobao: string;
  giaNDT: number | null; moq: number; thoiGianGiao: string; chatLuong: number; createdAt: string;
};
type Ncc = { id: number; maNCC: string; tenNCC: string; wechat: string; ghiChu: string };

function Stars({ n }: { n: number }) {
  if (!n) return <span>-</span>;
  return (
    <span className="icon-inline" style={{ color: '#f59e0b' }}>
      {Array.from({ length: n }).map((_, i) => <FiStar key={i} fill="#f59e0b" />)}
    </span>
  );
}

export default function MuaHangClient({ nguonHang, ncc }: { nguonHang: Nguon[]; ncc: Ncc[] }) {
  const [q, setQ] = useState('');

  const filteredNguon = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return nguonHang;
    return nguonHang.filter((n) => [n.tenSP, n.tenNCC].some((v) => (v || '').toLowerCase().includes(s)));
  }, [nguonHang, q]);

  const filteredNcc = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return ncc;
    return ncc.filter((n) => [n.maNCC, n.tenNCC, n.wechat].some((v) => (v || '').toLowerCase().includes(s)));
  }, [ncc, q]);

  return (
    <>
      <div className="form-field" style={{ maxWidth: 380, marginBottom: 16 }}>
        <div style={{ position: 'relative' }}>
          <FiSearch style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-faint)' }} />
          <input style={{ paddingLeft: 32 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm sản phẩm / NCC / WeChat..." />
        </div>
      </div>

      <div className="form-section">
        <div className="section-title"><FiPackage /> Danh sách nguồn hàng ({filteredNguon.length}/{nguonHang.length})</div>
        {filteredNguon.length === 0 ? (
          <div className="empty-state"><FiInbox /><p>Không có nguồn hàng khớp.</p></div>
        ) : (
          <table className="data-table">
            <thead><tr>
              <th>Tên SP</th><th>NCC</th><th className="number">¥ Giá</th>
              <th className="number">MOQ</th><th>Thời gian giao</th><th>Đánh giá</th><th>Ngày thêm</th>
            </tr></thead>
            <tbody>
              {filteredNguon.map((n) => (
                <tr key={n.id}>
                  <td>{n.tenSP} {n.linkTaobao && <a href={n.linkTaobao} target="_blank" className="icon-inline" style={{ color: 'var(--primary)' }}><FiExternalLink /></a>}</td>
                  <td>{n.tenNCC || '-'}</td>
                  <td className="number">{n.giaNDT ? formatNDT(n.giaNDT) : '-'}</td>
                  <td className="number">{n.moq}</td>
                  <td>{n.thoiGianGiao || '-'}</td>
                  <td><Stars n={n.chatLuong || 0} /></td>
                  <td>{formatDate(n.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="form-section">
        <div className="section-title"><FiHome /> Nhà cung cấp ({filteredNcc.length}/{ncc.length})</div>
        {filteredNcc.length === 0 ? (
          <div className="empty-state"><FiInbox /><p>Không có NCC khớp.</p></div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Mã NCC</th><th>Tên</th><th>WeChat</th><th>Ghi chú</th></tr></thead>
            <tbody>
              {filteredNcc.map((n) => (
                <tr key={n.id}>
                  <td className="ma-don">{n.maNCC || '-'}</td>
                  <td>{n.tenNCC}</td>
                  <td>{n.wechat || '-'}</td>
                  <td>{n.ghiChu || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
