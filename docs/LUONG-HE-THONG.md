# 📦 Cừ EXCEL039 — Luồng hệ thống

Hệ thống mua hộ & vận chuyển hàng **Trung Quốc → Việt Nam**.

## Luồng đơn hàng
```
Khách gửi yêu cầu → CSKH báo giá & lên đơn → Đặt cọc
→ GDV mua hàng (TQ) → Kho TQ nhận → Vận chuyển về VN
→ Kho VN nhận → Thanh toán đủ → Giao khách → Hoàn thành ✅
```

## Khách hàng làm gì?
1. **Gửi yêu cầu mua** (`/yeu-cau`): tên + SĐT + link sản phẩm → CSKH liên hệ báo giá.
2. **Đặt cọc** khi chốt đơn (nhận Mã đơn `DH-…`).
3. **Theo dõi** đơn tại `/tra-cuu` (Mã KH + 4 số cuối SĐT).
4. **Thanh toán nốt** khi hàng về VN → **nhận hàng**.
5. Có sự cố → **gửi khiếu nại** (`/khieu-nai`).

## 6 mốc tiến trình (trên trang tra cứu)
**Cọc → Mua → Vận chuyển → Về VN → Giao → Xong**

| Trạng thái | Nghĩa | Mốc |
|---|---|---|
| Đặt cọc | Đã nhận cọc | Cọc |
| Đã mua hàng / NCC giao hàng | Đã mua trên web TQ | Mua |
| Kho TQ nhận / Đang vận chuyển | Đang về VN | Vận chuyển |
| Kho VN nhận / Chờ thanh toán | Đã về kho VN | Về VN |
| Giao hàng | Đủ tiền, đang giao | Giao |
| Hoàn thành ✅ | Đã nhận hàng | Xong |

## Chi phí
**Tổng tiền = Giá hàng + Phí mua (~2%) + Bảo hiểm (~1%) + Phí vận chuyển (theo kg & m³) + phí khác.**
Cọc một phần khi chốt đơn (mặc định 70%), trả nốt phần còn lại trước khi nhận hàng.

## Vai trò nội bộ
| Vai trò | Việc chính | Đơn chuyển sang |
|---|---|---|
| CSKH | Tiếp nhận YC, lên đơn, xác nhận cọc | Đặt cọc |
| GDV | Nhập mã giao dịch / mã vận đơn | Đã mua → NCC giao hàng |
| Kho TQ | Nhận hàng, gửi về VN | Kho TQ nhận → Đang vận chuyển |
| Kho VN | Nhận tại VN, giao khách | Kho VN nhận → Hoàn thành |
| Kế toán | Xác nhận thu đủ tiền | Giao hàng |
| Admin | Quản trị toàn hệ thống | — |

## Trang công khai (không cần đăng nhập)
- `/tra-cuu` — tra cứu đơn (Mã KH + 4 số cuối SĐT)
- `/yeu-cau` — gửi yêu cầu mua hàng
- `/khieu-nai` — gửi khiếu nại
- `/login` — đăng nhập nhân viên / khách có tài khoản

---
*V3.6.2 — ERP Ship TQ · VN*
