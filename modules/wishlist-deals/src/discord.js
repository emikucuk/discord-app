import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { config } from './config.js';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function buildEmbed(deal) {
  const logoPath = path.join(config.logosDir, 'steam.png');
  const useFile = existsSync(logoPath);
  const logoUrl = useFile
    ? 'attachment://steam.png'
    : 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/steam.png';

  const embed = {
    title: `🔥 ${deal.title}`.slice(0, 256),
    url: `https://store.steampowered.com/app/${deal.appId}/?l=turkish`,
    color: 0x66c0f4,
    author: {
      name: 'Steam · Wishlist indirimi',
      icon_url: logoUrl,
    },
    description: [
      `**-${deal.discountPercent}%** indirim`,
      deal.formattedInitial && deal.formattedFinal
        ? `~~${deal.formattedInitial}~~ → **${deal.formattedFinal}**`
        : null,
    ]
      .filter(Boolean)
      .join('\n')
      .slice(0, 4096),
    fields: [
      {
        name: 'İstek listesinde',
        value: deal.users.map((u) => u.name).join(', ').slice(0, 1024) || '—',
        inline: false,
      },
    ],
    footer: { text: 'Wishlist indirim takibi · aynı dönem tekrar bildirilmez' },
    timestamp: new Date().toISOString(),
  };

  if (deal.headerImage) {
    embed.image = { url: deal.headerImage };
  }
  embed.thumbnail = { url: logoUrl };

  return {
    embed,
    logo: useFile
      ? { filePath: logoPath, attachmentName: 'steam.png' }
      : null,
  };
}

async function postWithFetch(webhookUrl, payload, logo) {
  let res;
  if (logo?.filePath) {
    const form = new FormData();
    form.append('payload_json', JSON.stringify(payload));
    form.append(
      'files[0]',
      new Blob([readFileSync(logo.filePath)], { type: 'image/png' }),
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
  const bodyFile = path.join(tmpdir(), `wd-webhook-${process.pid}-${Date.now()}.json`);
  writeFileSync(bodyFile, JSON.stringify(payload), 'utf8');
  try {
    const curlBin = process.platform === 'win32' ? 'curl.exe' : 'curl';
    const args = ['-sS', '-o', '-', '-w', '\nHTTP_CODE:%{http_code}', '-X', 'POST'];
    if (logo?.filePath) {
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
    const code = Number(out.match(/HTTP_CODE:(\d+)/)?.[1] || 0);
    if (code === 429) return { retry: true };
    if (code !== 204 && code !== 200) {
      throw new Error(`Discord webhook hatası (curl): ${code}`);
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

export async function sendDealNotification(deal) {
  const webhookUrl = config.webhookUrl();
  if (!webhookUrl) throw new Error('DISCORD_WEBHOOK_URL_WISHLIST tanımlı değil');

  const mentions = deal.users.map((u) => `<@${u.discordId}>`).join(' ');
  const { embed, logo } = buildEmbed(deal);

  const payload = {
    username: 'Wishlist İndirimleri',
    content: `${mentions} — wishlist'inizdeki oyun indirimde!`.slice(0, 2000),
    allowed_mentions: {
      users: deal.users.map((u) => u.discordId),
    },
    embeds: [embed],
  };

  try {
    return await postWithFetch(webhookUrl, payload, logo);
  } catch (err) {
    const msg = String(err?.cause?.code || err?.message || err);
    const isTimeout =
      msg.includes('Timeout') ||
      msg.includes('UND_ERR_CONNECT') ||
      msg.includes('fetch failed');
    if (!isTimeout) throw err;
    console.warn('[discord] fetch zaman aşımı, curl ile deneniyor...');
    const curlResult = postWithCurl(webhookUrl, payload, logo);
    if (curlResult.retry) {
      await sleep(2000);
      return sendDealNotification(deal);
    }
    return true;
  }
}
