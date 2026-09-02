import {
  ModelManager,
} from './modelManager';

import {
  SemanticModelPromotionService,
  type SemanticPromotionResult,
  type SemanticPromotionThresholds,
} from './semanticModelPromotionService';

import type {
  SemanticFineTuningInput,
  SemanticFineTuningResult,
} from './semanticFineTuningService';

export interface SemanticModelManagerLike {
  getActiveVersion(): number | null;

  fineTune(
    input: SemanticFineTuningInput,
  ): SemanticFineTuningResult;

  activateVersion(
    version: number,
  ): boolean;
}

export interface SemanticSafeFineTuningResult {
  fineTuning: SemanticFineTuningResult;

  promotion: SemanticPromotionResult;

  previousActiveVersion: number;

  finalActiveVersion: number | null;

  rolledBack: boolean;
}

export class SemanticSafeFineTuningService {
  private readonly manager:
    SemanticModelManagerLike;

  constructor(
    manager: SemanticModelManagerLike = ModelManager,
  ) {
    this.manager = manager;
  }

  /**
   * Executa fine-tuning com promoção segura.
   *
   * Fluxo:
   *
   * 1. Obtém a versão ativa atual.
   * 2. Executa o fine-tuning.
   * 3. Avalia o candidato através do Promotion Gate.
   * 4. Se o candidato tiver sido ativado e for reprovado,
   *    restaura a versão anterior.
   * 5. Retorna o estado final do sistema.
   */
  public run(
    input: SemanticFineTuningInput,
    thresholds:
      Partial<SemanticPromotionThresholds> = {},
  ): SemanticSafeFineTuningResult {
    const previousActiveVersion =
      this.manager.getActiveVersion();

    if (
      previousActiveVersion === null
    ) {
      throw new Error(
        'Não existe modelo semântico ativo para servir como ponto de rollback.',
      );
    }

    const fineTuning =
      this.manager.fineTune(input);

    const promotion =
      SemanticModelPromotionService.evaluate(
        {
          validationMetrics:
            fineTuning.candidateValidationMetrics,

          testMetrics:
            fineTuning.candidateTestMetrics,
        },

        thresholds,
      );

    /**
     * O fine-tuning já rejeitou o candidato.
     *
     * Nesse cenário não há alteração da versão ativa
     * a ser revertida.
     */
    if (!fineTuning.activated) {
      return {
        fineTuning,

        promotion,

        previousActiveVersion,

        finalActiveVersion:
          this.manager.getActiveVersion(),

        rolledBack: false,
      };
    }

    /**
     * O candidato foi ativado e passou pelo Promotion Gate.
     */
    if (promotion.approved) {
      return {
        fineTuning,

        promotion,

        previousActiveVersion,

        finalActiveVersion:
          this.manager.getActiveVersion(),

        rolledBack: false,
      };
    }

    /**
     * O candidato foi ativado pelo fluxo de fine-tuning,
     * mas falhou nos critérios de promoção.
     *
     * Nesse caso, restaura imediatamente a versão
     * anterior conhecida.
     */
    const rolledBack =
      this.manager.activateVersion(
        previousActiveVersion,
      );

    if (!rolledBack) {
      throw new Error(
        `Falha crítica no rollback da versão ${previousActiveVersion} após reprovação do modelo ${fineTuning.candidateVersion}.`,
      );
    }

    return {
      fineTuning,

      promotion,

      previousActiveVersion,

      finalActiveVersion:
        this.manager.getActiveVersion(),

      rolledBack: true,
    };
  }

  /**
   * Formata o resultado para logs, diagnósticos
   * ou comandos administrativos.
   */
  public formatResult(
    result: SemanticSafeFineTuningResult,
  ): string {
    const lines: string[] = [
      '=== Fine-Tuning Seguro ===',

      `Versão anterior: ${result.previousActiveVersion}`,

      `Versão candidata: ${result.fineTuning.candidateVersion}`,

      `Fine-tuning ativou candidato: ${
        result.fineTuning.activated
          ? 'sim'
          : 'não'
      }`,

      `Promotion Gate: ${
        result.promotion.approved
          ? '✅ APROVADO'
          : '❌ REPROVADO'
      }`,

      `Rollback executado: ${
        result.rolledBack
          ? '✅ sim'
          : 'não'
      }`,

      `Versão ativa final: ${
        result.finalActiveVersion ??
        'nenhuma'
      }`,

      `Motivo: ${result.promotion.reason}`,
    ];

    if (
      result.promotion.failedMetrics.length >
      0
    ) {
      lines.push(
        '',
        'Critérios não atendidos:',
      );

      for (
        const metric of
        result.promotion.failedMetrics
      ) {
        lines.push(
          `- ${metric}`,
        );
      }
    }

    return lines.join('\n');
  }
}