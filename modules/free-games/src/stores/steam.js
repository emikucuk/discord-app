import { fetchGamerPowerByPlatform } from './gamerpower.js';
import { fetchJson } from '../http.js';

/**
 * Steam — GamerPower giveaway’leri (asıl kaynak).
 * Yedek: Steam Store %100 indirimli özel fırsatlar.
 */
export async function fetchSteamGames() {
  const fromGp = await fetchGamerPowerByPlatform('steam', 'steam');
  if (fromGp.length > 0) return fromGp;

  try {
    return await fetchSteamSpecials();
  } catch (err) {
    console.warn('[steam] specials yedek başarısız:', err.message);
    return fromGp;
  }
}

async function fetchSteamSpecials() {
  const url =
    'https://store.steampowered.com/search/results/' +
    '?query=&start=0&count=25&dynamic_data=&sort_by=_ASC' +
    '&maxprice=free&specials=1&category1=998&infinite=1&cc=TR&l=turkish';

  const data = await fetchJson(url, {
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      Referer: 'https://store.steampowered.com/',
    },
  });

  const html = data?.results_html || '';
  const games = [];
  const blocks = html.split('data-ds-appid="').slice(1);

  for (const block of blocks) {
    const idMatch = block.match(/^(\d+)/);
    if (!idMatch) continue;
    const id = idMatch[1];

    const titleMatch = block.match(/class="title">\s*([^<]+)\s*</i);
    const title = titleMatch?.[1]?.trim();
    if (!title) continue;

    const hasDiscount =
      /discount_pct|discount_block|free\s*to\s*keep|ücretsiz/i.test(block) ||
      /discounted/i.test(block);

    if (!hasDiscount && /free\s*to\s*play|ücretsiz\s*oyna/i.test(block)) {
      continue;
    }

    const imgMatch = block.match(
      /src="(https:\/\/[^"]+(?:header|capsule)[^"]+\.(?:jpg|png|webp))"/i,
    );

    games.push({
      store: 'steam',
      id: `app-${id}`,
      title,
      description: 'Steam üzerinde şu an ücretsiz / %100 indirimli.',
      url: `https://store.steampowered.com/app/${id}/?l=turkish`,
      image:
        imgMatch?.[1] ||
        `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/header.jpg`,
      endsAt: null,
      originalPrice: null,
    });
  }

  return games;
}
