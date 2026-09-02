import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  afterEach,
  test,
} from 'node:test';

import {
  SemanticActiveLearningService,
} from '../src/intelligence/semanticActiveLearningService';

import {
  SemanticCandidateService,
} from '../src/intelligence/semanticCandidateService';

import {
  SemanticFeedbackService,
} from '../src/intelligence/semanticFeedbackService';

const temporaryDirectories:
  string[] = [];

function createTemporaryFile(
  prefix: string,
  filename: string,
): string {
  const directory =
    fs.mkdtempSync(
      path.join(
        os.tmpdir(),
        prefix,
      ),
    );

  temporaryDirectories.push(
    directory,
  );

  return path.join(
    directory,
    filename,
  );
}

function initializeServices(): void {
  SemanticCandidateService.reset();

  SemanticFeedbackService.reset();

  SemanticCandidateService.initialize(
    createTemporaryFile(
      'imperador-semantic-al-',
      'candidates.json',
    ),
  );

  SemanticFeedbackService.initialize(
    createTemporaryFile(
      'imperador-semantic-feedback-al-',
      'feedback.json',
    ),
  );
}

afterEach(() => {
  SemanticCandidateService.reset();
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
        },
      );
    }
  }
});

test(
  'deve considerar score próximo de 0.5 como incerto',
  () => {
    initializeServices();

    const result =
      SemanticActiveLearningService.score(
        {
          first: 'quero aprender Python',
          second: 'tenho interesse em estudar Python',
          semanticScore: 0.50,
        },
      );

    assert.ok(
      result.uncertainty > 0,
    );

    assert.ok(
      result.shouldCollect,
    );

    assert.equal(
      result.reason,
      'uncertain',
    );
  },
);

test(
  'deve dar baixa incerteza para scores extremos',
  () => {
    initializeServices();

    const low =
      SemanticActiveLearningService.score(
        {
          first: 'frase A',
          second: 'frase B',
          semanticScore: 0.05,
        },
      );

    const high =
      SemanticActiveLearningService.score(
        {
          first: 'frase C',
          second: 'frase D',
          semanticScore: 0.95,
        },
      );

    assert.equal(
      low.uncertainty,
      0,
    );

    assert.equal(
      high.uncertainty,
      0,
    );
  },
);

test(
  'deve detectar hard negative',
  () => {
    initializeServices();

    const result =
      SemanticActiveLearningService.score(
        {
          first: 'como configurar Docker?',
          second: 'como configurar Kubernetes?',
          semanticScore: 0.90,
          tfidfScore: 0.30,
          keywordScore: 0.20,
        },
      );

    assert.ok(
      result.shouldCollect,
    );

    assert.equal(
      result.reason,
      'hard-negative',
    );

    assert.ok(
      result.disagreement > 0,
    );
  },
);

test(
  'deve detectar conflito entre retrieval e semântica',
  () => {
    initializeServices();

    const result =
      SemanticActiveLearningService.score(
        {
          first: 'quero estudar Python',
          second: 'quero aprender programação',
          semanticScore: 0.85,
          retrievalScore: 0.35,
          tfidfScore: 0.80,
          keywordScore: 0.70,
        },
      );

    assert.ok(
      result.shouldCollect,
    );

    assert.equal(
      result.reason,
      'retrieval-conflict',
    );
  },
);

test(
  'deve detectar novidade',
  () => {
    initializeServices();

    const result =
      SemanticActiveLearningService.score(
        {
          first: 'frase totalmente nova A',
          second: 'frase totalmente nova B',
          semanticScore: 0.80,
          tfidfScore: 0.80,
          keywordScore: 0.80,
          noveltyScore: 0.95,
        },
      );

    assert.ok(
      result.novelty > 0.9,
    );

    assert.equal(
      result.reason,
      'novel',
    );

    assert.ok(
      result.shouldCollect,
    );
  },
);

test(
  'deve limitar todos os scores ao intervalo [0, 1]',
  () => {
    initializeServices();

    const result =
      SemanticActiveLearningService.score(
        {
          first: 'frase A',
          second: 'frase B',
          semanticScore: 7,
          tfidfScore: -5,
          keywordScore: 20,
          retrievalScore: -2,
          noveltyScore: 10,
        },
      );

    assert.ok(
      result.uncertainty >= 0 &&
      result.uncertainty <= 1,
    );

    assert.ok(
      result.novelty >= 0 &&
      result.novelty <= 1,
    );

    assert.ok(
      result.disagreement >= 0 &&
      result.disagreement <= 1,
    );

    assert.ok(
      result.collectionScore >= 0 &&
      result.collectionScore <= 1,
    );
  },
);

test(
  'deve coletar um candidato quando houver motivo válido',
  () => {
    initializeServices();

    const candidate =
      SemanticActiveLearningService.consider(
        {
          first: 'quero aprender Python',
          second: 'tenho interesse em estudar Python',
          semanticScore: 0.50,
        },
      );

    assert.ok(candidate);

    assert.equal(
      SemanticCandidateService.getPendingCount(),
      1,
    );

    assert.equal(
      candidate.reason,
      'uncertain',
    );
  },
);

test(
  'não deve duplicar candidatos',
  () => {
    initializeServices();

    const first =
      SemanticActiveLearningService.consider(
        {
          first: 'quero aprender Python',
          second: 'tenho interesse em estudar Python',
          semanticScore: 0.50,
        },
      );

    const second =
      SemanticActiveLearningService.consider(
        {
          first: 'tenho interesse em estudar Python',
          second: 'quero aprender Python',
          semanticScore: 0.51,
        },
      );

    assert.ok(first);

    assert.equal(
      second,
      null,
    );

    assert.equal(
      SemanticCandidateService.getPendingCount(),
      1,
    );
  },
);

test(
  'não deve coletar par já supervisionado',
  () => {
    initializeServices();

    SemanticFeedbackService.add(
      'quero aprender Python',
      'tenho interesse em estudar Python',
      1,
    );

    const result =
      SemanticActiveLearningService.consider(
        {
          first: 'quero aprender Python',
          second: 'tenho interesse em estudar Python',
          semanticScore: 0.50,
        },
      );

    assert.equal(
      result,
      null,
    );

    assert.equal(
      SemanticCandidateService.getPendingCount(),
      0,
    );
  },
);

test(
  'deve retornar quantidade e candidatos pendentes',
  () => {
    initializeServices();

    SemanticActiveLearningService.consider(
      {
        first: 'frase A',
        second: 'frase B',
        semanticScore: 0.50,
      },
    );

    SemanticActiveLearningService.consider(
      {
        first: 'frase C',
        second: 'frase D',
        semanticScore: 0.52,
      },
    );

    assert.equal(
      SemanticActiveLearningService.getPendingCount(),
      2,
    );

    const pending =
      SemanticActiveLearningService.getPending();

    assert.equal(
      pending.length,
      2,
    );
  },
);

test(
  'getCandidateScore deve retornar o score calculado',
  () => {
    initializeServices();

    const score =
      SemanticActiveLearningService.getCandidateScore(
        {
          first: 'frase A',
          second: 'frase B',
          semanticScore: 0.50,
        },
      );

    assert.ok(
      score >= 0,
    );

    assert.ok(
      score <= 1,
    );
  },
);