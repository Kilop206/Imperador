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

const IGNORED_KEYWORDS = new Set([
  'oi',
  'ola',
  'olá',
  'bom dia',
  'boa noite',
  'online',
  'obrigado',
  'obrigada',
  'kkkk',
  'tudo bem',
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
      this.detectTopic(content);

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
    content: string
  ): string | null {
    const normalized =
      TextAnalyzer.normalize(content);

    const topics =
      this.getDynamicTopics();

    let bestTopic: string | null = null;
    let bestScore = 0;

    for (const topic of topics) {
      let score = 0;

      for (const trigger of topic.triggers) {
        if (
          normalized.includes(trigger)
        ) {
          score +=
            trigger.includes(' ')
              ? 3
              : 1;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestTopic = topic.name;
      }
    }

    return bestTopic;
  }

  private static getDynamicTopics(): Array<{
    name: string;
    triggers: string[];
  }> {
    const topics = new Map<
      string,
      Set<string>
    >();

    const keywords =
      config.tiberiusResponses.keywords;

    for (
      const keyword of Object.keys(keywords)
    ) {
      const normalized =
        TextAnalyzer.normalize(keyword);

      if (
        !normalized ||
        IGNORED_KEYWORDS.has(
          normalized
        )
      ) {
        continue;
      }

      if (!topics.has(normalized)) {
        topics.set(
          normalized,
          new Set<string>()
        );
      }

      topics
        .get(normalized)!
        .add(normalized);
    }

    const context =
      config.tiberiusResponses.context;

    for (
      const combination
      of Object.keys(context)
    ) {
      const parts =
        combination.split('_');

      for (const part of parts) {
        const normalized =
          TextAnalyzer.normalize(part);

        if (
          !normalized ||
          IGNORED_KEYWORDS.has(
            normalized
          )
        ) {
          continue;
        }

        if (!topics.has(normalized)) {
          topics.set(
            normalized,
            new Set<string>()
          );
        }

        topics
          .get(normalized)!
          .add(normalized);
      }
    }

    return Array.from(
      topics.entries()
    ).map(
      ([name, triggers]) => ({
        name,
        triggers:
          Array.from(triggers),
      })
    );
  }

  private static calculateImportance(
    intent: MessageIntent,
    content: string,
    topic: string
  ): number {
    let importance = 1;

    if (
      intent === 'philosophical' ||
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
      this.isImportantTopic(topic)
    ) {
      importance += 1;
    }

    return Math.min(
      importance,
      10
    );
  }

  private static isImportantTopic(
    topic: string
  ): boolean {
    const importantTopics = [
      'roma',
      'imperio',
      'tartaro',
      'ragnar',
      'bob',
      'kazuki',
      'hitoshi',
      'yeshua',
    ];

    return importantTopics.includes(
      topic
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