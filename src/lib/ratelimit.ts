/**
 * Rate-limit đơn giản trong bộ nhớ (sliding fixed-window) cho các endpoint CÔNG KHAI
 * (tra cứu KH, gửi khiếu nại/yêu cầu, ext). Không hoàn hảo trên serverless nhiều
 * instance, nhưng đủ để chặn dò brute-force / spam ở quy mô shop.
 */
type Bucket = { count: number; resetAt: number };
const store = new Map<string, Bucket>();
let lastPrune = 0;

function prune(now: number) {
  // Dọn các bucket hết hạn định kỳ để Map không phình mãi.
  if (now - lastPrune < 60_000) return;
  lastPrune = now;
  for (const [k, b] of store) if (now > b.resetAt) store.delete(k);
}

/** Trả {ok, retryAfter(giây)}. Cho phép `limit` request mỗi `windowMs`. */
export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  prune(now);
  const b = store.get(key);
  if (!b || now > b.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (b.count >= limit) return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  b.count++;
  return { ok: true, retryAfter: 0 };
}

/** Lấy IP client từ header proxy (Vercel/Nginx). */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for') || '';
  const first = xff.split(',')[0].trim();
  return first || req.headers.get('x-real-ip') || 'unknown';
}
