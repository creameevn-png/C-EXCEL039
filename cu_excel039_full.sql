

-- =====================================================================
--  CỪ EXCEL039 - SHIP TQ-VN  |  ERP Database (MySQL 8.0+)
--  File SQL ĐẦY ĐỦ: tạo database + toàn bộ bảng + khóa ngoại + dữ liệu mẫu
--  Sinh từ prisma/schema.prisma (Prisma 5.22) — provider: mysql
--  Charset: utf8mb4 / utf8mb4_unicode_ci
--
--  Cách dùng:
--    mysql -u root -p < cu_excel039_full.sql
--  Hoặc mở trong phpMyAdmin / DBeaver / MySQL Workbench rồi Run All.
--
--  Mật khẩu mặc định mọi tài khoản nhân viên: 123456
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) Tạo & chọn database
-- ---------------------------------------------------------------------
CREATE DATABASE IF NOT EXISTS `cu_excel039`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;
USE `cu_excel039`;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------
-- 1) Dọn bảng cũ (chạy lại được nhiều lần - idempotent)
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS `chung_tu`;
DROP TABLE IF EXISTS `yeu_cau_mua`;
DROP TABLE IF EXISTS `nguon_hang`;
DROP TABLE IF EXISTS `bang_gia`;
DROP TABLE IF EXISTS `khieu_nai`;
DROP TABLE IF EXISTS `hoat_dong`;
DROP TABLE IF EXISTS `cai_dat`;
DROP TABLE IF EXISTS `thu_chi`;
DROP TABLE IF EXISTS `lich_su_vi`;
DROP TABLE IF EXISTS `chi_tiet_don`;
DROP TABLE IF EXISTS `don_hang`;
DROP TABLE IF EXISTS `ncc`;
DROP TABLE IF EXISTS `san_pham`;
DROP TABLE IF EXISTS `khach_hang`;
DROP TABLE IF EXISTS `nhan_vien`;

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================
-- 2) TẠO BẢNG (DDL)
-- =====================================================================

