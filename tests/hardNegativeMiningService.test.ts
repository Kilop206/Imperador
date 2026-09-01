import assert from "node:assert/strict";
import test from "node:test";

import {
  HardNegativeMiningService,
} from "../src/intelligence/hardNegativeMiningService";

import type {
  SemanticPrediction,
} from "../src/intelligence/semanticErrorAnalysis";

function createPredictions():
  SemanticPrediction[] {
  return [
    {
      first: "Por que Roma caiu?",
      second: "Como funcionava o exercito romano?",
      expected: 0,
      predicted: 1,
      score: 0.91,
      errorType: "false-positive",
    },
    {
      first: "Como criar uma API?",
      second: "Como armazenar dados?",
      expected: 0,
      predicted: 1,
      score: 0.84,
      errorType: "false-positive",
    },
    {
      first: "Roma entrou em decadencia?",
      second: "Qual foi a causa da queda de Roma?",
      expected: 1,
      predicted: 0,
      score: 0.21,
      errorType: "false-negative",
    },
    {
      first: "Computadores processam dados?",
      second: "Computadores processam informacoes?",
      expected: 1,
      predicted: 1,
      score: 0.88,
      errorType: "false-positive",
    },
  ];
}

test("deve extrair hard negatives dos falsos positivos", () => {
  const service =
    new HardNegativeMiningService();

  const mined = service.mine(
    createPredictions(),
  );

  assert.ok(mined.length > 0);

  for (const example of mined) {
    assert.equal(
      example.label,
      0,
    );

    assert.equal(
      example.source,
      "model-error",
    );

    assert.ok(
      example.score >= 0.5,
    );
  }
});

test("não deve extrair falsos negativos", () => {
  const service =
    new HardNegativeMiningService();

  const mined = service.mine([
    {
      first: "Roma caiu",
      second: "Roma entrou em decadencia",
      expected: 1,
      predicted: 0,
      score: 0.2,
      errorType: "false-negative",
    },
  ]);

  assert.equal(
    mined.length,
    0,
  );
});

test("deve respeitar minimumScore", () => {
  const service =
    new HardNegativeMiningService();

  const mined = service.mine(
    createPredictions(),
    {
      minimumScore: 0.9,
    },
  );

  assert.equal(
    mined.length,
    1,
  );

  assert.equal(
    mined[0].score,
    0.91,
  );
});

test("deve respeitar maxExamples", () => {
  const service =
    new HardNegativeMiningService();

  const mined = service.mine(
    createPredictions(),
    {
      maxExamples: 1,
      minimumScore: 0,
    },
  );

  assert.equal(
    mined.length,
    1,
  );
});

test("não deve duplicar pares", () => {
  const service =
    new HardNegativeMiningService();

  const predictions =
    createPredictions();

  const first = service.mine(
    predictions,
  );

  const second = service.mine(
    predictions,
  );

  assert.ok(
    first.length > 0,
  );

  assert.equal(
    second.length,
    0,
  );

  assert.equal(
    service.getExampleCount(),
    first.length,
  );
});

test("deve considerar par invertido como duplicata", () => {
  const service =
    new HardNegativeMiningService();

  service.mine([
    {
      first: "Roma caiu",
      second: "Exercito romano",
      expected: 0,
      predicted: 1,
      score: 0.9,
      errorType: "false-positive",
    },
  ]);

  const second =
    service.mine([
      {
        first: "Exercito romano",
        second: "Roma caiu",
        expected: 0,
        predicted: 1,
        score: 0.95,
        errorType: "false-positive",
      },
    ]);

  assert.equal(
    second.length,
    0,
  );
});

test("deve converter hard negatives em exemplos de treinamento", () => {
  const service =
    new HardNegativeMiningService();

  service.mine(
    createPredictions(),
  );

  const training =
    service.toTrainingExamples();

  assert.ok(
    training.length > 0,
  );

  for (const example of training) {
    assert.equal(
      example.label,
      0,
    );
  }
});

test("deve remover um exemplo", () => {
  const service =
    new HardNegativeMiningService();

  service.mine(
    createPredictions(),
  );

  const before =
    service.getExampleCount();

  const removed =
    service.remove(
      "Por que Roma caiu?",
      "Como funcionava o exercito romano?",
    );

  assert.equal(
    removed,
    true,
  );

  assert.equal(
    service.getExampleCount(),
    before - 1,
  );
});

test("remover exemplo inexistente deve retornar false", () => {
  const service =
    new HardNegativeMiningService();

  assert.equal(
    service.remove(
      "nao existe",
      "tambem nao existe",
    ),
    false,
  );
});

test("deve exportar e importar exemplos", () => {
  const original =
    new HardNegativeMiningService();

  original.mine(
    createPredictions(),
  );

  const exported =
    original.exportData();

  const restored =
    new HardNegativeMiningService();

  restored.importData(
    exported,
  );

  assert.equal(
    restored.getExampleCount(),
    original.getExampleCount(),
  );

  assert.deepEqual(
    restored.getExamples(),
    original.getExamples(),
  );
});

test("clear deve remover todos os exemplos", () => {
  const service =
    new HardNegativeMiningService();

  service.mine(
    createPredictions(),
  );

  assert.ok(
    service.getExampleCount() > 0,
  );

  service.clear();

  assert.equal(
    service.getExampleCount(),
    0,
  );
});

test("getExamples deve retornar cópia dos dados", () => {
  const service =
    new HardNegativeMiningService();

  service.mine(
    createPredictions(),
  );

  const examples =
    service.getExamples();

  examples.pop();

  assert.notEqual(
    examples.length,
    service.getExampleCount(),
  );
});

test("input inválido deve gerar erro", () => {
  const service =
    new HardNegativeMiningService();

  assert.throws(() =>
    service.mine(
      "invalid" as unknown as SemanticPrediction[],
    ),
  );

  assert.throws(() =>
    service.importData(
      "invalid" as unknown as [],
    ),
  );
});