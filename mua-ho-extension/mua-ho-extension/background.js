/**
 * background.js v2 (service worker, MV3)
 * Trung gian giữa content/popup và API hệ thống mua hộ (đặt fetch ở đây để tránh CORS).
 * v2: đếm số sản phẩm đã thêm trong phiên hiện ra trên icon (badge) + lấy giỏ hàng.
 *
 * Cấu hình lưu trong chrome.storage.local: apiBase, token.
 */

const SETTINGS_KEYS = ["apiBase", "token"];

function getSettings() {
  return new Promise((resolve) => chrome.storage.local.get(SETTINGS_KEYS, (s) => resolve(s || {})));
}
function trimBase(base) { return (base || "").trim().replace(/\/+$/, ""); }

async function apiFetch(path, { method = "GET", body, token } = {}) {
  const { apiBase, token: storedToken } = await getSettings();
  const base = trimBase(apiBase);
  if (!base) return { ok: false, needSetup: true, message: "Chưa cấu hình địa chỉ API." };
  const headers = { "Content-Type": "application/json" };
  const useToken = token || storedToken;
  if (useToken) headers["Authorization"] = "Bearer " + useToken;
  try {
    const resp = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const text = await resp.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { raw: text }; }
    return { ok: resp.ok, status: resp.status, data };
  } catch (e) {
    return { ok: false, message: "Không kết nối được tới API. Kiểm tra địa chỉ và mạng." };
  }
}

/* ---- Badge = số sản phẩm đang trong GIỎ (EXT-7) ----
 * Trước đây badge đếm "số SP đã gửi trong phiên"; nay giỏ là nguồn duy nhất.
 * Giữ bumpBadge() cho các luồng cũ (MH_PUSH_YEUCAU / MH_ADD_TO_CART) nhưng chỉ
 * đồng bộ lại badge theo giỏ để không ghi đè số lượng giỏ.
 */
async function bumpBadge() {
  await refreshCartBadge();
}
chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeBackgroundColor({ color: "#f0512b" });
  refreshCartBadge();
});
chrome.runtime.onStartup && chrome.runtime.onStartup.addListener(() => {
  // Badge = số SP đang trong giỏ (giỏ được giữ qua các phiên).
  refreshCartBadge();
});

/* ---- Message router ---- */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || !msg.type) return;
  if (msg.type === "MH_ADD_TO_CART") { handleAddToCart(msg.payload).then(sendResponse); return true; }
  if (msg.type === "MH_LOGIN") { handleLogin(msg.username, msg.password).then(sendResponse); return true; }
  if (msg.type === "MH_TEST") { handleTest().then(sendResponse); return true; }
  if (msg.type === "MH_GET_CART") { handleGetCart().then(sendResponse); return true; }
  if (msg.type === "MH_GET_ORDERS") { handleGetOrders().then(sendResponse); return true; }
  if (msg.type === "MH_TRANSLATE") { handleTranslate(msg.texts).then(sendResponse); return true; }
  if (msg.type === "MH_GET_CONFIG") { handleGetConfig().then(sendResponse); return true; }
  if (msg.type === "MH_PUSH_YEUCAU") { handlePushYeuCau(msg.product).then(sendResponse); return true; }
  if (msg.type === "MH_GET_YEUCAU") { handleGetYeuCau().then(sendResponse); return true; }
  if (msg.type === "MH_CART_ADD") { handleCartAdd(msg.product).then(sendResponse); return true; }
  if (msg.type === "MH_CART_LIST") { handleCartList().then(sendResponse); return true; }
  if (msg.type === "MH_CART_REMOVE") { handleCartRemove(msg.cartId).then(sendResponse); return true; }
  if (msg.type === "MH_CART_CLEAR") { handleCartClear().then(sendResponse); return true; }
  if (msg.type === "MH_CART_SUBMIT") { handleCartSubmit().then(sendResponse); return true; }
  if (msg.type === "MH_RESET_BADGE") {
    chrome.storage.local.set({ mhAdded: 0 });
    chrome.action.setBadgeText({ text: "" });
    sendResponse({ ok: true });
    return true;
  }
});

