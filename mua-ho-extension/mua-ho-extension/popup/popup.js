/* popup.js v2.6 — cấu hình + thông tin khách + "Yêu cầu của tôi" (mode khách tự đặt) */

const $ = (id) => document.getElementById(id);
const els = {
  apiBase: $("apiBase"), autoTranslate: $("autoTranslate"),
  hoTen: $("hoTen"), sdt: $("sdt"), email: $("email"), maKH: $("maKH"), tuyen: $("tuyen"),
  saveKhBtn: $("saveKhBtn"), status: $("status"),
  ycList: $("ycList"), ycCount: $("ycCount"), refreshYc: $("refreshYc"),
  cartList: $("cartList"), cartCount: $("cartCount"), cartBadge: $("cartBadge"),
  clearCart: $("clearCart"), sendAllBtn: $("sendAllBtn"), cartStatus: $("cartStatus"),
  tyGiaVal: $("tyGiaVal"),
};

/* ---- Tabs ---- */
document.querySelectorAll(".tab").forEach((t) => {
  t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("tab--on", x === t));
    const name = t.dataset.tab;
    document.querySelectorAll(".pane").forEach((p) => p.classList.toggle("pane--on", p.dataset.pane === name));
    if (name === "yeucau") loadYeuCau();
    if (name === "gio") loadCart();
  });
});

function showStatus(message, ok) {
  els.status.hidden = false;
  els.status.textContent = message;
  els.status.className = "status " + (ok ? "status--ok" : "status--err");
}
function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function load() {
  chrome.storage.local.get(["apiBase", "autoTranslate", "customer"], (s) => {
    els.apiBase.value = s.apiBase || "";
    els.autoTranslate.checked = s.autoTranslate !== false; // mặc định BẬT
    const c = s.customer || {};
    els.hoTen.value = c.hoTen || "";
    els.sdt.value = c.sdt || "";
    els.email.value = c.email || "";
    els.maKH.value = c.maKH || "";
    els.tuyen.value = c.tuyen || "HaNoi";
    if (c.hoTen && c.sdt) showStatus(`Đang đặt với tên: ${c.hoTen} · ${c.sdt}`, true);
  });
}

/* ---- Hiển thị tỷ giá hiện tại (VNĐ/¥) — chỉ đọc, lấy từ cấu hình hệ thống ---- */
function loadTyGia() {
  if (!els.tyGiaVal) return;
  chrome.runtime.sendMessage({ type: "MH_GET_CONFIG" }, (res) => {
    if (chrome.runtime.lastError || !res || !res.ok || !res.config || !res.config.tyGia) {
      els.tyGiaVal.textContent = "—";
      return;
    }
    const n = Number(res.config.tyGia);
    els.tyGiaVal.textContent = isNaN(n) ? "—" : n.toLocaleString("vi-VN");
  });
}

function saveApiBase() {
  const apiBase = els.apiBase.value.trim().replace(/\/+$/, "");
  return new Promise((res) => chrome.storage.local.set({ apiBase }, res));
}
els.apiBase.addEventListener("change", saveApiBase);
els.autoTranslate.addEventListener("change", () => chrome.storage.local.set({ autoTranslate: els.autoTranslate.checked }));

document.querySelectorAll(".quickfill [data-base]").forEach((b) => {
  b.addEventListener("click", () => { els.apiBase.value = b.dataset.base; saveApiBase(); showStatus("Đã đặt địa chỉ: " + b.dataset.base, true); });
});

/* ---- Lưu thông tin khách ---- */
els.saveKhBtn.addEventListener("click", async () => {
  await saveApiBase();
  const hoTen = els.hoTen.value.trim();
  const sdt = els.sdt.value.trim();
  if (!els.apiBase.value.trim()) return showStatus("Nhập địa chỉ hệ thống trước.", false);
  if (!hoTen || !sdt) return showStatus("Vui lòng nhập Họ tên + Số điện thoại.", false);
  const customer = { hoTen, sdt, email: els.email.value.trim(), maKH: els.maKH.value.trim().toUpperCase(), tuyen: els.tuyen.value };
  chrome.storage.local.set({ customer }, () => showStatus("Đã lưu. Giờ vào trang sản phẩm bấm 'Tôi muốn đặt sản phẩm này'.", true));
});

/* ---- Yêu cầu của tôi ---- */
const YC_LABEL = { ChoXuLy: "Chờ xử lý", DaLienHe: "Đã liên hệ", DaTaoDon: "Đã tạo đơn", TuChoi: "Từ chối" };

function loadYeuCau() {
  els.ycList.innerHTML = '<p class="empty">Đang tải...</p>';
  chrome.runtime.sendMessage({ type: "MH_GET_YEUCAU" }, (res) => {
    if (!res || !res.ok) {
      els.ycList.innerHTML = `<p class="empty">${escapeHtml((res && res.message) || "Chưa lấy được. Lưu thông tin khách + địa chỉ hệ thống trước.")}</p>`;
      return;
    }
    const items = res.items || [];
    els.ycCount.textContent = items.length + " yêu cầu";
    if (!items.length) { els.ycList.innerHTML = '<p class="empty">Chưa có yêu cầu nào.</p>'; return; }
    els.ycList.innerHTML = items.map((y) => {
      const st = YC_LABEL[y.trangThai] || y.trangThai || "";
      const d = y.ngayTao ? new Date(y.ngayTao).toLocaleDateString("vi-VN") : "";
      return `<div class="cart-item"><div class="ci-meta">
        <div class="ci-title">${escapeHtml(y.maYC)} · ${y.soSP} sản phẩm</div>
        <div class="ci-sub">${escapeHtml(st)}${d ? " · " + d : ""}</div>
      </div></div>`;
    }).join("");
  });
}
els.refreshYc.addEventListener("click", loadYeuCau);

