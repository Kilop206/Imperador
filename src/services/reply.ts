import { Message } from 'discord.js';
import { config } from '../config/config';
import { ContextAnalyzer } from './contextAnalyzer';
import { RarityManager } from './rarityManager';
import { ModeManager } from './modeManager';
import { TriggerManager } from './triggerManager';

export class ReplyService {
  static shouldReply(message: Message): boolean {
    if (!config.allowedChannels.includes(message.channelId)) {
      return false;
    }

    if (message.author.bot) {
      return false;
    }

    const content = message.content.toLowerCase();
    const keywords = config.tiberiusResponses.keywords;

    // Verifica comandos especiais
    if (content.startsWith('!')) {
      return true;
    }

    // Verifica combinações de contexto
    if (ContextAnalyzer.isCombination(message.content)) {
      return true;
    }

    // Verifica palavras-chave
    for (const keyword of Object.keys(keywords)) {
      if (content.includes(keyword.toLowerCase())) {
        return true;
      }
    }

    // Verifica agressividade para trigger de modo
    if (ContextAnalyzer.isAggressive(message.content)) {
      return true;
    }

    // Sempre verifica triggers automáticos para rastreamento
    // Mesmo que não vá responder, precisa rastrear
    return false;
  }

  static getReply(message: Message): string | null {
    const content = message.content.toLowerCase();
    
    // 1. Processa comandos especiais primeiro
    if (content.startsWith('!')) {
      return this.handleCommand(message.content);
    }

    // 2. Verifica combinações de contexto (prioridade alta)
    const combinationResponse = ContextAnalyzer.isCombination(message.content);
    if (combinationResponse) {
      return combinationResponse;
    }

    // 3. Verifica agressividade e atualiza contador
    if (ContextAnalyzer.isAggressive(message.content)) {
      ContextAnalyzer.incrementAggressiveCount();
      if (ContextAnalyzer.shouldTriggerThreatMode()) {
        ModeManager.setMode('threat');
        ContextAnalyzer.resetAggressiveCount();
        return ModeManager.getModeResponse();
      }
    } else {
      ContextAnalyzer.resetAggressiveCount();
    }

    // 4. Verifica modo especial
    if (!ModeManager.isNormalMode()) {
      const modeResponse = ModeManager.getModeResponse();
      if (modeResponse) {
        return modeResponse;
      }
    }

    // 5. Verifica elogios
    if (ContextAnalyzer.isCompliment(message.content)) {
      const compliments = config.tiberiusResponses.compliments as string[];
      if (compliments.length > 0) {
        return compliments[Math.floor(Math.random() * compliments.length)];
      }
    }

    // 6. Verifica palavras-chave com rastreamento de frequência
    const keywords = config.tiberiusResponses.keywords;
    for (const [keyword, responses] of Object.entries(keywords)) {
      if (content.includes(keyword.toLowerCase())) {
        ContextAnalyzer.trackWordFrequency(keyword);
        
        // Verifica se há resposta baseada em frequência
        const frequencyResponse = ContextAnalyzer.getFrequencyBasedResponse(keyword);
        if (frequencyResponse) {
          return frequencyResponse;
        }
        
        // Resposta normal da palavra-chave
        if (Array.isArray(responses)) {
          const responseArray = responses as string[];
          return responseArray[Math.floor(Math.random() * responseArray.length)];
        }
        return responses as string;
      }
    }

    // 7. Chance de resposta rara
    const rareResponse = RarityManager.getRareResponse();
    if (rareResponse) {
      return rareResponse;
    }

    return null;
  }

  static handleCommand(content: string): string | null {
    const command = content.toLowerCase().trim();
    
    switch (command) {
      case '!tiberio_caotico':
      case '!tiberio_bebado':
        ModeManager.setMode('drunk');
        return "Tibério aceita oficialmente esta contribuição ao Império.";
      
      case '!tiberio_normal':
        ModeManager.resetToNormal();
        return "Ordem restaurada.";
      
      case '!tiberio_ameaca':
        ModeManager.setMode('threat');
        return "Sua insolência foi registrada.";
      
      case '!tiberio_humor':
        ModeManager.setMode('humor');
        return "Roma não é contrária ao entretenimento.";
      
      case '!tiberio_serio':
        ModeManager.setMode('serious');
        return "O Imperador assume a postura apropriada.";
      
      case '!tiberio_nostalgico':
        ModeManager.setMode('nostalgic');
        return "O passado nem sempre permanece no passado.";
      
      case '!tiberio_filosofico':
        ModeManager.setMode('philosophical');
        return "Existem questões que transcendem o Império.";
      
      case '!tiberio_romano':
        ModeManager.setMode('roman');
        return "SPQR.";
      
      case '!tiberio_status':
        return `Modo atual: ${ModeManager.getMode()}\nTriggers: ${TriggerManager.getTriggerStatus()}`;
      
      case '!tiberio_raro':
        const rareResponse = RarityManager.getRandomRareResponse();
        return rareResponse || "O Imperador não tem nada a dizer no momento.";
      
      case '!tiberio_triggers':
        TriggerManager.resetTriggers();
        return "Triggers resetados.";
      
      default:
        return null;
    }
  }

  static async reply(message: Message): Promise<void> {
    try {
      const replyText = this.getReply(message);
      if (replyText) {
        await message.reply(replyText);
        console.log(`Resposta enviada para mensagem de ${message.author.username}: ${replyText}`);
      }
    } catch (error) {
      console.error('Erro ao enviar resposta:', error);
    }
  }
}
