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
    'test-autonomous-agent-tool-execution-goals.json',
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

function createEnvironment() {
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
        enabled:
          true,
        minimumCycleIntervalMs:
          0,
        maximumCyclesPerWindow:
          100,
        cycleWindowMs:
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

function createGoal() {
  return GoalEngine.createGoal({
    type:
      'learn_topic',
    title:
      'Teste de execução autônoma de ferramenta',
    description:
      'Verifica se uma ferramenta concluída não é executada novamente.',
    priority:
      'medium',
    targetMetric:
      'progress',
    targetValue:
      100,
    initialValue:
      0,
    criteria: [
      'Executar uma ferramenta autônoma uma única vez.',
    ],
  });
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
  'marca uma etapa tool:* como concluída após execução bem-sucedida',
  async () => {
    const {
      registry,
      orchestrator,
    } = createEnvironment();

    registry.register({
      name:
        'safe_tool',
      description:
        'Ferramenta segura para teste.',
      riskLevel:
        'low',
      parameters: [],
      execute: () => ({
        ok:
          true,
      }),
    });

    const goal =
      createGoal();

    const created =
      await orchestrator.tick(
        1_000,
      );

    assert.equal(
      created.decision,
      'plan_created',
    );

    assert.equal(
      created.goalId,
      goal.id,
    );

    assert.ok(
      created.planId,
    );

    const plan =
      PlanningEngine.getPlan(
        created.planId!,
      );

    assert.ok(
      plan,
    );

    assert.ok(
      plan!.steps.length >
        0,
    );

    plan!.steps[0].actionType =
      'tool:safe_tool';

    const executed =
      await orchestrator.tick(
        2_000,
      );

    assert.equal(
      executed.decision,
      'executed',
    );

    assert.equal(
      executed.goalId,
      goal.id,
    );

    assert.equal(
      executed.planId,
      created.planId,
    );

    assert.equal(
      executed.stepId,
      plan!.steps[0].id,
    );

    const updatedPlan =
      PlanningEngine.getPlan(
        created.planId!,
      );

    assert.ok(
      updatedPlan,
    );

    const updatedStep =
      updatedPlan!.steps.find(
        step =>
          step.id ===
          plan!.steps[0].id,
      );

    assert.ok(
      updatedStep,
    );

    assert.equal(
      updatedStep!.status,
      'completed',
    );

    assert.equal(
      updatedStep!.error,
      undefined,
    );
  },
);

test(
  'não executa novamente uma ferramenta já concluída',
  async () => {
    const {
      registry,
      orchestrator,
    } = createEnvironment();

    let executions = 0;

    registry.register({
      name:
        'once_only_tool',
      description:
        'Ferramenta que deve executar somente uma vez.',
      riskLevel:
        'low',
      parameters: [],
      execute: () => {
        executions +=
          1;

        return {
          executionNumber:
            executions,
        };
      },
    });

    const goal =
      createGoal();

    const created =
      await orchestrator.tick(
        1_000,
      );

    assert.equal(
      created.decision,
      'plan_created',
    );

    const plan =
      PlanningEngine.getPlan(
        created.planId!,
      );

    assert.ok(
      plan,
    );

    assert.ok(
      plan!.steps.length >
        0,
    );

    const toolStep =
      plan!.steps[0];

    toolStep.actionType =
      'tool:once_only_tool';

    const firstExecution =
      await orchestrator.tick(
        2_000,
      );

    assert.equal(
      firstExecution.decision,
      'executed',
    );

    assert.equal(
      executions,
      1,
    );

    const afterFirst =
      PlanningEngine.getPlan(
        created.planId!,
      );

    assert.ok(
      afterFirst,
    );

    const completedStep =
      afterFirst!.steps.find(
        step =>
          step.id ===
          toolStep.id,
      );

    assert.ok(
      completedStep,
    );

    assert.equal(
      completedStep!.status,
      'completed',
    );

    const secondExecution =
      await orchestrator.tick(
        3_000,
      );

    assert.notEqual(
      secondExecution.stepId,
      toolStep.id,
    );

    assert.equal(
      executions,
      1,
    );
  },
);

test(
  'mantém a observação da execução da ferramenta',
  async () => {
    const {
      registry,
      orchestrator,
      observations,
    } = createEnvironment();

    registry.register({
      name:
        'observable_tool',
      description:
        'Ferramenta para testar observabilidade.',
      riskLevel:
        'low',
      parameters: [],
      execute: () => ({
        observed:
          true,
      }),
    });

    const goal =
      createGoal();

    const created =
      await orchestrator.tick(
        1_000,
      );

    assert.equal(
      created.decision,
      'plan_created',
    );

    const plan =
      PlanningEngine.getPlan(
        created.planId!,
      );

    assert.ok(
      plan,
    );

    plan!.steps[0].actionType =
      'tool:observable_tool';

    const result =
      await orchestrator.tick(
        2_000,
      );

    assert.equal(
      result.decision,
      'executed',
    );

    assert.ok(
      result.observationId,
    );

    const observation =
      observations.get(
        result.observationId!,
      );

    assert.ok(
      observation,
    );

    assert.equal(
      observation!.type,
      'execution',
    );

    assert.equal(
      observation!.source,
      'tool',
    );

    assert.equal(
      observation!.success,
      true,
    );

    assert.equal(
      observation!.executionId !==
        undefined,
      true,
    );

    assert.equal(
      executionsHasExpectedMetadata(
        observation!.data,
        goal.id,
        created.planId!,
        plan!.steps[0].id,
      ),
      true,
    );
  },
);

function executionsHasExpectedMetadata(
  data: unknown,
  goalId: string,
  planId: string,
  stepId: string,
): boolean {
  if (
    !data ||
    typeof data !==
      'object'
  ) {
    return false;
  }

  const record =
    data as Record<
      string,
      unknown
    >;

  return (
    record.goalId ===
      goalId &&
    record.planId ===
      planId &&
    record.stepId ===
      stepId
  );
}