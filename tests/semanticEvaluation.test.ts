import assert from "node:assert/strict";
import test from "node:test";

import {
  SEMANTIC_SENTENCE_DATASET,
} from "../src/intelligence/semanticSentenceDataset";

import {
  splitSemanticDataset,
  evaluateTfidf,
  evaluateNeural,
  evaluateSemanticModels,
  formatMetrics,
  formatEvaluationReport,
} from "../src/intelligence/semanticEvaluation";

import {
  SemanticSentenceModel,
} from "../src/intelligence/semanticSentenceModel";

import {
  WordEmbeddingModel,
} from "../src/intelligence/wordEmbeddingModel";

function createWordModel(): WordEmbeddingModel {
  const model = new WordEmbeddingModel({
    dimension: 16,
    windowSize: 2,
    negativeSamples: 3,
    learningRate: 0.03,
    epochs: 30,
    minCount: 1,
    seed: 42,
  });

  model.train([
    "Roma foi um grande imperio romano",
    "O imperio romano governava Roma",
    "Roma caiu depois de muitas guerras",
    "As guerras provocaram a queda de Roma",
    "Roma entrou em decadencia",
    "O imperio romano entrou em decadencia",
    "A queda de Roma aconteceu depois das guerras",
    "Programacao envolve computadores e software",
    "Computadores executam programas e algoritmos",
    "Software moderno usa algoritmos",
    "Como programar um computador",
    "JavaScript e uma linguagem de programacao",
    "Julio Cesar liderou o exercito romano",
    "O exercito romano era poderoso",
    "Inteligencia artificial aprende com dados",
    "Modelos de inteligencia artificial processam informacao",
  ]);

  return model;
}

function createSentenceModel(
  wordModel: WordEmbeddingModel,
): SemanticSentenceModel {
  const model =
    new SemanticSentenceModel({
      outputDimension: 8,
      learningRate: 0.02,
      epochs: 80,
      margin: 0.35,
      seed: 42,
    });

  model.train(
    wordModel,
    SEMANTIC_SENTENCE_DATASET,
  );

  return model;
}

test("split deve separar treino e validação", () => {
  const result = splitSemanticDataset(
    SEMANTIC_SENTENCE_DATASET,
    0.2,
    42,
  );

  assert.ok(
    result.training.length > 0,
  );

  assert.ok(
    result.validation.length > 0,
  );

  assert.equal(
    result.training.length +
      result.validation.length,
    SEMANTIC_SENTENCE_DATASET.length,
  );
});

test("split deve ser determinístico", () => {
  const first = splitSemanticDataset(
    SEMANTIC_SENTENCE_DATASET,
    0.2,
    42,
  );

  const second = splitSemanticDataset(
    SEMANTIC_SENTENCE_DATASET,
    0.2,
    42,
  );

  assert.deepEqual(
    first,
    second,
  );
});

test("split deve rejeitar proporção inválida", () => {
  assert.throws(() =>
    splitSemanticDataset(
      SEMANTIC_SENTENCE_DATASET,
      0,
    ),
  );

  assert.throws(() =>
    splitSemanticDataset(
      SEMANTIC_SENTENCE_DATASET,
      1,
    ),
  );
});

test("avaliação TF-IDF deve retornar métricas válidas", () => {
  const {
    training,
    validation,
  } = splitSemanticDataset(
    SEMANTIC_SENTENCE_DATASET,
    0.2,
    42,
  );

  const metrics = evaluateTfidf(
    training,
    validation,
  );

  assert.equal(
    metrics.total,
    validation.length,
  );

  assert.equal(
    metrics.positiveCount +
      metrics.negativeCount,
    metrics.total,
  );

  assert.ok(
    metrics.accuracy >= 0 &&
      metrics.accuracy <= 1,
  );

  assert.ok(
    metrics.precision >= 0 &&
      metrics.precision <= 1,
  );

  assert.ok(
    metrics.recall >= 0 &&
      metrics.recall <= 1,
  );

  assert.ok(
    metrics.f1 >= 0 &&
      metrics.f1 <= 1,
  );
});

