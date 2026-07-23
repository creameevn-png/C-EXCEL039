'use client';

import { useState } from 'react';
import {
  FiPackage, FiSearch, FiAlertCircle, FiShield, FiAlertTriangle, FiLogIn,
  FiCalendar, FiInbox, FiClock, FiShoppingCart, FiUser, FiHash, FiCheck,
  FiCreditCard, FiTrendingUp, FiXCircle
} from 'react-icons/fi';
import { callServer } from '@/lib/client';
import { formatCurrency, formatDate } from '@/lib/format';
import { statusToLabel } from '@/lib/status';

type Cust = { maKH: string; tenKH: string; sdt: string | null; tuyen: string; soDuVi: number; congNo: number; tongDon: number };
type Ord = { maDH: string; ngayTao: string; tongTien: number; daTra: number; conLai: number; trangThai: string };

const STEPS = ['Cọc', 'Mua', 'Vận chuyển', 'Về VN', 'Giao', 'Xong'];

/** Map trạng thái đơn -> mốc tiến trình (0 = mới tạo, 1..6, -1 = hủy). */
function stageOf(s: string): number {
  switch (s) {
    case 'DatCoc': return 1;
    case 'DaMuaHang': case 'NccGiaoHang': return 2;
    case 'KhoTqNhan': case 'DangVanChuyen': return 3;
    case 'KhoVnNhan': case 'ChoThanhToan': return 4;
    case 'GiaoHang': return 5;
    case 'HoanThanh': return 6;
    case 'Huy': return -1;
    default: return 0;
  }
}

