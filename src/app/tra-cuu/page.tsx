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

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setCust(null); setOrders([]); setLoading(true);
    const r = await callServer('lookupCustomer', maKH, sdt4);
    setLoading(false);
    if (r?.success) { setCust(r.customer); setOrders(r.orders); }
    else setErr(r?.message || 'Không tra cứu được');
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
                      <div className="ma">{o.maDH}</div>
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

        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: 11.5, marginTop: 22 }}>
          Powered by Excel Khởi Nghiệp · <a href="/login" style={{ color: 'rgba(255,255,255,0.9)' }}>Đăng nhập nhân viên</a>
        </p>
      </div>
    </div>
  );
}
