import { spawnSync } from 'node:child_process';
import { unlinkSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { config } from './config.js';

function isFetchTimeout(err) {
  const msg = String(err?.cause?.code || err?.message || err);
  return (
    msg.includes('Timeout') ||
    msg.includes('UND_ERR_CONNECT') ||
    msg.includes('fetch failed') ||
    msg.includes('AbortError')
  );
}

function curlGet(url, headers = {}) {
  const outFile = path.join(tmpdir(), `wd-http-${process.pid}-${Date.now()}.out`);
  const curlBin = process.platform === 'win32' ? 'curl.exe' : 'curl';
  const args = ['-sS', '-L', '--connect-timeout', '20', '--max-time', '45', '-o', outFile, '-w', '%{http_code}'];
  for (const [k, v] of Object.entries(headers)) {
    args.push('-H', `${k}: ${v}`);
  }
  args.push(url);
  try {
    const result = spawnSync(curlBin, args, { encoding: 'utf8' });
    if (result.error) throw result.error;
    const code = Number((result.stdout || '').trim());
    const body = readFileSync(outFile, 'utf8');
    if (!Number.isFinite(code) || code < 200 || code >= 300) {
      throw new Error(`HTTP ${code || '??'} — ${url}`);
    }
    return body;
  } finally {
    try {
      unlinkSync(outFile);
    } catch {
      // ignore
    }
  }
}

async function getText(url, options = {}) {
  const headers = {
    Accept: 'application/json,text/plain,*/*',
    'User-Agent': config.userAgent,
    ...(options.headers || {}),
  };
  try {
    const res = await fetch(url, {
      ...options,
      headers,
      signal: AbortSignal.timeout(config.requestTimeoutMs),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
    return await res.text();
  } catch (err) {
    if (!isFetchTimeout(err)) throw err;
    console.warn('[http] fetch zaman aşımı, curl ile deneniyor...');
    return curlGet(url, headers);
  }
}

export async function fetchJson(url, options = {}) {
  const text = await getText(url, options);
  return JSON.parse(text);
}
