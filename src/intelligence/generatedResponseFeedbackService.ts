import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';

import type { EmotionState } from '../types/emotion';
import type { MessageIntent } from '../services/textAnalyzer';
import {
  SelfEvaluationEngine,
  type SelfEvaluationResult,
} from './selfEvaluationEngine';
import type { GeneratedResponse } from './responseGenerationEngine';

export type GeneratedResponseFeedbackLabel =
  | 'positive'
  | 'negative'
  | 'neutral';

export interface GeneratedResponseFeedbackInput {
  content: string;
  intent: MessageIntent;
  emotion: EmotionState;
  relevantMemory?: string | null;
  semanticContext?: string | null;
  generated: GeneratedResponse;
}

export interface GeneratedResponseFeedbackEntry {
  id: string;
  createdAt: number;
  content: string;
  intent: MessageIntent;
  relevantMemory: string | null;
  semanticContext: string | null;
  responseText: string;
  confidence: number;
  novelty: number;
  relevance: number;
  contextRelevance: number;
  intentAlignment: number;
  selfEvaluationId: string;
  selfEvaluationQuality: number;
  feedback: {
    label: GeneratedResponseFeedbackLabel;
    score: number;
    note: string | null;
    recordedAt: number;
  } | null;
  trainingEligible: boolean;
}

export interface GeneratedResponseFeedbackStats {
  total: number;
  pending: number;
  positive: number;
  negative: number;
  neutral: number;
  trainingEligible: number;
  averageSelfEvaluationQuality: number;
  averageConfidence: number;
}

const TRAINING_QUALITY_THRESHOLD = 0.70;
const MAX_ENTRIES = 500;

const DEFAULT_STORAGE_PATH = resolve(
  process.cwd(),
  'data',
  'generated_response_feedback.json',
);

const STORAGE_VERSION = 1;

interface PersistedFeedbackStore {
  version: number;
  entries: GeneratedResponseFeedbackEntry[];
}

export class GeneratedResponseFeedbackService {
  private static entries: GeneratedResponseFeedbackEntry[] = [];
  private static initialized = false;
  private static storagePath = DEFAULT_STORAGE_PATH;

  public static initialize(): void {
    if (this.initialized) {
      return;
    }

    this.loadFromDisk();
    this.initialized = true;
  }

  public static register(
    input: GeneratedResponseFeedbackInput,
  ): string {
    this.ensureInitialized();

    const now = Date.now();
    const id = `genfb_${now}_${Math.floor(Math.random() * 100000)}`;

    const selfEvaluation =
      SelfEvaluationEngine.evaluate(
        input.content,
        input.generated.text,
        {
          confidence: input.generated.confidence,
          emotionState: input.emotion,
        },
      );

    const entry: GeneratedResponseFeedbackEntry = {
      id,
      createdAt: now,
      content: input.content.trim(),
      intent: input.intent,
      relevantMemory: input.relevantMemory?.trim() || null,
      semanticContext: input.semanticContext?.trim() || null,
      responseText: input.generated.text,
      confidence: input.generated.confidence,
      novelty: input.generated.novelty,
      relevance: input.generated.relevance,
      contextRelevance: input.generated.contextRelevance,
      intentAlignment: input.generated.intentAlignment,
      selfEvaluationId: selfEvaluation.id,
      selfEvaluationQuality: selfEvaluation.metrics.overallQuality,
      feedback: null,
      trainingEligible: false,
    };

    this.entries.push(entry);
    this.trimEntries();
    this.persist();

    return id;
  }

  public static recordFeedback(
    id: string,
    label: GeneratedResponseFeedbackLabel,
    options: {
      score?: number;
      note?: string | null;
    } = {},
  ): GeneratedResponseFeedbackEntry | null {
    this.ensureInitialized();

    const entry = this.entries.find(
      candidate => candidate.id === id,
    );

    if (!entry) {
      return null;
    }

    const score = Math.max(
      0,
      Math.min(1, options.score ?? this.defaultScore(label)),
    );

    entry.feedback = {
      label,
      score,
      note: options.note?.trim() || null,
      recordedAt: Date.now(),
    };

    const generatedQuality = this.calculateGeneratedQuality(entry);

    entry.trainingEligible =
      label === 'positive' &&
      score >= TRAINING_QUALITY_THRESHOLD &&
      (
        generatedQuality >= TRAINING_QUALITY_THRESHOLD ||
        entry.selfEvaluationQuality >= TRAINING_QUALITY_THRESHOLD
      );

    this.persist();

    return this.cloneEntry(entry);
  }

  public static get(
    id: string,
  ): GeneratedResponseFeedbackEntry | null {
    this.ensureInitialized();

    const entry = this.entries.find(
      candidate => candidate.id === id,
    );

    return entry ? this.cloneEntry(entry) : null;
  }

  public static listPending(
    limit = 20,
  ): GeneratedResponseFeedbackEntry[] {
    this.ensureInitialized();

    const safeLimit = Math.max(0, Math.floor(limit));

    return this.entries
      .filter(entry => entry.feedback === null)
      .slice(-safeLimit)
      .reverse()
      .map(entry => this.cloneEntry(entry));
  }

  public static listTrainingEligible(
    limit = 50,
  ): GeneratedResponseFeedbackEntry[] {
    this.ensureInitialized();

    const safeLimit = Math.max(0, Math.floor(limit));

    return this.entries
      .filter(entry => entry.trainingEligible)
      .slice(-safeLimit)
      .reverse()
      .map(entry => this.cloneEntry(entry));
  }

