import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ObservationEngine,
} from '../src/intelligence/observationEngine';

import type {
  ToolExecutionResult,
} from '../src/intelligence/toolRegistry';

function createSuccessfulExecution(
  overrides: Partial<ToolExecutionResult> = {},
): ToolExecutionResult {
  return {
    executionId: 'execution_1',
    toolName: 'test_tool',
    success: true,
    startedAt: 1_000,
    finishedAt: 1_100,
    durationMs: 100,
    result: {
      value: 42,
    },
    rolledBack: false,
    ...overrides,
  };
}

test(
  'registra observação de execução bem-sucedida',
  () => {
    const engine =
      new ObservationEngine();

    const observation =
      engine.observeExecution(
        createSuccessfulExecution(),
      );

    assert.equal(
      observation.source,
      'tool',
    );

    assert.equal(
      observation.type,
      'execution',
    );

    assert.equal(
      observation.success,
      true,
    );

    assert.equal(
      observation.executionId,
      'execution_1',
    );

    assert.equal(
      observation.toolName,
      'test_tool',
    );

    assert.equal(
      observation.significance,
      'low',
    );

    assert.equal(
      engine.getRecent(1).length,
      1,
    );
  },
);

test(
  'transforma falha de execução em observação de alta significância',
  () => {
    const engine =
      new ObservationEngine();

    const observation =
      engine.observeExecution(
        createSuccessfulExecution({
          success: false,
          error: 'falha simulada',
          durationMs: 200,
        }),
      );

    assert.equal(
      observation.success,
      false,
    );

    assert.equal(
      observation.significance,
      'high',
    );

    assert.ok(
      observation.anomalies.includes(
        'A execução da ferramenta falhou.',
      ),
    );
  },
);

test(
  'detecta execução lenta',
  () => {
    const engine =
      new ObservationEngine();

    const observation =
      engine.observeExecution(
        createSuccessfulExecution({
          durationMs: 30_000,
        }),
      );

    assert.ok(
      observation.anomalies.includes(
        'A execução apresentou duração elevada.',
      ),
    );

    assert.equal(
      observation.significance,
      'medium',
    );
  },
);

test(
  'permite observações do sistema',
  () => {
    const engine =
      new ObservationEngine();

    const observation =
      engine.observeSystem({
        summary:
          'Sistema iniciou normalmente.',
        metrics: {
          cpu: 20,
          memory: 40,
        },
      });

    assert.equal(
      observation.source,
      'system',
    );

    assert.equal(
      observation.type,
      'system',
    );

    assert.equal(
      observation.success,
      undefined,
    );

    assert.equal(
      observation.metrics?.cpu,
      20,
    );
  },
);

test(
  'transforma observação de sistema com anomalia em tipo anomaly',
  () => {
    const engine =
      new ObservationEngine();

    const observation =
      engine.observeSystem({
        summary:
          'CPU acima do limite.',
        anomalies: [
          'CPU > 90%',
        ],
      });

    assert.equal(
      observation.type,
      'anomaly',
    );

    assert.equal(
      observation.significance,
      'medium',
    );
  },
);

test(
  'permite observações de interação do usuário',
  () => {
    const engine =
      new ObservationEngine();

    const observation =
      engine.observeUserInteraction({
        summary:
          'Usuário solicitou ajuda.',
        data: {
          category: 'support',
        },
      });

    assert.equal(
      observation.source,
      'user',
    );

    assert.equal(
      observation.type,
      'user_interaction',
    );

    assert.equal(
      observation.data?.category,
      'support',
    );
  },
);

test(
  'permite observações produzidas pelo agente',
  () => {
    const engine =
      new ObservationEngine();

    const observation =
      engine.observeAgent(
        'Agente concluiu uma etapa do plano.',
        {
          significance: 'high',
        },
      );

    assert.equal(
      observation.source,
      'agent',
    );

    assert.equal(
      observation.significance,
      'high',
    );
  },
);

test(
  'consulta observações por executionId',
  () => {
    const engine =
      new ObservationEngine();

    engine.observeExecution(
      createSuccessfulExecution({
        executionId:
          'execution_target',
      }),
    );

    engine.observeExecution(
      createSuccessfulExecution({
        executionId:
          'execution_other',
      }),
    );

    const results =
      engine.getByExecutionId(
        'execution_target',
      );

    assert.equal(
      results.length,
      1,
    );

    assert.equal(
      results[0].executionId,
      'execution_target',
    );
  },
);

test(
  'consulta observações por ferramenta',
  () => {
    const engine =
      new ObservationEngine();

    engine.observeExecution(
      createSuccessfulExecution({
        toolName: 'tool_a',
      }),
    );

    engine.observeExecution(
      createSuccessfulExecution({
        toolName: 'tool_b',
      }),
    );

    const results =
      engine.getByToolName(
        'tool_a',
      );

    assert.equal(
      results.length,
      1,
    );

    assert.equal(
      results[0].toolName,
      'tool_a',
    );
  },
);

test(
  'consulta observações por tipo e significância',
  () => {
    const engine =
      new ObservationEngine();

    engine.observeExecution(
      createSuccessfulExecution(),
    );

    engine.observeExecution(
      createSuccessfulExecution({
        success: false,
        executionId:
          'execution_failed',
      }),
    );

    assert.equal(
      engine.getByType(
        'execution',
      ).length,
      2,
    );

    assert.equal(
      engine.getBySignificance(
        'high',
      ).length,
      1,
    );
  },
);

