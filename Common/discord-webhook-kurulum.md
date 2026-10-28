# Discord Webhook Kurulumu

Ücretsiz oyun bildirimleri bot hesabı gerektirmez; kanal webhook’u yeterlidir.

## 1. Discord’da webhook oluştur

1. Bildirimlerin gideceği sunucuda bir metin kanalı seç (ör. `#ucretsiz-oyunlar`).
2. Kanal adının yanındaki dişli ikonuna tıkla → **Entegrasyonlar** (Integrations).
3. **Webhook’lar** → **Yeni Webhook** (New Webhook).
4. İsim ver (ör. `Ücretsiz Oyunlar`).
5. İstersen avatar yükle.
6. **Webhook URL’sini Kopyala** — bu URL gizlidir; sohbete/repoya yapıştırma.

URL biçimi şuna benzer:

```text
https://discord.com/api/webhooks/1234567890123456789/AbCdEf...gizli-token...
```

## 2. GitHub Secret olarak ekle

1. GitHub’da bu repoyu aç.
2. **Settings** → **Secrets and variables** → **Actions**.
3. **New repository secret**.
4. Name: `DISCORD_WEBHOOK_URL`
5. Secret: kopyaladığın webhook URL’si.
6. **Add secret**.

Workflow bu secret’ı okur; URL repoda asla görünmez.

## 3. Yerel test (isteğe bağlı)

`modules/free-games/.env` dosyası oluştur (repoya commit etme):

```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

Sonra:

```bash
cd modules/free-games
npm start
```

## Güvenlik

- Webhook URL’si sızdıysa Discord’da webhook’u sil/yenile ve GitHub secret’ı güncelle.
- URL’yi issue, PR veya commit’e koyma.
