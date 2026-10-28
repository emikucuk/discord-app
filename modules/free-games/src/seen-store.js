import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';

function emptyStore() {
  return { version: 1, seeded: false, items: {} };
}

export async function loadSeen() {
  try {
    const raw = await readFile(config.seenFile, 'utf8');
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return emptyStore();
    return {
      version: 1,
      seeded: Boolean(data.seeded),
      items: data.items && typeof data.items === 'object' ? data.items : {},
    };
  } catch {
    return emptyStore();
  }
}

export async function saveSeen(store) {
  await mkdir(path.dirname(config.seenFile), { recursive: true });
  const payload = {
    version: 1,
    seeded: Boolean(store.seeded),
    items: store.items,
  };
  await writeFile(config.seenFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

export function makeKey(game) {
  return `${game.store}:${game.id}`;
}

export function markSeen(store, game) {
  store.items[makeKey(game)] = {
    title: game.title,
    store: game.store,
    url: game.url,
    notifiedAt: new Date().toISOString(),
  };
}

export function isSeen(store, game) {
  return Object.prototype.hasOwnProperty.call(store.items, makeKey(game));
}
