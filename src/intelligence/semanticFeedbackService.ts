import * as fs from 'node:fs';
import * as path from 'node:path';

import type {
  SemanticSentencePair,
} from './semanticSentenceDataset';

export type SemanticFeedbackSource =
  | 'human'
  | 'automatic'
  | 'hard-negative';

export interface SemanticFeedback {
  id: number;
  first: string;
  second: string;
  label: 0 | 1;
  source: SemanticFeedbackSource;
  createdAt: number;
}

interface FeedbackData {
  version: number;
  nextId: number;
  feedback: SemanticFeedback[];
}

const DATA_DIRECTORY =
  path.join(
    process.cwd(),
    'data'
  );

const DEFAULT_FILE_PATH =
  path.join(
    DATA_DIRECTORY,
    'semantic_feedback.json'
  );

const MAX_FEEDBACK = 5000;

export class SemanticFeedbackService {
  private static filePath =
    DEFAULT_FILE_PATH;

  private static data: FeedbackData = {
    version: 1,
    nextId: 1,
    feedback: [],
  };

  private static initialized =
    false;

  static initialize(
    filePath = DEFAULT_FILE_PATH
  ): void {
    this.filePath = filePath;

    if (this.initialized) {
      return;
    }

    this.data = this.load();
    this.initialized = true;
  }

  static ensureInitialized(): void {
    if (!this.initialized) {
      this.initialize();
    }
  }

  static add(
    first: string,
    second: string,
    label: 0 | 1,
    source: SemanticFeedbackSource = 'human'
  ): SemanticFeedback | null {
    this.ensureInitialized();

    const normalizedFirst =
      first.trim();

    const normalizedSecond =
      second.trim();

    if (
      !normalizedFirst ||
      !normalizedSecond
    ) {
      return null;
    }

    if (
      normalizedFirst ===
      normalizedSecond
    ) {
      return null;
    }

    if (
      label !== 0 &&
      label !== 1
    ) {
      return null;
    }

    if (
      source !== 'human' &&
      source !== 'automatic' &&
      source !== 'hard-negative'
    ) {
      return null;
    }

    const normalizedPair =
      this.normalizePair(
        normalizedFirst,
        normalizedSecond
      );

    const alreadyExists =
      this.data.feedback.some(
        item =>
          this.normalizePair(
            item.first,
            item.second
          ) === normalizedPair &&
          item.label === label
      );

    if (alreadyExists) {
      return null;
    }

    if (
      this.data.feedback.length >=
      MAX_FEEDBACK
    ) {
      this.removeOldest();
    }

    const entry: SemanticFeedback = {
      id:
        this.data.nextId++,
      first:
        normalizedFirst,
      second:
        normalizedSecond,
      label,
      source,
      createdAt:
        Date.now(),
    };

    this.data.feedback.push(
      entry
    );

    this.save();

    return entry;
  }

  static addPair(
    pair: SemanticSentencePair,
    source: SemanticFeedbackSource = 'human'
  ): SemanticFeedback | null {
    return this.add(
      pair.first,
      pair.second,
      pair.label,
      source
    );
  }

  static getAll(): SemanticFeedback[] {
    this.ensureInitialized();

    return this.data.feedback
      .map(item => ({
        ...item,
      }));
  }

  static getById(
    id: number
  ): SemanticFeedback | null {
    this.ensureInitialized();

    return (
      this.data.feedback.find(
        item =>
          item.id === id
      ) ?? null
    );
  }

  static getByLabel(
    label: 0 | 1
  ): SemanticFeedback[] {
    this.ensureInitialized();

    return this.data.feedback
      .filter(
        item =>
          item.label === label
      )
      .map(item => ({
        ...item,
      }));
  }

  static getBySource(
    source: SemanticFeedbackSource
  ): SemanticFeedback[] {
    this.ensureInitialized();

    return this.data.feedback
      .filter(
        item =>
          item.source === source
      )
      .map(item => ({
        ...item,
      }));
  }

  static getTrainingPairs():
    SemanticSentencePair[] {
    this.ensureInitialized();

    return this.data.feedback.map(
      item => ({
        first: item.first,
        second: item.second,
        label: item.label,
      })
    );
  }

  static remove(
    id: number
  ): boolean {
    this.ensureInitialized();

    const index =
      this.data.feedback.findIndex(
        item =>
          item.id === id
      );

    if (index < 0) {
      return false;
    }

    this.data.feedback.splice(
      index,
      1
    );

    this.save();

    return true;
  }

  static clear(): number {
    this.ensureInitialized();

    const count =
      this.data.feedback.length;

    if (count === 0) {
      return 0;
    }

    this.data.feedback = [];

    this.save();

    return count;
  }

