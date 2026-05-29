import { NextResponse } from 'next/server';

export async function POST() {
  // Clear the session cookie explicitly on the response so the browser
  // reliably drops it (matches the attributes used when it was set).
  const res = NextResponse.json({ success: true });
  res.cookies.set('session', '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
    secure: process.env.NODE_ENV === 'production'
  });
  return res;
}
