"use strict";
/**
 * 13.19 -- Integração semântica com o ResponseEngine
 *
 * SemanticContextService é uma façade que integra o HybridRetrievalService
 * com as memórias de conversa do Tibério.
 *
 * Princípio de integração gradual:
 * - O serviço é OPCIONAL. Quando não configurado, não quebra nada.
 * - O ResponseEngine consulta este serviço de forma não-bloqueante.
 * - As respostas determinísticas existentes são preservadas integralmente.
 * - Apenas adiciona candidatos extras com contexto semântico.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemanticContextService = void 0;
const hybridRetrievalService_1 = require("./hybridRetrievalService");
// ─────────────────────────────────────────────────────────────────────────────
// Serviço
// ─────────────────────────────────────────────────────────────────────────────
class SemanticContextService {
    constructor() {
        this.configured = false;
        this.retrieval = new hybridRetrievalService_1.HybridRetrievalService();
    }
    // ─── Configuração opcional ─────────────────────────────────────────────────
    /**
     * Configura o serviço TF-IDF para o componente léxico-estatístico.
     * Opcional — sem ele o componente tfidf permanece em 0.
     */
    setTfidfService(service) {
        this.retrieval.setTfidfService(service);
        this.configured = true;
    }
    /**
     * Configura o serviço neural para o componente de embedding.
     * Opcional — sem ele o componente neural permanece em 0.
     */
    setNeuralService(service) {
        this.retrieval.setNeuralService(service);
        this.configured = true;
    }
    /**
     * Marca o serviço como configurado mesmo sem TF-IDF nem neural,
     * para usar apenas keyword + recência + importância + emoção.
     */
    enable() {
        this.configured = true;
    }
    isConfigured() {
        return this.configured;
    }
    // ─── Recuperação de contexto ───────────────────────────────────────────────
    /**
     * Dado uma mensagem do usuário e um conjunto de memórias de conversa,
     * recupera as mais relevantes usando o ranking híbrido.
     *
     * Retorna um SemanticContext com `isActive = false` se o serviço
     * não estiver configurado ou se não houver memórias.
     */
    buildContext(query, memories, emotionState, options = {}) {
        const empty = {
            memories: [],
            best: null,
            contextSummary: "",
            isActive: false,
        };
        if (!this.configured ||
            !query.trim() ||
            memories.length === 0) {
            return empty;
        }
        const candidates = this.convertMemories(memories);
        const results = this.retrieval.retrieve(query, candidates, emotionState, {
            topK: options.topK ?? 3,
            minimumScore: options.minimumScore ?? 0.05,
            weights: options.weights,
            recencyHalfLifeMs: options.recencyHalfLifeMs,
        });
        if (results.length === 0) {
            return empty;
        }
        const best = results[0];
        const contextSummary = this.buildContextSummary(results);
        return {
            memories: results,
            best,
            contextSummary,
            isActive: true,
        };
    }
    /**
     * Formata um SemanticContext como texto para uso em prompts ou logs.
     */
    formatContext(context, maxItems = 3) {
        if (!context.isActive) {
            return "";
        }
        const lines = [];
        const items = context.memories.slice(0, maxItems);
        for (const result of items) {
            lines.push(`[score=${result.score.final.toFixed(3)}] ${result.text}`);
        }
        return lines.join("\n");
    }
    // ─── Privado ───────────────────────────────────────────────────────────────
    convertMemories(memories) {
        return memories.map((memory) => ({
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
    buildContextSummary(results) {
        if (results.length === 0) {
            return "";
        }
        const best = results[0];
        const topic = best.memory.metadata?.topic ?? "";
        if (topic) {
            return `Tópico lembrado: ${topic}. ${best.text}`;
        }
        return best.text;
    }
}
exports.SemanticContextService = SemanticContextService;
// ─────────────────────────────────────────────────────────────────────────────
// Utilitários internos
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Normaliza importance de ConversationMemory (geralmente 1–5) para 0–1.
 * O HybridRetrievalService aceita 0–1 ou 0–10 automaticamente,
 * mas aqui fazemos a conversão explícita para o domínio 1–5.
 */
function normalizeImportance(importance) {
    // ConversationMemory.importance é 1–5 (confirmado no memoryService)
    if (importance <= 0) {
        return 0;
    }
    if (importance >= 5) {
        return 1;
    }
    return (importance - 1) / 4;
}
