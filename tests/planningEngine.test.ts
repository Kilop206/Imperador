import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  afterEach,
  beforeEach,
  test,
} from 'node:test';

import {
  GoalEngine,
} from '../src/intelligence/goalEngine';

import {
  PlanningEngine,
} from '../src/intelligence/planningEngine';

const temporaryDirectories: string[] = [];

function createTemporaryFile(filename: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'imperador-planning-'));
  temporaryDirectories.push(dir);
  return path.join(dir, filename);
}

beforeEach(() => {
  const goalsFile = createTemporaryFile('goals.json');
  GoalEngine.reset();
  GoalEngine.initialize(goalsFile);
  PlanningEngine.reset();
});

afterEach(() => {
  GoalEngine.reset();
  PlanningEngine.reset();

  while (temporaryDirectories.length > 0) {
    const dir = temporaryDirectories.pop();
    if (dir && fs.existsSync(dir)) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // Ignora erros temporários no Windows
      }
    }
  }
});

test(
  'decompondo meta em etapas acionáveis com dependências',
  () => {
    const goal = GoalEngine.createGoal({
      type: 'improve_semantic_model',
      title: 'Otimizar Embeddings',
      description: 'Treinar com exemplos de feedback.',
      priority: 'high',
      targetMetric: 'metric',
      targetValue: 10,
      criteria: ['Sucesso'],
    });

    const plan = PlanningEngine.createPlanForGoal(goal);

    assert.ok(plan.id);
    assert.equal(plan.goalId, goal.id);
    assert.equal(plan.status, 'ready');
    assert.ok(plan.steps.length >= 2);

    const step1 = plan.steps[0];
    const step2 = plan.steps[1];

    // Passo 1 não tem dependências e está apto
    assert.equal(step1.dependencies.length, 0);
    assert.equal(PlanningEngine.canExecuteStep(plan, step1), true);

    // Passo 2 depende do passo 1 e NÃO está apto ainda
    assert.ok(step2.dependencies.includes(step1.id));
    assert.equal(PlanningEngine.canExecuteStep(plan, step2), false);

    // Próximo executável deve ser o passo 1
    const next = PlanningEngine.getNextExecutableStep(plan);
    assert.equal(next?.id, step1.id);
  },
);

test(
  'execução sequencial de passos respeitando dependências',
  async () => {
    const goal = GoalEngine.createGoal({
      type: 'protect_emotional_stability',
      title: 'Descompressão Emocional',
      description: 'Restaurar equilíbrio.',
      priority: 'critical',
      targetMetric: 'irritation',
      targetValue: 40,
      criteria: ['Calma'],
    });

    const plan = PlanningEngine.createPlanForGoal(goal);

    // Executa primeiro passo
    const r1 = await PlanningEngine.executeNext(plan.id);
    assert.equal(r1, true);

    const updatedPlan1 = PlanningEngine.getPlan(plan.id);
    assert.equal(updatedPlan1?.steps[0].status, 'completed');

    // Agora o segundo passo é elegível
    assert.equal(
      PlanningEngine.canExecuteStep(updatedPlan1!, updatedPlan1!.steps[1]),
      true,
    );

    // Executa segundo passo
    const r2 = await PlanningEngine.executeNext(plan.id);
    assert.equal(r2, true);

    const finalPlan = PlanningEngine.getPlan(plan.id);
    assert.equal(finalPlan?.status, 'completed');
    assert.ok(finalPlan?.completedAt);
  },
);

test(
  'aciona plano alternativo/fallback quando um passo falha',
  async () => {
    const goal = GoalEngine.createGoal({
      type: 'improve_semantic_model',
      title: 'Treino com Fallback',
      description: 'Se falhar, acionar fallback.',
      priority: 'medium',
      targetMetric: 'x',
      targetValue: 1,
      criteria: ['ok'],
    });

    const plan = PlanningEngine.createPlanForGoal(goal);
    const stepWithFallback = plan.steps[0];
    assert.ok(stepWithFallback.fallbackStep);

    // Forçamos o executor principal a falhar
    const failingExecutor = async () => {
      throw new Error('Falha intencional de infraestrutura');
    };

    const success = await PlanningEngine.executeStep(
      plan.id,
      stepWithFallback.id,
      failingExecutor,
    );

    // Sucesso retornado porque o fallback foi acionado com sucesso
    assert.equal(success, true);

    const updatedPlan = PlanningEngine.getPlan(plan.id);
    assert.equal(updatedPlan?.steps[0].status, 'skipped');
    assert.equal(updatedPlan?.steps[0].fallbackStep?.status, 'completed');
  },
);

test(
  'replanejamento dinâmico diante de falha crítica sem fallback',
  async () => {
    const goal = GoalEngine.createGoal({
      type: 'reduce_repetition',
      title: 'Redução de Repetição',
      description: 'Replanejar se houver falha.',
      priority: 'medium',
      targetMetric: 'novelty',
      targetValue: 80,
      criteria: ['ok'],
    });

    const plan = PlanningEngine.createPlanForGoal(goal);

    // Executa o primeiro passo com sucesso
    await PlanningEngine.executeStep(plan.id, plan.steps[0].id, async () => 'ok');

    // Suponhamos que as condições ambientais mudaram bruscamente
    const replanned = PlanningEngine.replan(
      plan.id,
      'Canal do Discord atingiu tráfego de spam excessivo',
    );

    assert.ok(replanned);
    assert.equal(replanned.replanCount, 1);
    assert.equal(replanned.status, 'ready');

    // Primeiro passo original continua completado
    assert.equal(replanned.steps[0].status, 'completed');
    // Novos passos adaptativos foram injetados
    assert.ok(replanned.steps.length >= 3);
    assert.equal(
      replanned.steps[1].name,
      'Avaliar e Estabilizar Estado Após Falha',
    );
  },
);

test(
  'executa rollback compensatório para passos que possuem rollbackAction',
  async () => {
    let rollbackExecuted = false;

    PlanningEngine.registerExecutor('mock_rollback_action', () => {
      rollbackExecuted = true;
      return { rolledBack: true };
    });

    const goal = GoalEngine.createGoal({
      type: 'learn_topic',
      title: 'Tópico com Rollback',
      description: 'Testar reversão.',
      priority: 'low',
      targetMetric: 'm',
      targetValue: 1,
      criteria: ['c'],
    });

    const plan = PlanningEngine.createPlanForGoal(goal);
    plan.steps[0].rollbackAction = 'mock_rollback_action';

    // Completa o passo
    await PlanningEngine.executeStep(plan.id, plan.steps[0].id, async () => ({
      data: 123,
    }));

    // Executa rollback
    const rolledBack = PlanningEngine.rollback(plan.id);
    assert.equal(rolledBack, true);
    assert.equal(rollbackExecuted, true);

    const updated = PlanningEngine.getPlan(plan.id);
    assert.equal(updated?.status, 'rolled_back');
  },
);
