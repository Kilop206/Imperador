import { ConversationMemory } from '../services/memoryService';

/**
 * One entry in the in-process short-term memory ring buffer.
 * Represents a single message + the intent detected from it.
 */
export interface ShortTermEntry {
  userId:    string;
  content:   string;
  intent:    string;
  timestamp: number;
}

/**
 * A memory retrieved as relevant to the current message,
 * with a computed relevance score.
 */
export interface ScoredMemory {
  memory:    ConversationMemory;
  /** Composite score: topic overlap + recency + importance */
  score:     number;
}

/**
 * Full memory context assembled for a single response decision.
 */
export interface ResolvedMemoryContext {
  /** Most recent short-term entries (newest first) */
  shortTerm:   ShortTermEntry[];
  /** Best matching long-term memory, if any */
  longTerm:    ScoredMemory | null;
  /** All scored candidates above the relevance threshold */
  candidates:  ScoredMemory[];
}

/**
 * Limits for memory retrieval and storage.
 */
export const MEMORY_LIMITS = {
  /** Max entries kept in the in-process short-term ring */
  SHORT_TERM_MAX:          20,
  /** How many long-term memories to score */
  LONG_TERM_SCAN_LIMIT:    20,
  /** Minimum relevance score to include a memory as a candidate */
  RELEVANCE_THRESHOLD:      8,
  /**
   * Milliseconds after which a low-importance memory (importance <= 2)
   * is treated as expired and excluded from retrieval.
   * Default: 7 days.
   */
  LOW_IMPORTANCE_EXPIRY_MS: 7 * 24 * 60 * 60 * 1000,
  /**
   * Milliseconds after which ANY memory is treated as expired
   * regardless of importance.
   * Default: 60 days.
   */
  MAX_MEMORY_AGE_MS:        60 * 24 * 60 * 60 * 1000,
} as const;
