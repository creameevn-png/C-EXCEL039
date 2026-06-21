import { NextResponse } from 'next/server';

/**
 * CORS cho các endpoint extension gọi từ chrome-extension://.
 * Không dùng cookie (auth bằng Bearer token) nên cho phép origin "*".
 */
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export function corsJson(data: any, init?: { status?: number }) {
  return NextResponse.json(data, { status: init?.status ?? 200, headers: CORS_HEADERS });
}

export function corsPreflight() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
