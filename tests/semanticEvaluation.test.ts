import assert from "node:assert/strict";
import test from "node:test";

import {
  SEMANTIC_SENTENCE_DATASET,
} from "../src/intelligence/semanticSentenceDataset";

import {
  evaluateTfidf,
  evaluateNeural,
  evaluateSemanticModels,
  formatMetrics,
  formatEvaluationReport,
} from "../src/intelligence/semanticEvaluation";

import {
  splitSemanticDataset,
} from "../src/intelligence/semanticDatasetSplit";

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
    "Como criar uma API",
    "Como armazenar dados em um banco de dados",
    "Computadores trocam dados por uma rede",
    "Escrever software exige programacao",
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

function createSplit() {
  return splitSemanticDataset(
    SEMANTIC_SENTENCE_DATASET,
    {
      trainRatio: 0.7,
      validationRatio: 0.15,
      seed: 42,
    },
  );
}

test("split deve separar treino, validação e teste", () => {
  const {
    train,
    validation,
    test: finalTest,
  } = createSplit();

  assert.ok(train.length > 0);
  assert.ok(validation.length > 0);
  assert.ok(finalTest.length > 0);

  assert.equal(
    train.length +
      validation.length +
      finalTest.length,
    SEMANTIC_SENTENCE_DATASET.length,
  );
});

test("split deve ser determinístico", () => {
  const first = createSplit();
  const second = createSplit();

  assert.deepEqual(first, second);
});

test("avaliação TF-IDF deve retornar métricas válidas", () => {
  const {
    train,
    validation,
  } = createSplit();

  const metrics = evaluateTfidf(
    train,
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
    train,
    validation,
  } = createSplit();

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
    train,
    validation,
  } = createSplit();

  const wordModel =
    createWordModel();

  const sentenceModel =
    createSentenceModel(wordModel);

  const result =
    evaluateSemanticModels(
      wordModel,
      sentenceModel,
      train,
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
    train,
    validation,
  } = createSplit();

  const metrics = evaluateTfidf(
    train,
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
    train,
    validation,
  } = createSplit();

  const metrics = evaluateTfidf(
    train,
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
    train,
    validation,
  } = createSplit();

  const wordModel =
    createWordModel();

  const sentenceModel =
    createSentenceModel(wordModel);

  const result =
    evaluateSemanticModels(
      wordModel,
      sentenceModel,
      train,
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

test("teste final deve permanecer separado do treinamento", () => {
  const {
    train,
    validation,
    test: finalTest,
  } = createSplit();

  const trainingSignatures =
    new Set(
      train.map(
        (pair) =>
          `${pair.label}|${pair.first}|${pair.second}`,
      ),
    );

  const validationSignatures =
    new Set(
      validation.map(
        (pair) =>
          `${pair.label}|${pair.first}|${pair.second}`,
      ),
    );

  const testSignatures =
    new Set(
      finalTest.map(
        (pair) =>
          `${pair.label}|${pair.first}|${pair.second}`,
      ),
    );

  for (const signature of testSignatures) {
    assert.equal(
      trainingSignatures.has(signature),
      false,
    );

    assert.equal(
      validationSignatures.has(signature),
      false,
    );
  }
});

test("teste final deve possuir exemplos positivos e negativos", () => {
  const {
    test: finalTest,
  } = createSplit();

  const positiveCount =
    finalTest.filter(
      (pair) => pair.label === 1,
    ).length;

  const negativeCount =
    finalTest.filter(
      (pair) => pair.label === 0,
    ).length;

  assert.ok(positiveCount > 0);
  assert.ok(negativeCount > 0);
});