import {
  Client,
  GatewayIntentBits,
} from 'discord.js';

import {
  config,
  validateConfig,
} from './config/config';

import {
  MemoryService,
} from './services/memoryService';

import {
  SchedulerService,
} from './services/scheduler';

import {
  ReplyService,
} from './services/reply';

import {
  TriggerManager,
} from './services/triggerManager';

import {
  ModeManager,
} from './services/modeManager';

import {
  restoreEmotions,
} from './state/emotionState';

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

  MemoryService.initialize();

  // Restore persisted emotional state
  restoreEmotions(
    MemoryService.loadEmotions()
  );

  scheduler =
    new SchedulerService(client);

  scheduler.start();
});

client.on(
  'messageCreate',
  async message => {
    if (message.author.bot) {
      return;
    }

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

  ModeManager.clearModeTimeout();

  MemoryService.close();

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
    MemoryService.initialize();

    await client.login(
      config.token
    );
  } catch (error) {
    console.error(
      'Erro ao iniciar o bot:',
      error
    );

    MemoryService.close();

    process.exit(1);
  }
}

void main();