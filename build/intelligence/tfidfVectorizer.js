"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TfidfVectorizer = void 0;
function normalizeText(text, lowercase) {
    let normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (lowercase) {
        normalized = normalized.toLowerCase();
    }
    return normalized
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}
function tokenize(text, lowercase) {
    const normalized = normalizeText(text, lowercase);
    if (!normalized) {
        return [];
    }
    return normalized.split(" ");
}
class TfidfVectorizer {
    constructor(options = {}) {
        this.vocabulary = [];
        this.vocabularyIndex = new Map();
        this.documentFrequency = new Map();
        this.documentCount = 0;
        this.fitted = false;
        this.minDocumentFrequency = Math.max(1, Math.floor(options.minDocumentFrequency ?? 1));
        this.maxDocumentFrequency = Math.max(1, Math.floor(options.maxDocumentFrequency ?? Number.MAX_SAFE_INTEGER));
        this.lowercase = options.lowercase ?? true;
    }
    fit(documents) {
        if (!Array.isArray(documents)) {
            throw new TypeError("documents deve ser um array.");
        }
        this.reset();
        const safeDocuments = documents.filter((document) => typeof document === "string" && document.trim().length > 0);
        this.documentCount = safeDocuments.length;
        const frequencies = new Map();
        for (const document of safeDocuments) {
            const uniqueTokens = new Set(tokenize(document, this.lowercase));
            for (const token of uniqueTokens) {
                frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
            }
        }
        const selectedTerms = [...frequencies.entries()]
            .filter(([, frequency]) => frequency >= this.minDocumentFrequency &&
            frequency <= Math.min(this.maxDocumentFrequency, this.documentCount))
            .sort(([a], [b]) => a.localeCompare(b));
        this.vocabulary = selectedTerms.map(([token]) => token);
        this.vocabulary.forEach((token, index) => {
            this.vocabularyIndex.set(token, index);
        });
        for (const [token, frequency] of selectedTerms) {
            this.documentFrequency.set(token, frequency);
        }
        this.fitted = true;
        return this;
    }
    transform(documents) {
        this.ensureFitted();
        if (!Array.isArray(documents)) {
            throw new TypeError("documents deve ser um array.");
        }
        return documents.map((document) => this.transformOne(document));
    }
    transformOne(document) {
        this.ensureFitted();
        if (typeof document !== "string") {
            throw new TypeError("document deve ser uma string.");
        }
        const tokens = tokenize(document, this.lowercase);
        const vector = new Array(this.vocabulary.length).fill(0);
        if (tokens.length === 0 || this.vocabulary.length === 0) {
            return vector;
        }
        const termFrequency = new Map();
        for (const token of tokens) {
            if (this.vocabularyIndex.has(token)) {
                termFrequency.set(token, (termFrequency.get(token) ?? 0) + 1);
            }
        }
        for (const [token, count] of termFrequency) {
            const index = this.vocabularyIndex.get(token);
            if (index === undefined) {
                continue;
            }
            const tf = count / tokens.length;
            const df = this.documentFrequency.get(token) ?? 0;
            const idf = Math.log((1 + this.documentCount) / (1 + df)) + 1;
            vector[index] = tf * idf;
        }
        return this.normalizeVector(vector);
    }
    fitTransform(documents) {
        this.fit(documents);
        return this.transform(documents);
    }
    getVocabulary() {
        return [...this.vocabulary];
    }
    getVocabularySize() {
        return this.vocabulary.length;
    }
    getDocumentCount() {
        return this.documentCount;
    }
    isFitted() {
        return this.fitted;
    }
    exportModel() {
        this.ensureFitted();
        return {
            vocabulary: [...this.vocabulary],
            documentFrequency: Object.fromEntries(this.documentFrequency),
            documentCount: this.documentCount,
            minDocumentFrequency: this.minDocumentFrequency,
            maxDocumentFrequency: this.maxDocumentFrequency,
        };
    }
    importModel(model) {
        if (!model ||
            !Array.isArray(model.vocabulary) ||
            typeof model.documentFrequency !== "object" ||
            typeof model.documentCount !== "number") {
            throw new TypeError("Modelo TF-IDF inválido.");
        }
        this.reset();
        this.vocabulary = [...model.vocabulary];
        this.vocabularyIndex = new Map(this.vocabulary.map((token, index) => [token, index]));
        this.documentFrequency = new Map(Object.entries(model.documentFrequency));
        this.documentCount = model.documentCount;
        this.fitted = true;
        return this;
    }
    reset() {
        this.vocabulary = [];
        this.vocabularyIndex.clear();
        this.documentFrequency.clear();
        this.documentCount = 0;
        this.fitted = false;
    }
    static cosineSimilarity(first, second) {
        if (first.length !== second.length) {
            throw new Error("Os vetores precisam possuir a mesma dimensão.");
        }
        let dotProduct = 0;
        let firstMagnitude = 0;
        let secondMagnitude = 0;
        for (let index = 0; index < first.length; index += 1) {
            dotProduct += first[index] * second[index];
            firstMagnitude += first[index] ** 2;
            secondMagnitude += second[index] ** 2;
        }
        if (firstMagnitude === 0 || secondMagnitude === 0) {
            return 0;
        }
        return (dotProduct /
            (Math.sqrt(firstMagnitude) * Math.sqrt(secondMagnitude)));
    }
    normalizeVector(vector) {
        let magnitude = 0;
        for (const value of vector) {
            magnitude += value ** 2;
        }
        magnitude = Math.sqrt(magnitude);
        if (magnitude === 0) {
            return vector;
        }
        return vector.map((value) => value / magnitude);
    }
    ensureFitted() {
        if (!this.fitted) {
            throw new Error("O vetorizador precisa ser treinado com fit() antes de ser utilizado.");
        }
    }
}
exports.TfidfVectorizer = TfidfVectorizer;
