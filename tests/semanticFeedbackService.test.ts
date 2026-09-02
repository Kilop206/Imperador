import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  afterEach,
  test,
} from 'node:test';

import {
  SemanticFeedbackService,
} from '../src/intelligence/semanticFeedbackService';

const temporaryDirectories:
  string[] = [];

function createTemporaryFile(): string {
  const directory =
    fs.mkdtempSync(
      path.join(
        os.tmpdir(),
        'imperador-semantic-feedback-'
      )
    );

  temporaryDirectories.push(
    directory
  );

  return path.join(
    directory,
    'feedback.json'
  );
}

function initializeService(): string {
  SemanticFeedbackService.reset();

  const filePath =
    createTemporaryFile();

  SemanticFeedbackService.initialize(
    filePath
  );

  return filePath;
}

afterEach(() => {
  SemanticFeedbackService.reset();

  while (
    temporaryDirectories.length > 0
  ) {
    const directory =
      temporaryDirectories.pop();

    if (
      directory &&
      fs.existsSync(directory)
    ) {
      fs.rmSync(
        directory,
        {
          recursive: true,
          force: true,
        }
      );
    }
  }
});

test(
  'deve começar sem feedback',
  () => {
    initializeService();

    assert.equal(
      SemanticFeedbackService.getCount(),
      0
    );

    assert.deepEqual(
      SemanticFeedbackService.getAll(),
      []
    );
  }
);

test(
  'deve adicionar feedback positivo',
  () => {
    initializeService();

    const feedback =
      SemanticFeedbackService.add(
        'quero aprender Python',
        'tenho interesse em estudar Python',
        1
      );

    assert.ok(feedback);

    assert.equal(
      feedback.label,
      1
    );

    assert.equal(
      feedback.source,
      'human'
    );

    assert.equal(
      SemanticFeedbackService.getCount(),
      1
    );

    assert.equal(
      SemanticFeedbackService.getPositiveCount(),
      1
    );

    assert.equal(
      SemanticFeedbackService.getNegativeCount(),
      0
    );
  }
);

test(
  'deve adicionar feedback negativo',
  () => {
    initializeService();

    const feedback =
      SemanticFeedbackService.add(
        'como configurar Docker?',
        'como configurar Kubernetes?',
        0
      );

    assert.ok(feedback);

    assert.equal(
      feedback.label,
      0
    );

    assert.equal(
      SemanticFeedbackService.getNegativeCount(),
      1
    );
  }
);

test(
  'deve preservar o source informado',
  () => {
    initializeService();

    const feedback =
      SemanticFeedbackService.add(
        'frase A',
        'frase B',
        0,
        'hard-negative'
      );

    assert.ok(feedback);

    assert.equal(
      feedback.source,
      'hard-negative'
    );

    assert.equal(
      SemanticFeedbackService.getSourceCount(
        'hard-negative'
      ),
      1
    );
  }
);

test(
  'deve rejeitar frases vazias',
  () => {
    initializeService();

    assert.equal(
      SemanticFeedbackService.add(
        '',
        'frase válida',
        1
      ),
      null
    );

    assert.equal(
      SemanticFeedbackService.add(
        'frase válida',
        '   ',
        0
      ),
      null
    );

    assert.equal(
      SemanticFeedbackService.getCount(),
      0
    );
  }
);

test(
  'não deve aceitar uma frase comparada com ela mesma',
  () => {
    initializeService();

    assert.equal(
      SemanticFeedbackService.add(
        'frase repetida',
        'frase repetida',
        1
      ),
      null
    );

    assert.equal(
      SemanticFeedbackService.getCount(),
      0
    );
  }
);

test(
  'não deve duplicar o mesmo par na mesma direção semântica',
  () => {
    initializeService();

    const first =
      SemanticFeedbackService.add(
        'quero aprender Python',
        'tenho interesse em estudar Python',
        1
      );

    const second =
      SemanticFeedbackService.add(
        'quero aprender Python',
        'tenho interesse em estudar Python',
        1
      );

    assert.ok(first);

    assert.equal(
      second,
      null
    );

    assert.equal(
      SemanticFeedbackService.getCount(),
      1
    );
  }
);

