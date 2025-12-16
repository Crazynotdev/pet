import express from 'express'
import pino from 'pino'
import { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, delay } from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'

const app = express()

// MIDDLEWARE - À METTRE EN PREMIER
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  next()
})

app.use(express.json())
app.use(express.static('public'))
app.use(express.urlencoded({ extended: true }))

const MAX_SESSIONS = 40
const sessions = new Map()
let sock = null
let isConnecting = false

// Fonction d'initialisation WhatsApp améliorée
async function initWA() {
  console.log('🚀 Démarrage de l\'initialisation WhatsApp...')
  
  try {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info')
    console.log('📁 État d\'authentification chargé')
    
    const { version } = await fetchLatestBaileysVersion()
    console.log(`📦 Version Baileys: ${version}`)

    // Configuration du socket
    sock = makeWASocket({
      logger: pino({ level: 'info' }),
      printQRInTerminal: true,
      auth: state,
      version,
      browser: ['Crazy-Mini', 'Chrome', '1.0.0'],
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 10000
    })

    console.log('✅ Socket WhatsApp créé')

    // Gestion des événements
    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update
      
      if (qr) {
        console.log('📱 QR Code disponible dans le terminal')
      }
      
      if (connection === 'open') {
        console.log('✅ WhatsApp connecté avec succès!')
        isConnecting = false
      }
      
      if (connection === 'close') {
        console.log('❌ Déconnecté de WhatsApp')
        const reason = new Boom(lastDisconnect?.error)?.output?.statusCode
        
        if (reason === 403) {
          console.log('⚠️ Connexion refusée - Supprime le dossier auth_info et réessaie')
        }
        
        if (reason === 428) {
          console.log('🔄 Reconnexion...')
          setTimeout(() => initWA(), 5000)
        }
      }
    })

    // Écouter les messages pairing
    sock.ev.on('pairing.update', (update) => {
      console.log('🔐 Événement pairing.update:', update)
      if (update.code) {
        console.log(`✅ Code de pairing reçu: ${update.code}`)
      }
    })

    console.log('🎉 Initialisation WhatsApp terminée')
    
  } catch (error) {
    console.error('💥 Erreur critique lors de l\'initialisation:', error)
    isConnecting = false
    
    // Tentative de reconnexion après 10 secondes
    setTimeout(() => {
      console.log('🔄 Tentative de reconnexion...')
      initWA()
    }, 10000)
  }
}

// Démarrer l'initialisation
initWA()

// Route pour vérifier l'état du serveur
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    whatsappConnected: sock?.user ? true : false,
    timestamp: new Date().toISOString()
  })
})

