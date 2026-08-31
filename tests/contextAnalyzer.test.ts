import { strict as assert } from 'node:assert';
import {
  beforeEach,
  test,
} from 'node:test';

import {
  ContextAnalyzer,
} from '../src/services/contextAnalyzer';

import {
  runtimeState,
} from '../src/state/runtimeState';

beforeEach(() => {
  runtimeState.wordFrequency.clear();
  runtimeState.aggressiveMessageCount = 0;
});

test(
  'detecta mensagem agressiva',
  () => {
    assert.equal(
      ContextAnalyzer.isAggressive(
        'Você é um idiota'
      ),
      true
    );
  }
);

test(
  'não classifica mensagem normal como agressiva',
  () => {
    assert.equal(
      ContextAnalyzer.isAggressive(
        'Roma continua crescendo'
      ),
      false
    );
  }
);

test(
  'detecta elogio',
  () => {
    assert.equal(
      ContextAnalyzer.isCompliment(
        'Tibério é incrível'
      ),
      true
    );
  }
);

test(
  'não classifica sarcasmo explícito como elogio',
  () => {
    assert.equal(
      ContextAnalyzer.isCompliment(
        'Que incrível, sarcasmo'
      ),
      false
    );
  }
);

test(
  'rastreia frequência de palavra',
  () => {
    ContextAnalyzer.trackWordFrequency(
      'tártaro'
    );

    ContextAnalyzer.trackWordFrequency(
      'tártaro'
    );

    assert.equal(
      runtimeState.wordFrequency.get(
        'tartaro'
      ),
      2
    );
  }
);

test(
  'usa resposta da frequência correta',
  () => {
    runtimeState.wordFrequency.set(
      'tartaro',
      5
    );

    const response =
      ContextAnalyzer.getFrequencyBasedResponse(
        'tártaro'
      );

    assert.ok(response);
  }
);