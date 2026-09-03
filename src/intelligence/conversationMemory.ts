import {
  ConversationMemory,
  MemoryService,
} from '../services/memoryService';

import {
  TextAnalyzer,
} from '../services/textAnalyzer';

import {
  MEMORY_LIMITS,
  ResolvedMemoryContext,
  ScoredMemory,
  ShortTermEntry,
} from '../types/memory';

/**
 * In-process short-term memory ring buffer.
 * Stores the last MEMORY_LIMITS.SHORT_TERM_MAX interactions.
 * Cleared when the process restarts (intentional — long-term lives in SQLite).
 */
const shortTermBuffer: ShortTermEntry[] = [];

const MIN_SUMMARY_OVERLAP_FOR_NON_TOPIC_MATCH = 2;

const QUERY_STOP_WORDS = new Set([
  'a',
  'as',
  'ao',
  'aos',
  'com',
  'da',
  'das',
  'de',
  'do',
  'dos',
  'e',
  'em',
  'na',
  'nas',
  'no',
  'nos',
  'o',
  'os',
  'ou',
  'para',
  'por',
  'que',
  'se',
  'sem',
  'sobre',
  'um',
  'uma',
  'uns',
  'umas',
  'vc',
  'voce',
  'você',
]);

export class ConversationMemoryEngine {
  // ─── Short-term ────────────────────────────────────────────────────────────

  /**
   * Push a new interaction into the short-term buffer.
   * Evicts the oldest entry once the buffer reaches its limit.
   */
  static recordInteraction(
    userId: string,
    content: string,
    intent: string,
  ): void {
    shortTermBuffer.push({
      userId,
      content,
      intent,
      timestamp: Date.now(),
    });

    if (
      shortTermBuffer.length >
      MEMORY_LIMITS.SHORT_TERM_MAX
    ) {
      shortTermBuffer.shift();
    }
  }

  /**
   * Return the most recent N entries for a user (newest first).
   */
  static getShortTerm(
    userId: string,
    limit = 5,
  ): ShortTermEntry[] {
    return shortTermBuffer
      .filter(
        entry =>
          entry.userId === userId,
      )
      .slice(-Math.max(1, Math.floor(limit)))
      .reverse();
  }

  /**
   * Return all entries regardless of user (newest first).
   */
  static getAllShortTerm(
    limit = MEMORY_LIMITS.SHORT_TERM_MAX,
  ): ShortTermEntry[] {
    return [...shortTermBuffer]
      .slice(
        -Math.max(1, Math.floor(limit)),
      )
      .reverse();
  }

  /** Clear the short-term buffer entirely (useful for tests). */
  static clearShortTerm(): void {
    shortTermBuffer.length = 0;
  }

  // ─── Long-term ─────────────────────────────────────────────────────────────

  /**
   * Score a single long-term memory against a query message.
   *
   * The relevance policy is intentionally conservative:
   *
   * 1. A direct topic match is strong evidence.
   * 2. Otherwise, the query must share at least two meaningful words
   *    with the memory summary.
   * 3. Importance and recency only modify an already relevant memory.
   *
   * This prevents a recent/high-importance memory from becoming relevant
   * to completely unrelated messages.
   */
  static scoreMemory(
    memory: ConversationMemory,
    normalizedQuery: string,
    now = Date.now(),
  ): number {
    const age = Math.max(
      0,
      now - memory.lastSeen,
    );

    if (
      memory.importance <= 2 &&
      age >
        MEMORY_LIMITS.LOW_IMPORTANCE_EXPIRY_MS
    ) {
      return 0;
    }

    if (
      age >
      MEMORY_LIMITS.MAX_MEMORY_AGE_MS
    ) {
      return 0;
    }

    const normalizedTopic =
      TextAnalyzer.normalize(
        memory.topic,
      );

    const queryTokens =
      this.tokenizeMeaningful(
        normalizedQuery,
      );

    const topicTokens =
      this.tokenizeMeaningful(
        normalizedTopic,
      );

    const normalizedSummary =
      TextAnalyzer.normalize(
        memory.summary,
      );

    const summaryTokens =
      this.tokenizeMeaningful(
        normalizedSummary,
      );

    const querySet =
      new Set(queryTokens);

    const topicSet =
      new Set(topicTokens);

    const summarySet =
      new Set(summaryTokens);

    let topicMatch = false;

    if (
      normalizedTopic.length > 0 &&
      querySet.has(normalizedTopic)
    ) {
      topicMatch = true;
    }

    if (
      !topicMatch &&
      normalizedTopic.length > 0 &&
      normalizedQuery.includes(
        normalizedTopic,
      )
    ) {
      topicMatch = true;
    }

    const summaryOverlap =
      this.countIntersection(
        querySet,
        summarySet,
      );

    const topicOverlap =
      this.countIntersection(
        querySet,
        topicSet,
      );

    /*
     * No direct topic evidence and less than two meaningful
     * overlapping summary terms means the memory is irrelevant.
     */
    if (
      !topicMatch &&
      topicOverlap === 0 &&
      summaryOverlap <
        MIN_SUMMARY_OVERLAP_FOR_NON_TOPIC_MATCH
    ) {
      return 0;
    }

    let score = 0;

    if (topicMatch) {
      score += 12;
    }

    if (topicOverlap > 0) {
      score += Math.min(
        6,
        topicOverlap * 3,
      );
    }

    if (summaryOverlap > 0) {
      score += Math.min(
        6,
        summaryOverlap * 2,
      );
    }

    /*
     * Importance is now a modifier, not evidence of relevance.
     */
    score +=
      Math.min(
        4,
        Math.max(
          0,
          memory.importance,
        ) * 0.4,
      );

    /*
     * Recency is also only a modifier after relevance was established.
     */
    const thirtyDays =
      30 *
      24 *
      60 *
      60 *
      1000;

    const recencyBonus =
      3 *
      (
        1 -
        Math.min(
          age,
          thirtyDays,
        ) /
          thirtyDays
      );

    score += Math.max(
      0,
      recencyBonus,
    );

    return score;
  }

