import { Client, GatewayIntentBits } from 'discord.js';
import { config, validateConfig } from './config/config';
import { SchedulerService } from './services/scheduler';
import { ReplyService } from './services/reply';
import { TriggerManager } from './services/triggerManager';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

let scheduler: SchedulerService;

client.once('ready', () => {
  console.log(`Bot conectado como ${client.user?.tag}`);
  
  scheduler = new SchedulerService(client);
  scheduler.start();
});

client.on('messageCreate', async (message) => {
  // Sempre verifica triggers automáticos para rastreamento
  TriggerManager.checkTriggers(message.content);
  
  if (ReplyService.shouldReply(message)) {
    await ReplyService.reply(message);
  }
});

client.on('error', (error) => {
  console.error('Erro no cliente Discord:', error);
});

process.on('SIGINT', () => {
  console.log('Recebido SIGINT, desligando bot...');
  if (scheduler) {
    scheduler.stop();
  }
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Recebido SIGTERM, desligando bot...');
  if (scheduler) {
    scheduler.stop();
  }
  client.destroy();
  process.exit(0);
});

async function main() {
  if (!validateConfig()) {
    process.exit(1);
  }

  try {
    await client.login(config.token);
  } catch (error) {
    console.error('Erro ao fazer login no Discord:', error);
    process.exit(1);
  }
}

main();