async function handleAddToCart(payload) {
  const { token, apiBase } = await getSettings();
  if (!trimBase(apiBase)) return { ok: false, needSetup: true, message: "Chưa cấu hình API." };
  if (!token) return { ok: false, needSetup: true, message: "Chưa đăng nhập." };

  const body = {
    source: payload.source,
    productId: payload.productId,
    productUrl: payload.url,
    title: payload.title,
    image: payload.image,
    images: payload.images || [],
    priceText: payload.priceText,
    priceValue: payload.priceValue,
    currency: payload.currency,
    quantity: payload.quantity,
    minQuantity: payload.moq || 1,
    sku: payload.skuValues || [],
    skuText: payload.skuText || "",
    note: payload.note || "",
    fromListing: !!payload.fromListing,
    raw: payload.probe || null,
    capturedAt: payload.capturedAt,
  };

  const res = await apiFetch("/cart/add", { method: "POST", body });
  if (res.needSetup) return res;
  if (res.ok) {
    bumpBadge();
    return { ok: true, message: (res.data && res.data.message) || "Đã thêm vào giỏ mua hộ.", data: res.data };
  }
  if (res.status === 401) return { ok: false, needSetup: true, message: "Phiên đăng nhập hết hạn. Đăng nhập lại." };
  return { ok: false, message: (res.data && (res.data.message || res.data.error)) || res.message || "Thêm thất bại." };
}

async function handleLogin(username, password) {
  const res = await apiFetch("/auth/login", { method: "POST", body: { username, password } });
  if (res.needSetup) return res;
  if (res.ok && res.data && res.data.token) {
    await chrome.storage.local.set({ token: res.data.token });
    return { ok: true, user: res.data.user || null };
  }
  return { ok: false, message: (res.data && (res.data.message || res.data.error)) || "Sai tài khoản hoặc mật khẩu." };
}

async function handleTest() {
  const res = await apiFetch("/me", { method: "GET" });
  if (res.needSetup) return res;
  if (res.ok) return { ok: true, data: res.data };
  if (res.status === 401) return { ok: false, message: "Token không hợp lệ / chưa đăng nhập." };
  return { ok: false, message: res.message || "Kết nối thất bại (HTTP " + (res.status || "?") + ")." };
}

async function handleGetCart() {
  const res = await apiFetch("/cart", { method: "GET" });
  if (res.needSetup) return res;
  if (res.ok) {
    const data = res.data;
    const items = Array.isArray(data) ? data : data.items || [];
    return { ok: true, items };
  }
  if (res.status === 401) return { ok: false, needSetup: true, message: "Chưa đăng nhập." };
  return { ok: false, message: res.message || "Không lấy được giỏ hàng." };
}

/* ---- Khách hàng tự đặt: đẩy "yêu cầu đặt hàng" về hệ thống bên Cừ ---- */
function getCustomer() {
  return new Promise((resolve) => chrome.storage.local.get("customer", (s) => resolve(s.customer || null)));
}

async function handlePushYeuCau(product) {
  const { apiBase } = await getSettings();
  if (!trimBase(apiBase)) return { ok: false, needSetup: true, message: "Chưa cấu hình địa chỉ hệ thống." };
  const kh = await getCustomer();
  if (!kh || !kh.hoTen || !kh.sdt) return { ok: false, needCustomer: true, message: "Chưa nhập thông tin khách. Mở extension điền Họ tên + SĐT." };

  const body = {
    maKH: kh.maKH || "", hoTen: kh.hoTen, sdt: kh.sdt, email: kh.email || "", tuyen: kh.tuyen || "HaNoi",
    product: product,
  };
  const res = await apiFetch("/yeu-cau", { method: "POST", body });
  if (res.needSetup) return res;
  if (res.ok && res.data && res.data.success) {
    bumpBadge();
    const c = res.data.count || 1;
    return { ok: true, message: `Đã gửi yêu cầu ${res.data.maYC} (${c} sản phẩm).`, data: res.data };
  }
  return { ok: false, message: (res.data && res.data.message) || res.message || "Gửi yêu cầu thất bại." };
}

