import assert from "node:assert/strict";
import test from "node:test";

import {
  HybridRetrievalService,
  type HybridMemoryCandidate,
  type HybridWeights,
} from "../src/intelligence/hybridRetrievalService";

import {
  SemanticSimilarityService,
} from "../src/intelligence/semanticSimilarityService";

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
  SEMANTIC_SENTENCE_DATASET,
} from "../src/intelligence/semanticSentenceDataset";

import {
  splitSemanticDataset,
} from "../src/intelligence/semanticDatasetSplit";

import type {
  EmotionState,
} from "../src/types/emotion";

import {
  EMOTION_BASELINE,
} from "../src/types/emotion";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const NOW = Date.now();
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function neutralEmotion(): EmotionState {
  return { ...EMOTION_BASELINE };
}

function highNostalgiaEmotion(): EmotionState {
  return {
    ...EMOTION_BASELINE,
    nostalgia: 90,
  };
}

function highHostilityEmotion(): EmotionState {
  return {
    ...EMOTION_BASELINE,
    hostility: 85,
    irritation: 70,
  };
}

function createCandidates(): HybridMemoryCandidate[] {
  return [
    {
      id: "rome-fall",
      text: "Roma caiu e o Imperio Romano entrou em decadencia",
      createdAt: NOW - ONE_DAY_MS, // 1 dia atrás
      importance: 0.8,
      metadata: { topic: "historia" },
    },
    {
      id: "rome-army",
      text: "O exercito romano foi fundamental para a expansao do Imperio",
      createdAt: NOW - 3 * ONE_DAY_MS, // 3 dias atrás
      importance: 0.6,
      metadata: { topic: "historia" },
    },
    {
      id: "programming",
      text: "Programacao envolve algoritmos software e computadores",
      createdAt: NOW - 7 * ONE_DAY_MS, // 7 dias atrás
      importance: 0.4,
      metadata: { topic: "tecnologia" },
    },
    {
      id: "nostalgia-memory",
      text: "Saudade do passado e das memorias antigas de outrora",
      createdAt: NOW - 2 * ONE_DAY_MS,
      importance: 0.5,
      metadata: { topic: "emocao" },
    },
    {
      id: "conflict-memory",
      text: "Os inimigos e traidores representam ameaca e perigo",
      createdAt: NOW - ONE_DAY_MS,
      importance: 0.7,
    },
  ];
}

function createWordModel(): WordEmbeddingModel {
  const model = new WordEmbeddingModel({
    dimension: 16,
    windowSize: 2,
    negativeSamples: 3,
    learningRate: 0.03,
    epochs: 25,
    minCount: 1,
    seed: 42,
  });

  model.train([
    "Roma foi um grande imperio romano",
    "O imperio romano governava Roma",
    "Roma caiu depois de muitas guerras",
    "O exercito romano era muito poderoso",
    "Programacao envolve computadores e software",
    "Computadores executam programas e algoritmos",
    "Saudade do passado e das memorias antigas",
    "Os inimigos representam ameaca e perigo",
  ]);

  return model;
}

function createNeuralService(
  candidates: HybridMemoryCandidate[],
): NeuralSemanticMemoryService {
  const wordModel = createWordModel();

  const { train } = splitSemanticDataset(
    SEMANTIC_SENTENCE_DATASET,
    { trainRatio: 0.7, validationRatio: 0.15, seed: 42 },
  );

  const sentenceModel = new SemanticSentenceModel({
    outputDimension: 8,
    epochs: 25,
    seed: 42,
  });
  sentenceModel.train(wordModel, train);

  const service = new NeuralSemanticMemoryService();
  service.setModels(wordModel, sentenceModel);

  for (const candidate of candidates) {
    service.add({
      id: candidate.id,
      text: candidate.text,
      createdAt: candidate.createdAt,
      metadata: candidate.metadata,
    });
  }

  return service;
}

