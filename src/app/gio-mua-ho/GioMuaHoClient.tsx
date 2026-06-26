'use client';

import { useMemo, useState } from 'react';
import {
  FiShoppingCart, FiInbox, FiSearch, FiTrash2, FiExternalLink,
  FiRefreshCw, FiInfo, FiImage
} from 'react-icons/fi';
import { formatDate } from '@/lib/format';
import { callServer, reload } from '@/lib/client';
import { showToast } from '@/components/Toast';

type Item = {
  id: number; source: string; productId: string; productUrl: string; title: string; titleVi?: string;
  image: string; priceText: string; priceValue: number | null; currency: string;
  quantity: number; minQuantity: number; skuText: string; note: string;
  nguoiThem: string; createdAt: string;
};

const SOURCE_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  '1688': { label: '1688', bg: '#fff7ed', color: '#c2410c' },
  taobao: { label: 'Taobao', bg: '#fff1f2', color: '#be123c' },
  tmall: { label: 'Tmall', bg: '#fef2f2', color: '#b91c1c' },
};

function vnd(n: number) { return Math.round(n).toLocaleString('vi-VN') + 'đ'; }

export default function GioMuaHoClient({ items, tyGia, isAdmin }: { items: Item[]; tyGia: number; isAdmin: boolean }) {
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((it) =>
      [it.title, it.skuText, it.note, it.source, it.productId, it.nguoiThem]
        .some((v) => (v || '').toLowerCase().includes(s))
    );
  }, [items, q]);

  const tongVnd = useMemo(
    () => filtered.reduce((sum, it) => sum + (it.priceValue || 0) * tyGia * it.quantity, 0),
    [filtered, tyGia]
  );

  async function del(it: Item) {
    if (!confirm(`Xoá "${it.title.slice(0, 40)}" khỏi giỏ?`)) return;
    const r = await callServer('deleteGioMuaHo', it.id);
    if (r?.success) { showToast('Đã xoá khỏi giỏ', 'success'); reload(); }
    else showToast(r?.message || 'Lỗi', 'error');
  }

  async function clearAll() {
    if (!filtered.length) return;
    if (!confirm('Xoá TẤT CẢ sản phẩm trong giỏ mua hộ?')) return;
    const r = await callServer('clearGioMuaHo');
    if (r?.success) { showToast(`Đã xoá ${r.count ?? ''} sản phẩm`, 'success'); reload(); }
    else showToast(r?.message || 'Lỗi', 'error');
  }

  return (
    <>
      <div className="alert alert-info">
        <FiInfo />
        <span>
          Sản phẩm dưới đây do nhân viên thêm bằng <b>extension Mua hộ</b> ngay trên trang
          1688 / Taobao / Tmall. Tỷ giá tạm tính: <b>{tyGia.toLocaleString('vi-VN')}đ/¥</b>.
        </span>
      </div>

      <div className="kpi-row">
        <div className="kpi" style={{ ['--primary' as any]: '#f0512b' }}>
          <div className="kpi-label"><FiShoppingCart /> SP trong giỏ</div>
          <div className="kpi-value">{filtered.length}</div>
        </div>
        <div className="kpi" style={{ ['--primary' as any]: '#0891b2' }}>
          <div className="kpi-label"><FiInbox /> Tổng số lượng</div>
          <div className="kpi-value">{filtered.reduce((s, it) => s + it.quantity, 0)}</div>
        </div>
        <div className="kpi" style={{ ['--primary' as any]: '#16a34a' }}>
          <div className="kpi-label">≈ Tạm tính (VND)</div>
          <div className="kpi-value" style={{ fontSize: 20 }}>{vnd(tongVnd)}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, margin: '14px 0', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="form-field" style={{ flex: '1 1 280px', maxWidth: 380 }}>
          <div style={{ position: 'relative' }}>
            <FiSearch style={{ position: 'absolute', left: 10, top: 9, color: 'var(--text-faint)' }} />
            <input style={{ paddingLeft: 32 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm tên SP / phân loại / nguồn..." />
          </div>
        </div>
        <button className="btn btn-sm btn-secondary" onClick={() => reload()}><FiRefreshCw /> Làm mới</button>
        <button className="btn btn-sm btn-danger" onClick={clearAll} disabled={!filtered.length}><FiTrash2 /> Xoá hết</button>
      </div>

      <div className="form-section">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <FiInbox />
            <p>Giỏ mua hộ đang trống. Mở trang 1688/Taobao và bấm <b>“Thêm vào giỏ mua hộ”</b> trên extension.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead><tr>
              <th style={{ width: 54 }}></th>
              <th>Sản phẩm</th>
              <th>Nguồn</th>
              <th>Phân loại</th>
              <th className="number">SL</th>
              <th className="number">¥ Giá</th>
              <th className="number">≈ VND</th>
              {isAdmin && <th>Người thêm</th>}
              <th>Thời gian</th>
              <th></th>
            </tr></thead>
            <tbody>
              {filtered.map((it) => {
                const badge = SOURCE_BADGE[it.source] || { label: it.source || '?', bg: '#f1f5f9', color: '#475569' };
                const estVnd = (it.priceValue || 0) * tyGia * it.quantity;
                return (
                  <tr key={it.id}>
                    <td>
                      {it.image
                        ? <img src={it.image} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
                        : <div style={{ width: 44, height: 44, borderRadius: 6, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}><FiImage /></div>}
                    </td>
                    <td style={{ maxWidth: 320 }}>
                      <div style={{ fontWeight: 600, lineHeight: 1.3 }}>
                        {it.titleVi || it.title}
                        {it.productUrl && <a href={it.productUrl} target="_blank" className="icon-inline" style={{ color: 'var(--primary)', marginLeft: 6 }}><FiExternalLink /></a>}
                      </div>
                      {it.titleVi && <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 1 }}>{it.title}</div>}
                      {it.note && <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>“{it.note}”</div>}
                    </td>
                    <td><span className="role-badge" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span></td>
                    <td>{it.skuText || '-'}</td>
                    <td className="number">{it.quantity}{it.minQuantity > 1 && <span style={{ color: 'var(--text-faint)', fontSize: 11 }}> /MOQ{it.minQuantity}</span>}</td>
                    <td className="number">{it.priceText || (it.priceValue != null ? it.priceValue : '-')}</td>
                    <td className="number">{it.priceValue != null ? vnd(estVnd) : '-'}</td>
                    {isAdmin && <td>{it.nguoiThem || '-'}</td>}
                    <td>{formatDate(it.createdAt)}</td>
                    <td>
                      <button className="erp-iconbtn rm" title="Xoá khỏi giỏ" onClick={() => del(it)}><FiTrash2 /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
