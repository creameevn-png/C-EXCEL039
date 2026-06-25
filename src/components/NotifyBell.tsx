'use client';

import { useEffect, useRef, useState } from 'react';
import { FiBell, FiCheckCircle, FiAlertTriangle, FiInfo, FiX } from 'react-icons/fi';

type Item = { id: number; ngay: string; loai: string; tieuDe: string; noiDung: string; link: string; maDH: string };

const LS_KEY = 'notify_last_seen';
const POLL_MS = 20000;

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'vừa xong';
  if (diff < 3600) return Math.floor(diff / 60) + ' phút trước';
  if (diff < 86400) return Math.floor(diff / 3600) + ' giờ trước';
  return Math.floor(diff / 86400) + ' ngày trước';
}

const LoaiIcon = ({ loai }: { loai: string }) =>
  loai === 'success' ? <FiCheckCircle style={{ color: 'var(--success)' }} />
  : loai === 'warning' || loai === 'danger' ? <FiAlertTriangle style={{ color: 'var(--danger-dark)' }} />
  : <FiInfo style={{ color: 'var(--primary)' }} />;

export default function NotifyBell() {
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState<number>(0);
  const timer = useRef<any>(null);

  async function load() {
    try {
      const r = await fetch('/api/notify', { cache: 'no-store' });
      if (!r.ok) return;
      const d = await r.json();
      if (d?.success) setItems(d.items || []);
    } catch { /* network blip — bỏ qua, lần poll sau thử lại */ }
  }

  useEffect(() => {
    setLastSeen(Number(localStorage.getItem(LS_KEY) || 0));
    load();
    timer.current = setInterval(load, POLL_MS);
    return () => clearInterval(timer.current);
  }, []);

  const unread = items.filter((i) => new Date(i.ngay).getTime() > lastSeen).length;

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && items.length) {
      const now = Date.now();
      localStorage.setItem(LS_KEY, String(now));
      setLastSeen(now);
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <button className="tb-burger" onClick={toggle} aria-label="Thông báo" style={{ position: 'relative' }}>
        <FiBell />
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2, minWidth: 16, height: 16, padding: '0 4px',
            background: 'var(--danger, #DC2626)', color: '#fff', borderRadius: 8, fontSize: 10,
            fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1
          }}>{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 340, maxWidth: '90vw',
            maxHeight: 460, overflowY: 'auto', background: 'var(--surface, #fff)', border: '1px solid var(--border, #e2e8f0)',
            borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,0.16)', zIndex: 50
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--border, #e2e8f0)', position: 'sticky', top: 0, background: 'var(--surface,#fff)' }}>
              <b style={{ fontSize: 13 }}>Thông báo</b>
              <button className="modal-close" onClick={() => setOpen(false)}><FiX /></button>
            </div>
            {items.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>Chưa có thông báo.</div>
            ) : items.map((i) => {
              const inner = (
                <div style={{ display: 'flex', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--border, #f1f5f9)' }}>
                  <div style={{ marginTop: 2 }}><LoaiIcon loai={i.loai} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{i.tieuDe}</div>
                    {i.noiDung && <div style={{ fontSize: 12, color: 'var(--text-muted, #475569)', marginTop: 2 }}>{i.noiDung}</div>}
                    <div style={{ fontSize: 11, color: 'var(--text-faint, #94a3b8)', marginTop: 3 }}>{timeAgo(i.ngay)}</div>
                  </div>
                </div>
              );
              return i.link
                ? <a key={i.id} href={i.link} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>{inner}</a>
                : <div key={i.id}>{inner}</div>;
            })}
          </div>
        </>
      )}
    </div>
  );
}
