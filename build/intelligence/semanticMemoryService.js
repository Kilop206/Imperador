"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemanticMemoryService = void 0;
const semanticSimilarityService_1 = require("./semanticSimilarityService");
class SemanticMemoryService {
    constructor() {
        this.similarityService = new semanticSimilarityService_1.SemanticSimilarityService();
        this.memories = [];
    }
    add(memory) {
        if (!this.isValidMemory(memory)) {
            throw new TypeError("Memória semântica inválida.");
        }
        const existingIndex = this.memories.findIndex((item) => item.id === memory.id);
        const normalizedMemory = {
            id: memory.id,
            text: memory.text.trim(),
            createdAt: memory.createdAt ?? Date.now(),
            metadata: memory.metadata
                ? { ...memory.metadata }
                : undefined,
        };
        if (existingIndex >= 0) {
            this.memories[existingIndex] = normalizedMemory;
        }
        else {
            this.memories.push(normalizedMemory);
        }
        this.rebuild();
    }
    addMany(memories) {
        if (!Array.isArray(memories)) {
            throw new TypeError("memories deve ser um array.");
        }
        for (const memory of memories) {
            if (!this.isValidMemory(memory)) {
                throw new TypeError("Memória semântica inválida.");
            }
        }
        for (const memory of memories) {
            const existingIndex = this.memories.findIndex((item) => item.id === memory.id);
            const normalizedMemory = {
                id: memory.id,
                text: memory.text.trim(),
                createdAt: memory.createdAt ?? Date.now(),
                metadata: memory.metadata
                    ? { ...memory.metadata }
                    : undefined,
            };
            if (existingIndex >= 0) {
                this.memories[existingIndex] = normalizedMemory;
            }
            else {
                this.memories.push(normalizedMemory);
            }
        }
        this.rebuild();
    }
    remove(id) {
        const initialLength = this.memories.length;
        this.memories = this.memories.filter((memory) => memory.id !== id);
        const removed = this.memories.length !== initialLength;
        if (removed) {
            this.rebuild();
        }
        return removed;
    }
    search(text, options = {}) {
        if (!this.similarityService.isTrained()) {
            return [];
        }
        const results = this.similarityService.findSimilar(text, {
            minimumScore: options.minimumScore ?? 0,
            topK: options.topK ?? 5,
        });
        const semanticResults = [];
        for (const result of results) {
            const memory = this.memories.find((item) => item.id === result.id);
            if (!memory) {
                continue;
            }
            semanticResults.push({
                id: result.id,
                text: result.text,
                score: result.score,
                memory: {
                    id: memory.id,
                    text: memory.text,
                    createdAt: memory.createdAt,
                    metadata: memory.metadata
                        ? { ...memory.metadata }
                        : undefined,
                },
            });
        }
        return semanticResults;
    }
    findBest(text, minimumScore = 0) {
        const results = this.search(text, {
            minimumScore,
            topK: 1,
        });
        return results[0] ?? null;
    }
    getMemories() {
        return this.memories.map((memory) => ({
            id: memory.id,
            text: memory.text,
            createdAt: memory.createdAt,
            metadata: memory.metadata
                ? { ...memory.metadata }
                : undefined,
        }));
    }
    getMemoryCount() {
        return this.memories.length;
    }
    isTrained() {
        return this.similarityService.isTrained();
    }
    getVocabularySize() {
        return this.similarityService.getVocabularySize();
    }
    exportModel() {
        return {
            memories: this.getMemories(),
            semanticModel: this.isTrained()
                ? this.similarityService.exportModel()
                : null,
        };
    }
    importModel(model) {
        if (!model ||
            !Array.isArray(model.memories)) {
            throw new TypeError("Modelo de memória semântica inválido.");
        }
        for (const memory of model.memories) {
            if (!this.isValidMemory(memory)) {
                throw new TypeError("Modelo contém memória semântica inválida.");
            }
        }
        this.memories = model.memories.map((memory) => ({
            id: memory.id,
            text: memory.text,
            createdAt: memory.createdAt,
            metadata: memory.metadata
                ? { ...memory.metadata }
                : undefined,
        }));
        if (model.semanticModel) {
            this.similarityService.importModel(model.semanticModel);
        }
        else {
            this.rebuild();
        }
        return this;
    }
    clear() {
        this.memories = [];
        this.similarityService.reset();
    }
    rebuild() {
        if (this.memories.length === 0) {
            this.similarityService.reset();
            return;
        }
        this.similarityService.train(this.memories.map((memory) => ({
            id: memory.id,
            text: memory.text,
        })));
    }
    isValidMemory(memory) {
        return (typeof memory?.id === "string" &&
            memory.id.trim().length > 0 &&
            typeof memory?.text === "string" &&
            memory.text.trim().length > 0);
    }
}
exports.SemanticMemoryService = SemanticMemoryService;
