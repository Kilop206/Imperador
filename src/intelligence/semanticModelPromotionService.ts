import type {
  SemanticEvaluationMetrics,
} from './semanticEvaluation';

export interface SemanticPromotionThresholds {
  minimumAccuracy: number;
  minimumPrecision: number;
  minimumRecall: number;
  minimumF1: number;
}

export interface SemanticPromotionInput {
  validationMetrics: SemanticEvaluationMetrics;
  testMetrics: SemanticEvaluationMetrics | null;
}

export interface SemanticPromotionResult {
  approved: boolean;
  reason: string;
  failedMetrics: string[];
}

const DEFAULT_THRESHOLDS:
  SemanticPromotionThresholds = {
    minimumAccuracy: 0.60,
    minimumPrecision: 0.55,
    minimumRecall: 0.55,
    minimumF1: 0.60,
  };

export class SemanticModelPromotionService {
  static evaluate(
    input: SemanticPromotionInput,
    thresholds:
      Partial<SemanticPromotionThresholds> = {},
  ): SemanticPromotionResult {
    const resolved =
      this.resolveThresholds(
        thresholds,
      );

    const failedMetrics: string[] = [];

    const validation =
      input.validationMetrics;

    if (
      validation.f1 <
      resolved.minimumF1
    ) {
      failedMetrics.push(
        `validation.f1 < ${resolved.minimumF1.toFixed(2)}`,
      );
    }

    if (
      validation.accuracy <
      resolved.minimumAccuracy
    ) {
      failedMetrics.push(
        `validation.accuracy < ${resolved.minimumAccuracy.toFixed(2)}`,
      );
    }

    if (
      validation.precision <
      resolved.minimumPrecision
    ) {
      failedMetrics.push(
        `validation.precision < ${resolved.minimumPrecision.toFixed(2)}`,
      );
    }

    if (
      validation.recall <
      resolved.minimumRecall
    ) {
      failedMetrics.push(
        `validation.recall < ${resolved.minimumRecall.toFixed(2)}`,
      );
    }

    if (!input.testMetrics) {
      return {
        approved: false,
        reason:
          'O modelo não possui métricas de teste.',
        failedMetrics: [
          ...failedMetrics,
          'test metrics ausentes',
        ],
      };
    }

    const test =
      input.testMetrics;

    if (
      test.f1 <
      resolved.minimumF1
    ) {
      failedMetrics.push(
        `test.f1 < ${resolved.minimumF1.toFixed(2)}`,
      );
    }

    if (
      test.accuracy <
      resolved.minimumAccuracy
    ) {
      failedMetrics.push(
        `test.accuracy < ${resolved.minimumAccuracy.toFixed(2)}`,
      );
    }

    if (
      test.precision <
      resolved.minimumPrecision
    ) {
      failedMetrics.push(
        `test.precision < ${resolved.minimumPrecision.toFixed(2)}`,
      );
    }

    if (
      test.recall <
      resolved.minimumRecall
    ) {
      failedMetrics.push(
        `test.recall < ${resolved.minimumRecall.toFixed(2)}`,
      );
    }

    if (
      failedMetrics.length === 0
    ) {
      return {
        approved: true,
        reason:
          'Modelo aprovado em validação e teste.',
        failedMetrics: [],
      };
    }

    return {
      approved: false,
      reason:
        'Modelo reprovado pelos critérios mínimos de qualidade.',
      failedMetrics,
    };
  }

  static formatResult(
    result: SemanticPromotionResult,
  ): string {
    if (
      result.approved
    ) {
      return [
        '=== Promotion Gate ===',
        'Status: ✅ APROVADO',
        `Motivo: ${result.reason}`,
      ].join('\n');
    }

    const lines = [
      '=== Promotion Gate ===',
      'Status: ❌ REPROVADO',
      `Motivo: ${result.reason}`,
    ];

    if (
      result.failedMetrics.length > 0
    ) {
      lines.push(
        '',
        'Critérios não atendidos:',
      );

      for (
        const metric of
        result.failedMetrics
      ) {
        lines.push(
          `- ${metric}`,
        );
      }
    }

    return lines.join('\n');
  }

  static getDefaultThresholds():
    SemanticPromotionThresholds {
    return {
      ...DEFAULT_THRESHOLDS,
    };
  }

  private static resolveThresholds(
    thresholds:
      Partial<SemanticPromotionThresholds>,
  ): SemanticPromotionThresholds {
    return {
      minimumAccuracy:
        this.clamp(
          thresholds.minimumAccuracy ??
            DEFAULT_THRESHOLDS
              .minimumAccuracy,
        ),

      minimumPrecision:
        this.clamp(
          thresholds.minimumPrecision ??
            DEFAULT_THRESHOLDS
              .minimumPrecision,
        ),

      minimumRecall:
        this.clamp(
          thresholds.minimumRecall ??
            DEFAULT_THRESHOLDS
              .minimumRecall,
        ),

      minimumF1:
        this.clamp(
          thresholds.minimumF1 ??
            DEFAULT_THRESHOLDS
              .minimumF1,
        ),
    };
  }

  private static clamp(
    value: number,
  ): number {
    if (
      !Number.isFinite(value)
    ) {
      return 0;
    }

    return Math.max(
      0,
      Math.min(
        1,
        value,
      ),
    );
  }
}