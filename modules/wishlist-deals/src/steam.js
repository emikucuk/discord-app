import { fetchJson } from './http.js';
import { config } from './config.js';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Public wishlist — Steam Web API (wishlist Privacy: Public olmalı).
 * @returns {Promise<number[]>} appid listesi
 */
export async function fetchWishlistAppIds(steamId64, apiKey) {
  const url =
    `https://api.steampowered.com/IWishlistService/GetWishlist/v1/` +
    `?key=${encodeURIComponent(apiKey)}` +
    `&steamid=${encodeURIComponent(steamId64)}`;

  const data = await fetchJson(url);
  const items = data?.response?.items;
  if (!Array.isArray(items)) {
    // Boş response genelde private / erişilemeyen liste
    return { appIds: [], accessible: false, raw: data?.response || {} };
  }

  const appIds = items
    .map((it) => Number(it.appid))
    .filter((id) => Number.isFinite(id) && id > 0);

  return { appIds, accessible: true, raw: data.response };
}

/**
 * Steam Store fiyat özeti (TR).
 */
export async function fetchAppPrice(appId) {
  const url =
    `https://store.steampowered.com/api/appdetails` +
    `?appids=${encodeURIComponent(appId)}` +
    `&cc=${encodeURIComponent(config.country)}` +
    `&l=${encodeURIComponent(config.locale)}` +
    `&filters=price_overview,basic`;

  const data = await fetchJson(url, {
    headers: {
      Referer: 'https://store.steampowered.com/',
      'Accept-Language': 'tr-TR,tr;q=0.9',
    },
  });

  const entry = data?.[String(appId)];
  if (!entry?.success || !entry.data) return null;

  const d = entry.data;
  const price = d.price_overview;
  if (!price) {
    return {
      appId: String(appId),
      title: d.name || `App ${appId}`,
      headerImage: d.header_image || null,
      discountPercent: 0,
      initial: null,
      final: null,
      currency: null,
      formattedInitial: null,
      formattedFinal: null,
      onSale: false,
    };
  }

  const discountPercent = Number(price.discount_percent) || 0;
  return {
    appId: String(appId),
    title: d.name || `App ${appId}`,
    headerImage: d.header_image || null,
    discountPercent,
    initial: price.initial,
    final: price.final,
    currency: price.currency || 'TRY',
    formattedInitial: price.initial_formatted || null,
    formattedFinal: price.final_formatted || null,
    onSale: discountPercent > 0,
  };
}

export async function fetchPricesForApps(appIds, { concurrency = 4, onProgress } = {}) {
  const unique = [...new Set(appIds.map(String))];
  const results = new Map();
  let i = 0;

  async function worker() {
    while (i < unique.length) {
      const idx = i++;
      const appId = unique[idx];
      try {
        const price = await fetchAppPrice(appId);
        if (price) results.set(appId, price);
      } catch (err) {
        console.warn(`[steam] fiyat alınamadı ${appId}:`, err.message);
      }
      onProgress?.(idx + 1, unique.length);
      await sleep(200);
    }
  }

  const n = Math.min(concurrency, Math.max(1, unique.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}

/** Aynı indirim dönemini tanımlayan anahtar */
export function dealPeriodKey(price) {
  return `${price.discountPercent}:${price.final}`;
}
