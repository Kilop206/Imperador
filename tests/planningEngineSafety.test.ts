import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PlanningEngine,
} from '../src/intelligence/planningEngine';

import type {
  AutonomousGoal,
} from '../src/intelligence/goalEngine';

function createGoal():
  AutonomousGoal {
  const timestamp =
    Date.now();

  return {
    id:
      `test_goal_${timestamp}`,
    type:
      'learn_topic',
    title:
      'Teste de segurança',
    description:
      'Objetivo utilizado para validar o PlanningEngine.',
    priority:
      'medium',
    status:
      'active',
    progress:
      0,
    targetMetric:
      'progress',
    currentValue:
      0,
    targetValue:
      100,
    criteria: [
      'Executar teste',
    ],
    createdAt:
      timestamp,
    updatedAt:
      timestamp,
  };
}

test.afterEach(() => {
  PlanningEngine.reset();
});

test(
  'falha explicitamente quando actionType não possui executor',
  async () => {
    const goal =
      createGoal();

    const plan =
      PlanningEngine.createPlanForGoal(
        goal,
      );

    plan.steps[0].actionType =
      'acao_inexistente';

    const result =
      await PlanningEngine.executeStep(
        plan.id,
        plan.steps[0].id,
      );

    assert.equal(
      result,
      false,
    );

    const stored =
      PlanningEngine.getPlan(
        plan.id,
      );

    assert.equal(
      stored?.status,
      'failed',
    );

    assert.equal(
      stored?.steps[0].status,
      'failed',
    );

    assert.match(
      stored?.steps[0].error ?? '',
      /Nenhum executor registrado/,
    );
  },
);

test(
  'permite actionType conhecido explicitamente',
  async () => {
    const goal =
      createGoal();

    const plan =
      PlanningEngine.createPlanForGoal(
        goal,
      );

    assert.equal(
      PlanningEngine.hasExecutor(
        'evaluate_system_health',
      ),
      true,
    );

    const result =
      await PlanningEngine.executeStep(
        plan.id,
        plan.steps[0].id,
      );

    assert.equal(
      result,
      true,
    );

    const stored =
      PlanningEngine.getPlan(
        plan.id,
      );

    assert.equal(
      stored?.steps[0].status,
      'completed',
    );
  },
);

test(
  'permite registrar executor customizado',
  async () => {
    const goal =
      createGoal();

    const plan =
      PlanningEngine.createPlanForGoal(
        goal,
      );

    let executed =
      false;

    PlanningEngine.registerExecutor(
      'custom_test_action',
      () => {
        executed = true;

        return {
          custom:
            true,
        };
      },
    );

    plan.steps[0].actionType =
      'custom_test_action';

    const result =
      await PlanningEngine.executeStep(
        plan.id,
        plan.steps[0].id,
      );

    assert.equal(
      result,
      true,
    );

    assert.equal(
      executed,
      true,
    );
  },
);

test(
  'não cria executor para actionType vazio',
  () => {
    assert.throws(
      () =>
        PlanningEngine.registerExecutor(
          '   ',
          () => ({
            ok:
              true,
          }),
        ),
      /actionType não pode ser vazio/,
    );
  },
);

test(
  'permite noop apenas quando explicitamente solicitado',
  async () => {
    const goal =
      createGoal();

    const plan =
      PlanningEngine.createPlanForGoal(
        goal,
      );

    plan.steps[0].actionType =
      'noop';

    const result =
      await PlanningEngine.executeStep(
        plan.id,
        plan.steps[0].id,
      );

    assert.equal(
      result,
      true,
    );

    const stored =
      PlanningEngine.getPlan(
        plan.id,
      );

    assert.equal(
      stored?.steps[0].status,
      'completed',
    );
  },
);

test(
  'rejeita rollback desconhecido em vez de usar noop',
  () => {
    const goal =
      createGoal();

    const plan =
      PlanningEngine.createPlanForGoal(
        goal,
      );

    plan.steps[0].rollbackAction =
      'rollback_inexistente';

    const result =
      PlanningEngine.rollback(
        plan.id,
      );

    assert.equal(
      result,
      false,
    );

    const stored =
      PlanningEngine.getPlan(
        plan.id,
      );

    /*
     * O rollback foi rejeitado antes de qualquer
     * reversão ser executada. Portanto, o estado
     * do plano permanece inalterado.
     */
    assert.equal(
      stored?.status,
      'ready',
    );

    assert.ok(
      stored?.executionLog.some(
        log =>
          log.includes(
            'Rollback rejeitado',
          ) &&
          log.includes(
            'rollback_inexistente',
          ),
      ),
    );
  },
);