"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseEngine = void 0;
const config_1 = require("../config/config");
const contextAnalyzer_1 = require("./contextAnalyzer");
const modeManager_1 = require("./modeManager");
const rarityManager_1 = require("./rarityManager");
const textAnalyzer_1 = require("./textAnalyzer");
const responseValidator_1 = require("./responseValidator");
const personalityEngine_1 = require("../intelligence/personalityEngine");
const emotionState_1 = require("../state/emotionState");
const conversationMemory_1 = require("../intelligence/conversationMemory");
const semanticContextService_1 = require("../intelligence/semanticContextService");
const memoryService_1 = require("./memoryService");
const responseGenerationEngine_1 = require("../intelligence/responseGenerationEngine");
let semanticContextService = new semanticContextService_1.SemanticContextService();
const responseGenerationEngine = new responseGenerationEngine_1.ResponseGenerationEngine();
class ResponseEngine {
    static setSemanticService(service) {
        semanticContextService = service;
    }
    static generateCandidates(content, userId) {
        const candidates = [];
        const analysis = textAnalyzer_1.TextAnalyzer.analyze(content);
        if (userId) {
            this.addMemoryCandidates(userId, content, candidates);
        }
        const contextResponse = contextAnalyzer_1.ContextAnalyzer.isCombination(content);
        if (contextResponse) {
            candidates.push({
                text: contextResponse,
                source: 'context',
                score: 100,
            });
        }
        if (analysis.isAggressive) {
            this.addAggressiveCandidates(content, candidates);
        }
        if (analysis.isCompliment) {
            this.addComplimentCandidates(candidates);
        }
        if (!modeManager_1.ModeManager.isNormalMode()) {
            const modeResponse = modeManager_1.ModeManager.getModeResponse();
            if (modeResponse) {
                candidates.push({
                    text: modeResponse,
                    source: 'mode',
                    score: analysis.intent ===
                        'aggressive'
                        ? 45
                        : 60,
                });
            }
        }
        this.addKeywordCandidates(content, analysis, candidates);
        this.addIntentCandidates(content, analysis.intent, candidates);
        if (userId) {
            this.addSemanticCandidates(userId, content, candidates);
        }
        this.addGeneratedCandidate(content, analysis, userId, candidates);
        const rareResponse = rarityManager_1.RarityManager.getRareResponse();
        if (rareResponse) {
            candidates.push({
                text: rareResponse,
                source: 'rare',
                score: 10,
            });
        }
        return candidates;
    }
    static selectResponse(content, userId) {
        const candidates = this.generateCandidates(content, userId);
        if (candidates.length === 0) {
            if (userId) {
                const analysis = textAnalyzer_1.TextAnalyzer.analyze(content);
                conversationMemory_1.ConversationMemoryEngine.recordInteraction(userId, content, analysis.intent);
            }
            return null;
        }
        const filtered = this.filterCandidates(candidates, content);
        if (userId) {
            const analysis = textAnalyzer_1.TextAnalyzer.analyze(content);
            conversationMemory_1.ConversationMemoryEngine.recordInteraction(userId, content, analysis.intent);
        }
        if (filtered.length === 0) {
            return null;
        }
        const sorted = [...filtered].sort((a, b) => b.score - a.score);
        const bestScore = sorted[0].score;
        const bestCandidates = sorted.filter(candidate => candidate.score ===
            bestScore);
        return this.randomItem(bestCandidates).text;
    }
    static addGeneratedCandidate(content, analysis, userId, candidates) {
        try {
            const relevantMemory = userId
                ? conversationMemory_1.ConversationMemoryEngine.buildMemoryResponse(userId, content)
                : null;
            let semanticContext = null;
            if (userId &&
                semanticContextService.isConfigured()) {
                const memories = memoryService_1.MemoryService.getUserConversations(userId, 20);
                if (memories.length > 0) {
                    const context = semanticContextService.buildContext(content, memories, emotionState_1.emotionState);
                    if (context.isActive &&
                        context.best) {
                        semanticContext =
                            context.contextSummary;
                    }
                }
            }
            const generated = responseGenerationEngine.generate({
                content,
                intent: analysis.intent,
                emotion: emotionState_1.emotionState,
                relevantMemory,
                semanticContext,
            });
            if (!generated) {
                return;
            }
            const score = 86 +
                Math.round(generated.confidence * 8);
            candidates.push({
                text: generated.text,
                source: 'generated',
                score: Math.min(94, score),
            });
        }
        catch {
            // O gerador é opcional. O pipeline determinístico continua funcionando.
        }
    }
    static addSemanticCandidates(userId, content, candidates) {
        if (!semanticContextService.isConfigured()) {
            return;
        }
        try {
            const memories = memoryService_1.MemoryService.getUserConversations(userId, 20);
            if (memories.length === 0) {
                return;
            }
            const context = semanticContextService.buildContext(content, memories, emotionState_1.emotionState);
            if (!context.isActive ||
                !context.best) {
                return;
            }
            const semanticScore = 65 +
                Math.round(context.best.score.final * 20);
            candidates.push({
                text: context.contextSummary,
                source: 'semantic',
                score: semanticScore,
            });
        }
        catch {
            // Falha silenciosa — o pipeline determinístico continua
        }
    }
    static addMemoryCandidates(userId, content, candidates) {
        const memoryResponse = conversationMemory_1.ConversationMemoryEngine.buildMemoryResponse(userId, content);
        if (!memoryResponse) {
            return;
        }
        candidates.push({
            text: memoryResponse,
            source: 'memory',
            score: 85,
        });
    }
    static addAggressiveCandidates(content, candidates) {
        const normalized = textAnalyzer_1.TextAnalyzer.normalize(content);
        const keywords = config_1.config.tiberiusResponses
            .keywords;
        for (const [keyword, responses] of Object.entries(keywords)) {
            const normalizedKeyword = textAnalyzer_1.TextAnalyzer.normalize(keyword);
            if (!normalized.includes(normalizedKeyword)) {
                continue;
            }
            const response = this.resolveResponse(responses, true, false);
            if (response) {
                candidates.push({
                    text: response,
                    source: 'aggressive',
                    score: 90,
                });
                break;
            }
        }
    }
    static addComplimentCandidates(candidates) {
        const responses = config_1.config.tiberiusResponses
            .compliments;
        for (const response of responses) {
            if (responseValidator_1.ResponseValidator.isResponseAppropriate(response, false, true)) {
                candidates.push({
                    text: response,
                    source: 'compliment',
                    score: 80,
                });
            }
        }
    }
    static addKeywordCandidates(content, analysis, candidates) {
        const normalized = textAnalyzer_1.TextAnalyzer.normalize(content);
        const keywords = config_1.config.tiberiusResponses
            .keywords;
        for (const [keyword, responses] of Object.entries(keywords)) {
            const normalizedKeyword = textAnalyzer_1.TextAnalyzer.normalize(keyword);
            if (!normalized.includes(normalizedKeyword)) {
                continue;
            }
            const response = this.resolveResponse(responses, analysis.isAggressive, analysis.isCompliment);
            if (response) {
                candidates.push({
                    text: response,
                    source: 'keyword',
                    score: 65,
                });
            }
        }
    }
    static addIntentCandidates(content, intent, candidates) {
        const keywords = config_1.config.tiberiusResponses
            .keywords;
        const intentKeywords = {
            greeting: [
                'oi',
                'ola',
                'olá',
                'bom dia',
                'boa tarde',
                'boa noite',
            ],
            farewell: [
                'tchau',
                'adeus',
                'até mais',
                'ate mais',
            ],
            humor: [
                'kkkk',
                'hahaha',
                'haha',
                'rsrs',
            ],
            serious: [
                'morte',
                'guerra',
            ],
            nostalgic: [
                'passado',
                'saudade',
            ],
            philosophical: [
                'vida',
                'existência',
                'sentido',
            ],
            roman: [
                'roma',
                'romano',
                'império',
            ],
        };
        const possibleKeywords = intentKeywords[intent] || [];
        const normalized = textAnalyzer_1.TextAnalyzer.normalize(content);
        for (const keyword of possibleKeywords) {
            if (!normalized.includes(textAnalyzer_1.TextAnalyzer.normalize(keyword))) {
                continue;
            }
            const response = keywords[keyword];
            if (!response) {
                continue;
            }
            const resolved = this.resolveResponse(response, false, false);
            if (resolved) {
                candidates.push({
                    text: resolved,
                    source: 'intent',
                    score: 55,
                });
                break;
            }
        }
    }
    static filterCandidates(candidates, content) {
        const analysis = textAnalyzer_1.TextAnalyzer.analyze(content);
        const modifiers = personalityEngine_1.PersonalityEngine.getScoreModifiers(emotionState_1.emotionState);
        return candidates
            .filter(candidate => responseValidator_1.ResponseValidator.isResponseAppropriate(candidate.text, analysis.isAggressive, analysis.isCompliment) &&
            personalityEngine_1.PersonalityEngine.isConsistent(candidate.text))
            .map(candidate => {
            let bonus = 0;
            if (candidate.source ===
                'aggressive') {
                bonus =
                    modifiers.aggressiveBoost;
            }
            else if (candidate.source ===
                'compliment') {
                bonus =
                    modifiers.complimentModifier;
            }
            else if (candidate.source ===
                'mode' ||
                candidate.source ===
                    'intent') {
                bonus =
                    modifiers.reflectiveBoost;
            }
            else if (candidate.source ===
                'keyword') {
                bonus =
                    modifiers.curiosityBoost;
            }
            if (bonus === 0) {
                return candidate;
            }
            return {
                ...candidate,
                score: candidate.score +
                    bonus,
            };
        });
    }
    static resolveResponse(response, isAggressive, isCompliment) {
        if (Array.isArray(response)) {
            const valid = responseValidator_1.ResponseValidator
                .filterAppropriateResponses(response, isAggressive, isCompliment);
            return valid.length > 0
                ? this.randomItem(valid)
                : null;
        }
        return responseValidator_1.ResponseValidator
            .isResponseAppropriate(response, isAggressive, isCompliment)
            ? response
            : null;
    }
    static randomItem(items) {
        return items[Math.floor(Math.random() * items.length)];
    }
}
exports.ResponseEngine = ResponseEngine;
