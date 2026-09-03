"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationMemoryEngine = void 0;
const memoryService_1 = require("../services/memoryService");
const textAnalyzer_1 = require("../services/textAnalyzer");
const memory_1 = require("../types/memory");
/**
 * In-process short-term memory ring buffer.
 * Stores the last MEMORY_LIMITS.SHORT_TERM_MAX interactions.
 * Cleared when the process restarts (intentional — long-term lives in SQLite).
 */
const shortTermBuffer = [];
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
class ConversationMemoryEngine {
    // ─── Short-term ────────────────────────────────────────────────────────────
    /**
     * Push a new interaction into the short-term buffer.
     * Evicts the oldest entry once the buffer reaches its limit.
     */
    static recordInteraction(userId, content, intent) {
        shortTermBuffer.push({
            userId,
            content,
            intent,
            timestamp: Date.now(),
        });
        if (shortTermBuffer.length >
            memory_1.MEMORY_LIMITS.SHORT_TERM_MAX) {
            shortTermBuffer.shift();
        }
    }
    /**
     * Return the most recent N entries for a user (newest first).
     */
    static getShortTerm(userId, limit = 5) {
        return shortTermBuffer
            .filter(entry => entry.userId === userId)
            .slice(-Math.max(1, Math.floor(limit)))
            .reverse();
    }
    /**
     * Return all entries regardless of user (newest first).
     */
    static getAllShortTerm(limit = memory_1.MEMORY_LIMITS.SHORT_TERM_MAX) {
        return [...shortTermBuffer]
            .slice(-Math.max(1, Math.floor(limit)))
            .reverse();
    }
    /** Clear the short-term buffer entirely (useful for tests). */
    static clearShortTerm() {
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
    static scoreMemory(memory, normalizedQuery, now = Date.now()) {
        const age = Math.max(0, now - memory.lastSeen);
        if (memory.importance <= 2 &&
            age >
                memory_1.MEMORY_LIMITS.LOW_IMPORTANCE_EXPIRY_MS) {
            return 0;
        }
        if (age >
            memory_1.MEMORY_LIMITS.MAX_MEMORY_AGE_MS) {
            return 0;
        }
        const normalizedTopic = textAnalyzer_1.TextAnalyzer.normalize(memory.topic);
        const queryTokens = this.tokenizeMeaningful(normalizedQuery);
        const topicTokens = this.tokenizeMeaningful(normalizedTopic);
        const normalizedSummary = textAnalyzer_1.TextAnalyzer.normalize(memory.summary);
        const summaryTokens = this.tokenizeMeaningful(normalizedSummary);
        const querySet = new Set(queryTokens);
        const topicSet = new Set(topicTokens);
        const summarySet = new Set(summaryTokens);
        let topicMatch = false;
        if (normalizedTopic.length > 0 &&
            querySet.has(normalizedTopic)) {
            topicMatch = true;
        }
        if (!topicMatch &&
            normalizedTopic.length > 0 &&
            normalizedQuery.includes(normalizedTopic)) {
            topicMatch = true;
        }
        const summaryOverlap = this.countIntersection(querySet, summarySet);
        const topicOverlap = this.countIntersection(querySet, topicSet);
        /*
         * No direct topic evidence and less than two meaningful
         * overlapping summary terms means the memory is irrelevant.
         */
        if (!topicMatch &&
            topicOverlap === 0 &&
            summaryOverlap <
                MIN_SUMMARY_OVERLAP_FOR_NON_TOPIC_MATCH) {
            return 0;
        }
        let score = 0;
        if (topicMatch) {
            score += 12;
        }
        if (topicOverlap > 0) {
            score += Math.min(6, topicOverlap * 3);
        }
        if (summaryOverlap > 0) {
            score += Math.min(6, summaryOverlap * 2);
        }
        /*
         * Importance is now a modifier, not evidence of relevance.
         */
        score +=
            Math.min(4, Math.max(0, memory.importance) * 0.4);
        /*
         * Recency is also only a modifier after relevance was established.
         */
        const thirtyDays = 30 *
            24 *
            60 *
            60 *
            1000;
        const recencyBonus = 3 *
            (1 -
                Math.min(age, thirtyDays) /
                    thirtyDays);
        score += Math.max(0, recencyBonus);
        return score;
    }
    /**
     * Retrieve and score the user's long-term memories against the current message.
     * Returns all candidates above the relevance threshold, best first.
     */
    static findRelevant(userId, content, now = Date.now()) {
        const memories = memoryService_1.MemoryService.getUserConversations(userId, memory_1.MEMORY_LIMITS.LONG_TERM_SCAN_LIMIT);
        if (memories.length === 0) {
            return [];
        }
        const normalizedQuery = textAnalyzer_1.TextAnalyzer.normalize(content);
        return memories
            .map(memory => ({
            memory,
            score: this.scoreMemory(memory, normalizedQuery, now),
        }))
            .filter(scored => scored.score >=
            memory_1.MEMORY_LIMITS.RELEVANCE_THRESHOLD)
            .sort((a, b) => b.score -
            a.score);
    }
    /**
     * Full memory context for a response decision.
     */
    static resolve(userId, content, now = Date.now()) {
        const shortTerm = this.getShortTerm(userId, 5);
        const candidates = this.findRelevant(userId, content, now);
        return {
            shortTerm,
            longTerm: candidates[0] ??
                null,
            candidates,
        };
    }
    // ─── Response generation ───────────────────────────────────────────────────
    /**
     * Build a Tibério-voiced response that references a relevant memory.
     * Returns null when no relevant memory exists.
     */
    static buildMemoryResponse(userId, content) {
        const context = this.resolve(userId, content);
        if (!context.longTerm) {
            return null;
        }
        const { memory, } = context.longTerm;
        return (`O Imperador se recorda de ${memory.topic}. ` +
            `${memory.summary}`);
    }
    /**
     * Check if the current message references a topic from a past conversation.
     */
    static hasRelevantMemory(userId, content) {
        return (this.findRelevant(userId, content).length > 0);
    }
    // ─── Short-term topic tracking ─────────────────────────────────────────────
    /**
     * Return the most frequently mentioned intent/topic in recent short-term entries.
     */
    static getDominantRecentIntent(userId, windowSize = 5) {
        const recent = this.getShortTerm(userId, windowSize);
        if (recent.length === 0) {
            return null;
        }
        const counts = new Map();
        for (const entry of recent) {
            counts.set(entry.intent, (counts.get(entry.intent) ?? 0) + 1);
        }
        let dominant = '';
        let max = 0;
        for (const [intent, count,] of counts) {
            if (count > max) {
                max = count;
                dominant = intent;
            }
        }
        return (dominant ||
            null);
    }
    /**
     * Return how many consecutive interactions from a user have been
     * of the same intent.
     */
    static getIntentStreak(userId, intent) {
        const entries = this.getShortTerm(userId, memory_1.MEMORY_LIMITS.SHORT_TERM_MAX);
        let streak = 0;
        for (const entry of entries) {
            if (entry.intent === intent) {
                streak += 1;
            }
            else {
                break;
            }
        }
        return streak;
    }
    // ─── Private helpers ───────────────────────────────────────────────────────
    static tokenizeMeaningful(text) {
        return textAnalyzer_1.TextAnalyzer
            .normalize(text)
            .split(/\s+/)
            .map(token => token.trim())
            .filter(token => token.length >= 3 &&
            !QUERY_STOP_WORDS.has(token));
    }
    static countIntersection(left, right) {
        let count = 0;
        for (const token of left) {
            if (right.has(token)) {
                count += 1;
            }
        }
        return count;
    }
}
exports.ConversationMemoryEngine = ConversationMemoryEngine;
