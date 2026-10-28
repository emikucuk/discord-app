/**
 * Terminal / yerel test için Gateway bot.
 * Public URL, ngrok, Interactions Endpoint gerekmez — sadece DISCORD_TOKEN.
 */
import dns from 'node:dns';
import { Agent, setGlobalDispatcher } from 'undici';
import {
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
} from 'discord.js';
import { loadEnvFile, config } from '../config.js';
import { upsertUser, removeUser, findUser } from '../users.js';
import { resolveSteamId64, verifyWishlistAccessible } from '../steam-id.js';
import { syncUsersJsonToGithub } from '../github-sync.js';

// Windows'ta Node bazen IPv6'da takılıyor; curl çalışıp fetch timeout oluyor
dns.setDefaultResultOrder('ipv4first');
setGlobalDispatcher(
  new Agent({
    connectTimeout: 60_000,
    headersTimeout: 60_000,
    bodyTimeout: 60_000,
    connect: { timeout: 60_000, family: 4 },
  }),
);

await loadEnvFile();

const token = process.env.DISCORD_TOKEN || '';
const REQUIRED_ROLE_ID = process.env.STEAM_LINK_ROLE_ID || '';

if (!token) {
  console.error('DISCORD_TOKEN eksik (.env)');
  process.exit(1);
}

function hasRequiredRole(interaction) {
  if (!REQUIRED_ROLE_ID) return true;
  const roles = interaction.member?.roles;
  if (!roles) return false;
  // GuildMemberRoleManager or string[]
  if (typeof roles.cache?.has === 'function') return roles.cache.has(REQUIRED_ROLE_ID);
  if (Array.isArray(roles)) return roles.includes(REQUIRED_ROLE_ID);
  return false;
}

async function reply(interaction, content) {
  const payload = { content, flags: MessageFlags.Ephemeral };
  if (interaction.deferred || interaction.replied) {
    return interaction.followUp(payload);
  }
  return interaction.reply(payload);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once(Events.ClientReady, (c) => {
  console.log(`Bot hazır: ${c.user.tag}`);
  console.log('Discord’da dene: /steam-bagla  /steam-durum  /steam-cikar');
  if (REQUIRED_ROLE_ID) console.log(`Rol şartı: ${REQUIRED_ROLE_ID}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (!hasRequiredRole(interaction)) {
    await reply(interaction, 'Bu komutu kullanmak için gerekli role sahip değilsin.');
    return;
  }

  const discordId = interaction.user.id;
  const name =
    interaction.member?.displayName ||
    interaction.user.globalName ||
    interaction.user.username;

  try {
    if (interaction.commandName === 'steam-durum') {
      const linked = await findUser(discordId);
      if (!linked) {
        await reply(interaction, 'Steam bağlı değil. `/steam-bagla profil:` ile bağla.');
        return;
      }
      await reply(
        interaction,
        `Bağlı: **${linked.name}**\nProfil: https://steamcommunity.com/profiles/${linked.steamId64}/`,
      );
      return;
    }

    if (interaction.commandName === 'steam-cikar') {
      const removed = await removeUser(discordId);
      if (!removed) {
        await reply(interaction, 'Zaten bağlı bir Steam hesabın yok.');
        return;
      }
      try {
        await syncUsersJsonToGithub();
      } catch (err) {
        console.warn('[steam-cikar] github sync:', err.message);
      }
      await reply(interaction, 'Steam bağlantın kaldırıldı.');
      return;
    }

    if (interaction.commandName === 'steam-bagla') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const profil = interaction.options.getString('profil', true);
      const apiKey = config.steamApiKey();
      if (!apiKey) {
        await interaction.editReply(
          'Şu an kayıt alınamıyor. Lütfen daha sonra tekrar dene.',
        );
        console.error('[steam-bagla] STEAM_WEB_API_KEY eksik');
        return;
      }

      const steamId64 = await resolveSteamId64(profil, apiKey);
      const accessible = await verifyWishlistAccessible(steamId64, apiKey);
      if (!accessible) {
        await interaction.editReply(
          'Kayıt tamamlanamadı.\nSteam gizlilik ayarlarından **Wishlist → Public** yapıp tekrar `/steam-bagla` dene.',
        );
        return;
      }

      const row = await upsertUser({ discordId, steamId64, name });

      try {
        const sync = await syncUsersJsonToGithub();
        if (!sync.synced) {
          console.warn('[steam-bagla] github sync atlandı:', sync.reason);
        }
      } catch (err) {
        console.warn('[steam-bagla] github sync:', err.message);
      }

      await interaction.editReply(
        `Kayıt olundu ✅\n**${row.name}** Steam hesabın wishlist takibine eklendi.\nİndirim olunca bu sunucuda etiketlenerek bilgilendirileceksin.`,
      );
      return;
    }
  } catch (err) {
    console.error(err);
    const msg = `Hata: ${err.message}`;
    try {
      if (interaction.deferred || interaction.replied) await interaction.editReply(msg);
      else await reply(interaction, msg);
    } catch {
      // ignore
    }
  }
});

client.login(token);
