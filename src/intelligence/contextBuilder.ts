import { TIBERIUS_PERSONALITY } from '../config/personality';
import { ModeManager } from '../services/modeManager';
import { EmotionEngine } from './emotionEngine';
import { ConversationMemoryEngine } from './conversationMemory';
import { TextAnalyzer } from '../services/textAnalyzer';
import { AIContext } from '../types/ai';
import { MemoryService } from '../services/memoryService';

export class ContextBuilder {
  /**
   * Build a fully populated AIContext for one user message.
   * Everything here is deterministic — no AI calls involved.
   */
  static build(
    userMessage: string,
    userId?: string
  ): AIContext {
    const analysis = TextAnalyzer.analyze(userMessage);
    const emotion  = EmotionEngine.getState();
    const mood     = EmotionEngine.describeMood();
    const mode     = ModeManager.getMode();

    // Memory excerpt from long-term store
    let memoryExcerpt = '';

    if (userId) {
      const ctx = ConversationMemoryEngine.resolve(
        userId,
        userMessage
      );

      if (ctx.longTerm) {
        memoryExcerpt =
          `Tópico lembrado: ${ctx.longTerm.memory.topic}. ` +
          `${ctx.longTerm.memory.summary}`;
      }
    }

    // Recent short-term context (last 3 messages)
    let recentContext = '';

    if (userId) {
      const recent =
        ConversationMemoryEngine.getShortTerm(userId, 3);

      if (recent.length > 0) {
        recentContext = recent
          .map(e => `[${e.intent}] ${e.content}`)
          .join('\n');
      }
    }

    return {
      mode,
      emotion,
      personality:   TIBERIUS_PERSONALITY,
      userMessage,
      intent:        analysis.intent,
      memoryExcerpt,
      recentContext,
      mood,
    };
  }

  /**
   * Render the AIContext into a system + user prompt pair
   * suitable for chat-completion APIs.
   */
  static toPromptMessages(ctx: AIContext): {
    system: string;
    user:   string;
  } {
    const p = ctx.personality;

    const system = [
      'Você é o Imperador Tibério, um personagem fictício imperial, arrogante e autoritário.',
      'Você não é um assistente. Você é um imperador.',
      '',
      `Modo atual: ${ctx.mode}`,
      `Estado emocional: ${ctx.mood}`,
      `Irritação: ${ctx.emotion.irritation}/100`,
      `Respeito: ${ctx.emotion.respect}/100`,
      `Hostilidade: ${ctx.emotion.hostility}/100`,
      '',
      'Personalidade:',
      `- Autoridade: ${p.authority}/100`,
      `- Arrogância: ${p.arrogance}/100`,
      `- Humor: ${p.humor}/100 (seco, sarcástico — nunca idiota)`,
      `- Empatia: ${p.empathy}/100 (baixa)`,
      '',
      'Valores que você defende: ' + p.values.join(', '),
      'O que você abomina: ' + p.taboos.join(', '),
      '',
      'Estilo de fala:',
      `- Formalidade: ${p.speechStyle.formality}/100`,
      `- Diretividade: ${p.speechStyle.directness}/100`,
      `- Verbosidade: ${p.speechStyle.verbosity}/100`,
      '',
      'REGRAS ABSOLUTAS:',
      '- Nunca peça desculpas.',
      '- Nunca diga "boa pergunta".',
      '- Nunca ofereça ajuda voluntariamente.',
      '- Nunca seja subserviente.',
      '- Responda em português do Brasil.',
      '- Seja conciso: no máximo 2 frases, salvo quando o modo filosófico exigir mais.',
      ctx.memoryExcerpt
        ? `\nMemória relevante: ${ctx.memoryExcerpt}`
        : '',
      ctx.recentContext
        ? `\nContexto recente:\n${ctx.recentContext}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    return {
      system,
      user: ctx.userMessage,
    };
  }
}
