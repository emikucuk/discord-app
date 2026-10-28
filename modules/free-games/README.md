# free-games

Epic Games, Steam, GOG ve Prime Gaming üzerindeki **ücretsiz / giveaway** oyunlarını tarar; yalnızca **yeni** olanları Discord’a görselli embed ile bildirir.

Bağımsız modüldür; kökteki Discord örnek uygulamasına veya diğer modüllere bağımlı değildir.

## Özellikler

| Ayar | Değer |
| --- | --- |
| Mağazalar | Epic, Steam, GOG, Prime Gaming |
| Ortam | GitHub Actions |
| Aralık | Her gün 12:00 TR (`0 9 * * *` UTC) |
| Mesaj | Görselli Discord embed (TR) |
| Zenginleştirme | Overview, X.Y/10 puan (Metacritic/Steam), sistem gereksinimleri |
| Tekrar bildirim | Yok (`data/seen.json`) |
| Ülke | TR |

Steam Store + SteamSpy ile başlık eşleştirmesi yapılır. Steam’de karşılığı olmayan (ör. salt Epic) oyunlarda puan/gereksinim boş kalabilir.

## Kurulum

### 1. Discord webhook

Adımlar: [`../../Common/discord-webhook-kurulum.md`](../../Common/discord-webhook-kurulum.md)

### 2. GitHub Secret

Repo → **Settings** → **Secrets and variables** → **Actions** → secret adı:

```text
DISCORD_WEBHOOK_URL
```

### 3. Workflow’u çalıştır

- Otomatik: her gün **12:00 Türkiye saati** (09:00 UTC)
- Elle: **Actions** → **Free Games Notifier** → **Run workflow**

İlk koşuda mevcut ücretsiz oyunlar **bildirilmeden** `seen.json`’a yazılır (kanal spam’i olmasın diye). Sonraki koşularda yalnızca yeni oyunlar gider.

İlk koşuda da bildirim istersen secret/env olarak `FIRST_RUN_NOTIFY=true` ekle.

## Yerel çalıştırma

```bash
cd modules/free-games
cp .env.example .env
# .env içine DISCORD_WEBHOOK_URL yaz
npm run test-webhook   # kanala test embed
npm start              # tarama + yalnızca yeni oyunlar
```

Harici npm bağımlılığı yoktur (Node 20+ `fetch`). Yerelde Discord’a `fetch` timeout olursa otomatik `curl` yedeği kullanılır.

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
