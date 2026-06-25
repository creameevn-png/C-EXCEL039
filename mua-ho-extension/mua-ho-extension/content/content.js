/**
 * content.js v2 (isolated world) — trang CHI TIẾT sản phẩm.
 * - Chèn nút nổi "Thêm vào giỏ mua hộ".
 * - Modal xác nhận: hiển thị phân loại (SKU) đang chọn, gợi ý số lượng tối thiểu (MOQ),
 *   cho sửa số lượng + ghi chú trước khi gửi.
 * - Export window.MuaHoUI cho listing.js tái sử dụng modal + toast.
 */
(function () {
  "use strict";

  const SOURCE = window.MuaHoExtractor.detectSource();
  const PREFIX = "mh-muaho";

  function isProductPage() { return !!window.MuaHoExtractor.getProductId(SOURCE); }

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function toast(message, kind) {
    const t = el("div", "mh-toast mh-toast--" + (kind || "info"), message);
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add("mh-toast--show"));
    setTimeout(() => { t.classList.remove("mh-toast--show"); setTimeout(() => t.remove(), 300); }, 3200);
  }

  /* ---------- Nút nổi ---------- */
  function mountButton() {
    if (document.getElementById(PREFIX + "-fab")) return;
    const fab = el("button", "mh-fab");
    fab.id = PREFIX + "-fab";
    fab.type = "button";
    fab.innerHTML = `<span class="mh-fab-ico">🛒</span><span class="mh-fab-label">Thêm vào giỏ mua hộ</span>`;
    fab.addEventListener("click", onAddClick);
    document.body.appendChild(fab);
  }
  function removeButton() { const f = document.getElementById(PREFIX + "-fab"); if (f) f.remove(); }

  /* ---------- Modal ---------- */
  function openModal(product) {
    closeModal();
    const overlay = el("div", "mh-overlay");
    overlay.id = PREFIX + "-overlay";

    const priceLine = product.priceText ? `${product.priceText} ${product.currency || "CNY"}` : "Chưa đọc được giá — kiểm tra lại trên trang";
    const moq = product.moq && product.moq > 1 ? product.moq : 1;
    const skuLine = product.skuText
      ? `<div class="mh-sku"><b>Phân loại đang chọn:</b> ${escapeHtml(product.skuText)}</div>`
      : `<div class="mh-sku mh-sku--warn">Chưa nhận diện được phân loại — hãy ghi rõ màu/size ở ô ghi chú.</div>`;
    const tiers = Array.isArray(product.priceTiers) ? product.priceTiers : [];
    const cur = product.currency || "CNY";
    const tierLine = tiers.length
      ? `<div class="mh-tiers"><b>Bậc giá (SL → đơn giá):</b> ${tiers.map((t) => `≥${escapeHtml(String(t.minQty))}: ${escapeHtml(String(t.price))} ${cur}`).join(" · ")}</div>`
      : "";
    const moqHint = moq > 1 ? `<span class="mh-moqhint">tối thiểu ${moq}</span>` : "";

    overlay.innerHTML = `
      <div class="mh-modal" role="dialog" aria-label="Xác nhận thêm vào giỏ mua hộ">
        <div class="mh-modal-head">
          <span class="mh-badge mh-badge--${product.source}">${(product.source || "").toUpperCase()}</span>
          <span class="mh-modal-title">Thêm vào giỏ mua hộ</span>
          <button class="mh-x" type="button" aria-label="Đóng">×</button>
        </div>
        <div class="mh-modal-body">
          <div class="mh-prod">
            <div class="mh-thumb">${product.image ? `<img src="${product.image}" alt="">` : "🧶"}</div>
            <div class="mh-prod-meta">
              <textarea class="mh-field mh-name" rows="2" placeholder="Tên sản phẩm">${escapeHtml(product.title)}</textarea>
              <div class="mh-price">${escapeHtml(priceLine)}</div>
              <div class="mh-id">Mã: ${product.productId || "—"}</div>
            </div>
          </div>
          ${skuLine}
          ${tierLine}
          <div class="mh-row">
            <label class="mh-lbl">Số lượng ${moqHint}
              <input class="mh-field mh-qty" type="number" min="1" step="1" value="${moq}">
            </label>
            <label class="mh-lbl mh-grow">Ghi chú (màu, size, yêu cầu...)
              <input class="mh-field mh-note" type="text" placeholder="VD: chọn màu be, size L">
            </label>
          </div>
        </div>
        <div class="mh-modal-foot">
          <button class="mh-btn mh-btn--ghost mh-cancel" type="button">Huỷ</button>
          <button class="mh-btn mh-btn--primary mh-confirm" type="button">Xác nhận thêm</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    overlay.querySelector(".mh-x").addEventListener("click", closeModal);
    overlay.querySelector(".mh-cancel").addEventListener("click", closeModal);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });
    overlay.querySelector(".mh-confirm").addEventListener("click", () => {
      const qty = Math.max(1, parseInt(overlay.querySelector(".mh-qty").value, 10) || 1);
      const note = overlay.querySelector(".mh-note").value.trim();
      const title = overlay.querySelector(".mh-name").value.trim();
      submit({ ...product, title, quantity: qty, note }, overlay);
    });
  }
  function closeModal() { const o = document.getElementById(PREFIX + "-overlay"); if (o) o.remove(); }

  function submit(payload, overlay) {
    const btn = overlay.querySelector(".mh-confirm");
    btn.disabled = true; btn.textContent = "Đang gửi...";
    chrome.runtime.sendMessage({ type: "MH_ADD_TO_CART", payload }, (res) => {
      btn.disabled = false; btn.textContent = "Xác nhận thêm";
      if (chrome.runtime.lastError) { toast("Extension chưa sẵn sàng, tải lại trang.", "error"); return; }
      if (res && res.ok) { closeModal(); toast(res.message || "Đã thêm vào giỏ mua hộ.", "success"); }
      else if (res && res.needSetup) { closeModal(); toast("Chưa cấu hình. Mở extension để nhập API và đăng nhập.", "error"); }
      else { toast((res && res.message) || "Thêm thất bại. Thử lại sau.", "error"); }
    });
  }

  async function onAddClick() {
    const fab = document.getElementById(PREFIX + "-fab");
    if (fab) fab.classList.add("mh-fab--loading");
    try {
      const product = await window.MuaHoExtractor.extract();
      if (!product.productId) { toast("Hãy mở đúng trang chi tiết sản phẩm.", "error"); return; }
      openModal(product);
    } catch (e) { toast("Lỗi khi đọc dữ liệu sản phẩm.", "error"); }
    finally { if (fab) fab.classList.remove("mh-fab--loading"); }
  }

  function refresh() { if (isProductPage()) mountButton(); else removeButton(); }

  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) { lastUrl = location.href; closeModal(); setTimeout(refresh, 600); }
  }, 800);

  if (document.readyState !== "loading") refresh();
  else window.addEventListener("DOMContentLoaded", refresh);
  setTimeout(refresh, 1200);

  // Export cho listing.js
  window.MuaHoUI = { openModal, closeModal, toast };
})();
