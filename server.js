import express from 'express'
import pino from 'pino'
import { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } from '@whiskeysockets/baileys'
import { handleCommand } from '../js/commands.js'

const app = express()
app.use(express.json())
app.use(express.static('public'))

const MAX_SESSIONS = 40
const sessions = new Map()
let sock

// hm
async function initWA() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth')
  const { version } = await fetchLatestBaileysVersion()

  sock = makeWASocket({
    logger: pino({ level: 'silent' }),
    auth: state,
    version
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0]
    if (!msg.message || msg.key.fromMe) return

    const text = msg.message.conversation || msg.message.extendedTextMessage?.text
    if (!text) return

    const cmd = text.split(' ')[0].toLowerCase()
    await handleCommand(sock, msg, cmd)
  })
}

await initWA()

app.get('/pair', async (req, res) => {
  try {
    const number = req.query.number
    if (!number) return res.json({ error: 'Numéro requis' })

    if (!sock) return res.json({ error: 'Socket WhatsApp non prêt, réessaie' })
    
    sock.ev.once('pairing.update', (update) => {
      if (update.code) {
        
        res.json({ code: update.code })
      } else if (update.timeout) {
        res.json({ error: 'Timeout lors du pairing' })
      }
    })

    //  timeout
    await sock.requestPairingCode(number)

    // Timeout de sécurité
    setTimeout(() => {
      res.json({ error: 'Timeout - Aucun code reçu' })
    }, 30000)

  } catch (e) {
    console.error('Erreur pairing:', e)
    res.json({ error: e.message })
  }
})

// Compte des sessions
app.get('/count', (req, res) => {
  res.json({ count: sessions.size, max: MAX_SESSIONS })
})

app.listen(3000, () => console.log('🚀 CRAZY-MINI en ligne sur http://localhost:3000'))
