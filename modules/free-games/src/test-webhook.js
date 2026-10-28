import { loadEnvFile, config } from './config.js';
import { sendGameNotification } from './discord.js';
import { enrichGame } from './enrich.js';
import { fetchAllFreeGames } from './stores/index.js';

await loadEnvFile();

if (!config.webhookUrl()) {
  console.error('DISCORD_WEBHOOK_URL eksik (.env veya ortam değişkeni).');
  process.exitCode = 1;
} else {
  console.log('Örnek oyun alınıp zenginleştiriliyor...');
  const { games } = await fetchAllFreeGames();
  const sample =
    games.find((g) => g.store === 'epic') ||
    games[0] || {
      store: 'epic',
      id: 'webhook-test',
      title: 'Control Ultimate Edition',
      description: 'Test',
      url: 'https://store.epicgames.com/tr/free-games',
      image: null,
      endsAt: new Date(Date.now() + 86400000).toISOString(),
      originalPrice: '—',
    };

  const enriched = await enrichGame(sample);
  enriched.title = `[TEST] ${enriched.title}`.slice(0, 240);

  await sendGameNotification(enriched);
  console.log('Zenginleştirilmiş test embed gönderildi.');
  console.log('Mağaza:', enriched.store);
  console.log('Puan:', enriched.ratingScore != null ? `${enriched.ratingScore}/10` : 'yok');
  console.log('Gereksinim:\n', enriched.requirementsField || 'yok');
}
