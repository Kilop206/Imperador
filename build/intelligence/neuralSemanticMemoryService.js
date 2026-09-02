"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NeuralSemanticMemoryService = void 0;
const semanticSentenceModel_1 = require("./semanticSentenceModel");
// ─────────────────────────────────────────────────────────────────────────────
// Serviço
// ─────────────────────────────────────────────────────────────────────────────
/**
 * NeuralSemanticMemoryService
 *
 * Armazena memórias do Tibério e as busca por similaridade semântica usando
 * embeddings neurais de sentença (SemanticSentenceModel + WordEmbeddingModel).
 *
 * Diferença em relação ao SemanticMemoryService existente (TF-IDF):
 * - A representação é neural (projeção treinada), não bag-of-words.
 * - Requer que um WordEmbeddingModel e um SemanticSentenceModel já estejam
 *   treinados antes de adicionar ou buscar memórias.
 * - O modelo pode ser trocado (ex: após fine-tuning via 13.16) sem perder
 *   as memórias — basta chamar rebuildEmbeddings().
 *
 * A API espelha SemanticMemoryService para facilitar a substituição gradual.
 */
class NeuralSemanticMemoryService {
    constructor() {
        this.wordModel = null;
        this.sentenceModel = null;
        this.memories = [];
        this.embeddings = [];
    }
    // ─── Configuração do modelo ────────────────────────────────────────────────
    /**
     * Define os modelos que serão usados para codificação.
     * Deve ser chamado antes de add() ou search().
     * Ao trocar os modelos (ex: fine-tuning), chame rebuildEmbeddings().
     */
    setModels(wordModel, sentenceModel) {
        if (!wordModel.isTrained()) {
            throw new Error("WordEmbeddingModel precisa estar treinado.");
        }
        if (!sentenceModel.isTrained()) {
            throw new Error("SemanticSentenceModel precisa estar treinado.");
        }
        this.wordModel = wordModel;
        this.sentenceModel = sentenceModel;
    }
    /**
     * Carrega os modelos diretamente de um SemanticModelRegistry,
     * usando a versão ativa. Lança erro se não houver versão ativa.
     */
    setModelsFromRegistry(wordModel, registry) {
        const active = registry.getActive();
        if (!active) {
            throw new Error("Nenhuma versão ativa no registry.");
        }
        const restored = registry.restoreModel(active.version);
        if (!restored) {
            throw new Error("Não foi possível restaurar o modelo ativo do registry.");
        }
        this.setModels(wordModel, restored);
    }
    isReady() {
        return (this.wordModel !== null &&
            this.sentenceModel !== null);
    }
    // ─── Gerenciamento de memórias ─────────────────────────────────────────────
    /**
     * Adiciona ou substitui uma memória.
     * Recalcula o embedding imediatamente se os modelos estiverem disponíveis.
     */
    add(memory) {
        this.validateMemory(memory);
        const normalized = this.normalizeMemory(memory);
        const existingIndex = this.memories.findIndex((m) => m.id === memory.id);
        if (existingIndex >= 0) {
            this.memories[existingIndex] = normalized;
            this.embeddings[existingIndex] =
                this.encodeOrZero(normalized.text);
        }
        else {
            this.memories.push(normalized);
            this.embeddings.push(this.encodeOrZero(normalized.text));
        }
    }
    /**
     * Adiciona várias memórias de uma vez.
     * Valida todas antes de inserir qualquer uma.
     */
    addMany(memories) {
        if (!Array.isArray(memories)) {
            throw new TypeError("memories deve ser um array.");
        }
        for (const memory of memories) {
            this.validateMemory(memory);
        }
        for (const memory of memories) {
            this.add(memory);
        }
    }
    /**
     * Remove uma memória pelo id.
     * Retorna true se removida, false se não encontrada.
     */
    remove(id) {
        const index = this.memories.findIndex((m) => m.id === id);
        if (index < 0) {
            return false;
        }
        this.memories.splice(index, 1);
        this.embeddings.splice(index, 1);
        return true;
    }
    /**
     * Remove todas as memórias e embeddings.
     * Não afeta os modelos configurados.
     */
    clear() {
        this.memories = [];
        this.embeddings = [];
    }
    // ─── Busca neural ──────────────────────────────────────────────────────────
    /**
     * Busca memórias por similaridade semântica neural.
     * Retorna lista vazia se os modelos não estiverem prontos.
     */
    search(text, options = {}) {
        if (!this.isReady() || this.memories.length === 0) {
            return [];
        }
        const minimumScore = Math.max(0, Math.min(1, options.minimumScore ?? 0));
        const topK = Math.max(1, Math.floor(options.topK ?? 5));
        const queryEmbedding = this.encodeOrZero(text);
        if (isZeroVector(queryEmbedding)) {
            return [];
        }
        const results = [];
        for (let index = 0; index < this.memories.length; index += 1) {
            const embedding = this.embeddings[index];
            if (isZeroVector(embedding)) {
                continue;
            }
            const score = semanticSentenceModel_1.SemanticSentenceModel.cosineSimilarity(queryEmbedding, embedding);
            if (score >= minimumScore) {
                results.push({
                    id: this.memories[index].id,
                    text: this.memories[index].text,
                    score,
                    memory: { ...this.memories[index] },
                });
            }
        }
        return results
            .sort((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score;
            }
            return a.id.localeCompare(b.id);
        })
            .slice(0, topK);
    }
    /**
     * Retorna a memória com maior similaridade semântica.
     * Retorna null se nenhuma estiver acima do minimumScore.
     */
    findBest(text, minimumScore = 0) {
        const results = this.search(text, {
            minimumScore,
            topK: 1,
        });
        return results[0] ?? null;
    }
    // ─── Rebuild ───────────────────────────────────────────────────────────────
    /**
     * Recalcula todos os embeddings usando os modelos atuais.
     * Deve ser chamado após setModels() quando já há memórias armazenadas,
     * ou após um fine-tuning que trouxe um modelo melhor.
     */
    rebuildEmbeddings() {
        this.embeddings = this.memories.map((memory) => this.encodeOrZero(memory.text));
    }
    // ─── Acesso a dados ────────────────────────────────────────────────────────
    getMemories() {
        return this.memories.map((m) => ({
            id: m.id,
            text: m.text,
            createdAt: m.createdAt,
            metadata: m.metadata ? { ...m.metadata } : undefined,
        }));
    }
    getMemoryCount() {
        return this.memories.length;
    }
    // ─── Export / Import ───────────────────────────────────────────────────────
    /**
     * Exporta memórias e embeddings para persistência.
     * Os modelos em si não são exportados — apenas os embeddings gerados por eles.
     * Ao importar, chamar setModels() com os mesmos modelos antes da busca.
     */
    exportSnapshot() {
        return {
            memories: this.getMemories(),
            embeddings: this.embeddings.map((e) => [...e]),
        };
    }
    /**
     * Importa memórias e embeddings de um snapshot.
     * Os embeddings são restaurados sem recálculo — use rebuildEmbeddings()
     * se quiser recalcular com um modelo atualizado.
     */
    importSnapshot(snapshot) {
        if (!snapshot ||
            !Array.isArray(snapshot.memories) ||
            !Array.isArray(snapshot.embeddings)) {
            throw new TypeError("Snapshot de memória neural inválido.");
        }
        if (snapshot.memories.length !==
            snapshot.embeddings.length) {
            throw new Error("Memórias e embeddings com tamanhos incompatíveis.");
        }
        for (const memory of snapshot.memories) {
            this.validateMemory(memory);
        }
        for (const embedding of snapshot.embeddings) {
            if (!Array.isArray(embedding)) {
                throw new TypeError("Embedding inválido no snapshot.");
            }
        }
        this.memories = snapshot.memories.map((m) => this.normalizeMemory(m));
        this.embeddings = snapshot.embeddings.map((e) => [...e]);
        return this;
    }
    // ─── Comparação direta ─────────────────────────────────────────────────────
    /**
     * Compara dois textos diretamente usando os modelos neurais.
     * Lança erro se os modelos não estiverem prontos.
     */
    compare(first, second) {
        this.ensureReady();
        return this.sentenceModel.similarity(this.wordModel, first, second);
    }
    // ─── Privado ───────────────────────────────────────────────────────────────
    encodeOrZero(text) {
        if (!this.isReady()) {
            return [];
        }
        return this.sentenceModel.encode(this.wordModel, text);
    }
    validateMemory(memory) {
        if (typeof memory?.id !== "string" ||
            memory.id.trim().length === 0) {
            throw new TypeError("Memória neural inválida: id ausente ou vazio.");
        }
        if (typeof memory?.text !== "string" ||
            memory.text.trim().length === 0) {
            throw new TypeError("Memória neural inválida: text ausente ou vazio.");
        }
    }
    normalizeMemory(memory) {
        return {
            id: memory.id,
            text: memory.text.trim(),
            createdAt: memory.createdAt ?? Date.now(),
            metadata: memory.metadata
                ? { ...memory.metadata }
                : undefined,
        };
    }
    ensureReady() {
        if (!this.isReady()) {
            throw new Error("Modelos não configurados. Chame setModels() antes de usar o serviço.");
        }
    }
}
exports.NeuralSemanticMemoryService = NeuralSemanticMemoryService;
// ─────────────────────────────────────────────────────────────────────────────
// Utilitários internos
// ─────────────────────────────────────────────────────────────────────────────
function isZeroVector(vector) {
    if (vector.length === 0) {
        return true;
    }
    return vector.every((v) => v === 0);
}