async function handleGetYeuCau() {
  const kh = await getCustomer();
  if (!kh || !kh.sdt) return { ok: false, needCustomer: true, message: "Chưa nhập thông tin khách." };
  const res = await apiFetch("/yeu-cau?sdt=" + encodeURIComponent(kh.sdt), { method: "GET" });
  if (res.needSetup) return res;
  if (res.ok) {
    const items = (res.data && res.data.items) || [];
    return { ok: true, items };
  }
  return { ok: false, message: res.message || "Không lấy được yêu cầu." };
}

/* =========================================================================
 * GIỎ YÊU CẦU (client-side) — EXT-7
 * Khách gom NHIỀU sản phẩm vào giỏ, xem/sửa/xoá trong popup, rồi bấm
 * "Gửi tất cả (N SP)" -> tất cả dồn vào 1 YÊU CẦU.
 * Backend /api/ext/yeu-cau tự GỘP các SP cùng SĐT (còn "Chờ xử lý") vào 1 yêu
 * cầu, nên gửi tuần tự từng SP vẫn cho ra đúng 1 mã yêu cầu — không cần sửa backend.
 * ======================================================================= */
function getCart() {
  return new Promise((resolve) => chrome.storage.local.get("mhCart", (s) => resolve(Array.isArray(s.mhCart) ? s.mhCart : [])));
}
function setCart(cart) {
  return new Promise((resolve) => chrome.storage.local.set({ mhCart: cart }, resolve));
}
async function refreshCartBadge() {
  const cart = await getCart();
  const n = cart.length;
  chrome.action.setBadgeText({ text: n ? String(n) : "" });
}

async function handleCartAdd(product) {
  if (!product || (!product.url && !product.title)) return { ok: false, message: "Thiếu thông tin sản phẩm." };
  const cart = await getCart();
  const item = { ...product, cartId: "c" + Date.now() + "_" + Math.random().toString(36).slice(2, 7), addedAt: Date.now() };
  cart.push(item);
  await setCart(cart);
  await refreshCartBadge();
  return { ok: true, count: cart.length, message: `Đã thêm vào giỏ (${cart.length} sản phẩm).` };
}

async function handleCartList() {
  const cart = await getCart();
  return { ok: true, items: cart, count: cart.length };
}

async function handleCartRemove(cartId) {
  const cart = (await getCart()).filter((it) => it.cartId !== cartId);
  await setCart(cart);
  await refreshCartBadge();
  return { ok: true, items: cart, count: cart.length };
}

async function handleCartClear() {
  await setCart([]);
  await refreshCartBadge();
  return { ok: true, items: [], count: 0 };
}

