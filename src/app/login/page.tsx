import { redirect } from 'next/navigation';
import { FiPackage, FiAlertCircle, FiSearch, FiShoppingCart } from 'react-icons/fi';
import { getSession, roleHomePath } from '@/lib/auth';
import LoginForm from './LoginForm';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const u = await getSession();
  if (u) redirect(roleHomePath(u.vaiTro));
  const sp = await searchParams;
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-logo"><FiPackage /></div>
        <h1>{process.env.APP_NAME || 'Cừ EXCEL039'}</h1>
        <p className="subtitle">Đăng nhập hệ thống ERP Ship TQ · VN</p>
        {sp.error === 'blocked' && (
          <div className="login-error"><FiAlertCircle /> Tài khoản đang bị tạm khóa. Liên hệ Admin.</div>
        )}
        <LoginForm />
        <div style={{ marginTop: 18, textAlign: 'center', fontSize: 12.5, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <a href="/tra-cuu" className="icon-inline" style={{ color: 'var(--primary)', fontWeight: 600 }}>
            <FiSearch /> Tra cứu công khai (không cần đăng nhập)
          </a>
          <div style={{ marginTop: 10 }}>
            <a href="/yeu-cau" className="icon-inline" style={{ color: 'var(--success-dark)', fontWeight: 600 }}>
              <FiShoppingCart /> Gửi yêu cầu mua hàng
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
