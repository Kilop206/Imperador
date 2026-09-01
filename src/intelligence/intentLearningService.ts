import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  MessageIntent,
} from '../services/textAnalyzer';

import {
  IntentClassifier,
  TrainingExample,
} from './intentClassifier';

import {
  INTENT_DATASET,
} from './intentDataset';

interface LearningData {
  version: number;
  examples: TrainingExample[];
}

const VALID_INTENTS:
  readonly MessageIntent[] = [
  'aggressive',
  'compliment',
  'question',
  'greeting',
  'farewell',
  'humor',
  'serious',
  'nostalgic',
  'philosophical',
  'roman',
  'neutral',
];

const DATA_DIRECTORY =
  path.join(
    process.cwd(),
    'data'
  );

const DEFAULT_FILE_PATH =
  path.join(
    DATA_DIRECTORY,
    'intent_learning.json'
  );

const MAX_LEARNED_EXAMPLES = 5000;

export class IntentLearningService {
  private static filePath =
    DEFAULT_FILE_PATH;

  private static data: LearningData = {
    version: 1,
    examples: [],
  };

  private static initialized = false;

  static initialize(
    filePath = DEFAULT_FILE_PATH
  ): void {
    this.filePath = filePath;

    if (this.initialized) {
      return;
    }

    this.data = this.load();
    this.initialized = true;

    this.train();
  }

  static ensureInitialized(): void {
    if (!this.initialized) {
      this.initialize();
    }
  }

  static learn(
    text: string,
    intent: MessageIntent
  ): boolean {
    this.ensureInitialized();

    const normalizedText =
      text.trim();

    if (!normalizedText) {
      throw new Error(
        'O texto de treinamento não pode estar vazio.'
      );
    }

    if (
      !VALID_INTENTS.includes(
        intent
      )
    ) {
      throw new Error(
        `Intenção inválida: ${intent}`
      );
    }

    const normalizedForComparison =
      this.normalizeForComparison(
        normalizedText
      );

    const alreadyExists =
      INTENT_DATASET.some(
        example =>
          this.normalizeForComparison(
            example.text
          ) === normalizedForComparison &&
          example.intent === intent
      ) ||
      this.data.examples.some(
        example =>
          this.normalizeForComparison(
            example.text
          ) === normalizedForComparison &&
          example.intent === intent
      );

    if (alreadyExists) {
      return false;
    }

    if (
      this.data.examples.length >=
      MAX_LEARNED_EXAMPLES
    ) {
      throw new Error(
        `Limite de ${MAX_LEARNED_EXAMPLES} exemplos aprendidos atingido.`
      );
    }

    this.data.examples.push({
      text: normalizedText,
      intent,
    });

    this.save();
    this.train();

    return true;
  }

  static getLearnedExamples():
    readonly TrainingExample[] {
    this.ensureInitialized();

    return [
      ...this.data.examples,
    ];
  }

  static getLearnedExampleCount():
    number {
    this.ensureInitialized();

    return this.data.examples.length;
  }

  static getTotalExampleCount():
    number {
    this.ensureInitialized();

    return (
      INTENT_DATASET.length +
      this.data.examples.length
    );
  }

  static getModelTrainingCount():
    number {
    this.ensureInitialized();

    return (
      IntentClassifier
        .getTrainingExampleCount()
    );
  }

  static removeLearnedExample(
    text: string,
    intent: MessageIntent
  ): boolean {
    this.ensureInitialized();

    const normalizedText =
      this.normalizeForComparison(
        text
      );

    const index =
      this.data.examples.findIndex(
        example =>
          this.normalizeForComparison(
            example.text
          ) === normalizedText &&
          example.intent === intent
      );

    if (index < 0) {
      return false;
    }

    this.data.examples.splice(
      index,
      1
    );

    this.save();
    this.train();

    return true;
  }

  static clearLearnedExamples(): void {
    this.ensureInitialized();

    this.data.examples = [];

    this.save();
    this.train();
  }

  static retrain(): void {
    this.ensureInitialized();
    this.train();
  }

  private static train(): void {
    IntentClassifier.train([
      ...INTENT_DATASET,
      ...this.data.examples,
    ]);
  }

  private static load():
    LearningData {
    try {
      if (
        !fs.existsSync(
          this.filePath
        )
      ) {
        return {
          version: 1,
          examples: [],
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
        ) as Partial<LearningData>;

      if (
        parsed.version !== 1 ||
        !Array.isArray(
          parsed.examples
        )
      ) {
        throw new Error(
          'Arquivo de aprendizado inválido.'
        );
      }

      const examples =
        parsed.examples.filter(
          example =>
            this.isValidExample(
              example
            )
        );

      return {
        version: 1,
        examples,
      };
    } catch (error) {
      throw new Error(
        `Não foi possível carregar o aprendizado incremental: ${
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

    const content =
      JSON.stringify(
        this.data,
        null,
        2
      );

    const temporaryPath =
      `${this.filePath}.tmp`;

    fs.writeFileSync(
      temporaryPath,
      content,
      'utf-8'
    );

    fs.renameSync(
      temporaryPath,
      this.filePath
    );
  }

  private static isValidExample(
    example: unknown
  ): example is TrainingExample {
    if (
      !example ||
      typeof example !== 'object'
    ) {
      return false;
    }

    const candidate =
      example as Record<
        string,
        unknown
      >;

    return (
      typeof candidate.text ===
        'string' &&
      candidate.text.trim()
        .length > 0 &&
      typeof candidate.intent ===
        'string' &&
      VALID_INTENTS.includes(
        candidate.intent as MessageIntent
      )
    );
  }

  private static normalizeForComparison(
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
}