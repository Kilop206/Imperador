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
const modelPersistenceService_1 = require("./modelPersistenceService");
class ModelManager {
    static initialize() {
        if (this.initialized &&
            this.services) {
            return this.services;
        }
        const persisted = this.persistence.load();
        if (persisted) {
            try {
                const services = this.restoreFromPersistence(persisted);
                this.services = services;
                this.source = 'persisted';
                this.initialized = true;
                return services;
            }
            catch (error) {
                console.error('Modelos persistidos incompatíveis ou corrompidos. Treinando novamente:', error);
            }
        }
        const services = this.trainFromScratch();
        this.services = services;
        this.source = 'trained';
        this.initialized = true;
        this.persist();
        return services;
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
    static getPersistenceService() {
        return this.persistence;
    }
    /**
     * Treina um novo modelo candidato usando o serviço de fine-tuning.
     *
     * Se o candidato for ativado pelo FineTuningService, o ModelManager
     * sincroniza imediatamente o modelo ativo e persiste o novo estado.
     */
    static fineTune(input) {
        const services = this.getServices();
        const result = services.fineTuningService.fineTune(services.wordEmbeddingModel, input);
        if (result.activated) {
            this.synchronizeActiveModel();
            this.persist();
        }
        return result;
    }
    /**
     * Ativa manualmente uma versão registrada.
     *
     * A ativação atualiza:
     * - SemanticModelRegistry
     * - SemanticSentenceModel usado em runtime
     * - NeuralSemanticMemoryService
     * - persistência
     */
    static activateVersion(version) {
        const services = this.getServices();
        const activated = services.modelRegistry.activate(version);
        if (!activated) {
            return false;
        }
        this.synchronizeActiveModel();
        this.persist();
        return true;
    }
    /**
     * Retorna a versão atualmente ativa.
     */
    static getActiveVersion() {
        const active = this.getModelRegistry()
            .getActive();
        return active?.version ?? null;
    }
    /**
     * Persiste explicitamente o estado atual dos modelos.
     */
    static save() {
        if (!this.services) {
            return;
        }
        this.persist();
    }
    static getStatus() {
        if (!this.services) {
            return {
                initialized: false,
                source: 'trained',
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
                persistence: {
                    available: this.persistence.exists(),
                    path: this.persistence.getPath(),
                },
            };
        }
        const { wordEmbeddingModel, sentenceModel, similarityService, neuralSemanticMemoryService, modelRegistry, semanticContextService, } = this.services;
        const active = modelRegistry.getActive();
        return {
            initialized: this.initialized,
            source: this.source,
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
            persistence: {
                available: this.persistence.exists(),
                path: this.persistence.getPath(),
            },
        };
    }
    static reset(deletePersistence = false) {
        this.services = null;
        this.initialized = false;
        this.source = 'trained';
        if (deletePersistence) {
            this.persistence.delete();
        }
    }
    /**
     * Sincroniza a instância de runtime com a versão ativa do registry.
     *
     * Importante:
     * O registry é a fonte de verdade sobre qual modelo está ativo.
     */
    static synchronizeActiveModel() {
        const services = this.getServices();
        const active = services.modelRegistry.getActive();
        if (!active) {
            throw new Error('Não existe versão ativa no registry.');
        }
        const restoredModel = services.modelRegistry.restoreModel(active.version);
        if (!restoredModel) {
            throw new Error(`Não foi possível restaurar a versão ativa ${active.version}.`);
        }
        services.sentenceModel =
            restoredModel;
        services.neuralSemanticMemoryService
            .setModels(services.wordEmbeddingModel, restoredModel);
        /*
         * O SemanticContextService mantém uma referência para o mesmo
         * NeuralSemanticMemoryService, portanto não precisamos reconstruí-lo.
         */
    }
    static trainFromScratch() {
        const trainingDocuments = this.buildTrainingDocuments();
        /*
         * 1. Word embeddings
         */
        const wordEmbeddingModel = new wordEmbeddingModel_1.WordEmbeddingModel();
        wordEmbeddingModel.train(trainingDocuments.map((document) => document.text));
        /*
         * 2. Modelo semântico de sentença
         */
        const sentenceModel = new semanticSentenceModel_1.SemanticSentenceModel();
        sentenceModel.train(wordEmbeddingModel, semanticSentenceDataset_1.SEMANTIC_SENTENCE_DATASET);
        /*
         * 3. Similaridade TF-IDF
         */
        const similarityService = new semanticSimilarityService_1.SemanticSimilarityService();
        similarityService.train(trainingDocuments);
        /*
         * 4. Memória neural
         */
        const neuralSemanticMemoryService = new neuralSemanticMemoryService_1.NeuralSemanticMemoryService();
        neuralSemanticMemoryService.setModels(wordEmbeddingModel, sentenceModel);
        /*
         * 5. Registry
         */
        const modelRegistry = new semanticFineTuningService_1.SemanticModelRegistry();
        const registered = modelRegistry.register(sentenceModel.exportModel(), {
            datasetSize: semanticSentenceDataset_1.SEMANTIC_SENTENCE_DATASET.length,
            trainingPairs: semanticSentenceDataset_1.SEMANTIC_SENTENCE_DATASET.length,
            validationScore: 0,
            testScore: 0,
        });
        const activated = modelRegistry.activate(registered.version);
        if (!activated) {
            throw new Error('Falha ao ativar o modelo semântico inicial.');
        }
        /*
         * 6. Fine-tuning
         */
        const fineTuningService = new semanticFineTuningService_1.SemanticFineTuningService(modelRegistry);
        /*
         * 7. Contexto semântico
         */
        const semanticContextService = new semanticContextService_1.SemanticContextService();
        semanticContextService.setTfidfService(similarityService);
        semanticContextService.setNeuralService(neuralSemanticMemoryService);
        semanticContextService.enable();
        return {
            wordEmbeddingModel,
            sentenceModel,
            similarityService,
            neuralSemanticMemoryService,
            modelRegistry,
            fineTuningService,
            semanticContextService,
        };
    }
    static restoreFromPersistence(persisted) {
        /*
         * 1. Restaurar embeddings
         */
        const wordEmbeddingModel = new wordEmbeddingModel_1.WordEmbeddingModel();
        wordEmbeddingModel.importModel(persisted.wordEmbedding);
        /*
         * 2. Restaurar registry
         */
        const modelRegistry = new semanticFineTuningService_1.SemanticModelRegistry();
        modelRegistry.importData(persisted.registry);
        const active = modelRegistry.getActive();
        if (!active) {
            throw new Error('O registry persistido não possui modelo ativo.');
        }
        /*
         * 3. Restaurar modelo semântico ativo
         */
        const sentenceModel = modelRegistry.restoreModel(active.version);
        if (!sentenceModel) {
            throw new Error('Não foi possível restaurar o modelo semântico ativo.');
        }
        /*
         * 4. Restaurar TF-IDF
         */
        const similarityService = new semanticSimilarityService_1.SemanticSimilarityService();
        similarityService.importModel(persisted.similarity);
        /*
         * 5. Restaurar memória neural
         */
        const neuralSemanticMemoryService = new neuralSemanticMemoryService_1.NeuralSemanticMemoryService();
        neuralSemanticMemoryService.setModels(wordEmbeddingModel, sentenceModel);
        /*
         * 6. Fine-tuning
         */
        const fineTuningService = new semanticFineTuningService_1.SemanticFineTuningService(modelRegistry);
        /*
         * 7. Contexto semântico
         */
        const semanticContextService = new semanticContextService_1.SemanticContextService();
        semanticContextService.setTfidfService(similarityService);
        semanticContextService.setNeuralService(neuralSemanticMemoryService);
        semanticContextService.enable();
        return {
            wordEmbeddingModel,
            sentenceModel,
            similarityService,
            neuralSemanticMemoryService,
            modelRegistry,
            fineTuningService,
            semanticContextService,
        };
    }
    static persist() {
        if (!this.services) {
            return;
        }
        const { wordEmbeddingModel, sentenceModel, similarityService, modelRegistry, } = this.services;
        const data = {
            schemaVersion: this.persistence
                .getSchemaVersion(),
            savedAt: Date.now(),
            wordEmbedding: wordEmbeddingModel
                .exportModel(),
            sentenceModel: sentenceModel
                .exportModel(),
            similarity: similarityService
                .exportModel(),
            registry: modelRegistry
                .exportData(),
        };
        this.persistence.save(data);
    }
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
ModelManager.source = 'trained';
ModelManager.services = null;
ModelManager.persistence = new modelPersistenceService_1.ModelPersistenceService();
