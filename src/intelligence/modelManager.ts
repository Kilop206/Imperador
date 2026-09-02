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
} from './semanticFineTuningService';

import {
  SemanticContextService,
} from './semanticContextService';

import {
  SEMANTIC_SENTENCE_DATASET,
} from './semanticSentenceDataset';

export interface ModelManagerStatus {
  initialized: boolean;

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

  semanticContext: boolean;
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

  private static services:
    ModelManagerServices | null = null;

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
  public static initialize(): ModelManagerServices {
    if (
      this.initialized &&
      this.services
    ) {
      return this.services;
    }

    const trainingDocuments =
      this.buildTrainingDocuments();

    /*
     * ─────────────────────────────────────────────────────────────────────
     * 1. Word Embeddings
     * ─────────────────────────────────────────────────────────────────────
     */

    const wordEmbeddingModel =
      new WordEmbeddingModel();

    wordEmbeddingModel.train(
      trainingDocuments.map(
        (document) => document.text
      )
    );

    /*
     * ─────────────────────────────────────────────────────────────────────
     * 2. Modelo semântico de sentença
     * ─────────────────────────────────────────────────────────────────────
     */

    const sentenceModel =
      new SemanticSentenceModel();

    sentenceModel.train(
      wordEmbeddingModel,
      SEMANTIC_SENTENCE_DATASET
    );

    /*
     * ─────────────────────────────────────────────────────────────────────
     * 3. Similaridade TF-IDF
     * ─────────────────────────────────────────────────────────────────────
     */

    const similarityService =
      new SemanticSimilarityService();

    similarityService.train(
      trainingDocuments
    );

    /*
     * ─────────────────────────────────────────────────────────────────────
     * 4. Memória neural
     * ─────────────────────────────────────────────────────────────────────
     */

    const neuralSemanticMemoryService =
      new NeuralSemanticMemoryService();

    neuralSemanticMemoryService.setModels(
      wordEmbeddingModel,
      sentenceModel
    );

    /*
     * ─────────────────────────────────────────────────────────────────────
     * 5. Registry inicial
     * ─────────────────────────────────────────────────────────────────────
     */

    const modelRegistry =
      new SemanticModelRegistry();

    modelRegistry.register(
      sentenceModel.exportModel(),
      {
        datasetSize:
          SEMANTIC_SENTENCE_DATASET.length,

        trainingPairs:
          SEMANTIC_SENTENCE_DATASET.length,

        validationScore: 0,
        testScore: 0,
      }
    );

    const initialModel =
      modelRegistry.getAll()[0];

    if (!initialModel) {
      throw new Error(
        'Falha ao registrar o modelo semântico inicial.'
      );
    }

    const activated =
      modelRegistry.activate(
        initialModel.version
      );

    if (!activated) {
      throw new Error(
        'Falha ao ativar o modelo semântico inicial.'
      );
    }

    /*
     * ─────────────────────────────────────────────────────────────────────
     * 6. Fine-tuning
     * ─────────────────────────────────────────────────────────────────────
     */

    const fineTuningService =
      new SemanticFineTuningService(
        modelRegistry
      );

    /*
     * ─────────────────────────────────────────────────────────────────────
     * 7. Contexto semântico
     * ─────────────────────────────────────────────────────────────────────
     */

    const semanticContextService =
      new SemanticContextService();

    semanticContextService.setTfidfService(
      similarityService
    );

    semanticContextService.setNeuralService(
      neuralSemanticMemoryService
    );

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

  public static getStatus():
    ModelManagerStatus {
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

      semanticContext:
        semanticContextService
          .isConfigured(),
    };
  }

  public static reset(): void {
    this.services = null;
    this.initialized = false;
  }

  /**
   * Converte o dataset de pares semânticos em documentos independentes
   * para alimentar o TF-IDF.
   *
   * Cada frase recebe um ID determinístico.
   */
  private static buildTrainingDocuments():
    SimilarityDocument[] {
    const documents:
      SimilarityDocument[] = [];

    const seen = new Set<string>();

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
            id: `semantic-${index}-first`,
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
            id: `semantic-${index}-second`,
            text: second,
          });
        }
      }
    }

    if (documents.length === 0) {
      throw new Error(
        'O dataset semântico não possui documentos válidos.'
      );
    }

    return documents;
  }
}