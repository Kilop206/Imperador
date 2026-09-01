import assert from "node:assert/strict";
import test from "node:test";

import {
  SemanticMemoryService,
} from "../src/intelligence/semanticMemoryService";

function createService(): SemanticMemoryService {
  const service = new SemanticMemoryService();

  service.addMany([
    {
      id: "rome-fall",
      text: "Roma caiu e o Imperio Romano entrou em decadencia",
      metadata: {
        topic: "historia",
      },
    },
    {
      id: "rome-army",
      text: "O exercito romano foi importante para a expansao de Roma",
      metadata: {
        topic: "historia",
      },
    },
    {
      id: "programming",
      text: "Programacao envolve algoritmos software e computadores",
      metadata: {
        topic: "tecnologia",
      },
    },
  ]);

  return service;
}

test("deve adicionar uma memória", () => {
  const service = new SemanticMemoryService();

  service.add({
    id: "1",
    text: "Roma foi um grande imperio",
  });

  assert.equal(service.getMemoryCount(), 1);
  assert.equal(service.getMemories()[0].id, "1");
});

test("deve substituir uma memória com o mesmo id", () => {
  const service = new SemanticMemoryService();

  service.add({
    id: "1",
    text: "Texto antigo",
  });

  service.add({
    id: "1",
    text: "Texto novo",
  });

  assert.equal(service.getMemoryCount(), 1);
  assert.equal(service.getMemories()[0].text, "Texto novo");
});

test("deve adicionar várias memórias", () => {
  const service = createService();

  assert.equal(service.getMemoryCount(), 3);
  assert.equal(service.isTrained(), true);
});

test("deve buscar memória semanticamente semelhante", () => {
  const service = createService();

  const results = service.search(
    "por que o Imperio Romano caiu?",
    {
      topK: 3,
    },
  );

  assert.ok(results.length > 0);
  assert.equal(results[0].id, "rome-fall");
  assert.ok(results[0].score > 0);
});

test("findBest deve retornar a memória com maior sobreposição lexical", () => {
  const service = createService();

  const result = service.findBest(
    "Roma caiu Imperio Romano",
  );

  assert.ok(result !== null);
  assert.equal(result?.id, "rome-fall");
});

test("deve respeitar minimumScore", () => {
  const service = createService();

  const results = service.search(
    "computadores software",
    {
      minimumScore: 0.9,
      topK: 10,
    },
  );

  for (const result of results) {
    assert.ok(result.score >= 0.9);
  }
});

test("deve remover uma memória", () => {
  const service = createService();

  const removed = service.remove("rome-fall");

  assert.equal(removed, true);
  assert.equal(service.getMemoryCount(), 2);

  const result = service.findBest(
    "Roma caiu",
  );

  assert.ok(
    result === null ||
      result.id !== "rome-fall",
  );
});

test("remover uma memória inexistente deve retornar false", () => {
  const service = createService();

  assert.equal(
    service.remove("nao-existe"),
    false,
  );

  assert.equal(service.getMemoryCount(), 3);
});

test("deve exportar e importar o modelo", () => {
  const original = createService();

  const model = original.exportModel();

  const restored = new SemanticMemoryService();

  restored.importModel(model);

  assert.equal(
    restored.getMemoryCount(),
    original.getMemoryCount(),
  );

  assert.equal(
    restored.getVocabularySize(),
    original.getVocabularySize(),
  );

  const originalBest = original.findBest(
    "Roma caiu",
  );

  const restoredBest = restored.findBest(
    "Roma caiu",
  );

  assert.ok(originalBest !== null);
  assert.ok(restoredBest !== null);

  assert.equal(
    restoredBest?.id,
    originalBest?.id,
  );
});

test("deve limpar completamente a memória semântica", () => {
  const service = createService();

  service.clear();

  assert.equal(service.getMemoryCount(), 0);
  assert.equal(service.isTrained(), false);
});

test("deve rejeitar memória inválida", () => {
  const service = new SemanticMemoryService();

  assert.throws(() =>
    service.add({
      id: "",
      text: "texto válido",
    }),
  );

  assert.throws(() =>
    service.add({
      id: "1",
      text: "",
    }),
  );
});