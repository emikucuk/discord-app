import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleRoot = path.resolve(__dirname, '..');
const logosDir = path.join(moduleRoot, 'assets', 'logos');

/** Yerel .env yükler (GitHub Actions'ta secret kullanılır; dosya zorunlu değil). */
export async function loadEnvFile() {
  const envPath = path.join(moduleRoot, '.env');
  try {
    const { readFile } = await import('node:fs/promises');
    const raw = await readFile(envPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // .env yoksa sessizce geç
  }
}

export const config = {
  country: 'TR',
  locale: 'tr-TR',
  webhookUrl: () => process.env.DISCORD_WEBHOOK_URL || '',
  firstRunNotify: () =>
    String(process.env.FIRST_RUN_NOTIFY || 'false').toLowerCase() === 'true',
  seenFile: path.join(moduleRoot, 'data', 'seen.json'),
  logosDir,
  userAgent:
    'discord-app-free-games/1.0 (+https://github.com; GitHub Actions notifier)',
  requestTimeoutMs: 25_000,
  /** Discord rate limit için bildirimler arası bekleme (ms) */
  notifyDelayMs: 800,
};

/**
 * Mağaza görselleri:
 * - file: webhook attachment (her zaman çalışır)
 * - logo: yedek public CDN (Wikimedia 400 verdiği için jsDelivr)
 * Renkler bilinçli olarak parlak tutuldu (koyu Steam laciverti gömülü kalıyordu).
 */
export const storeMeta = {
  epic: {
    label: 'Epic Games',
    emoji: '🟣',
    color: 0x2e9bff,
    file: 'epic.png',
    logo: 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/epic-games.png',
  },
  steam: {
    label: 'Steam',
    emoji: '🔵',
    color: 0x66c0f4,
    file: 'steam.png',
    logo: 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/steam.png',
  },
  gog: {
    label: 'GOG',
    emoji: '🟣',
    color: 0xc964ff,
    file: 'gog.png',
    // Yerel PNG; CDN yedeği yoksa attachment kullanılır
    logo: null,
  },
  prime: {
    label: 'Prime Gaming',
    emoji: '🔷',
    color: 0x00d4ff,
    file: 'prime.png',
    logo: 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/amazon-prime.png',
  },
};
