import { readFile } from 'node:fs/promises';
import { config } from './config.js';

/**
 * users.json'u GitHub'a yazar — Actions tarayıcısı güncel listeyi görsün.
 * GITHUB_TOKEN + GITHUB_REPO (owner/name) gerekir.
 */
export async function syncUsersJsonToGithub() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
  const repo = process.env.GITHUB_REPO || ''; // örn. emikucuk/discord-app
  if (!token || !repo) {
    return { synced: false, reason: 'GITHUB_TOKEN/GITHUB_REPO yok — sadece yerel kayıt' };
  }

  const pathInRepo = 'modules/wishlist-deals/data/users.json';
  const content = await readFile(config.usersFile, 'utf8');
  const apiBase = `https://api.github.com/repos/${repo}/contents/${pathInRepo}`;

  let sha;
  const getRes = await fetch(apiBase, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': config.userAgent,
    },
  });
  if (getRes.ok) {
    const existing = await getRes.json();
    sha = existing.sha;
  } else if (getRes.status !== 404) {
    const t = await getRes.text();
    throw new Error(`GitHub okuma hatası: ${getRes.status} ${t.slice(0, 160)}`);
  }

  const body = {
    message: 'chore(wishlist-deals): steam-bagla kullanıcı listesini güncelle',
    content: Buffer.from(content, 'utf8').toString('base64'),
    branch: process.env.GITHUB_BRANCH || 'main',
  };
  if (sha) body.sha = sha;

  const putRes = await fetch(apiBase, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': config.userAgent,
    },
    body: JSON.stringify(body),
  });

  if (!putRes.ok) {
    const t = await putRes.text();
    throw new Error(`GitHub yazma hatası: ${putRes.status} ${t.slice(0, 200)}`);
  }

  return { synced: true };
}
