import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import AppShell from '@/components/AppShell';
import OrderDetailModalHost from '@/components/OrderDetailModal';
import { formatCurrency, formatDate } from '@/lib/format';
import { statusToClass, statusToLabel } from '@/lib/status';
import { FiInbox, FiShoppingCart, FiAlertTriangle, FiPackage, FiUser } from 'react-icons/fi';

export const dynamic = 'force-dynamic';

export default async function CustomerPage() {
  const user = await requireRole(['Customer']);
  const kh = await prisma.khachHang.findFirst({ where: { email: user.email } });

  if (!kh) {
    return (
      <AppShell user={user} subtitle="Tài khoản chưa liên kết">
        <div className="form-section">
          <div className="empty-state">
            <FiInbox />
            <h2 style={{ marginTop: 10 }}>Chưa có thông tin khách hàng</h2>
            <p style={{ marginTop: 8 }}>
              Tài khoản {user.email} chưa liên kết với mã KH. Vui lòng liên hệ CSKH để được cập nhật.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  const orders = await prisma.donHang.findMany({
    where: { maKH: kh.maKH },
    orderBy: { ngayTao: 'desc' },
    take: 100
  });

  return (
    <AppShell user={user} subtitle={`${kh.maKH} - ${kh.tenKH}`}>
      <div className="form-section" style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', color: 'white', border: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 30, display: 'flex' }}><FiUser /></span>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{kh.tenKH}</div>
            <div style={{ fontSize: 13, opacity: 0.9 }}>{kh.maKH} · {kh.sdt || '-'} · Tuyến {kh.tuyen === 'HCM' ? 'HCM' : 'Hà Nội'}</div>
          </div>
        </div>
        <div className="kpi-row" style={{ marginTop: 18, marginBottom: 0 }}>
          {[
            ['Số dư ví', formatCurrency(kh.soDuVi)],
            ['Công nợ', formatCurrency(kh.congNo)],
            ['Tổng đơn', String(orders.length)],
            ['Doanh thu', formatCurrency(kh.doanhThu)]
          ].map(([label, val]) => (
            <div key={label} className="kpi" style={{ background: 'rgba(255,255,255,0.16)', border: 'none', color: 'white' }}>
              <div className="kpi-label" style={{ color: 'rgba(255,255,255,0.85)' }}>{label}</div>
              <div className="kpi-value" style={{ color: 'white' }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <a href={`/yeu-cau?ma=${kh.maKH}`} className="btn btn-success" style={{ padding: 18, fontSize: 14 }}>
          <FiShoppingCart /> Yêu cầu mua hàng mới
        </a>
        <a href={`/khieu-nai?ma=${kh.maKH}`} className="btn btn-danger" style={{ padding: 18, fontSize: 14 }}>
          <FiAlertTriangle /> Gửi khiếu nại
        </a>
      </div>

      <div className="form-section">
        <div className="section-title"><FiPackage /> Đơn hàng của tôi ({orders.length})</div>
        {orders.length === 0 ? (
          <div className="empty-state"><FiInbox /><p>Chưa có đơn nào.</p></div>
        ) : (
          <table className="data-table">
            <thead><tr>
              <th>Mã đơn</th><th>Ngày</th>
              <th className="number">Tổng</th><th className="number">Đã trả</th><th className="number">Còn lại</th>
              <th>Trạng thái</th>
            </tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.maDH}>
                  <td className="ma-don" style={{ cursor: 'pointer', textDecoration: 'underline' }}>
                    <span onClick={() => (window as any).openOrderDetail?.(o.maDH)}>{o.maDH}</span>
                  </td>
                  <td>{formatDate(o.ngayTao)}</td>
                  <td className="number">{formatCurrency(o.tongTien)}</td>
                  <td className="number text-success">{formatCurrency(o.daTra)}</td>
                  <td className="number" style={{ color: o.conLai > 0 ? 'var(--danger-dark)' : 'var(--success-dark)', fontWeight: o.conLai > 0 ? 600 : 400 }}>
                    {formatCurrency(o.conLai)}
                  </td>
                  <td><span className={`status-badge ${statusToClass(o.trangThai)}`}>{statusToLabel(o.trangThai)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <OrderDetailModalHost canSeeMoney={true} />
    </AppShell>
  );
}
