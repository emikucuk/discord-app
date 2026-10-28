import { spawnSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadEnvFile } from '../config.js';

await loadEnvFile();

const appId = process.env.APP_ID || process.env.DISCORD_APP_ID || '';
const token = process.env.DISCORD_TOKEN || '';
const guildId = process.env.GUILD_ID || '';

if (!appId || !token) {
  console.error('APP_ID ve DISCORD_TOKEN gerekli (.env)');
  process.exit(1);
}

const commands = [
  {
    name: 'steam-bagla',
    description: 'Steam hesabını wishlist indirim takibine bağla',
    options: [
      {
        type: 3,
        name: 'profil',
        description: 'Steam profil URL, vanity ad veya steamID64',
        required: true,
      },
    ],
  },
  {
    name: 'steam-cikar',
    description: 'Steam bağlantını wishlist takibinden kaldır',
  },
  {
    name: 'steam-durum',
    description: 'Steam bağlantı durumunu göster',
  },
];

const url = guildId
  ? `https://discord.com/api/v10/applications/${appId}/guilds/${guildId}/commands`
  : `https://discord.com/api/v10/applications/${appId}/commands`;

const bodyFile = path.join(tmpdir(), `wd-cmds-${process.pid}.json`);
writeFileSync(bodyFile, JSON.stringify(commands), 'utf8');

try {
  const curlBin = process.platform === 'win32' ? 'curl.exe' : 'curl';
  const result = spawnSync(
    curlBin,
    [
      '-sS',
      '-X',
      'PUT',
      '-H',
      `Authorization: Bot ${token}`,
      '-H',
      'Content-Type: application/json',
      '--data-binary',
      `@${bodyFile}`,
      '-w',
      '\nHTTP_CODE:%{http_code}',
      url,
    ],
    { encoding: 'utf8' },
  );

  if (result.error) throw result.error;
  const out = `${result.stdout || ''}${result.stderr || ''}`;
  const code = Number(out.match(/HTTP_CODE:(\d+)/)?.[1] || 0);
  if (code < 200 || code >= 300) {
    console.error('Komut kaydı başarısız:', code);
    console.error(out.replace(token, '[TOKEN]').slice(0, 500));
    process.exit(1);
  }

  console.log(
    guildId
      ? `Guild komutları kaydedildi (${guildId}): steam-bagla, steam-cikar, steam-durum`
      : 'Global komutlar kaydedildi.',
  );
} finally {
  try {
    unlinkSync(bodyFile);
  } catch {
    // ignore
  }
}
