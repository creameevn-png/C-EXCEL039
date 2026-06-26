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

/* ---- Badge đếm số sản phẩm đã thêm trong phiên ---- */
async function bumpBadge() {
  const { mhAdded = 0 } = await chrome.storage.local.get("mhAdded");
  const n = mhAdded + 1;
  await chrome.storage.local.set({ mhAdded: n });
  chrome.action.setBadgeText({ text: String(n) });
}
chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeBackgroundColor({ color: "#f0512b" });
});
chrome.runtime.onStartup && chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.set({ mhAdded: 0 });
  chrome.action.setBadgeText({ text: "" });
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
