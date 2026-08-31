import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { TextAnalyzer } from '../src/services/textAnalyzer';

test('normaliza acentos e caixa', () => {
  assert.equal(
    TextAnalyzer.normalize(
      'ÁGUA, Império!'
    ),
    'agua imperio'
  );
});

test('tokeniza mensagem', () => {
  assert.deepEqual(
    TextAnalyzer.tokenize(
      'Roma é eterna'
    ),
    ['roma', 'e', 'eterna']
  );
});

test('detecta agressividade', () => {
  assert.equal(
    TextAnalyzer.isAggressive(
      'Você é um idiota'
    ),
    true
  );
});

test('detecta elogio', () => {
  assert.equal(
    TextAnalyzer.isCompliment(
      'Tibério é incrível'
    ),
    true
  );
});

test('detecta pergunta', () => {
  assert.equal(
    TextAnalyzer.isQuestion(
      'Por que Roma caiu?'
    ),
    true
  );
});

test('detecta sarcasmo', () => {
  assert.equal(
    TextAnalyzer.hasSarcasm(
      'Que incrível, sarcasmo'
    ),
    true
  );
});

test('detecta intenção filosófica', () => {
  assert.equal(
    TextAnalyzer.detectIntent(
      'Qual é o sentido da vida?'
    ),
    'philosophical'
  );
});

test('agressividade possui prioridade sobre elogio', () => {
  assert.equal(
    TextAnalyzer.detectIntent(
      'Você é um idiota, mas é incrível'
    ),
    'aggressive'
  );
});

test('detecta saudação', () => {
  assert.equal(
    TextAnalyzer.detectIntent(
      'Olá Tibério'
    ),
    'greeting'
  );
});