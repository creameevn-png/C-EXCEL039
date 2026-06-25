-- ============================================================================
-- ĐỢT 3 — Dịch vụ kiểm đếm (GTGT) + thông tin người nhận hàng (góp ý #1-8).
-- Người nhận mặc định theo KH, sửa được từng đơn; bỏ email khi tạo đơn → địa chỉ giao.
-- CHẠY THỦ CÔNG trên DB prod (TiDB) TRƯỚC khi deploy code Đợt 3. Additive, an toàn.
-- ============================================================================

ALTER TABLE `don_hang`
  ADD COLUMN `kiem_dem`     BOOLEAN      NOT NULL DEFAULT FALSE AFTER `ngach_hq`,
  ADD COLUMN `nguoi_nhan`   VARCHAR(191) NULL AFTER `kiem_dem`,
  ADD COLUMN `sdt_nhan`     VARCHAR(191) NULL AFTER `nguoi_nhan`,
  ADD COLUMN `dia_chi_nhan` TEXT         NULL AFTER `sdt_nhan`;
