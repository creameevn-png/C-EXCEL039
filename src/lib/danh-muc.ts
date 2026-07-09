/**
 * Góp ý NV #23 — "Mục Danh mục/nhóm hàng cần có các đề xuất cố định."
 * Dùng chung cho form nhập SP của CSKH, trang quản lý sản phẩm và extension,
 * để ba nơi không lệch danh mục nhau. Vẫn cho gõ tự do (datalist, không phải select).
 */
export const DANH_MUC_HANG = [
  'Thời trang',
  'Mỹ phẩm',
  'Điện tử - Phụ kiện',
  'Gia dụng',
  'Đồ chơi',
  'Văn phòng phẩm',
  'Phụ kiện',
  'Khác'
];

/** id của <datalist> gắn vào ô nhập danh mục. */
export const DANH_MUC_LIST_ID = 'dm-hang';
