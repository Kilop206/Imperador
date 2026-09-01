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
}