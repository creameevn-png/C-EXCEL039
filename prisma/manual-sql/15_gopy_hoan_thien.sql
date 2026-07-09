-- Đợt góp ý nhân viên (vòng 3, phần 2): hoàn thiện 20 mục còn lại.
-- Chạy 1 lần trên prod (TiDB) SAU file 14. Toàn bộ là thêm cột nullable/có default
-- và thêm bảng mới — không sửa, không xoá dữ liệu cũ.

-- #12 GDV phụ trách đơn · #32 người trực tiếp làm ở kho TQ
-- #9  phí phát sinh chờ Kế toán duyệt mới cộng vào tổng tiền
-- #47 phí đổi trả khách chịu → cộng vào khoản phải thu, ghi cột riêng để tách sổ
ALTER TABLE `don_hang`
  ADD COLUMN `gdv_id` INT NULL,
  ADD COLUMN `nguoi_lam_tq` VARCHAR(191) NULL,
  ADD COLUMN `phi_phat_sinh_duyet` TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN `phi_phat_sinh_duyet_by` VARCHAR(191) NULL,
  ADD COLUMN `phi_phat_sinh_duyet_at` DATETIME(3) NULL,
  ADD COLUMN `phi_khieu_nai` DOUBLE NOT NULL DEFAULT 0;

CREATE INDEX `don_hang_gdv_id_idx` ON `don_hang` (`gdv_id`);

-- Đơn CŨ: phí phát sinh đã nằm trong tổng tiền từ trước → coi như đã duyệt,
-- tránh tổng tiền tụt xuống ở lần recompute kế tiếp.
UPDATE `don_hang` SET `phi_phat_sinh_duyet` = 1 WHERE `phi_phat_sinh` > 0;

-- #13 tiền tệ GDV mua thực tế của từng sản phẩm · #33 kích thước thực đo → suy ra m³
ALTER TABLE `chi_tiet_don`
  ADD COLUMN `von_ndt` DOUBLE NOT NULL DEFAULT 0,
  ADD COLUMN `dai` DOUBLE NOT NULL DEFAULT 0,
  ADD COLUMN `rong` DOUBLE NOT NULL DEFAULT 0,
  ADD COLUMN `cao` DOUBLE NOT NULL DEFAULT 0;

-- #44 #45 #47 luồng khiếu nại đi qua kho VN
ALTER TABLE `khieu_nai`
  ADD COLUMN `ma_vd_tra_hang` VARCHAR(191) NULL,
  ADD COLUMN `chuyen_kho_vn` TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN `chuyen_kho_vn_at` DATETIME(3) NULL,
  ADD COLUMN `da_nhan_hang_kn` TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN `ngay_nhan_kn` DATETIME(3) NULL,
  ADD COLUMN `nguoi_nhan_kn` VARCHAR(191) NULL,
  ADD COLUMN `da_tinh_phi_kh` TINYINT(1) NOT NULL DEFAULT 0;

-- #52 hoa hồng GDV · #53 thưởng CSKH (tỉ lệ đặt riêng cho từng nhân viên)
ALTER TABLE `nhan_vien`
  ADD COLUMN `pct_hoa_hong` DOUBLE NOT NULL DEFAULT 0,
  ADD COLUMN `pct_thuong` DOUBLE NOT NULL DEFAULT 0;

-- #28 #37 #38 kiện hàng: mỗi mã vận đơn của đơn là một kiện, nhận/giao từng kiện
CREATE TABLE IF NOT EXISTS `kien_hang` (
  `id`         INT NOT NULL AUTO_INCREMENT,
  `ma_dh`      VARCHAR(191) NOT NULL,
  `ma_vd`      VARCHAR(191) NOT NULL,
  `kg`         DOUBLE NOT NULL DEFAULT 0,
  `m3`         DOUBLE NOT NULL DEFAULT 0,
  `ma_bao`     VARCHAR(191) NULL,
  `trang_thai` VARCHAR(191) NOT NULL DEFAULT 'ChuaVe',
  `ngay_ve_vn` DATETIME(3) NULL,
  `ngay_giao`  DATETIME(3) NULL,
  `nguoi_nhan` VARCHAR(191) NULL,
  `nguoi_giao` VARCHAR(191) NULL,
  `ghi_chu`    TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_kien_don_vd` (`ma_dh`, `ma_vd`),
  KEY `kien_hang_ma_vd_idx` (`ma_vd`),
  KEY `kien_hang_trang_thai_idx` (`trang_thai`)
);

-- #22 thu chi nội bộ (quy='CongTy') · #42 #43 quỹ kho (quy='KhoVN' | 'KhoTQ')
CREATE TABLE IF NOT EXISTS `so_quy` (
  `id`         INT NOT NULL AUTO_INCREMENT,
  `ngay`       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `quy`        VARCHAR(191) NOT NULL DEFAULT 'CongTy',
  `loai`       ENUM('Thu','Chi') NOT NULL DEFAULT 'Thu',
  `so_tien`    DOUBLE NOT NULL DEFAULT 0,
  `danh_muc`   VARCHAR(191) NULL,
  `noi_dung`   TEXT NOT NULL,
  `ma_dh`      VARCHAR(191) NULL,
  `ma_kh`      VARCHAR(191) NULL,
  `nguoi_tao`  VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `so_quy_quy_ngay_idx` (`quy`, `ngay` DESC),
  KEY `so_quy_ngay_idx` (`ngay` DESC)
);

-- #33 hệ số quy đổi m³ (dài×rộng×cao / hệ số). Admin sửa được ở trang Cài đặt.
INSERT INTO `cai_dat` (`ten`, `gia_tri`, `ghi_chu`)
  VALUES ('m3_chia', '1000000', 'Hệ số quy đổi m³ = dài × rộng × cao (cm) / hệ số')
  ON DUPLICATE KEY UPDATE `ten` = `ten`;
