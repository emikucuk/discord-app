# wishlist-deals

Public Steam wishlist indirimleri → Discord’da ilgili kişileri etiketler.

**Kullanıcı ekleme:** Bot yok. `data/users.json` dosyasını sen doldurursun; GitHub’a push edince Actions tarar.

## users.json

```json
{
  "users": [
    {
      "name": "Ali",
      "discordId": "411561027591733250",
      "steamId64": "76561199304774479"
    }
  ]
}
```

| Alan | Nasıl bulunur |
| --- | --- |
| `name` | İsim (etiket metninde görünür) |
| `discordId` | Discord geliştirici modu → kullanıcıya sağ tık → Kimliği Kopyala |
| `steamId64` | [steamid.io](https://steamid.io) veya profil URL’sinden |

Herkesin Steam wishlist’i **Public** olmalı.

Örnek dosya: `data/users.example.json`

## Kurulum (Actions)

1. `users.json`’u doldur → commit + push  
2. GitHub Secrets:
   - `DISCORD_WEBHOOK_URL_WISHLIST` — indirim kanalı webhook’u  
   - `STEAM_WEB_API_KEY` — [steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey)  
3. Workflow: **Wishlist Deals Notifier** (her gün 12:00 TR / elle Run)

Yerel deneme:

```bash
cd modules/wishlist-deals
npm start
```

## Davranış

- Aynı oyunu birden fazla kişi istiyorsa tek mesajda hepsi etiketlenir  
- Aynı indirim dönemi bir kez bildirilir; bitip yeniden başlarsa tekrar  

## Opsiyonel: /steam-bagla bot

İleride otomatik bağlama istersen: `npm run bot` + `npm run register`  
Şu anki önerilen yol **manuel `users.json`**.
