import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import AppShell from '@/components/AppShell';
import { formatCurrency } from '@/lib/format';
import { LINE_LABEL } from '@/lib/status';
import type { LineVC } from '@prisma/client';
import { FiInfo, FiCheckCircle, FiXCircle, FiDollarSign } from 'react-icons/fi';

export const dynamic = 'force-dynamic';

export default async function AdminBangGiaPage() {
  const user = await requireRole(['Admin']);
  const rows = await prisma.bangGia.findMany({ orderBy: [{ line: 'asc' }, { loaiHang: 'asc' }] });

  const byLine: Record<string, typeof rows> = {};
  for (const r of rows) (byLine[r.line] ||= [] as any).push(r);

  return (
    <AppShell user={user}>
      <div className="alert alert-info">
        <FiInfo />
        <span>Sửa giá trực tiếp DB (bảng <code>bang_gia</code>). UI CRUD đang phát triển — hiện chỉ liệt kê.</span>
      </div>
      {(Object.entries(byLine) as Array<[LineVC, typeof rows]>).map(([line, list]) => (
        <div key={line} className="form-section">
          <div className="section-title"><FiDollarSign /> {LINE_LABEL[line]} ({list.length} loại)</div>
          <table className="data-table">
            <thead><tr>
              <th>Loại hàng</th>
              <th className="number">Giá kg &lt;5</th>
              <th className="number">Giá kg 5-20</th>
              <th className="number">Giá kg &gt;20</th>
              <th className="number">Giá m³</th>
              <th className="number">Phí phụ %</th>
              <th>Thời gian</th>
              <th>Hoạt động</th>
            </tr></thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td><b>{r.loaiHang}</b></td>
                  <td className="number">{formatCurrency(r.giaKgDuoi5)}</td>
                  <td className="number">{formatCurrency(r.giaKg5To20)}</td>
                  <td className="number">{formatCurrency(r.giaKgTren20)}</td>
                  <td className="number">{formatCurrency(r.giaM3)}</td>
                  <td className="number">{r.phiPhuPct}%</td>
                  <td>{r.thoiGianDuKien}</td>
                  <td>{r.hoatDong
                    ? <FiCheckCircle style={{ color: 'var(--success)' }} />
                    : <FiXCircle style={{ color: 'var(--danger-dark)' }} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </AppShell>
  );
}
