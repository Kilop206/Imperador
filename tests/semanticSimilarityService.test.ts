import assert from "node:assert/strict";
import test from "node:test";

import {
  SemanticSimilarityService,
} from "../src/intelligence/semanticSimilarityService";

function createService(): SemanticSimilarityService {
  const service = new SemanticSimilarityService();

  service.train([
    {
      id: "roma",
      text: "Roma foi derrotada e o imperio romano caiu",
    },
    {
      id: "guerra",
      text: "A guerra causou muitas mortes e destruiu cidades",
    },
    {
      id: "tecnologia",
      text: "Computadores e inteligencia artificial transformam a tecnologia",
    },
    {
      id: "familia",
      text: "A familia se reuniu durante o jantar",
    },
  ]);

  return service;
}

test("serviço deve ser treinado corretamente", () => {
  const service = createService();

  assert.equal(service.isTrained(), true);
  assert.equal(service.getDocumentCount(), 4);
  assert.ok(service.getVocabularySize() > 0);
});

test("serviço deve gerar vetores", () => {
  const service = createService();

  const vector = service.getVector(
    "Roma caiu",
  );

  assert.equal(
    vector.length,
    service.getVocabularySize(),
  );
});

test("frases com palavras em comum devem ter similaridade maior que zero", () => {
  const service = createService();

  const score = service.compare(
    "Roma caiu",
    "O imperio romano caiu",
  );

  assert.ok(score > 0);
});

test("texto desconhecido não deve possuir similaridade artificialmente alta", () => {
  const service = createService();

  const score = service.compare(
    "astronomia planetas galáxias estrelas",
    "Computadores inteligencia tecnologia",
  );

  assert.ok(score < 1);
});

test("findSimilar deve ordenar por similaridade", () => {
  const service = createService();

  const results = service.findSimilar(
    "Roma caiu",
    {
      topK: 4,
    },
  );

  assert.ok(results.length > 0);
  assert.equal(results[0].id, "roma");

  for (let index = 1; index < results.length; index += 1) {
    assert.ok(
      results[index - 1].score >= results[index].score,
    );
  }
});

test("findSimilar deve respeitar minimumScore", () => {
  const service = createService();

  const results = service.findSimilar(
    "Roma caiu",
    {
      minimumScore: 0.9,
      topK: 10,
    },
  );

  for (const result of results) {
    assert.ok(result.score >= 0.9);
  }
});

test("findSimilar deve respeitar topK", () => {
  const service = createService();

  const results = service.findSimilar(
    "Roma caiu",
    {
      topK: 2,
    },
  );

  assert.ok(results.length <= 2);
});

test("modelo de similaridade deve poder ser exportado e importado", () => {
  const original = createService();

  const model = original.exportModel();

  const restored = new SemanticSimilarityService();

  restored.importModel(model);

  assert.equal(
    restored.getDocumentCount(),
    original.getDocumentCount(),
  );

  assert.equal(
    restored.getVocabularySize(),
    original.getVocabularySize(),
  );

  const originalResults = original.findSimilar(
    "Roma caiu",
    { topK: 2 },
  );

  const restoredResults = restored.findSimilar(
    "Roma caiu",
    { topK: 2 },
  );

  assert.equal(
    restoredResults[0].id,
    originalResults[0].id,
  );

  assert.ok(
    Math.abs(
      restoredResults[0].score -
        originalResults[0].score,
    ) < 0.000001,
  );
});

test("reset deve remover o modelo", () => {
  const service = createService();

  service.reset();

  assert.equal(service.isTrained(), false);
  assert.equal(service.getDocumentCount(), 0);
  assert.equal(service.getVocabularySize(), 0);

  assert.throws(
    () => service.getVector("Roma caiu"),
  );
});