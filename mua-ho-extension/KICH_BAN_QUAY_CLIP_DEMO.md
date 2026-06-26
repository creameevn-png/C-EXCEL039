# 🎬 KỊCH BẢN QUAY CLIP DEMO — Extension Mua Hộ Cừ (v2.6.0 · mode KHÁCH tự đặt)

> Mục tiêu: clip ~**2–3 phút** quay màn hình, cho khách thấy: **khách lên 1688 → bấm "Tôi muốn đặt sản phẩm này" → yêu cầu về thẳng hệ thống bên Cừ**.
> Quay bằng: Loom / OBS / ShareX / Bandicam / hoặc **Win + Alt + R** (Windows).
> Mẹo: bật con trỏ chuột to + click highlight (để thấy rõ bấm đâu).

---

## 0) CHUẨN BỊ TRƯỚC KHI QUAY (không quay phần này)
- [ ] Đã **cài extension** (giải nén `mua-ho-cu-extension-v2.6.0.zip` → `chrome://extensions` → bật **Developer mode** → **Load unpacked** → chọn thư mục → **ghim icon**).
- [ ] Mở sẵn **2 tab**:
  - Tab A: 1 **trang chi tiết sản phẩm** trên **1688** (loại nhiều phân loại + bậc giá càng tốt).
  - Tab B: 1 **trang tìm kiếm** 1688 hoặc Taobao (ra lưới sản phẩm).
- [ ] Tab C (để khoe phía hệ thống): web bên Cừ `https://cuexcel.vercel.app` → đăng nhập **tài khoản nhân viên** → mở sẵn trang **Yêu cầu mua hàng** (`/admin/yeu-cau`).
- [ ] Xoá thông tin khách cũ trong extension (nếu muốn quay cảnh nhập từ đầu).

---

## 🎞️ PHÂN CẢNH

### CẢNH 1 — Mở đầu (0:00 – 0:10)
**Hình:** màn hình trình duyệt, con trỏ chỉ vào **icon 🛒 Mua Hộ Cừ**.
**Thoại:**
> "Đây là extension Mua Hộ cho **khách hàng** — lên 1688/Taobao/Tmall, chọn sản phẩm, gửi yêu cầu thẳng về hệ thống bên mình. Em demo từ phía khách tới lúc yêu cầu vào hệ thống."

---

### CẢNH 2 — Khách nhập thông tin 1 lần (0:10 – 0:35)
**Click từng bước:**
1. Bấm **icon 🛒** → popup mở, tab **"Khách hàng"**.
2. Bấm **"Dùng bản chạy thật"** → ô địa chỉ tự điền `https://cuexcel.vercel.app/api/ext`.
3. Nhập **Họ tên** + **Số điện thoại** (khách cũ thì nhập thêm **Mã KH**).
4. Bấm **"Lưu thông tin"** → hiện dòng xanh *"Đang đặt với tên: … · SĐT…"*.

**Thoại:**
> "Khách chỉ cần nhập **họ tên + số điện thoại** một lần. Là khách cũ thì thêm Mã KH. Xong, bắt đầu chọn hàng."

---

### CẢNH 3 — Khách chọn sản phẩm từ TRANG CHI TIẾT (0:35 – 1:30) ⭐ *quan trọng nhất*
**Click từng bước:**
1. Sang **Tab A** (trang chi tiết 1688). Trỏ vào nút nổi **"Tôi muốn đặt sản phẩm này"** (góc phải).
2. Bấm → hiện hộp **"Gửi yêu cầu đặt hàng"**. Dừng 2–3 giây cho thấy:
   - **Tên tiếng Trung** + ngay dưới **🇻🇳 tên tiếng Việt** (tự dịch)
   - **Giá** + **≈ giá VNĐ** (theo tỉ giá hệ thống) + **bậc giá theo số lượng**
   - **Phân loại / SKU** + bản dịch
   - **Số lượng tối thiểu (MOQ)**
