"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemanticSimilarityService = void 0;
const tfidfVectorizer_1 = require("./tfidfVectorizer");
class SemanticSimilarityService {
    constructor() {
        this.vectorizer = new tfidfVectorizer_1.TfidfVectorizer();
        this.documents = [];
        this.vectors = [];
    }
    train(documents) {
        if (!Array.isArray(documents)) {
            throw new TypeError("documents deve ser um array.");
        }
        const validDocuments = documents.filter((document) => typeof document?.id === "string" &&
            document.id.trim().length > 0 &&
            typeof document?.text === "string" &&
            document.text.trim().length > 0);
        this.documents = validDocuments.map((document) => ({
            id: document.id,
            text: document.text,
        }));
        this.vectors = this.vectorizer.fitTransform(this.documents.map((document) => document.text));
        return this;
    }
    isTrained() {
        return this.vectorizer.isFitted();
    }
    getDocumentCount() {
        return this.documents.length;
    }
    getVocabularySize() {
        return this.vectorizer.getVocabularySize();
    }
    getVector(text) {
        if (!this.isTrained()) {
            throw new Error("O serviço de similaridade precisa ser treinado antes de gerar vetores.");
        }
        return this.vectorizer.transformOne(text);
    }
    compare(first, second) {
        const firstVector = this.getVector(first);
        const secondVector = this.getVector(second);
        return tfidfVectorizer_1.TfidfVectorizer.cosineSimilarity(firstVector, secondVector);
    }
    findSimilar(text, options = {}) {
        if (!this.isTrained()) {
            throw new Error("O serviço de similaridade precisa ser treinado antes da busca.");
        }
        const minimumScore = Math.max(0, Math.min(1, options.minimumScore ?? 0));
        const topK = Math.max(1, Math.floor(options.topK ?? 5));
        const queryVector = this.getVector(text);
        const results = this.documents
            .map((document, index) => ({
            id: document.id,
            text: document.text,
            score: tfidfVectorizer_1.TfidfVectorizer.cosineSimilarity(queryVector, this.vectors[index]),
        }))
            .filter((result) => result.score >= minimumScore)
            .sort((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score;
            }
            return a.id.localeCompare(b.id);
        });
        return results.slice(0, topK);
    }
    exportModel() {
        if (!this.isTrained()) {
            throw new Error("Não é possível exportar um modelo não treinado.");
        }
        return {
            vectorizer: this.vectorizer.exportModel(),
            documents: this.documents.map((document) => ({ ...document })),
        };
    }
    importModel(model) {
        if (!model || !model.vectorizer || !Array.isArray(model.documents)) {
            throw new TypeError("Modelo de similaridade inválido.");
        }
        this.vectorizer.importModel(model.vectorizer);
        this.documents = model.documents.map((document) => ({
            id: document.id,
            text: document.text,
        }));
        this.vectors = this.vectorizer.transform(this.documents.map((document) => document.text));
        return this;
    }
    reset() {
        this.vectorizer.reset();
        this.documents = [];
        this.vectors = [];
    }
}
exports.SemanticSimilarityService = SemanticSimilarityService;
