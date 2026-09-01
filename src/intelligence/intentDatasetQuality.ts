import {
  MessageIntent,
} from '../services/textAnalyzer';

import {
  TrainingExample,
} from './intentClassifier';

export interface DuplicateExample {
  text: string;
  intents: MessageIntent[];
}

export interface IntentDistribution {
  intent: MessageIntent;
  count: number;
  percentage: number;
}

export interface DatasetQualityResult {
  totalExamples: number;
  uniqueTexts: number;
  duplicateTexts: number;
  conflictingTexts: number;
  missingIntents: MessageIntent[];
  distribution: IntentDistribution[];
  isBalanced: boolean;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  conflicts: DuplicateExample[];
}

const INTENTS:
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

const MIN_EXAMPLES_PER_INTENT = 3;
const MAX_CLASS_RATIO = 0.40;

function normalize(
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

export function analyzeDatasetQuality(
  examples: readonly TrainingExample[]
): DatasetQualityResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const grouped =
    new Map<
      string,
      Set<MessageIntent>
    >();

  const counts =
    {} as Record<MessageIntent, number>;

  for (const intent of INTENTS) {
    counts[intent] = 0;
  }

  for (const example of examples) {
    const text =
      normalize(example.text);

    if (!text) {
      errors.push(
        'Existe exemplo com texto vazio.'
      );
      continue;
    }

    if (
      !INTENTS.includes(
        example.intent
      )
    ) {
      errors.push(
        `Intenção inválida encontrada: ${example.intent}`
      );
      continue;
    }

    counts[example.intent] += 1;

    const intents =
      grouped.get(text) ??
      new Set<MessageIntent>();

    intents.add(
      example.intent
    );

    grouped.set(
      text,
      intents
    );
  }

  const conflicts:
    DuplicateExample[] = [];

  let duplicateTexts = 0;

  for (
    const [text, intents] of
      grouped.entries()
  ) {
    if (intents.size > 1) {
      conflicts.push({
        text,
        intents: [...intents],
      });

      continue;
    }

    const occurrences =
      examples.filter(
        example =>
          normalize(
            example.text
          ) === text
      ).length;

    if (occurrences > 1) {
      duplicateTexts += 1;
    }
  }

  const conflictingTexts =
    conflicts.length;

  if (
    conflictingTexts > 0
  ) {
    errors.push(
      `${conflictingTexts} texto(s) possuem rótulos conflitantes.`
    );
  }

  const missingIntents =
    INTENTS.filter(
      intent =>
        counts[intent] === 0
    );

  /*
   * Classes ausentes são um aviso, não um erro.
   *
   * Um dataset parcial pode ser perfeitamente
   * válido para testes, coleta incremental ou
   * treinamento especializado.
   */
  if (
    missingIntents.length > 0
  ) {
    warnings.push(
      `Intenções sem exemplos: ${missingIntents.join(', ')}`
    );
  }

  const underRepresented =
    INTENTS.filter(
      intent =>
        counts[intent] > 0 &&
        counts[intent] <
          MIN_EXAMPLES_PER_INTENT
    );

  if (
    underRepresented.length > 0
  ) {
    warnings.push(
      `Intenções com poucos exemplos: ${underRepresented.join(', ')}`
    );
  }

  const totalExamples =
    examples.length;

  const distribution:
    IntentDistribution[] =
    INTENTS.map(intent => ({
      intent,
      count: counts[intent],
      percentage:
        totalExamples === 0
          ? 0
          : counts[intent] /
            totalExamples,
    }));

  const dominant =
    distribution.filter(
      entry =>
        entry.percentage >
        MAX_CLASS_RATIO
    );

  if (
    dominant.length > 0
  ) {
    warnings.push(
      `Classes dominantes: ${dominant
        .map(entry => entry.intent)
        .join(', ')}`
    );
  }

  const isBalanced =
    dominant.length === 0;

  if (examples.length === 0) {
    errors.push(
      'O dataset está vazio.'
    );
  }

  /*
   * "Válido" significa que não existem
   * problemas estruturais ou conflitos.
   *
   * Desequilíbrio, ausência de classes ou
   * poucas amostras são avisos de qualidade,
   * não corrupção do dataset.
   */
  const isValid =
    errors.length === 0;

  return {
    totalExamples,
    uniqueTexts:
      grouped.size,
    duplicateTexts,
    conflictingTexts,
    missingIntents,
    distribution,
    isBalanced,
    isValid,
    errors,
    warnings,
    conflicts,
  };
}

export function validateDataset(
  examples: readonly TrainingExample[]
): void {
  const result =
    analyzeDatasetQuality(
      examples
    );

  if (
    !result.isValid
  ) {
    throw new Error(
      [
        'Dataset inválido:',
        ...result.errors,
      ].join('\n')
    );
  }
}

export function formatDatasetQualityReport(
  result: DatasetQualityResult
): string {
  const lines: string[] = [];

  lines.push(
    '=== Dataset Quality Report ==='
  );

  lines.push(
    `Total de exemplos: ${result.totalExamples}`
  );

  lines.push(
    `Textos únicos: ${result.uniqueTexts}`
  );

  lines.push(
    `Duplicatas: ${result.duplicateTexts}`
  );

  lines.push(
    `Conflitos: ${result.conflictingTexts}`
  );

  lines.push(
    `Balanceado: ${
      result.isBalanced
        ? 'sim'
        : 'não'
    }`
  );

  lines.push(
    `Válido: ${
      result.isValid
        ? 'sim'
        : 'não'
    }`
  );

  lines.push('');

  lines.push(
    'Distribuição:'
  );

  for (
    const entry of
      result.distribution
  ) {
    lines.push(
      `- ${entry.intent}: ` +
      `${entry.count} ` +
      `(${(entry.percentage * 100).toFixed(2)}%)`
    );
  }

  if (
    result.errors.length > 0
  ) {
    lines.push('');
    lines.push(
      'Erros:'
    );

    for (
      const error of
        result.errors
    ) {
      lines.push(
        `- ${error}`
      );
    }
  }

  if (
    result.warnings.length > 0
  ) {
    lines.push('');
    lines.push(
      'Avisos:'
    );

    for (
      const warning of
        result.warnings
    ) {
      lines.push(
        `- ${warning}`
      );
    }
  }

  if (
    result.conflicts.length > 0
  ) {
    lines.push('');
    lines.push(
      'Conflitos:'
    );

    for (
      const conflict of
        result.conflicts
    ) {
      lines.push(
        `- "${conflict.text}" → ${conflict.intents.join(', ')}`
      );
    }
  }

  return lines.join('\n');
}