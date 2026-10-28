import { config, loadEnvFile } from './config.js';
import { notifyGames } from './discord.js';
import {
  loadSeen,
  saveSeen,
  isSeen,
  markSeen,
} from './seen-store.js';
import { fetchAllFreeGames } from './stores/index.js';

async function main() {
  await loadEnvFile();

  if (!config.webhookUrl()) {
    console.error(
      'DISCORD_WEBHOOK_URL eksik. GitHub Secret veya modules/free-games/.env içine ekle.',
    );
    console.error('Kurulum: Common/discord-webhook-kurulum.md');
    process.exitCode = 1;
    return;
  }

  console.log('Ücretsiz oyunlar taranıyor (ülke: TR)...');
  const { games, errors } = await fetchAllFreeGames();
  console.log(`Toplam aday: ${games.length}`);

  const seen = await loadSeen();
  const isFirstRun = !seen.seeded;
  const firstRunNotify = config.firstRunNotify();

  let toNotify = games.filter((g) => !isSeen(seen, g));

  if (isFirstRun && !firstRunNotify) {
    console.log(
      `İlk çalıştırma: ${toNotify.length} mevcut oyun sessizce işaretleniyor (spam yok).`,
    );
    for (const game of toNotify) markSeen(seen, game);
    seen.seeded = true;
    await saveSeen(seen);
    if (errors.length) {
      console.warn('Mağaza uyarıları:', errors.join(' | '));
    }
    console.log('Tamam. Bundan sonra yalnızca yeni oyunlar bildirilecek.');
    return;
  }

  console.log(`Yeni oyun: ${toNotify.length}`);

  if (toNotify.length === 0) {
    if (isFirstRun) seen.seeded = true;
    await saveSeen(seen);
    console.log('Bildirilecek yeni oyun yok.');
    return;
  }

  const results = await notifyGames(toNotify);
  console.log(
    `Gönderilen: ${results.sent.length}, başarısız: ${results.failed.length}`,
  );

  // Yalnızca başarıyla gönderilenleri işaretle — hata olursa bir sonraki koşuda tekrar dener
  for (const game of results.sent) {
    markSeen(seen, game);
  }

  seen.seeded = true;
  await saveSeen(seen);

  if (errors.length) {
    console.warn('Mağaza uyarıları:', errors.join(' | '));
  }
  if (results.failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Kritik hata:', err);
  process.exitCode = 1;
});
