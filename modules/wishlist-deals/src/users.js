import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';

function normalize(users) {
  return (Array.isArray(users) ? users : [])
    .map((u) => ({
      name: String(u.name || u.discordId || 'oyuncu').trim(),
      discordId: String(u.discordId || '').trim(),
      steamId64: String(u.steamId64 || u.steamId || '').trim(),
      linkedAt: u.linkedAt || null,
    }))
    .filter((u) => u.discordId && /^\d{16,20}$/.test(u.discordId) && /^\d{17}$/.test(u.steamId64));
}

export async function readUsersFile() {
  try {
    const raw = await readFile(config.usersFile, 'utf8');
    const data = JSON.parse(raw);
    return { users: normalize(data?.users) };
  } catch {
    return { users: [] };
  }
}

export async function loadUsers() {
  const data = await readUsersFile();
  return data.users;
}

export async function saveUsersFile(users) {
  await mkdir(path.dirname(config.usersFile), { recursive: true });
  const payload = { users: normalize(users) };
  await writeFile(config.usersFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return payload.users;
}

export async function upsertUser({ discordId, steamId64, name }) {
  const data = await readUsersFile();
  const idx = data.users.findIndex((u) => u.discordId === discordId);
  const row = {
    name: name || discordId,
    discordId,
    steamId64,
    linkedAt: new Date().toISOString(),
  };
  if (idx >= 0) data.users[idx] = { ...data.users[idx], ...row };
  else data.users.push(row);
  await saveUsersFile(data.users);
  return row;
}

export async function removeUser(discordId) {
  const data = await readUsersFile();
  const next = data.users.filter((u) => u.discordId !== discordId);
  const removed = next.length !== data.users.length;
  await saveUsersFile(next);
  return removed;
}

export async function findUser(discordId) {
  const users = await loadUsers();
  return users.find((u) => u.discordId === discordId) || null;
}
