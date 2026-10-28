import { fetchGamerPowerByPlatform } from './gamerpower.js';
import { fetchJson } from '../http.js';
import { config } from '../config.js';

/**
 * GOG — GamerPower + GOG indirimli/ücretsiz katalog yedeği.
 */
export async function fetchGogGames() {
  let games = [];
  try {
    games = await fetchGamerPowerByPlatform('gog', 'gog');
  } catch (err) {
    console.warn('[gog] GamerPower hatası:', err.message);
  }

  if (games.length > 0) return games;

  try {
    return await fetchGogCatalogFree();
  } catch (err) {
    console.warn('[gog] katalog yedek başarısız:', err.message);
    return games;
  }
}

async function fetchGogCatalogFree() {
  const url =
    'https://catalog.gog.com/v1/catalog' +
    `?locale=${encodeURIComponent(config.locale)}` +
    `&countryCode=${encodeURIComponent(config.country)}` +
    '&currencyCode=TRY' +
    '&order=desc:trending' +
    '&productType=in:game' +
    '&price=between:0,0' +
    '&discounted=eq:true' +
    '&limit=30';

  const data = await fetchJson(url, {
    headers: { Accept: 'application/json' },
  });

  const products = data?.products || [];
  return products
    .filter((p) => p?.slug || p?.id)
    .map((p) => {
      const price = p.price;
      const endsAt =
        price?.discountEndDate ||
        p.discountEndDate ||
        null;

      return {
        store: 'gog',
        id: String(p.id || p.slug),
        title: p.title || p.slug,
        description: 'GOG üzerinde şu an ücretsiz.',
        url: `https://www.gog.com/tr/game/${p.slug || p.id}`,
        image: p.coverHorizontal || p.coverVertical || p.image || null,
        endsAt,
        originalPrice: price?.baseAmount
          ? `${price.baseAmount} ${price.currency || 'TRY'}`
          : null,
      };
    });
}