3. **Chọn phân loại** + **Danh mục hàng hoá** (vd "Thời trang") + **Số lượng**.
4. Gõ **Ghi chú cho NV mua hàng** + **Ghi chú riêng tư** (nếu cần).
5. Bấm **"Gửi yêu cầu"** → thông báo **"Đã gửi yêu cầu YC-… (1 sản phẩm)."**

**Thoại:**
> "Khách bấm *Tôi muốn đặt sản phẩm này*. Extension **tự dịch tên sang tiếng Việt**, **hiện giá VNĐ** theo tỉ giá công ty, lấy sẵn phân loại + bậc giá + số lượng tối thiểu. Khách chọn danh mục, ghi chú rồi **Gửi yêu cầu** — là xong, không cần gọi điện nhắn tin."

---

### CẢNH 4 — Gửi nhanh từ TRANG TÌM KIẾM (1:30 – 1:55)
**Click từng bước:**
1. Sang **Tab B** (trang tìm kiếm).
2. Rê chuột lên 1 ô sản phẩm → hiện nút **"+ Muốn đặt"** → bấm ở **2–3 sản phẩm**.
3. Mỗi lần gửi, các sản phẩm **gộp chung vào 1 yêu cầu** của khách (cùng SĐT).

**Thoại:**
> "Ngay ở trang tìm kiếm cũng có nút *Muốn đặt* — khách gom nhiều món, hệ thống tự gộp vào **một yêu cầu**."

---

### CẢNH 5 — "Yêu cầu của tôi" trong popup (1:55 – 2:20)
**Click từng bước:**
1. Bấm **icon 🛒** → tab **"Yêu cầu của tôi"** → bấm **"Tải lại"**.
2. Hiện danh sách yêu cầu đã gửi: **mã YC · số sản phẩm · trạng thái** (Chờ xử lý…).

**Thoại:**
> "Khách theo dõi yêu cầu của mình ngay trong extension — mã yêu cầu, số sản phẩm, trạng thái xử lý."

---

### CẢNH 6 — Yêu cầu đã vào HỆ THỐNG bên Cừ (2:20 – 2:50) ⭐ *chốt giá trị*
**Click từng bước:**
1. Sang **Tab C** (đã đăng nhập nhân viên) → trang **Yêu cầu mua hàng** (`/admin/yeu-cau`) → bấm **Tải lại / F5**.
2. Chỉ vào yêu cầu **YC-…** vừa gửi — đúng **tên khách, SĐT, danh sách sản phẩm** (tên Việt, link, số lượng, giá, danh mục, ghi chú).
3. (Tuỳ chọn) cho thấy nhân viên **xử lý → tạo đơn** từ yêu cầu này.

**Thoại:**
> "Và đây — yêu cầu của khách đã **nằm sẵn trong hệ thống bên mình**, đầy đủ thông tin sản phẩm. Nhân viên chỉ việc báo giá, tạo đơn. Không nhập tay, không sót."

---

### CẢNH 7 — Kết (2:50 – 3:00)
**Thoại/caption:**
> "Extension cho khách tự đặt từ **1688 · Taobao · Tmall**: **giá VNĐ**, **dịch tiếng Trung sang tiếng Việt**, chọn danh mục, ghi chú → **yêu cầu về thẳng hệ thống**. Đúng kiểu chuyên nghiệp."

---

## 📝 GHI CHÚ KHI QUAY
- Sản phẩm bắt **thiếu vài trường** (trang đặc thù) → chọn sản phẩm khác cho demo "đẹp" (bắt sai trường lẻ = bảo hành).
- Che/làm mờ **SĐT thật** nếu không muốn lộ.
- Độ dài lý tưởng **2–3 phút**. Khách bận → cắt riêng **Cảnh 3 + Cảnh 6** (~70 giây) là đủ thuyết phục.
- Xuất **1080p**, gửi Zalo/Drive.
