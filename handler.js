const  { downloadMediaMessage } = require('@whiskeysockets/baileys');
async function Delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
};


module.exports = (crazy) => async ({ messages }) => {
    const m = messages[0]
    if (m.message || m.key.fromMe) return

    const msg = m.message.conversation || ''
    if (!msg.startsWith('.')) return
    const cmd = msg.slice(1).trim().split(' ')[0].toLowerCase();

    switch(cmd) {
        case 'ping': {
            const a = Date.now();
            await Delay();
            const b = Date.now();
            crazy.sendMessage(m.key.remoteJid, { text: `Pong!\nResponse Time: ${b - a}ms` }, { quoted: m });

        }
        break;
        case 'sticker': {
            if (m.message.imageMessage || m.message.videoMessage) {
                const media = await downloadMediaMessage(m, 'buffer', {}, { logger: crazy.logger, reuploadRequest: crazy.updateMediaMessage });
                crazy.sendMessage(m.key.remoteJid, { sticker: media }, { quoted: m });
            } else {
                crazy.sendMessage(m.key.remoteJid, { text: 'Please send an image or video to convert to sticker.' }, { quoted: m });
            }
        }
        break;
        default:
            crazy.sendMessage(m.key.remoteJid, { text: `Unknown command: ${cmd}` }, { quoted: m });
    }};
