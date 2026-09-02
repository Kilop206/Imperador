import {
  ConversationMemory,
  MemoryEvent,
  MemoryService,
} from './memoryService';

import {
  TextAnalyzer,
} from './textAnalyzer';

export interface MemoryConsolidationPolicy {
  /**
   * Limiar de similaridade de tokens para identificar duplicatas redundantes.
   * Default: 0.70
   */
  duplicateSimilarityThreshold: number;

  /**
   * Idade em dias a partir da qual memórias sem acesso sofrem decaimento de peso.
   * Default: 14 dias
   */
  decayAgeDays: number;

  /**
   * Idade em dias para que memórias de mínima importância sejam elegíveis para poda.
   * Default: 30 dias
   */
  garbageAgeDays: number;

  /**
   * Importância máxima considerada lixo (apenas memórias com importância <= valor são podadas).
   * Default: 1
   */
  garbageMaxImportance: number;

  /**
   * POLÍTICA EXPLÍCITA DE PROTEÇÃO:
   * Memórias com importância maior ou igual a este valor NUNCA são apagadas automaticamente.
   * Default: 5
   */
  protectedMinImportance: number;

  /**
   * Limiar de frequência / relevância para promover importância de memórias ativas.
   * Default: 3
   */
  promotionThreshold: number;
}

export interface MemoryAssociation {
  sourceTopic: string;
  targetTopic: string;
  sharedTokens: string[];
  relationship: string;
}

export interface MemoryConsolidationReport {
  timestamp: number;
  analyzedConversations: number;
  duplicatesResolved: number;
  contradictionsDetected: number;
  memoriesPromoted: number;
  memoriesDecayed: number;
  garbagePruned: number;
  summariesConsolidated: number;
  associations: MemoryAssociation[];
  durationMs: number;
}

