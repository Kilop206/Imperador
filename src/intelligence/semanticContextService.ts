/**
 * 13.19 -- Integração semântica com o ResponseEngine
 *
 * SemanticContextService é uma façade que integra o HybridRetrievalService
 * com as memórias de conversa do Tibério.
 *
 * Princípio de integração gradual:
 * - O serviço é OPCIONAL. Quando não configurado, não quebra nada.
 * - O ResponseEngine consulta este serviço de forma não-bloqueante.
 * - As respostas determinísticas existentes são preservadas integralmente.
 * - Apenas adiciona candidatos extras com contexto semântico.
 */

import {
  HybridRetrievalService,
  type HybridMemoryCandidate,
  type HybridMemoryResult,
  type HybridWeights,
} from "./hybridRetrievalService";

import {
  SemanticSimilarityService,
} from "./semanticSimilarityService";

import {
  NeuralSemanticMemoryService,
} from "./neuralSemanticMemoryService";

import type {
  EmotionState,
} from "../types/emotion";

import type {
  ConversationMemory,
} from "../services/memoryService";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos públicos
// ─────────────────────────────────────────────────────────────────────────────

export interface SemanticContext {
  /** Memórias recuperadas e rankeadas */
  memories: HybridMemoryResult[];
  /** Melhor memória (top-1), ou null */
  best: HybridMemoryResult | null;
  /** Resumo textual do contexto para uso no ResponseEngine */
  contextSummary: string;
  /** True se o serviço está configurado e produziu resultados */
  isActive: boolean;
}

export interface SemanticContextOptions {
  topK?: number;
  minimumScore?: number;
  weights?: Partial<HybridWeights>;
  recencyHalfLifeMs?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Serviço
// ─────────────────────────────────────────────────────────────────────────────

export class SemanticContextService {
  private retrieval: HybridRetrievalService;
  private configured = false;

  constructor() {
    this.retrieval = new HybridRetrievalService();
  }

  // ─── Configuração opcional ─────────────────────────────────────────────────

  /**
   * Configura o serviço TF-IDF para o componente léxico-estatístico.
   * Opcional — sem ele o componente tfidf permanece em 0.
   */
  public setTfidfService(
    service: SemanticSimilarityService,
  ): void {
    this.retrieval.setTfidfService(service);
    this.configured = true;
  }

  /**
   * Configura o serviço neural para o componente de embedding.
   * Opcional — sem ele o componente neural permanece em 0.
   */
  public setNeuralService(
    service: NeuralSemanticMemoryService,
  ): void {
    this.retrieval.setNeuralService(service);
    this.configured = true;
  }

  /**
   * Marca o serviço como configurado mesmo sem TF-IDF nem neural,
   * para usar apenas keyword + recência + importância + emoção.
   */
  public enable(): void {
    this.configured = true;
  }

  public isConfigured(): boolean {
    return this.configured;
  }

  // ─── Recuperação de contexto ───────────────────────────────────────────────

  /**
   * Dado uma mensagem do usuário e um conjunto de memórias de conversa,
   * recupera as mais relevantes usando o ranking híbrido.
   *
   * Retorna um SemanticContext com `isActive = false` se o serviço
   * não estiver configurado ou se não houver memórias.
   */
  public buildContext(
    query: string,
    memories: ConversationMemory[],
    emotionState: EmotionState,
    options: SemanticContextOptions = {},
  ): SemanticContext {
    const empty: SemanticContext = {
      memories: [],
      best: null,
      contextSummary: "",
      isActive: false,
    };

    if (
      !this.configured ||
      !query.trim() ||
      memories.length === 0
    ) {
      return empty;
    }

    const candidates =
      this.convertMemories(memories);

    const results = this.retrieval.retrieve(
      query,
      candidates,
      emotionState,
      {
        topK: options.topK ?? 3,
        minimumScore: options.minimumScore ?? 0.05,
        weights: options.weights,
        recencyHalfLifeMs: options.recencyHalfLifeMs,
      },
    );

    if (results.length === 0) {
      return empty;
    }

    const best = results[0];

    const contextSummary =
      this.buildContextSummary(results);

    return {
      memories: results,
      best,
      contextSummary,
      isActive: true,
    };
  }

  /**
   * Formata um SemanticContext como texto para uso em prompts ou logs.
   */
  public formatContext(
    context: SemanticContext,
    maxItems = 3,
  ): string {
    if (!context.isActive) {
      return "";
    }

    const lines: string[] = [];

    const items = context.memories.slice(0, maxItems);

    for (const result of items) {
      lines.push(
        `[score=${result.score.final.toFixed(3)}] ${result.text}`,
      );
    }

    return lines.join("\n");
  }

  // ─── Privado ───────────────────────────────────────────────────────────────

  private convertMemories(
    memories: ConversationMemory[],
  ): HybridMemoryCandidate[] {
    return memories.map((memory) => ({
      id: String(memory.id),
      text: `${memory.topic}: ${memory.summary}`,
      createdAt: memory.createdAt,
      importance: normalizeImportance(memory.importance),
      metadata: {
        topic: memory.topic,
        userId: memory.userId,
      },
    }));
  }

  private buildContextSummary(
    results: HybridMemoryResult[],
  ): string {
    if (results.length === 0) {
      return "";
    }

    const best = results[0];

    const topic =
      (best.memory.metadata?.topic as string | undefined) ?? "";

    if (topic) {
      return `Tópico lembrado: ${topic}. ${best.text}`;
    }

    return best.text;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilitários internos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normaliza importance de ConversationMemory (geralmente 1–5) para 0–1.
 * O HybridRetrievalService aceita 0–1 ou 0–10 automaticamente,
 * mas aqui fazemos a conversão explícita para o domínio 1–5.
 */
function normalizeImportance(importance: number): number {
  // ConversationMemory.importance é 1–5 (confirmado no memoryService)
  if (importance <= 0) {
    return 0;
  }

  if (importance >= 5) {
    return 1;
  }

  return (importance - 1) / 4;
}
