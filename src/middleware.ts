import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'dev-secret-change-me-please-now-32+chars'
);

const PROTECTED = [
  '/cskh', '/gdv', '/ketoan', '/mua-hang',
  '/khotq', '/khovn', '/admin', '/customer',
  '/dat-hang', '/in-tem', '/dashboard'
];

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (!PROTECTED.some((p) => path === p || path.startsWith(p + '/'))) {
    return NextResponse.next();
  }
  const token = req.cookies.get('session')?.value;
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  try {
    await jwtVerify(token, SECRET);
    return NextResponse.next();
  } catch {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: [
    '/cskh/:path*', '/gdv/:path*', '/ketoan/:path*', '/mua-hang/:path*',
    '/khotq/:path*', '/khovn/:path*', '/admin/:path*', '/customer/:path*',
    '/dat-hang/:path*', '/in-tem/:path*', '/dashboard/:path*'
  ]
};
