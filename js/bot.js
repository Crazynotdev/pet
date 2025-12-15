const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@adiwajshing/baileys');
const pino = require('pino');

const maxBots = 50;
let connectedBots = 0;

async function startBot() {
  if (connectedBots >= maxBots) return;
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({ logger: pino({ level: 'silent' }), printQRInTerminal: true, auth: state, version });

  connectedBots++;

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'close') { connectedBots = Math.max(0, connectedBots - 1); startBot(); }
  });

  sock.ev.on('messages.upsert', async (m) => {
    if (!m.messages?.[0]?.message) return;
    const msg = m.messages[0];
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
    const from = msg.key.remoteJid;
    if (!text || !text.startsWith('.')) return;

    const args = text.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    switch (command) {
      case 'menu': await sock.sendMessage(from, { text: '📋 Commandes:\n.menu\n.ping\n.info' }); break;
      case 'ping': await sock.sendMessage(from, { text: '🏓 Pong !' }); break;
      case 'info': await sock.sendMessage(from, { text: `Bot CRAZY MINI MD\nUtilisateur: ${from}` }); break;
      default: await sock.sendMessage(from, { text: '❌ Commande inconnue ! Tapez .menu' }); break;
    }
  });
}

module.exports = { startBot };
