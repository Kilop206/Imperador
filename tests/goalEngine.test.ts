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
  SemanticCandidateService,
} from '../src/intelligence/semanticCandidateService';

import {
  EmotionEngine,
} from '../src/intelligence/emotionEngine';

import {
  ReplyService,
} from '../src/services/reply';

const temporaryDirectories: string[] = [];

function createTemporaryFile(filename: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'imperador-goals-'));
  temporaryDirectories.push(dir);
  return path.join(dir, filename);
}

beforeEach(() => {
  const goalsFile = createTemporaryFile('goals.json');
  GoalEngine.reset();
  GoalEngine.initialize(goalsFile);

  const candidatesFile = createTemporaryFile('candidates.json');
  SemanticCandidateService.reset();
  SemanticCandidateService.initialize(candidatesFile);

  EmotionEngine.reset();
});

afterEach(() => {
  GoalEngine.reset();
  SemanticCandidateService.reset();
  EmotionEngine.reset();

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
  'GoalEngine cria e recupera objetivos com prioridade e critérios',
  () => {
    const goal = GoalEngine.createGoal({
      type: 'learn_topic',
      title: 'Dominar Táticas das Legiões Germânicas',
      description: 'Adquirir dados profundos sobre a geografia do Reno.',
      priority: 'high',
      targetMetric: 'mencoes_topico',
      targetValue: 10,
      criteria: ['Acumular 10 menções ao Reno', 'Registrar termos estratégicos'],
    });

    assert.ok(goal.id);
    assert.equal(goal.status, 'active');
    assert.equal(goal.priority, 'high');
    assert.equal(goal.progress, 0);

    const retrieved = GoalEngine.getGoal(goal.id);
    assert.ok(retrieved);
    assert.equal(retrieved.title, goal.title);
  },
);

test(
  'atualiza progresso e conclui automaticamente quando atinge a meta',
  () => {
    const goal = GoalEngine.createGoal({
      type: 'improve_semantic_model',
      title: 'Rotular Feedbacks',
      description: 'Rotular feedbacks para fine-tuning.',
      priority: 'medium',
      targetMetric: 'feedbacks_rotulados',
      targetValue: 5,
      criteria: ['Atingir 5 feedbacks'],
    });

    // Atualização parcial
    const updatedPartial = GoalEngine.updateProgress(goal.id, 2);
    assert.ok(updatedPartial);
    assert.equal(updatedPartial.status, 'active');
    assert.equal(updatedPartial.currentValue, 2);
    assert.equal(updatedPartial.progress, 40);

    // Conclusão
    const completed = GoalEngine.updateProgress(goal.id, 5);
    assert.ok(completed);
    assert.equal(completed.status, 'completed');
    assert.equal(completed.progress, 100);
    assert.ok(completed.completedAt);
  },
);

test(
  'cancela objetivo registrando o motivo',
  () => {
    const goal = GoalEngine.createGoal({
      type: 'investigate_user',
      title: 'Investigar Usuário Infiltrado',
      description: 'Analisar mensagens hostis.',
      priority: 'low',
      targetMetric: 'mensagens_analisadas',
      targetValue: 20,
      criteria: ['Classificar intenções'],
    });

    const cancelled = GoalEngine.cancelGoal(goal.id, 'Usuário foi banido do servidor');
    assert.equal(cancelled, true);

    const check = GoalEngine.getGoal(goal.id);
    assert.equal(check?.status, 'cancelled');
    assert.equal(check?.metadata?.cancellationReason, 'Usuário foi banido do servidor');
  },
);

test(
  'ordena objetivos ativos por prioridade decrescente',
  () => {
    GoalEngine.createGoal({
      type: 'explore_new_topics',
      title: 'Tópicos triviais',
      description: 'Explorar.',
      priority: 'low',
      targetMetric: 'x',
      targetValue: 1,
      criteria: ['ok'],
    });

    GoalEngine.createGoal({
      type: 'protect_emotional_stability',
      title: 'Estabilidade Crítica',
      description: 'Evitar crise.',
      priority: 'critical',
      targetMetric: 'x',
      targetValue: 1,
      criteria: ['ok'],
    });

    GoalEngine.createGoal({
      type: 'improve_semantic_model',
      title: 'Modelo Semântico',
      description: 'Otimizar.',
      priority: 'high',
      targetMetric: 'x',
      targetValue: 1,
      criteria: ['ok'],
    });

    const active = GoalEngine.getActiveGoals();
    assert.equal(active.length, 3);
    assert.equal(active[0].priority, 'critical');
    assert.equal(active[1].priority, 'high');
    assert.equal(active[2].priority, 'low');
  },
);

test(
  'evaluateEnvironmentalTriggers dispara objetivos autônomos por necessidades do ambiente',
  () => {
    // 1. Simula acúmulo de candidatos no SemanticCandidateService
    for (let i = 0; i < 6; i++) {
      SemanticCandidateService.collect(`p${i}`, `r${i}`, 0.5, 'uncertain');
    }

    const created = GoalEngine.evaluateEnvironmentalTriggers();
    assert.ok(created.length >= 1);
    assert.ok(created.some(g => g.type === 'improve_semantic_model'));

    // Chamar de novo não deve duplicar o objetivo ativo
    const createdSecond = GoalEngine.evaluateEnvironmentalTriggers();
    assert.equal(createdSecond.length, 0);
  },
);

test(
  'tick do GoalEngine atualiza o progresso em tempo real',
  () => {
    // Cria objetivo de melhoria do modelo semântico para 5 candidatos
    for (let i = 0; i < 5; i++) {
      SemanticCandidateService.collect(`msg_${i}`, `resp_${i}`, 0.5, 'uncertain');
    }

    const goal = GoalEngine.createGoal({
      type: 'improve_semantic_model',
      title: 'Revisar Candidatos',
      description: 'Processar candidatos',
      priority: 'high',
      targetMetric: 'candidatos_revisados',
      targetValue: 5,
      criteria: ['Zerar fila'],
    });

    // Remove 2 candidatos (simula revisão humana)
    const list = SemanticCandidateService.getPending(2);
    for (const c of list) {
      SemanticCandidateService.markReviewed(c.id);
    }

    const { updatedCount } = GoalEngine.tick();
    assert.ok(updatedCount >= 1);

    const updatedGoal = GoalEngine.getGoal(goal.id);
    assert.equal(updatedGoal?.currentValue, 2);
    assert.equal(updatedGoal?.progress, 40);
  },
);

test(
  'comando !tiberio_objetivos no ReplyService relata objetivos ativos',
  () => {
    GoalEngine.createGoal({
      type: 'learn_topic',
      title: 'Serenidade do Império',
      description: 'Manter equilíbrio e estudo das províncias.',
      priority: 'critical',
      targetMetric: 'mencoes',
      targetValue: 100,
      initialValue: 20,
      criteria: ['Estudo aprofundado'],
    });

    const reply = ReplyService.getReply({
      content: '!tiberio_objetivos',
      author: { bot: false, id: 'tribuno_1', username: 'Tribuno' },
      channelId: 'allowed_channel',
    } as any);

    assert.ok(reply);
    assert.ok(reply.includes('Objetivos Autônomos'));
    assert.ok(reply.includes('CRITICAL'));
    assert.ok(reply.includes('Serenidade do Império'));
  },
);
