/**
 * listing.js v2 (isolated world) — trang TÌM KIẾM / DANH SÁCH.
 * Gắn nút nhỏ "+ Mua hộ" lên mỗi thẻ sản phẩm để thêm nhanh không cần mở chi tiết.
 * Cách làm bền nhất: tìm các thẻ <a> trỏ tới trang chi tiết (theo mẫu URL ổn định),
 * rồi gắn nút vào thẻ cha gần nhất. Mở lại modal xác nhận (window.MuaHoUI) để người
 * dùng kiểm tra trước khi gửi. Giá trên trang list thường thiếu -> backend có thể
 * lấy bổ sung theo productId + productUrl.
 */
(function () {
  "use strict";

  const normalizeImg = window.MuaHoExtractor.normalizeImg;
  const PRODUCT_LINK =
    'a[href*="detail.1688.com/offer/"], a[href*="item.taobao.com/item.htm"], a[href*="item.htm?id="], a[href*="detail.tmall.com/item.htm"], a[href*="/offer/"][href*=".html"], a[href*="item.jd.com/"]';

  function isListingPage() {
    const h = location.hostname, p = location.pathname, q = location.search;
    if (h.startsWith("s.") || h.includes("search") || h.includes("list.")) return true;
    if (/\/(search|list|category|s)\b/i.test(p)) return true;
    if (/[?&](keywords|q|spm|search)=/i.test(q)) return true;
    // nếu trang có nhiều link sản phẩm -> coi như danh sách
    return document.querySelectorAll(PRODUCT_LINK).length >= 4;
  }

  function parseLink(href) {
    let source = null, id = null, url = href;
    let m = href.match(/detail\.1688\.com\/offer\/(\d+)\.html/) || href.match(/\/offer\/(\d+)\.html/);
    if (m) { source = "1688"; id = m[1]; url = `https://detail.1688.com/offer/${id}.html`; }
    if (!id && href.includes("item.jd.com/")) {
      m = href.match(/item\.jd\.com\/(?:product\/)?(\d+)\.html/) || href.match(/\/(\d{6,})\.html/);
      if (m) { source = "jd"; id = m[1]; url = `https://item.jd.com/${id}.html`; }
    }
    if (!id) {
      m = href.match(/[?&]id=(\d+)/);
      if (m) {
        id = m[1];
        source = href.includes("tmall.com") ? "tmall" : "taobao";
        url = `https://item.taobao.com/item.htm?id=${id}`;
      }
    }
    return id ? { source, productId: id, url } : null;
  }

  function cardOf(a) {
    // leo lên tối đa 6 cấp để tìm khối card hợp lý (có ảnh hoặc đủ rộng)
    let n = a, hops = 0;
    while (n && n.parentElement && hops < 6) {
      const r = n.getBoundingClientRect();
      if (r.width >= 120 && r.height >= 120 && n.querySelector("img")) return n;
      n = n.parentElement; hops++;
    }
    return a.parentElement || a;
  }

  function buildProduct(a, link) {
    const card = cardOf(a);
    const img = card.querySelector("img");
    let image = "";
    if (img) image = normalizeImg(img.getAttribute("src") || img.getAttribute("data-src") || img.getAttribute("data-lazy-src") || "");
    let title = (a.getAttribute("title") || (img && img.getAttribute("alt")) || a.textContent || "").replace(/\s+/g, " ").trim();
    if (title.length > 160) title = title.slice(0, 160);
    // cố lấy giá trong card nếu có (best-effort)
    let priceText = "";
    const pe = card.querySelector('[class*="price" i], .price, [class*="Price" i]');
    if (pe) { const mm = (pe.textContent || "").replace(/,/g, "").match(/(\d+(\.\d+)?)/); if (mm) priceText = mm[1]; }
    return {
      source: link.source, productId: link.productId, url: link.url,
      title, image, images: image ? [image] : [],
      priceText, priceValue: priceText ? parseFloat(priceText) : null,
      currency: "CNY", skuValues: [], skuText: "", moq: 1,
      capturedAt: new Date().toISOString(), probe: null, fromListing: true,
    };
  }

  function attachButtons() {
    const links = document.querySelectorAll(PRODUCT_LINK);
    const cards = new Map(); // card element -> link (tránh gắn trùng nhiều link/1 card)
    links.forEach((a) => {
      const link = parseLink(a.href || a.getAttribute("href") || "");
      if (!link) return;
      const card = cardOf(a);
      if (!card || card.querySelector(".mh-card-btn")) return;
      if (cards.has(card)) return;
      cards.set(card, link);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mh-card-btn";
      btn.textContent = "+ Mua hộ";
      btn.title = "Thêm nhanh vào giỏ mua hộ";
      btn.addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation();
        if (!window.MuaHoUI) return;
        window.MuaHoUI.openModal(buildProduct(a, link));
      });
      const cs = getComputedStyle(card);
      if (cs.position === "static") card.style.position = "relative";
      card.appendChild(btn);
    });
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return; scheduled = true;
    setTimeout(() => { scheduled = false; try { attachButtons(); } catch (e) {} }, 500);
  }

  function start() {
    if (!isListingPage()) return;
    attachButtons();
    // Trang list tải thêm khi cuộn -> theo dõi DOM để gắn nút cho card mới.
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("scroll", schedule, { passive: true });
  }

  if (document.readyState !== "loading") setTimeout(start, 1500);
  else window.addEventListener("DOMContentLoaded", () => setTimeout(start, 1500));
})();
