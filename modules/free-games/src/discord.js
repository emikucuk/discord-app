import { config, storeMeta } from './config.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatEndDate(isoOrText) {
  if (!isoOrText) return 'Bilinmiyor';
  const d = new Date(isoOrText);
  if (Number.isNaN(d.getTime())) return String(isoOrText);
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Europe/Istanbul',
  }).format(d);
}

export function buildEmbed(game) {
  const meta = storeMeta[game.store] || { label: game.store, color: 0x5865f2 };
  const descriptionParts = [];

  if (game.description) {
    descriptionParts.push(game.description.slice(0, 350));
  }
  descriptionParts.push(`**Mağaza:** ${meta.label}`);
  descriptionParts.push(`**Son tarih:** ${formatEndDate(game.endsAt)}`);
  if (game.originalPrice) {
    descriptionParts.push(`**Normal fiyat:** ${game.originalPrice}`);
  }

  const embed = {
    title: game.title.slice(0, 256),
    url: game.url,
    description: descriptionParts.join('\n').slice(0, 4096),
    color: meta.color,
    footer: { text: 'Ücretsiz Oyun Bildirimi' },
    timestamp: new Date().toISOString(),
  };

  if (game.image) {
    embed.image = { url: game.image };
  }

  return embed;
}

/**
 * Discord webhook ile görselli embed gönderir.
 * @returns {Promise<boolean>} başarı
 */
export async function sendGameNotification(game) {
  const webhookUrl = config.webhookUrl();
  if (!webhookUrl) {
    throw new Error('DISCORD_WEBHOOK_URL tanımlı değil');
  }

  const body = {
    username: 'Ücretsiz Oyunlar',
    embeds: [buildEmbed(game)],
  };

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(config.requestTimeoutMs),
  });

  if (res.status === 429) {
    const retry = Number(res.headers.get('retry-after') || 2);
    await sleep(Math.max(1, retry) * 1000);
    return sendGameNotification(game);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Discord webhook hatası: ${res.status} ${text.slice(0, 200)}`);
  }

  return true;
}

export async function notifyGames(games) {
  const results = { sent: [], failed: [], errors: [] };

  for (const game of games) {
    try {
      await sendGameNotification(game);
      results.sent.push(game);
    } catch (err) {
      results.failed.push(game);
      results.errors.push(`${game.store}:${game.title} → ${err.message}`);
      console.error(err);
    }
    await sleep(config.notifyDelayMs);
  }

  return results;
}