  public static getStats(): GeneratedResponseFeedbackStats {
    this.ensureInitialized();

    const total = this.entries.length;

    if (total === 0) {
      return {
        total: 0,
        pending: 0,
        positive: 0,
        negative: 0,
        neutral: 0,
        trainingEligible: 0,
        averageSelfEvaluationQuality: 0,
        averageConfidence: 0,
      };
    }

    let pending = 0;
    let positive = 0;
    let negative = 0;
    let neutral = 0;
    let trainingEligible = 0;
    let qualitySum = 0;
    let confidenceSum = 0;

    for (const entry of this.entries) {
      qualitySum += entry.selfEvaluationQuality;
      confidenceSum += entry.confidence;

      if (entry.feedback === null) {
        pending += 1;
      } else if (entry.feedback.label === 'positive') {
        positive += 1;
      } else if (entry.feedback.label === 'negative') {
        negative += 1;
      } else {
        neutral += 1;
      }

      if (entry.trainingEligible) {
        trainingEligible += 1;
      }
    }

    return {
      total,
      pending,
      positive,
      negative,
      neutral,
      trainingEligible,
      averageSelfEvaluationQuality: Number(
        (qualitySum / total).toFixed(3),
      ),
      averageConfidence: Number(
        (confidenceSum / total).toFixed(3),
      ),
    };
  }

  public static setStoragePathForTests(
    storagePath: string,
  ): void {
    this.storagePath = resolve(storagePath);
    this.entries = [];
    this.initialized = false;
  }

  public static reset(
    options: {
      persist?: boolean;
    } = {},
  ): void {
    this.entries = [];
    this.initialized = true;

    if (options.persist !== false) {
      this.persist();
    }
  }

  public static resetStoragePath(): void {
    this.storagePath = DEFAULT_STORAGE_PATH;
    this.entries = [];
    this.initialized = false;
  }

  private static ensureInitialized(): void {
    if (!this.initialized) {
      this.initialize();
    }
  }

  private static loadFromDisk(): void {
    this.entries = [];

    if (!existsSync(this.storagePath)) {
      return;
    }

    try {
      const raw = readFileSync(this.storagePath, 'utf8');
      const parsed: unknown = JSON.parse(raw);

      if (!parsed || typeof parsed !== 'object') {
        return;
      }

      const store = parsed as Partial<PersistedFeedbackStore>;
      if (
        store.version !== STORAGE_VERSION ||
        !Array.isArray(store.entries)
      ) {
        return;
      }

      this.entries = store.entries
        .filter(entry => this.isValidEntry(entry))
        .slice(-MAX_ENTRIES)
        .map(entry => this.cloneEntry(entry));
    } catch {
      this.entries = [];
    }
  }

  private static persist(): void {
    try {
      const directory = dirname(this.storagePath);
      mkdirSync(directory, { recursive: true });

      const temporaryPath = `${this.storagePath}.${process.pid}.${Date.now()}.tmp`;
      const payload: PersistedFeedbackStore = {
        version: STORAGE_VERSION,
        entries: this.entries,
      };

      writeFileSync(
        temporaryPath,
        JSON.stringify(payload, null, 2),
        'utf8',
      );

      try {
        renameSync(temporaryPath, this.storagePath);
      } catch (error) {
        try {
          unlinkSync(temporaryPath);
        } catch {
          // Best effort cleanup.
        }

        throw error;
      }
    } catch {
      // Persistência é uma camada auxiliar. O pipeline em memória continua funcional.
    }
  }

  private static trimEntries(): void {
    if (this.entries.length <= MAX_ENTRIES) {
      return;
    }

    this.entries.splice(
      0,
      this.entries.length - MAX_ENTRIES,
    );
  }

  private static isValidEntry(
    entry: unknown,
  ): entry is GeneratedResponseFeedbackEntry {
    if (!entry || typeof entry !== 'object') {
      return false;
    }

    const candidate =
      entry as Partial<GeneratedResponseFeedbackEntry>;

    return (
      typeof candidate.id === 'string' &&
      typeof candidate.createdAt === 'number' &&
      typeof candidate.content === 'string' &&
      typeof candidate.responseText === 'string' &&
      typeof candidate.confidence === 'number' &&
      typeof candidate.novelty === 'number' &&
      typeof candidate.relevance === 'number' &&
      typeof candidate.contextRelevance === 'number' &&
      typeof candidate.intentAlignment === 'number' &&
      typeof candidate.selfEvaluationId === 'string' &&
      typeof candidate.selfEvaluationQuality === 'number' &&
      typeof candidate.trainingEligible === 'boolean'
    );
  }

  private static calculateGeneratedQuality(
    entry: GeneratedResponseFeedbackEntry,
  ): number {
    const values = [
      entry.confidence,
      entry.novelty,
      entry.relevance,
      entry.contextRelevance,
      entry.intentAlignment,
    ];

    const validValues = values.filter(value =>
      Number.isFinite(value),
    );

    if (validValues.length === 0) {
      return 0;
    }

    const average =
      validValues.reduce((sum, value) => sum + value, 0) /
      validValues.length;

    return Math.max(0, Math.min(1, average));
  }

  private static defaultScore(
    label: GeneratedResponseFeedbackLabel,
  ): number {
    switch (label) {
      case 'positive':
        return 1;
      case 'negative':
        return 0;
      case 'neutral':
        return 0.5;
    }
  }

  private static cloneEntry(
    entry: GeneratedResponseFeedbackEntry,
  ): GeneratedResponseFeedbackEntry {
    return {
      ...entry,
      feedback: entry.feedback
        ? { ...entry.feedback }
        : null,
    };
  }
}
