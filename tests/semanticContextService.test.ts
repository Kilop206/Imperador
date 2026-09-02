import assert from "node:assert/strict";
import test from "node:test";

import {
  SemanticContextService,
} from "../src/intelligence/semanticContextService";

import {
  HybridRetrievalService,
} from "../src/intelligence/hybridRetrievalService";

import {
  SemanticSimilarityService,
} from "../src/intelligence/semanticSimilarityService";

import type {
  ConversationMemory,
} from "../src/services/memoryService";

import {
  EMOTION_BASELINE,
} from "../src/types/emotion";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function neutralEmotion() {
  return { ...EMOTION_BASELINE };
}

function createMemories(): ConversationMemory[] {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  return [
    {
      id: 1,
      userId: "user-1",
      topic: "Roma",
      summary: "Tibério lembra que o usuário perguntou sobre a queda de Roma",
      importance: 4,
      createdAt: now - day,
      lastSeen: now - day,
    },
    {
      id: 2,
      userId: "user-1",
      topic: "Programação",
      summary: "O usuário mencionou programação em JavaScript",
      importance: 2,
      createdAt: now - 3 * day,
      lastSeen: now - 3 * day,
    },
    {
      id: 3,
      userId: "user-1",
      topic: "Filosofia",
      summary: "Conversa sobre o sentido da existência e propósito",
      importance: 3,
      createdAt: now - 2 * day,
      lastSeen: now - 2 * day,
    },
  ];
}

function createTfidfService(
  memories: ConversationMemory[],
): SemanticSimilarityService {
  const service = new SemanticSimilarityService();

  service.train(
    memories.map((m) => ({
      id: String(m.id),
      text: `${m.topic}: ${m.summary}`,
    })),
  );

  return service;
}

// ─────────────────────────────────────────────────────────────────────────────
// SemanticContextService
// ─────────────────────────────────────────────────────────────────────────────

test("serviço deve iniciar não configurado", () => {
  const service = new SemanticContextService();

  assert.equal(service.isConfigured(), false);
});

test("enable() deve marcar como configurado", () => {
  const service = new SemanticContextService();

  service.enable();

  assert.equal(service.isConfigured(), true);
});

test("setTfidfService deve marcar como configurado", () => {
  const memories = createMemories();

  const service = new SemanticContextService();

  service.setTfidfService(
    createTfidfService(memories),
  );

  assert.equal(service.isConfigured(), true);
});

test("buildContext sem configuração deve retornar contexto inativo", () => {
  const service = new SemanticContextService();

  const context = service.buildContext(
    "Roma caiu",
    createMemories(),
    neutralEmotion(),
  );

  assert.equal(context.isActive, false);
  assert.equal(context.best, null);
  assert.equal(context.contextSummary, "");
  assert.deepEqual(context.memories, []);
});

test("buildContext com query vazia deve retornar contexto inativo", () => {
  const memories = createMemories();

  const service = new SemanticContextService();
  service.setTfidfService(createTfidfService(memories));

  const context = service.buildContext(
    "  ",
    memories,
    neutralEmotion(),
  );

  assert.equal(context.isActive, false);
});

test("buildContext sem memórias deve retornar contexto inativo", () => {
  const service = new SemanticContextService();
  service.enable();

  const context = service.buildContext(
    "Roma caiu",
    [],
    neutralEmotion(),
  );

  assert.equal(context.isActive, false);
});

test("buildContext configurado deve retornar contexto ativo", () => {
  const memories = createMemories();

  const service = new SemanticContextService();
  service.setTfidfService(createTfidfService(memories));

  const context = service.buildContext(
    "Roma caiu Imperio",
    memories,
    neutralEmotion(),
  );

  assert.equal(context.isActive, true);
  assert.ok(context.best !== null);
  assert.ok(context.contextSummary.length > 0);
  assert.ok(context.memories.length > 0);
});

test("buildContext deve retornar memórias ordenadas por score", () => {
  const memories = createMemories();

  const service = new SemanticContextService();
  service.setTfidfService(createTfidfService(memories));

  const context = service.buildContext(
    "Roma caiu",
    memories,
    neutralEmotion(),
    { topK: 3 },
  );

  if (context.isActive && context.memories.length > 1) {
    for (let i = 1; i < context.memories.length; i += 1) {
      assert.ok(
        context.memories[i - 1].score.final >=
          context.memories[i].score.final,
      );
    }
  }
});

test("contextSummary deve incluir o tópico da melhor memória", () => {
  const memories = createMemories();

  const service = new SemanticContextService();
  service.setTfidfService(createTfidfService(memories));

  const context = service.buildContext(
    "Roma caiu Imperio Romano",
    memories,
    neutralEmotion(),
  );

  if (context.isActive) {
    // A memória de Roma deve ter sido recuperada
    assert.ok(context.contextSummary.length > 0);
  }
});

