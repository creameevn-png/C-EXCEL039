# 🎬 KỊCH BẢN QUAY CLIP DEMO — Extension Mua Hộ Cừ (v2.4.0)

> Mục tiêu: clip ~**2–3 phút** quay màn hình, cho khách thấy extension chạy **từng click**.
> Quay bằng: phần mềm quay màn hình bất kỳ (Loom / OBS / ShareX / Bandicam / hoặc tính năng quay màn hình của Windows: **Win + Alt + R**).
> Mẹo: bật con trỏ chuột to + click highlight nếu phần mềm có (để khách thấy rõ đang bấm đâu).

---

## 0) CHUẨN BỊ TRƯỚC KHI QUAY (không quay phần này)
- [ ] Đã **cài extension** (giải nén `mua-ho-cu-extension-v2.4.0.zip` → `chrome://extensions` → bật **Developer mode** → **Load unpacked** → chọn thư mục → **ghim icon** lên thanh trình duyệt).
- [ ] Có sẵn **1 tài khoản nhân viên Mua hàng** (email + mật khẩu) đăng nhập được hệ thống.
- [ ] Mở sẵn **2 tab** để chuyển cho mượt:
  - Tab A: 1 **trang chi tiết sản phẩm** trên **1688** (loại có nhiều phân loại + bậc giá càng tốt).
  - Tab B: 1 **trang tìm kiếm** 1688 hoặc Taobao (gõ 1 từ khoá, ra lưới sản phẩm).
- [ ] Mở sẵn tab C: web hệ thống `https://cuexcel.vercel.app` (chưa cần đăng nhập).
- [ ] Đăng **xuất** extension trước (để quay được cảnh đăng nhập) — hoặc giữ nguyên nếu muốn bỏ qua cảnh login.

---

## 🎞️ PHÂN CẢNH (quay liên tục 1 lần, hoặc cắt ghép từng cảnh)

### CẢNH 1 — Mở đầu (0:00 – 0:10)
**Hình:** màn hình trình duyệt, con trỏ chỉ vào **icon 🛒 Mua Hộ Cừ** trên thanh.
**Thoại/caption:**
> "Đây là extension Mua Hộ — hỗ trợ **1688, Taobao, Tmall, JD.com**. Em demo nhanh từ lúc đăng nhập tới lúc sản phẩm vào hệ thống."

---

### CẢNH 2 — Đăng nhập extension (0:10 – 0:35)
**Click từng bước:**
1. Bấm **icon 🛒** trên thanh → popup mở ra, đang ở tab **"Cấu hình"**.
2. Bấm nút **"Dùng bản chạy thật"** → ô địa chỉ API tự điền `https://cuexcel.vercel.app/api/ext` (caption: *"1 chạm là xong địa chỉ"*).
3. Gõ **Tài khoản** (email) + **Mật khẩu** nhân viên.
4. Bấm **"Đăng nhập"** → hiện dòng xanh **"Đã có phiên đăng nhập."**

**Thoại:**
> "Bấm *Dùng bản chạy thật* là tự điền địa chỉ hệ thống, nhập tài khoản nhân viên rồi đăng nhập — xong."

---

### CẢNH 3 — Thêm sản phẩm từ TRANG CHI TIẾT (0:35 – 1:25) ⭐ *quan trọng nhất*
**Click từng bước:**
1. Chuyển sang **Tab A** (trang chi tiết 1688). Trỏ chuột vào nút nổi **"Thêm vào giỏ mua hộ"** (góc phải trang).
2. Bấm nút đó → hiện hộp **"Xác nhận thêm vào giỏ mua hộ"**. Dừng 2–3 giây cho khách thấy phần mềm **tự bắt**:
   - **Tên sản phẩm** (tiếng Trung) + ngay dưới là **🇻🇳 tên tiếng Việt** (tự dịch)
   - **Giá** + **≈ giá VNĐ** (theo tỉ giá hệ thống) + **bậc giá theo số lượng**
   - **Phân loại / SKU** (màu, size…) + bản dịch tiếng Việt
   - **Số lượng tối thiểu (MOQ)** — dòng gợi ý nhỏ
