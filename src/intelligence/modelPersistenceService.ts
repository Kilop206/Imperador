import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';

import {
  dirname,
  join,
  resolve,
} from 'node:path';

import type {
  WordEmbeddingModelData,
} from './wordEmbeddingModel';

import type {
  SemanticSentenceModelData,
} from './semanticSentenceModel';

import type {
  SemanticModelVersion,
} from './semanticFineTuningService';

export interface PersistedSimilarityModel {
  vectorizer: ReturnType<
    import('./tfidfVectorizer').TfidfVectorizer['exportModel']
  >;

  documents: Array<{
    id: string;
    text: string;
  }>;
}

export interface PersistedModelRegistry {
  versions: SemanticModelVersion[];
  nextVersion: number;
}

export interface PersistedModels {
  schemaVersion: number;
  savedAt: number;
  wordEmbedding: WordEmbeddingModelData;
  sentenceModel: SemanticSentenceModelData;
  similarity: PersistedSimilarityModel;
  registry: PersistedModelRegistry;
}

export interface ModelPersistenceOptions {
  directory?: string;
  filename?: string;
}

const CURRENT_SCHEMA_VERSION = 1;

const DEFAULT_DIRECTORY =
  resolve(
    process.cwd(),
    'data',
    'models',
  );

const DEFAULT_FILENAME =
  'semantic-models.json';

export class ModelPersistenceService {
  private readonly directory: string;
  private readonly filename: string;
  private readonly filepath: string;

  constructor(
    options: ModelPersistenceOptions = {},
  ) {
    this.directory =
      resolve(
        options.directory ??
          DEFAULT_DIRECTORY,
      );

    this.filename =
      options.filename ??
      DEFAULT_FILENAME;

    this.filepath =
      join(
        this.directory,
        this.filename,
      );
  }

  public exists(): boolean {
    try {
      readFileSync(
        this.filepath,
        'utf-8',
      );

      return true;
    } catch {
      return false;
    }
  }

  public getPath(): string {
    return this.filepath;
  }

  public save(
    models: PersistedModels,
  ): void {
    this.validate(models);

    mkdirSync(
      dirname(this.filepath),
      {
        recursive: true,
      },
    );

    const content =
      JSON.stringify(
        models,
        null,
        2,
      ) + '\n';

    const temporaryPath =
      `${this.filepath}.tmp`;

    try {
      writeFileSync(
        temporaryPath,
        content,
        {
          encoding: 'utf-8',
        },
      );

      try {
        renameSync(
          temporaryPath,
          this.filepath,
        );
      } catch {
        // Fallback robusto para Windows quando renameSync falha por lock momentâneo
        copyFileSync(
          temporaryPath,
          this.filepath,
        );

        try {
          unlinkSync(
            temporaryPath,
          );
        } catch {
          // Ignora falha ao limpar arquivo temporário após cópia.
        }
      }
    } catch (error) {
      try {
        unlinkSync(
          temporaryPath,
        );
      } catch {
        // Ignora falha ao limpar arquivo temporário.
      }

      throw error;
    }
  }

