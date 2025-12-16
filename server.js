import express from 'express'
import pino from 'pino'
import fs from 'fs'
import { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } from '@whiskeysockets/baileys'
import { handleCommand } from '../js/commands.js'

const app = express()
app.use(express.json())
app.use(express.static('public'))

const MAX_SESSIONS = 40
const sessions = new Map()

async function createSession(number){
  if(sessions.has(number)) return sessions.get(number)
  if(sessions.size >= MAX_SESSIONS) throw new Error('Limite de sessions atteinte')

  const path = `./sessions/user-${number}`
  const { state, saveCreds } = await useMultiFileAuthState(path)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({ auth: state, version, logger: pino({ level:'silent' }) })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0]
    if(!msg.message || msg.key.fromMe) return
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text
    if(!text) return
    const cmd = text.split(' ')[0].toLowerCase()
    await handleCommand(sock,msg,cmd)
  })

  sessions.set(number,sock)
  return sock
}

app.get('/pair', async (req,res)=>{
  try{
    const number = req.query.number
    if(!number) return res.json({ error:'Numéro requis' })
    const sock = await createSession(number)
    const code = await sock.requestPairingCode(number)
    res.json({ code })
  }catch(e){
    res.json({ error:e.message })
  }
})

app.get('/count',(req,res)=>{
  res.json({ count: sessions.size, max: MAX_SESSIONS })
})

app.listen(3000,()=>console.log('🚀 CRAZY-MINI SaaS ON http://localhost:3000'))
