"use strict";
/**
 * 13.19 -- Integração semântica com o ResponseEngine
 *
 * SemanticContextService integra o HybridRetrievalService
 * com as memórias de conversa do Tibério.
 *
 * O serviço continua opcional, mas agora possui um gate conservador:
 * uma memória semântica precisa apresentar evidência lexical ou TF-IDF
 * antes de poder virar contexto de resposta.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemanticContextService = void 0;
const hybridRetrievalService_1 = require("./hybridRetrievalService");
/**
 * Gate mínimo para permitir uma memória semântica em uma resposta.
 *
 * A similaridade neural isolada é considerada insuficiente porque
 * embeddings podem aproximar frases semanticamente vagas.
 */
const MIN_KEYWORD_SIGNAL = 0.08;
const MIN_TFIDF_SIGNAL = 0.15;
class SemanticContextService {
    constructor() {
        this.configured = false;
        this.retrieval =
            new hybridRetrievalService_1.HybridRetrievalService();
    }
    // ─── Configuração opcional ──────────────────────────────────────────────────
    /**
     * Configura o serviço de similaridade TF-IDF.
     */
    setTfidfService(service) {
        this.retrieval.setTfidfService(service);
        this.configured =
            true;
    }
    /**
     * Configura o serviço neural.
     */
    setNeuralService(service) {
        this.retrieval.setNeuralService(service);
        this.configured =
            true;
    }
    /**
     * Marca o serviço como configurado sem depender
     * obrigatoriamente de TF-IDF ou neural.
     */
    enable() {
        this.configured =
            true;
    }
    isConfigured() {
        return this.configured;
    }
    // ─── Recuperação de contexto ────────────────────────────────────────────────
    /**
     * Recupera contexto semântico para uma mensagem.
     *
     * Uma memória só pode ser utilizada quando:
     *
     * - existe um score híbrido mínimo; e
     * - existe evidência lexical ou TF-IDF suficiente.
     *
     * O componente neural continua participando do ranking,
     * mas não pode sozinho transformar qualquer mensagem vaga
     * em uma lembrança.
     */
    buildContext(query, memories, emotionState, options = {}) {
        const empty = {
            memories: [],
            best: null,
            contextSummary: '',
            isActive: false,
        };
        if (!this.configured ||
            !query.trim() ||
            memories.length === 0) {
            return empty;
        }
        const candidates = this.convertMemories(memories);
        const results = this.retrieval.retrieve(query, candidates, emotionState, {
            topK: options.topK ??
                3,
            minimumScore: options.minimumScore ??
                0.10,
            weights: options.weights,
            recencyHalfLifeMs: options.recencyHalfLifeMs,
        });
        if (results.length === 0) {
            return empty;
        }
        const gatedResults = results.filter(result => this.hasSemanticEvidence(result));
        if (gatedResults.length === 0) {
            return empty;
        }
        const best = gatedResults[0];
        const contextSummary = this.buildContextSummary(gatedResults);
        return {
            memories: gatedResults,
            best,
            contextSummary,
            isActive: true,
        };
    }
    /**
     * Formata um SemanticContext como texto.
     */
    formatContext(context, maxItems = 3) {
        if (!context.isActive) {
            return '';
        }
        const lines = [];
        const items = context.memories.slice(0, maxItems);
        for (const result of items) {
            lines.push(`[score=${result.score.final.toFixed(3)}] ${result.text}`);
        }
        return lines.join('\n');
    }
    // ─── Privado ────────────────────────────────────────────────────────────────
    convertMemories(memories) {
        return memories.map(memory => ({
            id: String(memory.id),
            text: `${memory.topic}: ${memory.summary}`,
            createdAt: memory.createdAt,
            importance: normalizeImportance(memory.importance),
            metadata: {
                topic: memory.topic,
                userId: memory.userId,
            },
        }));
    }
    /**
     * Garante que a memória tenha algum sinal textual real.
     *
     * Neural similarity continua válida para ranking,
     * mas não é suficiente para ativar contexto.
     */
    hasSemanticEvidence(result) {
        const { keyword, tfidf, } = result.score.components;
        return (keyword >=
            MIN_KEYWORD_SIGNAL ||
            tfidf >=
                MIN_TFIDF_SIGNAL);
    }
    buildContextSummary(results) {
        if (results.length === 0) {
            return '';
        }
        const best = results[0];
        const topic = best.memory.metadata
            ?.topic ?? '';
        if (topic) {
            return (`Tópico lembrado: ${topic}. ${best.text}`);
        }
        return best.text;
    }
}
exports.SemanticContextService = SemanticContextService;
// ─────────────────────────────────────────────────────────────────────────────
// Utilitários
// ─────────────────────────────────────────────────────────────────────────────
function normalizeImportance(importance) {
    if (importance <= 0) {
        return 0;
    }
    if (importance >= 5) {
        return 1;
    }
    return (importance - 1) / 4;
}
