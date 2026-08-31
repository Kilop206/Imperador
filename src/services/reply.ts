import { Message } from 'discord.js';

import { config } from '../config/config';
import { ContextAnalyzer } from './contextAnalyzer';
import { RarityManager } from './rarityManager';
import { ModeManager } from './modeManager';
import { TriggerManager } from './triggerManager';
import { ResponseValidator } from './responseValidator';
import {
  MessageIntent,
  TextAnalyzer,
} from './textAnalyzer';

const SPECIAL_COMMANDS = new Set([
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
]);

export class ReplyService {
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

    if (message.author.bot) {
      return false;
    }

    const content =
      message.content.toLowerCase().trim();

    if (
      SPECIAL_COMMANDS.has(content)
    ) {
      return true;
    }

    if (
      ContextAnalyzer.isCombination(
        message.content
      )
    ) {
      return true;
    }

    const keywords =
      config.tiberiusResponses.keywords;

    for (
      const keyword of Object.keys(keywords)
    ) {
      if (
        TextAnalyzer.normalize(
          content
        ).includes(
          TextAnalyzer.normalize(keyword)
        )
      ) {
        return true;
      }
    }

    const analysis =
      TextAnalyzer.analyze(
        message.content
      );

    return (
      analysis.isAggressive ||
      analysis.isCompliment ||
      analysis.isQuestion
    );
  }

  static getReply(
    message: Message
  ): string | null {
    const content =
      message.content.toLowerCase().trim();

    if (
      SPECIAL_COMMANDS.has(content)
    ) {
      return this.handleCommand(
        message.content
      );
    }

    const analysis =
      TextAnalyzer.analyze(
        message.content
      );

    const combinationResponse =
      ContextAnalyzer.isCombination(
        message.content
      );

    if (combinationResponse) {
      return combinationResponse;
    }

    if (analysis.isAggressive) {
      ContextAnalyzer.incrementAggressiveCount();

      if (
        ContextAnalyzer.shouldTriggerThreatMode()
      ) {
        ModeManager.setMode('threat');

        ContextAnalyzer.resetAggressiveCount();

        return ModeManager.getModeResponse();
      }

      const aggressiveResponse =
        this.getKeywordResponse(
          message.content,
          analysis.intent
        );

      if (aggressiveResponse) {
        return aggressiveResponse;
      }

      if (
        ModeManager.isThreatMode()
      ) {
        return ModeManager.getModeResponse();
      }

      return null;
    }

    ContextAnalyzer.resetAggressiveCount();

    if (analysis.isCompliment) {
      const compliments =
        config.tiberiusResponses.compliments;

      const responses =
        ResponseValidator
          .filterAppropriateResponses(
            compliments,
            false,
            true
          );

      if (responses.length > 0) {
        return this.randomItem(responses);
      }
    }

    const intentResponse =
      this.getIntentResponse(
        message.content,
        analysis.intent
      );

    if (intentResponse) {
      return intentResponse;
    }

    if (
      !ModeManager.isNormalMode() &&
      Math.random() < 0.3
    ) {
      const modeResponse =
        ModeManager.getModeResponse();

      if (modeResponse) {
        return modeResponse;
      }
    }

    const keywordResponse =
      this.getKeywordResponse(
        message.content,
        analysis.intent
      );

    if (keywordResponse) {
      return keywordResponse;
    }

    const rareResponse =
      RarityManager.getRareResponse();

    return rareResponse;
  }

  private static getIntentResponse(
    content: string,
    intent: MessageIntent
  ): string | null {
    const data =
      config.tiberiusResponses;

    const intentKeywords: Record<
      Exclude<MessageIntent, 'neutral'>,
      string[]
    > = {
      aggressive: [],
      compliment: [],
      question: [],
      greeting: ['oi', 'olá', 'ola'],
      farewell: ['tchau', 'adeus'],
      humor: ['kkkk', 'hahaha', 'haha'],
      serious: ['morte', 'guerra'],
      nostalgic: ['passado', 'saudade'],
      philosophical: ['vida', 'existência', 'sentido'],
      roman: ['roma', 'romano', 'império'],
    };

    if (
      intent === 'greeting' &&
      data.keywords['oi']
    ) {
      return this.resolveResponse(
        data.keywords['oi'],
        false,
        false
      );
    }

    if (
      intent === 'farewell' &&
      data.keywords['boa noite']
    ) {
      return this.resolveResponse(
        data.keywords['boa noite'],
        false,
        false
      );
    }

    if (
      intent === 'humor'
    ) {
      for (
        const keyword of intentKeywords.humor
      ) {
        if (
          TextAnalyzer.normalize(
            content
          ).includes(keyword)
        ) {
          const response =
            data.keywords[keyword];

          if (response) {
            return this.resolveResponse(
              response,
              false,
              false
            );
          }
        }
      }
    }

    return null;
  }

  private static getKeywordResponse(
    content: string,
    intent: MessageIntent
  ): string | null {
    const normalized =
      TextAnalyzer.normalize(
        content
      );

    const keywords =
      config.tiberiusResponses.keywords;

    for (
      const [keyword, responses]
      of Object.entries(keywords)
    ) {
      const normalizedKeyword =
        TextAnalyzer.normalize(keyword);

      if (
        !normalized.includes(
          normalizedKeyword
        )
      ) {
        continue;
      }

      ContextAnalyzer.trackWordFrequency(
        keyword
      );

      const frequencyResponse =
        ContextAnalyzer
          .getFrequencyBasedResponse(
            keyword
          );

      if (
        frequencyResponse &&
        ResponseValidator.isResponseAppropriate(
          frequencyResponse,
          intent === 'aggressive',
          intent === 'compliment'
        )
      ) {
        return frequencyResponse;
      }

      const response =
        this.resolveResponse(
          responses,
          intent === 'aggressive',
          intent === 'compliment'
        );

      if (response) {
        return response;
      }
    }

    return null;
  }

  private static resolveResponse(
    response: string | string[],
    isAggressive: boolean,
    isCompliment: boolean
  ): string | null {
    if (Array.isArray(response)) {
      const appropriate =
        ResponseValidator
          .filterAppropriateResponses(
            response,
            isAggressive,
            isCompliment
          );

      return appropriate.length > 0
        ? this.randomItem(appropriate)
        : null;
    }

    return ResponseValidator.isResponseAppropriate(
      response,
      isAggressive,
      isCompliment
    )
      ? response
      : null;
  }

  private static randomItem<T>(
    items: T[]
  ): T {
    return items[
      Math.floor(
        Math.random() *
          items.length
      )
    ];
  }

  static handleCommand(
    content: string
  ): string | null {
    const command =
      content.toLowerCase().trim();

    switch (command) {
      case '!tiberio_caotico':
      case '!tiberio_bebado':
        ModeManager.setMode('drunk');
        return 'Tibério aceita oficialmente esta contribuição ao Império.';

      case '!tiberio_normal':
        ModeManager.resetToNormal();
        return 'Ordem restaurada.';

      case '!tiberio_ameaca':
        ModeManager.setMode('threat');
        return 'Sua insolência foi registrada.';

      case '!tiberio_humor':
        ModeManager.setMode('humor');
        return 'Roma não é contrária ao entretenimento.';

      case '!tiberio_serio':
        ModeManager.setMode('serious');
        return 'O Imperador assume a postura apropriada.';

      case '!tiberio_nostalgico':
        ModeManager.setMode('nostalgic');
        return 'O passado nem sempre permanece no passado.';

      case '!tiberio_filosofico':
        ModeManager.setMode('philosophical');
        return 'Existem questões que transcendem o Império.';

      case '!tiberio_romano':
        ModeManager.setMode('roman');
        return 'SPQR.';

      case '!tiberio_status':
        return `Modo atual: ${ModeManager.getMode()}\nTriggers: ${TriggerManager.getTriggerStatus()}`;

      case '!tiberio_raro': {
        const rareResponse =
          RarityManager.getRandomRareResponse();

        return (
          rareResponse ||
          'O Imperador não tem nada a dizer no momento.'
        );
      }

      case '!tiberio_triggers':
        TriggerManager.resetTriggers();
        return 'Triggers resetados.';

      default:
        return null;
    }
  }

  static async reply(
    message: Message
  ): Promise<void> {
    try {
      const replyText =
        this.getReply(message);

      if (replyText) {
        await message.reply(
          replyText
        );

        console.log(
          `Resposta enviada para mensagem de ${message.author.username}: ${replyText}`
        );
      }
    } catch (error) {
      console.error(
        'Erro ao enviar resposta:',
        error
      );
    }
  }
}