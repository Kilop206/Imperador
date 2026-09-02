import {
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';

import {
  dirname,
  join,
} from 'node:path';

import type {
  SemanticSentencePair,
} from './semanticSentenceDataset';

export interface SemanticFeedbackExample {
  id: number;
  first: string;
  second: string;
  label: 0 | 1;
  createdAt: number;
  source:
    | 'human'
    | 'system'
    | 'mined';
}

interface SemanticFeedbackData {
  version: number;
  nextId: number;
  examples: SemanticFeedbackExample[];
}

const DATA_DIRECTORY =
  join(
    process.cwd(),
    'data',
  );

const DEFAULT_FILE =
  join(
    DATA_DIRECTORY,
    'semantic_feedback.json',
  );

const MAX_EXAMPLES = 10000;

export class SemanticFeedbackService {
  private static filePath =
    DEFAULT_FILE;

  private static data:
    SemanticFeedbackData = {
    version: 1,
    nextId: 1,
    examples: [],
  };

  private static initialized = false;

  public static initialize(
    filePath = DEFAULT_FILE,
  ): void {
    this.filePath = filePath;

    if (this.initialized) {
      return;
    }

    this.data = this.load();
    this.initialized = true;
  }

  public static ensureInitialized(): void {
    if (!this.initialized) {
      this.initialize();
    }
  }

  public static add(
    first: string,
    second: string,
    label: 0 | 1,
    source:
      | 'human'
      | 'system'
      | 'mined' = 'human',
  ): SemanticFeedbackExample {
    this.ensureInitialized();

    const normalizedFirst =
      first.trim();

    const normalizedSecond =
      second.trim();

    if (
      !normalizedFirst ||
      !normalizedSecond
    ) {
      throw new Error(
        'As duas frases precisam possuir conteúdo.',
      );
    }

    const exists =
      this.data.examples.some(
        example =>
          this.normalize(example.first) ===
            this.normalize(normalizedFirst) &&
          this.normalize(example.second) ===
            this.normalize(normalizedSecond) &&
          example.label === label,
      );

    if (exists) {
      throw new Error(
        'Este exemplo semântico já existe.',
      );
    }

    if (
      this.data.examples.length >=
      MAX_EXAMPLES
    ) {
      this.removeOldest();
    }

    const example:
      SemanticFeedbackExample = {
      id: this.data.nextId++,
      first: normalizedFirst,
      second: normalizedSecond,
      label,
      createdAt: Date.now(),
      source,
    };

    this.data.examples.push(
      example,
    );

    this.save();

    return {
      ...example,
    };
  }

  public static addPair(
    pair: SemanticSentencePair,
    source:
      | 'human'
      | 'system'
      | 'mined' = 'human',
  ): SemanticFeedbackExample {
    return this.add(
      pair.first,
      pair.second,
      pair.label,
      source,
    );
  }

  public static getAll():
    SemanticFeedbackExample[] {
    this.ensureInitialized();

    return this.data.examples.map(
      example => ({
        ...example,
      }),
    );
  }

  public static getTrainingPairs():
    SemanticSentencePair[] {
    this.ensureInitialized();

    return this.data.examples.map(
      example => ({
        first: example.first,
        second: example.second,
        label: example.label,
      }),
    );
  }

  public static getCount(): number {
    this.ensureInitialized();

    return this.data.examples.length;
  }

  public static remove(
    id: number,
  ): boolean {
    this.ensureInitialized();

    const index =
      this.data.examples.findIndex(
        example =>
          example.id === id,
      );

    if (index < 0) {
      return false;
    }

    this.data.examples.splice(
      index,
      1,
    );

    this.save();

    return true;
  }

  public static clear(): void {
    this.ensureInitialized();

    this.data.examples = [];

    this.save();
  }

  public static reset(): void {
    this.data = {
      version: 1,
      nextId: 1,
      examples: [],
    };

    this.initialized = false;
  }

  private static load():
    SemanticFeedbackData {
    try {
      let raw: string;

      try {
        raw = readFileSync(
          this.filePath,
          'utf-8',
        );
      } catch {
        return {
          version: 1,
          nextId: 1,
          examples: [],
        };
      }

      const parsed =
        JSON.parse(
          raw,
        ) as Partial<SemanticFeedbackData>;

      if (
        parsed.version !== 1 ||
        !Array.isArray(
          parsed.examples,
        ) ||
        typeof parsed.nextId !==
          'number'
      ) {
        throw new Error(
          'Arquivo de feedback semântico inválido.',
        );
      }

      const examples =
        parsed.examples.filter(
          example =>
            this.isValidExample(
              example,
            ),
        );

      return {
        version: 1,
        nextId:
          Math.max(
            1,
            Math.floor(
              parsed.nextId,
            ),
          ),
        examples,
      };
    } catch (error) {
      throw new Error(
        `Não foi possível carregar feedback semântico: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`,
      );
    }
  }

  private static save(): void {
    mkdirSync(
      dirname(this.filePath),
      {
        recursive: true,
      },
    );

    const temporaryPath =
      `${this.filePath}.tmp`;

    try {
      writeFileSync(
        temporaryPath,
        JSON.stringify(
          this.data,
          null,
          2,
        ),
        'utf-8',
      );

      renameSync(
        temporaryPath,
        this.filePath,
      );
    } catch (error) {
      try {
        unlinkSync(
          temporaryPath,
        );
      } catch {
        // Ignora falha de limpeza.
      }

      throw error;
    }
  }

  private static removeOldest(): void {
    let oldestIndex = 0;

    for (
      let index = 1;
      index <
      this.data.examples.length;
      index += 1
    ) {
      if (
        this.data.examples[index]
          .createdAt <
        this.data.examples[oldestIndex]
          .createdAt
      ) {
        oldestIndex = index;
      }
    }

    this.data.examples.splice(
      oldestIndex,
      1,
    );
  }

  private static normalize(
    text: string,
  ): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(
        /[\u0300-\u036f]/g,
        '',
      )
      .replace(
        /[^\p{L}\p{N}\s]/gu,
        ' ',
      )
      .replace(
        /\s+/g,
        ' ',
      )
      .trim();
  }

  private static isValidExample(
    example: unknown,
  ): example is SemanticFeedbackExample {
    if (
      !example ||
      typeof example !== 'object'
    ) {
      return false;
    }

    const value =
      example as Record<
        string,
        unknown
      >;

    return (
      typeof value.id === 'number' &&
      typeof value.first ===
        'string' &&
      value.first.trim().length > 0 &&
      typeof value.second ===
        'string' &&
      value.second.trim().length > 0 &&
      (
        value.label === 0 ||
        value.label === 1
      ) &&
      typeof value.createdAt ===
        'number' &&
      (
        value.source === 'human' ||
        value.source === 'system' ||
        value.source === 'mined'
      )
    );
  }
}