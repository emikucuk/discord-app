import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { config, storeMeta } from './config.js';
import { enrichGame } from './enrich.js';

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

function field(name, value, inline = false) {
  if (!value) return null;
  return {
    name: name.slice(0, 256),
    value: String(value).slice(0, 1024),
    inline,
  };
}

function resolveLogo(meta) {
  if (!meta?.file) return { attachmentName: null, filePath: null, publicUrl: meta?.logo || null };
  const filePath = path.join(config.logosDir, meta.file);
  if (existsSync(filePath)) {
    return { attachmentName: meta.file, filePath, publicUrl: meta.logo || null };
  }
  return { attachmentName: null, filePath: null, publicUrl: meta.logo || null };
}

/** Alan başlığı doğrudan puan; "Puan" etiketi yok. */
function ratingField(game) {
  if (game.ratingScore == null && !game.ratingDetail && !game.ratingLabel) {
    return null;
  }
  const name =
    game.ratingScore != null
      ? `⭐ ${Number(game.ratingScore).toFixed(1)}/10`
      : '⭐';
  const value =
    game.ratingDetail ||
    (game.ratingLabel
      ? String(game.ratingLabel).replace(/^\*\*\d+(?:\.\d+)?\/10\*\*\s*/m, '').trim()
      : null) ||
    '—';
  return field(name, value, false);
}

export function buildEmbed(game, { useAttachment } = { useAttachment: false }) {
  const meta = storeMeta[game.store] || {
    label: game.store,
    color: 0x5865f2,
    emoji: '🎮',
  };
  const overview = (game.overview || game.description || '').trim();
  const logo = resolveLogo(meta);

  const logoUrl = useAttachment && logo.attachmentName
    ? `attachment://${logo.attachmentName}`
    : logo.publicUrl;

  const embed = {
    title: `🎁 ${game.title}`.slice(0, 256),
    url: game.url,
    description: (
      overview.slice(0, 550) ||
      `${meta.emoji} **${meta.label}** üzerinde ücretsiz!`
    ).slice(0, 4096),
    color: meta.color || 0x5865f2,
    author: {
      name: `${meta.emoji} ${meta.label} · Ücretsiz`,
      url: game.url,
    },
    footer: {
      text: game.enrichmentSource
        ? `Ücretsiz Oyun · ${game.enrichmentSource}`
        : 'Ücretsiz Oyun Bildirimi',
    },
    timestamp: new Date().toISOString(),
    fields: [],
  };

  if (logoUrl) {
    embed.author.icon_url = logoUrl;
    embed.thumbnail = { url: logoUrl };
  }

  const fields = [
    field('📅 Son tarih', formatEndDate(game.endsAt), true),
    field('💰 Normal fiyat', game.originalPrice || '—', true),
    ratingField(game),
    field('📋 Sistem gereksinimleri', game.requirementsField, false),
  ].filter(Boolean);

  embed.fields = fields.slice(0, 25);

  if (game.image) {
    embed.image = { url: game.image };
  }

  return { embed, logo };
}

async function postWithFetch(webhookUrl, payload, logo) {
  let res;

  if (logo?.filePath && logo?.attachmentName) {
    const form = new FormData();
    form.append('payload_json', JSON.stringify(payload));
    const buf = readFileSync(logo.filePath);
    form.append(
      'files[0]',
      new Blob([buf], { type: 'image/png' }),
      logo.attachmentName,
    );
    res = await fetch(webhookUrl, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(config.requestTimeoutMs),
    });
  } else {
    res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(config.requestTimeoutMs),
    });
  }

  if (res.status === 429) {
    const retry = Number(res.headers.get('retry-after') || 2);
    await sleep(Math.max(1, retry) * 1000);
    return postWithFetch(webhookUrl, payload, logo);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Discord webhook hatası: ${res.status} ${text.slice(0, 200)}`);
  }

  return true;
}

function postWithCurl(webhookUrl, payload, logo) {
  const bodyFile = path.join(tmpdir(), `fg-webhook-${process.pid}-${Date.now()}.json`);
  writeFileSync(bodyFile, JSON.stringify(payload), 'utf8');
  try {
    const curlBin = process.platform === 'win32' ? 'curl.exe' : 'curl';
    const args = [
      '-sS',
      '-o',
      '-',
      '-w',
      '\nHTTP_CODE:%{http_code}',
      '-X',
      'POST',
    ];

    if (logo?.filePath && logo?.attachmentName) {
      args.push(
        '-F',
        `payload_json=<${bodyFile};type=application/json`,
        '-F',
        `files[0]=@${logo.filePath};type=image/png;filename=${logo.attachmentName}`,
      );
    } else {
      args.push('-H', 'Content-Type: application/json', '--data-binary', `@${bodyFile}`);
    }
    args.push(webhookUrl);

    const result = spawnSync(curlBin, args, { encoding: 'utf8' });
    if (result.error) throw result.error;

    const out = `${result.stdout || ''}${result.stderr || ''}`;
    const codeMatch = out.match(/HTTP_CODE:(\d+)/);
    const code = codeMatch ? Number(codeMatch[1]) : 0;

    if (code === 429) return { retry: true };
    if (code !== 204 && code !== 200) {
      throw new Error(`Discord webhook hatası (curl): ${code} ${out.slice(0, 180)}`);
    }
    return { ok: true };
  } finally {
    try {
      unlinkSync(bodyFile);
    } catch {
      // ignore
    }
  }
}

/**
 * Discord webhook ile görselli embed gönderir.
 * Logo dosyası varsa attachment olarak eklenir (CDN kırılsa bile görünür).
 */
export async function sendGameNotification(game) {
  const webhookUrl = config.webhookUrl();
  if (!webhookUrl) {
    throw new Error('DISCORD_WEBHOOK_URL tanımlı değil');
  }

  const resolved = resolveLogo(storeMeta[game.store]);
  const useAttachment = Boolean(resolved.filePath);
  const { embed, logo } = buildEmbed(game, { useAttachment });

  const payload = {
    username: 'Ücretsiz Oyunlar',
    embeds: [embed],
  };

  try {
    return await postWithFetch(webhookUrl, payload, useAttachment ? logo : null);
  } catch (err) {
    const msg = String(err?.cause?.code || err?.message || err);
    const isTimeout =
      msg.includes('Timeout') ||
      msg.includes('UND_ERR_CONNECT') ||
      msg.includes('fetch failed');

    if (!isTimeout) throw err;

    console.warn('[discord] fetch zaman aşımı, curl ile deneniyor...');
    const curlResult = postWithCurl(webhookUrl, payload, useAttachment ? logo : null);
    if (curlResult.retry) {
      await sleep(2000);
      return sendGameNotification(game);
    }
    return true;
  }
}

export async function notifyGames(games) {
  const results = { sent: [], failed: [], errors: [] };

  for (const game of games) {
    try {
      const enriched = await enrichGame(game);
      await sendGameNotification(enriched);
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
