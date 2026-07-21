'use client';

import { useEffect, useState, useCallback } from 'react';
import { FiTruck, FiX, FiExternalLink } from 'react-icons/fi';
import { callServer } from '@/lib/client';
import { fmtVND, formatNDT } from '@/lib/format';

type NguonRow = {
  id: number; tenSP: string; danhMuc: string;
  linkTaobao: string; giaNDT: number | null; moq: number; chatLuong: number | null;
};
type NccDetail = {
  tenNCC: string; maNCC: string; wechat: string; ghiChu: string;
  coHoSo: boolean; congNo: number; soCongNoDong: number; canSeeMoney: boolean;
  nguonHang: NguonRow[];
};

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: '#F8FAFC', padding: '8px 10px', borderRadius: 8 }}>
      <div style={{ fontSize: 10, color: '#64748B' }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 13, color: color || '#0F172A' }}>{value}</div>
    </div>
  );
}

/**
 * Modal chi tiết nhà cung cấp — mở bằng global `window.openNccDetail(maNCC | tenNCC)`.
 * Cùng khuôn với CustomerDetailModal. NCC nối bằng TÊN (fuzzy, chưa FK) nên khóa
 * nhận cả mã lẫn tên. Mỗi nguồn hàng bấm được để mở tiếp chi tiết sản phẩm
 * (openProductDetail) — trang cần mount cả ProductDetailModalHost và đặt SAU host
 * này để modal sản phẩm nổi lên trên.
 * Công nợ đã MASK ở server (chỉ Mua hàng/Kế toán/Admin thấy). Prop canSeeMoney
 * chỉ để ẩn phần hiển thị cho khớp; nguồn chân lý vẫn là data.canSeeMoney.
 */
export default function NccDetailModalHost({ canSeeMoney = true }: { canSeeMoney?: boolean }) {
  const [data, setData] = useState<NccDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const open = useCallback(async (khoa: string) => {
    if (!khoa) return;
    setLoading(true);
    setData(null);
    const res = await callServer('getNccDetail', khoa);
    setLoading(false);
    if (res?.success) setData(res.data);
    else if (typeof window !== 'undefined' && (window as any).__showToast) {
      (window as any).__showToast(res?.message || 'Không tải được nhà cung cấp', 'error');
    }
  }, []);

  useEffect(() => {
    (window as any).openNccDetail = open;
    return () => { delete (window as any).openNccDetail; };
  }, [open]);

  function close() { setData(null); }

  const showMoney = canSeeMoney && !!data?.canSeeMoney;

  return (
    <div className={`modal-overlay ${data || loading ? 'show' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal-content" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2><FiTruck /> Nhà cung cấp {data?.maNCC || ''}</h2>
          <button className="modal-close" onClick={close}><FiX /></button>
        </div>
        <div className="modal-body">
          {loading && <p style={{ textAlign: 'center', color: '#94A3B8' }}>Đang tải...</p>}
          {data && (
            <>
              <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{data.tenNCC}</div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                  {data.maNCC && <>Mã NCC: <b>{data.maNCC}</b> · </>}
                  {data.wechat && <>WeChat: <b>{data.wechat}</b> · </>}
                  {data.coHoSo ? 'Đã lập hồ sơ' : 'Chưa lập hồ sơ (chỉ có tên trong nguồn hàng)'}
                </div>
                {data.ghiChu && <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Ghi chú: {data.ghiChu}</div>}
              </div>

              {showMoney && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
                  <StatBox label="Công nợ NCC" value={fmtVND(data.congNo) + 'đ'} color={data.congNo > 0 ? '#DC2626' : '#059669'} />
                  <StatBox label="Số dòng công nợ" value={String(data.soCongNoDong)} />
                  <StatBox label="Số nguồn hàng" value={String(data.nguonHang.length)} />
                </div>
              )}

              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                Nguồn hàng ({data.nguonHang.length})
              </div>
              <table className="data-table" style={{ fontSize: 12 }}>
                <thead><tr>
                  <th>Sản phẩm</th><th>Danh mục</th>
                  <th className="number">Giá tham khảo</th>
                  <th className="number">MOQ</th><th className="number">Chất lượng</th><th>Link</th>
                </tr></thead>
                <tbody>
                  {data.nguonHang.map((n) => (
                    <tr key={n.id}>
                      <td>
                        <span style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--primary)' }}
                          onClick={() => (window as any).openProductDetail?.(String(n.id))}>{n.tenSP}</span>
                      </td>
                      <td>{n.danhMuc || '-'}</td>
                      <td className="number">{n.giaNDT != null ? formatNDT(n.giaNDT) : '-'}</td>
                      <td className="number">{n.moq || '-'}</td>
                      <td className="number">{n.chatLuong != null ? '★ ' + n.chatLuong : '-'}</td>
                      <td>
                        {n.linkTaobao
                          ? <a href={n.linkTaobao} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}><FiExternalLink /></a>
                          : '-'}
                      </td>
                    </tr>
                  ))}
                  {data.nguonHang.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: '#94A3B8' }}>Chưa có nguồn hàng</td></tr>
                  )}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
