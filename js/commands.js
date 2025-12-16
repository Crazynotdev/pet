export async function handleCommand(sock,msg,cmd){
  const jid = msg.key.remoteJid

  switch(cmd){
    case '.help':
      await sock.sendMessage(jid,{text:`📌 CRAZY-MINI COMMANDS

.help  → liste des commandes
.ping  → test bot
.owner → contact owner
.fancy → message stylé`})
      break

    case '.ping':
      await sock.sendMessage(jid,{text:'🏓 Pong ! CRAZY-MINI actif'})
      break

    case '.owner':
      await sock.sendMessage(jid,{text:'👤 Owner : CRAZY-MINI'})
      break

    case '.fancy':
      await sock.sendMessage(jid,{text:'✨ Fancy message stylé avec CRAZY-MINI ✨'})
      break

    default:
      await sock.sendMessage(jid,{text:'⚠️ Commande inconnue. Tapez .help pour la liste.'})
  }
}
