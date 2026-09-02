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
        if (shortTermBuffer.length > memory_1.MEMORY_LIMITS.SHORT_TERM_MAX) {
            shortTermBuffer.shift();
        }
    }
    /**
     * Return the most recent N entries for a user (newest first).
     */
    static getShortTerm(userId, limit = 5) {
        return shortTermBuffer
            .filter(e => e.userId === userId)
            .slice(-limit)
            .reverse();
    }
    /**
     * Return all entries regardless of user (newest first).
     */
    static getAllShortTerm(limit = memory_1.MEMORY_LIMITS.SHORT_TERM_MAX) {
        return [...shortTermBuffer]
            .slice(-limit)
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
     * Score components:
     * - Topic word in query (+10 exact token match, +5 substring)
     * - Summary words overlapping with query (+1 each, words >= 4 chars)
     * - Importance weight (+importance * 0.8)
     * - Recency bonus: more recent = higher score (+0 to +5)
     * - Penalty for age (expired memories score 0)
     */
    static scoreMemory(memory, normalizedQuery, now = Date.now()) {
        const age = now - memory.lastSeen;
        // Hard expiry: old low-importance memories are invisible
        if (memory.importance <= 2 &&
            age > memory_1.MEMORY_LIMITS.LOW_IMPORTANCE_EXPIRY_MS) {
            return 0;
        }
        if (age > memory_1.MEMORY_LIMITS.MAX_MEMORY_AGE_MS) {
            return 0;
        }
        let score = 0;
        const normalizedTopic = textAnalyzer_1.TextAnalyzer.normalize(memory.topic);
        // Token match (exact word in query)
        const tokens = normalizedQuery.split(' ');
        if (tokens.includes(normalizedTopic)) {
            score += 10;
        }
        else if (normalizedQuery.includes(normalizedTopic)) {
            score += 5;
        }
        // Summary word overlap
        const normalizedSummary = textAnalyzer_1.TextAnalyzer.normalize(memory.summary);
        const summaryTokens = normalizedSummary
            .split(' ')
            .filter(w => w.length >= 4);
        for (const word of summaryTokens) {
            if (normalizedQuery.includes(word)) {
                score += 1;
            }
        }
        // Importance weight
        score += memory.importance * 0.8;
        // Recency bonus (max +5, decays linearly over 30 days)
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;
        const recencyBonus = Math.max(0, 5 * (1 - Math.min(age, thirtyDays) / thirtyDays));
        score += recencyBonus;
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
            .filter(s => s.score >= memory_1.MEMORY_LIMITS.RELEVANCE_THRESHOLD)
            .sort((a, b) => b.score - a.score);
    }
    /**
     * Full memory context for a response decision.
     */
    static resolve(userId, content, now = Date.now()) {
        const shortTerm = this.getShortTerm(userId, 5);
        const candidates = this.findRelevant(userId, content, now);
        return {
            shortTerm,
            longTerm: candidates[0] ?? null,
            candidates,
        };
    }
    // ─── Response generation ───────────────────────────────────────────────────
    /**
     * Build a Tibério-voiced response that references a relevant memory.
     * Returns null when no relevant memory exists.
     */
    static buildMemoryResponse(userId, content) {
        const ctx = this.resolve(userId, content);
        if (!ctx.longTerm) {
            return null;
        }
        const { memory } = ctx.longTerm;
        return (`O Imperador se recorda de ${memory.topic}. ` +
            `${memory.summary}`);
    }
    /**
     * Check if the current message references a topic from a past conversation.
     * Used by the ResponseEngine to award the 'memory' source bonus.
     */
    static hasRelevantMemory(userId, content) {
        return this.findRelevant(userId, content).length > 0;
    }
    // ─── Short-term topic tracking ─────────────────────────────────────────────
    /**
     * Return the most frequently mentioned intent/topic in recent short-term entries.
     * Useful for deciding whether to maintain or change topic.
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
        for (const [intent, count] of counts) {
            if (count > max) {
                max = count;
                dominant = intent;
            }
        }
        return dominant || null;
    }
    /**
     * Return how many consecutive interactions from a user have been
     * of the same intent (streak length).
     */
    static getIntentStreak(userId, intent) {
        const entries = this.getShortTerm(userId, memory_1.MEMORY_LIMITS.SHORT_TERM_MAX);
        let streak = 0;
        for (const entry of entries) {
            if (entry.intent === intent) {
                streak++;
            }
            else {
                break;
            }
        }
        return streak;
    }
}
exports.ConversationMemoryEngine = ConversationMemoryEngine;
