'use client';

/**
 * Mã đơn bấm được để mở modal chi tiết.
 * Tách riêng vì trang /customer là server component — Next 15 ném lỗi (HTTP 500)
 * nếu server component truyền onClick xuống thẻ JSX.
 */
export default function OrderLink({ maDH }: { maDH: string }) {
  return (
    <span
      style={{ cursor: 'pointer', textDecoration: 'underline' }}
      onClick={() => (window as any).openOrderDetail?.(maDH)}
    >
      {maDH}
    </span>
  );
}
