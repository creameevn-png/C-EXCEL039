# Mua Hộ – Extension 1688 / Taobao / Tmall (v2)

Chrome Extension (Manifest V3) cho công ty mua hộ:
- **Trang chi tiết:** nút nổi "Thêm vào giỏ mua hộ" → bóc tách sản phẩm → modal xác nhận
  (tự nhận **phân loại/SKU đang chọn**, gợi ý **số lượng tối thiểu MOQ**, sửa số lượng + ghi chú) → đẩy về API.
- **Trang tìm kiếm:** nút nhỏ **"+ Mua hộ"** trên từng thẻ sản phẩm để thêm nhanh.
- **Popup:** đăng nhập, kiểm tra kết nối, **xem giỏ mua hộ**, **đếm số sản phẩm đã thêm** hiện trên icon.

## Cài đặt (dev)
1. `chrome://extensions` → bật **Developer mode**.
2. **Load unpacked** → chọn thư mục `mua-ho-extension`.
3. Bấm icon → nhập **Địa chỉ API** → **Đăng nhập** (hoặc dán token).
4. Mở trang sản phẩm/tìm kiếm 1688/Taobao → dùng.

## BẮT BUỘC chỉnh trước khi chạy thật
Trong `manifest.json`, đổi `https://api.muaho.example.com/*` ở `host_permissions` thành domain backend
thật của bạn (không sẽ bị CORS chặn khi service worker fetch).

## Hợp đồng API (backend cần 4 endpoint)
- `POST /auth/login`  body `{username,password}` → `{token, user}`
- `GET  /me`          (Bearer) → 200 nếu token hợp lệ, 401 nếu không
- `GET  /cart`        (Bearer) → `{items:[...]}` hoặc mảng items
- `POST /cart/add`    (Bearer) → body như dưới, trả `{success, cartItemId, message}`; 401 khi hết hạn

### Body của POST /cart/add
```json
{
  "source": "1688",
  "productId": "812345678901",
  "productUrl": "https://detail.1688.com/offer/812345678901.html",
  "title": "Áo len cổ lọ nam...",
  "image": "https://cbu01.alicdn.com/....jpg",
  "images": ["...", "..."],
  "priceText": "39.5",
  "priceValue": 39.5,
  "currency": "CNY",
  "quantity": 5,
  "minQuantity": 2,
  "sku": ["Be", "Size L"],
  "skuText": "Be / Size L",
  "note": "chọn màu be, size L",
  "fromListing": false,
  "raw": { "skuModel": {}, "priceRanges": [] },
  "capturedAt": "2026-06-20T03:00:00.000Z"
}
```

## Bảo trì
- Selector trang chi tiết: `content/extractors.js` → `SELECTORS`.
- Mẫu link sản phẩm trang tìm kiếm: `content/listing.js` → `PRODUCT_LINK`.
- Vì luôn có bước xác nhận trong modal nên kể cả khi đọc thiếu giá/SKU vẫn thêm được (nhập tay).

## Tài liệu kèm theo
`HuongDan-MuaHo-Extension.pdf` — hướng dẫn 6 trang A4, từng click, cho nhân viên.
