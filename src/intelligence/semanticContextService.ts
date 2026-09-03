/**
 * 13.19 -- Integração semântica com o ResponseEngine
 *
 * SemanticContextService integra o HybridRetrievalService
 * com as memórias de conversa do Tibério.
 *
 * O serviço continua opcional, mas agora possui um gate conservador:
 * uma memória semântica precisa apresentar evidência lexical ou TF-IDF
 * antes de poder virar contexto de resposta.
 */

import {
  HybridRetrievalService,
  type HybridMemoryCandidate,
  type HybridMemoryResult,
  type HybridWeights,
} from './hybridRetrievalService';

import {
  SemanticSimilarityService,
} from './semanticSimilarityService';

import {
  NeuralSemanticMemoryService,
} from './neuralSemanticMemoryService';

import type {
  EmotionState,
} from '../types/emotion';

import type {
  ConversationMemory,
} from '../services/memoryService';

export interface SemanticContext {
  /** Memórias recuperadas e rankeadas */
  memories: HybridMemoryResult[];

  /** Melhor memória (top-1), ou null */
  best: HybridMemoryResult | null;

  /** Resumo textual do contexto para uso no ResponseEngine */
  contextSummary: string;

  /** True se o serviço está configurado e produziu contexto válido */
  isActive: boolean;
}

export interface SemanticContextOptions {
  topK?: number;
  minimumScore?: number;
  weights?: Partial<HybridWeights>;
  recencyHalfLifeMs?: number;
}

/**
 * Gate mínimo para permitir uma memória semântica em uma resposta.
 *
 * A similaridade neural isolada é considerada insuficiente porque
 * embeddings podem aproximar frases semanticamente vagas.
 */
const MIN_KEYWORD_SIGNAL = 0.08;

const MIN_TFIDF_SIGNAL = 0.15;

export class SemanticContextService {
  private retrieval:
    HybridRetrievalService;

  private configured =
    false;

  constructor() {
    this.retrieval =
      new HybridRetrievalService();
  }

  // ─── Configuração opcional ──────────────────────────────────────────────────

  /**
   * Configura o serviço de similaridade TF-IDF.
   */
  public setTfidfService(
    service: SemanticSimilarityService,
  ): void {
    this.retrieval.setTfidfService(
      service,
    );

    this.configured =
      true;
  }

  /**
   * Configura o serviço neural.
   */
  public setNeuralService(
    service: NeuralSemanticMemoryService,
  ): void {
    this.retrieval.setNeuralService(
      service,
    );

    this.configured =
      true;
  }

  /**
   * Marca o serviço como configurado sem depender
   * obrigatoriamente de TF-IDF ou neural.
   */
  public enable(): void {
    this.configured =
      true;
  }

  public isConfigured(): boolean {
    return this.configured;
  }

  // ─── Recuperação de contexto ────────────────────────────────────────────────

  /**
   * Recupera contexto semântico para uma mensagem.
   *
   * Uma memória só pode ser utilizada quando:
   *
   * - existe um score híbrido mínimo; e
   * - existe evidência lexical ou TF-IDF suficiente.
   *
   * O componente neural continua participando do ranking,
   * mas não pode sozinho transformar qualquer mensagem vaga
   * em uma lembrança.
   */
  public buildContext(
    query: string,
    memories: ConversationMemory[],
    emotionState: EmotionState,
    options: SemanticContextOptions = {},
  ): SemanticContext {
    const empty:
      SemanticContext = {
        memories: [],
        best: null,
        contextSummary: '',
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
      this.convertMemories(
        memories,
      );

    const results =
      this.retrieval.retrieve(
        query,
        candidates,
        emotionState,
        {
          topK:
            options.topK ??
            3,

          minimumScore:
            options.minimumScore ??
            0.10,

          weights:
            options.weights,

          recencyHalfLifeMs:
            options.recencyHalfLifeMs,
        },
      );

    if (
      results.length === 0
    ) {
      return empty;
    }

    const gatedResults =
      results.filter(
        result =>
          this.hasSemanticEvidence(
            result,
          ),
      );

    if (
      gatedResults.length === 0
    ) {
      return empty;
    }

    const best =
      gatedResults[0];

    const contextSummary =
      this.buildContextSummary(
        gatedResults,
      );

    return {
      memories:
        gatedResults,

      best,

      contextSummary,

      isActive:
        true,
    };
  }

  /**
   * Formata um SemanticContext como texto.
   */
  public formatContext(
    context: SemanticContext,
    maxItems = 3,
  ): string {
    if (
      !context.isActive
    ) {
      return '';
    }

    const lines: string[] = [];

    const items =
      context.memories.slice(
        0,
        maxItems,
      );

    for (
      const result of items
    ) {
      lines.push(
        `[score=${result.score.final.toFixed(3)}] ${result.text}`,
      );
    }

    return lines.join('\n');
  }

  // ─── Privado ────────────────────────────────────────────────────────────────

  private convertMemories(
    memories: ConversationMemory[],
  ): HybridMemoryCandidate[] {
    return memories.map(
      memory => ({
        id:
          String(memory.id),

        text:
          `${memory.topic}: ${memory.summary}`,

        createdAt:
          memory.createdAt,

        importance:
          normalizeImportance(
            memory.importance,
          ),

        metadata: {
          topic:
            memory.topic,

          userId:
            memory.userId,
        },
      }),
    );
  }

  /**
   * Garante que a memória tenha algum sinal textual real.
   *
   * Neural similarity continua válida para ranking,
   * mas não é suficiente para ativar contexto.
   */
  private hasSemanticEvidence(
    result: HybridMemoryResult,
  ): boolean {
    const {
      keyword,
      tfidf,
    } =
      result.score.components;

    return (
      keyword >=
        MIN_KEYWORD_SIGNAL ||
      tfidf >=
        MIN_TFIDF_SIGNAL
    );
  }

  private buildContextSummary(
    results: HybridMemoryResult[],
  ): string {
    if (
      results.length === 0
    ) {
      return '';
    }

    const best =
      results[0];

    const topic =
      (
        best.memory.metadata
          ?.topic as
          | string
          | undefined
      ) ?? '';

    if (
      topic
    ) {
      return (
        `Tópico lembrado: ${topic}. ${best.text}`
      );
    }

    return best.text;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilitários
// ─────────────────────────────────────────────────────────────────────────────

function normalizeImportance(
  importance: number,
): number {
  if (
    importance <= 0
  ) {
    return 0;
  }

  if (
    importance >= 5
  ) {
    return 1;
  }

  return (
    importance - 1
  ) / 4;
}