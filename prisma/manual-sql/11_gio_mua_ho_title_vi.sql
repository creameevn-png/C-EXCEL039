-- ============================================================================
-- EXTENSION add-on — Dịch tiếng Trung → tiếng Việt: lưu tên đã dịch của sản phẩm
-- mua hộ (extension tự dịch qua Google, gửi kèm khi thêm vào giỏ).
-- CHẠY THỦ CÔNG trên DB prod (TiDB) TRƯỚC khi deploy. Additive, an toàn.
-- ============================================================================

ALTER TABLE `gio_mua_ho`
  ADD COLUMN `title_vi` TEXT NULL AFTER `title`;
