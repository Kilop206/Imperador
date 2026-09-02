import assert from 'node:assert/strict';
import {
  afterEach,
  beforeEach,
  test,
} from 'node:test';

import {
  SelfEvaluationEngine,
} from '../src/intelligence/selfEvaluationEngine';

import {
  ReplyService,
} from '../src/services/reply';

beforeEach(() => {
  SelfEvaluationEngine.reset();
});

afterEach(() => {
  SelfEvaluationEngine.reset();
});

test(
  'SelfEvaluationEngine avalia resposta imperial válida com alto score',
  () => {
    const userMessage = 'O que você acha das conspirações contra o império?';
    const responseText = 'A traição será punida com a severidade que Roma exige.';

    const result = SelfEvaluationEngine.evaluate(userMessage, responseText);

    assert.ok(result);
    assert.equal(result.userMessage, userMessage);
    assert.equal(result.responseText, responseText);

    // Métricas
    assert.ok(result.metrics.relevance > 0.3);
    assert.equal(result.metrics.personalityConsistency, 1);
    assert.equal(result.metrics.isFailure, false);
    assert.ok(result.metrics.novelty > 0.8);
    assert.ok(result.metrics.overallQuality > 0.6);
  },
);

test(
  'SelfEvaluationEngine zera qualidade e detecta falha em violações de persona',
  () => {
    const userMessage = 'Você errou no que disse antes.';
    const responseWithViolation = 'Me desculpe, como posso ajudar você?';

    const result = SelfEvaluationEngine.evaluate(
      userMessage,
      responseWithViolation,
    );

    assert.equal(result.metrics.personalityConsistency, 0);
    assert.equal(result.metrics.isFailure, true);
    assert.equal(result.metrics.overallQuality, 0);
    assert.ok(
      result.diagnostics.some(d => d.includes('Violação de personalidade')),
    );
  },
);

test(
  'SelfEvaluationEngine detecta resposta vazia como falha total',
  () => {
    const result = SelfEvaluationEngine.evaluate('Olá', '');

    assert.equal(result.metrics.isFailure, true);
    assert.equal(result.metrics.overallQuality, 0);
    assert.ok(result.diagnostics.some(d => d.includes('vazia')));
  },
);

test(
  'SelfEvaluationEngine penaliza repetição com métrica de novelty',
  () => {
    const text = 'O Senado sempre curve-se perante a autoridade do Imperador.';

    // Primeira emissão: novidade máxima
    const first = SelfEvaluationEngine.evaluate('pergunta 1', text);
    assert.equal(first.metrics.novelty, 1.0);

    // Segunda emissão idêntica: novidade zerada
    const second = SelfEvaluationEngine.evaluate('pergunta 2', text);
    assert.equal(second.metrics.novelty, 0.0);
    assert.ok(
      second.diagnostics.some(d => d.includes('repetição recente')),
    );
  },
);

test(
  'SelfEvaluationEngine calcula métricas agregadas e estabilidade',
  () => {
    // Inicialmente sem histórico
    const initialMetrics = SelfEvaluationEngine.getAggregateMetrics();
    assert.equal(initialMetrics.totalEvaluations, 0);
    assert.equal(initialMetrics.failureRate, 0);

    // Adiciona uma resposta válida
    SelfEvaluationEngine.evaluate(
      'Pergunta A',
      'As legiões marcham sob a bandeira de Tibério.',
    );

    // Adiciona uma resposta com falha
    SelfEvaluationEngine.evaluate('Pergunta B', 'Por favor me desculpe.');

    // Adiciona outra válida
    SelfEvaluationEngine.evaluate(
      'Pergunta C',
      'Roma não tolera insolência.',
    );

    const agg = SelfEvaluationEngine.getAggregateMetrics();

    assert.equal(agg.totalEvaluations, 3);
    assert.ok(agg.averageQuality > 0);
    assert.ok(agg.failureRate > 0 && agg.failureRate < 0.5);
    assert.ok(agg.stabilityScore >= 0 && agg.stabilityScore <= 1);

    const last = SelfEvaluationEngine.getLastEvaluation();
    assert.ok(last);
    assert.equal(last.userMessage, 'Pergunta C');
  },
);

test(
  'Comando !tiberio_qualidade no ReplyService expõe o relatório de qualidade',
  () => {
    SelfEvaluationEngine.evaluate(
      'Saudações imperador',
      'Curvem-se perante a glória de Roma.',
    );

    const reply = ReplyService.getReply({
      content: '!tiberio_qualidade',
      author: { bot: false, id: 'user_1', username: 'Consul' },
      channelId: 'allowed_channel',
    } as any);

    assert.ok(reply);
    assert.ok(reply.includes('Relatório de Autoavaliação Contínua'));
    assert.ok(reply.includes('Qualidade percebida'));
    assert.ok(reply.includes('Consistência de personalidade'));
  },
);
