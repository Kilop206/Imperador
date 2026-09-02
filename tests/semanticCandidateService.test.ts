import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  afterEach,
  test,
} from 'node:test';

import {
  SemanticCandidateService,
} from '../src/intelligence/semanticCandidateService';

const temporaryDirectories:
  string[] = [];

function createTemporaryFile(): string {
  const directory =
    fs.mkdtempSync(
      path.join(
        os.tmpdir(),
        'imperador-semantic-candidate-'
      )
    );

  temporaryDirectories.push(
    directory
  );

  return path.join(
    directory,
    'candidates.json'
  );
}

function initializeService(): string {
  SemanticCandidateService.reset();

  const filePath =
    createTemporaryFile();

  SemanticCandidateService.initialize(
    filePath
  );

  return filePath;
}

afterEach(() => {
  SemanticCandidateService.reset();

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
  'deve começar sem candidatos',
  () => {
    initializeService();

    assert.equal(
      SemanticCandidateService.getTotalCount(),
      0
    );

    assert.equal(
      SemanticCandidateService.getPendingCount(),
      0
    );

    assert.deepEqual(
      SemanticCandidateService.getPending(),
      []
    );
  }
);

test(
  'deve coletar um candidato',
  () => {
    initializeService();

    const candidate =
      SemanticCandidateService.collect(
        'quero aprender Python',
        'tenho interesse em estudar Python',
        0.51,
        'uncertain'
      );

    assert.ok(candidate);

    assert.equal(
      candidate.first,
      'quero aprender Python'
    );

    assert.equal(
      candidate.second,
      'tenho interesse em estudar Python'
    );

    assert.equal(
      candidate.predictedScore,
      0.51
    );

    assert.equal(
      candidate.reason,
      'uncertain'
    );

    assert.equal(
      candidate.reviewed,
      false
    );

    assert.equal(
      SemanticCandidateService.getTotalCount(),
      1
    );

    assert.equal(
      SemanticCandidateService.getPendingCount(),
      1
    );
  }
);

test(
  'deve normalizar score para o intervalo [0, 1]',
  () => {
    initializeService();

    const high =
      SemanticCandidateService.collect(
        'frase A',
        'frase B',
        5,
        'uncertain'
      );

    const low =
      SemanticCandidateService.collect(
        'frase C',
        'frase D',
        -5,
        'novel'
      );

    assert.ok(high);
    assert.ok(low);

    assert.equal(
      high.predictedScore,
      1
    );

    assert.equal(
      low.predictedScore,
      0
    );
  }
);

test(
  'não deve aceitar frases vazias',
  () => {
    initializeService();

    assert.equal(
      SemanticCandidateService.collect(
        '',
        'frase válida',
        0.5,
        'uncertain'
      ),
      null
    );

    assert.equal(
      SemanticCandidateService.collect(
        'frase válida',
        '   ',
        0.5,
        'uncertain'
      ),
      null
    );

    assert.equal(
      SemanticCandidateService.getTotalCount(),
      0
    );
  }
);

test(
  'não deve aceitar frases semanticamente iguais',
  () => {
    initializeService();

    assert.equal(
      SemanticCandidateService.collect(
        'Olá mundo',
        'ola mundo',
        0.5,
        'uncertain'
      ),
      null
    );

    assert.equal(
      SemanticCandidateService.getTotalCount(),
      0
    );
  }
);

test(
  'não deve duplicar um par pendente',
  () => {
    initializeService();

    const first =
      SemanticCandidateService.collect(
        'quero aprender Python',
        'quero estudar Python',
        0.52,
        'uncertain'
      );

    const second =
      SemanticCandidateService.collect(
        'QUERO ESTUDAR PYTHON',
        'QUERO APRENDER PYTHON',
        0.48,
        'hard-negative'
      );

    assert.ok(first);

    assert.equal(
      second,
      null
    );

    assert.equal(
      SemanticCandidateService.getTotalCount(),
      1
    );
  }
);

test(
  'deve aceitar motivos diferentes em pares diferentes',
  () => {
    initializeService();

    const uncertain =
      SemanticCandidateService.collect(
        'frase A',
        'frase B',
        0.50,
        'uncertain'
      );

    const hardNegative =
      SemanticCandidateService.collect(
        'frase C',
        'frase D',
        0.82,
        'hard-negative'
      );

    const novel =
      SemanticCandidateService.collect(
        'frase E',
        'frase F',
        0.20,
        'novel'
      );

    const conflict =
      SemanticCandidateService.collect(
        'frase G',
        'frase H',
        0.60,
        'retrieval-conflict'
      );

    assert.ok(uncertain);
    assert.ok(hardNegative);
    assert.ok(novel);
    assert.ok(conflict);

    assert.equal(
      SemanticCandidateService.getTotalCount(),
      4
    );
  }
);

test(
  'getPending deve priorizar scores próximos de 0.5',
  () => {
    initializeService();

    SemanticCandidateService.collect(
      'frase distante',
      'outra frase',
      0.95,
      'uncertain'
    );

    SemanticCandidateService.collect(
      'frase incerta',
      'outra incerta',
      0.51,
      'uncertain'
    );

    SemanticCandidateService.collect(
      'frase quase incerta',
      'outra quase incerta',
      0.45,
      'uncertain'
    );

    const pending =
      SemanticCandidateService.getPending(
        3
      );

    assert.equal(
      pending.length,
      3
    );

    assert.equal(
      pending[0].predictedScore,
      0.51
    );
  }
);

test(
  'deve buscar candidato por id',
  () => {
    initializeService();

    const candidate =
      SemanticCandidateService.collect(
        'frase A',
        'frase B',
        0.5,
        'uncertain'
      );

    assert.ok(candidate);

    const found =
      SemanticCandidateService.getById(
        candidate.id
      );

    assert.ok(found);

    assert.equal(
      found.id,
      candidate.id
    );

    assert.equal(
      found.first,
      candidate.first
    );
  }
);

test(
  'deve retornar null para id inexistente',
  () => {
    initializeService();

    assert.equal(
      SemanticCandidateService.getById(
        999999
      ),
      null
    );
  }
);

test(
  'deve filtrar candidatos por motivo',
  () => {
    initializeService();

    SemanticCandidateService.collect(
      'frase A',
      'frase B',
      0.5,
      'uncertain'
    );

    SemanticCandidateService.collect(
      'frase C',
      'frase D',
      0.8,
      'hard-negative'
    );

    const result =
      SemanticCandidateService.getByReason(
        'hard-negative'
      );

    assert.equal(
      result.length,
      1
    );

    assert.equal(
      result[0].reason,
      'hard-negative'
    );
  }
);

test(
  'deve marcar candidato como revisado',
  () => {
    initializeService();

    const candidate =
      SemanticCandidateService.collect(
        'frase A',
        'frase B',
        0.5,
        'uncertain'
      );

    assert.ok(candidate);

    assert.equal(
      SemanticCandidateService.markReviewed(
        candidate.id
      ),
      true
    );

    const found =
      SemanticCandidateService.getById(
        candidate.id
      );

    assert.ok(found);

    assert.equal(
      found.reviewed,
      true
    );

    assert.equal(
      SemanticCandidateService.getPendingCount(),
      0
    );
  }
);

test(
  'não deve marcar duas vezes o mesmo candidato como revisado',
  () => {
    initializeService();

    const candidate =
      SemanticCandidateService.collect(
        'frase A',
        'frase B',
        0.5,
        'uncertain'
      );

    assert.ok(candidate);

    assert.equal(
      SemanticCandidateService.markReviewed(
        candidate.id
      ),
      true
    );

    assert.equal(
      SemanticCandidateService.markReviewed(
        candidate.id
      ),
      false
    );
  }
);

test(
  'deve remover candidato',
  () => {
    initializeService();

    const candidate =
      SemanticCandidateService.collect(
        'frase A',
        'frase B',
        0.5,
        'uncertain'
      );

    assert.ok(candidate);

    assert.equal(
      SemanticCandidateService.remove(
        candidate.id
      ),
      true
    );

    assert.equal(
      SemanticCandidateService.getTotalCount(),
      0
    );

    assert.equal(
      SemanticCandidateService.remove(
        candidate.id
      ),
      false
    );
  }
);

test(
  'deve limpar candidatos revisados',
  () => {
    initializeService();

    const first =
      SemanticCandidateService.collect(
        'frase A',
        'frase B',
        0.5,
        'uncertain'
      );

    const second =
      SemanticCandidateService.collect(
        'frase C',
        'frase D',
        0.4,
        'novel'
      );

    assert.ok(first);
    assert.ok(second);

    SemanticCandidateService.markReviewed(
      first.id
    );

    assert.equal(
      SemanticCandidateService.clearReviewed(),
      1
    );

    assert.equal(
      SemanticCandidateService.getTotalCount(),
      1
    );

    assert.equal(
      SemanticCandidateService.getPendingCount(),
      1
    );
  }
);

test(
  'deve verificar se um par já existe',
  () => {
    initializeService();

    SemanticCandidateService.collect(
      'Como aprender Python?',
      'Quero estudar Python',
      0.5,
      'uncertain'
    );

    assert.equal(
      SemanticCandidateService.hasPair(
        'quero estudar python',
        'como aprender python?'
      ),
      true
    );

    assert.equal(
      SemanticCandidateService.hasPair(
        'como aprender Java?',
        'quero estudar Java'
      ),
      false
    );
  }
);

test(
  'deve remover todos os candidatos com clear',
  () => {
    initializeService();

    SemanticCandidateService.collect(
      'frase A',
      'frase B',
      0.5,
      'uncertain'
    );

    SemanticCandidateService.collect(
      'frase C',
      'frase D',
      0.4,
      'novel'
    );

    assert.equal(
      SemanticCandidateService.clear(),
      2
    );

    assert.equal(
      SemanticCandidateService.getTotalCount(),
      0
    );

    assert.equal(
      SemanticCandidateService.clear(),
      0
    );
  }
);

test(
  'deve persistir e restaurar candidatos',
  () => {
    const filePath =
      initializeService();

    const created =
      SemanticCandidateService.collect(
        'como estudar TypeScript?',
        'quero aprender TypeScript',
        0.53,
        'uncertain'
      );

    assert.ok(created);

    SemanticCandidateService.reset();

    SemanticCandidateService.initialize(
      filePath
    );

    const loaded =
      SemanticCandidateService.getById(
        created.id
      );

    assert.ok(loaded);

    assert.equal(
      loaded.first,
      'como estudar TypeScript?'
    );

    assert.equal(
      loaded.second,
      'quero aprender TypeScript'
    );

    assert.equal(
      loaded.predictedScore,
      0.53
    );

    assert.equal(
      loaded.reason,
      'uncertain'
    );

    assert.equal(
      loaded.reviewed,
      false
    );
  }
);