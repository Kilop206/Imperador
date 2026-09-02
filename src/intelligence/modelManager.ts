import {
  WordEmbeddingModel,
} from './wordEmbeddingModel';

import {
  SemanticSentenceModel,
} from './semanticSentenceModel';

import {
  SemanticSimilarityService,
  type SimilarityDocument,
} from './semanticSimilarityService';

import {
  NeuralSemanticMemoryService,
} from './neuralSemanticMemoryService';

import {
  SemanticModelRegistry,
  SemanticFineTuningService,
  type SemanticFineTuningInput,
  type SemanticFineTuningResult,
} from './semanticFineTuningService';

import {
  SemanticContextService,
} from './semanticContextService';

import {
  SEMANTIC_SENTENCE_DATASET,
} from './semanticSentenceDataset';

import {
  SemanticFeedbackService,
} from './semanticFeedbackService';

import {
  ModelPersistenceService,
  type PersistedModels,
} from './modelPersistenceService';

export interface ModelManagerStatus {
  initialized: boolean;

  source:
    | 'trained'
    | 'persisted';

  wordEmbedding: {
    vocabularySize: number;
    dimension: number;
    trained: boolean;
  } | null;

  sentenceModel: {
    inputDimension: number;
    outputDimension: number;
    trained: boolean;
  } | null;

  similarity: {
    documentCount: number;
    vocabularySize: number;
    trained: boolean;
  } | null;

  registry: {
    activeVersion: number | null;
    versionCount: number;
  };

  neuralMemory: {
    ready: boolean;
    memoryCount: number;
  };

  semanticFeedback: {
    exampleCount: number;
  };

  semanticContext: boolean;

  persistence: {
    available: boolean;
    path: string;
  };
}

export interface ModelManagerServices {
  wordEmbeddingModel: WordEmbeddingModel;
  sentenceModel: SemanticSentenceModel;
  similarityService: SemanticSimilarityService;
  neuralSemanticMemoryService: NeuralSemanticMemoryService;
  modelRegistry: SemanticModelRegistry;
  fineTuningService: SemanticFineTuningService;
  semanticContextService: SemanticContextService;
}

export class ModelManager {
  private static initialized = false;

  private static source:
    | 'trained'
    | 'persisted' = 'trained';

  private static services:
    ModelManagerServices | null = null;

  private static persistence =
    new ModelPersistenceService();

  public static initialize():
    ModelManagerServices {
    if (
      this.initialized &&
      this.services
    ) {
      return this.services;
    }

    SemanticFeedbackService.initialize();

    const persisted =
      this.persistence.load();

    if (persisted) {
      try {
        const services =
          this.restoreFromPersistence(
            persisted,
          );

        this.services = services;
        this.source = 'persisted';
        this.initialized = true;

        return services;
      } catch (error) {
        console.error(
          'Modelos persistidos incompatíveis ou corrompidos. Treinando novamente:',
          error,
        );
      }
    }

    const services =
      this.trainFromScratch();

    this.services = services;
    this.source = 'trained';
    this.initialized = true;

    this.persist();

    return services;
  }

  public static isInitialized(): boolean {
    return (
      this.initialized &&
      this.services !== null
    );
  }

  public static getServices():
    ModelManagerServices {
    if (!this.services) {
      return this.initialize();
    }

    return this.services;
  }

  public static getWordEmbeddingModel():
    WordEmbeddingModel {
    return this.getServices()
      .wordEmbeddingModel;
  }

  public static getSentenceModel():
    SemanticSentenceModel {
    return this.getServices()
      .sentenceModel;
  }

  public static getSimilarityService():
    SemanticSimilarityService {
    return this.getServices()
      .similarityService;
  }

  public static getNeuralSemanticMemoryService():
    NeuralSemanticMemoryService {
    return this.getServices()
      .neuralSemanticMemoryService;
  }

  public static getModelRegistry():
    SemanticModelRegistry {
    return this.getServices()
      .modelRegistry;
  }

  public static getFineTuningService():
    SemanticFineTuningService {
    return this.getServices()
      .fineTuningService;
  }

  public static getSemanticContextService():
    SemanticContextService {
    return this.getServices()
      .semanticContextService;
  }

  public static getPersistenceService():
    ModelPersistenceService {
    return this.persistence;
  }

  public static fineTune(
    input: SemanticFineTuningInput,
  ): SemanticFineTuningResult {
    const services =
      this.getServices();

    const result =
      services.fineTuningService.fineTune(
        services.wordEmbeddingModel,
        input,
      );

    if (result.activated) {
      this.synchronizeActiveModel();
      this.persist();
    }

    return result;
  }

