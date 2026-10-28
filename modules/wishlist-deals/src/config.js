import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleRoot = path.resolve(__dirname, '..');

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
    // yoksa geç
  }
}

export const config = {
  country: 'TR',
  locale: 'turkish',
  // Ayrı kanal → ayrı webhook (free-games DISCORD_WEBHOOK_URL ile karışmasın)
  webhookUrl: () =>
    process.env.DISCORD_WEBHOOK_URL_WISHLIST ||
    process.env.DISCORD_WEBHOOK_URL ||
    '',
  steamApiKey: () => process.env.STEAM_WEB_API_KEY || '',
  /** /steam-bagla için zorunlu rol (opsiyonel) */
  steamLinkRoleId: () => process.env.STEAM_LINK_ROLE_ID || '',
  minDiscountPercent: () => {
    const n = Number(process.env.MIN_DISCOUNT_PERCENT || 10);
    return Number.isFinite(n) ? n : 10;
  },
  usersFile: path.join(moduleRoot, 'data', 'users.json'),
  dealsFile: path.join(moduleRoot, 'data', 'active-deals.json'),
  logosDir: path.join(moduleRoot, 'assets', 'logos'),
  userAgent:
    'discord-app-wishlist-deals/1.0 (+https://github.com; GitHub Actions notifier)',
  requestTimeoutMs: 25_000,
  notifyDelayMs: 900,
  priceConcurrency: 4,
};
