'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { FiLogOut, FiMenu, FiPackage } from 'react-icons/fi';
import type { SessionUser } from '@/lib/auth';
import type { VaiTro } from '@prisma/client';
import { navForRole, pageMetaFor } from '@/lib/nav';

const ROLE_BADGE: Record<VaiTro, { label: string; bg: string; color: string }> = {
  Admin: { label: 'ADMIN', bg: '#fee2e2', color: '#991b1b' },
  CSKH: { label: 'CSKH', bg: '#dbeafe', color: '#1e40af' },
  GDV: { label: 'GDV', bg: '#cffafe', color: '#155e75' },
  KeToan: { label: 'KẾ TOÁN', bg: '#fef3c7', color: '#92400e' },
  MuaHang: { label: 'MUA HÀNG', bg: '#ede9fe', color: '#5b21b6' },
  KhoTQ: { label: 'KHO TQ', bg: '#ccfbf1', color: '#115e59' },
  KhoVN: { label: 'KHO VN', bg: '#dcfce7', color: '#166534' },
  Customer: { label: 'KHÁCH', bg: '#fce7f3', color: '#9d174d' }
};

type Props = {
  user: SessionUser;
  /** Override the auto-derived title (e.g. with a live count). */
  title?: string;
  /** Override the auto-derived subtitle. */
  subtitle?: string;
  /** App name shown in the sidebar brand. */
  appName?: string;
  children: React.ReactNode;
};

export default function AppShell({ user, title, subtitle, appName, children }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const meta = pageMetaFor(pathname || '');
  const groups = navForRole(user.vaiTro);
  const badge = ROLE_BADGE[user.vaiTro];
  const TbIcon = meta.Icon;

  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    } catch {
      /* ignore network error, still navigate away */
    }
    // Hard navigation guarantees a fresh server render with no cached session.
    window.location.href = '/login';
  }

  function isActive(href: string) {
    if (!pathname) return false;
    if (href === '/admin') return pathname === '/admin';
    return pathname === href || pathname.startsWith(href + '/');
  }

  return (
    <div className="shell">
      <div className={`sb-backdrop ${open ? 'show' : ''}`} onClick={() => setOpen(false)} />

      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sb-brand">
          <div className="logo"><FiPackage /></div>
          <div>
            <div className="name">{appName || 'Quản Lý Ship Trung Việt'}</div>
            <div className="tag">ERP Ship TQ · VN</div>
          </div>
        </div>

        <nav className="sb-nav">
          {groups.map((g, gi) => (
            <div key={gi}>
              {g.label && <div className="sb-group-label">{g.label}</div>}
              {g.items.map((it) => {
                const Icon = it.Icon;
                return (
                  <a
                    key={it.href}
                    href={it.href}
                    className={`sb-link ${isActive(it.href) ? 'active' : ''}`}
                    onClick={() => setOpen(false)}
                  >
                    <Icon />
                    <span>{it.label}</span>
                  </a>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sb-footer">
          <div className="sb-user">
            <div className="avatar">{user.hoTen.charAt(0).toUpperCase()}</div>
            <div className="meta">
              <div className="nm">{user.hoTen}</div>
              <div className="rl">{user.email}</div>
            </div>
          </div>
          <button className="sb-logout" onClick={logout} disabled={loggingOut}>
            <FiLogOut /> {loggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
          </button>
        </div>
      </aside>

      <div className="main-col">
        <header className="topbar">
          <button className="tb-burger" onClick={() => setOpen((o) => !o)} aria-label="Menu">
            <FiMenu />
          </button>
          <div className="tb-icon"><TbIcon /></div>
          <div className="tb-title">
            <h1>{title || meta.label}</h1>
            {(subtitle ?? meta.subtitle) && <p>{subtitle ?? meta.subtitle}</p>}
          </div>
          <div className="tb-right">
            <span className="role-badge" style={{ background: badge.bg, color: badge.color }}>
              {badge.label}
            </span>
          </div>
        </header>

        <main className="page">{children}</main>
      </div>
    </div>
  );
}