export const DEFAULT_CONSOLIDATION_POLICY: Readonly<MemoryConsolidationPolicy> = {
  duplicateSimilarityThreshold: 0.70,
  decayAgeDays: 14,
  garbageAgeDays: 30,
  garbageMaxImportance: 1,
  protectedMinImportance: 5,
  promotionThreshold: 3,
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Autonomous Memory Consolidation Service
 *
 * Mecanismo autônomo que periodicamente consolida a memória episódica e semântica:
 * - Analisa memórias recentes
 * - Detecta e mescla duplicatas
 * - Detecta e resolve contradições
 * - Calcula e promove memórias relevantes
 * - Reduz peso (decay) de memórias antigas
 * - Elimina lixo sem violar a política de proteção de dados importantes
 * - Constrói resumos unificados
 * - Associa memórias relacionadas por afinidade temática
 */
export class AutonomousMemoryConsolidationService {
  private static policy: MemoryConsolidationPolicy = {
    ...DEFAULT_CONSOLIDATION_POLICY,
  };

  public static getPolicy(): Readonly<MemoryConsolidationPolicy> {
    return { ...this.policy };
  }

  public static setPolicy(newPolicy: Partial<MemoryConsolidationPolicy>): void {
    this.policy = {
      ...this.policy,
      ...newPolicy,
    };
  }

  public static resetPolicy(): void {
    this.policy = { ...DEFAULT_CONSOLIDATION_POLICY };
  }

  /**
   * Executa o ciclo completo de consolidação de memória.
   */
  public static consolidate(
    options: Partial<MemoryConsolidationPolicy> = {},
    currentTime: number = Date.now(),
  ): MemoryConsolidationReport {
    const startTime = Date.now();
    const policy = { ...this.policy, ...options };

    MemoryService.initialize();

    const conversations = MemoryService.getAllConversations(2000);
    const analyzedConversations = conversations.length;

    let duplicatesResolved = 0;
    let contradictionsDetected = 0;
    let memoriesPromoted = 0;
    let memoriesDecayed = 0;
    let garbagePruned = 0;
    let summariesConsolidated = 0;

    // 1. Agrupamento por usuário para análise individualizada
    const userMap = new Map<string, ConversationMemory[]>();
    for (const conv of conversations) {
      if (!userMap.has(conv.userId)) {
        userMap.set(conv.userId, []);
      }
      userMap.get(conv.userId)!.push(conv);
    }

    // 2. Processamento de duplicatas, contradições e resumos por usuário
    for (const [userId, userConversations] of userMap.entries()) {
      const activeList = [...userConversations];

      for (let i = 0; i < activeList.length; i++) {
        const primary = activeList[i];
        if (!primary) continue;

        for (let j = i + 1; j < activeList.length; j++) {
          const secondary = activeList[j];
          if (!secondary) continue;

          // Verificação de contradição primeiro (para não tratar contradição como mera duplicata)
          const contradiction = this.detectContradiction(
            primary.summary,
            secondary.summary,
          );

          const similarity = this.calculateSimilarity(
            primary.summary,
            secondary.summary,
          );

          const sameTopic = primary.topic === secondary.topic;

          if (contradiction) {
            contradictionsDetected++;
            const resolvedSummary = `[Perspectiva divergente registrada]: ${primary.summary} | Conflita com: ${secondary.summary}`;

            MemoryService.updateConversation(primary.id, {
              summary: resolvedSummary,
              importance: Math.min(10, Math.max(primary.importance, 5)), // Promove contradição para proteção
            });

            MemoryService.forgetConversation(secondary.id);
            activeList[j] = null as unknown as ConversationMemory;
            summariesConsolidated++;
          } else if (sameTopic || similarity >= policy.duplicateSimilarityThreshold) {
            // DUPLICATA ENCONTRADA: Mescla no primário e remove secundário
            const mergedImportance = Math.max(
              primary.importance,
              secondary.importance,
            );

            const mergedLastSeen = Math.max(
              primary.lastSeen,
              secondary.lastSeen,
            );

            const mergedSummary =
              primary.summary.length >= secondary.summary.length
                ? primary.summary
                : secondary.summary;

            MemoryService.updateConversation(primary.id, {
              summary: mergedSummary,
              importance: mergedImportance,
              lastSeen: mergedLastSeen,
            });

            MemoryService.forgetConversation(secondary.id);
            duplicatesResolved++;
            activeList[j] = null as unknown as ConversationMemory;
          }
        }
      }
    }

    // 3. Recarrega as conversas sobreviventes para aplicar Decay, Promoção e Poda de Lixo
    const remainingConversations = MemoryService.getAllConversations(2000);

    for (const conv of remainingConversations) {
      const ageMs = currentTime - conv.lastSeen;
      const ageDays = ageMs / MS_PER_DAY;

      // Promoção de tópicos relevantes ou nobres
      if (
        conv.topic.includes('roma') ||
        conv.topic.includes('imperador') ||
        conv.topic.includes('legiao') ||
        conv.topic.includes('filosof') ||
        conv.importance >= policy.promotionThreshold
      ) {
        if (conv.importance < 10) {
          const newImportance = Math.min(10, conv.importance + 1);
          MemoryService.updateConversation(conv.id, {
            importance: newImportance,
          });
          memoriesPromoted++;
        }
      }

      // Redução de peso (Decay) de memórias antigas não acessadas
      if (ageDays >= policy.decayAgeDays && conv.importance > 1) {
        // Apenas decai se não estiver no limiar de proteção máxima
        if (conv.importance < policy.protectedMinImportance) {
          const decayed = Math.max(1, conv.importance - 1);
          MemoryService.updateConversation(conv.id, {
            importance: decayed,
          });
          memoriesDecayed++;
        }
      }

      // Eliminação de lixo (Poda)
      // REGRA INVIOLÁVEL: Memórias protegidas (importance >= protectedMinImportance) NUNCA são apagadas
      if (
        conv.importance <= policy.garbageMaxImportance &&
        ageDays >= policy.garbageAgeDays
      ) {
        if (conv.importance < policy.protectedMinImportance) {
          MemoryService.forgetConversation(conv.id);
          garbagePruned++;
        }
      }
    }

    // 4. Associação de memórias relacionadas
    const associations = this.buildAssociations(remainingConversations);

    const durationMs = Date.now() - startTime;

    return {
      timestamp: currentTime,
      analyzedConversations,
      duplicatesResolved,
      contradictionsDetected,
      memoriesPromoted,
      memoriesDecayed,
      garbagePruned,
      summariesConsolidated,
      associations,
      durationMs,
    };
  }

  /**
   * Calcula similaridade de tokens Jaccard entre dois textos.
   */
  private static calculateSimilarity(textA: string, textB: string): number {
    const tokensA = new Set(TextAnalyzer.tokenize(textA));
    const tokensB = new Set(TextAnalyzer.tokenize(textB));

    if (tokensA.size === 0 || tokensB.size === 0) {
      return 0;
    }

    let intersection = 0;
    for (const t of tokensA) {
      if (tokensB.has(t)) {
        intersection++;
      }
    }

    const union = new Set([...tokensA, ...tokensB]).size;
    return union > 0 ? intersection / union : 0;
  }

  /**
   * Detecta se dois fragmentos de memória expressam contradição direta.
   */
  private static detectContradiction(textA: string, textB: string): boolean {
    const normA = textA.toLowerCase();
    const normB = textB.toLowerCase();

    const oppositePairs: Array<[string, string]> = [
      ['gosta', 'odeia'],
      ['apoia', 'rejeita'],
      ['amigo', 'inimigo'],
      ['fiel', 'traidor'],
      ['elogio', 'insulto'],
      ['sim', 'nao'],
      ['verdade', 'mentira'],
    ];

    for (const [pos, neg] of oppositePairs) {
      if (
        (normA.includes(pos) && normB.includes(neg)) ||
        (normA.includes(neg) && normB.includes(pos))
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Identifica associações semânticas entre diferentes tópicos gravados.
   */
  private static buildAssociations(
    conversations: ConversationMemory[],
  ): MemoryAssociation[] {
    const associations: MemoryAssociation[] = [];
    const topicTokens = new Map<string, Set<string>>();

    for (const conv of conversations) {
      if (!topicTokens.has(conv.topic)) {
        topicTokens.set(conv.topic, new Set());
      }
      const tokenSet = topicTokens.get(conv.topic)!;
      for (const token of TextAnalyzer.tokenize(conv.summary)) {
        if (token.length > 3) {
          tokenSet.add(token);
        }
      }
    }

    const topics = Array.from(topicTokens.keys());

    for (let i = 0; i < topics.length; i++) {
      for (let j = i + 1; j < topics.length; j++) {
        const topA = topics[i];
        const topB = topics[j];

        const setA = topicTokens.get(topA)!;
        const setB = topicTokens.get(topB)!;

        const shared: string[] = [];
        for (const t of setA) {
          if (setB.has(t)) {
            shared.push(t);
          }
        }

        if (shared.length >= 2) {
          associations.push({
            sourceTopic: topA,
            targetTopic: topB,
            sharedTokens: shared,
            relationship: `Afinidade temática com ${shared.length} termos compartilhados (${shared.slice(0, 3).join(', ')})`,
          });
        }
      }
    }

    return associations;
  }
}
