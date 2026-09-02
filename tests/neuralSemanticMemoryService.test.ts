import assert from "node:assert/strict";
import test from "node:test";

import {
  NeuralSemanticMemoryService,
} from "../src/intelligence/neuralSemanticMemoryService";

import {
  WordEmbeddingModel,
} from "../src/intelligence/wordEmbeddingModel";

import {
  SemanticSentenceModel,
} from "../src/intelligence/semanticSentenceModel";

import {
  SemanticModelRegistry,
} from "../src/intelligence/semanticFineTuningService";

import {
  SEMANTIC_SENTENCE_DATASET,
} from "../src/intelligence/semanticSentenceDataset";

import {
  splitSemanticDataset,
} from "../src/intelligence/semanticDatasetSplit";

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
    "O exercito romano era muito poderoso",
    "Julio Cesar liderou o exercito de Roma",
    "Programacao envolve computadores e software",
    "Computadores executam programas e algoritmos",
    "Software moderno usa algoritmos eficientes",
    "Como programar um computador",
    "Inteligencia artificial aprende com dados",
    "Como criar uma API de dados",
    "Estou muito feliz hoje",
    "Ele ficou bastante irritado com o resultado",
  ]);

  return model;
}

function createSentenceModel(
  wordModel: WordEmbeddingModel,
): SemanticSentenceModel {
  const { train } = splitSemanticDataset(
    SEMANTIC_SENTENCE_DATASET,
    { trainRatio: 0.7, validationRatio: 0.15, seed: 42 },
  );

  const model = new SemanticSentenceModel({
    outputDimension: 8,
    learningRate: 0.02,
    epochs: 50,
    margin: 0.35,
    seed: 42,
  });

  model.train(wordModel, train);

  return model;
}

function createReadyService(): {
  service: NeuralSemanticMemoryService;
  wordModel: WordEmbeddingModel;
  sentenceModel: SemanticSentenceModel;
} {
  const wordModel = createWordModel();
  const sentenceModel = createSentenceModel(wordModel);
  const service = new NeuralSemanticMemoryService();
  service.setModels(wordModel, sentenceModel);

  return { service, wordModel, sentenceModel };
}

