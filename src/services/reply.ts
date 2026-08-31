import { Message } from 'discord.js';

import { config } from '../config/config';
import { TextAnalyzer } from './textAnalyzer';
import { TriggerManager } from './triggerManager';
import { ModeManager } from './modeManager';
import { RarityManager } from './rarityManager';
import { ResponseEngine } from './responseEngine';

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

    return (
      ResponseEngine.generateCandidates(
        message.content
      ).length > 0
    );
  }

  static getReply(
    message: Message
  ): string | null {
    const command =
      message.content
        .toLowerCase()
        .trim();

    if (
      SPECIAL_COMMANDS.has(command)
    ) {
      return this.handleCommand(
        message.content
      );
    }

    return ResponseEngine.selectResponse(
      message.content
    );
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
        const response =
          RarityManager.getRandomRareResponse();

        return (
          response ??
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