-- ============================================================================
-- ĐỢT 7 — Khiếu nại/đổi trả: phí đổi trả + hoàn tiền vào ví tự động khi duyệt
-- cấp 2 + tách chi phí khiếu nại theo quỹ chịu (PL02 #8,9; góp ý #42-49).
-- CHẠY THỦ CÔNG trên DB prod (TiDB) TRƯỚC khi deploy code Đợt 7. Additive, an toàn.
-- ============================================================================

ALTER TABLE `khieu_nai`
  ADD COLUMN `phi_doi_tra`  DOUBLE       NOT NULL DEFAULT 0      AFTER `so_tien_hoan`,
  ADD COLUMN `hoan_vi`      TINYINT(1)   NOT NULL DEFAULT 0      AFTER `phi_doi_tra`,
  ADD COLUMN `da_hoan_vi`   TINYINT(1)   NOT NULL DEFAULT 0      AFTER `hoan_vi`,
  ADD COLUMN `quy_chiu_phi` VARCHAR(191) NULL                   AFTER `da_hoan_vi`;