/* ---- Giỏ hàng (EXT-7): gom nhiều SP -> gửi tất cả vào 1 yêu cầu ---- */
function cartStatus(message, ok) {
  els.cartStatus.hidden = false;
  els.cartStatus.textContent = message;
  els.cartStatus.className = "status " + (ok ? "status--ok" : "status--err");
}
function updateCartBadge(n) {
  if (n > 0) { els.cartBadge.hidden = false; els.cartBadge.textContent = String(n); }
  else els.cartBadge.hidden = true;
}
function renderCart(items) {
  const n = items.length;
  updateCartBadge(n);
  els.cartCount.textContent = n ? `${n} sản phẩm trong giỏ` : "Giỏ trống";
  els.clearCart.hidden = n === 0;
  els.sendAllBtn.disabled = n === 0;
  els.sendAllBtn.textContent = n ? `Gửi tất cả (${n} SP)` : "Gửi tất cả";
  if (!n) {
    els.cartList.innerHTML = '<p class="empty">Chưa có sản phẩm. Mở trang 1688 / Taobao / Tmall, bấm "Tôi muốn đặt sản phẩm này" rồi "Thêm vào giỏ".</p>';
    return;
  }
  els.cartList.innerHTML = items.map((it) => {
    const title = it.titleVi || it.title || it.url || "(không tên)";
    const qty = Number(it.quantity) || 1;
    const price = it.priceText ? `${escapeHtml(it.priceText)} ${escapeHtml(it.currency || "CNY")}` : "";
    const bits = [];
    if (it.danhMuc) bits.push(escapeHtml(it.danhMuc));
    if (it.skuText) bits.push(escapeHtml(it.skuText));
    if (it.note) bits.push("Ghi chú: " + escapeHtml(it.note));
    const sub = bits.join(" · ");
    return `<div class="cart-item"><div class="ci-ct">
      ${it.image ? `<img src="${escapeHtml(it.image)}" alt="">` : ""}
      <div class="ci-body">
        <div class="ci-title">${escapeHtml(title)}</div>
        <div class="ci-sub">SL: ${qty}${sub ? " · " + sub : ""}</div>
        ${price ? `<div class="ci-price">${price}</div>` : ""}
      </div>
      <button class="ci-rm" type="button" title="Xoá khỏi giỏ" data-cart-id="${escapeHtml(it.cartId)}">×</button>
    </div></div>`;
  }).join("");
  els.cartList.querySelectorAll(".ci-rm").forEach((b) => {
    b.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "MH_CART_REMOVE", cartId: b.dataset.cartId }, (res) => {
        if (res && res.ok) renderCart(res.items || []);
      });
    });
  });
}
function loadCart() {
  els.cartStatus.hidden = true;
  els.cartList.innerHTML = '<p class="empty">Đang tải...</p>';
  chrome.runtime.sendMessage({ type: "MH_CART_LIST" }, (res) => {
    if (chrome.runtime.lastError || !res || !res.ok) { renderCart([]); return; }
    renderCart(res.items || []);
  });
}
els.clearCart.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "MH_CART_CLEAR" }, (res) => {
    if (res && res.ok) { renderCart(res.items || []); cartStatus("Đã xoá toàn bộ giỏ.", true); }
  });
});
els.sendAllBtn.addEventListener("click", () => {
  els.cartStatus.hidden = true;
  els.sendAllBtn.disabled = true;
  const prev = els.sendAllBtn.textContent;
  els.sendAllBtn.textContent = "Đang gửi...";
  chrome.runtime.sendMessage({ type: "MH_CART_SUBMIT" }, (res) => {
    els.sendAllBtn.textContent = prev;
    if (chrome.runtime.lastError) { els.sendAllBtn.disabled = false; cartStatus("Extension chưa sẵn sàng, thử lại.", false); return; }
    if (res && res.ok) {
      cartStatus(res.message || "Đã gửi yêu cầu.", true);
      loadCart(); // giỏ còn lại (nếu có SP gửi lỗi) hoặc trống
    } else if (res && res.needCustomer) {
      els.sendAllBtn.disabled = false;
      cartStatus("Chưa có thông tin khách. Sang tab Khách hàng nhập Họ tên + SĐT rồi Lưu.", false);
    } else if (res && res.needSetup) {
      els.sendAllBtn.disabled = false;
      cartStatus("Chưa cấu hình địa chỉ hệ thống ở tab Khách hàng.", false);
    } else {
      els.sendAllBtn.disabled = false;
      cartStatus((res && res.message) || "Gửi yêu cầu thất bại. Thử lại sau.", false);
    }
  });
});

load();
loadTyGia();
// Hiện số SP trong giỏ trên tab ngay khi mở popup (không cần bấm vào tab).
chrome.runtime.sendMessage({ type: "MH_CART_LIST" }, (res) => {
  if (!chrome.runtime.lastError && res && res.ok) updateCartBadge((res.items || []).length);
});