3. **Chọn 1 phân loại** (vd màu/size).
4. **Chọn Danh mục hàng hoá** (vd "Thời trang").
5. Sửa **Số lượng** (vd 10).
6. Gõ **Ghi chú cho NV mua hàng** (vd "chọn màu be, size L") + **Ghi chú riêng tư** (vd "khách VIP").
7. Bấm **"Xác nhận thêm"** → thông báo **"Đã thêm vào giỏ mua hộ."** → **icon 🛒** badge nhảy lên **1**.

**Thoại:**
> "Vào trang sản phẩm bất kỳ, bấm *Thêm vào giỏ mua hộ*. Extension **tự dịch tên sang tiếng Việt**, **hiện luôn giá VNĐ** theo tỉ giá công ty, lấy sẵn **phân loại**, **bậc giá**, **số lượng tối thiểu** — mình chỉ chọn **danh mục**, nhập số lượng, ghi chú rồi xác nhận. Không gõ tay gì cả."

---

### CẢNH 4 — Thêm NHANH từ TRANG TÌM KIẾM (1:25 – 1:55)
**Click từng bước:**
1. Chuyển sang **Tab B** (trang tìm kiếm / lưới sản phẩm).
2. Rê chuột lên 1 ô sản phẩm → xuất hiện nút **"Thêm nhanh vào giỏ mua hộ"** (góc ô).
3. Bấm nút đó ở **2–3 sản phẩm** liên tiếp → mỗi lần **badge tăng** (2, 3, 4…).

**Thoại:**
> "Ngay ở trang tìm kiếm, mỗi sản phẩm có nút *Thêm nhanh* — gom cả rổ chỉ vài cú click."

---

### CẢNH 5 — Xem lại Giỏ & Đơn trong popup (1:55 – 2:20)
**Click từng bước:**
1. Bấm **icon 🛒** → bấm tab **"Giỏ mua hộ"** → bấm **"Tải lại giỏ"** → hiện danh sách sản phẩm vừa thêm.
2. Bấm tab **"Đơn đã đặt"** → bấm **"Tải lại đơn"** → hiện các đơn trong hệ thống.

**Thoại:**
> "Trong popup xem lại ngay **giỏ mua hộ** và **đơn đã đặt** — không cần mở web."

---

### CẢNH 6 — Sản phẩm đã vào HỆ THỐNG (2:20 – 2:50) ⭐ *chốt giá trị*
**Click từng bước:**
1. Chuyển sang **Tab C** → đăng nhập web hệ thống (nếu chưa) → vào menu **"Giỏ mua hộ"** (`/gio-mua-ho`).
2. Chỉ vào các sản phẩm vừa đẩy từ extension — **đúng tên, ảnh, giá, phân loại** đã bắt.
3. (Tuỳ chọn) cho thấy nhân viên Mua hàng **chuyển sản phẩm thành đơn** từ đây.

**Thoại:**
> "Và đây — sản phẩm từ extension đã **nằm sẵn trong hệ thống**, nhân viên Mua hàng xử lý thành đơn ngay. Không nhập tay, không sai sót."

---

### CẢNH 7 — Kết (2:50 – 3:00)
**Thoại/caption:**
> "Extension hỗ trợ **1688 · Taobao · Tmall · JD**, **xem giá VNĐ**, **dịch tiếng Trung sang tiếng Việt**, chọn danh mục, bắt sản phẩm đẩy thẳng vào hệ thống — không nhập tay."

---

## 📝 GHI CHÚ KHI QUAY
- Nếu một sản phẩm bắt **thiếu vài trường** (do trang đặc thù) → **đừng quay sản phẩm đó**, chọn sản phẩm khác. (Bắt sai trường lẻ = bảo hành, nhưng demo nên chọn hàng "đẹp".)
- Che bớt **tài khoản/mật khẩu** lúc gõ nếu không muốn lộ (hoặc làm mờ khi dựng).
- Độ dài lý tưởng: **2–3 phút**. Nếu khách bận, cắt riêng **Cảnh 3** (40 giây) là đủ thuyết phục.
- Xuất video **1080p**, gửi khách qua Zalo/Drive.
