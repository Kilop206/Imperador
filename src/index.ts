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

import {
  AutonomousAgentOrchestrator,
} from './intelligence/autonomousAgentOrchestrator';

import {
  SafetyPermissionEngine,
} from './intelligence/safetyPermissionEngine';

import {
  ToolRegistry,
} from './intelligence/toolRegistry';

import {
  ObservationEngine,
} from './intelligence/observationEngine';

import {
  AutonomousToolCatalog,
} from './intelligence/autonomousToolCatalog';

const EMOTION_DECAY_INTERVAL_MS =
  5 * 60 * 1000;

const AI_STATUS_INTERVAL_MS =
  30 * 60 * 1000;

const AUTONOMOUS_AGENT_INTERVAL_MS =
  15 * 1000;

const AUTONOMOUS_AGENT_STATUS_INTERVAL_MS =
  5 * 60 * 1000;

const autonomousAgentEnabled =
  process.env.AUTONOMOUS_AGENT_ENABLED ===
  'true';

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

let autonomousAgentInterval:
  | NodeJS.Timeout
  | undefined;

let autonomousAgentStatusInterval:
  | NodeJS.Timeout
  | undefined;

let autonomousAgent:
  | AutonomousAgentOrchestrator
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

  /*
   * O AutonomousAgentOrchestrator possui suas próprias
   * barreiras de segurança, mas permanece completamente
   * desligado em produção até AUTONOMOUS_AGENT_ENABLED
   * ser explicitamente definido como "true".
   */
  try {
    const toolRegistry =
      new ToolRegistry();

    const safetyPermissionEngine =
      new SafetyPermissionEngine(
        toolRegistry,
      );

    const observationEngine =
      new ObservationEngine();

    const toolCatalog =
      new AutonomousToolCatalog(
        toolRegistry,
        {
          observationEngine,
        },
      );

    toolCatalog.registerDefaults();

    autonomousAgent =
      new AutonomousAgentOrchestrator(
        safetyPermissionEngine,
        observationEngine,
        {
          enabled:
            autonomousAgentEnabled,
          minimumCycleIntervalMs:
            AUTONOMOUS_AGENT_INTERVAL_MS,
          maximumCyclesPerWindow:
            30,
          cycleWindowMs:
            60 * 60 * 1000,
        },
      );

    console.log(
      `Agente autônomo ${
        autonomousAgentEnabled
          ? 'habilitado'
          : 'desabilitado'
      }.`,
    );

    if (
      autonomousAgentEnabled
    ) {
      autonomousAgentInterval =
        setInterval(
          () => {
            if (
              !autonomousAgent
            ) {
              return;
            }

            void autonomousAgent
              .tick()
              .then(result => {
                if (
                  result.decision ===
                    'executed' ||
                  result.decision ===
                    'blocked' ||
                  result.decision ===
                    'failed' ||
                  result.decision ===
                    'completed' ||
                  result.decision ===
                    'plan_created' ||
                  result.decision ===
                    'goal_created'
                ) {
                  console.log(
                    'Ciclo autônomo:',
                    result,
                  );
                }
              })
              .catch(error => {
                console.error(
                  'Erro no ciclo do agente autônomo:',
                  error,
                );
              });
          },
          AUTONOMOUS_AGENT_INTERVAL_MS,
        );

      autonomousAgentStatusInterval =
        setInterval(
          () => {
            if (
              !autonomousAgent
            ) {
              return;
            }

            console.log(
              'Estado do agente autônomo:',
              autonomousAgent.getStatus(),
            );
          },
          AUTONOMOUS_AGENT_STATUS_INTERVAL_MS,
        );
    }
  } catch (error) {
    autonomousAgent =
      undefined;

    console.error(
      'Erro ao inicializar o agente autônomo:',
      error,
    );
  }

  emotionDecayInterval =
    setInterval(
      () => {
        EmotionEngine.decay();

        MemoryService.saveEmotions(
          EmotionEngine.getState(),
        );

        console.log(
          `Estado emocional atualizado: ${EmotionEngine.describeMood()}`,
        );
      },
      EMOTION_DECAY_INTERVAL_MS,
    );

  aiStatusInterval =
    setInterval(
      () => {
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
      },
      AI_STATUS_INTERVAL_MS,
    );

  scheduler =
    new SchedulerService(
      client,
    );

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
       *
       * Não adiciona automaticamente ao treinamento.
       */
      const trimmed =
        message.content.trim();

      if (
        !trimmed.startsWith('!')
      ) {
        const relevantMemory =
          MemoryContextService.findRelevantMemory(
            message.author.id,
            trimmed,
          );

        if (
          relevantMemory &&
          relevantMemory.summary
        ) {
          SemanticMessageActiveLearningService
            .processInteraction(
              trimmed,
              relevantMemory.summary,
            );
        }
      }
    }
  },
);

client.on(
  'error',
  error => {
    console.error(
      'Erro no cliente Discord:',
      error,
    );
  },
);

const shutdown = (
  signal: string,
): void => {
  console.log(
    `Recebido ${signal}, desligando bot...`,
  );

  if (
    emotionDecayInterval
  ) {
    clearInterval(
      emotionDecayInterval,
    );

    emotionDecayInterval =
      undefined;
  }

  if (
    aiStatusInterval
  ) {
    clearInterval(
      aiStatusInterval,
    );

    aiStatusInterval =
      undefined;
  }

  if (
    autonomousAgentInterval
  ) {
    clearInterval(
      autonomousAgentInterval,
    );

    autonomousAgentInterval =
      undefined;
  }

  if (
    autonomousAgentStatusInterval
  ) {
    clearInterval(
      autonomousAgentStatusInterval,
    );

    autonomousAgentStatusInterval =
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

process.on(
  'SIGINT',
  () =>
    shutdown('SIGINT'),
);

process.on(
  'SIGTERM',
  () =>
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

    if (
      emotionDecayInterval
    ) {
      clearInterval(
        emotionDecayInterval,
      );
    }

    if (
      aiStatusInterval
    ) {
      clearInterval(
        aiStatusInterval,
      );
    }

    if (
      autonomousAgentInterval
    ) {
      clearInterval(
        autonomousAgentInterval,
      );
    }

    if (
      autonomousAgentStatusInterval
    ) {
      clearInterval(
        autonomousAgentStatusInterval,
      );
    }

    MemoryService.close();

    process.exit(1);
  }
}

void main();