// Route principale pour le pairing code
app.get('/pair', async (req, res) => {
  console.log('\n=== NOUVELLE DEMANDE DE PAIRING ===')
  console.log('📞 Numéro demandé:', req.query.number)
  
  // Validation du numéro
  const number = req.query.number?.trim()
  if (!number) {
    console.log('❌ Numéro manquant')
    return res.json({ error: 'Veuillez fournir un numéro WhatsApp' })
  }

  // Validation du format
  if (!/^\d{8,15}$/.test(number)) {
    console.log('❌ Format de numéro invalide')
    return res.json({ error: 'Format de numéro invalide. Exemple: 24101234567' })
  }

  // Vérifier si WhatsApp est prêt
  if (!sock) {
    console.log('❌ WhatsApp non initialisé')
    return res.json({ error: 'WhatsApp en cours d\'initialisation, veuillez réessayer dans 10 secondes' })
  }

  try {
    console.log('🔄 Tentative de génération de pairing code...')
    
    // Créer une promesse pour capturer le code
    let pairingCode = null
    let pairingError = null
    
    // Fonction pour écouter le code
    const waitForCode = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Délai d\'attente dépassé (30 secondes)'))
      }, 30000)
      
      sock.ev.once('pairing.update', (update) => {
        clearTimeout(timeout)
        console.log('📱 Événement pairing reçu:', update)
        
        if (update.code) {
          console.log(`✅ Code généré: ${update.code}`)
          resolve(update.code)
        } else if (update.error) {
          console.log('❌ Erreur de pairing:', update.error)
          reject(new Error(update.error))
        } else {
          console.log('⚠️ Événement pairing inattendu:', update)
          reject(new Error('Événement pairing inattendu'))
        }
      })
    })
    
    // Appeler la méthode pour générer le code
    console.log('📱 Appel de requestPairingCode...')
    
    try {
      // Méthode 1: Essayer requestPairingCode (la plus récente)
      await sock.requestPairingCode(number.replace(/\D/g, ''))
      console.log('✅ requestPairingCode appelé avec succès')
    } catch (err) {
      console.log('⚠️ requestPairingCode échoué:', err.message)
      
      // Méthode 2: Essayer l'ancienne méthode
      try {
        console.log('🔄 Essai avec l\'ancienne méthode...')
        const code = await sock.generatePairingCode(number)
        console.log(`✅ Code via generatePairingCode: ${code}`)
        return res.json({ code })
      } catch (err2) {
        console.log('❌ Les deux méthodes ont échoué:', err2.message)
        throw err2
      }
    }
    
    // Attendre le code
    console.log('⏳ Attente du code de pairing...')
    const code = await waitForCode
    console.log(`🎉 Code final obtenu: ${code}`)
    
    // Stocker la session
    if (code && !sessions.has(number)) {
      sessions.set(number, {
        socket: sock,
        timestamp: Date.now(),
        number: number
      })
      
      // Nettoyer les anciennes sessions si limite dépassée
      if (sessions.size > MAX_SESSIONS) {
        const oldest = Array.from(sessions.entries())
          .sort((a, b) => a[1].timestamp - b[1].timestamp)[0]
        sessions.delete(oldest[0])
        console.log(`🧹 Session ${oldest[0]} supprimée (limite atteinte)`)
      }
    }
    
    // Retourner le code
    res.json({ 
      code,
      message: 'Code généré avec succès',
      expiresIn: '60 secondes'
    })
    
  } catch (error) {
    console.error('💥 Erreur lors du pairing:', error)
    
    // Messages d'erreur plus clairs
    let errorMessage = error.message
    
    if (error.message.includes('timeout') || error.message.includes('délai')) {
      errorMessage = 'Délai d\'attente dépassé. Veuillez réessayer.'
    } else if (error.message.includes('not connected')) {
      errorMessage = 'WhatsApp n\'est pas connecté. Veuillez patienter.'
    } else if (error.message.includes('rate limit')) {
      errorMessage = 'Trop de tentatives. Veuillez attendre quelques minutes.'
    }
    
    res.json({ error: errorMessage })
  }
})

// Route pour compter les sessions
app.get('/count', (req, res) => {
  res.json({ 
    count: sessions.size, 
    max: MAX_SESSIONS,
    sessions: Array.from(sessions.keys())
  })
})

// Route pour vérifier l'état de WhatsApp
app.get('/whatsapp-status', (req, res) => {
  if (!sock) {
    return res.json({ 
      status: 'not_initialized',
      message: 'WhatsApp non initialisé' 
    })
  }
  
  res.json({
    status: sock.user ? 'connected' : 'disconnected',
    user: sock.user ? {
      id: sock.user.id,
      name: sock.user.name
    } : null,
    connection: sock.ws ? 'open' : 'closed'
  })
})

// Route pour nettoyer les sessions
app.get('/cleanup', (req, res) => {
  const before = sessions.size
  const now = Date.now()
  
  // Supprimer les sessions de plus de 24h
  for (const [number, data] of sessions.entries()) {
    if (now - data.timestamp > 24 * 60 * 60 * 1000) {
      sessions.delete(number)
    }
  }
  
  res.json({
    cleaned: before - sessions.size,
    remaining: sessions.size
  })
})

// Gestion des erreurs 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvée' })
})

// Gestion des erreurs globales
app.use((err, req, res, next) => {
  console.error('💥 Erreur serveur:', err)
  res.status(500).json({ 
    error: 'Erreur interne du serveur',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  })
})

// Démarrer le serveur
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`\n🚀 Serveur CRAZY-MINI démarré sur le port ${PORT}`)
  console.log(`🌐 URL: http://localhost:${PORT}`)
  console.log(`📱 Health check: http://localhost:${PORT}/health`)
  console.log(`🔐 Pairing: http://localhost:${PORT}/pair?number=VOTRE_NUMERO`)
  console.log('\n🔧 Initialisation WhatsApp en cours...')
})

// Nettoyage à l'arrêt
process.on('SIGINT', () => {
  console.log('\n👋 Arrêt du serveur...')
  if (sock) {
    sock.end()
  }
  process.exit(0)
})
