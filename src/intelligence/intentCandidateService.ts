import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  IntentClassifier,
  IntentPrediction,
} from './intentClassifier';

import {
  MessageIntent,
} from '../services/textAnalyzer';

export interface IntentCandidate {
  id: number;
  text: string;
  predictedIntent: MessageIntent;
  confidence: number;
  probabilities: Record<MessageIntent, number>;
  createdAt: number;
  reviewed: boolean;
}

interface CandidateData {
  version: number;
  nextId: number;
  candidates: IntentCandidate[];
}

const DATA_DIRECTORY =
  path.join(
    process.cwd(),
    'data'
  );

const DEFAULT_FILE_PATH =
  path.join(
    DATA_DIRECTORY,
    'intent_candidates.json'
  );

const DEFAULT_THRESHOLD = 0.65;
const MAX_CANDIDATES = 1000;

export class IntentCandidateService {
  private static filePath =
    DEFAULT_FILE_PATH;

  private static data: CandidateData = {
    version: 1,
    nextId: 1,
    candidates: [],
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

  static collect(
    text: string,
    prediction: IntentPrediction,
    threshold = DEFAULT_THRESHOLD
  ): IntentCandidate | null {
    this.ensureInitialized();

    const normalizedText =
      text.trim();

    if (
      !normalizedText ||
      prediction.confidence >= threshold
    ) {
      return null;
    }

    const alreadyPending =
      this.data.candidates.some(
        candidate =>
          !candidate.reviewed &&
          this.normalize(
            candidate.text
          ) === this.normalize(
            normalizedText
          )
      );

    if (alreadyPending) {
      return null;
    }

    if (
      this.data.candidates.length >=
      MAX_CANDIDATES
    ) {
      this.removeOldestReviewed();
    }

    const candidate: IntentCandidate = {
      id: this.data.nextId++,
      text: normalizedText,
      predictedIntent:
        prediction.intent,
      confidence:
        prediction.confidence,
      probabilities:
        {
          ...prediction.probabilities,
        },
      createdAt:
        Date.now(),
      reviewed: false,
    };

    this.data.candidates.push(
      candidate
    );

    this.save();

    return candidate;
  }

  static getPending(
    limit = 20
  ): IntentCandidate[] {
    this.ensureInitialized();

    const safeLimit =
      Math.max(
        1,
        Math.floor(limit)
      );

    return this.data.candidates
      .filter(
        candidate =>
          !candidate.reviewed
      )
      .sort(
        (a, b) =>
          b.createdAt -
          a.createdAt
      )
      .slice(
        0,
        safeLimit
      );
  }

  static getById(
    id: number
  ): IntentCandidate | null {
    this.ensureInitialized();

    return (
      this.data.candidates.find(
        candidate =>
          candidate.id === id
      ) ?? null
    );
  }

  static markReviewed(
    id: number
  ): boolean {
    this.ensureInitialized();

    const candidate =
      this.getById(id);

    if (!candidate) {
      return false;
    }

    candidate.reviewed = true;

    this.save();

    return true;
  }

  static remove(
    id: number
  ): boolean {
    this.ensureInitialized();

    const index =
      this.data.candidates.findIndex(
        candidate =>
          candidate.id === id
      );

    if (index < 0) {
      return false;
    }

    this.data.candidates.splice(
      index,
      1
    );

    this.save();

    return true;
  }

  static clearReviewed(): number {
    this.ensureInitialized();

    const before =
      this.data.candidates.length;

    this.data.candidates =
      this.data.candidates.filter(
        candidate =>
          !candidate.reviewed
      );

    const removed =
      before -
      this.data.candidates.length;

    if (removed > 0) {
      this.save();
    }

    return removed;
  }

  static getPendingCount(): number {
    this.ensureInitialized();

    return this.data.candidates.filter(
      candidate =>
        !candidate.reviewed
    ).length;
  }

  static getTotalCount(): number {
    this.ensureInitialized();

    return this.data.candidates.length;
  }

  private static removeOldestReviewed(): void {
    const index =
      this.data.candidates.findIndex(
        candidate =>
          candidate.reviewed
      );

    if (index >= 0) {
      this.data.candidates.splice(
        index,
        1
      );

      return;
    }

    this.data.candidates.shift();
  }

  private static load():
    CandidateData {
    try {
      if (
        !fs.existsSync(
          this.filePath
        )
      ) {
        return {
          version: 1,
          nextId: 1,
          candidates: [],
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
        ) as Partial<CandidateData>;

      if (
        parsed.version !== 1 ||
        !Array.isArray(
          parsed.candidates
        ) ||
        typeof parsed.nextId !==
          'number'
      ) {
        throw new Error(
          'Arquivo de candidatos inválido.'
        );
      }

      return {
        version: 1,
        nextId:
          Math.max(
            1,
            Math.floor(
              parsed.nextId
            )
          ),
        candidates:
          parsed.candidates.filter(
            candidate =>
              this.isValidCandidate(
                candidate
              )
          ),
      };
    } catch (error) {
      throw new Error(
        `Não foi possível carregar candidatos de intenção: ${
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

  private static normalize(
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

  private static isValidCandidate(
    candidate: unknown
  ): candidate is IntentCandidate {
    if (
      !candidate ||
      typeof candidate !== 'object'
    ) {
      return false;
    }

    const value =
      candidate as Record<
        string,
        unknown
      >;

    return (
      typeof value.id ===
        'number' &&
      typeof value.text ===
        'string' &&
      value.text.trim()
        .length > 0 &&
      typeof value.predictedIntent ===
        'string' &&
      typeof value.confidence ===
        'number' &&
      value.probabilities !== null &&
      typeof value.probabilities ===
        'object' &&
      typeof value.createdAt ===
        'number' &&
      typeof value.reviewed ===
        'boolean'
    );
  }

  static reset(): void {
    this.data = {
      version: 1,
      nextId: 1,
      candidates: [],
    };

    this.initialized = false;
  }
}