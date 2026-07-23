'use client';

import { useEffect, useState, useCallback } from 'react';
import { FiPackage, FiX, FiExternalLink, FiFileText, FiBook, FiImage } from 'react-icons/fi';
import { callServer } from '@/lib/client';
import { fmtVND, formatDate, formatNDT } from '@/lib/format';
import { statusToClass, statusToLabel } from '@/lib/status';

type ChiTiet = {
  stt: number; tenSP: string; soLuong: number;
  donGiaNDT: number; tyGia: number; donGiaVND: number; thanhTien: number;
  kg: number; m3: number;
  webNguon?: string | null; linkTaobao?: string | null; ghiChu?: string | null;
};

type Payment = { soTien: number; ghiChu: string | null; ngay: string; nv: string };

type OrderDetail = {
  maDH: string;
  ngayTao: string;
  maKH: string;
  tenKH: string;
  sdt: string;
  tuyen: string;
  lineVC: string;
  loaiHang: string;
  trangThai: string;
  maGD: string | null;
  maVD: string | null;
  nvName: string;
  gdvTen?: string;
  tongKg: number;
  tongM3: number;
  pctCoc: number;
  chiTiet: ChiTiet[];
  tongGiaHang: number;
  phiMua: number;
  phiBH: number;
  phiPhatSinh: number;
  phiPhatSinhDuyet?: boolean;
  phiKhieuNai?: number;
  phiVC: number;
  shipND: number;
  dongGo: number;
  phuThu: number;
  thueNK: number;
  vat: number;
  phiKiemHoa: number;
  phiLuuKho: number;
  phiKiemDem?: number;
  ngachHQ: string;
  tongTien: number;
  tienCoc: number;
  daTra: number;
  conLai: number;
  ghiChu: string;
  ghiChuGDV?: string;
  kiemDem?: boolean;
  nguoiNhan?: string;
  sdtNhan?: string;
  diaChiNhan?: string;
  canSeeProfit?: boolean;
  vonNDT?: number;
  shipNDTQ?: number;
  shipKhachNDT?: number;
  tongThuNDT?: number;
  loiNhuanNDT?: number;
  anh: { khoTQ?: string; roiTQ?: string; khoVN?: string; giaoKH?: string };
  payments: Payment[];
};

