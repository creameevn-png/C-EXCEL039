# CỪ EXCEL039 — Next.js + MySQL (V3.6.x)

ERP nhập hàng Trung Quốc, migration từ Google Apps Script sang **Next.js 15 + MySQL (Prisma) + bcrypt**.
Bản này đã apply canonical schema/logic từ `ShipCu_WebERP_v3.2` sample (giữ MySQL/Prisma/bcrypt thay vì Supabase).

## Stack
- Next.js 15 (App Router, React 18, Server Components)
- TypeScript strict
- MySQL 8 + Prisma 5 (10+ tables, 8 enums)
- bcryptjs cho password hash, `jose` JWT trong HttpOnly cookie
- CSS thuần (không Tailwind) — khớp class của UI gốc

## Cấu trúc trang (28 routes)
```
PUBLIC (không cần login)
├── /                    → redirect tới /tra-cuu hoặc dashboard
├── /tra-cuu             Tra cứu KH (Mã KH + 4 số cuối SĐT)
├── /khieu-nai           Gửi khiếu nại (gắn vào KH/đơn)
├── /login               Đăng nhập

NHÂN VIÊN
├── /dashboard           Redirect theo role
├── /cskh                Tạo đơn (đa SP, NDT × tỷ giá), KH, ví
├── /gdv                 Mã GD, mã VĐ
├── /ketoan              Xác nhận thanh toán
├── /mua-hang            Nguồn hàng + NCC
├── /khotq               Nhận từ NCC, chuyển VN (kèm ảnh)
├── /khovn               Nhận từ TQ, chờ TT, giao KH
├── /in-tem              In tem dán kiện hàng (?ma=DH-…)
├── /dat-hang            Tạo đơn nhanh (Customer / staff)

CUSTOMER
└── /customer            Khách tự theo dõi đơn của mình

ADMIN
├── /admin               Bảng điều khiển + 8 sub-pages
├── /admin/don-hang      Tất cả đơn + lọc trạng thái
├── /admin/khach-hang    Toàn bộ KH (doanh thu, công nợ, tổng đơn)
├── /admin/san-pham      DB SP
├── /admin/users         Quản lý NV: tạo, đổi role, khóa, đổi pwd
├── /admin/khieu-nai     Xử lý + duyệt 2 tầng
├── /admin/bang-gia      3 line vận chuyển × loại hàng
├── /admin/cai-dat       Tỷ giá NDT, % phí, tên DN, Zalo
└── /admin/audit-log     Log hoạt động hệ thống

API
├── /api/auth/login      bcrypt + JWT cookie
├── /api/auth/logout
└── /api/action          Master dispatcher (~25 actions)
```

## Database (`prisma/schema.prisma`)

**Bảng:**
- `nhan_vien` (users) — `trang_thai: HoatDong/TamKhoa`
- `khach_hang` — `cong_no`, `tong_don`, `doanh_thu`, `pct_coc`
- `san_pham` — Database SP để CSKH chọn nhanh
- `ncc` — Nhà cung cấp
- `don_hang` — Master đơn, dùng enum status (12 trạng thái), `line_vc`, `loai_hang`, 4 ảnh xử lý
- `chi_tiet_don` — **Line items** (NDT × tỷ giá = VND × số lượng = thành tiền)
- `lich_su_vi` — Nạp/trừ ví
- `thu_chi` — Thanh toán
- `cai_dat` — Settings động: `ty_gia_ndt_vnd`, `phi_mua_pct`, `phi_bh_pct`, `ten_cong_ty`, `zalo_lien_he`
- `hoat_dong` — Audit log
- `khieu_nai` — Khiếu nại + duyệt 2 tầng (Manager → Admin)
- `bang_gia` — 3 line × loại hàng × bậc kg + m³
- `nguon_hang` — Sản phẩm nguồn (cho Mua hàng)
- `chung_tu` — Chứng từ (PhieuThu, PhieuChi, HoaDon, ...)

**Enums:**
- `VaiTro`: Admin, CSKH, GDV, KeToan, MuaHang, KhoTQ, KhoVN, Customer
- `TrangThaiDon`: DonMoiTao, DatCoc, DaMuaHang, NccGiaoHang, KhoTqNhan, DangVanChuyen, KhoVnNhan, ChoThanhToan, GiaoHang, HoanThanh, Huy, KHTuDat
- `TrangThaiUser`: HoatDong, TamKhoa
- `TrangThaiKN`: ChoXuLy → DangXuLy → DangDuyetCap1 → DangDuyetCap2 → DuyetDoiTra/HoanTien/GiamGia/TuChoi → DaXuLy
- `LoaiKN`: HangLoi, ThieuHang, GiaoSai, KhongNhan, Khac
- `LineVC`: LineNhanh (3-5 ngày), LineThuong (7-10 ngày), LineRe (15-20 ngày)
- `Tuyen`: HaNoi, HCM