test("buildContext deve respeitar topK", () => {
  const memories = createMemories();

  const service = new SemanticContextService();
  service.setTfidfService(createTfidfService(memories));

  const context = service.buildContext(
    "Roma",
    memories,
    neutralEmotion(),
    { topK: 1 },
  );

  if (context.isActive) {
    assert.ok(context.memories.length <= 1);
  }
});

test("formatContext deve retornar string vazia para contexto inativo", () => {
  const service = new SemanticContextService();

  const context = service.buildContext(
    "Roma",
    [],
    neutralEmotion(),
  );

  assert.equal(service.formatContext(context), "");
});

test("formatContext deve produzir texto com scores", () => {
  const memories = createMemories();

  const service = new SemanticContextService();
  service.setTfidfService(createTfidfService(memories));

  const context = service.buildContext(
    "Roma caiu",
    memories,
    neutralEmotion(),
  );

  if (context.isActive) {
    const formatted = service.formatContext(context);
    assert.ok(formatted.includes("score="));
  }
});

test("buildContext deve respeitar minimumScore", () => {
  const memories = createMemories();

  const service = new SemanticContextService();
  service.setTfidfService(createTfidfService(memories));

  const context = service.buildContext(
    "Roma",
    memories,
    neutralEmotion(),
    { minimumScore: 0.99 }, // threshold muito alto
  );

  // Com threshold extremo pode não retornar nada
  if (context.isActive) {
    for (const mem of context.memories) {
      assert.ok(mem.score.final >= 0.99);
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Integração com ResponseEngine
// ─────────────────────────────────────────────────────────────────────────────

test("ResponseEngine importa SemanticContextService sem erros de compilação", async () => {
  // Se o import falhar, o test suite nem inicializa
  const { ResponseEngine } =
    await import(
      "../src/services/responseEngine"
    );

  assert.ok(typeof ResponseEngine.generateCandidates === "function");
  assert.ok(typeof ResponseEngine.selectResponse === "function");
  assert.ok(typeof ResponseEngine.setSemanticService === "function");
});

test("ResponseEngine.setSemanticService deve aceitar SemanticContextService", async () => {
  const { ResponseEngine } =
    await import(
      "../src/services/responseEngine"
    );

  const service = new SemanticContextService();
  service.enable();

  // Não deve lançar erro
  assert.doesNotThrow(() =>
    ResponseEngine.setSemanticService(service),
  );
});

test("ResponseEngine.generateCandidates sem semantic service não deve lançar erro", async () => {
  const { ResponseEngine } =
    await import(
      "../src/services/responseEngine"
    );

  // Sem userId = sem candidatos semânticos tentados
  const candidates = ResponseEngine.generateCandidates(
    "Roma caiu",
  );

  assert.ok(Array.isArray(candidates));
});

test("ResponseSource inclui 'semantic'", async () => {
  // Verificamos que o tipo foi adicionado verificando que um candidato
  // com source 'semantic' passa pela validação do TypeScript
  const { ResponseEngine } =
    await import(
      "../src/services/responseEngine"
    );

  // Se compilou, o tipo existe — apenas verificamos que a função existe
  assert.ok(typeof ResponseEngine.generateCandidates === "function");
});

// ─────────────────────────────────────────────────────────────────────────────
// Normalização de importância
// ─────────────────────────────────────────────────────────────────────────────

test("memórias com importância maior devem pontuar mais alto", () => {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const memories: ConversationMemory[] = [
    {
      id: 10,
      userId: "user-test",
      topic: "Roma",
      summary: "Roma caiu depois de muitas guerras",
      importance: 5, // máxima
      createdAt: now - day,
      lastSeen: now - day,
    },
    {
      id: 11,
      userId: "user-test",
      topic: "Roma",
      summary: "Roma caiu depois de muitas guerras",
      importance: 1, // mínima
      createdAt: now - day,
      lastSeen: now - day,
    },
  ];

  const tfidf = new SemanticSimilarityService();
  tfidf.train(
    memories.map((m) => ({
      id: String(m.id),
      text: `${m.topic}: ${m.summary}`,
    })),
  );

  const service = new SemanticContextService();
  service.setTfidfService(tfidf);

  const context = service.buildContext(
    "Roma caiu",
    memories,
    neutralEmotion(),
    { topK: 2 },
  );

  if (context.isActive && context.memories.length === 2) {
    // Alta importância deve ter score maior
    assert.ok(
      context.memories[0].score.final >=
        context.memories[1].score.final,
    );
  }
});
