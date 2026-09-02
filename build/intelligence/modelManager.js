"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModelManager = void 0;
const wordEmbeddingModel_1 = require("./wordEmbeddingModel");
const semanticSentenceModel_1 = require("./semanticSentenceModel");
const semanticSimilarityService_1 = require("./semanticSimilarityService");
const neuralSemanticMemoryService_1 = require("./neuralSemanticMemoryService");
const semanticFineTuningService_1 = require("./semanticFineTuningService");
const semanticContextService_1 = require("./semanticContextService");
const semanticSentenceDataset_1 = require("./semanticSentenceDataset");
class ModelManager {
    /**
     * Inicializa toda a infraestrutura de inteligência semântica.
     *
     * Ordem:
     * 1. Word embeddings
     * 2. Modelo de sentença
     * 3. Similaridade TF-IDF
     * 4. Memória neural
     * 5. Registry de versões
     * 6. Fine-tuning
     * 7. Contexto semântico
     */
    static initialize() {
        if (this.initialized &&
            this.services) {
            return this.services;
        }
        const trainingDocuments = this.buildTrainingDocuments();
        /*
         * ─────────────────────────────────────────────────────────────────────
         * 1. Word Embeddings
         * ─────────────────────────────────────────────────────────────────────
         */
        const wordEmbeddingModel = new wordEmbeddingModel_1.WordEmbeddingModel();
        wordEmbeddingModel.train(trainingDocuments.map((document) => document.text));
        /*
         * ─────────────────────────────────────────────────────────────────────
         * 2. Modelo semântico de sentença
         * ─────────────────────────────────────────────────────────────────────
         */
        const sentenceModel = new semanticSentenceModel_1.SemanticSentenceModel();
        sentenceModel.train(wordEmbeddingModel, semanticSentenceDataset_1.SEMANTIC_SENTENCE_DATASET);
        /*
         * ─────────────────────────────────────────────────────────────────────
         * 3. Similaridade TF-IDF
         * ─────────────────────────────────────────────────────────────────────
         */
        const similarityService = new semanticSimilarityService_1.SemanticSimilarityService();
        similarityService.train(trainingDocuments);
        /*
         * ─────────────────────────────────────────────────────────────────────
         * 4. Memória neural
         * ─────────────────────────────────────────────────────────────────────
         */
        const neuralSemanticMemoryService = new neuralSemanticMemoryService_1.NeuralSemanticMemoryService();
        neuralSemanticMemoryService.setModels(wordEmbeddingModel, sentenceModel);
        /*
         * ─────────────────────────────────────────────────────────────────────
         * 5. Registry inicial
         * ─────────────────────────────────────────────────────────────────────
         */
        const modelRegistry = new semanticFineTuningService_1.SemanticModelRegistry();
        modelRegistry.register(sentenceModel.exportModel(), {
            datasetSize: semanticSentenceDataset_1.SEMANTIC_SENTENCE_DATASET.length,
            trainingPairs: semanticSentenceDataset_1.SEMANTIC_SENTENCE_DATASET.length,
            validationScore: 0,
            testScore: 0,
        });
        const initialModel = modelRegistry.getAll()[0];
        if (!initialModel) {
            throw new Error('Falha ao registrar o modelo semântico inicial.');
        }
        const activated = modelRegistry.activate(initialModel.version);
        if (!activated) {
            throw new Error('Falha ao ativar o modelo semântico inicial.');
        }
        /*
         * ─────────────────────────────────────────────────────────────────────
         * 6. Fine-tuning
         * ─────────────────────────────────────────────────────────────────────
         */
        const fineTuningService = new semanticFineTuningService_1.SemanticFineTuningService(modelRegistry);
        /*
         * ─────────────────────────────────────────────────────────────────────
         * 7. Contexto semântico
         * ─────────────────────────────────────────────────────────────────────
         */
        const semanticContextService = new semanticContextService_1.SemanticContextService();
        semanticContextService.setTfidfService(similarityService);
        semanticContextService.setNeuralService(neuralSemanticMemoryService);
        semanticContextService.enable();
        this.services = {
            wordEmbeddingModel,
            sentenceModel,
            similarityService,
            neuralSemanticMemoryService,
            modelRegistry,
            fineTuningService,
            semanticContextService,
        };
        this.initialized = true;
        return this.services;
    }
    static isInitialized() {
        return (this.initialized &&
            this.services !== null);
    }
    static getServices() {
        if (!this.services) {
            return this.initialize();
        }
        return this.services;
    }
    static getWordEmbeddingModel() {
        return this.getServices()
            .wordEmbeddingModel;
    }
    static getSentenceModel() {
        return this.getServices()
            .sentenceModel;
    }
    static getSimilarityService() {
        return this.getServices()
            .similarityService;
    }
    static getNeuralSemanticMemoryService() {
        return this.getServices()
            .neuralSemanticMemoryService;
    }
    static getModelRegistry() {
        return this.getServices()
            .modelRegistry;
    }
    static getFineTuningService() {
        return this.getServices()
            .fineTuningService;
    }
    static getSemanticContextService() {
        return this.getServices()
            .semanticContextService;
    }
    static getStatus() {
        if (!this.services) {
            return {
                initialized: false,
                wordEmbedding: null,
                sentenceModel: null,
                similarity: null,
                registry: {
                    activeVersion: null,
                    versionCount: 0,
                },
                neuralMemory: {
                    ready: false,
                    memoryCount: 0,
                },
                semanticContext: false,
            };
        }
        const { wordEmbeddingModel, sentenceModel, similarityService, neuralSemanticMemoryService, modelRegistry, semanticContextService, } = this.services;
        const active = modelRegistry.getActive();
        return {
            initialized: this.initialized,
            wordEmbedding: {
                vocabularySize: wordEmbeddingModel
                    .getVocabularySize(),
                dimension: wordEmbeddingModel
                    .getDimension(),
                trained: wordEmbeddingModel
                    .isTrained(),
            },
            sentenceModel: {
                inputDimension: sentenceModel
                    .getInputDimension(),
                outputDimension: sentenceModel
                    .getOutputDimension(),
                trained: sentenceModel
                    .isTrained(),
            },
            similarity: {
                documentCount: similarityService
                    .getDocumentCount(),
                vocabularySize: similarityService
                    .getVocabularySize(),
                trained: similarityService
                    .isTrained(),
            },
            registry: {
                activeVersion: active?.version ?? null,
                versionCount: modelRegistry
                    .getVersionCount(),
            },
            neuralMemory: {
                ready: neuralSemanticMemoryService
                    .isReady(),
                memoryCount: neuralSemanticMemoryService
                    .getMemoryCount(),
            },
            semanticContext: semanticContextService
                .isConfigured(),
        };
    }
    static reset() {
        this.services = null;
        this.initialized = false;
    }
    /**
     * Converte o dataset de pares semânticos em documentos independentes
     * para alimentar o TF-IDF.
     *
     * Cada frase recebe um ID determinístico.
     */
    static buildTrainingDocuments() {
        const documents = [];
        const seen = new Set();
        for (let index = 0; index <
            semanticSentenceDataset_1.SEMANTIC_SENTENCE_DATASET.length; index += 1) {
            const pair = semanticSentenceDataset_1.SEMANTIC_SENTENCE_DATASET[index];
            const first = pair.first.trim();
            const second = pair.second.trim();
            if (first) {
                const key = `first:${first}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    documents.push({
                        id: `semantic-${index}-first`,
                        text: first,
                    });
                }
            }
            if (second) {
                const key = `second:${second}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    documents.push({
                        id: `semantic-${index}-second`,
                        text: second,
                    });
                }
            }
        }
        if (documents.length === 0) {
            throw new Error('O dataset semântico não possui documentos válidos.');
        }
        return documents;
    }
}
exports.ModelManager = ModelManager;
ModelManager.initialized = false;
ModelManager.services = null;
