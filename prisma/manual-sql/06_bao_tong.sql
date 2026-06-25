-- ============================================================================
-- ĐỢT 5 — Bao tổng / lô-chuyến: gộp đơn theo line → xuất về VN → kho VN nhận cả bao.
-- (PL02 #6,7; góp ý #27-29,35-41). CHẠY THỦ CÔNG trên DB prod TRƯỚC khi deploy. Additive.
-- ============================================================================

ALTER TABLE `don_hang`
  ADD COLUMN `ma_bao` VARCHAR(191) NULL AFTER `nguoi_phu_trach_tq`;

CREATE TABLE IF NOT EXISTS `bao_tong` (
  `id`            INTEGER     NOT NULL AUTO_INCREMENT,
  `ma_bao`        VARCHAR(191) NOT NULL,
  `line`          ENUM('LineNhanh','LineThuong','LineRe') NOT NULL DEFAULT 'LineThuong',
  `trang_thai`    VARCHAR(191) NOT NULL DEFAULT 'DangDong',
  `tong_kg`       DOUBLE      NOT NULL DEFAULT 0,
  `tong_m3`       DOUBLE      NOT NULL DEFAULT 0,
  `so_kien`       INTEGER     NOT NULL DEFAULT 0,
  `ghi_chu`       TEXT        NULL,
  `nguoi_tao`     VARCHAR(191) NULL,
  `nguoi_nhan_vn` VARCHAR(191) NULL,
  `created_at`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `xuat_at`       DATETIME(3) NULL,
  `ve_vn_at`      DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `bao_tong_ma_bao_key` (`ma_bao`),
  INDEX `bao_tong_trang_thai_created_at_idx` (`trang_thai`, `created_at` DESC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