  /**
   * Retrieve and score the user's long-term memories against the current message.
   * Returns all candidates above the relevance threshold, best first.
   */
  static findRelevant(
    userId: string,
    content: string,
    now = Date.now(),
  ): ScoredMemory[] {
    const memories =
      MemoryService.getUserConversations(
        userId,
        MEMORY_LIMITS.LONG_TERM_SCAN_LIMIT,
      );

    if (
      memories.length === 0
    ) {
      return [];
    }

    const normalizedQuery =
      TextAnalyzer.normalize(
        content,
      );

    return memories
      .map(memory => ({
        memory,
        score:
          this.scoreMemory(
            memory,
            normalizedQuery,
            now,
          ),
      }))
      .filter(
        scored =>
          scored.score >=
          MEMORY_LIMITS.RELEVANCE_THRESHOLD,
      )
      .sort(
        (a, b) =>
          b.score -
          a.score,
      );
  }

  /**
   * Full memory context for a response decision.
   */
  static resolve(
    userId: string,
    content: string,
    now = Date.now(),
  ): ResolvedMemoryContext {
    const shortTerm =
      this.getShortTerm(
        userId,
        5,
      );

    const candidates =
      this.findRelevant(
        userId,
        content,
        now,
      );

    return {
      shortTerm,
      longTerm:
        candidates[0] ??
        null,
      candidates,
    };
  }

  // ─── Response generation ───────────────────────────────────────────────────

  /**
   * Build a Tibério-voiced response that references a relevant memory.
   * Returns null when no relevant memory exists.
   */
  static buildMemoryResponse(
    userId: string,
    content: string,
  ): string | null {
    const context =
      this.resolve(
        userId,
        content,
      );

    if (
      !context.longTerm
    ) {
      return null;
    }

    const {
      memory,
    } =
      context.longTerm;

    return (
      `O Imperador se recorda de ${memory.topic}. ` +
      `${memory.summary}`
    );
  }

  /**
   * Check if the current message references a topic from a past conversation.
   */
  static hasRelevantMemory(
    userId: string,
    content: string,
  ): boolean {
    return (
      this.findRelevant(
        userId,
        content,
      ).length > 0
    );
  }

  // ─── Short-term topic tracking ─────────────────────────────────────────────

  /**
   * Return the most frequently mentioned intent/topic in recent short-term entries.
   */
  static getDominantRecentIntent(
    userId: string,
    windowSize = 5,
  ): string | null {
    const recent =
      this.getShortTerm(
        userId,
        windowSize,
      );

    if (
      recent.length === 0
    ) {
      return null;
    }

    const counts =
      new Map<
        string,
        number
      >();

    for (
      const entry of recent
    ) {
      counts.set(
        entry.intent,
        (
          counts.get(
            entry.intent,
          ) ?? 0
        ) + 1,
      );
    }

    let dominant = '';
    let max = 0;

    for (
      const [
        intent,
        count,
      ] of counts
    ) {
      if (
        count > max
      ) {
        max = count;
        dominant = intent;
      }
    }

    return (
      dominant ||
      null
    );
  }

  /**
   * Return how many consecutive interactions from a user have been
   * of the same intent.
   */
  static getIntentStreak(
    userId: string,
    intent: string,
  ): number {
    const entries =
      this.getShortTerm(
        userId,
        MEMORY_LIMITS.SHORT_TERM_MAX,
      );

    let streak = 0;

    for (
      const entry of entries
    ) {
      if (
        entry.intent === intent
      ) {
        streak += 1;
      } else {
        break;
      }
    }

    return streak;
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private static tokenizeMeaningful(
    text: string,
  ): string[] {
    return TextAnalyzer
      .normalize(text)
      .split(/\s+/)
      .map(
        token =>
          token.trim(),
      )
      .filter(
        token =>
          token.length >= 3 &&
          !QUERY_STOP_WORDS.has(
            token,
          ),
      );
  }

  private static countIntersection(
    left: Set<string>,
    right: Set<string>,
  ): number {
    let count = 0;

    for (
      const token of left
    ) {
      if (
        right.has(token)
      ) {
        count += 1;
      }
    }

    return count;
  }
}