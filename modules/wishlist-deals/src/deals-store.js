import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';

function empty() {
  return { version: 1, deals: {} };
}

export async function loadActiveDeals() {
  try {
    const raw = await readFile(config.dealsFile, 'utf8');
    const data = JSON.parse(raw);
    return {
      version: 1,
      deals: data?.deals && typeof data.deals === 'object' ? data.deals : {},
    };
  } catch {
    return empty();
  }
}

export async function saveActiveDeals(store) {
  await mkdir(path.dirname(config.dealsFile), { recursive: true });
  const payload = { version: 1, deals: store.deals };
  await writeFile(config.dealsFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

/**
 * Bu indirim dönemi için daha önce bildirim gitti mi?
 * periodKey değişirse (fiyat/yüzde) veya deal kapandıktan sonra yeniden açılırsa tekrar bildirilir.
 */
export function shouldNotify(store, appId, periodKey) {
  const prev = store.deals[appId];
  if (!prev) return true;
  return prev.periodKey !== periodKey;
}

export function markNotified(store, appId, periodKey, meta = {}) {
  store.deals[appId] = {
    periodKey,
    notifiedAt: new Date().toISOString(),
    ...meta,
  };
}

/** Artık indirimde olmayan oyunları temizle → sonraki indirimde tekrar bildirim */
export function pruneEndedDeals(store, currentlyOnSaleAppIds) {
  const alive = new Set(currentlyOnSaleAppIds.map(String));
  let removed = 0;
  for (const appId of Object.keys(store.deals)) {
    if (!alive.has(appId)) {
      delete store.deals[appId];
      removed += 1;
    }
  }
  return removed;
}
