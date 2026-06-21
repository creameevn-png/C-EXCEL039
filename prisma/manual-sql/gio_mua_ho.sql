-- ============================================================================
-- Bảng giỏ "mua hộ" cho extension 1688/Taobao/Tmall (model Prisma: GioMuaHo).
-- CHẠY THỦ CÔNG trên DB prod (TiDB) TRƯỚC khi deploy code mới —
-- vì build prod KHÔNG tự `prisma db push` (TiDB có index drift / FK bị chặn).
-- Local đã tạo sẵn bằng `prisma db push`.
-- Cách chạy: mở SQL console TiDB Cloud -> dán đoạn dưới -> Run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS `gio_mua_ho` (
  `id`           INTEGER       NOT NULL AUTO_INCREMENT,
  `nv_id`        INTEGER       NOT NULL,
  `source`       VARCHAR(191)  NOT NULL DEFAULT '',
  `product_id`   VARCHAR(191)  NULL,
  `product_url`  TEXT          NULL,
  `title`        TEXT          NOT NULL,
  `image`        TEXT          NULL,
  `images`       TEXT          NULL,
  `price_text`   VARCHAR(191)  NULL,
  `price_value`  DOUBLE        NULL,
  `currency`     VARCHAR(191)  NULL DEFAULT 'CNY',
  `quantity`     INTEGER       NOT NULL DEFAULT 1,
  `min_quantity` INTEGER       NOT NULL DEFAULT 1,
  `sku`          TEXT          NULL,
  `sku_text`     TEXT          NULL,
  `note`         TEXT          NULL,
  `from_listing` BOOLEAN       NOT NULL DEFAULT false,
  `raw`          TEXT          NULL,
  `da_xu_ly`     BOOLEAN       NOT NULL DEFAULT false,
  `captured_at`  DATETIME(3)   NULL,
  `created_at`   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `gio_mua_ho_nv_id_created_at_idx` (`nv_id`, `created_at` DESC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- (Tùy chọn) Khóa ngoại tới nhan_vien. Bỏ qua nếu TiDB chặn FK (app vẫn chạy bình thường):
-- ALTER TABLE `gio_mua_ho`
--   ADD CONSTRAINT `gio_mua_ho_nv_id_fkey`
--   FOREIGN KEY (`nv_id`) REFERENCES `nhan_vien`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
