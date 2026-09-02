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

import {
  AIRuntimeService,
} from './intelligence/aiRuntimeService';

import {
  ModelManager,
} from './intelligence/modelManager';

import {
  ResponseEngine,
} from './services/responseEngine';

import {
  MemoryContextService,
} from './services/memoryContext';

import {
  SemanticMessageActiveLearningService,
} from './services/semanticMessageActiveLearningService';

const EMOTION_DECAY_INTERVAL_MS =
  5 * 60 * 1000;

const AI_STATUS_INTERVAL_MS =
  30 * 60 * 1000;

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

let aiStatusInterval:
  | NodeJS.Timeout
  | undefined;

client.once('ready', () => {
  console.log(
    `Bot conectado como ${client.user?.tag}`,
  );

  MemoryService.initialize();

  restoreEmotions(
    MemoryService.loadEmotions(),
  );

  try {
    AIRuntimeService.initialize();

    ResponseEngine.setSemanticService(
      ModelManager
        .getSemanticContextService(),
    );

    console.log(
      'Módulo de IA inicializado:',
      AIRuntimeService.getStatus(),
    );
  } catch (error) {
    console.error(
      'Erro ao inicializar o módulo de IA:',
      error,
    );
  }

  emotionDecayInterval =
    setInterval(() => {
      EmotionEngine.decay();

      MemoryService.saveEmotions(
        EmotionEngine.getState(),
      );

      console.log(
        `Estado emocional atualizado: ${EmotionEngine.describeMood()}`,
      );
    }, EMOTION_DECAY_INTERVAL_MS);

  aiStatusInterval =
    setInterval(() => {
      try {
        console.log(
          'Estado do módulo de IA:',
          AIRuntimeService.getStatus(),
        );
      } catch (error) {
        console.error(
          'Erro ao consultar estado da IA:',
          error,
        );
      }
    }, AI_STATUS_INTERVAL_MS);

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
      message.content,
    );

    /*
     * Todas as mensagens humanas passam
     * pelos sistemas de memória e emoção,
     * independentemente de Tibério responder.
     */
    const analysis =
      TextAnalyzer.analyze(
        message.content,
      );

    AutoMemoryService.processMessage(
      message.author.id,
      message.author.username,
      message.content,
    );

    EmotionEngine.processMessage(
      analysis,
    );

    MemoryService.saveEmotions(
      EmotionEngine.getState(),
    );

    if (
      ReplyService.shouldReply(message)
    ) {
      await ReplyService.reply(
        message,
      );
    } else {
      /*
       * Para mensagens que não geram resposta direta,
       * verifica se há memória contextual relevante para
       * alimentar o Semantic Active Learning com pares contextuais.
       * Não adiciona automaticamente ao treinamento.
       */
      const trimmed = message.content.trim();
      if (!trimmed.startsWith('!')) {
        const relevantMemory =
          MemoryContextService.findRelevantMemory(
            message.author.id,
            trimmed,
          );

        if (relevantMemory && relevantMemory.summary) {
          SemanticMessageActiveLearningService.processInteraction(
            trimmed,
            relevantMemory.summary,
          );
        }
      }
    }
  },
);

client.on('error', error => {
  console.error(
    'Erro no cliente Discord:',
    error,
  );
});

const shutdown = (
  signal: string,
): void => {
  console.log(
    `Recebido ${signal}, desligando bot...`,
  );

  if (emotionDecayInterval) {
    clearInterval(
      emotionDecayInterval,
    );

    emotionDecayInterval =
      undefined;
  }

  if (aiStatusInterval) {
    clearInterval(
      aiStatusInterval,
    );

    aiStatusInterval =
      undefined;
  }

  scheduler?.stop();

  ModeManager.clearModeTimeout();

  MemoryService.saveEmotions(
    EmotionEngine.getState(),
  );

  try {
    ModelManager.save();
  } catch (error) {
    console.error(
      'Erro ao persistir modelos da IA durante encerramento:',
      error,
    );
  }

  MemoryService.close();

  client.destroy();

  process.exit(0);
};

process.on('SIGINT', () =>
  shutdown('SIGINT'),
);

process.on('SIGTERM', () =>
  shutdown('SIGTERM'),
);

async function main(): Promise<void> {
  if (!validateConfig()) {
    process.exit(1);
  }

  try {
    MemoryService.initialize();

    AIRuntimeService.initialize();

    await client.login(
      config.token,
    );
  } catch (error) {
    console.error(
      'Erro ao iniciar o bot:',
      error,
    );

    if (emotionDecayInterval) {
      clearInterval(
        emotionDecayInterval,
      );
    }

    if (aiStatusInterval) {
      clearInterval(
        aiStatusInterval,
      );
    }

    MemoryService.close();

    process.exit(1);
  }
}

void main();