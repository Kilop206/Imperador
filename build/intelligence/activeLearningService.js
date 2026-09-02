"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActiveLearningService = void 0;
const intentCandidateService_1 = require("./intentCandidateService");
const DEFAULT_MIN_SCORE = 0.45;
const KNOWN_SIMILARITY_THRESHOLD = 0.85;
function normalize(text) {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function tokenize(text) {
    return new Set(normalize(text)
        .split(' ')
        .filter(token => token.length > 1));
}
function similarity(a, b) {
    const tokensA = tokenize(a);
    const tokensB = tokenize(b);
    if (tokensA.size === 0 ||
        tokensB.size === 0) {
        return 0;
    }
    let intersection = 0;
    for (const token of tokensA) {
        if (tokensB.has(token)) {
            intersection += 1;
        }
    }
    const union = new Set([
        ...tokensA,
        ...tokensB,
    ]).size;
    return union === 0
        ? 0
        : intersection / union;
}
class ActiveLearningService {
    static score(text, prediction) {
        const probabilities = Object.values(prediction.probabilities).sort((a, b) => b - a);
        const top = probabilities[0] ?? 0;
        const second = probabilities[1] ?? 0;
        /*
         * Quanto menor a confiança,
         * maior a incerteza.
         */
        const uncertainty = 1 - top;
        /*
         * Pequena diferença entre as duas
         * classes mais prováveis indica
         * ambiguidade.
         */
        const margin = 1 -
            Math.min(top - second, 1);
        /*
         * Mensagens já coletadas ou muito
         * semelhantes a candidatos pendentes
         * possuem pouco valor incremental.
         */
        const novelty = this.calculateNovelty(text);
        /*
         * Pesos:
         * 45% incerteza
         * 30% ambiguidade
         * 25% novidade
         */
        const score = (uncertainty * 0.45) +
            (margin * 0.30) +
            (novelty * 0.25);
        return {
            uncertainty,
            margin,
            novelty,
            score,
            shouldCollect: score >=
                DEFAULT_MIN_SCORE,
        };
    }
    static consider(text, prediction, minimumScore = DEFAULT_MIN_SCORE) {
        const result = this.score(text, prediction);
        const shouldCollect = result.score >=
            minimumScore;
        if (shouldCollect) {
            intentCandidateService_1.IntentCandidateService.collect(text, prediction, 1);
        }
        return {
            ...result,
            shouldCollect,
        };
    }
    static calculateNovelty(text) {
        const candidates = intentCandidateService_1.IntentCandidateService.getPending(100);
        if (candidates.length === 0) {
            return 1;
        }
        let maxSimilarity = 0;
        for (const candidate of candidates) {
            const current = similarity(text, candidate.text);
            if (current >
                maxSimilarity) {
                maxSimilarity =
                    current;
            }
        }
        if (maxSimilarity >=
            KNOWN_SIMILARITY_THRESHOLD) {
            return 0;
        }
        return (1 -
            maxSimilarity);
    }
}
exports.ActiveLearningService = ActiveLearningService;
