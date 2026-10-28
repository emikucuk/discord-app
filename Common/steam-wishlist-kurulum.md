# Steam Wishlist (public) — manuel users.json

`wishlist-deals` için bot şart değil.

## 1. Wishlist → Public

Steam gizlilik → **Wishlist: Public**

## 2. Steam API key

https://steamcommunity.com/dev/apikey → GitHub Secret: `STEAM_WEB_API_KEY`

## 3. Kullanıcı ekle

`modules/wishlist-deals/data/users.json`:

```json
{
  "users": [
    {
      "name": "Ali",
      "discordId": "DiscordKimlik",
      "steamId64": "76561198..."
    }
  ]
}
```

Push → Actions tarar. Ayrıntı: `modules/wishlist-deals/README.md`
