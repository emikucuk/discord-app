import { config, loadEnvFile } from './config.js';
import { loadUsers } from './users.js';
import {
  fetchWishlistAppIds,
  fetchPricesForApps,
  dealPeriodKey,
} from './steam.js';
import {
  loadActiveDeals,
  saveActiveDeals,
  shouldNotify,
  markNotified,
  pruneEndedDeals,
} from './deals-store.js';
import { sendDealNotification } from './discord.js';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  await loadEnvFile();

  if (!config.webhookUrl()) {
    console.error(
      'DISCORD_WEBHOOK_URL_WISHLIST eksik (wishlist kanalı webhook’u).',
    );
    process.exitCode = 1;
    return;
  }

  const apiKey = config.steamApiKey();
  if (!apiKey) {
    console.error(
      'STEAM_WEB_API_KEY eksik. Ücretsiz key: https://steamcommunity.com/dev/apikey',
    );
    process.exitCode = 1;
    return;
  }

  const users = await loadUsers();
  if (users.length === 0) {
    console.error(
      'data/users.json boş veya geçersiz. Örnek: data/users.example.json',
    );
    process.exitCode = 1;
    return;
  }

  console.log(`${users.length} kullanıcı taranıyor...`);
  const minPct = config.minDiscountPercent();

  /** appId -> { price, users[] } */
  const byApp = new Map();
  const inaccessible = [];

  for (const user of users) {
    try {
      const { appIds, accessible } = await fetchWishlistAppIds(user.steamId64, apiKey);
      if (!accessible) {
        inaccessible.push(user);
        console.warn(
          `[wishlist] erişilemedi: ${user.name} (${user.steamId64}) — liste Public mi?`,
        );
        continue;
      }
      console.log(`[wishlist] ${user.name}: ${appIds.length} oyun`);
      for (const appId of appIds) {
        const key = String(appId);
        if (!byApp.has(key)) byApp.set(key, { users: [] });
        byApp.get(key).users.push(user);
      }
    } catch (err) {
      inaccessible.push(user);
      console.warn(`[wishlist] hata ${user.name}:`, err.message);
    }
    await sleep(300);
  }

  const allAppIds = [...byApp.keys()];
  console.log(`Benzersiz oyun: ${allAppIds.length}. Fiyatlar çekiliyor (TR)...`);

  const prices = await fetchPricesForApps(allAppIds, {
    concurrency: config.priceConcurrency,
    onProgress: (done, total) => {
      if (done % 20 === 0 || done === total) {
        console.log(`  fiyat ${done}/${total}`);
      }
    },
  });

  const store = await loadActiveDeals();
  const onSaleAppIds = [];
  const toNotify = [];

  for (const [appId, entry] of byApp) {
    const price = prices.get(appId);
    if (!price?.onSale) continue;
    if (price.discountPercent < minPct) continue;

    onSaleAppIds.push(appId);
    const periodKey = dealPeriodKey(price);

    if (!shouldNotify(store, appId, periodKey)) {
      continue;
    }

    toNotify.push({
      ...price,
      users: entry.users,
      periodKey,
    });
  }

  // İndirim bitenleri temizle (sonraki dönemde tekrar bildirim için)
  const pruned = pruneEndedDeals(store, onSaleAppIds);
  if (pruned) console.log(`Biten indirim kaydı temizlendi: ${pruned}`);

  console.log(`Yeni bildirim: ${toNotify.length}`);

  let sent = 0;
  let failed = 0;
  for (const deal of toNotify) {
    try {
      await sendDealNotification(deal);
      markNotified(store, deal.appId, deal.periodKey, {
        title: deal.title,
        discountPercent: deal.discountPercent,
        final: deal.final,
      });
      sent += 1;
      console.log(`✓ ${deal.title} → ${deal.users.map((u) => u.name).join(', ')}`);
    } catch (err) {
      failed += 1;
      console.error(`✗ ${deal.title}:`, err.message);
    }
    await sleep(config.notifyDelayMs);
  }

  await saveActiveDeals(store);

  if (inaccessible.length) {
    console.warn(
      `Wishlist okunamayan (${inaccessible.length}): ` +
        inaccessible.map((u) => u.name).join(', '),
    );
  }

  console.log(`Tamam. Gönderilen: ${sent}, başarısız: ${failed}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('Kritik hata:', err);
  process.exitCode = 1;
});
