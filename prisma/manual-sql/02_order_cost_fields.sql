-- ============================================================================
-- ĐỢT 1 — Bổ sung cột chi phí cho đơn hàng (góp ý #9, #11, #12, #13).
-- Thêm: ngạch hải quan, thuế NK, VAT, phí kiểm hóa, phí lưu kho.
-- ("Phí phát sinh khác" tái dùng cột phi_bh đã có — không cần thêm cột.)
-- CHẠY THỦ CÔNG trên DB prod (TiDB) TRƯỚC khi deploy code Đợt 1.
-- Local: chỉ cần `prisma db push`. Tất cả cột đều ADDITIVE, an toàn cho dữ liệu cũ.
-- ============================================================================

ALTER TABLE `don_hang`
  ADD COLUMN `thue_nk`       DOUBLE       NOT NULL DEFAULT 0 AFTER `phu_thu`,
  ADD COLUMN `vat`           DOUBLE       NOT NULL DEFAULT 0 AFTER `thue_nk`,
  ADD COLUMN `phi_kiem_hoa`  DOUBLE       NOT NULL DEFAULT 0 AFTER `vat`,
  ADD COLUMN `phi_luu_kho`   DOUBLE       NOT NULL DEFAULT 0 AFTER `phi_kiem_hoa`,
  ADD COLUMN `ngach_hq`      VARCHAR(191) NOT NULL DEFAULT 'Tiểu ngạch' AFTER `phi_luu_kho`;

-- Lưu ý hành vi mới (theo yêu cầu #9):
--   * Bỏ ép "Phí bảo hiểm 1%" tự động. Cột phi_bh giờ là "Phí phát sinh khác" (CSKH nhập tay, mặc định 0).
--   * Đơn cũ giữ nguyên giá trị phi_bh đã lưu; không bị tính lại trừ khi sửa đơn.
