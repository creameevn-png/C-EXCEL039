-- ============================================================================
-- ĐỢT 10 — Thông báo nội bộ (notify gần realtime qua polling) + lọc đơn nâng cao
-- + xuất Excel danh sách đơn (góp ý #10,11,21; PL02 #21).
-- Lọc đơn & xuất Excel là client-side (không cần đổi DB). Chỉ cần bảng thong_bao.
-- CHẠY THỦ CÔNG trên DB prod (TiDB) TRƯỚC khi deploy code Đợt 10. Additive, an toàn.
-- ============================================================================

CREATE TABLE IF NOT EXISTS `thong_bao` (
  `id`        INTEGER      NOT NULL AUTO_INCREMENT,
  `ngay`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `vai_tro`   VARCHAR(191) NULL,
  `loai`      VARCHAR(191) NOT NULL DEFAULT 'info',
  `tieu_de`   VARCHAR(191) NOT NULL,
  `noi_dung`  TEXT         NULL,
  `link`      VARCHAR(191) NULL,
  `ma_dh`     VARCHAR(191) NULL,
  `nguoi_tao` VARCHAR(191) NULL,
  PRIMARY KEY (`id`),
  INDEX `thong_bao_vai_tro_ngay_idx` (`vai_tro`, `ngay` DESC),
  INDEX `thong_bao_ngay_idx` (`ngay` DESC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