function Stepper({ status }: { status: string }) {
  const stage = stageOf(status);
  if (stage === -1) {
    return <div className="order-cancelled"><FiXCircle /> Đơn đã hủy</div>;
  }
  return (
    <div className="stepper">
      {STEPS.map((label, i) => {
        const k = i + 1;
        const cls = stage > k ? 'done' : stage === k ? 'active' : '';
        return (
          <div key={label} className={`step ${cls}`}>
            <div className="dot">{stage > k ? <FiCheck /> : k}</div>
            <div className="lbl">{label}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function TraCuuPage() {
  const [maKH, setMaKH] = useState('');
  const [sdt4, setSdt4] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [cust, setCust] = useState<Cust | null>(null);
  const [orders, setOrders] = useState<Ord[]>([]);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setCust(null); setOrders([]); setLoading(true);
    const r = await callServer('lookupCustomer', maKH, sdt4);
    setLoading(false);
    if (r?.success) { setCust(r.customer); setOrders(r.orders); }
    else setErr(r?.message || 'Không tra cứu được');
  }

  // Mở chi tiết 1 đơn — gọi endpoint public, xác thực lại bằng maKH + 4 số cuối SĐT
  // mà khách vừa dùng để tra cứu (chỉ xem được đơn của chính mình, không có giá vốn).
  async function openDetail(maDH: string) {
    if (!cust) return;
    setDetail(null); setDetailLoading(true);
    const r = await callServer('getOrderDetailPublic', maDH, cust.maKH, sdt4);
    setDetailLoading(false);
    if (r?.success) setDetail(r.data);
    else setErr(r?.message || 'Không xem được chi tiết đơn');
  }

  return (
    <div className="auth-shell" style={{ alignItems: 'flex-start', padding: '44px 20px' }}>
      <div className="lookup-wrap">
        <div className="lookup-hero">
          <div className="auth-logo"><FiPackage /></div>
          <h1>Tra cứu đơn hàng</h1>
          <p>Hệ thống ship Trung Quốc · Việt Nam</p>
        </div>

        {/* SEARCH */}
        <div className="lookup-card">
          <form onSubmit={onSearch}>
            <div className="lookup-search-grid">
              <div className="form-field">
                <label className="required">Mã khách hàng</label>
                <div className="lookup-input-ic">
                  <FiHash />
                  <input value={maKH} onChange={(e) => setMaKH(e.target.value)} placeholder="VD: KH001" autoFocus style={{ textTransform: 'uppercase' }} />
                </div>
              </div>
              <div className="form-field">
                <label className="required">4 số cuối SĐT</label>
                <div className="lookup-input-ic">
                  <FiShield />
                  <input value={sdt4} onChange={(e) => setSdt4(e.target.value.replace(/\D/g, '').slice(0, 4))} maxLength={4} placeholder="1234" inputMode="numeric" />
                </div>
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', marginTop: 16, padding: 13, fontSize: 14 }}>
              {loading ? <><FiClock /> Đang kiểm tra...</> : <><FiSearch /> Tra cứu đơn hàng</>}
            </button>
          </form>

          {err && <div className="login-error" style={{ marginTop: 14 }}><FiAlertCircle /> {err}</div>}
          <p className="hint icon-inline" style={{ marginTop: 12, justifyContent: 'center', display: 'flex' }}>
            <FiShield /> Bảo mật 2 lớp: Mã KH + 4 số cuối SĐT
          </p>

          <div className="lookup-divider">hoặc</div>
          <a href="/yeu-cau" className="btn btn-success" style={{ width: '100%', padding: 12 }}>
            <FiShoppingCart /> Gửi yêu cầu mua hàng mới
          </a>
        </div>

        {/* RESULT */}
        {cust && (
          <>
            <div className="cust-hero">
              <div className="cust-hero-top">
                <div className="cust-avatar">{(cust.tenKH || '?').charAt(0).toUpperCase()}</div>
                <div>
                  <div className="nm">{cust.tenKH}</div>
                  <div className="sub">{cust.maKH} · {cust.sdt || 'Chưa có SĐT'} · Tuyến {cust.tuyen === 'HCM' ? 'HCM' : 'Hà Nội'}</div>
                </div>
              </div>
              <div className="cust-stats">
                <div className="cust-stat"><div className="k"><FiCreditCard /> Số dư ví</div><div className="v">{formatCurrency(cust.soDuVi)}</div></div>
                <div className="cust-stat"><div className="k"><FiAlertCircle /> Công nợ</div><div className="v">{formatCurrency(cust.congNo)}</div></div>
                <div className="cust-stat"><div className="k"><FiTrendingUp /> Đơn (3 năm)</div><div className="v">{orders.length}</div></div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
              <a href={`/yeu-cau?ma=${cust.maKH}`} className="btn btn-success" style={{ padding: 16 }}><FiShoppingCart /> Mua thêm</a>
              <a href={`/khieu-nai?ma=${cust.maKH}`} className="btn btn-danger" style={{ padding: 16 }}><FiAlertTriangle /> Khiếu nại</a>
              <a href="/login" className="btn btn-primary" style={{ padding: 16 }}><FiLogIn /> Đăng nhập</a>
            </div>

            <div className="lookup-card" style={{ padding: 22 }}>
              <div className="section-title"><FiPackage /> Lịch sử đơn hàng ({orders.length})</div>
              {orders.length === 0 ? (
                <div className="empty-state"><FiInbox /><p>Chưa có đơn nào.</p></div>
              ) : orders.map((o) => (
                <div key={o.maDH} className="order-card">
                  <div className="order-card-head">
                    <div className="oc-left">
                      <div className="ma" style={{ cursor: 'pointer', textDecoration: 'underline' }} title="Bấm xem chi tiết đơn" onClick={() => openDetail(o.maDH)}>{o.maDH}</div>
                      <div className="dt"><FiCalendar /> {formatDate(o.ngayTao)}</div>
                    </div>
                    <span className="role-badge" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}>
                      {statusToLabel(o.trangThai)}
                    </span>
                  </div>
                  <div className="order-money">
                    <div><div className="m-k">Tổng tiền</div><div className="m-v">{formatCurrency(o.tongTien)}</div></div>
                    <div><div className="m-k">Đã trả</div><div className="m-v text-success">{formatCurrency(o.daTra)}</div></div>
                    <div><div className="m-k">Còn lại</div><div className="m-v" style={{ color: o.conLai > 0 ? 'var(--danger-dark)' : 'var(--success-dark)' }}>{formatCurrency(o.conLai)}</div></div>
                  </div>
                  <Stepper status={o.trangThai} />
                </div>
              ))}
            </div>
          </>
        )}

        {/* Chi tiết 1 đơn — phía khách, KHÔNG có giá vốn/lợi nhuận */}
        <div className={`modal-overlay ${detail || detailLoading ? 'show' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setDetail(null); }}>
          <div className="modal-content" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2><FiPackage /> Đơn {detail?.maDH || ''}</h2>
              <button className="modal-close" onClick={() => setDetail(null)}><FiXCircle /></button>
            </div>
            <div className="modal-body">
              {detailLoading && <p style={{ textAlign: 'center', color: '#94A3B8' }}>Đang tải...</p>}
              {detail && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: '#64748B' }}>Ngày tạo: <b>{formatDate(detail.ngayTao)}</b></div>
                    <span className="role-badge" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}>{statusToLabel(detail.trangThai)}</span>
                  </div>
                  <div style={{ background: '#F8FAFC', padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 12, color: '#64748B' }}>
                    Tuyến: <b>{detail.tuyen === 'HCM' ? 'HCM' : 'Hà Nội'}</b> · Line: <b>{detail.lineVC}</b> · Loại: <b>{detail.loaiHang}</b>
                    {detail.maVD && <> · Mã VĐ: <b>{detail.maVD}</b></>}
                  </div>
                  <table className="data-table" style={{ fontSize: 12 }}>
                    <thead><tr><th>#</th><th>Sản phẩm</th><th className="number">SL</th><th className="number">Kg</th><th className="number">m³</th><th className="number">Thành tiền</th></tr></thead>
                    <tbody>
                      {detail.chiTiet.map((c: any) => (
                        <tr key={c.stt}>
                          <td>{c.stt}</td>
                          <td>{c.tenSP}{c.linkTaobao && <a href={c.linkTaobao} target="_blank" style={{ marginLeft: 6, color: 'var(--primary)' }}>↗</a>}</td>
                          <td className="number">{c.soLuong}</td>
                          <td className="number">{c.kg}</td>
                          <td className="number">{c.m3}</td>
                          <td className="number">{formatCurrency(c.thanhTien)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ textAlign: 'right', fontSize: 12, color: '#64748B', marginTop: 4 }}>Tổng: <b>{detail.tongKg.toFixed(2)}kg / {detail.tongM3.toFixed(4)}m³</b></div>

                  <div className="fee-summary" style={{ marginTop: 12 }}>
                    <div className="fee-row"><span>Tổng giá hàng</span><span className="fee-value">{formatCurrency(detail.tongGiaHang)}</span></div>
                    <div className="fee-row"><span>Phí mua hàng</span><span className="fee-value">{formatCurrency(detail.phiMua)}</span></div>
                    <div className="fee-row"><span>Phí vận chuyển</span><span className="fee-value">{formatCurrency(detail.phiVC)}</span></div>
                    {detail.shipND > 0 && <div className="fee-row"><span>Phí ship VN</span><span className="fee-value">{formatCurrency(detail.shipND)}</span></div>}
                    {detail.dongGo > 0 && <div className="fee-row"><span>Phí đóng gỗ</span><span className="fee-value">{formatCurrency(detail.dongGo)}</span></div>}
                    {(detail.phiKiemDem || 0) > 0 && <div className="fee-row"><span>Phí kiểm đếm</span><span className="fee-value">{formatCurrency(detail.phiKiemDem || 0)}</span></div>}
                    {detail.phuThu > 0 && <div className="fee-row"><span>Phụ thu</span><span className="fee-value">{formatCurrency(detail.phuThu)}</span></div>}
                    {detail.phiBH > 0 && <div className="fee-row"><span>Bảo hiểm</span><span className="fee-value">{formatCurrency(detail.phiBH)}</span></div>}
                    {detail.phiPhatSinh > 0 && <div className="fee-row"><span>Phí phát sinh</span><span className="fee-value">{formatCurrency(detail.phiPhatSinh)}</span></div>}
                    {detail.phiKhieuNai > 0 && <div className="fee-row"><span>Phí đổi trả</span><span className="fee-value">{formatCurrency(detail.phiKhieuNai)}</span></div>}
                    {detail.thueNK > 0 && <div className="fee-row"><span>Thuế NK</span><span className="fee-value">{formatCurrency(detail.thueNK)}</span></div>}
                    {detail.vat > 0 && <div className="fee-row"><span>VAT</span><span className="fee-value">{formatCurrency(detail.vat)}</span></div>}
                    <div className="fee-row" style={{ borderTop: '1px solid #CBD5E1' }}><span><b>Tổng tiền</b></span><span className="fee-value" style={{ color: '#1E3A8A' }}>{formatCurrency(detail.tongTien)}</span></div>
                    <div className="fee-row"><span>Cọc ({detail.pctCoc}%)</span><span className="fee-value" style={{ color: '#92400E' }}>{formatCurrency(detail.tienCoc)}</span></div>
                    <div className="fee-row"><span>Đã trả</span><span className="fee-value" style={{ color: '#059669' }}>{formatCurrency(detail.daTra)}</span></div>
                    <div className="fee-row"><span><b>Còn lại</b></span><span className="fee-value" style={{ color: detail.conLai > 0 ? '#DC2626' : '#059669' }}>{formatCurrency(detail.conLai)}</span></div>
                  </div>

                  {detail.payments.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Lịch sử thanh toán</div>
                      <table className="data-table" style={{ fontSize: 12 }}>
                        <thead><tr><th>Ngày</th><th className="number">Số tiền</th><th>Ghi chú</th></tr></thead>
                        <tbody>{detail.payments.map((p: any, i: number) => (<tr key={i}><td>{formatDate(p.ngay)}</td><td className="number">{formatCurrency(p.soTien)}</td><td>{p.ghiChu || ''}</td></tr>))}</tbody>
                      </table>
                    </div>
                  )}

                  {(detail.anh.khoTQ || detail.anh.roiTQ || detail.anh.khoVN || detail.anh.giaoKH) && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Ảnh xử lý</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
                        {detail.anh.khoTQ && <div><div style={{ fontSize: 11, color: '#64748B' }}>Nhận tại Kho TQ</div><img src={detail.anh.khoTQ} style={{ width: '100%', borderRadius: 6 }} /></div>}
                        {detail.anh.roiTQ && <div><div style={{ fontSize: 11, color: '#64748B' }}>Rời TQ</div><img src={detail.anh.roiTQ} style={{ width: '100%', borderRadius: 6 }} /></div>}
                        {detail.anh.khoVN && <div><div style={{ fontSize: 11, color: '#64748B' }}>Nhận tại Kho VN</div><img src={detail.anh.khoVN} style={{ width: '100%', borderRadius: 6 }} /></div>}
                        {detail.anh.giaoKH && <div><div style={{ fontSize: 11, color: '#64748B' }}>Đã giao</div><img src={detail.anh.giaoKH} style={{ width: '100%', borderRadius: 6 }} /></div>}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: 11.5, marginTop: 22 }}>
          Powered by Excel Khởi Nghiệp · <a href="/login" style={{ color: 'rgba(255,255,255,0.9)' }}>Đăng nhập nhân viên</a>
        </p>
      </div>
    </div>
  );
}
