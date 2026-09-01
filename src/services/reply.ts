import { Message } from 'discord.js';

import {
  config,
} from '../config/config';

import {
  TriggerManager,
} from './triggerManager';

import {
  ModeManager,
} from './modeManager';

import {
  RarityManager,
} from './rarityManager';

import {
  ResponseEngine,
} from './responseEngine';

import {
  AutoMemoryService,
} from './autoMemoryService';

import {
  MessageIntent,
} from './textAnalyzer';

import {
  IntentCandidateService,
} from '../intelligence/intentCandidateService';

import {
  IntentFeedbackService,
} from '../intelligence/intentFeedbackService';

import {
  IntentLearningService,
} from '../intelligence/intentLearningService';

const SPECIAL_COMMANDS =
  new Set([
    '!tiberio_caotico',
    '!tiberio_bebado',
    '!tiberio_normal',
    '!tiberio_ameaca',
    '!tiberio_humor',
    '!tiberio_serio',
    '!tiberio_nostalgico',
    '!tiberio_filosofico',
    '!tiberio_romano',
    '!tiberio_status',
    '!tiberio_raro',
    '!tiberio_triggers',
    '!tiberio_memoria',
    '!tiberio_candidatos',
    '!tiberio_rotular',
    '!tiberio_rejeitar',
  ]);

const VALID_INTENTS:
  readonly MessageIntent[] = [
  'aggressive',
  'compliment',
  'question',
  'greeting',
  'farewell',
  'humor',
  'serious',
  'nostalgic',
  'philosophical',
  'roman',
  'neutral',
];

export class ReplyService {
  private static getLearningCandidates():
  string {
  const candidates =
    IntentCandidateService.getPending(
      10
    );

  if (
    candidates.length === 0
  ) {
    return (
      'Não existem candidatos aguardando rotulagem.'
    );
  }

  const lines = [
    '=== Candidatos de aprendizado ===',
  ];

  for (
    const candidate of candidates
  ) {
    lines.push(
      `#${candidate.id} | ` +
      `"${candidate.text}" | ` +
      `previsto: ${candidate.predictedIntent} | ` +
      `confiança: ${(candidate.confidence * 100).toFixed(2)}%`
    );
  }

  lines.push('');
  lines.push(
    'Para rotular: !tiberio_rotular ID intenção'
  );
  lines.push(
    'Para rejeitar: !tiberio_rejeitar ID'
  );

  return lines.join('\n');
}

  private static handleCandidateLabel(
    content: string
  ): string {
    const payload =
      content
        .slice(
          '!tiberio_rotular'.length
        )
        .trim();

    const parts =
      payload.split(/\s+/);

    if (
      parts.length < 2
    ) {
      return (
        'Formato: !tiberio_rotular ID intenção'
      );
    }

    const id =
      Number.parseInt(
        parts[0],
        10
      );

    const intent =
      parts[1].toLowerCase();

    const validIntents:
      readonly MessageIntent[] = [
      'aggressive',
      'compliment',
      'question',
      'greeting',
      'farewell',
      'humor',
      'serious',
      'nostalgic',
      'philosophical',
      'roman',
      'neutral',
    ];

    if (
      !Number.isInteger(id)
    ) {
      return 'ID inválido.';
    }

    if (
      !validIntents.includes(
        intent as MessageIntent
      )
    ) {
      return (
        `Intenção inválida. Use: ${validIntents.join(', ')}`
      );
    }

    const candidate =
      IntentCandidateService.getById(
        id
      );

    if (!candidate) {
      return (
        `Candidato #${id} não encontrado.`
      );
    }

    if (
      candidate.reviewed
    ) {
      return (
        `Candidato #${id} já foi revisado.`
      );
    }

    IntentFeedbackService.approve(
      id,
      intent as MessageIntent
    );

    return (
      `Candidato #${id} rotulado como "${intent}". ` +
      `Modelo retreinado com ${IntentLearningServiceSafeCount()} exemplos.`
    );
  }

  private static handleCandidateRejection(
    content: string
  ): string {
    const payload =
      content
        .slice(
          '!tiberio_rejeitar'.length
        )
        .trim();

    const id =
      Number.parseInt(
        payload,
        10
      );

    if (
      !Number.isInteger(id)
    ) {
      return (
        'Formato: !tiberio_rejeitar ID'
      );
    }

    const rejected =
      IntentFeedbackService.reject(
        id
      );

    return rejected
      ? `Candidato #${id} rejeitado.`
      : `Candidato #${id} não encontrado.`;
  }

  static shouldReply(
    message: Message
  ): boolean {
    if (
      !config.allowedChannels.includes(
        message.channelId
      )
    ) {
      return false;
    }

    if (
      message.author.bot
    ) {
      return false;
    }

    const command =
      message.content
        .toLowerCase()
        .trim();

    if (
      SPECIAL_COMMANDS.has(
        command
      ) ||
      command.startsWith(
        '!tiberio_aprender '
      ) ||
      command ===
        '!tiberio_aprender' ||
      command ===
        '!tiberio_aprendizado'
    ) {
      return true;
    }

    return (
      ResponseEngine
        .generateCandidates(
          message.content,
          message.author.id
        )
        .length > 0
    );
  }

