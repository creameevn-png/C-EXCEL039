-- ============================================================================
-- ĐỢT 2 — Giá vốn GDV + lợi nhuận (PL02 #15; góp ý #15,16,50,51).
-- Thêm cột giá vốn (tệ), ship nội địa TQ (tệ), lợi nhuận (tệ).
-- Mở rộng ma_gd / ma_vd thành TEXT để chứa NHIỀU mã (cách nhau dấu phẩy).
-- CHẠY THỦ CÔNG trên DB prod (TiDB) TRƯỚC khi deploy code Đợt 2. Additive, an toàn.
-- ============================================================================

ALTER TABLE `don_hang`
  ADD COLUMN `von_ndt`       DOUBLE NOT NULL DEFAULT 0 AFTER `ma_vd`,
  ADD COLUMN `ship_nd_tq`    DOUBLE NOT NULL DEFAULT 0 AFTER `von_ndt`,
  ADD COLUMN `loi_nhuan_ndt` DOUBLE NOT NULL DEFAULT 0 AFTER `ship_nd_tq`;

-- Cho phép nhiều mã giao dịch / vận đơn trên 1 đơn:
ALTER TABLE `don_hang` MODIFY COLUMN `ma_gd` TEXT NULL;
ALTER TABLE `don_hang` MODIFY COLUMN `ma_vd` TEXT NULL;
