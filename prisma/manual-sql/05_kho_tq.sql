-- ============================================================================
-- ĐỢT 4 — Kho TQ: hàng vô chủ, kiểm đếm đủ/thiếu, người phụ trách (góp ý #24-26,30-33).
-- CHẠY THỦ CÔNG trên DB prod (TiDB) TRƯỚC khi deploy code Đợt 4. Additive, an toàn.
-- ============================================================================

-- Người phụ trách nhận tại kho TQ (2 NV kho)
ALTER TABLE `don_hang`
  ADD COLUMN `nguoi_phu_trach_tq` VARCHAR(191) NULL AFTER `dia_chi_nhan`;

-- Kiểm đếm đủ/thiếu theo từng link sản phẩm
ALTER TABLE `chi_tiet_don`
  ADD COLUMN `kiem_ke`      VARCHAR(191) NULL AFTER `ghi_chu`,
  ADD COLUMN `kiem_ke_note` TEXT         NULL AFTER `kiem_ke`;

-- Bảng hàng vô chủ
CREATE TABLE IF NOT EXISTS `hang_vo_chu` (
  `id`         INTEGER      NOT NULL AUTO_INCREMENT,
  `ma_vd`      VARCHAR(191) NOT NULL,
  `kg`         DOUBLE       NOT NULL DEFAULT 0,
  `dai`        DOUBLE       NOT NULL DEFAULT 0,
  `rong`       DOUBLE       NOT NULL DEFAULT 0,
  `cao`        DOUBLE       NOT NULL DEFAULT 0,
  `m3`         DOUBLE       NOT NULL DEFAULT 0,
  `anh`        TEXT         NULL,
  `ghi_chu`    TEXT         NULL,
  `da_gan`     BOOLEAN      NOT NULL DEFAULT FALSE,
  `ma_dh`      VARCHAR(191) NULL,
  `nguoi_nhap` VARCHAR(191) NULL,
  `created_at` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `hang_vo_chu_da_gan_created_at_idx` (`da_gan`, `created_at` DESC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
