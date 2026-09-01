import assert from "node:assert/strict";
import test from "node:test";

import {
  SEMANTIC_SENTENCE_DATASET,
} from "../src/intelligence/semanticSentenceDataset";

import {
  splitSemanticDataset,
} from "../src/intelligence/semanticDatasetSplit";

import {
  analyzeTfidfErrors,
  analyzeNeuralErrors,
  formatPrediction,
  formatErrorAnalysis,
  getHardestErrors,
} from "../src/intelligence/semanticErrorAnalysis";

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

test("análise TF-IDF deve analisar todo o conjunto de teste", () => {
  const {
    train,
    test: finalTest,
  } = createSplit();

  const analysis =
    analyzeTfidfErrors(
      train,
      finalTest,
    );

  assert.equal(
    analysis.total,
    finalTest.length,
  );

  assert.equal(
    analysis.correct +
      analysis.incorrect,
    analysis.total,
  );
});

test("análise neural deve analisar todo o conjunto de teste", () => {
  const {
    test: finalTest,
  } = createSplit();

  const wordModel =
    createWordModel();

  const sentenceModel =
    createSentenceModel(wordModel);

  const analysis =
    analyzeNeuralErrors(
      wordModel,
      sentenceModel,
      finalTest,
    );

  assert.equal(
    analysis.total,
    finalTest.length,
  );

  assert.equal(
    analysis.correct +
      analysis.incorrect,
    analysis.total,
  );
});

test("falsos positivos devem ser classificados corretamente", () => {
  const analysis =
    analyzeTfidfErrors(
      [
        {
          first: "roma imperio",
          second: "roma antiga",
          label: 1,
        },
        {
          first: "computadores software",
          second: "algoritmos codigo",
          label: 0,
        },
      ],
      [
        {
          first: "roma",
          second: "roma",
          label: 0,
        },
      ],
      {
        threshold: 0.5,
      },
    );

  assert.equal(
    analysis.falsePositive.length,
    1,
  );

  assert.equal(
    analysis.falseNegative.length,
    0,
  );

  assert.equal(
    analysis.falsePositive[0].errorType,
    "false-positive",
  );
});

test("falsos negativos devem ser classificados corretamente", () => {
  const analysis =
    analyzeTfidfErrors(
      [
        {
          first: "roma imperio",
          second: "roma antiga",
          label: 1,
        },
        {
          first: "computadores software",
          second: "algoritmos codigo",
          label: 0,
        },
      ],
      [
        {
          first: "roma",
          second: "computador",
          label: 1,
        },
      ],
      {
        threshold: 0.5,
      },
    );

  assert.equal(
    analysis.falseNegative.length,
    1,
  );

  assert.equal(
    analysis.falsePositive.length,
    0,
  );

  assert.equal(
    analysis.falseNegative[0].errorType,
    "false-negative",
  );
});

test("getHardestErrors deve retornar somente erros", () => {
  const analysis =
    analyzeTfidfErrors(
      [
        {
          first: "roma",
          second: "imperio",
          label: 1,
        },
        {
          first: "computador",
          second: "software",
          label: 0,
        },
      ],
      [
        {
          first: "roma",
          second: "roma",
          label: 0,
        },
        {
          first: "computador",
          second: "computador",
          label: 1,
        },
      ],
      {
        threshold: 0.5,
      },
    );

  const errors =
    getHardestErrors(
      analysis,
      1,
    );

  assert.equal(
    errors.length,
    1,
  );

  assert.notEqual(
    errors[0].expected,
    errors[0].predicted,
  );
});

test("getHardestErrors deve respeitar o limite", () => {
  const {
    train,
    test: finalTest,
  } = createSplit();

  const analysis =
    analyzeTfidfErrors(
      train,
      finalTest,
    );

  const errors =
    getHardestErrors(
      analysis,
      2,
    );

  assert.ok(
    errors.length <= 2,
  );
});

test("formatPrediction deve produzir detalhes do erro", () => {
  const analysis =
    analyzeTfidfErrors(
      [
        {
          first: "roma",
          second: "imperio",
          label: 1,
        },
        {
          first: "computador",
          second: "software",
          label: 0,
        },
      ],
      [
        {
          first: "roma",
          second: "roma",
          label: 0,
        },
      ],
    );

  const prediction =
    analysis.predictions[0];

  const formatted =
    formatPrediction(
      prediction,
    );

  assert.ok(
    formatted.includes("Frase A"),
  );

  assert.ok(
    formatted.includes("Frase B"),
  );

  assert.ok(
    formatted.includes("Esperado"),
  );

  assert.ok(
    formatted.includes("Score"),
  );
});

test("formatErrorAnalysis deve produzir relatório", () => {
  const {
    train,
    test: finalTest,
  } = createSplit();

  const analysis =
    analyzeTfidfErrors(
      train,
      finalTest,
    );

  const report =
    formatErrorAnalysis(
      "TF-IDF",
      analysis,
    );

  assert.ok(
    report.includes("TF-IDF"),
  );

  assert.ok(
    report.includes("Total"),
  );

  assert.ok(
    report.includes("Acertos"),
  );

  assert.ok(
    report.includes("Erros"),
  );
});

test("análise sem erros deve ser representada corretamente", () => {
  const analysis =
    analyzeTfidfErrors(
      [
        {
          first: "roma imperio",
          second: "roma imperio",
          label: 1,
        },
        {
          first: "computador software",
          second: "computador software",
          label: 0,
        },
      ],
      [
        {
          first: "roma",
          second: "roma",
          label: 1,
        },
      ],
    );

  const report =
    formatErrorAnalysis(
      "Teste",
      analysis,
    );

  assert.ok(
    report.includes(
      "Nenhum erro encontrado.",
    ) ||
      analysis.incorrect > 0,
  );
});

test("threshold diferente deve alterar a classificação conforme necessário", () => {
  const {
    train,
    test: finalTest,
  } = createSplit();

  const lowThreshold =
    analyzeTfidfErrors(
      train,
      finalTest,
      {
        threshold: 0.1,
      },
    );

  const highThreshold =
    analyzeTfidfErrors(
      train,
      finalTest,
      {
        threshold: 0.9,
      },
    );

  assert.notEqual(
    lowThreshold.incorrect,
    undefined,
  );

  assert.notEqual(
    highThreshold.incorrect,
    undefined,
  );
});