export function fmtVND(n: number | null | undefined): string {
  return Number(n || 0).toLocaleString('vi-VN');
}

export function formatCurrency(n: number | null | undefined): string {
  if (!n) return '0đ';
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + 'đ';
}

export function formatNDT(n: number | null | undefined): string {
  if (!n) return '0¥';
  return new Intl.NumberFormat('zh-CN').format(n) + '¥';
}

export function fmtDateDDMM(d: Date | string | null | undefined): string {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return '';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '-';
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export const fmtDateFull = formatDate;

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return '-';
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

export function shortMoney(n: number): string {
  return n >= 1000000 ? (n / 1000000).toFixed(1) + 'tr' : (n / 1000).toFixed(0) + 'k';
}

export function cn(...c: (string | undefined | false | null)[]): string {
  return c.filter(Boolean).join(' ');
}
