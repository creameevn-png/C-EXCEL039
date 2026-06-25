-- ============================================================================
-- ĐỢT 6 — Phiếu giao gộp nhiều đơn 1 khách + in + công nợ theo phiếu (PL02 #1-3).
-- CHẠY THỦ CÔNG trên DB prod (TiDB) TRƯỚC khi deploy code Đợt 6. Additive, an toàn.
-- ============================================================================

ALTER TABLE `don_hang`
  ADD COLUMN `ma_phieu_giao` VARCHAR(191) NULL AFTER `ma_bao`;

CREATE TABLE IF NOT EXISTS `phieu_giao` (
  `id`         INTEGER     NOT NULL AUTO_INCREMENT,
  `ma_phieu`   VARCHAR(191) NOT NULL,
  `ma_kh`      VARCHAR(191) NOT NULL,
  `ten_kh`     VARCHAR(191) NULL,
  `so_don`     INTEGER     NOT NULL DEFAULT 0,
  `tong_tien`  DOUBLE      NOT NULL DEFAULT 0,
  `da_thu`     DOUBLE      NOT NULL DEFAULT 0,
  `con_lai`    DOUBLE      NOT NULL DEFAULT 0,
  `nguoi_tao`  VARCHAR(191) NULL,
  `ghi_chu`    TEXT        NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `phieu_giao_ma_phieu_key` (`ma_phieu`),
  INDEX `phieu_giao_ma_kh_created_at_idx` (`ma_kh`, `created_at` DESC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
