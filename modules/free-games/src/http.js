import { config } from './config.js';

export async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json,text/plain,*/*',
      'User-Agent': config.userAgent,
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(config.requestTimeoutMs),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} — ${url}`);
  }

  return res.json();
}

export async function fetchText(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': config.userAgent,
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(config.requestTimeoutMs),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} — ${url}`);
  }

  return res.text();
}
