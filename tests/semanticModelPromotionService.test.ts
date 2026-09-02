import assert from 'node:assert/strict';

import {
  test,
} from 'node:test';

import {
  SemanticModelPromotionService,
} from '../src/intelligence/semanticModelPromotionService';

import type {
  SemanticEvaluationMetrics,
} from '../src/intelligence/semanticEvaluation';

function createMetrics(
  overrides:
    Partial<SemanticEvaluationMetrics> = {},
): SemanticEvaluationMetrics {
  return {
    accuracy: 0.80,
    precision: 0.80,
    recall: 0.80,
    f1: 0.80,
    truePositive: 8,
    trueNegative: 8,
    falsePositive: 2,
    falseNegative: 2,
    total: 20,
    ...overrides,
  };
}

test(
  'deve aprovar modelo que atende todos os critérios',
  () => {
    const result =
      SemanticModelPromotionService.evaluate({
        validationMetrics:
          createMetrics(),
        testMetrics:
          createMetrics(),
      });

    assert.equal(
      result.approved,
      true,
    );

    assert.equal(
      result.failedMetrics.length,
      0,
    );
  },
);

test(
  'deve rejeitar modelo sem métricas de teste',
  () => {
    const result =
      SemanticModelPromotionService.evaluate({
        validationMetrics:
          createMetrics(),
        testMetrics:
          null,
      });

    assert.equal(
      result.approved,
      false,
    );

    assert.ok(
      result.failedMetrics.includes(
        'test metrics ausentes',
      ),
    );
  },
);

test(
  'deve rejeitar F1 de validação abaixo do mínimo',
  () => {
    const result =
      SemanticModelPromotionService.evaluate({
        validationMetrics:
          createMetrics({
            f1: 0.50,
          }),
        testMetrics:
          createMetrics(),
      });

    assert.equal(
      result.approved,
      false,
    );

    assert.ok(
      result.failedMetrics.some(
        metric =>
          metric.startsWith(
            'validation.f1',
          ),
      ),
    );
  },
);

test(
  'deve rejeitar accuracy abaixo do mínimo',
  () => {
    const result =
      SemanticModelPromotionService.evaluate({
        validationMetrics:
          createMetrics({
            accuracy: 0.50,
          }),
        testMetrics:
          createMetrics(),
      });

    assert.equal(
      result.approved,
      false,
    );

    assert.ok(
      result.failedMetrics.some(
        metric =>
          metric.startsWith(
            'validation.accuracy',
          ),
      ),
    );
  },
);

test(
  'deve rejeitar precision abaixo do mínimo',
  () => {
    const result =
      SemanticModelPromotionService.evaluate({
        validationMetrics:
          createMetrics({
            precision: 0.40,
          }),
        testMetrics:
          createMetrics(),
      });

    assert.equal(
      result.approved,
      false,
    );

    assert.ok(
      result.failedMetrics.some(
        metric =>
          metric.startsWith(
            'validation.precision',
          ),
      ),
    );
  },
);

test(
  'deve rejeitar recall abaixo do mínimo',
  () => {
    const result =
      SemanticModelPromotionService.evaluate({
        validationMetrics:
          createMetrics({
            recall: 0.40,
          }),
        testMetrics:
          createMetrics(),
      });

    assert.equal(
      result.approved,
      false,
    );

    assert.ok(
      result.failedMetrics.some(
        metric =>
          metric.startsWith(
            'validation.recall',
          ),
      ),
    );
  },
);

test(
  'deve rejeitar F1 do conjunto de teste abaixo do mínimo',
  () => {
    const result =
      SemanticModelPromotionService.evaluate({
        validationMetrics:
          createMetrics(),
        testMetrics:
          createMetrics({
            f1: 0.40,
          }),
      });

    assert.equal(
      result.approved,
      false,
    );

    assert.ok(
      result.failedMetrics.some(
        metric =>
          metric.startsWith(
            'test.f1',
          ),
      ),
    );
  },
);

test(
  'deve rejeitar accuracy do conjunto de teste abaixo do mínimo',
  () => {
    const result =
      SemanticModelPromotionService.evaluate({
        validationMetrics:
          createMetrics(),
        testMetrics:
          createMetrics({
            accuracy: 0.40,
          }),
      });

    assert.equal(
      result.approved,
      false,
    );

    assert.ok(
      result.failedMetrics.some(
        metric =>
          metric.startsWith(
            'test.accuracy',
          ),
      ),
    );
  },
);

test(
  'deve aceitar thresholds personalizados',
  () => {
    const result =
      SemanticModelPromotionService.evaluate(
        {
          validationMetrics:
            createMetrics({
              accuracy: 0.70,
              precision: 0.70,
              recall: 0.70,
              f1: 0.70,
            }),
          testMetrics:
            createMetrics({
              accuracy: 0.70,
              precision: 0.70,
              recall: 0.70,
              f1: 0.70,
            }),
        },
        {
          minimumAccuracy: 0.70,
          minimumPrecision: 0.70,
          minimumRecall: 0.70,
          minimumF1: 0.70,
        },
      );

    assert.equal(
      result.approved,
      true,
    );
  },
);

test(
  'deve rejeitar múltiplos critérios simultaneamente',
  () => {
    const result =
      SemanticModelPromotionService.evaluate({
        validationMetrics:
          createMetrics({
            accuracy: 0.40,
            precision: 0.40,
            recall: 0.40,
            f1: 0.40,
          }),
        testMetrics:
          createMetrics({
            accuracy: 0.40,
            precision: 0.40,
            recall: 0.40,
            f1: 0.40,
          }),
      });

    assert.equal(
      result.approved,
      false,
    );

    assert.ok(
      result.failedMetrics.length >=
      8,
    );
  },
);

test(
  'deve fornecer thresholds padrão válidos',
  () => {
    const thresholds =
      SemanticModelPromotionService
        .getDefaultThresholds();

    assert.equal(
      thresholds.minimumAccuracy,
      0.60,
    );

    assert.equal(
      thresholds.minimumPrecision,
      0.55,
    );

    assert.equal(
      thresholds.minimumRecall,
      0.55,
    );

    assert.equal(
      thresholds.minimumF1,
      0.60,
    );
  },
);

test(
  'deve gerar relatório para modelo aprovado',
  () => {
    const result =
      SemanticModelPromotionService.evaluate({
        validationMetrics:
          createMetrics(),
        testMetrics:
          createMetrics(),
      });

    const formatted =
      SemanticModelPromotionService
        .formatResult(
          result,
        );

    assert.match(
      formatted,
      /APROVADO/,
    );
  },
);

test(
  'deve gerar relatório para modelo reprovado',
  () => {
    const result =
      SemanticModelPromotionService.evaluate({
        validationMetrics:
          createMetrics({
            f1: 0.20,
          }),
        testMetrics:
          createMetrics({
            f1: 0.20,
          }),
      });

    const formatted =
      SemanticModelPromotionService
        .formatResult(
          result,
        );

    assert.match(
      formatted,
      /REPROVADO/,
    );

    assert.match(
      formatted,
      /Critérios não atendidos/,
    );
  },
);