-- CreateTable
CREATE TABLE `nhan_vien` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `ho_ten` VARCHAR(191) NOT NULL,
    `vai_tro` ENUM('Admin', 'CSKH', 'GDV', 'KeToan', 'MuaHang', 'KhoTQ', 'KhoVN', 'Customer') NOT NULL,
    `trang_thai` ENUM('HoatDong', 'TamKhoa') NOT NULL DEFAULT 'HoatDong',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `nhan_vien_email_key`(`email`),
    INDEX `nhan_vien_email_idx`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `khach_hang` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ma_kh` VARCHAR(191) NOT NULL,
    `ten_kh` VARCHAR(191) NOT NULL,
    `sdt` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `dia_chi` VARCHAR(191) NULL,
    `tuyen` ENUM('HaNoi', 'HCM') NOT NULL DEFAULT 'HaNoi',
    `pct_coc` DOUBLE NOT NULL DEFAULT 70,
    `so_du_vi` DOUBLE NOT NULL DEFAULT 0,
    `cong_no` DOUBLE NOT NULL DEFAULT 0,
    `tong_don` INTEGER NOT NULL DEFAULT 0,
    `doanh_thu` DOUBLE NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `khach_hang_ma_kh_key`(`ma_kh`),
    INDEX `khach_hang_ma_kh_idx`(`ma_kh`),
    INDEX `khach_hang_sdt_idx`(`sdt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `san_pham` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ma_sp` VARCHAR(191) NOT NULL,
    `ten_sp` VARCHAR(191) NOT NULL,
    `danh_muc` VARCHAR(191) NULL,
    `web_nguon` VARCHAR(191) NULL,
    `kg_goi_y` DOUBLE NOT NULL DEFAULT 0,
    `m3_goi_y` DOUBLE NOT NULL DEFAULT 0,
    `gia_tham_khao` DOUBLE NOT NULL DEFAULT 0,
    `link_taobao` TEXT NULL,
    `ghi_chu` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `san_pham_ma_sp_key`(`ma_sp`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ncc` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ma_ncc` VARCHAR(191) NULL,
    `ten_ncc` VARCHAR(191) NOT NULL,
    `wechat` VARCHAR(191) NULL,
    `ghi_chu` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ncc_ma_ncc_key`(`ma_ncc`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `don_hang` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ma_dh` VARCHAR(191) NOT NULL,
    `ngay_tao` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ma_kh` VARCHAR(191) NOT NULL,
    `nv_tao` VARCHAR(191) NULL,
    `nv_id` INTEGER NULL,
    `tuyen` ENUM('HaNoi', 'HCM') NOT NULL DEFAULT 'HaNoi',
    `ma_gd` VARCHAR(191) NULL,
    `ma_vd` VARCHAR(191) NULL,
    `tong_kg` DOUBLE NOT NULL DEFAULT 0,
    `tong_m3` DOUBLE NOT NULL DEFAULT 0,
    `tong_gia_hang` DOUBLE NOT NULL DEFAULT 0,
    `phi_mua` DOUBLE NOT NULL DEFAULT 0,
    `phi_bh` DOUBLE NOT NULL DEFAULT 0,
    `phi_vc` DOUBLE NOT NULL DEFAULT 0,
    `ship_nd` DOUBLE NOT NULL DEFAULT 0,
    `dong_go` DOUBLE NOT NULL DEFAULT 0,
    `phu_thu` DOUBLE NOT NULL DEFAULT 0,
    `tong_tien` DOUBLE NOT NULL DEFAULT 0,
    `tien_coc` DOUBLE NOT NULL DEFAULT 0,
    `da_tra` DOUBLE NOT NULL DEFAULT 0,
    `con_lai` DOUBLE NOT NULL DEFAULT 0,
    `trang_thai` ENUM('DonMoiTao', 'DatCoc', 'DaMuaHang', 'NccGiaoHang', 'KhoTqNhan', 'DangVanChuyen', 'KhoVnNhan', 'ChoThanhToan', 'GiaoHang', 'HoanThanh', 'Huy', 'KHTuDat') NOT NULL DEFAULT 'DonMoiTao',
    `line_vc` ENUM('LineNhanh', 'LineThuong', 'LineRe') NOT NULL DEFAULT 'LineThuong',
    `loai_hang` VARCHAR(191) NOT NULL DEFAULT 'Thường',
    `pct_coc` DOUBLE NOT NULL DEFAULT 70,
    `anh_kho_tq` TEXT NULL,
    `anh_roi_tq` TEXT NULL,
    `anh_kho_vn` TEXT NULL,
    `anh_giao_kh` TEXT NULL,
    `ghi_chu` TEXT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `don_hang_ma_dh_key`(`ma_dh`),
    INDEX `don_hang_ma_kh_ngay_tao_idx`(`ma_kh`, `ngay_tao` DESC),
    INDEX `don_hang_trang_thai_ngay_tao_idx`(`trang_thai`, `ngay_tao` DESC),
    INDEX `don_hang_ngay_tao_idx`(`ngay_tao` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chi_tiet_don` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ma_dh` VARCHAR(191) NOT NULL,
    `stt` INTEGER NOT NULL,
    `ten_sp` TEXT NOT NULL,
    `so_luong` INTEGER NOT NULL DEFAULT 1,
    `don_gia_ndt` DOUBLE NOT NULL DEFAULT 0,
    `ty_gia` DOUBLE NOT NULL DEFAULT 3650,
    `don_gia_vnd` DOUBLE NOT NULL DEFAULT 0,
    `thanh_tien` DOUBLE NOT NULL DEFAULT 0,
    `kg` DOUBLE NOT NULL DEFAULT 0,
    `m3` DOUBLE NOT NULL DEFAULT 0,
    `web_nguon` VARCHAR(191) NULL,
    `link_taobao` TEXT NULL,
    `ghi_chu` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `chi_tiet_don_ma_dh_stt_idx`(`ma_dh`, `stt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lich_su_vi` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ngay` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ma_kh` VARCHAR(191) NOT NULL,
    `loai` ENUM('Nap', 'Tru') NOT NULL,
    `so_tien` DOUBLE NOT NULL,
    `so_du_sau` DOUBLE NOT NULL DEFAULT 0,
    `ghi_chu` TEXT NULL,
    `nv` VARCHAR(191) NULL,
    `nv_id` INTEGER NULL,

    INDEX `lich_su_vi_ma_kh_ngay_idx`(`ma_kh`, `ngay` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `thu_chi` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ngay` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ma_dh` VARCHAR(191) NOT NULL,
    `loai` ENUM('Thu', 'Chi') NOT NULL DEFAULT 'Thu',
    `so_tien` DOUBLE NOT NULL,
    `ghi_chu` TEXT NULL,
    `nv` VARCHAR(191) NULL,
    `nv_id` INTEGER NULL,

    INDEX `thu_chi_ma_dh_idx`(`ma_dh`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cai_dat` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ten` VARCHAR(191) NOT NULL,
    `gia_tri` TEXT NULL,
    `ghi_chu` TEXT NULL,

    UNIQUE INDEX `cai_dat_ten_key`(`ten`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hoat_dong` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ngay` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `email` VARCHAR(191) NULL,
    `hanh_dong` VARCHAR(191) NOT NULL,
    `doi_tuong` VARCHAR(191) NULL,
    `chi_tiet` TEXT NULL,

    INDEX `hoat_dong_ngay_idx`(`ngay` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `khieu_nai` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ma_kn` VARCHAR(191) NOT NULL,
    `ngay_tao` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ma_dh` VARCHAR(191) NULL,
    `ma_kh` VARCHAR(191) NULL,
    `nguoi_tao` VARCHAR(191) NULL,
    `loai` ENUM('HangLoi', 'ThieuHang', 'GiaoSai', 'KhongNhan', 'Khac') NOT NULL,
    `mo_ta` TEXT NOT NULL,
    `anh_bang_chung` TEXT NULL,
    `trang_thai` ENUM('ChoXuLy', 'DangXuLy', 'DangDuyetCap1', 'DangDuyetCap2', 'DuyetDoiTra', 'DuyetHoanTien', 'DuyetGiamGia', 'TuChoi', 'DaXuLy') NOT NULL DEFAULT 'ChoXuLy',
    `phuong_an` VARCHAR(191) NULL,
    `so_tien_hoan` DOUBLE NOT NULL DEFAULT 0,
    `ghi_chu_xu_ly` TEXT NULL,
    `duyet_cap1_by` VARCHAR(191) NULL,
    `duyet_cap1_at` DATETIME(3) NULL,
    `duyet_cap1_note` TEXT NULL,
    `duyet_cap2_by` VARCHAR(191) NULL,
    `duyet_cap2_at` DATETIME(3) NULL,
    `duyet_cap2_note` TEXT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `khieu_nai_ma_kn_key`(`ma_kn`),
    INDEX `khieu_nai_ma_dh_idx`(`ma_dh`),
    INDEX `khieu_nai_trang_thai_idx`(`trang_thai`),
    INDEX `khieu_nai_ngay_tao_idx`(`ngay_tao` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bang_gia` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `line` ENUM('LineNhanh', 'LineThuong', 'LineRe') NOT NULL,
    `loai_hang` VARCHAR(191) NOT NULL,
    `gia_kg_duoi_5` DOUBLE NOT NULL DEFAULT 0,
    `gia_kg_5_20` DOUBLE NOT NULL DEFAULT 0,
    `gia_kg_tren_20` DOUBLE NOT NULL DEFAULT 0,
    `gia_m3` DOUBLE NOT NULL DEFAULT 0,
    `phi_phu_pct` DOUBLE NOT NULL DEFAULT 0,
    `thoi_gian_du_kien` VARCHAR(191) NULL,
    `hoat_dong` BOOLEAN NOT NULL DEFAULT true,
    `ghi_chu` TEXT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bang_gia_line_loai_hang_key`(`line`, `loai_hang`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `nguon_hang` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ten_sp` VARCHAR(191) NOT NULL,
    `ten_ncc` VARCHAR(191) NULL,
    `link_taobao` TEXT NULL,
    `gia_ndt` DOUBLE NULL,
    `moq` INTEGER NOT NULL DEFAULT 1,
    `thoi_gian_giao` VARCHAR(191) NULL,
    `chat_luong` INTEGER NULL,
    `ghi_chu` TEXT NULL,
    `nguoi_them` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `yeu_cau_mua` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ma_yc` VARCHAR(191) NOT NULL,
    `ngay_tao` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ho_ten` VARCHAR(191) NOT NULL,
    `sdt` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `ma_kh` VARCHAR(191) NULL,
    `tuyen` ENUM('HaNoi', 'HCM') NOT NULL DEFAULT 'HaNoi',
    `san_pham` TEXT NOT NULL,
    `ghi_chu` TEXT NULL,
    `trang_thai` ENUM('ChoXuLy', 'DaLienHe', 'DaTaoDon', 'TuChoi') NOT NULL DEFAULT 'ChoXuLy',
    `nv_xu_ly` VARCHAR(191) NULL,
    `ghi_chu_xu_ly` TEXT NULL,
    `ma_dh` VARCHAR(191) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `yeu_cau_mua_ma_yc_key`(`ma_yc`),
    INDEX `yeu_cau_mua_trang_thai_idx`(`trang_thai`),
    INDEX `yeu_cau_mua_ngay_tao_idx`(`ngay_tao` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chung_tu` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ma_ct` VARCHAR(191) NOT NULL,
    `ngay` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `loai` ENUM('HoaDon', 'PhieuThu', 'PhieuChi', 'HopDong', 'Khac') NOT NULL,
    `ma_dh` VARCHAR(191) NULL,
    `ma_kh` VARCHAR(191) NULL,
    `tieu_de` VARCHAR(191) NOT NULL,
    `noi_dung` TEXT NULL,
    `file_url` TEXT NULL,
    `nguoi_tao` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `chung_tu_ma_ct_key`(`ma_ct`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =====================================================================
-- 3) KHÓA NGOẠI (FOREIGN KEYS)
-- =====================================================================

ALTER TABLE `don_hang` ADD CONSTRAINT `don_hang_ma_kh_fkey` FOREIGN KEY (`ma_kh`) REFERENCES `khach_hang`(`ma_kh`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `don_hang` ADD CONSTRAINT `don_hang_nv_id_fkey` FOREIGN KEY (`nv_id`) REFERENCES `nhan_vien`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `chi_tiet_don` ADD CONSTRAINT `chi_tiet_don_ma_dh_fkey` FOREIGN KEY (`ma_dh`) REFERENCES `don_hang`(`ma_dh`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `lich_su_vi` ADD CONSTRAINT `lich_su_vi_ma_kh_fkey` FOREIGN KEY (`ma_kh`) REFERENCES `khach_hang`(`ma_kh`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `lich_su_vi` ADD CONSTRAINT `lich_su_vi_nv_id_fkey` FOREIGN KEY (`nv_id`) REFERENCES `nhan_vien`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `thu_chi` ADD CONSTRAINT `thu_chi_ma_dh_fkey` FOREIGN KEY (`ma_dh`) REFERENCES `don_hang`(`ma_dh`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `thu_chi` ADD CONSTRAINT `thu_chi_nv_id_fkey` FOREIGN KEY (`nv_id`) REFERENCES `nhan_vien`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `khieu_nai` ADD CONSTRAINT `khieu_nai_ma_dh_fkey` FOREIGN KEY (`ma_dh`) REFERENCES `don_hang`(`ma_dh`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `khieu_nai` ADD CONSTRAINT `khieu_nai_ma_kh_fkey` FOREIGN KEY (`ma_kh`) REFERENCES `khach_hang`(`ma_kh`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `chung_tu` ADD CONSTRAINT `chung_tu_ma_dh_fkey` FOREIGN KEY (`ma_dh`) REFERENCES `don_hang`(`ma_dh`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `chung_tu` ADD CONSTRAINT `chung_tu_ma_kh_fkey` FOREIGN KEY (`ma_kh`) REFERENCES `khach_hang`(`ma_kh`) ON DELETE SET NULL ON UPDATE CASCADE;

-- =====================================================================
-- 4) DỮ LIỆU MẪU (SEED) — khớp với prisma/seed.ts
--    Mật khẩu mọi tài khoản: 123456  (bcrypt, cost 10)
-- =====================================================================

-- 4.1) Nhân viên / Tài khoản đăng nhập
INSERT INTO `nhan_vien` (`email`, `password_hash`, `ho_ten`, `vai_tro`) VALUES
  ('admin@cu.vn',     '$2a$10$L5aWYkTi729kYUi10odE.eADgU0WrbbsU8RCKePkH7goNfEQBKfte', 'Quản trị viên',      'Admin'),
  ('cskh@cu.vn',      '$2a$10$L5aWYkTi729kYUi10odE.eADgU0WrbbsU8RCKePkH7goNfEQBKfte', 'Nhân viên CSKH',     'CSKH'),
  ('gdv@cu.vn',       '$2a$10$L5aWYkTi729kYUi10odE.eADgU0WrbbsU8RCKePkH7goNfEQBKfte', 'Giao dịch viên',     'GDV'),
  ('ketoan@cu.vn',    '$2a$10$L5aWYkTi729kYUi10odE.eADgU0WrbbsU8RCKePkH7goNfEQBKfte', 'Kế toán',            'KeToan'),
  ('muahang@cu.vn',   '$2a$10$L5aWYkTi729kYUi10odE.eADgU0WrbbsU8RCKePkH7goNfEQBKfte', 'Nhân viên Mua hàng', 'MuaHang'),
  ('khotq@cu.vn',     '$2a$10$L5aWYkTi729kYUi10odE.eADgU0WrbbsU8RCKePkH7goNfEQBKfte', 'Nhân viên Kho TQ',   'KhoTQ'),
  ('khovn@cu.vn',     '$2a$10$L5aWYkTi729kYUi10odE.eADgU0WrbbsU8RCKePkH7goNfEQBKfte', 'Nhân viên Kho VN',   'KhoVN'),
  ('kh001@gmail.com', '$2a$10$L5aWYkTi729kYUi10odE.eADgU0WrbbsU8RCKePkH7goNfEQBKfte', 'Anh Tuấn',           'Customer');

-- 4.2) Cài đặt hệ thống
INSERT INTO `cai_dat` (`ten`, `gia_tri`, `ghi_chu`) VALUES
  ('ty_gia_ndt_vnd', '3650',                       'Tỷ giá NDT → VND'),
  ('phi_mua_pct',    '2',                          'Phí mua hàng (%)'),
  ('phi_bh_pct',     '1',                          'Phí bảo hiểm (%)'),
  ('ten_cong_ty',    'CỪ EXCEL039 - SHIP TQ-VN',   'Tên doanh nghiệp'),
  ('zalo_lien_he',   '0901234567',                 'Zalo liên hệ');

-- 4.3) Khách hàng
INSERT INTO `khach_hang`
  (`ma_kh`, `ten_kh`, `sdt`, `email`, `dia_chi`, `tuyen`, `pct_coc`, `so_du_vi`, `updated_at`) VALUES
  ('KH001', 'Anh Tuấn - Shop ABC',     '0901234567', 'kh001@gmail.com', '123 Nguyễn Huệ, Q1, HCM', 'HCM',   70, 2000000, CURRENT_TIMESTAMP(3)),
  ('KH002', 'Chị Hằng - Beauty Shop',  '0912345678', NULL,              '45 Lê Lợi, Hà Nội',       'HaNoi', 80, 5000000, CURRENT_TIMESTAMP(3));

-- 4.4) Sản phẩm
INSERT INTO `san_pham`
  (`ma_sp`, `ten_sp`, `danh_muc`, `web_nguon`, `kg_goi_y`, `m3_goi_y`, `gia_tham_khao`) VALUES
  ('SP001', 'Áo thun nam form rộng size L', 'Thời trang nam', 'Taobao', 0.3, 0.002, 120000),
  ('SP002', 'Giày sneaker unisex',          'Giày dép',       '1688',   0.8, 0.008, 350000);

-- 4.5) Bảng giá vận chuyển (3 line × 3 loại hàng)
INSERT INTO `bang_gia`
  (`line`, `loai_hang`, `gia_kg_duoi_5`, `gia_kg_5_20`, `gia_kg_tren_20`, `gia_m3`, `phi_phu_pct`, `thoi_gian_du_kien`, `hoat_dong`, `updated_at`) VALUES
  ('LineNhanh',  'Thường',     55000, 50000, 45000, 4500000,  0, '3-5 ngày',   true, CURRENT_TIMESTAMP(3)),
  ('LineNhanh',  'Hàng dễ vỡ', 75000, 70000, 65000, 5500000,  5, '3-5 ngày',   true, CURRENT_TIMESTAMP(3)),
  ('LineNhanh',  'Mỹ phẩm',    85000, 80000, 75000, 6000000, 10, '3-5 ngày',   true, CURRENT_TIMESTAMP(3)),
  ('LineThuong', 'Thường',     35000, 30000, 25000, 3500000,  0, '7-10 ngày',  true, CURRENT_TIMESTAMP(3)),
  ('LineThuong', 'Hàng dễ vỡ', 50000, 45000, 40000, 4200000,  5, '7-10 ngày',  true, CURRENT_TIMESTAMP(3)),
  ('LineThuong', 'Mỹ phẩm',    60000, 55000, 50000, 4800000, 10, '7-10 ngày',  true, CURRENT_TIMESTAMP(3)),
  ('LineRe',     'Thường',     22000, 20000, 18000, 2500000,  0, '15-20 ngày', true, CURRENT_TIMESTAMP(3)),
  ('LineRe',     'Hàng dễ vỡ', 35000, 32000, 28000, 3000000,  5, '15-20 ngày', true, CURRENT_TIMESTAMP(3)),
  ('LineRe',     'Mỹ phẩm',    45000, 40000, 35000, 3500000, 10, '15-20 ngày', true, CURRENT_TIMESTAMP(3));

-- 4.6) Nhà cung cấp
INSERT INTO `ncc` (`ma_ncc`, `ten_ncc`, `wechat`, `ghi_chu`) VALUES
  ('NCC001', 'Shop ABC (Taobao)', 'abc123', 'NCC chính cho thời trang');

-- =====================================================================
--  HOÀN TẤT.
--  Đăng nhập thử (mật khẩu 123456):
--    Admin    : admin@cu.vn
--    CSKH     : cskh@cu.vn
--    GDV      : gdv@cu.vn
--    Kế toán  : ketoan@cu.vn
--    Mua hàng : muahang@cu.vn
--    Kho TQ   : khotq@cu.vn
--    Kho VN   : khovn@cu.vn
--    Customer : kh001@gmail.com  (Mã KH: KH001)
--  Tra cứu công khai (/tra-cuu): Mã KH = KH001, 4 số cuối SĐT = 4567
-- =====================================================================
