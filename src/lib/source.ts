// Nhận diện nguồn web (Taobao / 1688 / Tmall) từ link sản phẩm.
export function detectWeb(link: string): string {
  const s = (link || '').toLowerCase();
  if (!s) return '';
  if (s.includes('1688.com') || s.includes('1688')) return '1688';
  if (s.includes('tmall.com') || s.includes('tmall')) return 'Tmall';
  if (s.includes('taobao.com') || s.includes('taobao')) return 'Taobao';
  return '';
}
