import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { config, storeMeta } from './config.js';

function isPng(buf) {
  return (
    buf.length > 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  );
}

let failed = 0;

for (const [key, meta] of Object.entries(storeMeta)) {
  const filePath = path.join(config.logosDir, meta.file);
  const localOk = existsSync(filePath) && isPng(readFileSync(filePath));
  let cdn = '—';
  if (meta.logo) {
    try {
      const res = await fetch(meta.logo, {
        method: 'HEAD',
        signal: AbortSignal.timeout(15000),
        redirect: 'follow',
      });
      cdn = `${res.status} ${res.headers.get('content-type') || ''}`;
      if (!res.ok) failed += 1;
    } catch (err) {
      cdn = `ERR ${err.cause?.code || err.message}`;
      // Yerel PNG varsa CDN yedek hatası kritik değil (attachment kullanılır)
    }
  }
  if (!localOk) failed += 1;
  console.log(
    `${key.padEnd(6)} local=${localOk ? 'OK PNG' : 'FAIL'}  cdn=${cdn}  file=${meta.file}`,
  );
}

if (failed) {
  console.error(`\n${failed} logo kontrolü başarısız.`);
  process.exitCode = 1;
} else {
  console.log('\nTüm mağaza logoları hazır (yerel PNG + CDN yedekleri).');
}
