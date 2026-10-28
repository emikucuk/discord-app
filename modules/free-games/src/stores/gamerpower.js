import { fetchJson } from '../http.js';

const BASE = 'https://www.gamerpower.com/api/giveaways';

function isActive(item) {
  if (!item) return false;
  if (item.status && String(item.status).toLowerCase() === 'expired') return false;
  if (item.end_date && item.end_date !== 'N/A') {
    const end = Date.parse(item.end_date);
    if (Number.isFinite(end) && end < Date.now()) return false;
  }
  return true;
}

function normalize(item, store) {
  return {
    store,
    id: String(item.id),
    title: item.title || 'Ücretsiz oyun',
    description: (item.description || item.instructions || '').trim(),
    url: item.open_giveaway_url || item.open_giveaway || item.gamerpower_url || item.worth,
    image: item.image || item.thumbnail || null,
    endsAt: item.end_date && item.end_date !== 'N/A' ? item.end_date : null,
    originalPrice: item.worth && item.worth !== 'N/A' ? item.worth : null,
  };
}

/**
 * GamerPower giveaway listesi (Steam / GOG / Prime için).
 * type=game ile DLC/loot gürültüsü azaltılır.
 */
function asList(data) {
  return Array.isArray(data) ? data : [];
}

export async function fetchGamerPowerByPlatform(platform, store) {
  const url = `${BASE}?platform=${encodeURIComponent(platform)}&type=game`;
  const data = await fetchJson(url);

  return asList(data)
    .filter(isActive)
    .map((item) => normalize(item, store))
    .filter((g) => g.url && g.id);
}

/**
 * Platform alanında Amazon / Prime geçen oyunlar.
 */
export async function fetchPrimeFromGamerPower() {
  const url = `${BASE}?type=game`;
  const data = await fetchJson(url);

  return asList(data)
    .filter(isActive)
    .filter((item) => {
      const platforms = String(item.platforms || '').toLowerCase();
      return (
        platforms.includes('prime') ||
        platforms.includes('amazon') ||
        String(item.title || '')
          .toLowerCase()
          .includes('prime gaming')
      );
    })
    .map((item) => normalize(item, 'prime'))
    .filter((g) => g.url && g.id);
}
