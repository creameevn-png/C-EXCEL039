-- Them cac cot moi vao DB production (TiDB Cloud) ma KHONG dung prisma db push
-- (db push bi chan boi index drift ASC/DESC + FK). Chi them cot, khong dung index.
-- Idempotent: chay lai nhieu lan van an toan (TiDB ho tro ADD COLUMN IF NOT EXISTS).

ALTER TABLE `lich_su_vi` ADD COLUMN IF NOT EXISTS `quy`      VARCHAR(191) NULL;
ALTER TABLE `nguon_hang` ADD COLUMN IF NOT EXISTS `danh_muc` VARCHAR(191) NULL;
ALTER TABLE `san_pham`   ADD COLUMN IF NOT EXISTS `danh_muc` VARCHAR(191) NULL;
