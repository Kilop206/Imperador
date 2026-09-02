"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HybridRetrievalService = void 0;
const DEFAULT_OPTIONS = {
    limit: 5,
    keywordWeight: 0.15,
    tfidfWeight: 0.20,
    neuralWeight: 0.30,
    recencyWeight: 0.15,
    importanceWeight: 0.10,
    emotionWeight: 0.10
};
class HybridRetrievalService {
    setTfidfService(service) {
        this.tfidfService = service;
    }
    setNeuralService(service) {
        this.neuralService = service;
    }
    isConfigured() {
        return Boolean(this.tfidfService || this.neuralService);
    }
    async retrieve(query, candidates, options = {}, emotionContext) {
        const mergedOptions = {
            ...DEFAULT_OPTIONS,
            ...options
        };
        if (!query.trim() || candidates.length === 0) {
            return [];
        }
        const keywordScores = this.buildKeywordScoreMap(query, candidates);
        const tfidfScores = await this.buildTfidfScoreMap(query, mergedOptions.limit);
        const neuralScores = await this.buildNeuralScoreMap(query, candidates);
        const now = Date.now();
        const results = candidates.map((candidate) => {
            const keyword = keywordScores.get(candidate.id) ?? 0;
            const tfidf = tfidfScores.get(candidate.id) ?? 0;
            const neural = neuralScores.get(candidate.id) ?? 0;
            const recency = this.calculateRecencyScore(candidate.createdAt, now);
            const importance = this.normalizeImportance(candidate.importance);
            const emotion = this.calculateEmotionScore(candidate, emotionContext);
            const score = keyword * mergedOptions.keywordWeight +
                tfidf * mergedOptions.tfidfWeight +
                neural * mergedOptions.neuralWeight +
                recency * mergedOptions.recencyWeight +
                importance * mergedOptions.importanceWeight +
                emotion * mergedOptions.emotionWeight;
            return {
                candidate,
                score,
                components: {
                    keyword,
                    tfidf,
                    neural,
                    recency,
                    importance,
                    emotion
                }
            };
        });
        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, mergedOptions.limit);
    }
    buildKeywordScoreMap(query, candidates) {
        const queryTokens = this.tokenize(query);
        if (queryTokens.length === 0) {
            return new Map();
        }
        const scores = new Map();
        for (const candidate of candidates) {
            const candidateTokens = this.tokenize(candidate.text);
            if (candidateTokens.length === 0) {
                scores.set(candidate.id, 0);
                continue;
            }
            const candidateSet = new Set(candidateTokens);
            let matches = 0;
            for (const token of queryTokens) {
                if (candidateSet.has(token)) {
                    matches++;
                }
            }
            scores.set(candidate.id, matches / queryTokens.length);
        }
        return scores;
    }
    async buildTfidfScoreMap(query, limit) {
        if (!this.tfidfService) {
            return new Map();
        }
        const rawResults = await this.tfidfService.search(query, Math.max(limit * 3, 10));
        const scores = new Map();
        for (const result of rawResults) {
            scores.set(result.id, this.normalizeSimilarity(result.score));
        }
        return scores;
    }
    async buildNeuralScoreMap(query, candidates) {
        const scores = new Map();
        if (!this.neuralService) {
            return scores;
        }
        /*
         * Important:
         * não usamos neuralService.search(query) aqui.
         *
         * O serviço neural pode possuir um índice global. Consultá-lo
         * diretamente permitiria introduzir memórias que não pertencem
         * ao conjunto de candidatos recebido por este retrieval.
         *
         * Em vez disso, cada candidato é comparado individualmente.
         * Assim, o domínio da recuperação continua sendo exatamente
         * aquele fornecido pelo chamador.
         */
        for (const candidate of candidates) {
            try {
                const similarity = await this.neuralService.compare(query, candidate.text);
                scores.set(candidate.id, this.normalizeSimilarity(similarity));
            }
            catch {
                scores.set(candidate.id, 0);
            }
        }
        return scores;
    }
    calculateRecencyScore(createdAt, now) {
        if (!Number.isFinite(createdAt) || createdAt <= 0) {
            return 0;
        }
        const ageMs = Math.max(0, now - createdAt);
        const ageDays = ageMs / (1000 * 60 * 60 * 24);
        /*
         * Decaimento suave:
         * 0 dias  -> 1.0
         * 7 dias  -> ~0.5
         * 30 dias -> ~0.19
         */
        return 1 / (1 + ageDays / 7);
    }
    normalizeImportance(value) {
        if (!Number.isFinite(value)) {
            return 0;
        }
        return Math.max(0, Math.min(1, value));
    }
    calculateEmotionScore(candidate, emotionContext) {
        if (!emotionContext?.currentEmotion) {
            return 0;
        }
        const metadataEmotion = candidate.metadata?.emotion;
        if (!metadataEmotion ||
            typeof metadataEmotion !== 'object') {
            return 0;
        }
        if (typeof metadataEmotion !== 'object' ||
            metadataEmotion === null) {
            return 0;
        }
        const candidateEmotion = metadataEmotion;
        const currentEmotion = emotionContext.currentEmotion;
        const emotionKeys = Object.keys(currentEmotion);
        if (emotionKeys.length === 0) {
            return 0;
        }
        let total = 0;
        let count = 0;
        for (const key of emotionKeys) {
            const current = currentEmotion[key];
            const candidateValue = candidateEmotion[key];
            if (typeof current !== 'number' ||
                typeof candidateValue !== 'number') {
                continue;
            }
            const normalizedCurrent = Math.max(0, Math.min(1, current));
            const normalizedCandidate = Math.max(0, Math.min(1, candidateValue));
            total += 1 - Math.abs(normalizedCurrent - normalizedCandidate);
            count++;
        }
        return count > 0 ? total / count : 0;
    }
    normalizeSimilarity(value) {
        if (!Number.isFinite(value)) {
            return 0;
        }
        /*
         * Compatível tanto com scores em [0,1] quanto
         * com pequenas oscilações numéricas.
         */
        return Math.max(0, Math.min(1, value));
    }
    tokenize(text) {
        return text
            .toLocaleLowerCase('pt-BR')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .split(/\s+/)
            .map((token) => token.replace(/[^\p{L}\p{N}_-]/gu, ''))
            .filter((token) => token.length > 1);
    }
}
exports.HybridRetrievalService = HybridRetrievalService;
