import assert from "node:assert/strict";
import test from "node:test";

import {
  WordEmbeddingModel,
} from "../src/intelligence/wordEmbeddingModel";

function createModel(): WordEmbeddingModel {
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
    "Roma possuia um exercito romano poderoso",
    "O imperio caiu depois de muitas guerras",
    "As guerras enfraqueceram o imperio romano",
    "Programacao envolve computadores e software",
    "Computadores executam programas e algoritmos",
    "Software moderno usa algoritmos",
  ]);

  return model;
}

test("modelo inicialmente não deve estar treinado", () => {
  const model = new WordEmbeddingModel();

  assert.equal(model.isTrained(), false);
  assert.equal(model.getVocabularySize(), 0);
});

test("modelo deve aprender um vocabulário", () => {
  const model = createModel();

  assert.equal(model.isTrained(), true);
  assert.ok(model.getVocabularySize() > 0);
  assert.ok(model.getVocabulary().includes("roma"));
  assert.ok(model.getVocabulary().includes("romano"));
});

test("modelo deve gerar embeddings com a dimensão configurada", () => {
  const model = createModel();

  const vector = model.encodeWord("roma");

  assert.ok(vector !== null);
  assert.equal(vector?.length, 16);
});

test("palavra desconhecida deve retornar null", () => {
  const model = createModel();

  assert.equal(
    model.encodeWord("astronauta"),
    null,
  );
});

test("texto deve gerar embedding", () => {
  const model = createModel();

  const vector = model.encodeText(
    "Roma e imperio romano",
  );

  assert.equal(vector.length, 16);

  const magnitude = Math.sqrt(
    vector.reduce(
      (sum, value) => sum + value ** 2,
      0,
    ),
  );

  assert.ok(
    Math.abs(magnitude - 1) < 0.000001,
  );
});

test("texto sem palavras conhecidas deve gerar vetor zero", () => {
  const model = createModel();

  const vector = model.encodeText(
    "astronauta galaxia telescopio",
  );

  assert.equal(vector.length, 16);

  assert.equal(
    vector.every((value) => value === 0),
    true,
  );
});

test("similaridade deve ser simétrica", () => {
  const model = createModel();

  const first = model.similarity(
    "Roma imperio romano",
    "Roma governava o imperio",
  );

  const second = model.similarity(
    "Roma governava o imperio",
    "Roma imperio romano",
  );

  assert.ok(
    Math.abs(first - second) < 0.000001,
  );
});

test("texto sem palavras conhecidas deve possuir similaridade zero", () => {
  const model = createModel();

  const score = model.similarity(
    "astronauta galaxia",
    "Roma imperio romano",
  );

  assert.equal(score, 0);
});

test("mostSimilar deve retornar palavras do vocabulário", () => {
  const model = createModel();

  const results = model.mostSimilar(
    "roma",
    3,
  );

  assert.ok(results.length <= 3);

  for (const result of results) {
    assert.ok(
      model.getVocabulary().includes(
        result.word,
      ),
    );

    assert.ok(result.score <= 1);
    assert.ok(result.score >= -1);
  }
});

test("treinamento deve ser determinístico com a mesma seed", () => {
  const first = createModel();
  const second = createModel();

  const firstVector = first.encodeWord("roma");
  const secondVector = second.encodeWord("roma");

  assert.ok(firstVector !== null);
  assert.ok(secondVector !== null);

  assert.deepEqual(
    firstVector,
    secondVector,
  );
});

test("modelo deve poder ser exportado e importado", () => {
  const original = createModel();

  const modelData = original.exportModel();

  const restored = new WordEmbeddingModel({
    dimension: 16,
  });

  restored.importModel(modelData);

  assert.equal(
    restored.getVocabularySize(),
    original.getVocabularySize(),
  );

  assert.deepEqual(
    restored.getVocabulary(),
    original.getVocabulary(),
  );

  const originalVector =
    original.encodeWord("roma");

  const restoredVector =
    restored.encodeWord("roma");

  assert.deepEqual(
    restoredVector,
    originalVector,
  );
});

test("reset deve remover o modelo", () => {
  const model = createModel();

  model.reset();

  assert.equal(model.isTrained(), false);
  assert.equal(model.getVocabularySize(), 0);

  assert.throws(() =>
    model.encodeWord("roma"),
  );
});

test("modelo deve rejeitar corpus vazio", () => {
  const model = new WordEmbeddingModel();

  assert.throws(() =>
    model.train([]),
  );
});