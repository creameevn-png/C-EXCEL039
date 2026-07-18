import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import AppShell from '@/components/AppShell';
import { formatDateTime } from '@/lib/format';
import { FiFileText, FiSearch } from 'react-icons/fi';

export const dynamic = 'force-dynamic';

// Nhãn tiếng Việt cho các mã hành động (mã lạ chưa map thì hiện nguyên mã).
const ACTION_LABELS: Record<string, string> = {
  KHO_TQ_NHAN: 'Kho TQ nhận hàng',
  KHO_VN_NHAN: 'Kho VN nhận hàng',
  SUA_KG: 'Sửa cân/khối',
  CHUYEN_TRANG_THAI: 'Chuyển trạng thái',
  SUA_DON: 'Sửa đơn',
  TAO_DON: 'Tạo đơn',
  UPDATE_CUSTOMER: 'Sửa khách hàng',
  CREATE_CUSTOMER: 'Thêm khách hàng',
  CANCEL_ORDER: 'Hủy đơn',
  CONFIRM_PAYMENT: 'Xác nhận thanh toán',
  DAT_COC: 'Đặt cọc',
  MUA_HANG: 'Mua hàng',
  GAN_GDV: 'Gán người xử lý',
  DANG_NHAP: 'Đăng nhập',
  DOI_MAT_KHAU: 'Đổi mật khẩu',
  TAO_NHAN_VIEN: 'Thêm nhân viên',
  SUA_NHAN_VIEN: 'Sửa nhân viên',
};

function actionLabel(ma: string): string {
  return ACTION_LABELS[ma] || ma;
}

// Tên trường -> nhãn tiếng Việt cho cột "Thay đổi".
const FIELD_LABELS: Record<string, string> = {
  trangThai: 'Trạng thái',
  tongTien: 'Tổng tiền',
  conLai: 'Còn lại',
  canNang: 'Cân nặng',
  khoiLuong: 'Khối lượng',
  soKg: 'Số cân',
  soKhoi: 'Số khối',
  ghiChu: 'Ghi chú',
  tuyen: 'Tuyến',
  lineVC: 'Line vận chuyển',
  shipND: 'Ship nội địa',
  dongGo: 'Đóng gỗ',
  phuThu: 'Phụ thu',
  pctCoc: 'Phần trăm cọc',
  tenKH: 'Tên khách',
  sdt: 'Số điện thoại',
  diaChi: 'Địa chỉ',
};

function fieldLabel(k: string): string {
  return FIELD_LABELS[k] || k;
}

// Hiển thị giá trị an toàn (object -> JSON gọn, null -> '(trống)').
function showVal(v: any): string {
  if (v === null || v === undefined || v === '') return '(trống)';
  if (typeof v === 'object') {
    try { return JSON.stringify(v); } catch { return String(v); }
  }
  return String(v);
}

type ChangeRow = { field: string; truoc: any; sau: any };

// Phân tích chiTiet an toàn: trả về danh sách thay đổi {truoc,sau} và phần còn lại (raw).
function parseChiTiet(chiTiet: string | null): { changes: ChangeRow[]; raw: string | null } {
  if (!chiTiet) return { changes: [], raw: null };
  let obj: any;
  try {
    obj = JSON.parse(chiTiet);
  } catch {
    // Không phải JSON -> hiện nguyên chuỗi.
    return { changes: [], raw: chiTiet };
  }
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return { changes: [], raw: chiTiet };
  }
  const changes: ChangeRow[] = [];
  const rest: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && ('truoc' in v || 'sau' in v)) {
      changes.push({ field: k, truoc: (v as any).truoc, sau: (v as any).sau });
    } else {
      rest[k] = v;
    }
  }
  const raw = Object.keys(rest).length ? JSON.stringify(rest) : null;
  return { changes, raw };
}

export default async function AdminAuditLogPage({ searchParams }: { searchParams: Promise<{ maDH?: string }> }) {
  const user = await requireRole(['Admin']);
  const sp = await searchParams;
  const maDH = (sp.maDH || '').trim();

  const where: any = {};
  if (maDH) where.doiTuong = { contains: maDH };

  const logs = await prisma.hoatDong.findMany({ where, orderBy: { ngay: 'desc' }, take: 500 });

  return (
    <AppShell user={user} subtitle={`${logs.length} bản ghi gần nhất`}>
      <div className="form-section">
        <div className="section-title"><FiFileText /> Hoạt động ({logs.length} gần nhất)</div>

        <form method="get" style={{ marginBottom: 14, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            name="maDH"
            defaultValue={maDH}
            placeholder="Lọc theo mã đơn / đối tượng…"
            style={{ maxWidth: 260 }}
          />
          <button type="submit" className="btn btn-sm"><FiSearch /> Lọc</button>
          {maDH && <a href="/admin/audit-log" className="btn btn-sm">Xóa lọc</a>}
        </form>

        <table className="data-table">
          <thead><tr><th>Thời gian</th><th>Người</th><th>Hành động</th><th>Đơn/đối tượng</th><th>Thay đổi</th></tr></thead>
          <tbody>
            {logs.map((l) => {
              const { changes, raw } = parseChiTiet(l.chiTiet);
              return (
                <tr key={l.id}>
                  <td>{formatDateTime(l.ngay)}</td>
                  <td>{l.email || '-'}</td>
                  <td><span className="status-badge s-bought">{actionLabel(l.hanhDong)}</span></td>
                  <td className="ma-don">{l.doiTuong || '-'}</td>
                  <td style={{ fontSize: 12, maxWidth: 460 }}>
                    {changes.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {changes.map((c, i) => (
                          <div key={i} style={{ wordBreak: 'break-word' }}>
                            <span style={{ fontWeight: 600 }}>{fieldLabel(c.field)}:</span>{' '}
                            <span style={{ color: 'var(--text-muted)' }}>{showVal(c.truoc)}</span>
                            {' → '}
                            <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{showVal(c.sau)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {raw && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', wordBreak: 'break-all', marginTop: changes.length ? 4 : 0 }}>
                        {raw}
                      </div>
                    )}
                    {changes.length === 0 && !raw && <span style={{ color: 'var(--text-muted)' }}>-</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