  static getReply(
    message: Message
  ): string | null {
    const content =
      message.content;

    const command =
      content
        .toLowerCase()
        .trim();

    const userId =
      message.author.id;

    const username =
      message.author.username;

    if (
      command ===
      '!tiberio_aprendizado'
    ) {
      return this.getLearningStatus();
    }

    if (
      command ===
      '!tiberio_aprender'
    ) {
      return (
        'Formato: !tiberio_aprender intenção | texto'
      );
    }

    if (
      command.startsWith(
        '!tiberio_aprender '
      )
    ) {
      return this.handleLearningCommand(
        content
      );
    }
    
    if (
      command ===
      '!tiberio_candidatos'
    ) {
      return this.getLearningCandidates();
    }

    if (
      command.startsWith(
        '!tiberio_rotular '
      )
    ) {
      return this.handleCandidateLabel(
        content
      );
    }

    if (
      command.startsWith(
        '!tiberio_rejeitar '
      )
    ) {
      return this.handleCandidateRejection(
        content
      );
    }

    if (
      SPECIAL_COMMANDS.has(
        command
      )
    ) {
      return this.handleCommand(
        content,
        userId,
        username
      );
    }

    return ResponseEngine.selectResponse(
      content,
      userId
    );
  }

  private static handleLearningCommand(
    content: string
  ): string {
    const payload =
      content.slice(
        '!tiberio_aprender'.length
      ).trim();

    const separatorIndex =
      payload.indexOf('|');

    if (
      separatorIndex < 0
    ) {
      return (
        'Formato inválido. Use: !tiberio_aprender intenção | texto'
      );
    }

    const intentText =
      payload
        .slice(
          0,
          separatorIndex
        )
        .trim()
        .toLowerCase();

    const trainingText =
      payload
        .slice(
          separatorIndex + 1
        )
        .trim();

    if (
      !VALID_INTENTS.includes(
        intentText as MessageIntent
      )
    ) {
      return (
        `Intenção inválida. Use uma destas: ${VALID_INTENTS.join(', ')}`
      );
    }

    if (!trainingText) {
      return (
        'O texto de treinamento não pode estar vazio.'
      );
    }

    try {
      const learned =
        IntentLearningService.learn(
          trainingText,
          intentText as MessageIntent
        );

      if (!learned) {
        return (
          'Esse exemplo já pertence ao conjunto de aprendizado.'
        );
      }

      return (
        `Exemplo aprendido como "${intentText}". ` +
        `Modelo retreinado com ${IntentLearningService.getModelTrainingCount()} exemplos.`
      );
    } catch (error) {
      return (
        `Falha ao aprender exemplo: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`
      );
    }
  }

  private static getLearningStatus():
    string {
    try {
      IntentLearningService.ensureInitialized();

      return [
        '=== Aprendizado de Tibério ===',
        `Exemplos base: ${IntentLearningService.getTotalExampleCount() - IntentLearningService.getLearnedExampleCount()}`,
        `Exemplos aprendidos: ${IntentLearningService.getLearnedExampleCount()}`,
        `Total no modelo: ${IntentLearningService.getModelTrainingCount()}`,
      ].join('\n');
    } catch (error) {
      return (
        `Falha ao consultar aprendizado: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`
      );
    }
  }

  static handleCommand(
    content: string,
    userId?: string,
    _username?: string
  ): string | null {
    const command =
      content
        .toLowerCase()
        .trim();

    switch (command) {
      case '!tiberio_caotico':
      case '!tiberio_bebado':
        ModeManager.setMode(
          'drunk'
        );

        return 'Tibério aceita oficialmente esta contribuição ao Império.';

      case '!tiberio_normal':
        ModeManager.resetToNormal();

        return 'Ordem restaurada.';

      case '!tiberio_ameaca':
        ModeManager.setMode(
          'threat'
        );

        return 'Sua insolência foi registrada.';

      case '!tiberio_humor':
        ModeManager.setMode(
          'humor'
        );

        return 'Roma não é contrária ao entretenimento.';

      case '!tiberio_serio':
        ModeManager.setMode(
          'serious'
        );

        return 'O Imperador assume a postura apropriada.';

      case '!tiberio_nostalgico':
        ModeManager.setMode(
          'nostalgic'
        );

        return 'O passado nem sempre permanece no passado.';

      case '!tiberio_filosofico':
        ModeManager.setMode(
          'philosophical'
        );

        return 'Existem questões que transcendem o Império.';

      case '!tiberio_romano':
        ModeManager.setMode(
          'roman'
        );

        return 'SPQR.';

      case '!tiberio_status':
        return (
          `Modo atual: ${ModeManager.getMode()}\n` +
          `Triggers: ${TriggerManager.getTriggerStatus()}`
        );

      case '!tiberio_raro':
        return (
          RarityManager.getRandomRareResponse() ??
          'O Imperador não tem nada a dizer no momento.'
        );

      case '!tiberio_triggers':
        TriggerManager.resetTriggers();

        return 'Triggers resetados.';

      case '!tiberio_memoria': {
        if (!userId) {
          return 'Tibério não conseguiu identificar você.';
        }

        const memory =
          AutoMemoryService.getMemorySummary(
            userId
          );

        return (
          memory ||
          'Os arquivos do Imperador estão vazios.'
        );
      }

      default:
        return null;
    }
  }

  static async reply(
    message: Message
  ): Promise<void> {
    try {
      const replyText =
        this.getReply(
          message
        );

      if (!replyText) {
        return;
      }

      await message.reply(
        replyText
      );

      console.log(
        `Resposta enviada para mensagem de ${message.author.username}: ${replyText}`
      );
    } catch (error) {
      console.error(
        'Erro ao enviar resposta:',
        error
      );
    }
  }
}

function IntentLearningServiceSafeCount():
  number {
  return IntentLearningService
    .getModelTrainingCount();
}