import assert from "node:assert/strict";
import test from "node:test";

import {
  SEMANTIC_SENTENCE_DATASET,
} from "../src/intelligence/semanticSentenceDataset";

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
  ]);

  return model;
}

function createSentenceModel(): {
  wordModel: WordEmbeddingModel;
  sentenceModel: SemanticSentenceModel;
} {
  const wordModel = createWordModel();

  const sentenceModel =
    new SemanticSentenceModel({
      outputDimension: 8,
      learningRate: 0.02,
      epochs: 80,
      margin: 0.35,
      seed: 42,
    });

  sentenceModel.train(
    wordModel,
    SEMANTIC_SENTENCE_DATASET,
  );

  return {
    wordModel,
    sentenceModel,
  };
}

test("modelo inicialmente não deve estar treinado", () => {
  const model = new SemanticSentenceModel();

  assert.equal(
    model.isTrained(),
    false,
  );
});

test("modelo deve aprender a dimensão de entrada", () => {
  const wordModel = createWordModel();

  const sentenceModel =
    new SemanticSentenceModel({
      outputDimension: 8,
      epochs: 5,
    });

  sentenceModel.train(
    wordModel,
    SEMANTIC_SENTENCE_DATASET,
  );

  assert.equal(
    sentenceModel.getInputDimension(),
    16,
  );

  assert.equal(
    sentenceModel.getOutputDimension(),
    8,
  );
});

test("modelo deve treinar com pares semânticos", () => {
  const {
    sentenceModel,
  } = createSentenceModel();

  assert.equal(
    sentenceModel.isTrained(),
    true,
  );
});

test("modelo deve gerar embedding de sentença", () => {
  const {
    wordModel,
    sentenceModel,
  } = createSentenceModel();

  const vector = sentenceModel.encode(
    wordModel,
    "Por que Roma caiu?",
  );

  assert.equal(vector.length, 8);

  const magnitude = Math.sqrt(
    vector.reduce(
      (sum, value) =>
        sum + value ** 2,
      0,
    ),
  );

  assert.ok(
    Math.abs(magnitude - 1) < 0.000001,
  );
});

test("frase sem palavras conhecidas deve gerar vetor zero", () => {
  const {
    wordModel,
    sentenceModel,
  } = createSentenceModel();

  const vector = sentenceModel.encode(
    wordModel,
    "astronauta galaxia telescopio",
  );

  assert.equal(
    vector.every((value) => value === 0),
    true,
  );
});

test("frases relacionadas devem possuir similaridade positiva", () => {
  const {
    wordModel,
    sentenceModel,
  } = createSentenceModel();

  const score = sentenceModel.similarity(
    wordModel,
    "Por que Roma caiu?",
    "Qual foi a causa da queda de Roma?",
  );

  assert.ok(score > 0);
});

test("frases completamente diferentes devem possuir score diferente de 1", () => {
  const {
    wordModel,
    sentenceModel,
  } = createSentenceModel();

  const score = sentenceModel.similarity(
    wordModel,
    "Por que Roma caiu?",
    "Como configurar um computador?",
  );

  assert.ok(score < 1);
});

test("similaridade deve ser simétrica", () => {
  const {
    wordModel,
    sentenceModel,
  } = createSentenceModel();

  const first = sentenceModel.similarity(
    wordModel,
    "Roma caiu",
    "Roma entrou em decadencia",
  );

  const second = sentenceModel.similarity(
    wordModel,
    "Roma entrou em decadencia",
    "Roma caiu",
  );

  assert.ok(
    Math.abs(first - second) < 0.000001,
  );
});

test("modelo deve retornar embeddings determinísticos com a mesma seed", () => {
  const first = createSentenceModel();
  const second = createSentenceModel();

  const firstVector =
    first.sentenceModel.encode(
      first.wordModel,
      "Roma caiu",
    );

  const secondVector =
    second.sentenceModel.encode(
      second.wordModel,
      "Roma caiu",
    );

  assert.deepEqual(
    firstVector,
    secondVector,
  );
});

test("modelo deve poder ser exportado e importado", () => {
  const {
    wordModel,
    sentenceModel,
  } = createSentenceModel();

  const exported =
    sentenceModel.exportModel();

  const restored =
    new SemanticSentenceModel({
      outputDimension: 8,
    });

  restored.importModel(exported);

  assert.equal(
    restored.getInputDimension(),
    sentenceModel.getInputDimension(),
  );

  assert.equal(
    restored.getOutputDimension(),
    sentenceModel.getOutputDimension(),
  );

  const originalVector =
    sentenceModel.encode(
      wordModel,
      "Roma caiu",
    );

  const restoredVector =
    restored.encode(
      wordModel,
      "Roma caiu",
    );

  assert.deepEqual(
    restoredVector,
    originalVector,
  );
});

test("reset deve remover o modelo", () => {
  const {
    sentenceModel,
  } = createSentenceModel();

  sentenceModel.reset();

  assert.equal(
    sentenceModel.isTrained(),
    false,
  );

  assert.throws(() =>
    sentenceModel.encode(
      createWordModel(),
      "Roma caiu",
    ),
  );
});

test("treinamento deve rejeitar dataset vazio", () => {
  const wordModel = createWordModel();

  const sentenceModel =
    new SemanticSentenceModel();

  assert.throws(() =>
    sentenceModel.train(
      wordModel,
      [],
    ),
  );
});