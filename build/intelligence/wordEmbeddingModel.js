"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WordEmbeddingModel = void 0;
function normalizeText(text) {
    return text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}
function tokenize(text) {
    const normalized = normalizeText(text);
    if (!normalized) {
        return [];
    }
    return normalized.split(" ");
}
class SeededRandom {
    constructor(seed) {
        this.state = seed >>> 0;
    }
    next() {
        this.state =
            (this.state * 1664525 + 1013904223) >>> 0;
        return this.state / 4294967296;
    }
    nextSigned() {
        return this.next() * 2 - 1;
    }
    nextInt(maxExclusive) {
        if (maxExclusive <= 0) {
            return 0;
        }
        return Math.floor(this.next() * maxExclusive);
    }
}
class WordEmbeddingModel {
    constructor(options = {}) {
        this.vocabulary = [];
        this.vocabularyIndex = new Map();
        this.inputEmbeddings = [];
        this.outputEmbeddings = [];
        this.frequencies = [];
        this.trained = false;
        this.dimension = Math.max(2, Math.floor(options.dimension ?? 32));
        this.windowSize = Math.max(1, Math.floor(options.windowSize ?? 2));
        this.negativeSamples = Math.max(1, Math.floor(options.negativeSamples ?? 4));
        this.learningRate = Math.max(0.00001, options.learningRate ?? 0.025);
        this.epochs = Math.max(1, Math.floor(options.epochs ?? 20));
        this.minCount = Math.max(1, Math.floor(options.minCount ?? 1));
        this.seed = Math.floor(options.seed ?? 42);
    }
    train(documents) {
        if (!Array.isArray(documents)) {
            throw new TypeError("documents deve ser um array.");
        }
        const corpus = documents
            .filter((document) => typeof document === "string" &&
            document.trim().length > 0)
            .map(tokenize)
            .filter((tokens) => tokens.length > 0);
        this.reset();
        if (corpus.length === 0) {
            throw new Error("Não existem documentos válidos para treinar.");
        }
        const tokenCounts = new Map();
        for (const sentence of corpus) {
            for (const token of sentence) {
                tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
            }
        }
        const vocabularyEntries = [
            ...tokenCounts.entries(),
        ]
            .filter(([, count]) => count >= this.minCount)
            .sort(([wordA, countA], [wordB, countB]) => {
            if (countB !== countA) {
                return countB - countA;
            }
            return wordA.localeCompare(wordB);
        });
        this.vocabulary =
            vocabularyEntries.map(([word]) => word);
        this.frequencies =
            vocabularyEntries.map(([, count]) => count);
        for (let index = 0; index < this.vocabulary.length; index += 1) {
            this.vocabularyIndex.set(this.vocabulary[index], index);
        }
        this.initializeEmbeddings();
        const pairs = this.buildTrainingPairs(corpus);
        if (pairs.length === 0) {
            throw new Error("Não existem pares suficientes para treinar os embeddings.");
        }
        const random = new SeededRandom(this.seed);
        let finalLoss = 0;
        for (let epoch = 0; epoch < this.epochs; epoch += 1) {
            let epochLoss = 0;
            for (const pair of pairs) {
                epochLoss += this.trainPair(pair.target, pair.context, true);
                for (let negative = 0; negative < this.negativeSamples; negative += 1) {
                    const negativeIndex = this.sampleNegative(random);
                    if (negativeIndex === pair.context) {
                        continue;
                    }
                    epochLoss += this.trainPair(pair.target, negativeIndex, false);
                }
            }
            finalLoss =
                epochLoss /
                    Math.max(1, pairs.length *
                        (1 + this.negativeSamples));
        }
        this.trained = true;
        return {
            vocabularySize: this.vocabulary.length,
            trainingPairs: pairs.length,
            epochs: this.epochs,
            finalLoss,
        };
    }
    encodeWord(word) {
        this.ensureTrained();
        const normalized = normalizeText(word);
        const index = this.vocabularyIndex.get(normalized);
        if (index === undefined) {
            return null;
        }
        return this.normalizeVector(this.inputEmbeddings[index]);
    }
    encodeText(text) {
        this.ensureTrained();
        const tokens = tokenize(text);
        const vectors = [];
        for (const token of tokens) {
            const vector = this.encodeWord(token);
            if (vector) {
                vectors.push(vector);
            }
        }
        if (vectors.length === 0) {
            return new Array(this.dimension).fill(0);
        }
        const result = new Array(this.dimension).fill(0);
        for (const vector of vectors) {
            for (let index = 0; index < this.dimension; index += 1) {
                result[index] += vector[index];
            }
        }
        for (let index = 0; index < this.dimension; index += 1) {
            result[index] /= vectors.length;
        }
        return this.normalizeVector(result);
    }
    similarity(first, second) {
        const firstVector = this.encodeText(first);
        const secondVector = this.encodeText(second);
        return WordEmbeddingModel.cosineSimilarity(firstVector, secondVector);
    }
    mostSimilar(word, topK = 5) {
        this.ensureTrained();
        const normalized = normalizeText(word);
        const targetIndex = this.vocabularyIndex.get(normalized);
        if (targetIndex === undefined) {
            return [];
        }
        const targetVector = this.normalizeVector(this.inputEmbeddings[targetIndex]);
        return this.vocabulary
            .map((candidate, index) => ({
            word: candidate,
            score: index === targetIndex
                ? -1
                : WordEmbeddingModel.cosineSimilarity(targetVector, this.normalizeVector(this.inputEmbeddings[index])),
        }))
            .sort((a, b) => b.score - a.score)
            .slice(0, Math.max(1, topK));
    }
    getVocabulary() {
        return [...this.vocabulary];
    }
    getVocabularySize() {
        return this.vocabulary.length;
    }
    getDimension() {
        return this.dimension;
    }
    isTrained() {
        return this.trained;
    }
    exportModel() {
        this.ensureTrained();
        return {
            vocabulary: [...this.vocabulary],
            embeddings: this.inputEmbeddings.map((vector) => [...vector]),
            dimension: this.dimension,
            windowSize: this.windowSize,
            negativeSamples: this.negativeSamples,
            learningRate: this.learningRate,
            epochs: this.epochs,
            minCount: this.minCount,
        };
    }
    importModel(model) {
        if (!model ||
            !Array.isArray(model.vocabulary) ||
            !Array.isArray(model.embeddings) ||
            typeof model.dimension !== "number") {
            throw new TypeError("Modelo de embeddings inválido.");
        }
        if (model.dimension !== this.dimension) {
            throw new Error("A dimensão do modelo não corresponde à dimensão configurada.");
        }
        if (model.vocabulary.length !==
            model.embeddings.length) {
            throw new Error("Vocabulário e embeddings possuem tamanhos diferentes.");
        }
        this.reset();
        this.vocabulary = [
            ...model.vocabulary,
        ];
        this.inputEmbeddings =
            model.embeddings.map((vector) => [...vector]);
        for (let index = 0; index < this.vocabulary.length; index += 1) {
            this.vocabularyIndex.set(this.vocabulary[index], index);
        }
        this.frequencies =
            new Array(this.vocabulary.length).fill(1);
        this.outputEmbeddings =
            new Array(this.vocabulary.length)
                .fill(null)
                .map(() => new Array(this.dimension).fill(0));
        this.trained = true;
        return this;
    }
    reset() {
        this.vocabulary = [];
        this.vocabularyIndex.clear();
        this.inputEmbeddings = [];
        this.outputEmbeddings = [];
        this.frequencies = [];
        this.trained = false;
    }
    static cosineSimilarity(first, second) {
        if (first.length !== second.length) {
            throw new Error("Os vetores precisam possuir a mesma dimensão.");
        }
        let dotProduct = 0;
        let firstMagnitude = 0;
        let secondMagnitude = 0;
        for (let index = 0; index < first.length; index += 1) {
            dotProduct +=
                first[index] * second[index];
            firstMagnitude +=
                first[index] ** 2;
            secondMagnitude +=
                second[index] ** 2;
        }
        if (firstMagnitude === 0 ||
            secondMagnitude === 0) {
            return 0;
        }
        return (dotProduct /
            (Math.sqrt(firstMagnitude) *
                Math.sqrt(secondMagnitude)));
    }
    initializeEmbeddings() {
        const random = new SeededRandom(this.seed);
        const scale = 1 / Math.sqrt(this.dimension);
        this.inputEmbeddings =
            new Array(this.vocabulary.length)
                .fill(null)
                .map(() => new Array(this.dimension)
                .fill(0)
                .map(() => random.nextSigned() *
                scale));
        this.outputEmbeddings =
            new Array(this.vocabulary.length)
                .fill(null)
                .map(() => new Array(this.dimension).fill(0));
    }
    buildTrainingPairs(corpus) {
        const pairs = [];
        for (const sentence of corpus) {
            const indices = sentence
                .map((token) => this.vocabularyIndex.get(token))
                .filter((index) => index !== undefined);
            for (let center = 0; center < indices.length; center += 1) {
                const start = Math.max(0, center - this.windowSize);
                const end = Math.min(indices.length, center + this.windowSize + 1);
                for (let context = start; context < end; context += 1) {
                    if (context === center) {
                        continue;
                    }
                    pairs.push({
                        target: indices[center],
                        context: indices[context],
                    });
                }
            }
        }
        return pairs;
    }
    sampleNegative(random) {
        if (this.vocabulary.length === 0) {
            return 0;
        }
        let totalWeight = 0;
        for (const frequency of this.frequencies) {
            totalWeight +=
                Math.pow(frequency, 0.75);
        }
        if (totalWeight <= 0) {
            return random.nextInt(this.vocabulary.length);
        }
        let randomValue = random.next() * totalWeight;
        for (let index = 0; index < this.frequencies.length; index += 1) {
            randomValue -= Math.pow(this.frequencies[index], 0.75);
            if (randomValue <= 0) {
                return index;
            }
        }
        return this.frequencies.length - 1;
    }
    trainPair(targetIndex, contextIndex, positive) {
        const target = this.inputEmbeddings[targetIndex];
        const context = this.outputEmbeddings[contextIndex];
        let dotProduct = 0;
        for (let index = 0; index < this.dimension; index += 1) {
            dotProduct +=
                target[index] *
                    context[index];
        }
        const clippedDot = Math.max(-20, Math.min(20, dotProduct));
        const sigmoid = 1 / (1 + Math.exp(-clippedDot));
        const label = positive ? 1 : 0;
        const error = label - sigmoid;
        const targetGradient = new Array(this.dimension);
        const contextGradient = new Array(this.dimension);
        for (let index = 0; index < this.dimension; index += 1) {
            targetGradient[index] =
                error * context[index];
            contextGradient[index] =
                error * target[index];
        }
        for (let index = 0; index < this.dimension; index += 1) {
            target[index] +=
                this.learningRate *
                    targetGradient[index];
            context[index] +=
                this.learningRate *
                    contextGradient[index];
        }
        const safeProbability = positive
            ? Math.max(sigmoid, 1e-12)
            : Math.max(1 - sigmoid, 1e-12);
        return -Math.log(safeProbability);
    }
    normalizeVector(vector) {
        let magnitude = 0;
        for (const value of vector) {
            magnitude += value ** 2;
        }
        magnitude = Math.sqrt(magnitude);
        if (magnitude === 0) {
            return [...vector];
        }
        return vector.map((value) => value / magnitude);
    }
    ensureTrained() {
        if (!this.trained) {
            throw new Error("O modelo de embeddings ainda não foi treinado.");
        }
    }
}
exports.WordEmbeddingModel = WordEmbeddingModel;