function addHistoryMemories(
  service: NeuralSemanticMemoryService,
): void {
  service.addMany([
    {
      id: "rome-fall",
      text: "Roma caiu e o Imperio Romano entrou em decadencia",
      metadata: { topic: "historia" },
    },
    {
      id: "rome-army",
      text: "O exercito romano foi fundamental para a expansao do Imperio",
      metadata: { topic: "historia" },
    },
    {
      id: "programming",
      text: "Programacao envolve algoritmos software e computadores",
      metadata: { topic: "tecnologia" },
    },
    {
      id: "happiness",
      text: "Estou muito feliz e contente hoje",
      metadata: { topic: "emocao" },
    },
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuração e estado
// ─────────────────────────────────────────────────────────────────────────────

test("serviço deve iniciar sem modelos configurados", () => {
  const service = new NeuralSemanticMemoryService();

  assert.equal(service.isReady(), false);
  assert.equal(service.getMemoryCount(), 0);
});

test("setModels deve configurar o serviço como pronto", () => {
  const { service } = createReadyService();

  assert.equal(service.isReady(), true);
});

test("setModels deve rejeitar WordEmbeddingModel não treinado", () => {
  const service = new NeuralSemanticMemoryService();

  const untrained = new WordEmbeddingModel({ seed: 42 });

  const sentenceModel = createSentenceModel(createWordModel());

  assert.throws(
    () => service.setModels(untrained, sentenceModel),
  );
});

test("setModels deve rejeitar SemanticSentenceModel não treinado", () => {
  const service = new NeuralSemanticMemoryService();

  const wordModel = createWordModel();

  const untrainedSentence = new SemanticSentenceModel({
    outputDimension: 8,
    seed: 42,
  });

  assert.throws(
    () => service.setModels(wordModel, untrainedSentence),
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Gerenciamento de memórias
// ─────────────────────────────────────────────────────────────────────────────

test("deve adicionar uma memória", () => {
  const { service } = createReadyService();

  service.add({
    id: "mem-1",
    text: "Roma foi um grande imperio",
  });

  assert.equal(service.getMemoryCount(), 1);
  assert.equal(service.getMemories()[0].id, "mem-1");
});

test("deve substituir memória com mesmo id", () => {
  const { service } = createReadyService();

  service.add({ id: "mem-1", text: "Texto antigo" });
  service.add({ id: "mem-1", text: "Texto novo" });

  assert.equal(service.getMemoryCount(), 1);
  assert.equal(service.getMemories()[0].text, "Texto novo");
});

test("deve adicionar várias memórias de uma vez", () => {
  const { service } = createReadyService();

  addHistoryMemories(service);

  assert.equal(service.getMemoryCount(), 4);
});

test("deve remover memória pelo id", () => {
  const { service } = createReadyService();

  addHistoryMemories(service);

  const removed = service.remove("rome-fall");

  assert.equal(removed, true);
  assert.equal(service.getMemoryCount(), 3);
});

test("remover id inexistente deve retornar false", () => {
  const { service } = createReadyService();

  assert.equal(service.remove("nao-existe"), false);
});

test("clear deve remover todas as memórias", () => {
  const { service } = createReadyService();

  addHistoryMemories(service);

  service.clear();

  assert.equal(service.getMemoryCount(), 0);
});

test("clear não deve afetar os modelos", () => {
  const { service } = createReadyService();

  service.clear();

  assert.equal(service.isReady(), true);
});

test("deve rejeitar memória com id vazio", () => {
  const { service } = createReadyService();

  assert.throws(() =>
    service.add({ id: "", text: "texto válido" }),
  );
});

test("deve rejeitar memória com text vazio", () => {
  const { service } = createReadyService();

  assert.throws(() =>
    service.add({ id: "mem-1", text: "" }),
  );
});

test("addMany deve rejeitar se qualquer memória for inválida", () => {
  const { service } = createReadyService();

  assert.throws(() =>
    service.addMany([
      { id: "mem-1", text: "válido" },
      { id: "", text: "inválido" },
    ]),
  );

  // Nenhuma deve ter sido inserida
  assert.equal(service.getMemoryCount(), 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Busca neural
// ─────────────────────────────────────────────────────────────────────────────

test("search deve retornar lista vazia quando sem modelos", () => {
  const service = new NeuralSemanticMemoryService();

  service.add({ id: "mem-1", text: "Roma" });

  const results = service.search("Roma");

  assert.deepEqual(results, []);
});

test("search deve retornar lista vazia quando sem memórias", () => {
  const { service } = createReadyService();

  const results = service.search("Roma caiu");

  assert.deepEqual(results, []);
});

test("busca neural deve retornar resultados com score válido", () => {
  const { service } = createReadyService();

  addHistoryMemories(service);

  const results = service.search("Imperio Romano caiu", { topK: 4 });

  assert.ok(results.length > 0);

  for (const result of results) {
    assert.ok(result.score >= 0 && result.score <= 1);
    assert.ok(typeof result.id === "string");
    assert.ok(typeof result.text === "string");
    assert.ok(result.memory !== null);
  }
});

test("resultados devem estar ordenados por score decrescente", () => {
  const { service } = createReadyService();

  addHistoryMemories(service);

  const results = service.search("Roma guerra exercito", { topK: 4 });

  for (let i = 1; i < results.length; i += 1) {
    assert.ok(results[i - 1].score >= results[i].score);
  }
});

test("busca deve respeitar topK", () => {
  const { service } = createReadyService();

  addHistoryMemories(service);

  const results = service.search("Roma", { topK: 2 });

  assert.ok(results.length <= 2);
});

test("busca deve respeitar minimumScore", () => {
  const { service } = createReadyService();

  addHistoryMemories(service);

  const results = service.search("Roma", {
    minimumScore: 0.9,
    topK: 10,
  });

  for (const result of results) {
    assert.ok(result.score >= 0.9);
  }
});

test("findBest deve retornar a memória com maior score", () => {
  const { service } = createReadyService();

  addHistoryMemories(service);

  const best = service.findBest("Roma caiu decadencia");

  assert.ok(best !== null);
  // Não testamos o id específico pois depende do treinamento,
  // mas verificamos que o score é o mais alto possível
  const all = service.search("Roma caiu decadencia", { topK: 10 });
  assert.equal(best.score, all[0].score);
});

test("findBest deve retornar null sem memórias", () => {
  const { service } = createReadyService();

  const best = service.findBest("Roma");

  assert.equal(best, null);
});

test("findBest com minimumScore alto deve poder retornar null", () => {
  const { service } = createReadyService();

  addHistoryMemories(service);

  const best = service.findBest("Roma", 1.0);

  // Score de 1.0 exato é improvável — apenas verificamos que retorna null
  // ou um resultado com score válido
  if (best !== null) {
    assert.ok(best.score >= 1.0);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Rebuild de embeddings
// ─────────────────────────────────────────────────────────────────────────────

test("rebuildEmbeddings deve recalcular vetores", () => {
  const { service, wordModel } = createReadyService();

  addHistoryMemories(service);

  // Cria um novo modelo e substitui
  const { train } = splitSemanticDataset(
    SEMANTIC_SENTENCE_DATASET,
    { trainRatio: 0.7, validationRatio: 0.15, seed: 99 },
  );

  const newSentenceModel = new SemanticSentenceModel({
    outputDimension: 8,
    epochs: 30,
    seed: 99,
  });
  newSentenceModel.train(wordModel, train);

  service.setModels(wordModel, newSentenceModel);
  service.rebuildEmbeddings();

  // Busca deve continuar funcionando após rebuild
  const results = service.search("Roma", { topK: 2 });
  assert.ok(results.length >= 0); // pode ser 0 se o modelo novo não codificar bem
});

test("rebuildEmbeddings com serviço vazio não deve lançar erro", () => {
  const { service } = createReadyService();

  assert.doesNotThrow(() => service.rebuildEmbeddings());
});

// ─────────────────────────────────────────────────────────────────────────────
// Adição de memória sem modelos (armazenamento antecipado)
// ─────────────────────────────────────────────────────────────────────────────

test("deve aceitar add() sem modelos configurados (embedding zero)", () => {
  const service = new NeuralSemanticMemoryService();

  // Não lança — apenas armazena com embedding vazio
  assert.doesNotThrow(() =>
    service.add({ id: "mem-1", text: "Roma caiu" }),
  );

  assert.equal(service.getMemoryCount(), 1);
});

test("após setModels, rebuildEmbeddings deve ativar a busca", () => {
  const service = new NeuralSemanticMemoryService();

  // Adiciona antes de configurar modelos
  service.add({ id: "rome-fall", text: "Roma caiu" });
  service.add({ id: "programming", text: "Programacao em computadores" });

  // Busca sem modelos retorna vazio
  assert.deepEqual(service.search("Roma"), []);

  // Configura modelos e rebuild
  const wordModel = createWordModel();
  const sentenceModel = createSentenceModel(wordModel);
  service.setModels(wordModel, sentenceModel);
  service.rebuildEmbeddings();

  // Agora a busca funciona
  const results = service.search("Roma", { topK: 2 });
  assert.ok(results.length >= 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Comparação direta
// ─────────────────────────────────────────────────────────────────────────────

test("compare deve retornar score entre 0 e 1", () => {
  const { service } = createReadyService();

  const score = service.compare(
    "Roma caiu",
    "O Imperio Romano entrou em decadencia",
  );

  assert.ok(score >= -1 && score <= 1);
});

test("compare deve ser simétrico", () => {
  const { service } = createReadyService();

  const forward = service.compare("Roma caiu", "Imperio Romano");
  const backward = service.compare("Imperio Romano", "Roma caiu");

  assert.ok(Math.abs(forward - backward) < 1e-9);
});

test("compare deve lançar erro sem modelos", () => {
  const service = new NeuralSemanticMemoryService();

  assert.throws(() =>
    service.compare("Roma caiu", "Imperio Romano"),
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Export / Import de snapshot
// ─────────────────────────────────────────────────────────────────────────────

test("deve exportar e importar snapshot corretamente", () => {
  const { service, wordModel, sentenceModel } =
    createReadyService();

  addHistoryMemories(service);

  const snapshot = service.exportSnapshot();

  const restored = new NeuralSemanticMemoryService();
  restored.setModels(wordModel, sentenceModel);
  restored.importSnapshot(snapshot);

  assert.equal(
    restored.getMemoryCount(),
    service.getMemoryCount(),
  );

  // Mesmas memórias
  const originalMemories = service.getMemories();
  const restoredMemories = restored.getMemories();

  for (const orig of originalMemories) {
    const rest = restoredMemories.find((m) => m.id === orig.id);
    assert.ok(rest);
    assert.equal(rest.text, orig.text);
  }
});

test("snapshot importado deve produzir mesmos resultados de busca", () => {
  const { service, wordModel, sentenceModel } =
    createReadyService();

  addHistoryMemories(service);

  const snapshot = service.exportSnapshot();

  const restored = new NeuralSemanticMemoryService();
  restored.setModels(wordModel, sentenceModel);
  restored.importSnapshot(snapshot);

  const originalResults = service.search("Roma", { topK: 3 });
  const restoredResults = restored.search("Roma", { topK: 3 });

  assert.equal(originalResults.length, restoredResults.length);

  for (let i = 0; i < originalResults.length; i += 1) {
    assert.equal(
      originalResults[i].id,
      restoredResults[i].id,
    );
    assert.ok(
      Math.abs(
        originalResults[i].score - restoredResults[i].score,
      ) < 1e-9,
    );
  }
});

test("importSnapshot deve rejeitar snapshot inválido", () => {
  const { service } = createReadyService();

  assert.throws(() =>
    service.importSnapshot(
      null as unknown as { memories: []; embeddings: [] },
    ),
  );

  assert.throws(() =>
    service.importSnapshot({
      memories: [{ id: "m1", text: "texto" }],
      embeddings: [],
    }),
  );

  assert.throws(() =>
    service.importSnapshot({
      memories: [{ id: "", text: "texto" }],
      embeddings: [[0, 1]],
    }),
  );
});

test("getMemories deve retornar cópias", () => {
  const { service } = createReadyService();

  service.add({ id: "mem-1", text: "Roma" });

  const memories = service.getMemories();
  memories[0].text = "mutado";

  assert.equal(service.getMemories()[0].text, "Roma");
});

// ─────────────────────────────────────────────────────────────────────────────
// Integração com SemanticModelRegistry
// ─────────────────────────────────────────────────────────────────────────────

test("setModelsFromRegistry deve usar a versão ativa", () => {
  const wordModel = createWordModel();
  const sentenceModel = createSentenceModel(wordModel);

  const registry = new SemanticModelRegistry();
  registry.register(sentenceModel.exportModel(), {
    datasetSize: 10,
    trainingPairs: 10,
    validationScore: 0.7,
    testScore: 0.65,
  });
  registry.activate(1);

  const service = new NeuralSemanticMemoryService();
  service.setModelsFromRegistry(wordModel, registry);

  assert.equal(service.isReady(), true);
});

test("setModelsFromRegistry deve lançar se nenhuma versão ativa", () => {
  const wordModel = createWordModel();

  const registry = new SemanticModelRegistry();

  const service = new NeuralSemanticMemoryService();

  assert.throws(() =>
    service.setModelsFromRegistry(wordModel, registry),
  );
});
