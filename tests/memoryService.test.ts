import { strict as assert } from 'node:assert';
import {
  afterEach,
  beforeEach,
  test,
} from 'node:test';

import { MemoryService } from '../src/services/memoryService';

beforeEach(() => {
  MemoryService.initialize();
  MemoryService.clear();
});

afterEach(() => {
  MemoryService.close();
});

test(
  'cria memória de uma palavra',
  () => {
    const count =
      MemoryService.incrementWord(
        'tártaro'
      );

    assert.equal(
      count,
      1
    );

    assert.equal(
      MemoryService.getWordCount(
        'tártaro'
      ),
      1
    );
  }
);

test(
  'incrementa frequência persistente',
  () => {
    MemoryService.incrementWord(
      'tártaro'
    );

    MemoryService.incrementWord(
      'tártaro'
    );

    MemoryService.incrementWord(
      'tártaro'
    );

    assert.equal(
      MemoryService.getWordCount(
        'tártaro'
      ),
      3
    );
  }
);

test(
  'normaliza palavras na memória',
  () => {
    MemoryService.incrementWord(
      'TÁRTARO'
    );

    assert.equal(
      MemoryService.getWordCount(
        'tártaro'
      ),
      1
    );
  }
);

test(
  'retorna memória detalhada',
  () => {
    MemoryService.incrementWord(
      'roma'
    );

    const memory =
      MemoryService.getWordMemory(
        'roma'
      );

    assert.ok(memory);
    assert.equal(
      memory?.word,
      'roma'
    );
    assert.equal(
      memory?.count,
      1
    );
    assert.ok(
      memory?.lastSeen
    );
  }
);

test(
  'retorna palavras mais mencionadas',
  () => {
    MemoryService.incrementWord(
      'roma'
    );

    MemoryService.incrementWord(
      'roma'
    );

    MemoryService.incrementWord(
      'roma'
    );

    MemoryService.incrementWord(
      'império'
    );

    const words =
      MemoryService.getMostMentionedWords(
        2
      );

    assert.equal(
      words.length,
      2
    );

    assert.equal(
      words[0].word,
      'roma'
    );
  }
);