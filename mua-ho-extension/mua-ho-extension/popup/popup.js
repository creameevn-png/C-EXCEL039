/* popup.js v2 — cấu hình, đăng nhập, tabs, giỏ mua hộ */

const $ = (id) => document.getElementById(id);
const els = {
  apiBase: $("apiBase"), username: $("username"), password: $("password"), token: $("token"),
  loginBtn: $("loginBtn"), saveTokenBtn: $("saveTokenBtn"), testBtn: $("testBtn"), logoutBtn: $("logoutBtn"),
  status: $("status"), refreshCart: $("refreshCart"), resetBadge: $("resetBadge"),
  cartList: $("cartList"), cartCount: $("cartCount"),
};

/* ---- Tabs ---- */
document.querySelectorAll(".tab").forEach((t) => {
  t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("tab--on", x === t));
    const name = t.dataset.tab;
    document.querySelectorAll(".pane").forEach((p) => p.classList.toggle("pane--on", p.dataset.pane === name));
    if (name === "cart") loadCart();
  });
});

function showStatus(message, ok) {
  els.status.hidden = false;
  els.status.textContent = message;
  els.status.className = "status " + (ok ? "status--ok" : "status--err");
}

function load() {
  chrome.storage.local.get(["apiBase", "token", "mhAdded"], (s) => {
    els.apiBase.value = s.apiBase || "";
    els.token.value = s.token || "";
    els.cartCount.textContent = "Đã thêm phiên này: " + (s.mhAdded || 0);
    if (s.token) showStatus("Đã có phiên đăng nhập.", true);
  });
}

function saveApiBase() {
  const apiBase = els.apiBase.value.trim().replace(/\/+$/, "");
  return new Promise((res) => chrome.storage.local.set({ apiBase }, res));
}
els.apiBase.addEventListener("change", saveApiBase);

els.loginBtn.addEventListener("click", async () => {
  await saveApiBase();
  const username = els.username.value.trim();
  const password = els.password.value;
  if (!els.apiBase.value.trim()) return showStatus("Nhập địa chỉ API trước.", false);
  if (!username || !password) return showStatus("Nhập tài khoản và mật khẩu.", false);
  els.loginBtn.disabled = true; els.loginBtn.textContent = "Đang đăng nhập...";
  chrome.runtime.sendMessage({ type: "MH_LOGIN", username, password }, (res) => {
    els.loginBtn.disabled = false; els.loginBtn.textContent = "Đăng nhập";
    if (res && res.ok) { els.password.value = ""; load(); showStatus("Đăng nhập thành công.", true); }
    else showStatus((res && res.message) || "Đăng nhập thất bại.", false);
  });
});

els.saveTokenBtn.addEventListener("click", async () => {
  await saveApiBase();
  const token = els.token.value.trim();
  chrome.storage.local.set({ token }, () => showStatus(token ? "Đã lưu token." : "Đã xoá token.", !!token));
});

els.testBtn.addEventListener("click", async () => {
  await saveApiBase();
  els.testBtn.disabled = true; els.testBtn.textContent = "Đang kiểm tra...";
  chrome.runtime.sendMessage({ type: "MH_TEST" }, (res) => {
    els.testBtn.disabled = false; els.testBtn.textContent = "Kiểm tra kết nối";
    if (res && res.ok) showStatus("Kết nối OK ✓", true);
    else showStatus((res && res.message) || "Kết nối thất bại.", false);
  });
});

els.logoutBtn.addEventListener("click", () => {
  chrome.storage.local.set({ token: "" }, () => { els.token.value = ""; showStatus("Đã đăng xuất.", true); });
});

/* ---- Giỏ mua hộ ---- */
function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function loadCart() {
  els.cartList.innerHTML = '<p class="empty">Đang tải...</p>';
  chrome.runtime.sendMessage({ type: "MH_GET_CART" }, (res) => {
    if (!res || !res.ok) {
      els.cartList.innerHTML = `<p class="empty">${escapeHtml((res && res.message) || "Không tải được giỏ. Kiểm tra cấu hình.")}</p>`;
      return;
    }
    const items = res.items || [];
    if (!items.length) { els.cartList.innerHTML = '<p class="empty">Giỏ trống.</p>'; return; }
    els.cartList.innerHTML = items.map((it) => {
      const img = it.image || (it.images && it.images[0]) || "";
      const title = it.title || it.productId || "(không tên)";
      const qty = it.quantity != null ? it.quantity : "?";
      const sku = it.skuText || (Array.isArray(it.sku) ? it.sku.join(" / ") : "");
      return `<div class="cart-item">
        ${img ? `<img src="${escapeHtml(img)}" alt="">` : '<div class="ci-noimg"></div>'}
        <div class="ci-meta">
          <div class="ci-title">${escapeHtml(title)}</div>
          <div class="ci-sub">SL: ${escapeHtml(String(qty))}${sku ? " · " + escapeHtml(sku) : ""}</div>
        </div></div>`;
    }).join("");
  });
}

els.refreshCart.addEventListener("click", loadCart);
els.resetBadge.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "MH_RESET_BADGE" }, () => load());
});

load();