// Gửi tất cả SP trong giỏ -> dồn vào 1 yêu cầu (backend gộp theo SĐT).
// Gửi TUẦN TỰ để backend đọc→ghi an toàn trong transaction (không đè mất nhau).
async function handleCartSubmit() {
  const { apiBase } = await getSettings();
  if (!trimBase(apiBase)) return { ok: false, needSetup: true, message: "Chưa cấu hình địa chỉ hệ thống." };
  const kh = await getCustomer();
  if (!kh || !kh.hoTen || !kh.sdt) return { ok: false, needCustomer: true, message: "Chưa nhập thông tin khách. Mở extension điền Họ tên + SĐT." };
  const cart = await getCart();
  if (!cart.length) return { ok: false, message: "Giỏ đang trống." };

  let maYC = null;
  let sent = 0;
  const failed = [];
  for (const product of cart) {
    const body = {
      maKH: kh.maKH || "", hoTen: kh.hoTen, sdt: kh.sdt, email: kh.email || "", tuyen: kh.tuyen || "HaNoi",
      product,
    };
    const res = await apiFetch("/yeu-cau", { method: "POST", body });
    if (res.needSetup) return res;
    if (res.ok && res.data && res.data.success) {
      sent++;
      if (res.data.maYC) maYC = res.data.maYC;
    } else {
      failed.push({ cartId: product.cartId, message: (res.data && res.data.message) || res.message || "Gửi thất bại." });
    }
  }

  if (sent === 0) {
    return { ok: false, message: (failed[0] && failed[0].message) || "Gửi yêu cầu thất bại." };
  }

  // Giữ lại các SP gửi lỗi trong giỏ để khách thử lại; xoá các SP đã gửi thành công.
  const failedIds = new Set(failed.map((f) => f.cartId));
  const remain = cart.filter((it) => failedIds.has(it.cartId));
  await setCart(remain);
  await refreshCartBadge();

  const partial = failed.length > 0;
  const message = partial
    ? `Đã gửi ${sent}/${cart.length} sản phẩm vào yêu cầu ${maYC || ""}. Còn ${failed.length} SP gửi lỗi, thử lại sau.`
    : `Đã gửi ${sent} sản phẩm vào yêu cầu ${maYC || ""}.`;
  return { ok: true, partial, sent, failed: failed.length, maYC, message };
}

/* ---- Cấu hình hệ thống (tỉ giá VNĐ + danh mục) để extension hiển thị giá Việt ---- */
let _cfg = null, _cfgAt = 0;
async function handleGetConfig() {
  if (_cfg && Date.now() - _cfgAt < 5 * 60 * 1000) return { ok: true, config: _cfg };
  const res = await apiFetch("/config", { method: "GET" });
  if (res.ok && res.data && res.data.tyGia) {
    _cfg = res.data; _cfgAt = Date.now();
    chrome.storage.local.set({ mhConfig: res.data });
    return { ok: true, config: res.data };
  }
  // Lỗi mạng / chưa đăng nhập -> dùng bản cache gần nhất nếu có
  const { mhConfig } = await chrome.storage.local.get("mhConfig");
  if (mhConfig) return { ok: true, config: mhConfig, stale: true };
  return { ok: false };
}

/* ---- Dịch tiếng Trung -> tiếng Việt (Google free endpoint, không cần API key) ---- */
async function translateOne(text) {
  const q = String(text || "").trim();
  if (!q) return "";
  // Chỉ dịch khi có ký tự CJK (tránh dịch thừa tên đã là tiếng Việt/Anh)
  if (!/[一-鿿]/.test(q)) return q;
  try {
    const url =
      "https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=vi&dt=t&q=" +
      encodeURIComponent(q.slice(0, 1800));
    const resp = await fetch(url);
    if (!resp.ok) return "";
    const data = await resp.json();
    // data[0] = mảng các đoạn [bảnDịch, bảnGốc, ...]
    if (Array.isArray(data) && Array.isArray(data[0])) {
      return data[0].map((seg) => (seg && seg[0]) || "").join("");
    }
  } catch (_) { /* lỗi mạng -> trả rỗng, content giữ nguyên bản gốc */ }
  return "";
}

async function handleTranslate(texts) {
  const list = Array.isArray(texts) ? texts.slice(0, 12) : [texts];
  try {
    const out = await Promise.all(list.map(translateOne));
    return { ok: true, translations: out };
  } catch (e) {
    return { ok: false, message: "Dịch thất bại.", translations: [] };
  }
}

async function handleGetOrders() {
  const res = await apiFetch("/orders", { method: "GET" });
  if (res.needSetup) return res;
  if (res.ok) {
    const data = res.data;
    const items = Array.isArray(data) ? data : data.items || [];
    return { ok: true, items };
  }
  if (res.status === 401) return { ok: false, needSetup: true, message: "Chưa đăng nhập." };
  return { ok: false, message: res.message || "Không lấy được danh sách đơn." };
}
