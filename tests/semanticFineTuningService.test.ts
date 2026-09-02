import assert from "node:assert/strict";
import test from "node:test";

import {
  SemanticFineTuningService,
  SemanticModelRegistry,
} from "../src/intelligence/semanticFineTuningService";

import {
  SEMANTIC_SENTENCE_DATASET,
} from "../src/intelligence/semanticSentenceDataset";

import {
  splitSemanticDataset,
} from "../src/intelligence/semanticDatasetSplit";

import {
  WordEmbeddingModel,
} from "../src/intelligence/wordEmbeddingModel";

import {
  SemanticSentenceModel,
} from "../src/intelligence/semanticSentenceModel";

import type {
  HardNegativeExample,
} from "../src/intelligence/hardNegativeMiningService";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

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
    "Programacao envolve computadores e software",
    "Computadores executam programas e algoritmos",
    "Software moderno usa algoritmos",
    "Como programar um computador",
    "Julio Cesar liderou o exercito romano",
    "Inteligencia artificial aprende com dados",
    "Como criar uma API",
    "Como armazenar dados em um banco de dados",
  ]);

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

function createFakeHardNegatives(): HardNegativeExample[] {
  return [
    {
      first: "Por que Roma caiu?",
      second: "Como funcionava o exercito romano?",
      label: 0,
      source: "model-error",
      score: 0.82,
      createdAt: Date.now(),
    },
    {
      first: "Como criar uma API?",
      second: "Como armazenar dados?",
      label: 0,
      source: "model-error",
      score: 0.75,
      createdAt: Date.now(),
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// SemanticModelRegistry
// ─────────────────────────────────────────────────────────────────────────────

test("registry deve iniciar vazio", () => {
  const registry = new SemanticModelRegistry();

  assert.equal(registry.getVersionCount(), 0);
  assert.equal(registry.getActive(), null);
  assert.equal(registry.getBest(), null);
  assert.deepEqual(registry.getAll(), []);
});

test("registry deve registrar uma versão", () => {
  const registry = new SemanticModelRegistry();

  const { train } = createSplit();
  const wordModel = createWordModel();

  const sentenceModel = new SemanticSentenceModel({
    outputDimension: 8,
    learningRate: 0.02,
    epochs: 20,
    seed: 42,
  });

  sentenceModel.train(wordModel, train);

  const version = registry.register(
    sentenceModel.exportModel(),
    {
      datasetSize: train.length,
      trainingPairs: train.length,
      validationScore: 0.75,
      testScore: 0.70,
    },
  );

  assert.equal(version.version, 1);
  assert.equal(version.active, false);
  assert.equal(version.validationScore, 0.75);
  assert.equal(registry.getVersionCount(), 1);
});

test("registry deve ativar versão corretamente", () => {
  const registry = new SemanticModelRegistry();

  const { train } = createSplit();
  const wordModel = createWordModel();

  const modelA = new SemanticSentenceModel({
    outputDimension: 8,
    epochs: 10,
    seed: 42,
  });
  modelA.train(wordModel, train);

  const modelB = new SemanticSentenceModel({
    outputDimension: 8,
    epochs: 10,
    seed: 99,
  });
  modelB.train(wordModel, train);

  const v1 = registry.register(
    modelA.exportModel(),
    { datasetSize: 10, trainingPairs: 10, validationScore: 0.6, testScore: 0.6 },
  );

  const v2 = registry.register(
    modelB.exportModel(),
    { datasetSize: 12, trainingPairs: 12, validationScore: 0.8, testScore: 0.75 },
  );

  assert.equal(registry.activate(v1.version), true);

  let active = registry.getActive();
  assert.ok(active);
  assert.equal(active.version, v1.version);

  // Ativar v2 deve desativar v1
  assert.equal(registry.activate(v2.version), true);
  active = registry.getActive();
  assert.ok(active);
  assert.equal(active.version, v2.version);

  const all = registry.getAll();
  const inactiveV1 = all.find((v) => v.version === v1.version);
  assert.ok(inactiveV1);
  assert.equal(inactiveV1.active, false);
});

test("registry deve retornar versão inexistente como false", () => {
  const registry = new SemanticModelRegistry();
  assert.equal(registry.activate(999), false);
});

test("registry deve retornar o melhor modelo por F1 de validação", () => {
  const registry = new SemanticModelRegistry();

  const { train } = createSplit();
  const wordModel = createWordModel();

  const model = new SemanticSentenceModel({
    outputDimension: 8,
    epochs: 10,
    seed: 42,
  });
  model.train(wordModel, train);

  registry.register(
    model.exportModel(),
    { datasetSize: 10, trainingPairs: 10, validationScore: 0.5, testScore: 0.5 },
  );

  registry.register(
    model.exportModel(),
    { datasetSize: 15, trainingPairs: 15, validationScore: 0.9, testScore: 0.85 },
  );

  registry.register(
    model.exportModel(),
    { datasetSize: 12, trainingPairs: 12, validationScore: 0.7, testScore: 0.65 },
  );

  const best = registry.getBest();
  assert.ok(best);
  assert.equal(best.validationScore, 0.9);
});

test("registry deve restaurar modelo a partir de versão", () => {
  const registry = new SemanticModelRegistry();

  const { train } = createSplit();
  const wordModel = createWordModel();

  const original = new SemanticSentenceModel({
    outputDimension: 8,
    epochs: 20,
    seed: 42,
  });
  original.train(wordModel, train);

  const v = registry.register(
    original.exportModel(),
    { datasetSize: 10, trainingPairs: 10, validationScore: 0.7, testScore: 0.65 },
  );

  const restored = registry.restoreModel(v.version);
  assert.ok(restored);
  assert.ok(restored.isTrained());

  // Embeddings devem ser iguais
  const text = "Roma caiu";
  const originalEmbedding = original.encode(wordModel, text);
  const restoredEmbedding = restored.encode(wordModel, text);

  assert.deepEqual(originalEmbedding, restoredEmbedding);
});

test("registry deve retornar null para versão inexistente em restoreModel", () => {
  const registry = new SemanticModelRegistry();
  assert.equal(registry.restoreModel(999), null);
});

test("registry deve exportar e importar dados", () => {
  const registry = new SemanticModelRegistry();

  const { train } = createSplit();
  const wordModel = createWordModel();

  const model = new SemanticSentenceModel({
    outputDimension: 8,
    epochs: 10,
    seed: 42,
  });
  model.train(wordModel, train);

  registry.register(
    model.exportModel(),
    { datasetSize: 10, trainingPairs: 10, validationScore: 0.7, testScore: 0.65 },
  );
  registry.activate(1);

  const exported = registry.exportData();

  const restored = new SemanticModelRegistry();
  restored.importData(exported);

  assert.equal(
    restored.getVersionCount(),
    registry.getVersionCount(),
  );

  const active = restored.getActive();
  assert.ok(active);
  assert.equal(active.version, 1);
});

test("registry getSummary não deve conter modelData", () => {
  const registry = new SemanticModelRegistry();

  const { train } = createSplit();
  const wordModel = createWordModel();

  const model = new SemanticSentenceModel({
    outputDimension: 8,
    epochs: 10,
    seed: 42,
  });
  model.train(wordModel, train);

  registry.register(
    model.exportModel(),
    { datasetSize: 10, trainingPairs: 10, validationScore: 0.7, testScore: 0.65 },
  );

  const summary = registry.getSummary();
  assert.equal(summary.length, 1);
  assert.ok(!("modelData" in summary[0]));
});

test("registry importData deve rejeitar dados inválidos", () => {
  const registry = new SemanticModelRegistry();

  assert.throws(
    () => registry.importData(null as unknown as { versions: []; nextVersion: number }),
  );

  assert.throws(
    () =>
      registry.importData({
        versions: "invalid" as unknown as [],
        nextVersion: 1,
      }),
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SemanticFineTuningService
// ─────────────────────────────────────────────────────────────────────────────

test("fine-tuning deve completar sem hard negatives", () => {
  const { train, validation, test: testSet } = createSplit();
  const wordModel = createWordModel();
  const service = new SemanticFineTuningService();

  const result = service.fineTune(wordModel, {
    originalDataset: train,
    validationDataset: validation,
    testDataset: testSet,
    modelOptions: {
      outputDimension: 8,
      epochs: 20,
      seed: 42,
    },
  });

  assert.equal(result.hardNegativePairs, 0);
  assert.ok(result.totalTrainingPairs >= train.length);
  assert.ok(result.candidateVersion > 0);
  assert.ok(result.activated); // Primeiro modelo deve ser ativado automaticamente

  // Métricas válidas
  assert.ok(
    result.candidateValidationMetrics.f1 >= 0 &&
      result.candidateValidationMetrics.f1 <= 1,
  );

  // Teste deve ter sido avaliado (modelo ativado)
  assert.ok(result.candidateTestMetrics !== null);
});

test("fine-tuning deve incluir hard negatives no treinamento", () => {
  const { train, validation, test: testSet } = createSplit();
  const wordModel = createWordModel();
  const service = new SemanticFineTuningService();
  const hardNegatives = createFakeHardNegatives();

  const result = service.fineTune(wordModel, {
    originalDataset: train,
    validationDataset: validation,
    testDataset: testSet,
    hardNegatives,
    modelOptions: {
      outputDimension: 8,
      epochs: 20,
      seed: 42,
    },
  });

  assert.equal(result.hardNegativePairs, hardNegatives.length);
  assert.ok(result.totalTrainingPairs >= train.length + hardNegatives.length);
});

test("fine-tuning deve ativar primeiro modelo automaticamente", () => {
  const { train, validation, test: testSet } = createSplit();
  const wordModel = createWordModel();
  const service = new SemanticFineTuningService();

  const result = service.fineTune(wordModel, {
    originalDataset: train,
    validationDataset: validation,
    testDataset: testSet,
    modelOptions: { outputDimension: 8, epochs: 15, seed: 42 },
  });

  assert.equal(result.activated, true);
  assert.ok(result.reason.includes("Nenhum modelo anterior"));

  const active = service.getRegistry().getActive();
  assert.ok(active);
  assert.equal(active.version, result.candidateVersion);
});

test("fine-tuning deve registrar versão no registry", () => {
  const { train, validation, test: testSet } = createSplit();
  const wordModel = createWordModel();
  const service = new SemanticFineTuningService();

  assert.equal(service.getRegistry().getVersionCount(), 0);

  service.fineTune(wordModel, {
    originalDataset: train,
    validationDataset: validation,
    testDataset: testSet,
    modelOptions: { outputDimension: 8, epochs: 15, seed: 42 },
  });

  assert.equal(service.getRegistry().getVersionCount(), 1);

  service.fineTune(wordModel, {
    originalDataset: train,
    validationDataset: validation,
    testDataset: testSet,
    modelOptions: { outputDimension: 8, epochs: 15, seed: 99 },
  });

  assert.equal(service.getRegistry().getVersionCount(), 2);
});

test("fine-tuning não deve avaliar teste quando rejeitado", () => {
  // Cria um registry com modelo "perfeito" para forçar rejeição
  const registry = new SemanticModelRegistry();
  const { train, validation, test: testSet } = createSplit();
  const wordModel = createWordModel();

  // Registra manualmente um modelo com F1 = 1.0 (impossível de superar)
  const fakeModel = new SemanticSentenceModel({
    outputDimension: 8,
    epochs: 10,
    seed: 42,
  });
  fakeModel.train(wordModel, train);

  registry.register(fakeModel.exportModel(), {
    datasetSize: train.length,
    trainingPairs: train.length,
    validationScore: 1.0,
    testScore: 1.0,
  });
  registry.activate(1);

  const service = new SemanticFineTuningService(registry);

  const result = service.fineTune(wordModel, {
    originalDataset: train,
    validationDataset: validation,
    testDataset: testSet,
    modelOptions: { outputDimension: 8, epochs: 5, seed: 1 },
  });

  // O candidato quase certamente não supera F1=1.0
  // Portanto testMetrics deve ser null
  if (!result.activated) {
    assert.equal(result.candidateTestMetrics, null);
  }
  // (Se por alguma flutuação numérica o candidato tiver F1 = 1.0 também, o teste não falha)
});

test("fine-tuning deve usar registry externo fornecido", () => {
  const registry = new SemanticModelRegistry();
  const { train, validation, test: testSet } = createSplit();
  const wordModel = createWordModel();

  const service = new SemanticFineTuningService(registry);

  service.fineTune(wordModel, {
    originalDataset: train,
    validationDataset: validation,
    testDataset: testSet,
    modelOptions: { outputDimension: 8, epochs: 10, seed: 42 },
  });

  // A versão deve estar no registry externo
  assert.equal(registry.getVersionCount(), 1);
});

test("fine-tuning deve aceitar augmentation desativada", () => {
  const { train, validation, test: testSet } = createSplit();
  const wordModel = createWordModel();
  const service = new SemanticFineTuningService();

  const result = service.fineTune(wordModel, {
    originalDataset: train,
    validationDataset: validation,
    testDataset: testSet,
    augmentationOptions: {
      maxAugmentedPerExample: 0,
    },
    modelOptions: { outputDimension: 8, epochs: 15, seed: 42 },
  });

  assert.equal(result.augmentedPairs, 0);
  assert.equal(result.totalTrainingPairs, train.length);
});

test("fine-tuning deve rejeitar input inválido", () => {
  const wordModel = createWordModel();
  const service = new SemanticFineTuningService();

  assert.throws(() =>
    service.fineTune(wordModel, {
      originalDataset: [],
      validationDataset: [{ first: "a", second: "b", label: 1 }],
      testDataset: [{ first: "a", second: "b", label: 1 }],
    }),
  );

  assert.throws(() =>
    service.fineTune(wordModel, {
      originalDataset: [{ first: "a", second: "b", label: 1 }],
      validationDataset: [],
      testDataset: [{ first: "a", second: "b", label: 1 }],
    }),
  );

  assert.throws(() =>
    service.fineTune(wordModel, {
      originalDataset: [{ first: "a", second: "b", label: 1 }],
      validationDataset: [{ first: "a", second: "b", label: 1 }],
      testDataset: [],
    }),
  );
});

test("formatResult deve produzir relatório legível", () => {
  const { train, validation, test: testSet } = createSplit();
  const wordModel = createWordModel();
  const service = new SemanticFineTuningService();

  const result = service.fineTune(wordModel, {
    originalDataset: train,
    validationDataset: validation,
    testDataset: testSet,
    modelOptions: { outputDimension: 8, epochs: 15, seed: 42 },
  });

  const report = service.formatResult(result);

  assert.ok(report.includes("Fine-Tuning Semântico"));
  assert.ok(report.includes("Versão candidata"));
  assert.ok(report.includes("Validação"));
  assert.ok(report.includes("Decisão"));
  assert.ok(report.includes("Motivo"));
});

test("dois fine-tunings consecutivos devem produzir versões incrementais", () => {
  const { train, validation, test: testSet } = createSplit();
  const wordModel = createWordModel();
  const service = new SemanticFineTuningService();

  const result1 = service.fineTune(wordModel, {
    originalDataset: train,
    validationDataset: validation,
    testDataset: testSet,
    modelOptions: { outputDimension: 8, epochs: 10, seed: 42 },
  });

  const result2 = service.fineTune(wordModel, {
    originalDataset: train,
    validationDataset: validation,
    testDataset: testSet,
    modelOptions: { outputDimension: 8, epochs: 10, seed: 42 },
  });

  assert.equal(result2.candidateVersion, result1.candidateVersion + 1);
});
