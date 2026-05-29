import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import AppShell from '@/components/AppShell';
import { formatDateTime } from '@/lib/format';
import { FiFileText } from 'react-icons/fi';

export const dynamic = 'force-dynamic';

export default async function AdminAuditLogPage() {
  const user = await requireRole(['Admin']);
  const logs = await prisma.hoatDong.findMany({ orderBy: { ngay: 'desc' }, take: 500 });

  return (
    <AppShell user={user} subtitle={`${logs.length} bản ghi gần nhất`}>
      <div className="form-section">
        <div className="section-title"><FiFileText /> Hoạt động ({logs.length} gần nhất)</div>
        <table className="data-table">
          <thead><tr><th>Thời gian</th><th>User</th><th>Hành động</th><th>Đối tượng</th><th>Chi tiết</th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td>{formatDateTime(l.ngay)}</td>
                <td>{l.email || '-'}</td>
                <td><span className="status-badge s-bought">{l.hanhDong}</span></td>
                <td className="ma-don">{l.doiTuong || '-'}</td>
                <td style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 400, wordBreak: 'break-all' }}>{l.chiTiet || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
