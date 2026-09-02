import assert from 'node:assert/strict';

import {
  test,
} from 'node:test';

import {
  SemanticSafeFineTuningService,
  type SemanticModelManagerLike,
} from '../src/intelligence/semanticSafeFineTuningService';

import type {
  SemanticEvaluationMetrics,
} from '../src/intelligence/semanticEvaluation';

import type {
  SemanticFineTuningInput,
  SemanticFineTuningResult,
} from '../src/intelligence/semanticFineTuningService';

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

function createInput():
  SemanticFineTuningInput {
  return {
    originalDataset: [
      {
        first: 'Olá',
        second: 'Oi',
        label: 1,
      },
    ],

    validationDataset: [
      {
        first: 'Olá',
        second: 'Oi',
        label: 1,
      },
    ],

    testDataset: [
      {
        first: 'Olá',
        second: 'Oi',
        label: 1,
      },
    ],
  };
}

function createFineTuningResult(
  overrides:
    Partial<SemanticFineTuningResult> = {},
): SemanticFineTuningResult {
  return {
    candidateVersion: 2,

    previousValidationMetrics:
      createMetrics(),

    candidateValidationMetrics:
      createMetrics(),

    candidateTestMetrics:
      createMetrics(),

    originalPairs: 10,

    hardNegativePairs: 0,

    augmentedPairs: 0,

    totalTrainingPairs: 10,

    activated: true,

    reason:
      'Teste de fine-tuning.',

    ...overrides,
  };
}

class FakeModelManager
  implements SemanticModelManagerLike {
  private activeVersion: number | null;

  private result:
    SemanticFineTuningResult;

  public activationCalls: number[] = [];

  constructor(
    activeVersion: number,
    result:
      SemanticFineTuningResult,
  ) {
    this.activeVersion =
      activeVersion;

    this.result = result;
  }

  getActiveVersion():
    number | null {
    return this.activeVersion;
  }

  fineTune(
    _input: SemanticFineTuningInput,
  ): SemanticFineTuningResult {
    if (
      this.result.activated
    ) {
      this.activeVersion =
        this.result.candidateVersion;
    }

    return this.result;
  }

  activateVersion(
    version: number,
  ): boolean {
    this.activationCalls.push(
      version,
    );

    if (
      version <= 0
    ) {
      return false;
    }

    this.activeVersion =
      version;

    return true;
  }
}

test(
  'deve manter candidato quando o Promotion Gate aprova',
  () => {
    const manager =
      new FakeModelManager(
        1,
        createFineTuningResult({
          candidateVersion: 2,

          candidateValidationMetrics:
            createMetrics({
              accuracy: 0.90,
              precision: 0.90,
              recall: 0.90,
              f1: 0.90,
            }),

          candidateTestMetrics:
            createMetrics({
              accuracy: 0.90,
              precision: 0.90,
              recall: 0.90,
              f1: 0.90,
            }),
        }),
      );

    const service =
      new SemanticSafeFineTuningService(
        manager,
      );

    const result =
      service.run(
        createInput(),
      );

    assert.equal(
      result.previousActiveVersion,
      1,
    );

    assert.equal(
      result.fineTuning.candidateVersion,
      2,
    );

    assert.equal(
      result.promotion.approved,
      true,
    );

    assert.equal(
      result.rolledBack,
      false,
    );

    assert.equal(
      result.finalActiveVersion,
      2,
    );

    assert.deepEqual(
      manager.activationCalls,
      [],
    );
  },
);

