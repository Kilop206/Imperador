import { strict as assert } from 'node:assert';
import {
  afterEach,
  beforeEach,
  test,
} from 'node:test';

import {
  ContextAnalyzer,
} from '../src/services/contextAnalyzer';

import {
  MemoryService,
} from '../src/services/memoryService';

beforeEach(() => {
  MemoryService.close();
  MemoryService.initialize(
    ':memory:'
  );
});

afterEach(() => {
  MemoryService.close();
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
      ContextAnalyzer.getWordFrequency(
        'tártaro'
      ),
      2
    );
  }
);

test(
  'usa resposta da frequência correta',
  () => {
    for (let i = 0; i < 5; i++) {
      ContextAnalyzer.trackWordFrequency(
        'tártaro'
      );
    }

    const response =
      ContextAnalyzer.getFrequencyBasedResponse(
        'tártaro'
      );

    assert.ok(response);
  }
);