export default function OrderDetailModalHost({ canSeeMoney, canSeeProfit = false }: { canSeeMoney: boolean; canSeeProfit?: boolean }) {
  const [data, setData] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const open = useCallback(async (maDH: string) => {
    setLoading(true);
    setData(null);
    const res = await callServer('getOrderDetail', maDH);
    setLoading(false);
    if (res?.success) setData(res.data);
    else if (typeof window !== 'undefined' && (window as any).__showToast) {
      (window as any).__showToast(res?.message || 'Không tải được đơn', 'error');
    }
  }, []);

  useEffect(() => {
    (window as any).openOrderDetail = open;
    return () => { delete (window as any).openOrderDetail; };
  }, [open]);

  function close() { setData(null); }

  return (
    <div className={`modal-overlay ${data || loading ? 'show' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal-content" style={{ maxWidth: 760 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2><FiPackage /> Chi tiết đơn {data?.maDH || ''}</h2>
          <button className="modal-close" onClick={close}><FiX /></button>
        </div>
        <div className="modal-body">
          {loading && <p style={{ textAlign: 'center', color: '#94A3B8' }}>Đang tải...</p>}
          {data && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>Ngày tạo</div>
                  <div style={{ fontWeight: 600 }}>{formatDate(data.ngayTao)}</div>
                </div>
                <span className={`status-badge ${statusToClass(data.trangThai)}`}>{statusToLabel(data.trangThai)}</span>
              </div>

              <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: '#64748B', marginBottom: 4 }}>Khách hàng</div>
                <div style={{ fontWeight: 700 }}>{data.maKH ? <span style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--primary)' }} onClick={() => (window as any).openCustomerDetail?.(data.maKH)}>{data.maKH}</span> : ''}{' - '}{data.tenKH}</div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                  {data.sdt && <>SĐT: {data.sdt} · </>}
                  Tuyến: <b>{data.tuyen === 'HCM' ? 'HCM' : 'Hà Nội'}</b> ·
                  Line: <b>{data.lineVC}</b> · Loại: <b>{data.loaiHang}</b> · Ngạch: <b>{data.ngachHQ || 'Tiểu ngạch'}</b>
                  {data.kiemDem && <> · <b style={{ color: '#b45309' }}>✔ Kiểm đếm (GTGT)</b></>}
                </div>
                {(data.nguoiNhan || data.diaChiNhan) && (
                  <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                    Người nhận: <b>{data.nguoiNhan || '-'}</b>{data.sdtNhan ? ` · ${data.sdtNhan}` : ''}
                    {data.diaChiNhan ? <> · Địa chỉ: <b>{data.diaChiNhan}</b></> : ''}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 12 }}>
                <div className="icon-inline" style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}><FiPackage /> Chi tiết SP ({data.chiTiet.length})</div>
                <table className="data-table" style={{ fontSize: 12 }}>
                  <thead><tr>
                    <th>#</th><th>Tên SP</th><th className="number">SL</th>
                    {canSeeMoney && <><th className="number">¥ Đơn giá</th><th className="number">Tỷ giá</th><th className="number">Thành tiền</th></>}
                    <th className="number">Kg</th><th className="number">m³</th>
                  </tr></thead>
                  <tbody>
                    {data.chiTiet.map((c) => (
                      <tr key={c.stt}>
                        <td>{c.stt}</td>
                        <td>
                          {c.tenSP}
                          {c.linkTaobao && <a href={c.linkTaobao} target="_blank" className="icon-inline" style={{ marginLeft: 6, color: 'var(--primary)' }}><FiExternalLink /></a>}
                          {c.webNguon && <div style={{ fontSize: 10, color: '#94A3B8' }}>{c.webNguon}</div>}
                        </td>
                        <td className="number">{c.soLuong}</td>
                        {canSeeMoney && <>
                          <td className="number">{formatNDT(c.donGiaNDT)}</td>
                          <td className="number">{c.tyGia.toLocaleString('vi-VN')}</td>
                          <td className="number"><b>{fmtVND(c.thanhTien)}đ</b></td>
                        </>}
                        <td className="number">{c.kg}</td>
                        <td className="number">{c.m3}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ marginTop: 4, fontSize: 12, color: '#64748B', textAlign: 'right' }}>
                  Tổng: <b>{data.tongKg.toFixed(2)}kg / {data.tongM3.toFixed(4)}m³</b>
                </div>
              </div>

              {canSeeMoney && (
                <div className="fee-summary" style={{ marginTop: 0 }}>
                  <div className="fee-row"><span>Tổng giá hàng</span><span className="fee-value">{fmtVND(data.tongGiaHang)}đ</span></div>
                  <div className="fee-row"><span>Phí mua hàng</span><span className="fee-value">{fmtVND(data.phiMua)}đ</span></div>
                  <div className="fee-row"><span>Phí vận chuyển</span><span className="fee-value">{fmtVND(data.phiVC)}đ</span></div>
                  <div className="fee-row"><span>Phí ship VN</span><span className="fee-value">{fmtVND(data.shipND)}đ</span></div>
                  {data.dongGo > 0 && <div className="fee-row"><span>Phí đóng gỗ</span><span className="fee-value">{fmtVND(data.dongGo)}đ</span></div>}
                  {data.phuThu > 0 && <div className="fee-row"><span>Phí phụ thu</span><span className="fee-value">{fmtVND(data.phuThu)}đ</span></div>}
                  {data.phiBH > 0 && <div className="fee-row"><span>Phí bảo hiểm</span><span className="fee-value">{fmtVND(data.phiBH)}đ</span></div>}
                  {data.phiPhatSinh > 0 && (
                    <div className="fee-row">
                      <span>
                        Phí phát sinh khác
                        {!data.phiPhatSinhDuyet && <b style={{ color: '#B45309' }}> · chờ Kế toán duyệt</b>}
                      </span>
                      <span className="fee-value">{fmtVND(data.phiPhatSinh)}đ</span>
                    </div>
                  )}
                  {(data.phiKhieuNai || 0) > 0 && (
                    <div className="fee-row">
                      <span>Phí đổi trả (khiếu nại)</span>
                      <span className="fee-value">{fmtVND(data.phiKhieuNai || 0)}đ</span>
                    </div>
                  )}
                  {data.thueNK > 0 && <div className="fee-row"><span>Thuế nhập khẩu</span><span className="fee-value">{fmtVND(data.thueNK)}đ</span></div>}
                  {data.vat > 0 && <div className="fee-row"><span>VAT</span><span className="fee-value">{fmtVND(data.vat)}đ</span></div>}
                  {data.phiKiemHoa > 0 && <div className="fee-row"><span>Phí kiểm hóa</span><span className="fee-value">{fmtVND(data.phiKiemHoa)}đ</span></div>}
                  {data.phiLuuKho > 0 && <div className="fee-row"><span>Phí lưu kho</span><span className="fee-value">{fmtVND(data.phiLuuKho)}đ</span></div>}
                  {(data.phiKiemDem || 0) > 0 && <div className="fee-row"><span>Phí kiểm đếm</span><span className="fee-value">{fmtVND(data.phiKiemDem || 0)}đ</span></div>}
                  <div className="fee-row" style={{ borderTop: '1px solid #CBD5E1' }}>
                    <span><b>Tổng tiền</b></span>
                    <span className="fee-value" style={{ color: '#1E3A8A' }}>{fmtVND(data.tongTien)}đ</span>
                  </div>
                  <div className="fee-row"><span>Cọc ({data.pctCoc}%)</span><span className="fee-value" style={{ color: '#92400E' }}>{fmtVND(data.tienCoc)}đ</span></div>
                  <div className="fee-row"><span>Đã trả</span><span className="fee-value" style={{ color: '#059669' }}>{fmtVND(data.daTra)}đ</span></div>
                  <div className="fee-row"><span><b>Còn lại</b></span>
                    <span className="fee-value" style={{ color: data.conLai > 0 ? '#DC2626' : '#059669' }}>{fmtVND(data.conLai)}đ</span>
                  </div>
                </div>
              )}

              {canSeeProfit && (
                <div className="fee-summary" style={{ marginTop: 12 }}>
                  <div className="fee-row"><span>Tiền hàng khách trả</span><span className="fee-value" style={{ color: '#059669' }}>+ {(data.tongThuNDT || 0).toLocaleString('zh-CN')}¥</span></div>
                  <div className="fee-row"><span>Ship nội địa TQ khách trả</span><span className="fee-value" style={{ color: '#059669' }}>+ {(data.shipKhachNDT || 0).toLocaleString('zh-CN')}¥</span></div>
                  <div className="fee-row"><span>Tiền hàng thực trả NCC</span><span className="fee-value" style={{ color: '#DC2626' }}>− {(data.vonNDT || 0).toLocaleString('zh-CN')}¥</span></div>
                  <div className="fee-row"><span>Phí ship nội địa TQ thực</span><span className="fee-value" style={{ color: '#DC2626' }}>− {(data.shipNDTQ || 0).toLocaleString('zh-CN')}¥</span></div>
                  <div className="fee-row" style={{ borderTop: '1px solid #CBD5E1' }}>
                    <span><b>Lợi nhuận GDV (tệ)</b></span>
                    <span className="fee-value" style={{ color: (data.loiNhuanNDT || 0) >= 0 ? '#059669' : '#DC2626' }}>{(data.loiNhuanNDT || 0).toLocaleString('zh-CN')}¥</span>
                  </div>
                </div>
              )}

              <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                <div><b>Mã GD:</b> {data.maGD || '(chưa có)'}</div>
                <div><b>Mã VĐ:</b> {data.maVD ? <span style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--primary)' }} onClick={() => (window as any).openVanDonDetail?.(data.maVD)}>{data.maVD}</span> : '(chưa có)'}</div>
                <div><b>NV tạo:</b> {data.nvName || '-'}</div>
                {data.gdvTen && <div><b>GDV phụ trách:</b> {data.gdvTen}</div>}
              </div>

              {data.ghiChu && (
                <div className="icon-inline" style={{ marginTop: 10, padding: 8, background: '#F8FAFC', borderRadius: 6, fontSize: 12 }}>
                  <FiFileText /> {data.ghiChu}
                </div>
              )}

              {data.ghiChuGDV && (
                <div className="icon-inline" style={{ marginTop: 8, padding: 8, background: '#EFF6FF', borderRadius: 6, fontSize: 12, color: '#1E40AF' }}>
                  <FiFileText /> <b>Ghi chú GDV:</b> {data.ghiChuGDV}
                </div>
              )}

              {canSeeMoney && data.payments.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div className="icon-inline" style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}><FiBook /> Lịch sử thanh toán</div>
                  <table className="data-table" style={{ fontSize: 12 }}>
                    <thead><tr><th>Ngày</th><th className="number">Số tiền</th><th>Ghi chú</th><th>NV</th></tr></thead>
                    <tbody>
                      {data.payments.map((p, i) => (
                        <tr key={i}>
                          <td>{formatDate(p.ngay)}</td>
                          <td className="number">{fmtVND(p.soTien)}đ</td>
                          <td>{p.ghiChu || ''}</td>
                          <td>{p.nv}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {(data.anh.khoTQ || data.anh.roiTQ || data.anh.khoVN || data.anh.giaoKH) && (
                <div style={{ marginTop: 14 }}>
                  <div className="icon-inline" style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}><FiImage /> Ảnh xử lý</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
                    {data.anh.khoTQ && <div><div style={{ fontSize: 11, color: '#64748B' }}>Nhận tại Kho TQ</div><img src={data.anh.khoTQ} style={{ width: '100%', borderRadius: 6 }} /></div>}
                    {data.anh.roiTQ && <div><div style={{ fontSize: 11, color: '#64748B' }}>Rời TQ</div><img src={data.anh.roiTQ} style={{ width: '100%', borderRadius: 6 }} /></div>}
                    {data.anh.khoVN && <div><div style={{ fontSize: 11, color: '#64748B' }}>Nhận tại Kho VN</div><img src={data.anh.khoVN} style={{ width: '100%', borderRadius: 6 }} /></div>}
                    {data.anh.giaoKH && <div><div style={{ fontSize: 11, color: '#64748B' }}>Đã giao KH</div><img src={data.anh.giaoKH} style={{ width: '100%', borderRadius: 6 }} /></div>}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
