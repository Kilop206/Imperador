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
  AutoMemoryService,
} from './services/autoMemoryService';

import {
  TextAnalyzer,
} from './services/textAnalyzer';

import {
  EmotionEngine,
} from './intelligence/emotionEngine';

import {
  restoreEmotions,
} from './state/emotionState';

const EMOTION_DECAY_INTERVAL_MS =
  5 * 60 * 1000;

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

let emotionDecayInterval:
  | NodeJS.Timeout
  | undefined;

client.once('ready', () => {
  console.log(
    `Bot conectado como ${client.user?.tag}`
  );

  MemoryService.initialize();

  restoreEmotions(
    MemoryService.loadEmotions()
  );

  emotionDecayInterval =
    setInterval(() => {
      EmotionEngine.decay();

      MemoryService.saveEmotions(
        EmotionEngine.getState()
      );

      console.log(
        `Estado emocional atualizado: ${EmotionEngine.describeMood()}`
      );
    }, EMOTION_DECAY_INTERVAL_MS);

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

    /*
     * Todas as mensagens humanas passam
     * pelos sistemas de memória e emoção,
     * independentemente de Tibério responder.
     */
    const analysis =
      TextAnalyzer.analyze(
        message.content
      );

    AutoMemoryService.processMessage(
      message.author.id,
      message.author.username,
      message.content
    );

    EmotionEngine.processMessage(
      analysis
    );

    MemoryService.saveEmotions(
      EmotionEngine.getState()
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

  if (emotionDecayInterval) {
    clearInterval(
      emotionDecayInterval
    );

    emotionDecayInterval =
      undefined;
  }

  scheduler?.stop();

  ModeManager.clearModeTimeout();

  /*
   * Garante que o estado emocional
   * atual seja salvo antes do encerramento.
   */
  MemoryService.saveEmotions(
    EmotionEngine.getState()
  );

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

    if (emotionDecayInterval) {
      clearInterval(
        emotionDecayInterval
      );
    }

    MemoryService.close();

    process.exit(1);
  }
}

void main();