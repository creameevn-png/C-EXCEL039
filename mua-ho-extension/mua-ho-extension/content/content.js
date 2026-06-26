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
    fab.innerHTML = `<span class="mh-fab-ico">🛒</span><span class="mh-fab-label">Tôi muốn đặt sản phẩm này</span>`;
    fab.addEventListener("click", onAddClick);
    document.body.appendChild(fab);
  }
  function removeButton() { const f = document.getElementById(PREFIX + "-fab"); if (f) f.remove(); }

  /* ---------- Dịch tiếng Trung -> tiếng Việt ---------- */
  function translateTexts(texts) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: "MH_TRANSLATE", texts }, (res) => {
          if (chrome.runtime.lastError || !res || !res.ok) return resolve([]);
          resolve(res.translations || []);
        });
      } catch (_) { resolve([]); }
    });
  }
  function getAutoTranslate() {
    return new Promise((resolve) => {
      try { chrome.storage.local.get(["autoTranslate"], (s) => resolve(s.autoTranslate !== false)); }
      catch (_) { resolve(true); }
    });
  }

  /* ---------- Cấu hình tỉ giá + danh mục (giá VNĐ giống gaudonhaphang) ---------- */
  const DANH_MUC_DEFAULT = ["Thời trang", "Mỹ phẩm", "Điện tử - Phụ kiện", "Gia dụng", "Đồ chơi", "Văn phòng phẩm", "Phụ kiện", "Khác"];
  function getConfig() {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: "MH_GET_CONFIG" }, (res) => {
          if (chrome.runtime.lastError || !res || !res.ok) return resolve(null);
          resolve(res.config || null);
        });
      } catch (_) { resolve(null); }
    });
  }
  function rateFor(config, source) {
    if (!config) return 0;
    const byWeb = config.byWeb || {};
    return Number(byWeb[source] || config.tyGia || 0) || 0;
  }
  function fmtVnd(n) {
    if (!n || isNaN(n)) return "";
    return Math.round(n).toLocaleString("vi-VN") + "₫";
  }

  /* ---------- Modal ---------- */
  function openModal(product) {
    closeModal();
    let viTitle = "";
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
      <div class="mh-modal" role="dialog" aria-label="Gửi yêu cầu đặt hàng">
        <div class="mh-modal-head">
          <span class="mh-badge mh-badge--${product.source}">${(product.source || "").toUpperCase()}</span>
          <span class="mh-modal-title">Gửi yêu cầu đặt hàng</span>
          <button class="mh-x" type="button" aria-label="Đóng">×</button>
        </div>
        <div class="mh-modal-body">
          <div class="mh-prod">
            <div class="mh-thumb">${product.image ? `<img src="${product.image}" alt="">` : "🧶"}</div>
            <div class="mh-prod-meta">
              <textarea class="mh-field mh-name" rows="2" placeholder="Tên sản phẩm">${escapeHtml(product.title)}</textarea>
              <div class="mh-vi" style="display:none;font-size:12px;color:#0a7d33;margin:2px 0 4px;line-height:1.3"></div>
              <div class="mh-price">${escapeHtml(priceLine)} <span class="mh-vnd" style="color:#b45309;font-weight:700"></span></div>
              <div class="mh-id">Mã: ${product.productId || "—"}</div>
            </div>
          </div>
          ${skuLine}
          ${tierLine}
          <div class="mh-row">
            <label class="mh-lbl">Số lượng ${moqHint}
              <input class="mh-field mh-qty" type="number" min="1" step="1" value="${moq}">
            </label>
            <label class="mh-lbl mh-grow">Danh mục hàng hoá
              <select class="mh-field mh-danhmuc">
                <option value="">— Chọn danh mục —</option>
                ${DANH_MUC_DEFAULT.map((d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join("")}
              </select>
            </label>
          </div>
          <div class="mh-row">
            <label class="mh-lbl mh-grow">Ghi chú cho NV mua hàng
              <input class="mh-field mh-note" type="text" placeholder="VD: chọn màu be, size L">
            </label>
            <label class="mh-lbl mh-grow">Ghi chú riêng tư
              <input class="mh-field mh-note2" type="text" placeholder="Ghi chú của riêng bạn">
            </label>
          </div>
        </div>
        <div class="mh-modal-foot">
          <button class="mh-btn mh-btn--ghost mh-cancel" type="button">Huỷ</button>
          <button class="mh-btn mh-btn--primary mh-confirm" type="button">Gửi yêu cầu</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    overlay.querySelector(".mh-x").addEventListener("click", closeModal);
    overlay.querySelector(".mh-cancel").addEventListener("click", closeModal);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });
    overlay.querySelector(".mh-confirm").addEventListener("click", () => {
      const qty = Math.max(1, parseInt(overlay.querySelector(".mh-qty").value, 10) || 1);
      const note = overlay.querySelector(".mh-note").value.trim();
      const ghiChuRiengTu = overlay.querySelector(".mh-note2").value.trim();
      const danhMuc = overlay.querySelector(".mh-danhmuc").value;
      const title = overlay.querySelector(".mh-name").value.trim();
      submit({ ...product, title, titleVi: viTitle, quantity: qty, note, ghiChuRiengTu, danhMuc }, overlay);
    });

    // Lấy tỉ giá hệ thống -> hiện giá VNĐ (giá chính + bậc giá) + nạp danh mục gợi ý.
    (async () => {
      const config = await getConfig();
      if (!document.getElementById(PREFIX + "-overlay")) return;
      const rate = rateFor(config, product.source);
      if (rate && product.priceValue) {
        const vEl = overlay.querySelector(".mh-vnd");
        if (vEl) vEl.textContent = "≈ " + fmtVnd(product.priceValue * rate);
      }
      if (rate && tiers.length) {
        const tEl = overlay.querySelector(".mh-tiers");
        if (tEl) tEl.innerHTML = "<b>Bậc giá (SL → đơn giá):</b> " +
          tiers.map((t) => `≥${escapeHtml(String(t.minQty))}: ${escapeHtml(String(t.price))} ${cur} (${fmtVnd(Number(t.price) * rate)})`).join(" · ");
      }
      const dmList = (config && Array.isArray(config.danhMucs) && config.danhMucs.length) ? config.danhMucs : null;
      if (dmList) {
        const sel = overlay.querySelector(".mh-danhmuc");
        if (sel) sel.innerHTML = '<option value="">— Chọn danh mục —</option>' +
          dmList.map((d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join("");
      }
    })();

    // Tự dịch tiếng Trung -> tiếng Việt (tên SP + phân loại) nếu bật trong cấu hình.
    (async () => {
      if (!(await getAutoTranslate())) return;
      const viBox = overlay.querySelector(".mh-vi");
      const skuBox = overlay.querySelector(".mh-sku");
      if (viBox) { viBox.style.display = "block"; viBox.textContent = "🇻🇳 Đang dịch…"; }
      const [tTitle, tSku] = await translateTexts([product.title || "", product.skuText || ""]);
      if (!document.getElementById(PREFIX + "-overlay")) return; // modal đã đóng
      if (viBox) {
        if (tTitle && tTitle !== product.title) { viTitle = tTitle; viBox.textContent = "🇻🇳 " + tTitle; }
        else { viBox.style.display = "none"; }
      }
      if (skuBox && tSku && tSku !== product.skuText) {
        const add = el("div", "mh-sku-vi");
        add.style.cssText = "font-size:12px;color:#0a7d33;margin-top:2px";
        add.textContent = "🇻🇳 " + tSku;
        skuBox.appendChild(add);
      }
    })();
  }
  function closeModal() { const o = document.getElementById(PREFIX + "-overlay"); if (o) o.remove(); }

  function submit(payload, overlay) {
    const btn = overlay.querySelector(".mh-confirm");
    btn.disabled = true; btn.textContent = "Đang gửi...";
    chrome.runtime.sendMessage({ type: "MH_PUSH_YEUCAU", product: payload }, (res) => {
      btn.disabled = false; btn.textContent = "Gửi yêu cầu";
      if (chrome.runtime.lastError) { toast("Extension chưa sẵn sàng, tải lại trang.", "error"); return; }
      if (res && res.ok) { closeModal(); toast(res.message || "Đã gửi yêu cầu đặt hàng.", "success"); }
      else if (res && res.needCustomer) { closeModal(); toast("Mở extension điền Họ tên + SĐT khách trước khi gửi.", "error"); }
      else if (res && res.needSetup) { closeModal(); toast("Chưa cấu hình địa chỉ hệ thống. Mở extension để nhập.", "error"); }
      else { toast((res && res.message) || "Gửi yêu cầu thất bại. Thử lại sau.", "error"); }
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
