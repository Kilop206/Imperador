import {
  AIRuntimeSemanticAnalysis,
  AIRuntimeService,
} from '../intelligence/aiRuntimeService';

import {
  SemanticActiveLearningOptions,
} from '../intelligence/semanticActiveLearningService';

import {
  SemanticCandidate,
} from '../intelligence/semanticCandidateService';

import {
  SemanticFeedbackService,
} from '../intelligence/semanticFeedbackService';

export interface SemanticMessageActiveLearningStatus {
  pendingCandidateCount: number;
  totalFeedbackCount: number;
  isInitialized: boolean;
}

/**
 * Serviço responsável por integrar o fluxo de mensagens reais
 * do Discord com o Semantic Active Learning.
 *
 * Pipeline:
 * Discord Message
 *   -> análise
 *   -> semantic analysis
 *   -> active learning
 *   -> candidate queue
 *
 * Regra fundamental:
 * Candidatos identificados como úteis/incertos são ENFILEIRADOS
 * na fila de candidatos (SemanticCandidateService), e NUNCA
 * adicionados automaticamente ao treinamento sem aprovação.
 */
export class SemanticMessageActiveLearningService {
  /**
   * Processa um par de textos originados de uma interação do Discord
   * (por exemplo: mensagem do usuário e resposta gerada ou contexto de memória).
   *
   * Avalia a incerteza semântica, conflito lexical/semântico ou novidade.
   * Se os critérios forem atendidos, enfileira o candidato na fila.
   */
  public static processInteraction(
    userMessage: string,
    contextOrReply: string,
    options: SemanticActiveLearningOptions = {},
  ): AIRuntimeSemanticAnalysis | null {
    const message = userMessage?.trim();
    const target = contextOrReply?.trim();

    if (!message || !target) {
      return null;
    }

    // Não analisa comandos administrativos como texto de treinamento
    if (message.startsWith('!') || target.startsWith('!')) {
      return null;
    }

    // Não analisa textos idênticos
    if (message.toLowerCase() === target.toLowerCase()) {
      return null;
    }

    try {
      AIRuntimeService.ensureInitialized();

      const analysis = AIRuntimeService.analyzeSemanticPair(
        message,
        target,
        options,
      );

      return analysis;
    } catch (error) {
      console.error(
        'Erro ao processar Semantic Active Learning para mensagem:',
        error,
      );

      return null;
    }
  }

  /**
   * Retorna os candidatos semânticos pendentes de revisão.
   */
  public static getPendingCandidates(limit = 10): SemanticCandidate[] {
    try {
      AIRuntimeService.ensureInitialized();

      return AIRuntimeService.getPendingSemanticCandidates(limit);
    } catch (error) {
      console.error('Erro ao consultar candidatos semânticos pendentes:', error);

      return [];
    }
  }

  /**
   * Retorna o total de candidatos semânticos aguardando revisão.
   */
  public static getPendingCandidateCount(): number {
    try {
      AIRuntimeService.ensureInitialized();

      return AIRuntimeService.getPendingSemanticCandidateCount();
    } catch (error) {
      console.error('Erro ao consultar contagem de candidatos semânticos:', error);

      return 0;
    }
  }

  /**
   * Aprova um candidato semântico com o rótulo informado (0 ou 1).
   * O candidato é transformado em feedback e removido da fila pendente.
   */
  public static approveCandidate(
    candidateId: number,
    label: 0 | 1,
  ): boolean {
    try {
      AIRuntimeService.ensureInitialized();

      return AIRuntimeService.approveSemanticCandidate(candidateId, label);
    } catch (error) {
      console.error(`Erro ao aprovar candidato semântico #${candidateId}:`, error);

      return false;
    }
  }

  /**
   * Rejeita um candidato semântico sem adicioná-lo aos dados de treinamento.
   */
  public static rejectCandidate(candidateId: number): boolean {
    try {
      AIRuntimeService.ensureInitialized();

      return AIRuntimeService.rejectSemanticCandidate(candidateId);
    } catch (error) {
      console.error(`Erro ao rejeitar candidato semântico #${candidateId}:`, error);

      return false;
    }
  }

  /**
   * Retorna o status operacional da fila e do repositório de feedback.
   */
  public static getStatus(): SemanticMessageActiveLearningStatus {
    try {
      AIRuntimeService.ensureInitialized();

      return {
        pendingCandidateCount: AIRuntimeService.getPendingSemanticCandidateCount(),
        totalFeedbackCount: SemanticFeedbackService.getCount(),
        isInitialized: AIRuntimeService.isInitialized(),
      };
    } catch {
      return {
        pendingCandidateCount: 0,
        totalFeedbackCount: 0,
        isInitialized: false,
      };
    }
  }
}