  public load():
    PersistedModels | null {
    if (!this.exists()) {
      return null;
    }

    let raw: string | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        raw = readFileSync(
          this.filepath,
          'utf-8',
        );
        break;
      } catch (err: unknown) {
        const errorCode =
          err && typeof err === 'object' && 'code' in err
            ? (err as { code: string }).code
            : null;

        if (errorCode === 'EBUSY' && attempt < 4) {
          continue;
        }

        console.error(
          `Falha ao carregar modelos persistidos em ${this.filepath}:`,
          err,
        );

        return null;
      }
    }

    if (!raw) {
      return null;
    }

    try {
      const parsed: unknown = JSON.parse(raw);
      this.validate(parsed);
      return parsed;
    } catch (error) {
      console.error(
        `Falha ao validar modelos persistidos em ${this.filepath}:`,
        error,
      );

      return null;
    }
  }

  public delete(): void {
    try {
      unlinkSync(
        this.filepath,
      );
    } catch {
      // Arquivo inexistente = estado já limpo.
    }
  }

  public getSchemaVersion(): number {
    return CURRENT_SCHEMA_VERSION;
  }

  private validate(
    value: unknown,
  ): asserts value is PersistedModels {
    if (
      !value ||
      typeof value !== 'object'
    ) {
      throw new TypeError(
        'Dados persistidos inválidos.',
      );
    }

    const data =
      value as Record<string, unknown>;

    if (
      data.schemaVersion !==
      CURRENT_SCHEMA_VERSION
    ) {
      throw new Error(
        `Versão de schema incompatível: ${String(
          data.schemaVersion,
        )}. Esperada: ${CURRENT_SCHEMA_VERSION}.`,
      );
    }

    if (
      typeof data.savedAt !== 'number' ||
      !Number.isFinite(
        data.savedAt,
      )
    ) {
      throw new TypeError(
        'savedAt inválido.',
      );
    }

    if (
      !this.isObject(
        data.wordEmbedding,
      )
    ) {
      throw new TypeError(
        'wordEmbedding ausente ou inválido.',
      );
    }

    if (
      !this.isObject(
        data.sentenceModel,
      )
    ) {
      throw new TypeError(
        'sentenceModel ausente ou inválido.',
      );
    }

    if (
      !this.isObject(
        data.similarity,
      )
    ) {
      throw new TypeError(
        'similarity ausente ou inválido.',
      );
    }

    if (
      !this.isObject(
        data.registry,
      )
    ) {
      throw new TypeError(
        'registry ausente ou inválido.',
      );
    }

    this.validateWordEmbedding(
      data.wordEmbedding,
    );

    this.validateSentenceModel(
      data.sentenceModel,
    );

    this.validateSimilarity(
      data.similarity,
    );

    this.validateRegistry(
      data.registry,
    );
  }

  private validateWordEmbedding(
    value: Record<string, unknown>,
  ): void {
    if (
      !Array.isArray(
        value.vocabulary,
      ) ||
      !Array.isArray(
        value.embeddings,
      ) ||
      typeof value.dimension !== 'number'
    ) {
      throw new TypeError(
        'Modelo de word embeddings inválido.',
      );
    }

    if (
      value.vocabulary.length !==
      value.embeddings.length
    ) {
      throw new Error(
        'Vocabulário e embeddings possuem tamanhos incompatíveis.',
      );
    }
  }

  private validateSentenceModel(
    value: Record<string, unknown>,
  ): void {
    if (
      typeof value.inputDimension !==
        'number' ||
      typeof value.outputDimension !==
        'number' ||
      !Array.isArray(
        value.projection,
      )
    ) {
      throw new TypeError(
        'Modelo semântico de sentença inválido.',
      );
    }
  }

  private validateSimilarity(
    value: Record<string, unknown>,
  ): void {
    if (
      !this.isObject(
        value.vectorizer,
      ) ||
      !Array.isArray(
        value.documents,
      )
    ) {
      throw new TypeError(
        'Modelo TF-IDF inválido.',
      );
    }

    for (
      const document
      of value.documents
    ) {
      if (
        !this.isObject(
          document,
        ) ||
        typeof document.id !==
          'string' ||
        typeof document.text !==
          'string'
      ) {
        throw new TypeError(
          'Documento TF-IDF inválido.',
        );
      }
    }
  }

  private validateRegistry(
    value: Record<string, unknown>,
  ): void {
    if (
      !Array.isArray(
        value.versions,
      ) ||
      typeof value.nextVersion !==
        'number'
    ) {
      throw new TypeError(
        'Registry de modelos inválido.',
      );
    }

    for (
      const version
      of value.versions
    ) {
      if (
        !this.isObject(
          version,
        )
      ) {
        throw new TypeError(
          'Versão de modelo inválida.',
        );
      }

      if (
        typeof version.version !==
          'number' ||
        typeof version.createdAt !==
          'number' ||
        typeof version.datasetSize !==
          'number' ||
        typeof version.trainingPairs !==
          'number' ||
        typeof version.validationScore !==
          'number' ||
        typeof version.testScore !==
          'number' ||
        typeof version.active !==
          'boolean' ||
        !this.isObject(
          version.modelData,
        )
      ) {
        throw new TypeError(
          'Metadados da versão do modelo inválidos.',
        );
      }
    }
  }

  private isObject(
    value: unknown,
  ): value is Record<string, unknown> {
    return (
      typeof value ===
        'object' &&
      value !== null &&
      !Array.isArray(value)
    );
  }
}