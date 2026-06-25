/**
 * page-probe.js
 * Chạy trong MAIN world của trang (cùng ngữ cảnh với JS của 1688/Taobao)
 * để đọc các biến dữ liệu nhúng mà content script (isolated world) không với tới được:
 * - 1688: window.detailData / iDetailData / runParams / context...
 * - Taobao/Tmall: window.__INIT_DATA__ / g_config / các script JSON inline.
 *
 * Đây là tầng "best-effort" để lấy thêm SKU + giá theo bậc. Nếu trang đổi cấu trúc,
 * content.js vẫn hoạt động được nhờ tách dữ liệu từ DOM + thẻ meta.
 *
 * Giao tiếp: content script gửi window.postMessage({ type: 'MH_PROBE_REQUEST', token }).
 * Probe trả về window.postMessage({ type: 'MH_PROBE_RESULT', token, data }).
 */
(function () {
  "use strict";

  function safe(fn) {
    try {
      return fn();
    } catch (e) {
      return undefined;
    }
  }

  function deepFind(obj, keys, depth) {
    // Tìm key đầu tiên khớp trong object lồng nhau (giới hạn độ sâu để tránh treo).
    if (!obj || typeof obj !== "object" || depth > 6) return undefined;
    for (const k of keys) {
      if (obj[k] != null) return obj[k];
    }
    for (const k in obj) {
      const v = obj[k];
      if (v && typeof v === "object") {
        const found = deepFind(v, keys, depth + 1);
        if (found !== undefined) return found;
      }
    }
    return undefined;
  }

  function from1688() {
    const root =
      safe(() => window.detailData) ||
      safe(() => window.iDetailData) ||
      safe(() => window.runParams && window.runParams.detailData) ||
      safe(() => window.context && window.context.result) ||
      safe(() => window.__GLOBAL_DATA);
    if (!root) return null;
    return {
      title: deepFind(root, ["subject", "title", "offerTitle"], 0),
      priceText: deepFind(root, ["priceText", "showPrice", "price"], 0),
      priceRanges: deepFind(root, ["priceRanges", "skuPriceScale", "priceList"], 0),
      skuModel: deepFind(root, ["skuModel", "skuMap", "skuInfoMap", "skuProps"], 0),
      mainImage: deepFind(root, ["mainImage", "offerImgList", "images"], 0),
    };
  }

  function fromTaobao() {
    const root =
      safe(() => window.__INIT_DATA__) ||
      safe(() => window.g_config) ||
      safe(() => window.__GLOBAL_DATA);
    if (!root) return null;
    return {
      title: deepFind(root, ["title", "itemTitle", "subtitle"], 0),
      priceText: deepFind(root, ["price", "priceText", "defaultPrice"], 0),
      skuModel: deepFind(root, ["sku", "skuBase", "skuCore", "props"], 0),
      mainImage: deepFind(root, ["picUrl", "mainPic", "images"], 0),
    };
  }

  function fromAlibaba() {
    const root =
      safe(() => window.detailData) ||
      safe(() => window.runParams && window.runParams.data) ||
      safe(() => window.__GLOBAL_DATA) ||
      safe(() => window.__page__ && window.__page__.data) ||
      safe(() => window.context);
    if (!root) return null;
    return {
      title: deepFind(root, ["subject", "title", "productTitle", "name"], 0),
      priceText: deepFind(root, ["price", "priceText", "formatPrice"], 0),
      priceRanges: deepFind(root, ["priceRanges", "ladderPrices", "skuPriceScale", "priceList"], 0),
      skuModel: deepFind(root, ["skuModel", "skuMap", "skuProps", "sku"], 0),
      mainImage: deepFind(root, ["mainImage", "image", "images", "mediaItems"], 0),
    };
  }

  function scanScriptsForJson() {
    // Quét các thẻ <script type="application/ld+json"> hoặc JSON inline có dấu hiệu sản phẩm.
    const out = {};
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const s of scripts) {
      const json = safe(() => JSON.parse(s.textContent));
      if (json && (json["@type"] === "Product" || json.name)) {
        out.title = out.title || json.name;
        out.mainImage = out.mainImage || json.image;
        if (json.offers) {
          out.priceText =
            out.priceText || json.offers.price || (json.offers[0] && json.offers[0].price);
        }
      }
    }
    return out;
  }

  function collect(host) {
    let data = {};
    if (host.includes("1688")) {
      data = from1688() || {};
    } else if (host.includes("alibaba")) {
      data = fromAlibaba() || {};
    } else {
      data = fromTaobao() || {};
    }
    const ld = scanScriptsForJson();
    return Object.assign({}, ld, data);
  }

  window.addEventListener("message", function (ev) {
    if (ev.source !== window) return;
    const msg = ev.data;
    if (!msg || msg.type !== "MH_PROBE_REQUEST") return;
    const data = safe(() => collect(location.hostname)) || {};
    window.postMessage({ type: "MH_PROBE_RESULT", token: msg.token, data }, "*");
  });
})();
