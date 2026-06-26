-- Đợt rà soát: tách "phí phát sinh khác" (nhập tay) ra cột riêng, trả lại phí
-- bảo hiểm 1% tự động cho cột phi_bh. Chạy 1 lần trên prod (TiDB) — additive, an toàn.
--
-- Lưu ý dữ liệu cũ: trước đây phi_bh đang LƯU "phí phát sinh khác". Sau khi đổi
-- ngữ nghĩa (phi_bh = bảo hiểm), các đơn cũ giữ nguyên số phi_bh cũ cho tới khi
-- được recompute (sửa đơn). Đây là chuyển đổi diễn giải 1 lần, không ảnh hưởng tiền.

ALTER TABLE `don_hang`
  ADD COLUMN `phi_phat_sinh` DOUBLE NOT NULL DEFAULT 0 AFTER `phi_bh`;
