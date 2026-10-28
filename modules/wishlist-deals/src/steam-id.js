import { fetchJson } from './http.js';
import { config } from './config.js';

/**
 * Profil URL / vanity / steamID64 → steamID64
 */
export async function resolveSteamId64(input, apiKey) {
  const raw = String(input || '').trim();
  if (!raw) throw new Error('Steam profili boş');

  const profileMatch = raw.match(/steamcommunity\.com\/profiles\/(\d{17})/i);
  if (profileMatch) return profileMatch[1];

  if (/^\d{17}$/.test(raw)) return raw;

  let vanity = raw;
  const idMatch = raw.match(/steamcommunity\.com\/id\/([^\/\?\s]+)/i);
  if (idMatch) vanity = decodeURIComponent(idMatch[1]);
  vanity = vanity.replace(/^\/+|\/+$/g, '');

  if (!apiKey) {
    throw new Error('Vanity URL çözmek için STEAM_WEB_API_KEY gerekli');
  }

  const url =
    `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/` +
    `?key=${encodeURIComponent(apiKey)}` +
    `&vanityurl=${encodeURIComponent(vanity)}`;

  const data = await fetchJson(url);
  const ok = Number(data?.response?.success) === 1;
  const steamId = data?.response?.steamid;
  if (!ok || !steamId) {
    throw new Error(`Steam profili bulunamadı: ${vanity}`);
  }
  return String(steamId);
}

export async function verifyWishlistAccessible(steamId64, apiKey) {
  const url =
    `https://api.steampowered.com/IWishlistService/GetWishlist/v1/` +
    `?key=${encodeURIComponent(apiKey)}` +
    `&steamid=${encodeURIComponent(steamId64)}`;
  const data = await fetchJson(url);
  const items = data?.response?.items;
  return Array.isArray(items);
}
