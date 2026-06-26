/* popup.js v2.6 — cấu hình + thông tin khách + "Yêu cầu của tôi" (mode khách tự đặt) */

const $ = (id) => document.getElementById(id);
const els = {
  apiBase: $("apiBase"), autoTranslate: $("autoTranslate"),
  hoTen: $("hoTen"), sdt: $("sdt"), email: $("email"), maKH: $("maKH"), tuyen: $("tuyen"),
  saveKhBtn: $("saveKhBtn"), status: $("status"),
  ycList: $("ycList"), ycCount: $("ycCount"), refreshYc: $("refreshYc"),
};

/* ---- Tabs ---- */
document.querySelectorAll(".tab").forEach((t) => {
  t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("tab--on", x === t));
    const name = t.dataset.tab;
    document.querySelectorAll(".pane").forEach((p) => p.classList.toggle("pane--on", p.dataset.pane === name));
    if (name === "yeucau") loadYeuCau();
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

load();