  static getCount(): number {
    this.ensureInitialized();

    return this.data.feedback.length;
  }

  static getPositiveCount(): number {
    return this.getByLabel(1)
      .length;
  }

  static getNegativeCount(): number {
    return this.getByLabel(0)
      .length;
  }

  static getSourceCount(
    source: SemanticFeedbackSource
  ): number {
    return this.getBySource(
      source
    ).length;
  }

  static hasPair(
    first: string,
    second: string,
    label?: 0 | 1
  ): boolean {
    this.ensureInitialized();

    const normalizedPair =
      this.normalizePair(
        first,
        second
      );

    return this.data.feedback.some(
      item => {
        if (
          this.normalizePair(
            item.first,
            item.second
          ) !== normalizedPair
        ) {
          return false;
        }

        if (
          label === undefined
        ) {
          return true;
        }

        return item.label === label;
      }
    );
  }

  static toTrainingPairs():
    SemanticSentencePair[] {
    return this.getTrainingPairs();
  }

  static reset(): void {
    this.data = {
      version: 1,
      nextId: 1,
      feedback: [],
    };

    this.initialized = false;
    this.filePath =
      DEFAULT_FILE_PATH;
  }

  private static normalizePair(
    first: string,
    second: string
  ): string {
    const normalizedFirst =
      this.normalizeText(first);

    const normalizedSecond =
      this.normalizeText(second);

    return [
      normalizedFirst,
      normalizedSecond,
    ]
      .sort()
      .join('\u0000');
  }

  private static normalizeText(
    text: string
  ): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(
        /[\u0300-\u036f]/g,
        ''
      )
      .replace(
        /[^\p{L}\p{N}\s]/gu,
        ' '
      )
      .replace(
        /\s+/g,
        ' '
      )
      .trim();
  }

  private static removeOldest(): void {
    if (
      this.data.feedback.length === 0
    ) {
      return;
    }

    let oldestIndex = 0;

    for (
      let index = 1;
      index <
      this.data.feedback.length;
      index += 1
    ) {
      if (
        this.data.feedback[index]
          .createdAt <
        this.data.feedback[
          oldestIndex
        ].createdAt
      ) {
        oldestIndex = index;
      }
    }

    this.data.feedback.splice(
      oldestIndex,
      1
    );
  }

  private static load():
    FeedbackData {
    try {
      if (
        !fs.existsSync(
          this.filePath
        )
      ) {
        return {
          version: 1,
          nextId: 1,
          feedback: [],
        };
      }

      const raw =
        fs.readFileSync(
          this.filePath,
          'utf-8'
        );

      const parsed =
        JSON.parse(
          raw
        ) as Partial<FeedbackData>;

      if (
        parsed.version !== 1 ||
        !Array.isArray(
          parsed.feedback
        ) ||
        typeof parsed.nextId !==
          'number'
      ) {
        throw new Error(
          'Arquivo de feedback semântico inválido.'
        );
      }

      const feedback =
        parsed.feedback.filter(
          item =>
            this.isValidFeedback(
              item
            )
        );

      const highestId =
        feedback.reduce(
          (max, item) =>
            Math.max(
              max,
              item.id
            ),
          0
        );

      return {
        version: 1,
        nextId:
          Math.max(
            1,
            Math.floor(
              parsed.nextId
            ),
            highestId + 1
          ),
        feedback,
      };
    } catch (error) {
      throw new Error(
        `Não foi possível carregar feedback semântico: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`
      );
    }
  }

  private static save(): void {
    fs.mkdirSync(
      path.dirname(
        this.filePath
      ),
      {
        recursive: true,
      }
    );

    const temporaryPath =
      `${this.filePath}.tmp`;

    fs.writeFileSync(
      temporaryPath,
      JSON.stringify(
        this.data,
        null,
        2
      ),
      'utf-8'
    );

    fs.renameSync(
      temporaryPath,
      this.filePath
    );
  }

  private static isValidFeedback(
    value: unknown
  ): value is SemanticFeedback {
    if (
      !value ||
      typeof value !== 'object'
    ) {
      return false;
    }

    const item =
      value as Record<
        string,
        unknown
      >;

    return (
      typeof item.id ===
        'number' &&
      Number.isInteger(
        item.id
      ) &&
      item.id > 0 &&
      typeof item.first ===
        'string' &&
      item.first.trim()
        .length > 0 &&
      typeof item.second ===
        'string' &&
      item.second.trim()
        .length > 0 &&
      (
        item.label === 0 ||
        item.label === 1
      ) &&
      (
        item.source ===
          'human' ||
        item.source ===
          'automatic' ||
        item.source ===
          'hard-negative'
      ) &&
      typeof item.createdAt ===
        'number' &&
      Number.isFinite(
        item.createdAt
      )
    );
  }
}