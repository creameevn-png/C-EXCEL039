'use client';

export async function callServer(action: string, ...args: any[]): Promise<any> {
  const res = await fetch('/api/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, args })
  });
  if (!res.ok) {
    let msg = 'Server error';
    try { msg = (await res.json()).message || msg; } catch {}
    return { success: false, message: msg };
  }
  return res.json();
}

export function reload() {
  if (typeof window !== 'undefined') window.location.reload();
}
