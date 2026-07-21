'use client';

import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { FiAlertTriangle, FiX, FiImage } from 'react-icons/fi';
import { callServer } from '@/lib/client';
import { fmtVND, formatDate, formatDateTime } from '@/lib/format';
import { KN_LABEL, KN_CLASS } from '@/lib/status';

const LOAI_LABEL: Record<string, string> = {
  HangLoi: 'Hàng lỗi', ThieuHang: 'Thiếu hàng', GiaoSai: 'Giao sai', KhongNhan: 'Không nhận', Khac: 'Khác'
};
const PHUONG_AN_LABEL: Record<string, string> = {
  HoanTien: 'Hoàn tiền', DoiTra: 'Đổi/trả hàng', GiamGia: 'Giảm giá đơn sau', Khac: 'Khác'
};
const QUY_LABEL: Record<string, string> = {
  QuyKho: 'Quỹ kho (shop tự chịu)', Shop: 'Shop tự chịu', NCC: 'NCC chịu',
  VanChuyen: 'Đơn vị VC chịu', KhachHang: 'Khách hàng chịu'
};

type KhieuNaiDetail = {
  maKN: string;
  ngayTao: string;
  maDH: string;
  maKH: string;
  nguoiTao: string;
  loai: string;
  trangThai: string;
  moTa: string;
  phuongAn: string;
  soTienHoan: number;
  phiDoiTra: number;
  hoanVi: boolean;
  daHoanVi: boolean;
  quyChiuPhi: string;
  doiTacNCC: string;
  maVDTraHang: string;
  chuyenKhoVN: boolean;
  daNhanHangKN: boolean;
  ngayNhanKN: string | null;
  ghiChuXuLy: string;
  anhBangChung: string;
  duyetCap1By: string;
  duyetCap1At: string | null;
  duyetCap2By: string;
  duyetCap2At: string | null;
};

function clickable(ma: string, opener: string) {
  if (!ma) return <span>-</span>;
  return (
    <span
      style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--primary)' }}
      onClick={(e) => { e.stopPropagation?.(); (window as any)[opener]?.(ma); }}
    >{ma}</span>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#64748B' }}>{label}</div>
      <div style={{ fontWeight: 600, fontSize: 13, wordBreak: 'break-word' }}>{children}</div>
    </div>
  );
}

/**
 * Modal chi tiết khiếu nại — mở bằng global `window.openKhieuNaiDetail(maKN)`.
 * Cùng khuôn với CustomerDetailModal / OrderDetailModal. Mã đơn / mã khách trong
 * modal bấm được để mở tiếp (openOrderDetail / openCustomerDetail) — nên trang cần
 * có các host tương ứng, đặt sau host này để nổi lên trên.
 * Handler không có giá vốn/lợi nhuận nên không mask theo vai.
 */
