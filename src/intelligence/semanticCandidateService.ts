import * as fs from 'node:fs';
import * as path from 'node:path';

export type SemanticCandidateReason =
  | 'uncertain'
  | 'hard-negative'
  | 'novel'
  | 'retrieval-conflict';

export interface SemanticCandidate {
  id: number;
  first: string;
  second: string;
  predictedScore: number;
  reason: SemanticCandidateReason;
  createdAt: number;
  reviewed: boolean;
}

interface CandidateData {
  version: number;
  nextId: number;
  candidates: SemanticCandidate[];
}

const DATA_DIRECTORY =
  path.join(
    process.cwd(),
    'data'
  );

const DEFAULT_FILE_PATH =
  path.join(
    DATA_DIRECTORY,
    'semantic_candidates.json'
  );

const MAX_CANDIDATES = 1000;

export class SemanticCandidateService {
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
    first: string,
    second: string,
    predictedScore: number,
    reason: SemanticCandidateReason
  ): SemanticCandidate | null {
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
      this.normalizeText(
        normalizedFirst
      ) ===
      this.normalizeText(
        normalizedSecond
      )
    ) {
      return null;
    }

    if (
      !Number.isFinite(
        predictedScore
      )
    ) {
      return null;
    }

    if (
      reason !== 'uncertain' &&
      reason !== 'hard-negative' &&
      reason !== 'novel' &&
      reason !== 'retrieval-conflict'
    ) {
      return null;
    }

    const score =
      Math.max(
        0,
        Math.min(
          1,
          predictedScore
        )
      );

    const pairKey =
      this.normalizePair(
        normalizedFirst,
        normalizedSecond
      );

    const alreadyPending =
      this.data.candidates.some(
        candidate =>
          !candidate.reviewed &&
          this.normalizePair(
            candidate.first,
            candidate.second
          ) === pairKey
      );

    if (alreadyPending) {
      return null;
    }

    if (
      this.data.candidates.length >=
      MAX_CANDIDATES
    ) {
      this.removeOldestReviewed();

      if (
        this.data.candidates.length >=
        MAX_CANDIDATES
      ) {
        this.data.candidates.shift();
      }
    }

    const candidate: SemanticCandidate = {
      id:
        this.data.nextId++,
      first:
        normalizedFirst,
      second:
        normalizedSecond,
      predictedScore:
        score,
      reason,
      createdAt:
        Date.now(),
      reviewed: false,
    };

    this.data.candidates.push(
      candidate
    );

    this.save();

    return {
      ...candidate,
    };
  }

  static getPending(
    limit = 20
  ): SemanticCandidate[] {
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
        (a, b) => {
          if (
            b.predictedScore !==
            a.predictedScore
          ) {
            return (
              Math.abs(
                0.5 -
                a.predictedScore
              ) -
              Math.abs(
                0.5 -
                b.predictedScore
              )
            );
          }

          return (
            b.createdAt -
            a.createdAt
          );
        }
      )
      .slice(
        0,
        safeLimit
      )
      .map(candidate => ({
        ...candidate,
      }));
  }

  static getById(
    id: number
  ): SemanticCandidate | null {
    this.ensureInitialized();

    return (
      this.data.candidates.find(
        candidate =>
          candidate.id === id
      ) ?? null
    );
  }

  static getByReason(
    reason: SemanticCandidateReason
  ): SemanticCandidate[] {
    this.ensureInitialized();

    return this.data.candidates
      .filter(
        candidate =>
          candidate.reason ===
          reason
      )
      .map(candidate => ({
        ...candidate,
      }));
  }

  static markReviewed(
    id: number
  ): boolean {
    this.ensureInitialized();

    const candidate =
      this.data.candidates.find(
        item =>
          item.id === id
      );

    if (!candidate) {
      return false;
    }

    if (candidate.reviewed) {
      return false;
    }

    candidate.reviewed =
      true;

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

  static clear(): number {
    this.ensureInitialized();

    const count =
      this.data.candidates.length;

    if (count === 0) {
      return 0;
    }

    this.data.candidates = [];

    this.save();

    return count;
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

  static hasPair(
    first: string,
    second: string
  ): boolean {
    this.ensureInitialized();

    const pairKey =
      this.normalizePair(
        first,
        second
      );

    return this.data.candidates.some(
      candidate =>
        this.normalizePair(
          candidate.first,
          candidate.second
        ) === pairKey
    );
  }

  static reset(): void {
    this.data = {
      version: 1,
      nextId: 1,
      candidates: [],
    };

    this.filePath =
      DEFAULT_FILE_PATH;

    this.initialized =
      false;
  }

  private static normalizePair(
    first: string,
    second: string
  ): string {
    return [
      this.normalizeText(first),
      this.normalizeText(second),
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
    }
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
          'Arquivo de candidatos semânticos inválido.'
        );
      }

      const candidates =
        parsed.candidates.filter(
          candidate =>
            this.isValidCandidate(
              candidate
            )
        );

      const highestId =
        candidates.reduce(
          (max, candidate) =>
            Math.max(
              max,
              candidate.id
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
        candidates,
      };
    } catch (error) {
      throw new Error(
        `Não foi possível carregar candidatos semânticos: ${
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

  private static isValidCandidate(
    value: unknown
  ): value is SemanticCandidate {
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
      typeof item.predictedScore ===
        'number' &&
      Number.isFinite(
        item.predictedScore
      ) &&
      (
        item.reason ===
          'uncertain' ||
        item.reason ===
          'hard-negative' ||
        item.reason ===
          'novel' ||
        item.reason ===
          'retrieval-conflict'
      ) &&
      typeof item.createdAt ===
        'number' &&
      Number.isFinite(
        item.createdAt
      ) &&
      typeof item.reviewed ===
        'boolean'
    );
  }
}