  /**
   * Fine-tuning utilizando explicitamente os dados
   * semânticos coletados por feedback humano.
   *
   * O dataset-base continua sendo usado como núcleo
   * de treinamento para evitar esquecimento catastrófico.
   */
  public static fineTuneFromFeedback(
    validationDataset =
      SEMANTIC_SENTENCE_DATASET,
    testDataset =
      SEMANTIC_SENTENCE_DATASET,
  ): SemanticFineTuningResult {
    const feedback =
      SemanticFeedbackService
        .getTrainingPairs();

    if (feedback.length === 0) {
      throw new Error(
        'Não existem exemplos semânticos de feedback para treinar.',
      );
    }

    return this.fineTune({
      originalDataset: [
        ...SEMANTIC_SENTENCE_DATASET,
        ...feedback,
      ],

      validationDataset,

      testDataset,
    });
  }

  public static activateVersion(
    version: number,
  ): boolean {
    const services =
      this.getServices();

    const activated =
      services.modelRegistry.activate(
        version,
      );

    if (!activated) {
      return false;
    }

    this.synchronizeActiveModel();
    this.persist();

    return true;
  }

  public static getActiveVersion():
    number | null {
    const active =
      this.getModelRegistry()
        .getActive();

    return active?.version ?? null;
  }

  public static save(): void {
    if (!this.services) {
      return;
    }

    this.persist();
  }

