import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import AppShell from '@/components/AppShell';
import { formatCurrency } from '@/lib/format';
import {
  FiShoppingBag, FiClock, FiDollarSign, FiAlertTriangle, FiUsers, FiBox,
  FiUserCheck, FiBriefcase, FiTrendingUp, FiShoppingCart,
  FiPackage, FiTruck, FiUser, FiGrid, FiSettings, FiFileText, FiLogIn, FiInbox
} from 'react-icons/fi';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const user = await requireRole(['Admin']);

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

  const [orders, customers, products, employees, openOrders, doanhThuToday, knCho, ycCho] = await Promise.all([
    prisma.donHang.count(),
    prisma.khachHang.count(),
    prisma.sanPham.count(),
    prisma.nhanVien.count(),
    prisma.donHang.count({ where: { trangThai: { notIn: ['HoanThanh', 'Huy'] } } }),
    prisma.donHang.aggregate({
      where: { trangThai: 'HoanThanh', updatedAt: { gte: todayStart } },
      _sum: { tongTien: true }
    }),
    prisma.khieuNai.count({ where: { trangThai: { notIn: ['DaXuLy', 'TuChoi'] } } }),
    prisma.yeuCauMua.count({ where: { trangThai: 'ChoXuLy' } })
  ]);

  const rolePages = [
    { href: '/cskh', Icon: FiBriefcase, bg: '#4f46e5', title: 'Trang CSKH', desc: 'Tạo đơn · KH · ví' },
    { href: '/gdv', Icon: FiTrendingUp, bg: '#0891b2', title: 'GDV / Mua hàng', desc: 'Mã GD · mã VĐ · vốn' },
    { href: '/ketoan', Icon: FiDollarSign, bg: '#f59e0b', title: 'Kế toán', desc: 'Xác nhận TT' },
    { href: '/mua-hang', Icon: FiShoppingCart, bg: '#7c3aed', title: 'Nguồn hàng & NCC', desc: 'Thuộc GDV / Mua hàng' },
    { href: '/khotq', Icon: FiPackage, bg: '#0f766e', title: 'Kho TQ', desc: 'NCC · chuyển VN' },
    { href: '/khovn', Icon: FiTruck, bg: '#16a34a', title: 'Kho VN', desc: 'Giao khách' },
    { href: '/customer', Icon: FiUser, bg: '#ec4899', title: 'Customer', desc: 'Khách tự theo dõi' }
  ];

  const adminPages = [
    { href: '/admin/yeu-cau', Icon: FiInbox, bg: '#0ea5e9', title: 'Yêu cầu mua', desc: 'Khách gửi yêu cầu' },
    { href: '/admin/don-hang', Icon: FiShoppingBag, bg: '#4f46e5', title: 'Đơn hàng', desc: 'Tất cả đơn' },
    { href: '/admin/khach-hang', Icon: FiUsers, bg: '#7c3aed', title: 'Khách hàng', desc: 'Quản lý KH' },
    { href: '/admin/san-pham', Icon: FiBox, bg: '#10b981', title: 'Sản phẩm', desc: 'DB SP' },
    { href: '/admin/users', Icon: FiUserCheck, bg: '#f59e0b', title: 'Nhân viên', desc: 'Tài khoản + role' },
    { href: '/admin/khieu-nai', Icon: FiAlertTriangle, bg: '#dc2626', title: 'Khiếu nại', desc: 'Xử lý + duyệt' },
    { href: '/admin/bang-gia', Icon: FiDollarSign, bg: '#0891b2', title: 'Bảng giá', desc: '3 line VC' },
    { href: '/admin/cai-dat', Icon: FiSettings, bg: '#64748b', title: 'Cài đặt', desc: 'Tỷ giá · phí' },
    { href: '/admin/audit-log', Icon: FiFileText, bg: '#475569', title: 'Audit log', desc: 'Lịch sử hoạt động' }
  ];

  return (
    <AppShell user={user}>
      <div className="alert alert-info">
        <FiGrid />
        <span>Bạn là <b>Admin</b> — toàn quyền hệ thống. Nhớ đổi mật khẩu mặc định sau khi bàn giao.</span>
      </div>

      <div className="kpi-row">
        <div className="kpi"><div className="kpi-label"><FiShoppingBag /> Tổng đơn</div><div className="kpi-value">{orders}</div></div>
        <div className="kpi" style={{ ['--primary' as any]: '#f59e0b' }}><div className="kpi-label"><FiClock /> Đang xử lý</div><div className="kpi-value">{openOrders}</div></div>
        <div className="kpi" style={{ ['--primary' as any]: '#10b981' }}><div className="kpi-label"><FiDollarSign /> DT hôm nay</div><div className="kpi-value" style={{ fontSize: 20 }}>{formatCurrency(doanhThuToday._sum.tongTien || 0)}</div></div>
        <div className="kpi" style={{ ['--primary' as any]: '#0ea5e9' }}><div className="kpi-label"><FiInbox /> YC mua chờ</div><div className="kpi-value">{ycCho}</div></div>
      </div>

      <div className="kpi-row">
        <div className="kpi" style={{ ['--primary' as any]: '#dc2626' }}><div className="kpi-label"><FiAlertTriangle /> Khiếu nại chờ</div><div className="kpi-value">{knCho}</div></div>
        <div className="kpi" style={{ ['--primary' as any]: '#7c3aed' }}><div className="kpi-label"><FiUsers /> Khách hàng</div><div className="kpi-value">{customers}</div></div>
        <div className="kpi" style={{ ['--primary' as any]: '#0891b2' }}><div className="kpi-label"><FiBox /> Sản phẩm</div><div className="kpi-value">{products}</div></div>
        <div className="kpi" style={{ ['--primary' as any]: '#16a34a' }}><div className="kpi-label"><FiUserCheck /> Nhân viên</div><div className="kpi-value">{employees}</div></div>
      </div>

      <div className="form-section">
        <div className="section-title"><FiLogIn /> Đi vào các trang vai trò</div>
        <div className="admin-grid">
          {rolePages.map((l) => {
            const Icon = l.Icon;
            return (
              <a key={l.href} href={l.href} className="admin-link">
                <div className="ic" style={{ background: l.bg }}><Icon /></div>
                <h3>{l.title}</h3><p>{l.desc}</p>
              </a>
            );
          })}
        </div>
      </div>

      <div className="form-section">
        <div className="section-title"><FiSettings /> Trang quản trị</div>
        <div className="admin-grid">
          {adminPages.map((l) => {
            const Icon = l.Icon;
            return (
              <a key={l.href} href={l.href} className="admin-link">
                <div className="ic" style={{ background: l.bg }}><Icon /></div>
                <h3>{l.title}</h3><p>{l.desc}</p>
              </a>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
