"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MEMORY_LIMITS = void 0;
/**
 * Limits for memory retrieval and storage.
 */
exports.MEMORY_LIMITS = {
    /** Max entries kept in the in-process short-term ring */
    SHORT_TERM_MAX: 20,
    /** How many long-term memories to score */
    LONG_TERM_SCAN_LIMIT: 20,
    /** Minimum relevance score to include a memory as a candidate */
    RELEVANCE_THRESHOLD: 8,
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
    MAX_MEMORY_AGE_MS: 60 * 24 * 60 * 60 * 1000,
};
