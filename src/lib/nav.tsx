import type { VaiTro } from '@prisma/client';
import type { IconType } from 'react-icons';
import {
  FiGrid, FiShoppingBag, FiUsers, FiBox, FiUserCheck, FiAlertTriangle,
  FiDollarSign, FiSettings, FiFileText, FiBriefcase, FiTrendingUp,
  FiShoppingCart, FiPackage, FiTruck, FiUser, FiPlusCircle, FiTag, FiSearch, FiInbox, FiBarChart2
} from 'react-icons/fi';

export type NavItem = { href: string; label: string; Icon: IconType };
export type NavGroup = { label?: string; items: NavItem[] };

/* Central registry: route -> { label, icon } so topbar + sidebar stay in sync */
export const PAGE_META: Record<string, { label: string; subtitle: string; Icon: IconType }> = {
  '/admin': { label: 'Bảng điều khiển', subtitle: 'Quản trị toàn hệ thống', Icon: FiGrid },
  '/admin/don-hang': { label: 'Đơn hàng', subtitle: 'Tất cả đơn trong hệ thống', Icon: FiShoppingBag },
  '/admin/khach-hang': { label: 'Khách hàng', subtitle: 'Doanh thu · công nợ · ví', Icon: FiUsers },
  '/admin/san-pham': { label: 'Sản phẩm', subtitle: 'Database sản phẩm', Icon: FiBox },
  '/admin/users': { label: 'Nhân viên', subtitle: 'Tài khoản · vai trò · trạng thái', Icon: FiUserCheck },
  '/admin/yeu-cau': { label: 'Yêu cầu mua', subtitle: 'Khách gửi yêu cầu order', Icon: FiInbox },
  '/admin/khieu-nai': { label: 'Khiếu nại', subtitle: 'Xử lý · duyệt 2 tầng', Icon: FiAlertTriangle },
  '/admin/bang-gia': { label: 'Bảng giá', subtitle: '3 line vận chuyển × loại hàng', Icon: FiDollarSign },
  '/admin/cai-dat': { label: 'Cài đặt', subtitle: 'Tỷ giá · phí · thông tin DN', Icon: FiSettings },
  '/admin/audit-log': { label: 'Audit log', subtitle: 'Lịch sử hoạt động hệ thống', Icon: FiFileText },
  '/bao-cao': { label: 'Báo cáo', subtitle: 'Sản lượng · doanh thu · KQKD theo tháng/quý', Icon: FiBarChart2 },
  '/cskh': { label: 'Chăm sóc khách hàng', subtitle: 'Tạo đơn · khách hàng · ví', Icon: FiBriefcase },
  '/gdv': { label: 'Giao dịch viên', subtitle: 'Mã giao dịch · mã vận đơn', Icon: FiTrendingUp },
  '/ketoan': { label: 'Kế toán', subtitle: 'Xác nhận thanh toán · sổ thu chi', Icon: FiDollarSign },
  '/mua-hang': { label: 'Mua hàng', subtitle: 'Nguồn hàng · nhà cung cấp', Icon: FiShoppingCart },
  '/khotq': { label: 'Kho Trung Quốc', subtitle: 'Nhận từ NCC · chuyển về VN', Icon: FiPackage },
  '/khovn': { label: 'Kho Việt Nam', subtitle: 'Nhận từ TQ · giao khách', Icon: FiTruck },
  '/customer': { label: 'Khách hàng', subtitle: 'Theo dõi đơn của bạn', Icon: FiUser },
  '/dat-hang': { label: 'Đặt đơn hàng', subtitle: 'Tạo đơn nhanh', Icon: FiPlusCircle },
  '/in-tem': { label: 'In tem', subtitle: 'Dán lên kiện hàng', Icon: FiTag },
  '/yeu-cau': { label: 'Yêu cầu mua hàng', subtitle: 'Gửi yêu cầu order', Icon: FiShoppingCart }
};

function item(href: string): NavItem {
  const m = PAGE_META[href];
  return { href, label: m.label, Icon: m.Icon };
}

const ADMIN_MAIN: NavItem[] = [
  item('/admin'), item('/admin/don-hang'), item('/admin/yeu-cau'), item('/admin/khach-hang'),
  item('/admin/san-pham'), item('/admin/users'), item('/admin/khieu-nai'),
  item('/admin/bang-gia'), item('/bao-cao'), item('/admin/cai-dat'), item('/admin/audit-log')
];

const ADMIN_OPS: NavItem[] = [
  item('/cskh'), item('/gdv'), item('/ketoan'),
  item('/mua-hang'), item('/khotq'), item('/khovn')
];

/** Sidebar groups for a given role. Admin sees everything. */
export function navForRole(role: VaiTro): NavGroup[] {
  switch (role) {
    case 'Admin':
      return [
        { label: 'Quản trị', items: ADMIN_MAIN },
        { label: 'Vận hành', items: ADMIN_OPS }
      ];
    case 'CSKH':
      return [{
        items: [
          item('/cskh'), item('/admin/yeu-cau'), item('/admin/khach-hang'),
          item('/admin/san-pham'), item('/admin/khieu-nai'), item('/in-tem')
        ]
      }];
    case 'GDV':
      return [{ items: [item('/gdv')] }];
    case 'KeToan':
      return [{ items: [item('/ketoan'), item('/bao-cao'), item('/admin/khach-hang'), item('/admin/khieu-nai')] }];
    case 'MuaHang':
      return [{ items: [item('/mua-hang'), item('/admin/san-pham')] }];
    case 'KhoTQ':
      return [{ items: [item('/khotq'), item('/in-tem')] }];
    case 'KhoVN':
      return [{ items: [item('/khovn'), item('/in-tem')] }];
    case 'Customer':
      return [{ items: [item('/customer'), item('/dat-hang')] }];
    default:
      return [];
  }
}

/** Resolve the meta for the topbar given a pathname (longest-prefix match). */
export function pageMetaFor(pathname: string): { label: string; subtitle: string; Icon: IconType } {
  if (PAGE_META[pathname]) return PAGE_META[pathname];
  const keys = Object.keys(PAGE_META).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (pathname.startsWith(k + '/')) return PAGE_META[k];
  }
  return { label: 'Cừ EXCEL039', subtitle: '', Icon: FiSearch };
}

export { FiSearch };