  public static getStatus():
    ModelManagerStatus {
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

        semanticFeedback: {
          exampleCount:
            SemanticFeedbackService
              .getCount(),
        },

        semanticContext: false,

        persistence: {
          available:
            this.persistence.exists(),
          path:
            this.persistence.getPath(),
        },
      };
    }

    const {
      wordEmbeddingModel,
      sentenceModel,
      similarityService,
      neuralSemanticMemoryService,
      modelRegistry,
      semanticContextService,
    } = this.services;

    const active =
      modelRegistry.getActive();

    return {
      initialized:
        this.initialized,

      source:
        this.source,

      wordEmbedding: {
        vocabularySize:
          wordEmbeddingModel
            .getVocabularySize(),

        dimension:
          wordEmbeddingModel
            .getDimension(),

        trained:
          wordEmbeddingModel
            .isTrained(),
      },

      sentenceModel: {
        inputDimension:
          sentenceModel
            .getInputDimension(),

        outputDimension:
          sentenceModel
            .getOutputDimension(),

        trained:
          sentenceModel
            .isTrained(),
      },

      similarity: {
        documentCount:
          similarityService
            .getDocumentCount(),

        vocabularySize:
          similarityService
            .getVocabularySize(),

        trained:
          similarityService
            .isTrained(),
      },

      registry: {
        activeVersion:
          active?.version ?? null,

        versionCount:
          modelRegistry
            .getVersionCount(),
      },

      neuralMemory: {
        ready:
          neuralSemanticMemoryService
            .isReady(),

        memoryCount:
          neuralSemanticMemoryService
            .getMemoryCount(),
      },

      semanticFeedback: {
        exampleCount:
          SemanticFeedbackService
            .getCount(),
      },

      semanticContext:
        semanticContextService
          .isConfigured(),

      persistence: {
        available:
          this.persistence.exists(),

        path:
          this.persistence.getPath(),
      },
    };
  }

  public static reset(
    deletePersistence = false,
  ): void {
    this.services = null;
    this.initialized = false;
    this.source = 'trained';

    if (deletePersistence) {
      this.persistence.delete();
    }
  }

  private static synchronizeActiveModel(): void {
    const services =
      this.getServices();

    const active =
      services.modelRegistry.getActive();

    if (!active) {
      throw new Error(
        'Não existe versão ativa no registry.',
      );
    }

    const restoredModel =
      services.modelRegistry.restoreModel(
        active.version,
      );

    if (!restoredModel) {
      throw new Error(
        `Não foi possível restaurar a versão ativa ${active.version}.`,
      );
    }

    services.sentenceModel =
      restoredModel;

    services.neuralSemanticMemoryService
      .setModels(
        services.wordEmbeddingModel,
        restoredModel,
      );
  }

  private static trainFromScratch():
    ModelManagerServices {
    const trainingDocuments =
      this.buildTrainingDocuments();

    const wordEmbeddingModel =
      new WordEmbeddingModel();

    wordEmbeddingModel.train(
      trainingDocuments.map(
        document =>
          document.text,
      ),
    );

    const sentenceModel =
      new SemanticSentenceModel();

    sentenceModel.train(
      wordEmbeddingModel,
      SEMANTIC_SENTENCE_DATASET,
    );

    const similarityService =
      new SemanticSimilarityService();

    similarityService.train(
      trainingDocuments,
    );

    const neuralSemanticMemoryService =
      new NeuralSemanticMemoryService();

    neuralSemanticMemoryService.setModels(
      wordEmbeddingModel,
      sentenceModel,
    );

    const modelRegistry =
      new SemanticModelRegistry();

    const registered =
      modelRegistry.register(
        sentenceModel.exportModel(),
        {
          datasetSize:
            SEMANTIC_SENTENCE_DATASET.length,

          trainingPairs:
            SEMANTIC_SENTENCE_DATASET.length,

          validationScore: 0,

          testScore: 0,
        },
      );

    const activated =
      modelRegistry.activate(
        registered.version,
      );

    if (!activated) {
      throw new Error(
        'Falha ao ativar o modelo semântico inicial.',
      );
    }

    const fineTuningService =
      new SemanticFineTuningService(
        modelRegistry,
      );

    const semanticContextService =
      new SemanticContextService();

    semanticContextService.setTfidfService(
      similarityService,
    );

    semanticContextService.setNeuralService(
      neuralSemanticMemoryService,
    );

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

  private static restoreFromPersistence(
    persisted: PersistedModels,
  ):
    ModelManagerServices {
    const wordEmbeddingModel =
      new WordEmbeddingModel();

    wordEmbeddingModel.importModel(
      persisted.wordEmbedding,
    );

    const modelRegistry =
      new SemanticModelRegistry();

    modelRegistry.importData(
      persisted.registry,
    );

    const active =
      modelRegistry.getActive();

    if (!active) {
      throw new Error(
        'O registry persistido não possui modelo ativo.',
      );
    }

    const sentenceModel =
      modelRegistry.restoreModel(
        active.version,
      );

    if (!sentenceModel) {
      throw new Error(
        'Não foi possível restaurar o modelo semântico ativo.',
      );
    }

    const similarityService =
      new SemanticSimilarityService();

    similarityService.importModel(
      persisted.similarity,
    );

    const neuralSemanticMemoryService =
      new NeuralSemanticMemoryService();

    neuralSemanticMemoryService.setModels(
      wordEmbeddingModel,
      sentenceModel,
    );

    const fineTuningService =
      new SemanticFineTuningService(
        modelRegistry,
      );

    const semanticContextService =
      new SemanticContextService();

    semanticContextService.setTfidfService(
      similarityService,
    );

    semanticContextService.setNeuralService(
      neuralSemanticMemoryService,
    );

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

  private static persist(): void {
    if (!this.services) {
      return;
    }

    const {
      wordEmbeddingModel,
      sentenceModel,
      similarityService,
      modelRegistry,
    } = this.services;

    const data:
      PersistedModels = {
      schemaVersion:
        this.persistence
          .getSchemaVersion(),

      savedAt:
        Date.now(),

      wordEmbedding:
        wordEmbeddingModel
          .exportModel(),

      sentenceModel:
        sentenceModel
          .exportModel(),

      similarity:
        similarityService
          .exportModel(),

      registry:
        modelRegistry
          .exportData(),
    };

    this.persistence.save(
      data,
    );
  }

  private static buildTrainingDocuments():
    SimilarityDocument[] {
    const documents:
      SimilarityDocument[] = [];

    const seen =
      new Set<string>();

    for (
      let index = 0;
      index <
      SEMANTIC_SENTENCE_DATASET.length;
      index += 1
    ) {
      const pair =
        SEMANTIC_SENTENCE_DATASET[index];

      const first =
        pair.first.trim();

      const second =
        pair.second.trim();

      if (first) {
        const key =
          `first:${first}`;

        if (!seen.has(key)) {
          seen.add(key);

          documents.push({
            id:
              `semantic-${index}-first`,
            text: first,
          });
        }
      }

      if (second) {
        const key =
          `second:${second}`;

        if (!seen.has(key)) {
          seen.add(key);

          documents.push({
            id:
              `semantic-${index}-second`,
            text: second,
          });
        }
      }
    }

    if (
      documents.length === 0
    ) {
      throw new Error(
        'O dataset semântico não possui documentos válidos.',
      );
    }

    return documents;
  }
}