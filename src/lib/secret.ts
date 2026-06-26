/**
 * Bí mật ký/verify phiên (web cookie + ext token) dùng chung.
 *
 * BẢO MẬT: trên PRODUCTION bắt buộc phải có biến môi trường SESSION_SECRET.
 * Nếu thiếu → ném lỗi (fail-fast) thay vì âm thầm dùng secret cứng — vì khi đó
 * bất kỳ ai cũng có thể tự ký một token Admin hợp lệ.
 *
 * Ném lỗi ở thời điểm GỌI (sign/verify) chứ không phải lúc import module, để
 * `next build` (chạy với NODE_ENV=production nhưng có thể chưa nạp env) không bị
 * vỡ; chỉ request thật mới fail-fast.
 */
let cached: Uint8Array | null = null;

export function getSessionSecret(): Uint8Array {
  if (cached) return cached;
  const raw = process.env.SESSION_SECRET;
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'SESSION_SECRET chưa được set trên production — bắt buộc phải có để ký/verify phiên an toàn.'
      );
    }
    // Chỉ cho phép fallback ở môi trường dev/local.
    cached = new TextEncoder().encode('dev-secret-change-me-please-now-32+chars');
    return cached;
  }
  cached = new TextEncoder().encode(raw);
  return cached;
}
