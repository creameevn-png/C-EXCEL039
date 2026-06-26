-- ============================================================================
-- EXTENSION parity (giống gaudonhaphang) — phân loại danh mục hàng hoá + ghi chú
-- riêng tư (ngoài ghi chú cho NV mua hàng). Extension gửi kèm khi thêm vào giỏ.
-- CHẠY THỦ CÔNG trên DB prod (TiDB) TRƯỚC khi deploy. Additive, an toàn.
-- ============================================================================

ALTER TABLE `gio_mua_ho`
  ADD COLUMN `danh_muc`         VARCHAR(191) NULL AFTER `sku_text`,
  ADD COLUMN `ghi_chu_rieng_tu` TEXT         NULL AFTER `note`;
