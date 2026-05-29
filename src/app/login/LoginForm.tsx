'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiAlertCircle, FiLogIn } from 'react-icons/fi';

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    setLoading(false);
    const data = await res.json();
    if (data.success && data.redirect) {
      router.push(data.redirect);
      router.refresh();
    } else {
      setErr(data.message || 'Đăng nhập thất bại');
    }
  }

  return (
    <form onSubmit={onSubmit}>
      {err && <div className="login-error"><FiAlertCircle /> {err}</div>}
      <div className="form-field">
        <label className="required">Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
      </div>
      <div className="form-field">
        <label className="required">Mật khẩu</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: 8 }}>
        {loading ? 'Đang xác thực...' : <><FiLogIn /> Đăng nhập</>}
      </button>
      <div className="hint" style={{ marginTop: 12, textAlign: 'center' }}>
        Tài khoản mặc định (seed): admin@cu.vn / 123456
      </div>
    </form>
  );
}