test(
  'retorna as observações mais recentes primeiro',
  () => {
    const engine =
      new ObservationEngine();

    const first =
      engine.observeSystem({
        summary: 'primeira',
      });

    const second =
      engine.observeSystem({
        summary: 'segunda',
      });

    const recent =
      engine.getRecent(2);

    assert.equal(
      recent.length,
      2,
    );

    assert.equal(
      recent[0].id,
      second.id,
    );

    assert.equal(
      recent[1].id,
      first.id,
    );
  },
);

test(
  'limita o histórico ao máximo configurado',
  () => {
    const engine =
      new ObservationEngine(2);

    engine.observeSystem({
      summary: '1',
    });

    engine.observeSystem({
      summary: '2',
    });

    engine.observeSystem({
      summary: '3',
    });

    assert.equal(
      engine.getStatus()
        .totalObservations,
      2,
    );

    const recent =
      engine.getRecent(10);

    assert.equal(
      recent.length,
      2,
    );

    assert.equal(
      recent[0].summary,
      '3',
    );

    assert.equal(
      recent[1].summary,
      '2',
    );
  },
);

test(
  'não armazena observações quando desabilitado',
  () => {
    const engine =
      new ObservationEngine();

    engine.setEnabled(false);

    const observation =
      engine.observeSystem({
        summary:
          'não deve persistir',
      });

    assert.equal(
      observation.summary,
      'não deve persistir',
    );

    assert.equal(
      engine.getStatus()
        .totalObservations,
      0,
    );
  },
);

test(
  'agrega métricas corretamente',
  () => {
    const engine =
      new ObservationEngine();

    engine.observeExecution(
      createSuccessfulExecution({
        executionId: 'success',
      }),
    );

    engine.observeExecution(
      createSuccessfulExecution({
        executionId: 'failure',
        success: false,
        error: 'erro',
      }),
    );

    engine.observeSystem({
      summary:
        'anomalia detectada',
      anomalies: [
        'teste',
      ],
    });

    const aggregate =
      engine.getAggregate();

    assert.equal(
      aggregate.total,
      3,
    );

    assert.equal(
      aggregate.successful,
      1,
    );

    assert.equal(
      aggregate.failed,
      1,
    );

    assert.equal(
      aggregate.anomalies,
      2,
    );

    assert.equal(
      aggregate.bySource.tool,
      2,
    );

    assert.equal(
      aggregate.bySource.system,
      1,
    );

    assert.equal(
      aggregate.byType.execution,
      2,
    );

    assert.equal(
      aggregate.byType.anomaly,
      1,
    );

    assert.equal(
      aggregate.successRate,
      0.5,
    );
  },
);

test(
  'filtra agregados por origem e período',
  () => {
    const engine =
      new ObservationEngine();

    const first =
      engine.observeSystem({
        summary: 'first',
      });

    const second =
      engine.observeUserInteraction({
        summary: 'second',
      });

    const aggregate =
      engine.getAggregate({
        source: 'user',
        since: second.timestamp,
      });

    assert.equal(
      aggregate.total,
      1,
    );

    assert.equal(
      aggregate.bySource.user,
      1,
    );

    assert.equal(
      aggregate.bySource.system,
      0,
    );

    assert.ok(
      second.timestamp >=
        first.timestamp,
    );
  },
);

test(
  'retorna cópia segura das observações',
  () => {
    const engine =
      new ObservationEngine();

    const observation =
      engine.observeSystem({
        summary: 'original',
        data: {
          nested: {
            value: 10,
          },
        },
        anomalies: [
          'original anomaly',
        ],
      });

    observation.summary =
      'alterado';

    observation.data!.nested =
      {
        value: 99,
      };

    observation.anomalies[0] =
      'alterado';

    const stored =
      engine.get(
        observation.id,
      );

    assert.equal(
      stored?.summary,
      'original',
    );

    assert.equal(
      (
        stored?.data?.nested as {
          value: number;
        }
      ).value,
      10,
    );

    assert.equal(
      stored?.anomalies[0],
      'original anomaly',
    );
  },
);

test(
  'sanitiza estruturas profundas e strings muito grandes',
  () => {
    const engine =
      new ObservationEngine();

    const hugeString =
      'x'.repeat(2_000);

    const observation =
      engine.observeSystem({
        summary: hugeString,
        data: {
          level1: {
            level2: {
              level3: {
                level4: {
                  level5:
                    'too deep',
                },
              },
            },
          },
        },
      });

    assert.equal(
      observation.summary.length,
      1_000,
    );

    const level1 =
      observation.data!
        .level1 as Record<
        string,
        unknown
      >;

    const level2 =
      level1.level2 as Record<
        string,
        unknown
      >;

    const level3 =
      level2.level3 as Record<
        string,
        unknown
      >;

    const level4 =
      level3.level4 as Record<
        string,
        unknown
      >;

    assert.equal(
      level4.level5,
      '[depth-limit]',
    );
  },
);

test(
  'remove métricas não finitas',
  () => {
    const engine =
      new ObservationEngine();

    const observation =
      engine.observeSystem({
        summary:
          'métricas',
        metrics: {
          valid: 10,
          infinite:
            Number.POSITIVE_INFINITY,
          nan: Number.NaN,
        },
      });

    assert.deepEqual(
      observation.metrics,
      {
        valid: 10,
      },
    );
  },
);

test(
  'limpa todas as observações',
  () => {
    const engine =
      new ObservationEngine();

    engine.observeSystem({
      summary: 'teste',
    });

    assert.equal(
      engine.getStatus()
        .totalObservations,
      1,
    );

    engine.clear();

    assert.equal(
      engine.getStatus()
        .totalObservations,
      0,
    );
  },
);

test(
  'rejeita capacidade máxima inválida',
  () => {
    assert.throws(
      () =>
        new ObservationEngine(0),
      RangeError,
    );

    assert.throws(
      () =>
        new ObservationEngine(-1),
      RangeError,
    );
  },
);