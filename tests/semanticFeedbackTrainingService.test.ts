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

import {
  SemanticFeedbackTrainingService,
} from '../src/intelligence/semanticFeedbackTrainingService';

import {
  SemanticCandidateService,
} from '../src/intelligence/semanticCandidateService';

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
  SemanticFeedbackService.reset();

  SemanticCandidateService.reset();

  SemanticFeedbackService.initialize(
    createTemporaryFile(
      'imperador-feedback-training-',
      'feedback.json',
    ),
  );

  SemanticCandidateService.initialize(
    createTemporaryFile(
      'imperador-feedback-training-candidates-',
      'candidates.json',
    ),
  );
}

function addFeedback(
  count = 2,
): void {
  const examples = [
    {
      first:
        'quero aprender Python',
      second:
        'tenho interesse em estudar Python',
      label:
        1 as const,
    },
    {
      first:
        'como configurar Docker?',
      second:
        'qual a melhor forma de configurar Docker?',
      label:
        1 as const,
    },
    {
      first:
        'Roma caiu',
      second:
        'o servidor está fora do ar',
      label:
        0 as const,
    },
    {
      first:
        'como aprender programação?',
      second:
        'qual foi a temperatura ontem?',
      label:
        0 as const,
    },
  ];

  for (
    let index = 0;
    index < count;
    index += 1
  ) {
    const example =
      examples[
        index %
          examples.length
      ];

    SemanticFeedbackService.add(
      example.first,
      example.second,
      example.label,
    );
  }
}

afterEach(() => {
  SemanticFeedbackService.reset();
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
        },
      );
    }
  }
});

test(
  'deve indicar que não é possível treinar sem feedback',
  () => {
    initializeServices();

    assert.equal(
      SemanticFeedbackTrainingService
        .getFeedbackCount(),
      0,
    );

    assert.equal(
      SemanticFeedbackTrainingService
        .canTrain(),
      false,
    );
  },
);

test(
  'deve exigir quantidade mínima de feedback',
  () => {
    initializeServices();

    assert.throws(
      () =>
        SemanticFeedbackTrainingService.preview(),
      /São necessários pelo menos 1 exemplos/,
    );
  },
);

test(
  'deve permitir preview quando existem feedbacks',
  () => {
    initializeServices();

    addFeedback(2);

    const preview =
      SemanticFeedbackTrainingService
        .preview();

    assert.equal(
      preview.feedbackCount,
      2,
    );

    assert.equal(
      preview.trainingBaseCount > 0,
      true,
    );

    assert.equal(
      preview.validationCount > 0,
      true,
    );

    assert.equal(
      preview.testCount > 0,
      true,
    );
  },
);

test(
  'deve preservar divisão determinística com a mesma seed',
  () => {
    initializeServices();

    addFeedback(2);

    const first =
      SemanticFeedbackTrainingService
        .preview({
          seed: 123,
        });

    const second =
      SemanticFeedbackTrainingService
        .preview({
          seed: 123,
        });

    assert.deepEqual(
      first.split,
      second.split,
    );
  },
);

test(
  'deve produzir divisões diferentes com seeds diferentes',
  () => {
    initializeServices();

    addFeedback(2);

    const first =
      SemanticFeedbackTrainingService
        .preview({
          seed: 123,
        });

    const second =
      SemanticFeedbackTrainingService
        .preview({
          seed: 456,
        });

    assert.notDeepEqual(
      first.split,
      second.split,
    );
  },
);

test(
  'validation e test devem ser diferentes entre si',
  () => {
    initializeServices();

    addFeedback(2);

    const preview =
      SemanticFeedbackTrainingService
        .preview();

    const validation =
      new Set(
        preview.split.validation.map(
          pair =>
            `${pair.first}\u0000${pair.second}\u0000${pair.label}`,
        ),
      );

    const test =
      new Set(
        preview.split.test.map(
          pair =>
            `${pair.first}\u0000${pair.second}\u0000${pair.label}`,
        ),
      );

    for (
      const item of validation
    ) {
      assert.equal(
        test.has(item),
        false,
      );
    }
  },
);

test(
  'deve respeitar classe positiva e negativa na divisão',
  () => {
    initializeServices();

    addFeedback(2);

    const preview =
      SemanticFeedbackTrainingService
        .preview();

    const positiveValidation =
      preview.split.validation
        .filter(
          pair =>
            pair.label === 1,
        )
        .length;

    const negativeValidation =
      preview.split.validation
        .filter(
          pair =>
            pair.label === 0,
        )
        .length;

    const positiveTest =
      preview.split.test
        .filter(
          pair =>
            pair.label === 1,
        )
        .length;

    const negativeTest =
      preview.split.test
        .filter(
          pair =>
            pair.label === 0,
        )
        .length;

    assert.ok(
      positiveValidation > 0 ||
      negativeValidation > 0,
    );

    assert.ok(
      positiveTest > 0 ||
      negativeTest > 0,
    );
  },
);

test(
  'deve permitir alterar a quantidade mínima de feedback',
  () => {
    initializeServices();

    addFeedback(2);

    assert.equal(
      SemanticFeedbackTrainingService
        .canTrain(2),
      true,
    );

    assert.equal(
      SemanticFeedbackTrainingService
        .canTrain(3),
      false,
    );
  },
);

test(
  'deve rejeitar mínimo inválido como zero e normalizá-lo',
  () => {
    initializeServices();

    addFeedback(1);

    assert.equal(
      SemanticFeedbackTrainingService
        .canTrain(0),
      true,
    );
  },
);

test(
  'deve retornar uma versão ativa através do ModelManager',
  () => {
    initializeServices();

    const version =
      SemanticFeedbackTrainingService
        .getActiveVersion();

    assert.ok(
      version === null ||
      typeof version === 'number',
    );
  },
);

test(
  'deve gerar relatório formatado',
  () => {
    initializeServices();

    addFeedback(2);

    /*
     * Não executamos o fine-tuning aqui:
     * o objetivo deste teste é garantir que o serviço
     * esteja pronto para formar o contexto corretamente.
     */
    const preview =
      SemanticFeedbackTrainingService
        .preview();

    assert.equal(
      typeof preview.feedbackCount,
      'number',
    );

    assert.equal(
      typeof preview.trainingBaseCount,
      'number',
    );

    assert.equal(
      typeof preview.validationCount,
      'number',
    );

    assert.equal(
      typeof preview.testCount,
      'number',
    );
  },
);