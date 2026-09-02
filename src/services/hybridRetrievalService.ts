import { ConversationMemory } from './memoryService';

export interface HybridMemoryCandidate {
    id: number;
    text: string;
    createdAt: number;
    importance: number;
    metadata?: Record<string, unknown>;
}

export interface HybridRetrievalResult {
    candidate: HybridMemoryCandidate;
    score: number;
    components: {
        keyword: number;
        tfidf: number;
        neural: number;
        recency: number;
        importance: number;
        emotion: number;
    };
}

export interface HybridRetrievalOptions {
    limit?: number;
    keywordWeight?: number;
    tfidfWeight?: number;
    neuralWeight?: number;
    recencyWeight?: number;
    importanceWeight?: number;
    emotionWeight?: number;
}

export interface TfidfSearchResult {
    id: number;
    score: number;
}

export interface TfidfServiceLike {
    search(
        query: string,
        limit?: number
    ): Array<TfidfSearchResult> | Promise<Array<TfidfSearchResult>>;
}

export interface NeuralSemanticServiceLike {
    compare(
        first: string,
        second: string
    ): number | Promise<number>;
}

export interface EmotionScoringContext {
    query?: string;
    userId?: string;
    currentEmotion?: Record<string, number>;
}

const DEFAULT_OPTIONS: Required<HybridRetrievalOptions> = {
    limit: 5,
    keywordWeight: 0.15,
    tfidfWeight: 0.20,
    neuralWeight: 0.30,
    recencyWeight: 0.15,
    importanceWeight: 0.10,
    emotionWeight: 0.10
};

export class HybridRetrievalService {
    private tfidfService?: TfidfServiceLike;
    private neuralService?: NeuralSemanticServiceLike;

    setTfidfService(service: TfidfServiceLike | undefined): void {
        this.tfidfService = service;
    }

    setNeuralService(service: NeuralSemanticServiceLike | undefined): void {
        this.neuralService = service;
    }

    isConfigured(): boolean {
        return Boolean(this.tfidfService || this.neuralService);
    }

    async retrieve(
        query: string,
        candidates: HybridMemoryCandidate[],
        options: HybridRetrievalOptions = {},
        emotionContext?: EmotionScoringContext
    ): Promise<HybridRetrievalResult[]> {
        const mergedOptions = {
            ...DEFAULT_OPTIONS,
            ...options
        };

        if (!query.trim() || candidates.length === 0) {
            return [];
        }

        const keywordScores = this.buildKeywordScoreMap(query, candidates);

        const tfidfScores = await this.buildTfidfScoreMap(
            query,
            mergedOptions.limit
        );

        const neuralScores = await this.buildNeuralScoreMap(
            query,
            candidates
        );

        const now = Date.now();

        const results: HybridRetrievalResult[] = candidates.map(
            (candidate) => {
                const keyword = keywordScores.get(candidate.id) ?? 0;
                const tfidf = tfidfScores.get(candidate.id) ?? 0;
                const neural = neuralScores.get(candidate.id) ?? 0;

                const recency = this.calculateRecencyScore(
                    candidate.createdAt,
                    now
                );

                const importance = this.normalizeImportance(
                    candidate.importance
                );

                const emotion = this.calculateEmotionScore(
                    candidate,
                    emotionContext
                );

                const score =
                    keyword * mergedOptions.keywordWeight +
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
            }
        );

        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, mergedOptions.limit);
    }

    private buildKeywordScoreMap(
        query: string,
        candidates: HybridMemoryCandidate[]
    ): Map<number, number> {
        const queryTokens = this.tokenize(query);

        if (queryTokens.length === 0) {
            return new Map();
        }

        const scores = new Map<number, number>();

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

            scores.set(
                candidate.id,
                matches / queryTokens.length
            );
        }

        return scores;
    }

    private async buildTfidfScoreMap(
        query: string,
        limit: number
    ): Promise<Map<number, number>> {
        if (!this.tfidfService) {
            return new Map();
        }

        const rawResults = await this.tfidfService.search(
            query,
            Math.max(limit * 3, 10)
        );

        const scores = new Map<number, number>();

        for (const result of rawResults) {
            scores.set(
                result.id,
                this.normalizeSimilarity(result.score)
            );
        }

        return scores;
    }

    private async buildNeuralScoreMap(
        query: string,
        candidates: HybridMemoryCandidate[]
    ): Promise<Map<number, number>> {
        const scores = new Map<number, number>();

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
                const similarity = await this.neuralService.compare(
                    query,
                    candidate.text
                );

                scores.set(
                    candidate.id,
                    this.normalizeSimilarity(similarity)
                );
            } catch {
                scores.set(candidate.id, 0);
            }
        }

        return scores;
    }

    private calculateRecencyScore(
        createdAt: number,
        now: number
    ): number {
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

    private normalizeImportance(value: number): number {
        if (!Number.isFinite(value)) {
            return 0;
        }

        return Math.max(0, Math.min(1, value));
    }

    private calculateEmotionScore(
        candidate: HybridMemoryCandidate,
        emotionContext?: EmotionScoringContext
    ): number {
        if (!emotionContext?.currentEmotion) {
            return 0;
        }

        const metadataEmotion = candidate.metadata?.emotion;

        if (
            !metadataEmotion ||
            typeof metadataEmotion !== 'object'
        ) {
            return 0;
        }

        if (
            typeof metadataEmotion !== 'object' ||
            metadataEmotion === null
        ) {
            return 0;
        }

        const candidateEmotion =
            metadataEmotion as Record<string, unknown>;

        const currentEmotion =
            emotionContext.currentEmotion;

        const emotionKeys = Object.keys(currentEmotion);

        if (emotionKeys.length === 0) {
            return 0;
        }

        let total = 0;
        let count = 0;

        for (const key of emotionKeys) {
            const current = currentEmotion[key];
            const candidateValue = candidateEmotion[key];

            if (
                typeof current !== 'number' ||
                typeof candidateValue !== 'number'
            ) {
                continue;
            }

            const normalizedCurrent = Math.max(
                0,
                Math.min(1, current)
            );

            const normalizedCandidate = Math.max(
                0,
                Math.min(1, candidateValue)
            );

            total += 1 - Math.abs(
                normalizedCurrent - normalizedCandidate
            );

            count++;
        }

        return count > 0 ? total / count : 0;
    }

    private normalizeSimilarity(value: number): number {
        if (!Number.isFinite(value)) {
            return 0;
        }

        /*
         * Compatível tanto com scores em [0,1] quanto
         * com pequenas oscilações numéricas.
         */
        return Math.max(0, Math.min(1, value));
    }

    private tokenize(text: string): string[] {
        return text
            .toLocaleLowerCase('pt-BR')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .split(/\s+/)
            .map((token) =>
                token.replace(/[^\p{L}\p{N}_-]/gu, '')
            )
            .filter((token) => token.length > 1);
    }
}