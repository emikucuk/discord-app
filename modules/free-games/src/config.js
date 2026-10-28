import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleRoot = path.resolve(__dirname, '..');

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
  userAgent:
    'discord-app-free-games/1.0 (+https://github.com; GitHub Actions notifier)',
  requestTimeoutMs: 25_000,
  /** Discord rate limit için bildirimler arası bekleme (ms) */
  notifyDelayMs: 800,
};

export const storeMeta = {
  epic: { label: 'Epic Games', color: 0x0078f2 },
  steam: { label: 'Steam', color: 0x1b2838 },
  gog: { label: 'GOG', color: 0x86328a },
  prime: { label: 'Prime Gaming', color: 0x00a8e1 },
};
