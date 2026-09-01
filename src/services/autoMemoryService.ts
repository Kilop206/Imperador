import {
  MessageIntent,
  TextAnalyzer,
} from './textAnalyzer';

import {
  MemoryService,
} from './memoryService';

import { config } from '../config/config';

interface MemoryCandidate {
  topic: string;
  summary: string;
  importance: number;
}

interface DynamicTopic {
  name: string;
  triggers: string[];
  score: number;
}

const IGNORED_KEYWORDS = new Set([
  'oi',
  'ola',
  'olá',
  'bom dia',
  'boa tarde',
  'boa noite',
  'online',
  'obrigado',
  'obrigada',
  'kkkk',
  'tudo bem',

  'matar',
  'mata',
  'morre',
  'morrer',
  'destruir',
  'acabar',
  'caralho',
  'porra',
  'merda',
  'idiota',
  'burro',
  'estúpido',
  'imbecil',
  'cu',
  'desgraça',
  'nojento',
  'nojo',
  'lixo',
  'inútil',
  'miserável',
  'patético',
  'ridículo',

  'festa',
  'cerveja',
  'álcool',
  'bebida',
  'drink',
  'comemorar',
  'celebrar',
  'alegrar',
  'felicidade',
  'diversão',
  'balada',
  'bar',
  'pub',
  'vinho',
  'chopp',
  'toast',
]);

const GENERIC_CONTEXT_WORDS = new Set([
  'v',
  'm',
  'a',
  'o',
  'e',
  'de',
  'do',
  'da',
  'em',
  'no',
  'na',
  'para',
  'por',
  'com',
  'sem',
]);

const IMPORTANT_TOPIC_WORDS = new Set([
  'vida',
  'morte',
  'sentido',
  'existência',
  'propósito',
  'destino',
  'fado',
  'universo',
  'cosmos',
  'eternidade',
  'tempo',
  'realidade',
  'verdade',
  'consciência',
  'alma',
  'espírito',

  'passado',
  'antigo',
  'antiga',
  'lembrar',
  'lembrança',
  'saudade',
  'memória',
  'memórias',
  'antigamente',
  'infância',
  'juventude',
  'história',
  'recordar',

  'guerra',
  'batalha',
  'sangue',
  'sofrimento',
  'dor',
  'tristeza',
  'funeral',
  'enterro',
  'cataclismo',
  'desastre',
  'tragédia',
]);

export class AutoMemoryService {
  static processMessage(
    userId: string,
    username: string,
    content: string
  ): void {
    MemoryService.upsertUser(
      userId,
      username
    );

    const candidate =
      this.extractCandidate(content);

    if (!candidate) {
      return;
    }

    MemoryService.saveConversation(
      userId,
      candidate.topic,
      candidate.summary,
      candidate.importance
    );
  }

  static extractCandidate(
    content: string
  ): MemoryCandidate | null {
    const analysis =
      TextAnalyzer.analyze(content);

    const topic =
      this.detectTopic(
        content,
        analysis.intent
      );

    if (!topic) {
      return null;
    }

    const importance =
      this.calculateImportance(
        analysis.intent,
        content,
        topic
      );

    return {
      topic,
      summary: this.createSummary(
        content,
        analysis.intent
      ),
      importance,
    };
  }

  private static detectTopic(
    content: string,
    intent: MessageIntent
  ): string | null {
    const normalized =
      TextAnalyzer.normalize(content);

    const tokens =
      normalized.split(' ');

    const topics =
      this.getDynamicTopics();

    const candidates: Array<{
      topic: DynamicTopic;
      score: number;
    }> = [];

    for (const topic of topics) {
      let score =
        topic.score;

      for (const trigger of topic.triggers) {
        const isPhrase =
          trigger.includes(' ');

        if (isPhrase) {
          if (
            normalized.includes(trigger)
          ) {
            score += 4;
          }

          continue;
        }

        if (
          tokens.includes(trigger)
        ) {
          score += 5;
        }
      }

      if (score > topic.score) {
        candidates.push({
          topic,
          score,
        });
      }
    }

    if (candidates.length > 0) {
      candidates.sort(
        (a, b) =>
          b.score - a.score
      );

      return candidates[0]
        .topic
        .name;
    }

    const intentTopic =
      this.getIntentTopic(
        intent,
        tokens
      );

    if (intentTopic) {
      return intentTopic;
    }

    return null;
  }

  private static getIntentTopic(
    intent: MessageIntent,
    tokens: string[]
  ): string | null {
    const fallbackTopics:
      Partial<Record<
        MessageIntent,
        readonly string[]
      >> = {
        philosophical: [
          'vida',
          'morte',
          'sentido',
          'existência',
          'propósito',
          'destino',
          'universo',
          'realidade',
          'verdade',
          'consciência',
          'alma',
          'espírito',
        ],

        serious: [
          'morte',
          'guerra',
          'batalha',
          'sangue',
          'sofrimento',
          'dor',
          'tristeza',
          'funeral',
          'tragédia',
        ],

        nostalgic: [
          'passado',
          'antigo',
          'lembrar',
          'saudade',
          'memória',
          'história',
        ],
      };

    const candidates =
      fallbackTopics[intent];

    if (!candidates) {
      return null;
    }

    for (
      const candidate
      of candidates
    ) {
      const normalizedCandidate =
        TextAnalyzer.normalize(
          candidate
        );

      if (
        tokens.includes(
          normalizedCandidate
        )
      ) {
        return normalizedCandidate;
      }
    }

    return null;
  }

