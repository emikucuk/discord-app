import { fetchEpicGames } from './epic.js';
import { fetchSteamGames } from './steam.js';
import { fetchGogGames } from './gog.js';
import { fetchPrimeGames } from './prime.js';

const sources = [
  { name: 'epic', run: fetchEpicGames },
  { name: 'steam', run: fetchSteamGames },
  { name: 'gog', run: fetchGogGames },
  { name: 'prime', run: fetchPrimeGames },
];

function dedupeGames(games) {
  const map = new Map();
  for (const game of games) {
    if (!game?.store || !game?.id || !game?.title || !game?.url) continue;
    const key = `${game.store}:${game.id}`;
    if (!map.has(key)) map.set(key, game);
  }
  return [...map.values()];
}

/**
 * Tüm mağazaları paralel çeker; biri fail olsa diğerleri devam eder.
 */
export async function fetchAllFreeGames() {
  const settled = await Promise.allSettled(
    sources.map(async (src) => {
      const list = await src.run();
      console.log(`[${src.name}] ${list.length} oyun bulundu`);
      return list;
    }),
  );

  const games = [];
  const errors = [];

  settled.forEach((result, i) => {
    const name = sources[i].name;
    if (result.status === 'fulfilled') {
      games.push(...result.value);
    } else {
      const message = result.reason?.message || String(result.reason);
      errors.push(`${name}: ${message}`);
      console.error(`[${name}] hata:`, message);
    }
  });

  return { games: dedupeGames(games), errors };
}
