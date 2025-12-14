const { makeWASocket, useMultiFileAuthState } = require(’@whiskeysockets/baileys’)
const QRCode = require(‘qrcode’)
const handleMessage = require(’./handler’)

async function startPair(number, mode) {
const { state, saveCreds } = await useMultiFileAuthState(sessions/${number})
const crazy = makeWASocket({ auth: state })

crazy.ev.on(‘creds.update’, saveCreds)
crazy.ev.on(‘messages.upsert’, handleMessage(sock))

if (mode === ‘pair’ && !state.creds.registered) {
try {
const code = await crazy.requestPairingCode(number)
return { type: ‘pair’, data: code }
} catch (err) {
console.error(‘Erreur Pairing Code:’, err)
return { type: ‘error’, data: err.message }
}
}

if (mode === ‘qr’) {
return new Promise((resolve, reject) => {
const timeout = setTimeout(() => reject(new Error(‘QR timeout’)), 15000)
crazy.ev.on(‘connection.update’, async (update) => {
try {
if (update.qr) {
clearTimeout(timeout)
const qrImage = await QRCode.toDataURL(update.qr)
resolve({ type: ‘qr’, data: qrImage })
}
if (update.connection === ‘close’) {
console.log(‘Connexion fermée:’, update.lastDisconnect?.error)
}
if (update.connection === ‘open’) {
console.log(‘Connecté à WhatsApp’)
}
} catch (err) {
reject(err)
}
})
})
}
}

module.exports = { startPair }
