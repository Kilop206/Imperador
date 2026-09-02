import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  AutonomousAgentOrchestrator,
} from '../src/intelligence/autonomousAgentOrchestrator';

import {
  GoalEngine,
} from '../src/intelligence/goalEngine';

import {
  PlanningEngine,
} from '../src/intelligence/planningEngine';

import {
  ObservationEngine,
} from '../src/intelligence/observationEngine';

import {
  SafetyPermissionEngine,
} from '../src/intelligence/safetyPermissionEngine';

import {
  ToolRegistry,
} from '../src/intelligence/toolRegistry';

const TEST_STORAGE_FILE =
  path.join(
    process.cwd(),
    'data',
    'test-autonomous-agent-goals.json',
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
    // Ignora erros de limpeza
  }
}

interface TestEngines {
  registry: ToolRegistry;
  safety: SafetyPermissionEngine;
  observations: ObservationEngine;
  orchestrator: AutonomousAgentOrchestrator;
}

function createEngine(
  options: {
    minimumCycleIntervalMs?: number;
    maximumCyclesPerWindow?: number;
    cycleWindowMs?: number;
  } = {},
): TestEngines {
  cleanup();

  GoalEngine.initialize(
    TEST_STORAGE_FILE,
  );

  PlanningEngine.reset();

  const registry =
    new ToolRegistry();

  const safety =
    new SafetyPermissionEngine(
      registry,
    );

  const observations =
    new ObservationEngine();

  const orchestrator =
    new AutonomousAgentOrchestrator(
      safety,
      observations,
      {
        minimumCycleIntervalMs:
          options.minimumCycleIntervalMs ??
          5_000,
        maximumCyclesPerWindow:
          options.maximumCyclesPerWindow ??
          30,
        cycleWindowMs:
          options.cycleWindowMs ??
          60 * 60 * 1000,
      },
    );

  return {
    registry,
    safety,
    observations,
    orchestrator,
  };
}

function createSimpleGoal() {
  return GoalEngine.createGoal({
    type:
      'learn_topic',
    title:
      'Objetivo de teste',
    description:
      'Objetivo utilizado nos testes do orquestrador.',
    priority:
      'medium',
    targetMetric:
      'progress',
    targetValue:
      100,
    initialValue:
      0,
    criteria: [
      'Executar o fluxo de teste.',
    ],
  });
}

test.afterEach(() => {
  try {
    GoalEngine.reset();
  } catch {
    // Ignora
  }

  PlanningEngine.reset();
  cleanup();
});

test(
  'retorna disabled quando o orquestrador está desabilitado',
  async () => {
    const {
      orchestrator,
    } = createEngine();

    orchestrator.setEnabled(
      false,
    );

    const result =
      await orchestrator.tick(
        1_000,
      );

    assert.equal(
      result.decision,
      'disabled',
    );

    assert.equal(
      result.reason,
      'Orquestrador autônomo desabilitado.',
    );
  },
);

test(
  'retorna idle quando não existem objetivos ativos',
  async () => {
    const {
      orchestrator,
    } = createEngine();

    const result =
      await orchestrator.tick(
        1_000,
      );

    assert.equal(
      result.decision,
      'idle',
    );

    assert.match(
      result.reason,
      /Nenhum objetivo autônomo ativo/,
    );
  },
);

test(
  'cria um plano para um objetivo ativo',
  async () => {
    const {
      orchestrator,
    } = createEngine();

    const goal =
      createSimpleGoal();

    const result =
      await orchestrator.tick(
        1_000,
      );

    assert.equal(
      result.decision,
      'plan_created',
    );

    assert.equal(
      result.goalId,
      goal.id,
    );

    assert.ok(
      result.planId,
    );

    const plan =
      PlanningEngine.getPlan(
        result.planId!,
      );

    assert.ok(
      plan,
    );

    assert.equal(
      plan?.goalId,
      goal.id,
    );

    assert.equal(
      plan?.status,
      'ready',
    );
  },
);