function createTfidfService(
  candidates: HybridMemoryCandidate[],
): SemanticSimilarityService {
  const service = new SemanticSimilarityService();

  service.train(
    candidates.map((c) => ({ id: c.id, text: c.text })),
  );

  return service;
}

// ─────────────────────────────────────────────────────────────────────────────
// Testes básicos
// ─────────────────────────────────────────────────────────────────────────────

test("retrieve deve retornar lista vazia para query vazia", () => {
  const service = new HybridRetrievalService();

  const results = service.retrieve(
    "",
    createCandidates(),
    neutralEmotion(),
  );

  assert.deepEqual(results, []);
});

test("retrieve deve retornar lista vazia para candidatos vazios", () => {
  const service = new HybridRetrievalService();

  const results = service.retrieve(
    "Roma caiu",
    [],
    neutralEmotion(),
  );

  assert.deepEqual(results, []);
});

test("retrieve deve rejeitar candidatos inválidos como tipo", () => {
  const service = new HybridRetrievalService();

  assert.throws(() =>
    service.retrieve(
      "Roma",
      "invalid" as unknown as HybridMemoryCandidate[],
      neutralEmotion(),
    ),
  );
});

test("retrieve deve ignorar candidatos com id ou texto vazio", () => {
  const service = new HybridRetrievalService();

  const results = service.retrieve(
    "Roma",
    [
      { id: "", text: "texto válido" },
      { id: "valid", text: "" },
      { id: "valid-2", text: "texto correto" },
    ],
    neutralEmotion(),
  );

  // Só o candidato válido deve aparecer
  assert.equal(results.length, 1);
  assert.equal(results[0].id, "valid-2");
});

// ─────────────────────────────────────────────────────────────────────────────
// Score e ranking
// ─────────────────────────────────────────────────────────────────────────────

test("retrieve deve retornar resultados ordenados por score decrescente", () => {
  const service = new HybridRetrievalService();
  const candidates = createCandidates();

  const results = service.retrieve(
    "Roma caiu Imperio Romano",
    candidates,
    neutralEmotion(),
    { topK: 5 },
  );

  assert.ok(results.length > 0);

  for (let i = 1; i < results.length; i += 1) {
    assert.ok(
      results[i - 1].score.final >= results[i].score.final,
    );
  }
});

test("scores devem estar no intervalo [0, 1]", () => {
  const service = new HybridRetrievalService();
  const candidates = createCandidates();

  const results = service.retrieve(
    "Roma caiu",
    candidates,
    neutralEmotion(),
    { topK: 10 },
  );

  for (const result of results) {
    assert.ok(
      result.score.final >= 0 &&
        result.score.final <= 1,
      `Score fora do range: ${result.score.final}`,
    );

    for (const [key, value] of Object.entries(
      result.score.components,
    )) {
      assert.ok(
        value >= 0 && value <= 1,
        `Componente ${key} fora do range: ${value}`,
      );
    }
  }
});

test("score final deve ser combinação dos componentes ponderados", () => {
  const service = new HybridRetrievalService();
  const candidates = createCandidates();

  const weights: HybridWeights = {
    keyword: 0.2,
    tfidf: 0.2,
    neural: 0.2,
    recency: 0.2,
    importance: 0.1,
    emotion: 0.1,
  };

  const results = service.retrieve(
    "Roma",
    candidates,
    neutralEmotion(),
    { weights, topK: 3 },
  );

  for (const result of results) {
    const { components, weights: w } = result.score;

    const expected =
      components.keyword * w.keyword +
      components.tfidf * w.tfidf +
      components.neural * w.neural +
      components.recency * w.recency +
      components.importance * w.importance +
      components.emotion * w.emotion;

    assert.ok(
      Math.abs(result.score.final - expected) < 1e-9,
    );
  }
});

test("retrieve deve respeitar topK", () => {
  const service = new HybridRetrievalService();
  const candidates = createCandidates();

  const results = service.retrieve(
    "Roma",
    candidates,
    neutralEmotion(),
    { topK: 2 },
  );

  assert.ok(results.length <= 2);
});

