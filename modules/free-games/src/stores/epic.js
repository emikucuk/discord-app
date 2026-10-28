import { config } from '../config.js';
import { fetchJson } from '../http.js';

function pickImage(keyImages = []) {
  const order = ['OfferImageWide', 'Thumbnail', 'DieselStoreFrontWide', 'OfferImageTall'];
  for (const type of order) {
    const hit = keyImages.find((img) => img.type === type && img.url);
    if (hit) return hit.url.replace(/\s/g, '%20');
  }
  return keyImages.find((img) => img.url)?.url?.replace(/\s/g, '%20') || null;
}

function activeFreeOffer(promotions) {
  const groups = [
    ...(promotions?.promotionalOffers || []),
    ...(promotions?.upcomingPromotionalOffers || []),
  ];

  const now = Date.now();
  for (const group of groups) {
    for (const offer of group.promotionalOffers || []) {
      const start = Date.parse(offer.startDate);
      const end = Date.parse(offer.endDate);
      const discount = offer.discountSetting?.discountPercentage;
      if (
        Number.isFinite(start) &&
        Number.isFinite(end) &&
        start <= now &&
        now <= end &&
        (discount === 0 || discount === 100)
      ) {
        return offer;
      }
    }
  }
  return null;
}

function formatPrice(totalPrice) {
  if (!totalPrice) return null;
  const fmt = totalPrice.fmtPrice?.originalPrice;
  if (fmt && fmt !== '0') return fmt;
  if (typeof totalPrice.originalPrice === 'number' && totalPrice.originalPrice > 0) {
    return `${(totalPrice.originalPrice / 100).toFixed(2)} ${totalPrice.currencyCode || ''}`.trim();
  }
  return null;
}

/**
 * Epic Games Store — resmi freeGamesPromotions API (ülke: TR).
 */
export async function fetchEpicGames() {
  const url =
    `https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions` +
    `?locale=${encodeURIComponent(config.locale)}` +
    `&country=${encodeURIComponent(config.country)}` +
    `&allowCountries=${encodeURIComponent(config.country)}`;

  const data = await fetchJson(url);
  const elements = data?.data?.Catalog?.searchStore?.elements || [];
  const games = [];

  for (const el of elements) {
    const offer = activeFreeOffer(el.promotions);
    if (!offer) continue;

    const price = el.price?.totalPrice;
    // Kalıcı ücretsiz / F2P gürültüsünü azalt: indirimli veya promosyonlu olanları al
    const isZeroNow =
      price?.discountPrice === 0 ||
      price?.discountPrice === '0' ||
      el.price?.totalPrice?.fmtPrice?.discountPrice === '0';

    if (!isZeroNow && price?.originalPrice === 0) continue;

    const slug =
      el.productSlug ||
      el.catalogNs?.mappings?.[0]?.pageSlug ||
      el.offerMappings?.[0]?.pageSlug ||
      el.urlSlug ||
      el.id;

    const pageUrl = slug
      ? `https://store.epicgames.com/tr/p/${String(slug).replace(/\/home$/, '')}`
      : 'https://store.epicgames.com/tr/free-games';

    games.push({
      store: 'epic',
      id: String(el.id || el.gameId || slug),
      title: el.title || 'Epic ücretsiz oyun',
      description: (el.description || '').trim(),
      url: pageUrl,
      image: pickImage(el.keyImages),
      endsAt: offer.endDate,
      originalPrice: formatPrice(price),
    });
  }

  return games;
}