test(
  'executa uma etapa interna e gera observação',
  async () => {
    const {
      orchestrator,
      observations,
    } = createEngine({
      minimumCycleIntervalMs:
        0,
    });

    const goal =
      createSimpleGoal();

    const first =
      await orchestrator.tick(
        1_000,
      );

    assert.equal(
      first.decision,
      'plan_created',
    );

    assert.equal(
      first.goalId,
      goal.id,
    );

    const second =
      await orchestrator.tick(
        2_000,
      );

    assert.equal(
      second.decision,
      'executed',
    );

    assert.equal(
      second.goalId,
      goal.id,
    );

    assert.ok(
      second.planId,
    );

    assert.ok(
      second.stepId,
    );

    assert.ok(
      second.observationId,
    );

    const observation =
      observations.get(
        second.observationId!,
      );

    assert.ok(
      observation,
    );

    assert.equal(
      observation?.source,
      'system',
    );

    assert.equal(
      observation?.success,
      undefined,
    );

    assert.equal(
      observations.getRecent(
        1,
      ).length,
      1,
    );
  },
);

test(
  'impede execução de ferramenta quando a permissão é negada',
  async () => {
    const {
      registry,
      safety,
      observations,
    } = createEngine();

    registry.register({
      name:
        'dangerous_tool',
      description:
        'Ferramenta perigosa de teste.',
      riskLevel:
        'high',
      parameters: [],
      execute: () => ({
        executed:
          true,
      }),
    });

    const result =
      await safety.execute(
        'dangerous_tool',
        {},
        {
          requestedAt:
            1_000,
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
      /human approval|aprova/i,
    );

    const observation =
      observations.observeExecution(
        result,
      );

    assert.equal(
      observation.success,
      false,
    );

    assert.ok(
      observation.anomalies.length >
        0,
    );
  },
);

test(
  'executa ferramenta explicitamente marcada como tool:',
  async () => {
    const {
      registry,
      safety,
    } = createEngine();

    let executions = 0;

    registry.register({
      name:
        'safe_tool',
      description:
        'Ferramenta segura de teste.',
      riskLevel:
        'low',
      parameters: [],
      execute: () => {
        executions += 1;

        return {
          ok: true,
        };
      },
    });

    const result =
      await safety.execute(
        'safe_tool',
        {},
        {
          requestedAt:
            1_000,
          source:
            'autonomous-agent',
        },
      );

    assert.equal(
      result.success,
      true,
    );

    assert.equal(
      executions,
      1,
    );
  },
);

test(
  'não permite dois ciclos dentro do intervalo mínimo',
  async () => {
    const {
      orchestrator,
    } = createEngine({
      minimumCycleIntervalMs:
        10_000,
      maximumCyclesPerWindow:
        100,
    });

    const goal =
      createSimpleGoal();

    const first =
      await orchestrator.tick(
        1_000,
      );

    assert.equal(
      first.decision,
      'plan_created',
    );

    assert.equal(
      first.goalId,
      goal.id,
    );

    const second =
      await orchestrator.tick(
        3_000,
      );

    assert.equal(
      second.decision,
      'idle',
    );

    assert.equal(
      orchestrator.getStatus()
        .cycleCount,
      1,
    );

    const plan =
      PlanningEngine.getPlanByGoalId(
        goal.id,
      );

    assert.ok(
      plan,
    );

    assert.equal(
      plan?.status,
      'ready',
    );
  },
);

test(
  'permite novo ciclo após o intervalo mínimo',
  async () => {
    const {
      orchestrator,
    } = createEngine({
      minimumCycleIntervalMs:
        10_000,
      maximumCyclesPerWindow:
        100,
    });

    createSimpleGoal();

    const first =
      await orchestrator.tick(
        1_000,
      );

    assert.equal(
      first.decision,
      'plan_created',
    );

    const blocked =
      await orchestrator.tick(
        5_000,
      );

    assert.equal(
      blocked.decision,
      'idle',
    );

    const allowed =
      await orchestrator.tick(
        11_000,
      );

    assert.equal(
      allowed.decision,
      'executed',
    );

    assert.equal(
      orchestrator.getStatus()
        .cycleCount,
      2,
    );
  },
);

test(
  'respeita limite de ciclos por janela',
  async () => {
    const {
      orchestrator,
    } = createEngine({
      minimumCycleIntervalMs:
        0,
      maximumCyclesPerWindow:
        1,
      cycleWindowMs:
        60 * 60 * 1000,
    });

    createSimpleGoal();

    const first =
      await orchestrator.tick(
        1_000,
      );

    assert.equal(
      first.decision,
      'plan_created',
    );

    const second =
      await orchestrator.tick(
        2_000,
      );

    assert.equal(
      second.decision,
      'idle',
    );

    assert.equal(
      orchestrator.getStatus()
        .cycleCount,
      1,
    );
  },
);

test(
  'permite novo ciclo quando a janela de frequência expira',
  async () => {
    const {
      orchestrator,
    } = createEngine({
      minimumCycleIntervalMs:
        0,
      maximumCyclesPerWindow:
        1,
      cycleWindowMs:
        10_000,
    });

    createSimpleGoal();

    const first =
      await orchestrator.tick(
        1_000,
      );

    assert.equal(
      first.decision,
      'plan_created',
    );

    const blocked =
      await orchestrator.tick(
        5_000,
      );

    assert.equal(
      blocked.decision,
      'idle',
    );

    const allowed =
      await orchestrator.tick(
        12_000,
      );

    assert.equal(
      allowed.decision,
      'executed',
    );

    assert.equal(
      orchestrator.getStatus()
        .cycleCount,
      1,
    );
  },
);

test(
  'expõe status operacional do orquestrador',
  async () => {
    const {
      orchestrator,
    } = createEngine({
      minimumCycleIntervalMs:
        0,
    });

    createSimpleGoal();

    await orchestrator.tick(
      1_000,
    );

    const status =
      orchestrator.getStatus();

    assert.equal(
      status.enabled,
      true,
    );

    assert.equal(
      status.running,
      false,
    );

    assert.equal(
      status.cycleCount,
      1,
    );

    assert.equal(
      status.activeGoalCount,
      1,
    );

    assert.equal(
      status.activePlanCount,
      1,
    );

    assert.equal(
      status.lastDecision,
      'plan_created',
    );
  },
);

test(
  'reseta o estado operacional',
  async () => {
    const {
      orchestrator,
    } = createEngine({
      minimumCycleIntervalMs:
        0,
    });

    createSimpleGoal();

    await orchestrator.tick(
      1_000,
    );

    assert.equal(
      orchestrator.getStatus()
        .cycleCount,
      1,
    );

    orchestrator.resetRuntimeState();

    const status =
      orchestrator.getStatus();

    assert.equal(
      status.cycleCount,
      0,
    );

    assert.equal(
      status.lastCycleTimestamp,
      0,
    );

    assert.equal(
      status.blockedCount,
      0,
    );

    assert.equal(
      status.failedCount,
      0,
    );

    assert.equal(
      status.lastDecision,
      'idle',
    );
  },
);

test(
  'não permite executar ferramenta sem nome após prefixo tool:',
  async () => {
    const {
      orchestrator,
    } = createEngine({
      minimumCycleIntervalMs:
        0,
    });

    /*
     * Esse comportamento é validado
     * diretamente através do plano para
     * garantir que a barreira de segurança
     * do prefixo esteja coberta.
     */

    const goal =
      createSimpleGoal();

    const plan =
      PlanningEngine.createPlanForGoal(
        goal,
      );

    plan.steps[0].actionType =
      'tool:';

    const result =
      await orchestrator.tick(
        1_000,
      );

    /*
     * O plano real armazenado pelo
     * PlanningEngine é uma referência
     * ao mesmo objeto interno, então a
     * alteração acima deve ser observada
     * pelo orchestrator.
     */
    assert.equal(
      result.decision,
      'blocked',
    );

    assert.equal(
      result.planId,
      plan.id,
    );
  },
);