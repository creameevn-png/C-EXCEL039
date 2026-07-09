-- Đợt góp ý nhân viên (vòng 3): bổ sung 2 cột cho các mục còn thiếu trong scope.
--   #14 — ghi_chu_gdv:  ghi chú riêng của GDV cho từng đơn (tách khỏi ghi_chu của CSKH/khách).
--   #41 — line_noi_dia: line vận chuyển nội địa VN do kho VN chọn khi giao hàng.
--
-- Chạy 1 lần trên prod (TiDB). Additive, nullable, không đụng dữ liệu cũ — an toàn.

ALTER TABLE `don_hang`
  ADD COLUMN `ghi_chu_gdv` TEXT NULL AFTER `ghi_chu`,
  ADD COLUMN `line_noi_dia` VARCHAR(191) NULL AFTER `ghi_chu_gdv`;
