const { makeWASocket, useMultiFileAuthState} = require('@whiskeysockets/baileys');
const handleMessage = require('./handler');
const QRcode = require('qrcode');

async function startPair(number, mode) {
    const { state, saveCreds } = await useMultiFileAuthState(`sessions/${number}`);

    const crazy = makeWASocket({
        auth: state,
        printQRInTerminal: mode === 'qr',
    });

    crazy.ev.on('creds.update', saveCreds);
    crazy.ev.on('messages.upsert', handleMessage(crazy));

    crazy.ev.on('connection.update', async (update) => {
        if (update.qr && mode === 'qr') {
            qrImage = await QRcode.toDataURL(update.qr);
        }
});
if (mode === 'pair' && !state.creds.registered) {
    const code = await crazy.generatePairingCode(number);
    return { type: 'pair', data: code };
}
if (mode === 'qr') {
    await new Promise(r => setTimeout(r, 1500));
    return { type: 'qr', data: qrImage };
}};

modules.exports = { startPair};