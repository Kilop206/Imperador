import {
  SemanticSentenceModel,
} from "./semanticSentenceModel";

import {
  WordEmbeddingModel,
} from "./wordEmbeddingModel";

import {
  TfidfVectorizer,
} from "./tfidfVectorizer";

import type {
  SemanticSentencePair,
} from "./semanticSentenceDataset";

export type SemanticErrorType =
  | "false-positive"
  | "false-negative";

export interface SemanticPrediction {
  first: string;
  second: string;
  expected: 0 | 1;
  predicted: 0 | 1;
  score: number;
  errorType: SemanticErrorType;
}

export interface SemanticErrorAnalysis {
  total: number;
  correct: number;
  incorrect: number;
  falsePositive: SemanticPrediction[];
  falseNegative: SemanticPrediction[];
  predictions: SemanticPrediction[];
}

export interface SemanticErrorAnalysisOptions {
  threshold?: number;
}

export function analyzeTfidfErrors(
  training: SemanticSentencePair[],
  test: SemanticSentencePair[],
  options: SemanticErrorAnalysisOptions = {},
): SemanticErrorAnalysis {
  const threshold =
    options.threshold ?? 0.5;

  const vectorizer =
    new TfidfVectorizer();

  const documents: string[] = [];

  for (const pair of training) {
    documents.push(pair.first);
    documents.push(pair.second);
  }

  vectorizer.fit(documents);

  const predictions = test.map(
    (pair) => {
      const firstVector =
        vectorizer.transformOne(
          pair.first,
        );

      const secondVector =
        vectorizer.transformOne(
          pair.second,
        );

      const score =
        TfidfVectorizer.cosineSimilarity(
          firstVector,
          secondVector,
        );

      return createPrediction(
        pair,
        score,
        threshold,
      );
    },
  );

  return buildAnalysis(predictions);
}

export function analyzeNeuralErrors(
  wordModel: WordEmbeddingModel,
  sentenceModel: SemanticSentenceModel,
  test: SemanticSentencePair[],
  options: SemanticErrorAnalysisOptions = {},
): SemanticErrorAnalysis {
  const threshold =
    options.threshold ?? 0.5;

  const predictions = test.map(
    (pair) => {
      const score =
        sentenceModel.similarity(
          wordModel,
          pair.first,
          pair.second,
        );

      return createPrediction(
        pair,
        score,
        threshold,
      );
    },
  );

  return buildAnalysis(predictions);
}

export function formatPrediction(
  prediction: SemanticPrediction,
): string {
  const expected =
    prediction.expected === 1
      ? "RELACIONADAS"
      : "NÃO RELACIONADAS";

  const predicted =
    prediction.predicted === 1
      ? "RELACIONADAS"
      : "NÃO RELACIONADAS";

  const errorLabel =
    prediction.errorType ===
    "false-positive"
      ? "FALSO POSITIVO"
      : "FALSO NEGATIVO";

  return [
    `Tipo: ${errorLabel}`,
    `Frase A: ${prediction.first}`,
    `Frase B: ${prediction.second}`,
    `Esperado: ${expected}`,
    `Modelo: ${predicted}`,
    `Score: ${prediction.score.toFixed(4)}`,
  ].join("\n");
}

export function formatErrorAnalysis(
  name: string,
  analysis: SemanticErrorAnalysis,
): string {
  const lines = [
    `=== ${name} ===`,
    `Total: ${analysis.total}`,
    `Acertos: ${analysis.correct}`,
    `Erros: ${analysis.incorrect}`,
    `Falsos positivos: ${analysis.falsePositive.length}`,
    `Falsos negativos: ${analysis.falseNegative.length}`,
  ];

  if (analysis.incorrect === 0) {
    lines.push(
      "",
      "Nenhum erro encontrado.",
    );

    return lines.join("\n");
  }

  lines.push("", "ERROS:");

  for (const prediction of analysis.predictions) {
    if (
      prediction.expected !==
      prediction.predicted
    ) {
      lines.push(
        "",
        formatPrediction(prediction),
      );
    }
  }

  return lines.join("\n");
}

export function getHardestErrors(
  analysis: SemanticErrorAnalysis,
  limit = 5,
): SemanticPrediction[] {
  return analysis.predictions
    .filter(
      (prediction) =>
        prediction.expected !==
        prediction.predicted,
    )
    .sort(
      (first, second) =>
        getErrorDifficulty(second) -
        getErrorDifficulty(first),
    )
    .slice(0, Math.max(1, limit));
}

function createPrediction(
  pair: SemanticSentencePair,
  score: number,
  threshold: number,
): SemanticPrediction {
  const predicted =
    score >= threshold ? 1 : 0;

  const errorType =
    predicted === pair.label
      ? null
      : predicted === 1
        ? "false-positive"
        : "false-negative";

  return {
    first: pair.first,
    second: pair.second,
    expected: pair.label,
    predicted,
    score,
    errorType:
      errorType ?? "false-positive",
  };
}

function buildAnalysis(
  predictions: SemanticPrediction[],
): SemanticErrorAnalysis {
  const falsePositive =
    predictions.filter(
      (prediction) =>
        prediction.expected === 0 &&
        prediction.predicted === 1,
    );

  const falseNegative =
    predictions.filter(
      (prediction) =>
        prediction.expected === 1 &&
        prediction.predicted === 0,
    );

  const incorrect =
    falsePositive.length +
    falseNegative.length;

  return {
    total: predictions.length,
    correct: predictions.length - incorrect,
    incorrect,
    falsePositive,
    falseNegative,
    predictions,
  };
}

function getErrorDifficulty(
  prediction: SemanticPrediction,
): number {
  if (
    prediction.errorType ===
    "false-positive"
  ) {
    return prediction.score;
  }

  return 1 - prediction.score;
}