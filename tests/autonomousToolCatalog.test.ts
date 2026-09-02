import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  AutonomousToolCatalog,
} from '../src/intelligence/autonomousToolCatalog';

import {
  ObservationEngine,
} from '../src/intelligence/observationEngine';

import {
  ToolRegistry,
} from '../src/intelligence/toolRegistry';

import {
  PlanningEngine,
} from '../src/intelligence/planningEngine';

import {
  GoalEngine,
} from '../src/intelligence/goalEngine';

const TEST_STORAGE_FILE =
  path.join(
    process.cwd(),
    'data',
    'test-autonomous-tool-catalog-goals.json',
  );

function cleanup(): void {
  try {
    if (
      fs.existsSync(
        TEST_STORAGE_FILE,
      )
    ) {
      fs.unlinkSync(
        TEST_STORAGE_FILE,
      );
    }
  } catch {
    // Ignora erros de limpeza.
  }
}

function createCatalog() {
  cleanup();

  GoalEngine.initialize(
    TEST_STORAGE_FILE,
  );

  PlanningEngine.reset();

  const registry =
    new ToolRegistry();

  const observations =
    new ObservationEngine();

  const catalog =
    new AutonomousToolCatalog(
      registry,
      {
        observationEngine:
          observations,
      },
    );

  return {
    registry,
    observations,
    catalog,
  };
}

test.afterEach(() => {
  try {
    GoalEngine.reset();
  } catch {
    // Ignora.
  }

  PlanningEngine.reset();
  cleanup();
});

test(
  'registra todas as ferramentas diagnósticas padrão',
  () => {
    const {
      registry,
      catalog,
    } =
      createCatalog();

    catalog.registerDefaults();

    assert.equal(
      registry.getToolCount(),
      5,
    );

    assert.equal(
      registry.has(
        'system_health',
      ),
      true,
    );

    assert.equal(
      registry.has(
        'active_goals',
      ),
      true,
    );

    assert.equal(
      registry.has(
        'recent_observations',
      ),
      true,
    );

    assert.equal(
      registry.has(
        'active_plans',
      ),
      true,
    );

    assert.equal(
      registry.has(
        'model_status',
      ),
      true,
    );
  },
);

test(
  'system_health é uma ferramenta de baixo risco',
  () => {
    const {
      registry,
      catalog,
    } =
      createCatalog();

    catalog.registerDefaults();

    const tool =
      registry.get(
        'system_health',
      );

    assert.ok(
      tool,
    );

    assert.equal(
      tool?.riskLevel,
      'low',
    );

    assert.deepEqual(
      tool?.parameters,
      [],
    );
  },
);

test(
  'active_plans retorna somente planos ativos',
  () => {
    const {
      registry,
      catalog,
    } =
      createCatalog();

    catalog.registerDefaults();

    const goal =
      GoalEngine.createGoal({
        type:
          'learn_topic',
        title:
          'Plano de teste',
        description:
          'Objetivo para validação.',
        priority:
          'medium',
        targetMetric:
          'progress',
        targetValue:
          100,
        initialValue:
          0,
        criteria: [
          'Executar teste.',
        ],
      });

    const plan =
      PlanningEngine.createPlanForGoal(
        goal,
      );

    const result =
      registry.execute(
        'active_plans',
        {},
      );

    return result.then(
      execution => {
        assert.equal(
          execution.success,
          true,
        );

        const payload =
          execution.result as {
            plans: Array<{
              id: string;
              goalId: string;
              status: string;
            }>;
          };

        assert.equal(
          payload.plans.length,
          1,
        );

        assert.equal(
          payload.plans[0].id,
          plan.id,
        );

        assert.equal(
          payload.plans[0].goalId,
          goal.id,
        );

        assert.equal(
          payload.plans[0].status,
          'ready',
        );
      },
    );
  },
);

test(
  'recent_observations limita a quantidade retornada',
  async () => {
    const {
      registry,
      observations,
      catalog,
    } =
      createCatalog();

    catalog.registerDefaults();

    for (
      let index = 0;
      index < 20;
      index += 1
    ) {
      observations.observeSystem({
        summary:
          `Observação ${index}`,
        significance:
          'low',
      });
    }

    const result =
      await registry.execute(
        'recent_observations',
        {
          limit:
            5,
        },
      );

    assert.equal(
      result.success,
      true,
    );

    const payload =
      result.result as {
        observations: unknown[];
      };

    assert.equal(
      payload.observations.length,
      5,
    );
  },
);

test(
  'recent_observations limita valores excessivos ao máximo seguro',
  async () => {
    const {
      registry,
      observations,
      catalog,
    } =
      createCatalog();

    catalog.registerDefaults();

    for (
      let index = 0;
      index < 60;
      index += 1
    ) {
      observations.observeSystem({
        summary:
          `Observação ${index}`,
        significance:
          'low',
      });
    }

    const result =
      await registry.execute(
        'recent_observations',
        {
          limit:
            10_000,
        },
      );

    assert.equal(
      result.success,
      true,
    );

    const payload =
      result.result as {
        observations: unknown[];
      };

    assert.equal(
      payload.observations.length,
      50,
    );
  },
);

test(
  'catalogo não substitui ferramentas existentes',
  async () => {
    const {
      registry,
      catalog,
    } =
      createCatalog();

    const customResult = {
      custom:
        true,
    };

    registry.register({
      name:
        'system_health',
      description:
        'Implementação customizada.',
      riskLevel:
        'low',
      parameters: [],
      execute: () =>
        customResult,
    });

    catalog.registerDefaults();

    assert.equal(
      registry.getToolCount(),
      5,
    );

    const result =
      await registry.execute(
        'system_health',
        {},
      );

    assert.equal(
      result.success,
      true,
    );

    assert.deepEqual(
      result.result,
      customResult,
    );
  },
);

test(
  'todas as ferramentas padrão permanecem habilitadas',
  () => {
    const {
      registry,
      catalog,
    } =
      createCatalog();

    catalog.registerDefaults();

    for (
      const toolName of [
        'system_health',
        'active_goals',
        'recent_observations',
        'active_plans',
        'model_status',
      ]
    ) {
      const tool =
        registry.get(
          toolName,
        );

      assert.ok(
        tool,
      );

      assert.equal(
        tool?.enabled,
        true,
      );

      assert.equal(
        tool?.riskLevel,
        'low',
      );
    }
  },
);