## Cài đặt

```bash
cd nextjs-app
npm install
copy .env.example .env       # Windows
# Sửa DATABASE_URL + SESSION_SECRET
npm run db:push              # tạo schema
npm run db:seed              # seed users + KH + SP + cài đặt + bảng giá
npm run dev                  # http://localhost:3000
```

**SESSION_SECRET** (PowerShell):
```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

## Tài khoản mặc định (mật khẩu **`123456`**)
| Email | Vai trò | Trang đích |
|---|---|---|
| `admin@cu.vn` | Admin | `/admin` |
| `cskh@cu.vn` | CSKH | `/cskh` |
| `gdv@cu.vn` | GDV | `/gdv` |
| `ketoan@cu.vn` | Kế toán | `/ketoan` |
| `muahang@cu.vn` | Mua hàng | `/mua-hang` |
| `khotq@cu.vn` | Kho TQ | `/khotq` |
| `khovn@cu.vn` | Kho VN | `/khovn` |
| `kh001@gmail.com` | Customer | `/customer` (gắn với KH001) |

**Tra cứu public**: `/tra-cuu` — KH001 + 4 số cuối `4567`

> ⚠️ Đổi mật khẩu admin ngay sau khi cài. Vào `/admin/users` để đổi.

## Business rules áp dụng từ sample

### Phí (config được từ `cai_dat`)
- **Phí mua hàng** = `tổng_giá_hàng × phi_mua_pct%` (mặc định 2%, làm tròn nghìn)
- **Phí bảo hiểm** = `tổng_giá_hàng × phi_bh_pct%` (mặc định 1%, làm tròn nghìn)
- **Tỷ giá NDT** = `ty_gia_ndt_vnd` (mặc định 3650 — sửa trong `/admin/cai-dat`)
- **Phí VC**:
  - Panama bậc thang (mặc định) — `lib/shipping-fee.ts → calcPhiVCPanama`
  - 3 line (LineNhanh/LineThuong/LineRe) × loại hàng — bảng `bang_gia`
  - MAX(phí kg, phí m³) + phí phụ %

### Vòng đời đơn (12 trạng thái)
```
[CSKH tạo + chọn KH] → DonMoiTao
[CSKH xác nhận cọc, trừ ví KH] → DatCoc
[GDV nhập mã GD bên NCC] → DaMuaHang
[GDV nhập mã VĐ] → NccGiaoHang
[Kho TQ nhận + ảnh] → KhoTqNhan
[Kho TQ chuyển VN + ảnh] → DangVanChuyen
[Kho VN nhận] → KhoVnNhan (nếu chưa đủ tiền: ChoThanhToan)
[Kế toán xác nhận đủ TT] → GiaoHang
[Kho VN giao + ảnh] → HoanThanh (+ cộng doanh thu KH)
```

### Đơn = nhiều SP (chi_tiet_don)
Mỗi SP có: tên, số lượng, **đơn giá NDT × tỷ giá → đơn giá VND**, thành tiền = đơn giá VND × số lượng, kg/sp, m³/sp, web nguồn, link Taobao/1688/Tmall. Trigger logic (recompute) tự tính `tong_gia_hang`, `tong_kg`, `tong_m3`, `phi_mua`, `phi_bh`, `phi_vc`, `tong_tien`, `con_lai` mỗi khi đơn thay đổi.

### Khiếu nại 2 tầng
KH gửi qua `/khieu-nai` → CSKH/Kế toán xử lý (DangXuLy) → Duyệt cấp 1 (Manager) → Admin duyệt cấp 2 → DaXuLy hoặc TuChoi.

### Audit
Tất cả action quan trọng (tạo đơn, xác nhận cọc, đổi role user, set cài đặt, …) log vào `hoat_dong` → xem ở `/admin/audit-log`.

### Bảo mật tra cứu public
KH chỉ cần Mã KH + **4 số cuối SĐT** — 2 lớp khớp mới trả dữ liệu.

## Mapping action ↔ handler

| GAS / sample | Next.js `/api/action` action | File handler |
|---|---|---|
| `createOrder(data)` | `createOrder` | route.ts |
| `addCustomer(data)` | `addCustomer` | route.ts |
| `addProduct(data)` | `addProduct` | route.ts |
| `topupWallet(maKH, amount, note)` | `topupWallet` | route.ts |
| `confirmDeposit(maDH)` | `confirmDeposit` | route.ts |
| `updateMaGD(maDH, maGD)` | `updateMaGD` | route.ts |
| `updateMaVD(maDH, maVD)` | `updateMaVD` | route.ts |
| `confirmPayment(maDH, amount, note)` | `confirmPayment` | route.ts |
| `confirmKhoTQ(maDH, img)` | `confirmKhoTQ` | route.ts |
| `markLeftTQ(maDH, img)` | `markLeftTQ` | route.ts |
| `confirmKhoVN(maDH, img)` | `confirmKhoVN` | route.ts |
| `confirmDelivered(maDH, img)` | `confirmDelivered` | route.ts |
| `getOrderDetail(maDH)` | `getOrderDetail` | route.ts |
| `lookupCustomer(maKH)` | `lookupCustomer(maKH, sdtLast4)` | route.ts |
| _(mới)_ | `createKhieuNai`, `updateKhieuNai`, `duyetKhieuNaiCap1`, `duyetKhieuNaiCap2` | route.ts |
| _(mới)_ | `createUser`, `updateUser`, `setSetting`, `updateKhachHang` | route.ts |

## So với sample (ShipCu_WebERP_v3.2)

**Apply 100%:**
- Schema đầy đủ (10+ table, 8 enum, chi tiết đơn, khiếu nại 2 tầng, cài đặt, audit, bảng giá, nguồn hàng)
- 12 trạng thái đơn + label/màu y chang
- Tỷ giá + phí % đọc từ `cai_dat` (không hard-code)
- Bảo mật tra cứu 2 lớp (Mã KH + SĐT 4 số cuối)
- Customer portal, Public lookup, Print labels, Khiếu nại tầng

**Khác (do giữ MySQL/bcrypt):**
- Sample dùng **Supabase auth (Google OAuth)** → ta dùng **bcrypt email/password** (theo yêu cầu)
- Sample dùng **Supabase RLS policies** → ta check trong code (`requireRole`, `allow()`)
- Sample lưu ảnh **Supabase Storage** → ta lưu **base64 trong cột TEXT** (nhanh setup, đổi sau)
- Sample dùng **Tailwind CSS** → ta dùng **CSS thuần** (khớp class HTML gốc)

## File mới được thêm (so với V3.6.2 migration đầu)

```
prisma/
  schema.prisma          ← rewrite hoàn toàn (8 enum, 13 model)
  seed.ts                ← 8 user (thêm MuaHang + Customer), 9 row bảng giá, 5 cài đặt
