import {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
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

import {
  AutonomousRuntimeControlService,
} from './intelligence/autonomousRuntimeControlService';

import {
  AutonomousRuntimeAuditService,
} from './intelligence/autonomousRuntimeAuditService';

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

let autonomousRuntimeControl:
  | AutonomousRuntimeControlService
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
   * Inicialização do runtime autônomo.
   *
   * O agente permanece desligado por padrão,
   * a menos que AUTONOMOUS_AGENT_ENABLED=true.
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

    const auditService =
      new AutonomousRuntimeAuditService();

    autonomousRuntimeControl =
      new AutonomousRuntimeControlService(
        autonomousAgent,
        safetyPermissionEngine,
        auditService,
      );

    autonomousRuntimeControl.markRuntimeStarted();

    console.log(
      `Agente autônomo ${
        autonomousAgentEnabled
          ? 'habilitado'
          : 'desabilitado'
      }.`,
    );

    /*
     * O loop sempre existe.
     *
     * Isso é necessário para que:
     *
     * !autonomia on
     *
     * consiga ativar o agente dinamicamente,
     * sem reiniciar o processo.
     */
    autonomousAgentInterval =
      setInterval(
        () => {
          if (
            !autonomousAgent ||
            !autonomousRuntimeControl
          ) {
            return;
          }

          if (
            !autonomousRuntimeControl.isEnabled()
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
  } catch (error) {
    autonomousAgent =
      undefined;

    autonomousRuntimeControl =
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

    /*
     * Controle administrativo do agente autônomo.
     */
    if (
      message.content
        .trim()
        .toLowerCase()
        .startsWith('!autonomia')
    ) {
      if (
        !message.member ||
        !message.member.permissions.has(
          PermissionFlagsBits.Administrator,
        )
      ) {
        await message.reply(
          'Apenas administradores podem controlar o agente autônomo.',
        );

        return;
      }

      if (
        !autonomousRuntimeControl
      ) {
        await message.reply(
          'O controlador do agente autônomo não está disponível.',
        );

        return;
      }

      const command =
        message.content
          .trim()
          .split(/\s+/)[1]
          ?.toLowerCase() ??
        'status';

      const actor =
        message.author.id;

      try {
        switch (command) {
          case 'status': {
            const status =
              autonomousRuntimeControl.getStatus();

            await message.reply(
              [
                '**Estado do agente autônomo**',
                `Agente: ${
                  status.enabled
                    ? 'ATIVO'
                    : 'INATIVO'
                }`,
                `Kill switch: ${
                  status.killSwitchEnabled
                    ? 'ATIVO'
                    : 'INATIVO'
                }`,
                `Orquestrador: ${
                  status.orchestrator.enabled
                    ? 'habilitado'
                    : 'desabilitado'
                }`,
                `Ciclos na janela: ${status.orchestrator.cycleCount}`,
                `Objetivos ativos: ${status.orchestrator.activeGoalCount}`,
                `Planos ativos: ${status.orchestrator.activePlanCount}`,
                `Execuções de ferramentas na janela: ${status.safety.executionsInWindow}`,
                `Orçamento utilizado: ${status.safety.budgetUsedInWindow}`,
                `Auditoria de segurança: ${status.safety.auditEntries} registros`,
                `Auditoria de runtime: ${status.auditEntries} registros`,
                `Última decisão: ${status.orchestrator.lastDecision}`,
              ].join('\n'),
            );

            return;
          }

          case 'on': {
            autonomousRuntimeControl.enable(
              actor,
            );

            await message.reply(
              'Agente autônomo habilitado.',
            );

            return;
          }

          case 'off': {
            autonomousRuntimeControl.disable(
              actor,
            );

            await message.reply(
              'Agente autônomo desabilitado.',
            );

            return;
          }

          case 'kill': {
            autonomousRuntimeControl.enableKillSwitch(
              actor,
            );

            await message.reply(
              'Kill switch ativado. O agente autônomo foi imediatamente desabilitado.',
            );

            return;
          }

          case 'unkill': {
            autonomousRuntimeControl.disableKillSwitch(
              actor,
            );

            await message.reply(
              'Kill switch desativado. O agente permanece desligado até ser habilitado explicitamente.',
            );

            return;
          }

          default: {
            await message.reply(
              [
                '**Comandos de autonomia**',
                '`!autonomia status`',
                '`!autonomia on`',
                '`!autonomia off`',
                '`!autonomia kill`',
                '`!autonomia unkill`',
              ].join('\n'),
            );

            return;
          }
        }
      } catch (error) {
        console.error(
          'Erro ao executar comando de autonomia:',
          error,
        );

        await message.reply(
          `Não foi possível executar o comando de autonomia: ${
            error instanceof Error
              ? error.message
              : String(error)
          }`,
        );

        return;
      }
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
    autonomousRuntimeControl
  ) {
    try {
      autonomousRuntimeControl.markRuntimeShutdown();

      autonomousRuntimeControl.disable(
        'system',
      );
    } catch (error) {
      console.error(
        'Erro ao registrar encerramento do runtime autônomo:',
        error,
      );
    }
  }

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