test(
  'deve executar rollback quando candidato ativo falha no Promotion Gate',
  () => {
    const manager =
      new FakeModelManager(
        1,
        createFineTuningResult({
          candidateVersion: 2,

          candidateValidationMetrics:
            createMetrics({
              accuracy: 0.40,
              precision: 0.40,
              recall: 0.40,
              f1: 0.40,
            }),

          candidateTestMetrics:
            createMetrics({
              accuracy: 0.40,
              precision: 0.40,
              recall: 0.40,
              f1: 0.40,
            }),
        }),
      );

    const service =
      new SemanticSafeFineTuningService(
        manager,
      );

    const result =
      service.run(
        createInput(),
      );

    assert.equal(
      result.previousActiveVersion,
      1,
    );

    assert.equal(
      result.promotion.approved,
      false,
    );

    assert.equal(
      result.rolledBack,
      true,
    );

    assert.equal(
      result.finalActiveVersion,
      1,
    );

    assert.deepEqual(
      manager.activationCalls,
      [1],
    );
  },
);

test(
  'não deve fazer rollback quando fine-tuning já rejeitou o candidato',
  () => {
    const manager =
      new FakeModelManager(
        1,
        createFineTuningResult({
          candidateVersion: 2,

          activated: false,

          candidateValidationMetrics:
            createMetrics({
              accuracy: 0.50,
              precision: 0.50,
              recall: 0.50,
              f1: 0.50,
            }),

          candidateTestMetrics:
            null,
        }),
      );

    const service =
      new SemanticSafeFineTuningService(
        manager,
      );

    const result =
      service.run(
        createInput(),
      );

    assert.equal(
      result.fineTuning.activated,
      false,
    );

    assert.equal(
      result.promotion.approved,
      false,
    );

    assert.equal(
      result.rolledBack,
      false,
    );

    assert.equal(
      result.finalActiveVersion,
      1,
    );

    assert.deepEqual(
      manager.activationCalls,
      [],
    );
  },
);

test(
  'deve lançar erro quando não existe versão ativa para rollback',
  () => {
    const manager =
      new FakeModelManager(
        0,
        createFineTuningResult(),
      );

    /**
     * O fake precisa representar ausência real
     * de versão ativa.
     */
    manager.activateVersion =
      () => false;

    Object.defineProperty(
      manager,
      'activeVersion',
      {
        value: null,
        writable: true,
      },
    );

    const service =
      new SemanticSafeFineTuningService(
        manager,
      );

    assert.throws(
      () =>
        service.run(
          createInput(),
        ),

      /Não existe modelo semântico ativo/,
    );
  },
);

test(
  'deve lançar erro quando rollback falha',
  () => {
    const manager =
      new FakeModelManager(
        1,
        createFineTuningResult({
          candidateVersion: 2,

          candidateValidationMetrics:
            createMetrics({
              accuracy: 0.40,
              precision: 0.40,
              recall: 0.40,
              f1: 0.40,
            }),

          candidateTestMetrics:
            createMetrics({
              accuracy: 0.40,
              precision: 0.40,
              recall: 0.40,
              f1: 0.40,
            }),
        }),
      );

    manager.activateVersion =
      () => false;

    const service =
      new SemanticSafeFineTuningService(
        manager,
      );

    assert.throws(
      () =>
        service.run(
          createInput(),
        ),

      /Falha crítica no rollback/,
    );
  },
);

test(
  'deve produzir relatório legível',
  () => {
    const manager =
      new FakeModelManager(
        1,
        createFineTuningResult({
          candidateVersion: 2,

          candidateValidationMetrics:
            createMetrics({
              accuracy: 0.40,
              precision: 0.40,
              recall: 0.40,
              f1: 0.40,
            }),

          candidateTestMetrics:
            createMetrics({
              accuracy: 0.40,
              precision: 0.40,
              recall: 0.40,
              f1: 0.40,
            }),
        }),
      );

    const service =
      new SemanticSafeFineTuningService(
        manager,
      );

    const result =
      service.run(
        createInput(),
      );

    const formatted =
      service.formatResult(
        result,
      );

    assert.match(
      formatted,
      /Fine-Tuning Seguro/,
    );

    assert.match(
      formatted,
      /REPROVADO/,
    );

    assert.match(
      formatted,
      /Rollback executado/,
    );

    assert.match(
      formatted,
      /Versão ativa final/,
    );
  },
);