export default function KhieuNaiDetailModalHost() {
  const [data, setData] = useState<KhieuNaiDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const open = useCallback(async (maKN: string) => {
    if (!maKN) return;
    setLoading(true);
    setData(null);
    const res = await callServer('getKhieuNaiDetail', maKN);
    setLoading(false);
    if (res?.success) setData(res.data);
    else if (typeof window !== 'undefined' && (window as any).__showToast) {
      (window as any).__showToast(res?.message || 'Không tải được khiếu nại', 'error');
    }
  }, []);

  useEffect(() => {
    (window as any).openKhieuNaiDetail = open;
    return () => { delete (window as any).openKhieuNaiDetail; };
  }, [open]);

  function close() { setData(null); }

  const anhList = data?.anhBangChung
    ? data.anhBangChung.split(/[\n,]/).map((s) => s.trim()).filter(Boolean)
    : [];

  return (
    <div className={`modal-overlay ${data || loading ? 'show' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal-content" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2><FiAlertTriangle /> Khiếu nại {data?.maKN || ''}</h2>
          <button className="modal-close" onClick={close}><FiX /></button>
        </div>
        <div className="modal-body">
          {loading && <p style={{ textAlign: 'center', color: '#94A3B8' }}>Đang tải...</p>}
          {data && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>Ngày tạo</div>
                  <div style={{ fontWeight: 600 }}>{formatDate(data.ngayTao)}</div>
                </div>
                <span className={`status-badge ${KN_CLASS[data.trangThai as keyof typeof KN_CLASS] || 's-new'}`}>
                  {KN_LABEL[data.trangThai as keyof typeof KN_LABEL] || data.trangThai}
                </span>
              </div>

              <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, marginBottom: 12, display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
                <Field label="Loại khiếu nại"><b>{LOAI_LABEL[data.loai] || data.loai}</b></Field>
                <Field label="Người tạo">{data.nguoiTao || '-'}</Field>
                <Field label="Đơn hàng">{clickable(data.maDH, 'openOrderDetail')}</Field>
                <Field label="Khách hàng">{clickable(data.maKH, 'openCustomerDetail')}</Field>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: '#64748B', marginBottom: 2 }}>Lý do khiếu nại</div>
                <div style={{ padding: 10, background: '#FEF2F2', borderRadius: 6, fontSize: 13, whiteSpace: 'pre-wrap' }}>
                  {data.moTa || '(không có mô tả)'}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 12 }}>
                <Field label="Phương án xử lý">{PHUONG_AN_LABEL[data.phuongAn] || data.phuongAn || '(chưa chọn)'}</Field>
                <Field label="Quỹ chịu phí">{QUY_LABEL[data.quyChiuPhi] || data.quyChiuPhi || '-'}</Field>
                <Field label="Số tiền hoàn"><b style={{ color: '#DC2626' }}>{fmtVND(data.soTienHoan)}đ</b></Field>
                <Field label="Phí đổi trả / khiếu nại">{fmtVND(data.phiDoiTra)}đ</Field>
                <Field label="Hoàn vào ví">{data.hoanVi ? (data.daHoanVi ? '✔ Đã hoàn ví' : 'Có (chưa hoàn)') : 'Không'}</Field>
                {data.doiTacNCC && <Field label="NCC gánh phí">{clickable(data.doiTacNCC, 'openNccDetail')}</Field>}
              </div>

              {(data.maVDTraHang || data.chuyenKhoVN || data.daNhanHangKN || data.ngayNhanKN) && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 12, padding: 10, background: '#F8FAFC', borderRadius: 8 }}>
                  {data.maVDTraHang && <Field label="Mã VĐ khách gửi trả">{clickable(data.maVDTraHang, 'openVanDonDetail')}</Field>}
                  <Field label="Chuyển kho VN">{data.chuyenKhoVN ? 'Có' : 'Không'}</Field>
                  <Field label="Đã nhận hàng trả">{data.daNhanHangKN ? '✔ Đã nhận' : 'Chưa'}</Field>
                  {data.ngayNhanKN && <Field label="Ngày nhận hàng trả">{formatDate(data.ngayNhanKN)}</Field>}
                </div>
              )}

              {data.ghiChuXuLy && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: '#64748B', marginBottom: 2 }}>Hướng xử lý</div>
                  <div style={{ padding: 10, background: '#EFF6FF', borderRadius: 6, fontSize: 13, color: '#1E40AF', whiteSpace: 'pre-wrap' }}>
                    {data.ghiChuXuLy}
                  </div>
                </div>
              )}

              {(data.duyetCap1By || data.duyetCap2By) && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 12, fontSize: 12 }}>
                  {data.duyetCap1By && <Field label="Duyệt cấp 1">{data.duyetCap1By}{data.duyetCap1At ? ` · ${formatDateTime(data.duyetCap1At)}` : ''}</Field>}
                  {data.duyetCap2By && <Field label="Duyệt cấp 2">{data.duyetCap2By}{data.duyetCap2At ? ` · ${formatDateTime(data.duyetCap2At)}` : ''}</Field>}
                </div>
              )}

              {anhList.length > 0 && (
                <div>
                  <div className="icon-inline" style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}><FiImage /> Ảnh bằng chứng</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
                    {anhList.map((src, i) => (
                      <a key={i} href={src} target="_blank" rel="noreferrer">
                        <img src={src} style={{ width: '100%', borderRadius: 6 }} alt={`Bằng chứng ${i + 1}`} />
                      </a>
                    ))}
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
