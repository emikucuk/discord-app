# free-games

Epic Games, Steam, GOG ve Prime Gaming üzerindeki **ücretsiz / giveaway** oyunlarını tarar; yalnızca **yeni** olanları Discord’a görselli embed ile bildirir.

Bağımsız modüldür; kökteki Discord örnek uygulamasına veya diğer modüllere bağımlı değildir.

## Özellikler

| Ayar | Değer |
| --- | --- |
| Mağazalar | Epic, Steam, GOG, Prime Gaming |
| Ortam | GitHub Actions |
| Aralık | 1440 dk (günde 1, `0 12 * * *` UTC) |
| Mesaj | Görselli Discord embed (TR) |
| Tekrar bildirim | Yok (`data/seen.json`) |
| Ülke | TR |

## Kurulum

### 1. Discord webhook

Adımlar: [`../../Common/discord-webhook-kurulum.md`](../../Common/discord-webhook-kurulum.md)

### 2. GitHub Secret

Repo → **Settings** → **Secrets and variables** → **Actions** → secret adı:

```text
DISCORD_WEBHOOK_URL
```

### 3. Workflow’u çalıştır

- Otomatik: her gün 12:00 UTC
- Elle: **Actions** → **Free Games Notifier** → **Run workflow**

İlk koşuda mevcut ücretsiz oyunlar **bildirilmeden** `seen.json`’a yazılır (kanal spam’i olmasın diye). Sonraki koşularda yalnızca yeni oyunlar gider.

İlk koşuda da bildirim istersen secret/env olarak `FIRST_RUN_NOTIFY=true` ekle.

## Yerel çalıştırma

```bash
cd modules/free-games
cp .env.example .env
# .env içine DISCORD_WEBHOOK_URL yaz
npm start
```

Harici npm bağımlılığı yoktur (Node 20+ `fetch`).

## Kaynaklar

- **Epic:** Resmi `freeGamesPromotions` API (`country=TR`)
- **Steam / GOG / Prime:** [GamerPower](https://www.gamerpower.com/api/giveaways) giveaway API (+ Steam/GOG yedek katalog)

## Dosyalar

```text
modules/free-games/
├── data/seen.json          # bildirilen oyun kimlikleri (Actions commit eder)
├── src/
│   ├── index.js
│   ├── config.js
│   ├── discord.js
│   ├── seen-store.js
│   └── stores/
└── package.json
```