  private static getDynamicTopics():
    DynamicTopic[] {
    const topics = new Map<
      string,
      DynamicTopic
    >();

    const addTopic = (
      name: string,
      trigger: string,
      score: number
    ): void => {
      const normalizedName =
        TextAnalyzer.normalize(name);

      const normalizedTrigger =
        TextAnalyzer.normalize(trigger);

      if (
        normalizedName.length < 2 ||
        normalizedTrigger.length < 2
      ) {
        return;
      }

      if (
        GENERIC_CONTEXT_WORDS.has(
          normalizedName
        ) ||
        GENERIC_CONTEXT_WORDS.has(
          normalizedTrigger
        )
      ) {
        return;
      }

      if (
        IGNORED_KEYWORDS.has(
          normalizedName
        ) ||
        IGNORED_KEYWORDS.has(
          normalizedTrigger
        )
      ) {
        return;
      }

      const existing =
        topics.get(normalizedName);

      if (existing) {
        if (
          !existing.triggers.includes(
            normalizedTrigger
          )
        ) {
          existing.triggers.push(
            normalizedTrigger
          );
        }

        existing.score =
          Math.max(
            existing.score,
            score
          );

        return;
      }

      topics.set(
        normalizedName,
        {
          name: normalizedName,
          triggers: [
            normalizedTrigger,
          ],
          score,
        }
      );
    };

    const keywords =
      config.tiberiusResponses
        .keywords;

    for (
      const keyword
      of Object.keys(keywords)
    ) {
      const normalized =
        TextAnalyzer.normalize(
          keyword
        );

      if (
        normalized.length < 2 ||
        IGNORED_KEYWORDS.has(
          normalized
        )
      ) {
        continue;
      }

      addTopic(
        normalized,
        normalized,
        IMPORTANT_TOPIC_WORDS.has(
          normalized
        )
          ? 18
          : 10
      );
    }

    const context =
      config.tiberiusResponses
        .context;

    for (
      const combination
      of Object.keys(context)
    ) {
      const parts =
        combination
          .split('_')
          .map(part =>
            TextAnalyzer.normalize(part)
          )
          .filter(part =>
            part.length >= 2 &&
            !GENERIC_CONTEXT_WORDS.has(
              part
            ) &&
            !IGNORED_KEYWORDS.has(
              part
            )
          );

      for (
        const part
        of parts
      ) {
        addTopic(
          part,
          part,
          IMPORTANT_TOPIC_WORDS.has(
            part
          )
            ? 18
            : 15
        );
      }
    }

    return Array.from(
      topics.values()
    );
  }

  private static calculateImportance(
    intent: MessageIntent,
    content: string,
    topic: string
  ): number {
    let importance = 1;

    if (
      intent === 'philosophical'
    ) {
      importance += 3;
    }

    if (
      intent === 'serious'
    ) {
      importance += 2;
    }

    if (
      intent === 'nostalgic'
    ) {
      importance += 1;
    }

    if (
      intent === 'question'
    ) {
      importance += 1;
    }

    if (
      content.includes('?')
    ) {
      importance += 1;
    }

    if (
      content.length > 120
    ) {
      importance += 1;
    }

    if (
      IMPORTANT_TOPIC_WORDS.has(
        TextAnalyzer.normalize(
          topic
        )
      )
    ) {
      importance += 1;
    }

    return Math.min(
      importance,
      10
    );
  }

  private static createSummary(
    content: string,
    intent: MessageIntent
  ): string {
    const cleanContent =
      content
        .replace(/\s+/g, ' ')
        .trim();

    const maxLength = 180;

    const summary =
      cleanContent.length > maxLength
        ? `${cleanContent.slice(
            0,
            maxLength
          )}...`
        : cleanContent;

    return `Mensagem classificada como ${intent}: ${summary}`;
  }

  static getMemorySummary(
    userId: string
  ): string {
    const user =
      MemoryService.getUser(userId);

    const conversations =
      MemoryService.getUserConversations(
        userId,
        5
      );

    if (
      !user &&
      conversations.length === 0
    ) {
      return '';
    }

    const lines: string[] = [];

    if (user) {
      lines.push(
        `Usuário: ${user.username}`
      );

      lines.push(
        `Mensagens registradas: ${user.messageCount}`
      );
    }

    if (
      conversations.length > 0
    ) {
      lines.push(
        'Memórias relevantes:'
      );

      for (
        const conversation
        of conversations
      ) {
        lines.push(
          `- ${conversation.topic}: ${conversation.summary}`
        );
      }
    }

    return lines.join('\n');
  }
}