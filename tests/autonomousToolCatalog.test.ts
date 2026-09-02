import assert from 'node:assert/strict';
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
  GoalEngine,
} from '../src/intelligence/goalEngine';

import {
  PlanningEngine,
} from '../src/intelligence/planningEngine';

const TEST_STORAGE_FILE =
  `${process.cwd()}/data/test-tool-catalog-goals.json`;

function createCatalog() {
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
    // Ignora
  }

  PlanningEngine.reset();
});

test(
  'registra as ferramentas padrão',
  () => {
    const {
      registry,
      catalog,
    } =
      createCatalog();

    catalog.registerDefaults();

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
      registry.getToolCount(),
      3,
    );
  },
);

test(
  'registro padrão é idempotente',
  () => {
    const {
      registry,
      catalog,
    } =
      createCatalog();

    catalog.registerDefaults();
    catalog.registerDefaults();

    assert.equal(
      registry.getToolCount(),
      3,
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

    assert.equal(
      registry.getRiskLevel(
        'system_health',
      ),
      'low',
    );
  },
);

test(
  'active_goals é uma ferramenta de baixo risco',
  () => {
    const {
      registry,
      catalog,
    } =
      createCatalog();

    catalog.registerDefaults();

    assert.equal(
      registry.getRiskLevel(
        'active_goals',
      ),
      'low',
    );
  },
);

test(
  'recent_observations é uma ferramenta de baixo risco',
  () => {
    const {
      registry,
      catalog,
    } =
      createCatalog();

    catalog.registerDefaults();

    assert.equal(
      registry.getRiskLevel(
        'recent_observations',
      ),
      'low',
    );
  },
);

test(
  'system_health executa sem efeitos colaterais',
  async () => {
    const {
      registry,
      catalog,
    } =
      createCatalog();

    catalog.registerDefaults();

    const result =
      await registry.execute(
        'system_health',
        {},
        {
          source:
            'autonomous-agent',
        },
      );

    assert.equal(
      result.success,
      true,
    );

    assert.ok(
      result.result,
    );

    const value =
      result.result as Record<
        string,
        unknown
      >;

    assert.ok(
      value.mode,
    );

    assert.ok(
      value.ai,
    );

    assert.ok(
      value.evaluation,
    );
  },
);

test(
  'active_goals retorna os objetivos ativos',
  async () => {
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
          'Objetivo de catálogo',
        description:
          'Objetivo utilizado pelo teste.',
        priority:
          'low',
        targetMetric:
          'progress',
        targetValue:
          100,
        criteria: [
          'Testar ferramenta.',
        ],
      });

    const result =
      await registry.execute(
        'active_goals',
        {},
        {
          source:
            'autonomous-agent',
        },
      );

    assert.equal(
      result.success,
      true,
    );

    const value =
      result.result as {
        goals: Array<{
          id: string;
        }>;
      };

    assert.ok(
      value.goals.some(
        item =>
          item.id ===
          goal.id,
      ),
    );
  },
);

test(
  'recent_observations retorna observações recentes',
  async () => {
    const {
      registry,
      observations,
      catalog,
    } =
      createCatalog();

    catalog.registerDefaults();

    observations.observeSystem({
      summary:
        'Observação de teste.',
    });

    observations.observeSystem({
      summary:
        'Segunda observação.',
    });

    const result =
      await registry.execute(
        'recent_observations',
        {
          limit: 1,
        },
        {
          source:
            'autonomous-agent',
        },
      );

    assert.equal(
      result.success,
      true,
    );

    const value =
      result.result as {
        observations: Array<{
          summary: string;
        }>;
      };

    assert.equal(
      value.observations.length,
      1,
    );

    assert.equal(
      value.observations[0].summary,
      'Segunda observação.',
    );
  },
);

test(
  'limita a quantidade máxima de observações retornadas',
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
          `Observação ${index}.`,
      });
    }

    const result =
      await registry.execute(
        'recent_observations',
        {
          limit: 1_000,
        },
        {
          source:
            'autonomous-agent',
        },
      );

    assert.equal(
      result.success,
      true,
    );

    const value =
      result.result as {
        observations: Array<{
          summary: string;
        }>;
      };

    assert.equal(
      value.observations.length,
      50,
    );
  },
);

test(
  'rejeita parâmetro inválido para recent_observations',
  async () => {
    const {
      registry,
      catalog,
    } =
      createCatalog();

    catalog.registerDefaults();

    const result =
      await registry.execute(
        'recent_observations',
        {
          limit:
            'dez',
        },
        {
          source:
            'autonomous-agent',
        },
      );

    assert.equal(
      result.success,
      false,
    );

    assert.match(
      result.error ?? '',
      /limit.*number/i,
    );
  },
);

test(
  'catálogo não substitui ferramentas existentes',
  () => {
    const {
      registry,
      catalog,
    } =
      createCatalog();

    registry.register({
      name:
        'system_health',
      description:
        'Ferramenta customizada.',
      riskLevel:
        'low',
      parameters: [],
      execute: () => ({
        custom:
          true,
      }),
    });

    catalog.registerDefaults();

    assert.equal(
      registry.getToolCount(),
      3,
    );
  },
);

test(
  'não registra ferramentas de escrita ou execução arbitrária',
  () => {
    const {
      registry,
      catalog,
    } =
      createCatalog();

    catalog.registerDefaults();

    const names =
      registry.list().map(
        tool =>
          tool.name,
      );

    assert.deepEqual(
      names.sort(),
      [
        'active_goals',
        'recent_observations',
        'system_health',
      ],
    );
  },
);