test("avaliação neural deve retornar métricas válidas", () => {
  const {
    training,
    validation,
  } = splitSemanticDataset(
    SEMANTIC_SENTENCE_DATASET,
    0.2,
    42,
  );

  const wordModel =
    createWordModel();

  const sentenceModel =
    createSentenceModel(wordModel);

  const metrics = evaluateNeural(
    wordModel,
    sentenceModel,
    validation,
  );

  assert.equal(
    metrics.total,
    validation.length,
  );

  assert.equal(
    metrics.positiveCount +
      metrics.negativeCount,
    metrics.total,
  );

  assert.ok(
    metrics.accuracy >= 0 &&
      metrics.accuracy <= 1,
  );

  assert.ok(
    metrics.precision >= 0 &&
      metrics.precision <= 1,
  );

  assert.ok(
    metrics.recall >= 0 &&
      metrics.recall <= 1,
  );

  assert.ok(
    metrics.f1 >= 0 &&
      metrics.f1 <= 1,
  );
});

test("avaliação combinada deve retornar TF-IDF e Neural", () => {
  const {
    training,
    validation,
  } = splitSemanticDataset(
    SEMANTIC_SENTENCE_DATASET,
    0.2,
    42,
  );

  const wordModel =
    createWordModel();

  const sentenceModel =
    createSentenceModel(wordModel);

  const result =
    evaluateSemanticModels(
      wordModel,
      sentenceModel,
      training,
      validation,
    );

  assert.ok(result.tfidf);
  assert.ok(result.neural);

  assert.equal(
    result.tfidf.total,
    validation.length,
  );

  assert.equal(
    result.neural.total,
    validation.length,
  );
});

test("métricas devem possuir matriz de confusão consistente", () => {
  const {
    training,
    validation,
  } = splitSemanticDataset(
    SEMANTIC_SENTENCE_DATASET,
    0.2,
    42,
  );

  const metrics = evaluateTfidf(
    training,
    validation,
  );

  assert.equal(
    metrics.truePositive +
      metrics.trueNegative +
      metrics.falsePositive +
      metrics.falseNegative,
    metrics.total,
  );
});

test("scores médios devem ser calculados separadamente", () => {
  const {
    training,
    validation,
  } = splitSemanticDataset(
    SEMANTIC_SENTENCE_DATASET,
    0.2,
    42,
  );

  const metrics = evaluateTfidf(
    training,
    validation,
  );

  assert.ok(
    metrics.positiveAverageScore >= 0,
  );

  assert.ok(
    metrics.negativeAverageScore >= 0,
  );
});

test("formatMetrics deve produzir relatório", () => {
  const metrics = {
    total: 4,
    positiveCount: 2,
    negativeCount: 2,
    truePositive: 2,
    trueNegative: 1,
    falsePositive: 1,
    falseNegative: 0,
    accuracy: 0.75,
    precision: 0.6667,
    recall: 1,
    f1: 0.8,
    positiveAverageScore: 0.85,
    negativeAverageScore: 0.2,
  };

  const report =
    formatMetrics(
      "Teste",
      metrics,
    );

  assert.ok(
    report.includes("Teste"),
  );

  assert.ok(
    report.includes("Accuracy"),
  );

  assert.ok(
    report.includes("Precision"),
  );

  assert.ok(
    report.includes("Recall"),
  );

  assert.ok(
    report.includes("F1"),
  );
});

test("formatEvaluationReport deve incluir os dois modelos", () => {
  const {
    training,
    validation,
  } = splitSemanticDataset(
    SEMANTIC_SENTENCE_DATASET,
    0.2,
    42,
  );

  const wordModel =
    createWordModel();

  const sentenceModel =
    createSentenceModel(wordModel);

  const result =
    evaluateSemanticModels(
      wordModel,
      sentenceModel,
      training,
      validation,
    );

  const report =
    formatEvaluationReport(result);

  assert.ok(
    report.includes("TF-IDF"),
  );

  assert.ok(
    report.includes("Neural"),
  );
});