-- ============================================================================
-- ĐỢT 8 — Bảng giá theo web (1688/Taobao/Tmall) + sổ công nợ NCC/shop theo
-- shop & theo đơn (PL02 #10, #14).
-- CHẠY THỦ CÔNG trên DB prod (TiDB) TRƯỚC khi deploy code Đợt 8. Additive, an toàn.
-- ============================================================================

CREATE TABLE IF NOT EXISTS `bang_gia_web` (
  `id`          INTEGER      NOT NULL AUTO_INCREMENT,
  `web`         VARCHAR(191) NOT NULL,
  `ty_gia`      DOUBLE       NOT NULL DEFAULT 3650,
  `phi_mua_pct` DOUBLE       NOT NULL DEFAULT 0,
  `phi_mua_min` DOUBLE       NOT NULL DEFAULT 0,
  `ghi_chu`     TEXT         NULL,
  `hoat_dong`   TINYINT(1)   NOT NULL DEFAULT 1,
  `updated_at`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `bang_gia_web_web_key` (`web`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `cong_no_ncc` (
  `id`          INTEGER      NOT NULL AUTO_INCREMENT,
  `ngay`        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `doi_tac`     VARCHAR(191) NOT NULL,
  `web`         VARCHAR(191) NULL,
  `ma_dh`       VARCHAR(191) NULL,
  `loai`        VARCHAR(191) NOT NULL DEFAULT 'PhatSinh',
  `so_tien`     DOUBLE       NOT NULL DEFAULT 0,
  `so_tien_ndt` DOUBLE       NOT NULL DEFAULT 0,
  `ty_gia`      DOUBLE       NOT NULL DEFAULT 0,
  `ghi_chu`     TEXT         NULL,
  `nguoi_tao`   VARCHAR(191) NULL,
  `created_at`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `cong_no_ncc_doi_tac_ngay_idx` (`doi_tac`, `ngay` DESC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
