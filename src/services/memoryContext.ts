import {
  ConversationMemory,
  MemoryService,
  UserMemory,
  WordMemory,
} from './memoryService';

export interface MemoryContext {
  user: UserMemory | null;
  recentConversations: ConversationMemory[];
  importantWords: WordMemory[];
}

export class MemoryContextService {
  static build(
    userId: string,
    limit = 5
  ): MemoryContext {
    return {
      user:
        MemoryService.getUser(
          userId
        ),

      recentConversations:
        MemoryService.getUserConversations(
          userId,
          limit
        ),

      importantWords:
        MemoryService.getMostMentionedWords(
          limit
        ),
    };
  }

  static format(
    context: MemoryContext
  ): string {
    const lines: string[] = [];

    if (context.user) {
      lines.push(
        `Usuário: ${context.user.username}`
      );

      lines.push(
        `Mensagens registradas: ${context.user.messageCount}`
      );
    }

    if (
      context.recentConversations.length > 0
    ) {
      lines.push(
        'Conversas lembradas:'
      );

      for (
        const conversation
        of context.recentConversations
      ) {
        lines.push(
          `- ${conversation.topic}: ${conversation.summary}`
        );
      }
    }

    if (
      context.importantWords.length > 0
    ) {
      lines.push(
        'Termos mais mencionados:'
      );

      for (
        const word
        of context.importantWords
      ) {
        lines.push(
          `- ${word.word}: ${word.count}`
        );
      }
    }

    return lines.join('\n');
  }

  static findRelevantMemory(
    userId: string,
    content: string
  ): ConversationMemory | null {
    const context =
      this.build(userId, 10);

    if (
      context.recentConversations.length === 0
    ) {
      return null;
    }

    const normalized =
      content
        .toLowerCase()
        .normalize('NFD')
        .replace(
          /[\u0300-\u036f]/g,
          ''
        );

    let bestMemory:
      ConversationMemory | null = null;

    let bestScore = 0;

    for (
      const memory
      of context.recentConversations
    ) {
      const topic =
        memory.topic
          .toLowerCase()
          .normalize('NFD')
          .replace(
            /[\u0300-\u036f]/g,
            ''
          );

      const summary =
        memory.summary
          .toLowerCase()
          .normalize('NFD')
          .replace(
            /[\u0300-\u036f]/g,
            ''
          );

      let score = 0;

      if (
        normalized.includes(topic)
      ) {
        score += 10;
      }

      const summaryWords =
        summary
          .split(/\s+/)
          .filter(
            word =>
              word.length >= 4
          );

      for (
        const word of summaryWords
      ) {
        if (
          normalized.includes(word)
        ) {
          score += 1;
        }
      }

      score +=
        memory.importance * 0.5;

      if (
        score > bestScore
      ) {
        bestScore = score;
        bestMemory = memory;
      }
    }

    return bestScore >= 10
      ? bestMemory
      : null;
  }

  static buildMemoryResponse(
    userId: string,
    content: string
  ): string | null {
    const memory =
      this.findRelevantMemory(
        userId,
        content
      );

    if (!memory) {
      return null;
    }

    return (
      `O Imperador se recorda de ${memory.topic}. ` +
      `${memory.summary}`
    );
  }
}