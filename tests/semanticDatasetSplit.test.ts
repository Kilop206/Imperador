import assert from "node:assert/strict";
import test from "node:test";

import {
  SEMANTIC_SENTENCE_DATASET,
} from "../src/intelligence/semanticSentenceDataset";

import {
  splitSemanticDataset,
  labelDatasetSplit,
  getClassDistribution,
} from "../src/intelligence/semanticDatasetSplit";

test("dataset expandido deve possuir exemplos suficientes", () => {
  assert.ok(
    SEMANTIC_SENTENCE_DATASET.length >= 50,
  );
});

test("dataset deve possuir classes positivas e negativas", () => {
  const distribution =
    getClassDistribution(
      SEMANTIC_SENTENCE_DATASET,
    );

  assert.ok(
    distribution.positive > 0,
  );

  assert.ok(
    distribution.negative > 0,
  );

  assert.equal(
    distribution.total,
    SEMANTIC_SENTENCE_DATASET.length,
  );
});

test("split deve produzir treino, validação e teste", () => {
  const split =
    splitSemanticDataset(
      SEMANTIC_SENTENCE_DATASET,
      {
        seed: 42,
      },
    );

  assert.ok(split.train.length > 0);
  assert.ok(split.validation.length > 0);
  assert.ok(split.test.length > 0);

  assert.equal(
    split.train.length +
      split.validation.length +
      split.test.length,
    SEMANTIC_SENTENCE_DATASET.length,
  );
});

test("split deve ser determinístico", () => {
  const first =
    splitSemanticDataset(
      SEMANTIC_SENTENCE_DATASET,
      {
        seed: 42,
      },
    );

  const second =
    splitSemanticDataset(
      SEMANTIC_SENTENCE_DATASET,
      {
        seed: 42,
      },
    );

  assert.deepEqual(
    first,
    second,
  );
});

test("seeds diferentes devem poder produzir divisões diferentes", () => {
  const first =
    splitSemanticDataset(
      SEMANTIC_SENTENCE_DATASET,
      {
        seed: 42,
      },
    );

  const second =
    splitSemanticDataset(
      SEMANTIC_SENTENCE_DATASET,
      {
        seed: 123,
      },
    );

  assert.notDeepEqual(
    first,
    second,
  );
});

test("cada split deve possuir exemplos positivos e negativos", () => {
  const split =
    splitSemanticDataset(
      SEMANTIC_SENTENCE_DATASET,
      {
        seed: 42,
      },
    );

  for (const dataset of [
    split.train,
    split.validation,
    split.test,
  ]) {
    const distribution =
      getClassDistribution(dataset);

    assert.ok(
      distribution.positive > 0,
    );

    assert.ok(
      distribution.negative > 0,
    );
  }
});

test("os conjuntos não devem conter referências duplicadas", () => {
  const split =
    splitSemanticDataset(
      SEMANTIC_SENTENCE_DATASET,
      {
        seed: 42,
      },
    );

  const all = [
    ...split.train,
    ...split.validation,
    ...split.test,
  ];

  const signatures =
    all.map(
      (pair) =>
        `${pair.label}|${pair.first}|${pair.second}`,
    );

  assert.equal(
    new Set(signatures).size,
    signatures.length,
  );
});

test("labelDatasetSplit deve rotular corretamente cada conjunto", () => {
  const split =
    splitSemanticDataset(
      SEMANTIC_SENTENCE_DATASET,
      {
        seed: 42,
      },
    );

  const labeled =
    labelDatasetSplit(split);

  assert.ok(
    labeled.train.every(
      (pair) => pair.split === "train",
    ),
  );

  assert.ok(
    labeled.validation.every(
      (pair) =>
        pair.split === "validation",
    ),
  );

  assert.ok(
    labeled.test.every(
      (pair) => pair.split === "test",
    ),
  );
});

test("proporções inválidas devem gerar erro", () => {
  assert.throws(() =>
    splitSemanticDataset(
      SEMANTIC_SENTENCE_DATASET,
      {
        trainRatio: 0.9,
        validationRatio: 0.2,
      },
    ),
  );
});

test("dataset pequeno demais deve gerar erro", () => {
  assert.throws(() =>
    splitSemanticDataset([
      {
        first: "a",
        second: "b",
        label: 1,
      },
      {
        first: "c",
        second: "d",
        label: 0,
      },
    ]),
  );
});