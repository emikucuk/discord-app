import { fetchJson } from './http.js';
import { config } from './config.js';
import { buildRequirementsSummary } from './requirements.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Giveaway / mağaza gürültüsünü başlıktan temizler. */
export function cleanTitle(title) {
  return String(title || '')
    .replace(/\s*[\(\[][^\)\]]*(steam|epic|gog|prime|amazon|key|giveaway|gratis|free)[^\)\]]*[\)\]]/gi, '')
    .replace(/\b(steam|epic games|gog|prime gaming|amazon|key|giveaway|gratis)\b/gi, '')
    .replace(/\s*[–—|-]\s*(ücretsiz|free|giveaway).*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function truncate(text, max) {
  const s = String(text || '').trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trimEnd()}…`;
}

function extractSteamAppId(game) {
  if (game.store === 'steam') {
    const fromId = String(game.id || '').match(/(?:app-)?(\d{3,7})/);
    if (fromId) return fromId[1];
    const fromUrl = String(game.url || '').match(/\/app\/(\d+)/);
    if (fromUrl) return fromUrl[1];
  }
  return null;
}

function titlesSimilar(a, b) {
  const norm = (t) =>
    cleanTitle(t)
      .toLowerCase()
      .replace(/[^a-z0-9ğüşıöç\s]/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const wa = new Set(na.split(' ').filter((w) => w.length > 2));
  const wb = nb.split(' ').filter((w) => w.length > 2);
  if (wb.length === 0) return false;
  const hit = wb.filter((w) => wa.has(w)).length;
  return hit / wb.length >= 0.6;
}

async function searchSteamAppId(title) {
  const q = cleanTitle(title);
  if (!q) return null;

  const url =
    `https://store.steampowered.com/api/storesearch/` +
    `?term=${encodeURIComponent(q)}&l=turkish&cc=${config.country}`;

  const data = await fetchJson(url);
  const items = data?.items || [];
  if (!items.length) return null;

  const exact = items.find((it) => titlesSimilar(it.name, q));
  return String((exact || items[0]).id);
}

async function fetchSteamDetails(appId) {
  const url =
    `https://store.steampowered.com/api/appdetails` +
    `?appids=${encodeURIComponent(appId)}&l=turkish&cc=${config.country}`;

  const data = await fetchJson(url);
  const entry = data?.[appId];
  if (!entry?.success || !entry.data) return null;
  return entry.data;
}

function reviewAdjective(percent) {
  if (percent >= 95) return 'Ezici Olumlu';
  if (percent >= 85) return 'Çok Olumlu';
  if (percent >= 80) return 'Olumlu';
  if (percent >= 70) return 'Çoğunlukla Olumlu';
  if (percent >= 40) return 'Karışık';
  if (percent >= 20) return 'Çoğunlukla Olumsuz';
  return 'Olumsuz';
}

async function fetchSteamSpyScore(appId) {
  try {
    const data = await fetchJson(
      `https://steamspy.com/api.php?request=appdetails&appid=${encodeURIComponent(appId)}`,
    );
    const positive = Number(data?.positive) || 0;
    const negative = Number(data?.negative) || 0;
    const total = positive + negative;
    if (!total) return null;
    const percent = Math.round((positive / total) * 100);
    const score10 = Math.round((positive / total) * 100) / 10;
    return {
      percent,
      total,
      score10,
      description: reviewAdjective(percent),
    };
  } catch {
    return null;
  }
}

/**
 * Oyunu Steam verisiyle zenginleştirir: overview, puan, sistem gereksinimleri.
 * Epic/GOG/Prime için başlıkla Steam eşleştirmesi yapılır; bulunamazsa alanlar boş kalır.
 */
export async function enrichGame(game) {
  const enriched = {
    ...game,
    overview: game.description || null,
    ratingLabel: null,
    ratingDetail: null,
    ratingScore: null,
    requirementsField: null,
    enrichmentSource: null,
  };

  try {
    let appId = extractSteamAppId(game);
    if (!appId) {
      appId = await searchSteamAppId(game.title);
      await sleep(300);
    }
    if (!appId) {
      console.log(`[enrich] Steam eşleşmesi yok: ${game.title}`);
      return enriched;
    }

    const details = await fetchSteamDetails(appId);
    await sleep(300);
    if (!details) return enriched;

    const overview = stripHtml(details.short_description || details.about_the_game || '');
    if (overview) enriched.overview = truncate(overview, 400);

    if (!enriched.image && details.header_image) {
      enriched.image = details.header_image;
    }

    let metacritic10 = null;
    if (typeof details.metacritic?.score === 'number') {
      metacritic10 = Math.round((details.metacritic.score / 10) * 10) / 10;
    }

    const spy = await fetchSteamSpyScore(appId);
    await sleep(200);

    // Öncelik: Metacritic varsa onu ana puan yap; yoksa Steam kullanıcı oranı
    const score10 = metacritic10 ?? spy?.score10 ?? null;
    const detailBits = [];
    if (metacritic10 != null) {
      detailBits.push(`Metacritic ${details.metacritic.score}`);
    }
    if (spy) {
      detailBits.push(
        `Steam %${spy.percent} ${spy.description} (${spy.total.toLocaleString('tr-TR')} inceleme)`,
      );
    } else if (typeof details.recommendations?.total === 'number') {
      detailBits.push(
        `${details.recommendations.total.toLocaleString('tr-TR')} Steam tavsiyesi`,
      );
    }

    enriched.ratingScore = score10;
    enriched.ratingDetail = detailBits.length ? detailBits.join('\n') : null;
    enriched.ratingLabel =
      score10 != null
        ? [`**${score10.toFixed(1)}/10**`, enriched.ratingDetail].filter(Boolean).join('\n')
        : enriched.ratingDetail;

    const pc = details.pc_requirements || {};
    const summary = buildRequirementsSummary({
      minimumHtml: pc.minimum,
      recommendedHtml: pc.recommended,
    });
    enriched.requirementsField = summary.requirementsField;
    enriched.enrichmentSource = `steam:${appId}`;

    console.log(`[enrich] ${game.title} ← steam:${appId}`);
  } catch (err) {
    console.warn(`[enrich] başarısız (${game.title}):`, err.message);
  }

  return enriched;
}

export async function enrichGames(games) {
  const out = [];
  for (const game of games) {
    out.push(await enrichGame(game));
  }
  return out;
}
