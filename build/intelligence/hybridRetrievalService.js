"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HybridRetrievalService = void 0;
// ─────────────────────────────────────────────────────────────────────────────
// Pesos padrão
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_WEIGHTS = {
    keyword: 0.15,
    tfidf: 0.20,
    neural: 0.30,
    recency: 0.15,
    importance: 0.10,
    emotion: 0.10,
};
const DEFAULT_RECENCY_HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias
// ─────────────────────────────────────────────────────────────────────────────
// Mapeamento de emoção → palavras-chave temáticas
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Quando uma emoção está elevada, memórias contendo essas
 * palavras-chave recebem um boost no componente de emoção.
 */
const EMOTION_KEYWORDS = {
    irritation: [
        "irritacao", "raiva", "frustrado", "chateado", "exasperado",
        "grosseiro", "insulto", "xingamento", "agressivo",
    ],
    respect: [
        "respeito", "honra", "nobreza", "imperial", "digno",
        "autoridade", "leal", "fidelidade", "reconhecimento",
    ],
    trust: [
        "confianca", "aliado", "amigo", "fidelidade", "lealdade",
        "seguranca", "parceiro",
    ],
    nostalgia: [
        "passado", "memoria", "antigo", "saudade", "lembrar",
        "historia", "tempos", "outrora", "recordar", "infancia",
    ],
    curiosity: [
        "curioso", "descoberta", "aprender", "conhecimento", "saber",
        "explorar", "investigar", "perguntar", "filosofia", "universo",
    ],
    hostility: [
        "inimigo", "ameaca", "perigo", "combate", "guerra",
        "trair", "traidores", "destruicao", "oponente", "conflito",
    ],
    amusement: [
        "piada", "humor", "rir", "diversao", "gracioso",
        "comedia", "ironia", "sarcasmo", "entretenimento",
    ],
};
// ─────────────────────────────────────────────────────────────────────────────
// Serviço
// ─────────────────────────────────────────────────────────────────────────────
class HybridRetrievalService {
    constructor() {
        this.tfidfService = null;
        this.neuralService = null;
    }
    // ─── Configuração ──────────────────────────────────────────────────────────
    /**
     * Configura o serviço de similaridade TF-IDF (opcional).
     * Deve já estar treinado com os textos das memórias candidatas.
     */
    setTfidfService(service) {
        if (!service.isTrained()) {
            throw new Error("SemanticSimilarityService precisa estar treinado.");
        }
        this.tfidfService = service;
    }
    /**
     * Configura o serviço de memória neural (opcional).
     * Deve ter modelos configurados e memórias indexadas.
     */
    setNeuralService(service) {
        if (!service.isReady()) {
            throw new Error("NeuralSemanticMemoryService precisa ter modelos configurados.");
        }
        this.neuralService = service;
    }
    // ─── Retrieval principal ───────────────────────────────────────────────────
    /**
     * Dado uma query de texto e um estado emocional,
     * rankeia os candidatos usando o score híbrido.
     *
     * Candidatos sem `createdAt` assumem timestamp zero (mais antigos possível).
     * Candidatos sem `importance` assumem 0.5 (neutro).
     */
    retrieve(query, candidates, emotionState, options = {}) {
        if (!Array.isArray(candidates)) {
            throw new TypeError("candidates deve ser um array.");
        }
        if (typeof query !== "string" ||
            query.trim().length === 0) {
            return [];
        }
        if (candidates.length === 0) {
            return [];
        }
        const topK = Math.max(1, Math.floor(options.topK ?? 5));
        const minimumScore = Math.max(0, Math.min(1, options.minimumScore ?? 0));
        const halfLifeMs = options.recencyHalfLifeMs ??
            DEFAULT_RECENCY_HALF_LIFE_MS;
        const weights = this.mergeWeights(options.weights);
        const now = Date.now();
        const queryTokens = tokenize(query);
        // Pré-computar scores neurais (busca em lote)
        const neuralScoreMap = this.buildNeuralScoreMap(query, candidates);
        const results = [];
        for (const candidate of candidates) {
            if (typeof candidate?.id !== "string" ||
                candidate.id.trim().length === 0 ||
                typeof candidate?.text !== "string" ||
                candidate.text.trim().length === 0) {
                continue;
            }
            const components = {
                keyword: this.computeKeywordScore(queryTokens, tokenize(candidate.text)),
                tfidf: this.computeTfidfScore(query, candidate.text),
                neural: neuralScoreMap.get(candidate.id) ?? 0,
                recency: computeRecencyScore(candidate.createdAt ?? 0, now, halfLifeMs),
                importance: normalizeImportance(candidate.importance),
                emotion: computeEmotionScore(candidate.text, emotionState),
            };
            const final = computeWeightedScore(components, weights);
            if (final >= minimumScore) {
                results.push({
                    id: candidate.id,
                    text: candidate.text,
                    score: {
                        final,
                        components,
                        weights,
                    },
                    memory: { ...candidate },
                });
            }
        }
        return results
            .sort((a, b) => {
            if (b.score.final !== a.score.final) {
                return b.score.final - a.score.final;
            }
            return a.id.localeCompare(b.id);
        })
            .slice(0, topK);
    }
    /**
     * Retorna o melhor candidato, ou null se não houver resultados.
     */
    retrieveBest(query, candidates, emotionState, options = {}) {
        const results = this.retrieve(query, candidates, emotionState, { ...options, topK: 1 });
        return results[0] ?? null;
    }
    /**
     * Formata os detalhes de um resultado para depuração.
     */
    formatScore(result) {
        const { components, weights, final } = result.score;
        return [
            `ID: ${result.id}`,
            `Texto: ${result.text.slice(0, 80)}${result.text.length > 80 ? "..." : ""}`,
            `Score final: ${final.toFixed(4)}`,
            "Componentes:",
            `  keyword    : ${components.keyword.toFixed(4)} × ${weights.keyword.toFixed(2)}`,
            `  tfidf      : ${components.tfidf.toFixed(4)} × ${weights.tfidf.toFixed(2)}`,
            `  neural     : ${components.neural.toFixed(4)} × ${weights.neural.toFixed(2)}`,
            `  recency    : ${components.recency.toFixed(4)} × ${weights.recency.toFixed(2)}`,
            `  importance : ${components.importance.toFixed(4)} × ${weights.importance.toFixed(2)}`,
            `  emotion    : ${components.emotion.toFixed(4)} × ${weights.emotion.toFixed(2)}`,
        ].join("\n");
    }
    // ─── Privado ───────────────────────────────────────────────────────────────
    mergeWeights(custom) {
        if (!custom) {
            return { ...DEFAULT_WEIGHTS };
        }
        const merged = {
            keyword: custom.keyword ?? DEFAULT_WEIGHTS.keyword,
            tfidf: custom.tfidf ?? DEFAULT_WEIGHTS.tfidf,
            neural: custom.neural ?? DEFAULT_WEIGHTS.neural,
            recency: custom.recency ?? DEFAULT_WEIGHTS.recency,
            importance: custom.importance ?? DEFAULT_WEIGHTS.importance,
            emotion: custom.emotion ?? DEFAULT_WEIGHTS.emotion,
        };
        // Normalizar para que a soma seja 1.0
        const total = Object.values(merged).reduce((sum, v) => sum + v, 0);
        if (total > 0 && Math.abs(total - 1) > 0.001) {
            for (const key of Object.keys(merged)) {
                merged[key] = merged[key] / total;
            }
        }
        return merged;
    }
    buildNeuralScoreMap(query, candidates) {
        const map = new Map();
        if (!this.neuralService) {
            return map;
        }
        for (const candidate of candidates) {
            try {
                const score = this.neuralService.compare(query, candidate.text);
                map.set(candidate.id, Math.max(0, Math.min(1, score)));
            }
            catch {
                map.set(candidate.id, 0);
            }
        }
        return map;
    }
    computeKeywordScore(queryTokens, candidateTokens) {
        if (queryTokens.length === 0 ||
            candidateTokens.length === 0) {
            return 0;
        }
        const candidateSet = new Set(candidateTokens);
        let matches = 0;
        for (const token of queryTokens) {
            if (candidateSet.has(token)) {
                matches += 1;
            }
        }
        // Jaccard-like: intersecção / união
        const unionSize = new Set([...queryTokens, ...candidateTokens]).size;
        return unionSize === 0 ? 0 : matches / unionSize;
    }
    computeTfidfScore(query, candidateText) {
        if (!this.tfidfService) {
            return 0;
        }
        try {
            return Math.max(0, Math.min(1, this.tfidfService.compare(query, candidateText)));
        }
        catch {
            return 0;
        }
    }
}
exports.HybridRetrievalService = HybridRetrievalService;
// ─────────────────────────────────────────────────────────────────────────────
// Funções puras auxiliares
// ─────────────────────────────────────────────────────────────────────────────
function tokenize(text) {
    return text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/u)
        .filter((t) => t.length > 1);
}
function computeRecencyScore(createdAt, now, halfLifeMs) {
    if (createdAt <= 0 || halfLifeMs <= 0) {
        return 0;
    }
    const ageMs = Math.max(0, now - createdAt);
    // Decaimento exponencial: score = 2^(-age/halfLife)
    return Math.pow(2, -(ageMs / halfLifeMs));
}
function normalizeImportance(importance) {
    if (importance === undefined || importance === null) {
        return 0.5;
    }
    // Aceita 0–1 ou 0–10, normaliza para 0–1
    if (importance > 1) {
        return Math.max(0, Math.min(1, importance / 10));
    }
    return Math.max(0, Math.min(1, importance));
}
function computeEmotionScore(candidateText, emotionState) {
    const normalized = candidateText
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    let score = 0;
    let totalWeight = 0;
    for (const [emotionName, keywords] of Object.entries(EMOTION_KEYWORDS)) {
        const emotionLevel = emotionState[emotionName] / 100;
        if (emotionLevel <= 0) {
            continue;
        }
        let keywordMatches = 0;
        for (const keyword of keywords) {
            if (normalized.includes(keyword)) {
                keywordMatches += 1;
            }
        }
        if (keywordMatches > 0) {
            // Relevância = frequência de keywords × nível emocional
            const relevance = Math.min(1, keywordMatches / keywords.length) *
                emotionLevel;
            score += relevance;
        }
        totalWeight += emotionLevel;
    }
    if (totalWeight === 0) {
        return 0;
    }
    return Math.min(1, score / totalWeight);
}
function computeWeightedScore(components, weights) {
    return (components.keyword * weights.keyword +
        components.tfidf * weights.tfidf +
        components.neural * weights.neural +
        components.recency * weights.recency +
        components.importance * weights.importance +
        components.emotion * weights.emotion);
}
