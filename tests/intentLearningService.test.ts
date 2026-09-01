import {
  describe,
  test,
  beforeEach,
  after,
} from 'node:test';

import assert from 'node:assert/strict';

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  IntentLearningService,
} from '../src/intelligence/intentLearningService';

import {
  IntentClassifier,
} from '../src/intelligence/intentClassifier';

describe(
  'IntentLearningService',
  () => {
    const temporaryDirectory =
      fs.mkdtempSync(
        path.join(
          os.tmpdir(),
          'imperador-learning-'
        )
      );

    const filePath =
      path.join(
        temporaryDirectory,
        'intent_learning.json'
      );

    beforeEach(
      () => {
        if (
          fs.existsSync(
            filePath
          )
        ) {
          fs.unlinkSync(
            filePath
          );
        }

        IntentClassifier.reset();

        /*
         * O serviço mantém seu estado interno
         * entre testes; limpamos os exemplos
         * usando o caminho temporário.
         */
        IntentLearningService.initialize(
          filePath
        );

        IntentLearningService.clearLearnedExamples();
      }
    );

    after(
      () => {
        fs.rmSync(
          temporaryDirectory,
          {
            recursive: true,
            force: true,
          }
        );
      }
    );

    test(
      'aprende um novo exemplo',
      () => {
        const initial =
          IntentLearningService
            .getLearnedExampleCount();

        const learned =
          IntentLearningService.learn(
            'quem comandava as legiões',
            'roman'
          );

        assert.equal(
          learned,
          true
        );

        assert.equal(
          IntentLearningService
            .getLearnedExampleCount(),
          initial + 1
        );
      }
    );

    test(
        'não duplica o mesmo exemplo aprendido',
        () => {
            const text =
            'quem comandava as legiões';

            const first =
            IntentLearningService.learn(
                text,
                'roman'
            );

            const second =
            IntentLearningService.learn(
                text.toUpperCase(),
                'roman'
            );

            assert.equal(
            first,
            true
            );

            assert.equal(
            second,
            false
            );

            assert.equal(
            IntentLearningService
                .getLearnedExampleCount(),
            1
            );
        }
    );

    test(
      'persiste o aprendizado',
      () => {
        IntentLearningService.learn(
          'conte uma história sobre roma',
          'roman'
        );

        assert.ok(
          fs.existsSync(
            filePath
          )
        );

        const content =
          fs.readFileSync(
            filePath,
            'utf-8'
          );

        assert.match(
          content,
          /conte uma história sobre roma/
        );
      }
    );

    test(
      'retreina o classificador',
      () => {
        IntentLearningService.learn(
          'fale sobre as legiões',
          'roman'
        );

        const prediction =
          IntentClassifier.predict(
            'fale sobre as legiões'
          );

        assert.equal(
          prediction.intent,
          'roman'
        );
      }
    );

    test(
      'remove um exemplo aprendido',
      () => {
        IntentLearningService.learn(
          'eu fui embora',
          'farewell'
        );

        const removed =
          IntentLearningService.removeLearnedExample(
            'eu fui embora',
            'farewell'
          );

        assert.equal(
          removed,
          true
        );

        assert.equal(
          IntentLearningService
            .getLearnedExampleCount(),
          0
        );
      }
    );

    test(
      'rejeita intenção inválida',
      () => {
        assert.throws(
          () =>
            IntentLearningService.learn(
              'teste',
              'invalid' as never
            )
        );
      }
    );
  }
);