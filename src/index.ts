import {
  Client,
  GatewayIntentBits,
} from 'discord.js';

import {
  config,
  validateConfig,
} from './config/config';

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

let scheduler:
  | SchedulerService
  | undefined;

client.once('ready', () => {
  console.log(
    `Bot conectado como ${client.user?.tag}`
  );

  scheduler =
    new SchedulerService(client);

  scheduler.start();
});

client.on(
  'messageCreate',
  async message => {
    TriggerManager.checkTriggers(
      message.content
    );

    if (
      ReplyService.shouldReply(message)
    ) {
      await ReplyService.reply(
        message
      );
    }
  }
);

client.on('error', error => {
  console.error(
    'Erro no cliente Discord:',
    error
  );
});

const shutdown = (
  signal: string
): void => {
  console.log(
    `Recebido ${signal}, desligando bot...`
  );

  scheduler?.stop();

  client.destroy();

  process.exit(0);
};

process.on('SIGINT', () =>
  shutdown('SIGINT')
);

process.on('SIGTERM', () =>
  shutdown('SIGTERM')
);

async function main(): Promise<void> {
  if (!validateConfig()) {
    process.exit(1);
  }

  try {
    await client.login(
      config.token
    );
  } catch (error) {
    console.error(
      'Erro ao fazer login no Discord:',
      error
    );

    process.exit(1);
  }
}

void main();