import { fetchAllFreeGames } from './stores/index.js';

const { games, errors } = await fetchAllFreeGames();
console.log('errors:', errors);
console.log('count:', games.length);
for (const g of games.slice(0, 15)) {
  console.log(`- [${g.store}] ${g.title} | ends=${g.endsAt || '-'} | ${g.url}`);
}