src/lib/
  settings.ts            ← getSetting/setSetting (cache 30s)
  audit.ts               ← logActivity
  export.ts              ← exportToCSV
src/app/
  tra-cuu/               ← Public, 2-factor lookup
  khieu-nai/             ← Public, KH gửi khiếu nại
  customer/              ← Customer portal
  dat-hang/              ← Đặt đơn nhanh (KH hoặc staff)
  dashboard/             ← Redirect theo role
  mua-hang/              ← Module Mua hàng
  in-tem/                ← In tem dán kiện hàng
  admin/don-hang/        ← Tất cả đơn + filter status
  admin/khach-hang/      ← Tất cả KH
  admin/san-pham/        ← DB SP
  admin/users/           ← CRUD nhân viên
  admin/cai-dat/         ← Settings editor
  admin/audit-log/       ← Activity log viewer
  admin/khieu-nai/       ← Xử lý + duyệt 2 tầng
  admin/bang-gia/        ← 3 line VC viewer
```

## Bước tiếp theo (TODO P3)

- CRUD UI cho `bang_gia`, `nguon_hang`, `ncc`, `chung_tu` (hiện chỉ list/seed)
- Upload ảnh ra storage thực (`/public/uploads` hoặc S3/R2) thay vì base64
- Báo cáo doanh thu/lợi nhuận (`/admin/bao-cao`)
- Export CSV cho mọi bảng (đã có helper `lib/export.ts`)
- Real-time cập nhật (SSE) thay vì `window.location.reload()`
- Triển khai production: Docker compose + Caddy + MySQL

# C-EXCEL039