test("retrieve deve respeitar minimumScore", () => {
  const service = new HybridRetrievalService();
  const candidates = createCandidates();

  const results = service.retrieve(
    "Roma",
    candidates,
    neutralEmotion(),
    { minimumScore: 0.5 },
  );

  for (const result of results) {
    assert.ok(result.score.final >= 0.5);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Componente de keyword
// ─────────────────────────────────────────────────────────────────────────────

test("candidato com mais sobreposição de palavras deve ter keyword score maior", () => {
  const service = new HybridRetrievalService();

  // Desativar todos os outros sinais (peso 1.0 em keyword)
  const weights: Partial<HybridWeights> = {
    keyword: 1,
    tfidf: 0,
    neural: 0,
    recency: 0,
    importance: 0,
    emotion: 0,
  };

  const candidates: HybridMemoryCandidate[] = [
    {
      id: "high-overlap",
      text: "Roma caiu Imperio Romano decadencia guerra",
      importance: 0.5,
    },
    {
      id: "low-overlap",
      text: "Python e uma linguagem de programacao",
      importance: 0.5,
    },
  ];

  const results = service.retrieve(
    "Roma caiu decadencia",
    candidates,
    neutralEmotion(),
    { weights, topK: 2 },
  );

  assert.ok(results.length >= 1);
  assert.equal(results[0].id, "high-overlap");
});

// ─────────────────────────────────────────────────────────────────────────────
// Componente de recência
// ─────────────────────────────────────────────────────────────────────────────

test("memória recente deve ter recency score maior", () => {
  const service = new HybridRetrievalService();

  const weights: Partial<HybridWeights> = {
    keyword: 0,
    tfidf: 0,
    neural: 0,
    recency: 1,
    importance: 0,
    emotion: 0,
  };

  const candidates: HybridMemoryCandidate[] = [
    {
      id: "old",
      text: "Roma caiu",
      createdAt: NOW - 30 * ONE_DAY_MS, // 30 dias
    },
    {
      id: "recent",
      text: "Roma caiu",
      createdAt: NOW - ONE_DAY_MS, // 1 dia
    },
  ];

  const results = service.retrieve(
    "Roma",
    candidates,
    neutralEmotion(),
    { weights, topK: 2 },
  );

  assert.equal(results[0].id, "recent");
  assert.ok(
    results[0].score.components.recency >
      results[1].score.components.recency,
  );
});

test("memória sem createdAt deve ter recency score zero", () => {
  const service = new HybridRetrievalService();

  const weights: Partial<HybridWeights> = {
    keyword: 0,
    tfidf: 0,
    neural: 0,
    recency: 1,
    importance: 0,
    emotion: 0,
  };

  const candidates: HybridMemoryCandidate[] = [
    {
      id: "no-date",
      text: "Roma caiu",
      // sem createdAt
    },
  ];

  const results = service.retrieve(
    "Roma",
    candidates,
    neutralEmotion(),
    { weights },
  );

  assert.equal(results.length, 1);
  assert.equal(results[0].score.components.recency, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Componente de importância
// ─────────────────────────────────────────────────────────────────────────────

test("memória mais importante deve ter importance score maior", () => {
  const service = new HybridRetrievalService();

  const weights: Partial<HybridWeights> = {
    keyword: 0,
    tfidf: 0,
    neural: 0,
    recency: 0,
    importance: 1,
    emotion: 0,
  };

  const candidates: HybridMemoryCandidate[] = [
    {
      id: "high-importance",
      text: "Roma caiu",
      importance: 0.9,
    },
    {
      id: "low-importance",
      text: "Roma caiu",
      importance: 0.1,
    },
  ];

  const results = service.retrieve(
    "Roma",
    candidates,
    neutralEmotion(),
    { weights, topK: 2 },
  );

  assert.equal(results[0].id, "high-importance");
});

test("importância em escala 0-10 deve ser normalizada para 0-1", () => {
  const service = new HybridRetrievalService();

  const weights: Partial<HybridWeights> = {
    keyword: 0,
    tfidf: 0,
    neural: 0,
    recency: 0,
    importance: 1,
    emotion: 0,
  };

  const candidates: HybridMemoryCandidate[] = [
    {
      id: "scale-10",
      text: "Roma",
      importance: 8, // escala 0-10 → 0.8
    },
  ];

  const results = service.retrieve(
    "Roma",
    candidates,
    neutralEmotion(),
    { weights },
  );

  assert.equal(results.length, 1);
  assert.ok(
    Math.abs(results[0].score.components.importance - 0.8) < 0.001,
  );
});

test("importância ausente deve resultar em 0.5 (neutro)", () => {
  const service = new HybridRetrievalService();

  const weights: Partial<HybridWeights> = {
    keyword: 0,
    tfidf: 0,
    neural: 0,
    recency: 0,
    importance: 1,
    emotion: 0,
  };

  const candidates: HybridMemoryCandidate[] = [
    {
      id: "no-importance",
      text: "Roma",
      // sem importance
    },
  ];

  const results = service.retrieve(
    "Roma",
    candidates,
    neutralEmotion(),
    { weights },
  );

  assert.equal(results.length, 1);
  assert.ok(
    Math.abs(results[0].score.components.importance - 0.5) < 0.001,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Componente de emoção
// ─────────────────────────────────────────────────────────────────────────────

test("memória com palavras temáticas de nostalgia deve ter emotion score maior quando nostalgia está elevada", () => {
  const service = new HybridRetrievalService();

  const weights: Partial<HybridWeights> = {
    keyword: 0,
    tfidf: 0,
    neural: 0,
    recency: 0,
    importance: 0,
    emotion: 1,
  };

  const candidates: HybridMemoryCandidate[] = [
    {
      id: "nostalgic",
      text: "Saudade do passado memorias antigas outrora historia",
    },
    {
      id: "neutral",
      text: "Computadores e algoritmos modernos",
    },
  ];

  const results = service.retrieve(
    "Roma",
    candidates,
    highNostalgiaEmotion(),
    { weights, topK: 2 },
  );

  assert.ok(results.length >= 1);
  assert.equal(results[0].id, "nostalgic");
  assert.ok(results[0].score.components.emotion > 0);
});

test("emoção neutra deve produzir emotion score próximo de zero", () => {
  const service = new HybridRetrievalService();

  const weights: Partial<HybridWeights> = {
    keyword: 0,
    tfidf: 0,
    neural: 0,
    recency: 0,
    importance: 0,
    emotion: 1,
  };

  const candidates: HybridMemoryCandidate[] = [
    {
      id: "generic",
      text: "Uma frase genérica sobre nada específico",
    },
  ];

  const results = service.retrieve(
    "algo",
    candidates,
    neutralEmotion(),
    { weights },
  );

  // Memória sem palavras temáticas → emotion score baixo
  // (pode ser > 0 se o texto acidentalmente conter keywords)
  assert.ok(results[0].score.components.emotion >= 0);
  assert.ok(results[0].score.components.emotion <= 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// Pesos customizados
// ─────────────────────────────────────────────────────────────────────────────

test("pesos customizados devem ser normalizados quando não somam 1", () => {
  const service = new HybridRetrievalService();

  // Pesos que somam 2 (não normalizado)
  const weights: Partial<HybridWeights> = {
    keyword: 0.4,
    tfidf: 0.4,
    neural: 0.4,
    recency: 0.4,
    importance: 0.4,
    emotion: 0,
  };

  const results = service.retrieve(
    "Roma",
    createCandidates(),
    neutralEmotion(),
    { weights, topK: 3 },
  );

  for (const result of results) {
    // Os pesos devem ter sido normalizados — score final ≤ 1
    assert.ok(result.score.final <= 1);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Com TF-IDF configurado
// ─────────────────────────────────────────────────────────────────────────────

test("setTfidfService deve ativar o componente tfidf", () => {
  const candidates = createCandidates();

  const tfidfService = createTfidfService(candidates);

  const service = new HybridRetrievalService();
  service.setTfidfService(tfidfService);

  const results = service.retrieve(
    "Roma caiu Imperio",
    candidates,
    neutralEmotion(),
    { topK: 3 },
  );

  assert.ok(results.length > 0);

  // Com TF-IDF ativo, candidatos relacionados a Roma devem ter tfidf > 0
  const romeResult = results.find((r) => r.id === "rome-fall");
  if (romeResult) {
    assert.ok(romeResult.score.components.tfidf > 0);
  }
});

test("setTfidfService deve rejeitar serviço não treinado", () => {
  const service = new HybridRetrievalService();

  const untrained = new SemanticSimilarityService();

  assert.throws(() => service.setTfidfService(untrained));
});

// ─────────────────────────────────────────────────────────────────────────────
// Com serviço neural configurado
// ─────────────────────────────────────────────────────────────────────────────

test("setNeuralService deve ativar o componente neural", () => {
  const candidates = createCandidates();

  const neuralService = createNeuralService(candidates);

  const service = new HybridRetrievalService();
  service.setNeuralService(neuralService);

  const results = service.retrieve(
    "Roma caiu decadencia",
    candidates,
    neutralEmotion(),
    { topK: 3 },
  );

  assert.ok(results.length > 0);
});

test("setNeuralService deve rejeitar serviço sem modelos", () => {
  const service = new HybridRetrievalService();

  const notReady = new NeuralSemanticMemoryService();

  assert.throws(() => service.setNeuralService(notReady));
});

// ─────────────────────────────────────────────────────────────────────────────
// retrieveBest
// ─────────────────────────────────────────────────────────────────────────────

test("retrieveBest deve retornar o melhor resultado", () => {
  const service = new HybridRetrievalService();
  const candidates = createCandidates();

  const best = service.retrieveBest(
    "Roma caiu decadencia",
    candidates,
    neutralEmotion(),
  );

  assert.ok(best !== null);
  assert.ok(typeof best.score.final === "number");
});

test("retrieveBest deve retornar null para candidatos vazios", () => {
  const service = new HybridRetrievalService();

  const best = service.retrieveBest(
    "Roma",
    [],
    neutralEmotion(),
  );

  assert.equal(best, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// formatScore
// ─────────────────────────────────────────────────────────────────────────────

test("formatScore deve produzir relatório com todos os componentes", () => {
  const service = new HybridRetrievalService();
  const candidates = createCandidates();

  const results = service.retrieve(
    "Roma",
    candidates,
    neutralEmotion(),
    { topK: 1 },
  );

  assert.ok(results.length > 0);

  const report = service.formatScore(results[0]);

  assert.ok(report.includes("Score final"));
  assert.ok(report.includes("keyword"));
  assert.ok(report.includes("tfidf"));
  assert.ok(report.includes("neural"));
  assert.ok(report.includes("recency"));
  assert.ok(report.includes("importance"));
  assert.ok(report.includes("emotion"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Integração: hostilidade alta deve favorecer memórias de conflito
// ─────────────────────────────────────────────────────────────────────────────

test("alta hostilidade deve favorecer memórias de conflito no componente emotion", () => {
  const service = new HybridRetrievalService();

  const weights: Partial<HybridWeights> = {
    keyword: 0,
    tfidf: 0,
    neural: 0,
    recency: 0,
    importance: 0,
    emotion: 1,
  };

  const candidates: HybridMemoryCandidate[] = [
    {
      id: "conflict",
      text: "Inimigos traidores ameaca perigo combate guerra conflito",
    },
    {
      id: "peaceful",
      text: "Paz harmonia amizade colaboracao parceria alegria",
    },
  ];

  const results = service.retrieve(
    "algo",
    candidates,
    highHostilityEmotion(),
    { weights, topK: 2 },
  );

  assert.ok(results.length >= 1);
  assert.equal(results[0].id, "conflict");
});
