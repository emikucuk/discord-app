import express from 'express';
import {
  InteractionResponseFlags,
  InteractionResponseType,
  InteractionType,
  verifyKeyMiddleware,
} from 'discord-interactions';
import { loadEnvFile, config } from '../config.js';
import { upsertUser, removeUser, findUser } from '../users.js';
import { resolveSteamId64, verifyWishlistAccessible } from '../steam-id.js';
import { syncUsersJsonToGithub } from '../github-sync.js';

await loadEnvFile();

const PUBLIC_KEY = process.env.PUBLIC_KEY || '';
const PORT = Number(process.env.PORT || 3100);
const REQUIRED_ROLE_ID = process.env.STEAM_LINK_ROLE_ID || '';
const PUBLIC_BASE_URL = (
  process.env.PUBLIC_BASE_URL || 'https://eminkucuk.online'
).replace(/\/$/, '');
const INTERACTIONS_PATH =
  process.env.INTERACTIONS_PATH || '/api/discord/wishlist/interactions';

if (!PUBLIC_KEY) {
  console.error('PUBLIC_KEY eksik (.env) — Discord Interactions doğrulaması için gerekli');
  process.exit(1);
}

function ephemeral(content) {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content,
      flags: InteractionResponseFlags.EPHEMERAL,
    },
  };
}

function memberHasRole(member) {
  if (!REQUIRED_ROLE_ID) return true;
  const roles = member?.roles;
  return Array.isArray(roles) && roles.includes(REQUIRED_ROLE_ID);
}

function displayName(interaction) {
  return (
    interaction.member?.nick ||
    interaction.member?.user?.global_name ||
    interaction.member?.user?.username ||
    interaction.user?.global_name ||
    interaction.user?.username ||
    'oyuncu'
  );
}

function userId(interaction) {
  return interaction.member?.user?.id || interaction.user?.id;
}

function getOption(data, name) {
  const opt = data?.options?.find((o) => o.name === name);
  return opt?.value;
}

async function handleInteraction(req, res) {
  const interaction = req.body;
  const { type, data } = interaction;

  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  if (type !== InteractionType.APPLICATION_COMMAND) {
    return res.status(400).json({ error: 'unsupported' });
  }

  const name = data?.name;
  const discordId = userId(interaction);

  if (!discordId) {
    return res.send(ephemeral('Kullanıcı kimliği okunamadı.'));
  }

  if (!memberHasRole(interaction.member)) {
    return res.send(
      ephemeral('Bu komutu kullanmak için gerekli role sahip değilsin.'),
    );
  }

  try {
    if (name === 'steam-durum') {
      const linked = await findUser(discordId);
      if (!linked) {
        return res.send(
          ephemeral('Steam bağlı değil. `/steam-bagla profil:` ile bağla.'),
        );
      }
      return res.send(
        ephemeral(
          `Bağlı: **${linked.name}**\nProfil: https://steamcommunity.com/profiles/${linked.steamId64}/`,
        ),
      );
    }

    if (name === 'steam-cikar') {
      const removed = await removeUser(discordId);
      if (!removed) {
        return res.send(ephemeral('Zaten bağlı bir Steam hesabın yok.'));
      }
      try {
        await syncUsersJsonToGithub();
      } catch (err) {
        console.warn('[steam-cikar] github sync:', err.message);
      }
      return res.send(ephemeral('Steam bağlantın kaldırıldı.'));
    }

    if (name === 'steam-bagla') {
      const profil = getOption(data, 'profil');
      const apiKey = config.steamApiKey();
      if (!apiKey) {
        console.error('[steam-bagla] STEAM_WEB_API_KEY eksik');
        return res.send(
          ephemeral('Şu an kayıt alınamıyor. Lütfen daha sonra tekrar dene.'),
        );
      }

      const steamId64 = await resolveSteamId64(profil, apiKey);
      const accessible = await verifyWishlistAccessible(steamId64, apiKey);
      if (!accessible) {
        return res.send(
          ephemeral(
            'Kayıt tamamlanamadı.\nSteam gizlilik ayarlarından **Wishlist → Public** yapıp tekrar `/steam-bagla` dene.',
          ),
        );
      }

      const row = await upsertUser({
        discordId,
        steamId64,
        name: displayName(interaction),
      });

      try {
        const sync = await syncUsersJsonToGithub();
        if (!sync.synced) console.warn('[steam-bagla] github sync:', sync.reason);
      } catch (err) {
        console.warn('[steam-bagla] github sync:', err.message);
      }

      return res.send(
        ephemeral(
          `Kayıt olundu ✅\n**${row.name}** Steam hesabın wishlist takibine eklendi.\nİndirim olunca bu sunucuda etiketlenerek bilgilendirileceksin.`,
        ),
      );
    }

    return res.send(ephemeral(`Bilinmeyen komut: ${name}`));
  } catch (err) {
    console.error(err);
    return res.send(ephemeral(`Hata: ${err.message}`));
  }
}

const app = express();
app.set('trust proxy', 1);

const healthPath = INTERACTIONS_PATH.replace(/\/interactions$/, '/health');

app.get(healthPath, (_req, res) => {
  res.json({
    ok: true,
    service: 'wishlist-deals-steam-bagla',
    interactionsUrl: `${PUBLIC_BASE_URL}${INTERACTIONS_PATH}`,
  });
});

// Discord portal’a yapıştırılacak adres
app.post(
  INTERACTIONS_PATH,
  verifyKeyMiddleware(PUBLIC_KEY),
  handleInteraction,
);

// Yerel/debug kolaylığı
if (INTERACTIONS_PATH !== '/interactions') {
  app.post('/interactions', verifyKeyMiddleware(PUBLIC_KEY), handleInteraction);
}

app.listen(PORT, () => {
  console.log(`steam-bagla dinliyor :${PORT}`);
  console.log(`Discord Interactions Endpoint URL:`);
  console.log(`  ${PUBLIC_BASE_URL}${INTERACTIONS_PATH}`);
  console.log(`Health: ${PUBLIC_BASE_URL}${healthPath}`);
  if (REQUIRED_ROLE_ID) console.log(`Rol şartı: ${REQUIRED_ROLE_ID}`);
});
