/**
 * extractors.js v2 (isolated world)
 * Tách dữ liệu sản phẩm theo nhiều lớp để bền với việc 1688/Taobao đổi giao diện:
 *   1) URL  -> nguồn + mã sản phẩm (ổn định nhất)
 *   2) Thẻ meta og:title / og:image
 *   3) Selector DOM (nhiều fallback) -> chỉnh trong SELECTORS khi trang đổi layout
 *   4) page-probe.js đọc dữ liệu nhúng MAIN world (SKU/giá bậc) -> best-effort
 * v2 bổ sung: đọc PHÂN LOẠI (SKU) đang chọn, SỐ LƯỢNG TỐI THIỂU (MOQ), danh sách ảnh.
 */
(function () {
  "use strict";

  const SELECTORS = {
    "1688": {
      title: ["h1.title-text", ".od-pc-offer-title", ".title-content .title-text", ".mod-detail-title h1", "h1"],
      price: [".price-now .value", ".price-original .value", ".currency .value", ".price-module__price--current", ".price .value"],
      image: [".detail-gallery-img img", ".od-gallery-img img", "img.preview-img", "#J_Pic img"],
      gallery: ["#J_UlThumb img", ".detail-gallery-turn-wrapper img", ".tab-trigger img", '[class*="thumbnail" i] img'],
    },
    taobao: {
      title: [".tb-detail-hd h1", "#J_Title .tb-main-title", ".ItemTitle--mainTitle", '[class*="mainTitle" i]', "h1"],
      price: [".tb-rmb-num", "#J_StrPrice .tb-rmb-num", ".tm-price", '[class*="highlightPrice" i] [class*="text" i]', '[class*="Price--priceText" i]'],
      image: ["#J_ImgBooth", ".tb-booth img", '[class*="mainPic" i] img', "#J_UlThumb img"],
      gallery: ["#J_UlThumb img", '[class*="thumbnail" i] img', '[class*="thumbnails" i] img', ".tb-booth img"],
    },
  };
  SELECTORS.tmall = SELECTORS.taobao;

  function detectSource() {
    const h = location.hostname;
    if (h.includes("1688.com")) return "1688";
    if (h.includes("tmall.com")) return "tmall";
    if (h.includes("taobao.com")) return "taobao";
    return "unknown";
  }

  function getProductId(source) {
    const url = location.href;
    if (source === "1688") {
      const m = url.match(/offer\/(\d+)\.html/) || url.match(/[?&]offerId=(\d+)/);
      return m ? m[1] : null;
    }
    const m = url.match(/[?&]id=(\d+)/);
    return m ? m[1] : null;
  }

  function pickText(selectors) {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      const t = el && (el.textContent || "").trim();
      if (t) return t;
    }
    return "";
  }

  function normalizeImg(src) {
    if (!src) return "";
    if (src.startsWith("//")) src = "https:" + src;
    return src.replace(/_\d+x\d+(xz)?\.(jpg|jpeg|png|webp)(\.webp)?$/i, ".$2");
  }

  function pickImage(selectors) {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const src = el.getAttribute("src") || el.getAttribute("data-src") || el.getAttribute("data-lazy-src");
      if (src) return normalizeImg(src);
    }
    return "";
  }

  function readGallery(sel) {
    const set = new Set();
    (sel.gallery || []).forEach((s) =>
      document.querySelectorAll(s).forEach((img) => {
        const u = img.getAttribute("src") || img.getAttribute("data-src") || img.getAttribute("data-lazy-src");
        if (u) set.add(normalizeImg(u));
      })
    );
    return Array.from(set).slice(0, 9);
  }

  function meta(name) {
    const el = document.querySelector(`meta[property="${name}"]`) || document.querySelector(`meta[name="${name}"]`);
    return el ? el.getAttribute("content") || "" : "";
  }

  function parsePrice(text) {
    if (text == null) return { priceText: "", priceValue: null };
    const str = String(text);
    const m = str.replace(/,/g, "").match(/(\d+(\.\d+)?)/);
    return { priceText: str.trim(), priceValue: m ? parseFloat(m[1]) : null };
  }

  /* ----- v2: đọc PHÂN LOẠI (SKU) đang được chọn trên trang ----- */
  function readSelectedSku() {
    const sels = [
      '[class*="sku" i] [class*="selected" i]',
      '[class*="sku" i] [class*="active" i]',
      '[class*="sku" i] [class*="checked" i]',
      '[class*="prop" i] [aria-checked="true"]',
      ".tb-sku .tb-selected",
      '[class*="SkuContent" i] [class*="isSelected" i]',
      '[class*="valueItem" i][class*="selected" i]',
    ];
    const seen = new Set();
    const vals = [];
    for (const s of sels) {
      let nodes;
      try { nodes = document.querySelectorAll(s); } catch (e) { continue; }
      nodes.forEach((el) => {
        const t = (el.getAttribute("title") || el.textContent || "").replace(/\s+/g, " ").trim();
        if (t && t.length <= 40 && !seen.has(t)) { seen.add(t); vals.push(t); }
      });
    }
    return vals;
  }

  /* ----- v2: số lượng đặt tối thiểu (MOQ) cho 1688 (起订量 / 件起批) ----- */
  function readMoq(source) {
    if (source !== "1688") return 1;
    try {
      const txt = document.body.innerText || "";
      let m = txt.match(/起订量[^\d]*(\d+)/) || txt.match(/(\d+)\s*件起批/) || txt.match(/≥\s*(\d+)\s*件/);
      if (m) { const n = parseInt(m[1], 10); if (n >= 1 && n <= 100000) return n; }
    } catch (e) { /* ignore */ }
    return 1;
  }

  function requestProbe() {
    return new Promise((resolve) => {
      const token = "mh_" + Date.now() + "_" + Math.random().toString(36).slice(2);
      let done = false;
      function onMsg(ev) {
        if (ev.source !== window) return;
        const d = ev.data;
        if (!d || d.type !== "MH_PROBE_RESULT" || d.token !== token) return;
        done = true;
        window.removeEventListener("message", onMsg);
        resolve(d.data || {});
      }
      window.addEventListener("message", onMsg);
      try {
        const s = document.createElement("script");
        s.src = chrome.runtime.getURL("content/page-probe.js");
        s.onload = () => { window.postMessage({ type: "MH_PROBE_REQUEST", token }, "*"); s.remove(); };
        (document.head || document.documentElement).appendChild(s);
      } catch (e) { /* ignore */ }
      setTimeout(() => { if (!done) { window.removeEventListener("message", onMsg); resolve({}); } }, 1500);
    });
  }

  function cleanUrl(source) {
    const id = getProductId(source);
    if (source === "1688" && id) return `https://detail.1688.com/offer/${id}.html`;
    if ((source === "taobao" || source === "tmall") && id) return `https://item.taobao.com/item.htm?id=${id}`;
    return location.href.split("#")[0];
  }

  async function extract() {
    const source = detectSource();
    const sel = SELECTORS[source] || SELECTORS.taobao;
    const probe = await requestProbe();

    const title =
      pickText(sel.title) || (typeof probe.title === "string" ? probe.title : "") || meta("og:title") || document.title;
    const image =
      pickImage(sel.image) || (typeof probe.mainImage === "string" ? normalizeImg(probe.mainImage) : "") || normalizeImg(meta("og:image"));
    const { priceText, priceValue } = parsePrice(pickText(sel.price) || probe.priceText || "");
    const skuValues = readSelectedSku();
    const moq = readMoq(source);

    return {
      source,
      productId: getProductId(source),
      url: cleanUrl(source),
      title: (title || "").trim(),
      image,
      images: readGallery(sel),
      priceText,
      priceValue,
      currency: "CNY",
      skuValues,                       // mảng phân loại đang chọn, vd ["Be","Size L"]
      skuText: skuValues.join(" / "),  // chuỗi gộp để hiển thị
      moq,                             // số lượng tối thiểu
      capturedAt: new Date().toISOString(),
      probe: { skuModel: probe.skuModel || null, priceRanges: probe.priceRanges || null },
    };
  }

  window.MuaHoExtractor = { extract, detectSource, getProductId, normalizeImg };
})();