test(
  'deve considerar pares invertidos como o mesmo par',
  () => {
    initializeService();

    const first =
      SemanticFeedbackService.add(
        'quero aprender Python',
        'tenho interesse em estudar Python',
        1
      );

    const second =
      SemanticFeedbackService.add(
        'tenho interesse em estudar Python',
        'quero aprender Python',
        1
      );

    assert.ok(first);

    assert.equal(
      second,
      null
    );

    assert.equal(
      SemanticFeedbackService.hasPair(
        'tenho interesse em estudar Python',
        'quero aprender Python',
        1
      ),
      true
    );
  }
);

test(
  'deve permitir o mesmo par com labels diferentes',
  () => {
    initializeService();

    const positive =
      SemanticFeedbackService.add(
        'frase A',
        'frase B',
        1
      );

    const negative =
      SemanticFeedbackService.add(
        'frase A',
        'frase B',
        0
      );

    assert.ok(positive);
    assert.ok(negative);

    assert.notEqual(
      positive.id,
      negative.id
    );

    assert.equal(
      SemanticFeedbackService.getCount(),
      2
    );
  }
);

test(
  'deve retornar pares de treinamento',
  () => {
    initializeService();

    SemanticFeedbackService.add(
      'frase positiva A',
      'frase positiva B',
      1
    );

    SemanticFeedbackService.add(
      'frase negativa A',
      'frase negativa B',
      0
    );

    const pairs =
      SemanticFeedbackService
        .getTrainingPairs();

    assert.equal(
      pairs.length,
      2
    );

    assert.deepEqual(
      pairs[0],
      {
        first: 'frase positiva A',
        second: 'frase positiva B',
        label: 1,
      }
    );

    assert.deepEqual(
      pairs[1],
      {
        first: 'frase negativa A',
        second: 'frase negativa B',
        label: 0,
      }
    );
  }
);

test(
  'deve buscar feedback por id',
  () => {
    initializeService();

    const feedback =
      SemanticFeedbackService.add(
        'frase A',
        'frase B',
        1
      );

    assert.ok(feedback);

    const found =
      SemanticFeedbackService.getById(
        feedback.id
      );

    assert.ok(found);

    assert.equal(
      found.id,
      feedback.id
    );

    assert.equal(
      found.first,
      'frase A'
    );
  }
);

test(
  'deve retornar null para id inexistente',
  () => {
    initializeService();

    assert.equal(
      SemanticFeedbackService.getById(
        999999
      ),
      null
    );
  }
);

test(
  'deve remover feedback',
  () => {
    initializeService();

    const feedback =
      SemanticFeedbackService.add(
        'frase A',
        'frase B',
        1
      );

    assert.ok(feedback);

    assert.equal(
      SemanticFeedbackService.remove(
        feedback.id
      ),
      true
    );

    assert.equal(
      SemanticFeedbackService.getCount(),
      0
    );

    assert.equal(
      SemanticFeedbackService.remove(
        feedback.id
      ),
      false
    );
  }
);

test(
  'deve limpar todos os feedbacks',
  () => {
    initializeService();

    SemanticFeedbackService.add(
      'frase A',
      'frase B',
      1
    );

    SemanticFeedbackService.add(
      'frase C',
      'frase D',
      0
    );

    assert.equal(
      SemanticFeedbackService.clear(),
      2
    );

    assert.equal(
      SemanticFeedbackService.getCount(),
      0
    );

    assert.equal(
      SemanticFeedbackService.clear(),
      0
    );
  }
);

test(
  'deve persistir feedback e carregá-lo novamente',
  () => {
    const filePath =
      initializeService();

    const created =
      SemanticFeedbackService.add(
        'como aprender TypeScript?',
        'quero estudar TypeScript',
        1,
        'human'
      );

    assert.ok(created);

    SemanticFeedbackService.reset();

    SemanticFeedbackService.initialize(
      filePath
    );

    const loaded =
      SemanticFeedbackService.getById(
        created.id
      );

    assert.ok(loaded);

    assert.equal(
      loaded.first,
      'como aprender TypeScript?'
    );

    assert.equal(
      loaded.second,
      'quero estudar TypeScript'
    );

    assert.equal(
      loaded.label,
      1
    );

    assert.equal(
      loaded.source,
      'human'
    );

    assert.equal(
      SemanticFeedbackService.getCount(),
      1
    );
  }
);