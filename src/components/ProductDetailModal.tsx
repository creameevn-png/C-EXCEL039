'use client';

import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { FiBox, FiX, FiExternalLink } from 'react-icons/fi';
import { callServer } from '@/lib/client';
import { formatNDT, formatCurrency } from '@/lib/format';

type SanPhamDetail = {
  loai: 'SanPham';
  maSP: string; tenSP: string; danhMuc: string; webNguon: string;
  kgGoiY: number; m3GoiY: number; giaThamKhao: number; linkTaobao: string; ghiChu: string;
};
type NguonHangDetail = {
  loai: 'NguonHang';
  id: number; tenSP: string; danhMuc: string; tenNCC: string; linkTaobao: string;
  giaNDT: number | null; moq: number; thoiGianGiao: string; chatLuong: number | null; ghiChu: string;
};
type ProductDetail = SanPhamDetail | NguonHangDetail;

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: '1px solid #F1F5F9', fontSize: 13 }}>
      <span style={{ color: '#64748B' }}>{label}</span>
      <span style={{ fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

/**
 * Modal chi tiết sản phẩm — mở bằng global `window.openProductDetail(maSP | id)`.
 * Cùng khuôn với CustomerDetailModal. Server trả DISCRIMINATOR `loai`:
 *  - 'SanPham'   → bản ghi SanPham (có mã maSP)
 *  - 'NguonHang' → bản ghi NguonHang (chỉ id số), gắn tên NCC bấm được
 *    (openNccDetail) — trang cần mount NccDetailModalHost, đặt SAU host này.
 * Không có giá vốn ở đây (giá tham khảo/NDT an toàn) nên KHÔNG mask.
 */
export default function ProductDetailModalHost() {
  const [data, setData] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const open = useCallback(async (khoa: string | number) => {
    const k = String(khoa || '').trim();
    if (!k) return;
    setLoading(true);
    setData(null);
    const res = await callServer('getProductDetail', k);
    setLoading(false);
    if (res?.success) setData(res.data);
    else if (typeof window !== 'undefined' && (window as any).__showToast) {
      (window as any).__showToast(res?.message || 'Không tải được sản phẩm', 'error');
    }
  }, []);

  useEffect(() => {
    (window as any).openProductDetail = open;
    return () => { delete (window as any).openProductDetail; };
  }, [open]);

  function close() { setData(null); }

  return (
    <div className={`modal-overlay ${data || loading ? 'show' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal-content" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2><FiBox /> {data?.loai === 'SanPham' ? 'Sản phẩm' : 'Nguồn hàng'}</h2>
          <button className="modal-close" onClick={close}><FiX /></button>
        </div>
        <div className="modal-body">
          {loading && <p style={{ textAlign: 'center', color: '#94A3B8' }}>Đang tải...</p>}
          {data && (
            <>
              <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{data.tenSP}</div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                  {data.loai === 'SanPham' ? <>Mã SP: <b>{data.maSP}</b></> : <>ID nguồn: <b>{data.id}</b></>}
                  {data.danhMuc && <> · Danh mục: <b>{data.danhMuc}</b></>}
                </div>
              </div>

              {data.loai === 'SanPham' ? (
                <div>
                  <Row label="Web nguồn" value={data.webNguon || '-'} />
                  <Row label="KG gợi ý" value={data.kgGoiY || '-'} />
                  <Row label="m³ gợi ý" value={data.m3GoiY || '-'} />
                  <Row label="Giá tham khảo" value={data.giaThamKhao ? formatCurrency(data.giaThamKhao) : '-'} />
                  <Row label="Link Taobao" value={data.linkTaobao
                    ? <a href={data.linkTaobao} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>Mở <FiExternalLink style={{ verticalAlign: 'middle' }} /></a>
                    : '-'} />
                  {data.ghiChu && <Row label="Ghi chú" value={data.ghiChu} />}
                </div>
              ) : (
                <div>
                  <Row label="Nhà cung cấp" value={data.tenNCC
                    ? <span style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--primary)' }}
                        onClick={() => (window as any).openNccDetail?.(data.tenNCC)}>{data.tenNCC}</span>
                    : '-'} />
                  <Row label="Giá NDT" value={data.giaNDT != null ? formatNDT(data.giaNDT) : '-'} />
                  <Row label="MOQ" value={data.moq || '-'} />
                  <Row label="Thời gian giao" value={data.thoiGianGiao || '-'} />
                  <Row label="Chất lượng" value={data.chatLuong != null ? '★ ' + data.chatLuong : '-'} />
                  <Row label="Link Taobao" value={data.linkTaobao
                    ? <a href={data.linkTaobao} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>Mở <FiExternalLink style={{ verticalAlign: 'middle' }} /></a>
                    : '-'} />
                  {data.ghiChu && <Row label="Ghi chú" value={data.ghiChu} />}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
