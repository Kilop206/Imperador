import {
  describe,
  test,
} from 'node:test';

import assert from 'node:assert/strict';

import {
  analyzeDatasetQuality,
  formatDatasetQualityReport,
  validateDataset,
} from '../src/intelligence/intentDatasetQuality';

import {
  TrainingExample,
} from '../src/intelligence/intentClassifier';

describe(
  'IntentDatasetQuality',
  () => {
    test(
      'aceita dataset válido',
      () => {
        const examples:
          TrainingExample[] = [
          {
            text: 'oi',
            intent: 'greeting',
          },
          {
            text: 'olá',
            intent: 'greeting',
          },
          {
            text: 'bom dia',
            intent: 'greeting',
          },
          {
            text: 'tchau',
            intent: 'farewell',
          },
          {
            text: 'até mais',
            intent: 'farewell',
          },
          {
            text: 'falou',
            intent: 'farewell',
          },
          {
            text: 'viva roma',
            intent: 'roman',
          },
          {
            text: 'roma',
            intent: 'roman',
          },
          {
            text: 'as legiões',
            intent: 'roman',
          },
        ];

        const result =
          analyzeDatasetQuality(
            examples
          );

        assert.equal(
          result.isValid,
          true
        );

        assert.equal(
          result.conflictingTexts,
          0
        );
      }
    );

    test(
      'detecta texto duplicado',
      () => {
        const examples:
          TrainingExample[] = [
          {
            text: 'Olá Imperador',
            intent: 'greeting',
          },
          {
            text: 'olá imperador!',
            intent: 'greeting',
          },
          {
            text: 'bom dia',
            intent: 'greeting',
          },
        ];

        const result =
          analyzeDatasetQuality(
            examples
          );

        assert.equal(
          result.duplicateTexts,
          1
        );
      }
    );

    test(
      'detecta conflito de rótulos',
      () => {
        const examples:
          TrainingExample[] = [
          {
            text: 'olá imperador',
            intent: 'greeting',
          },
          {
            text: 'Olá Imperador!',
            intent: 'question',
          },
        ];

        const result =
          analyzeDatasetQuality(
            examples
          );

        assert.equal(
          result.conflictingTexts,
          1
        );

        assert.equal(
          result.isValid,
          false
        );

        assert.equal(
          result.conflicts[0]
            .intents.length,
          2
        );
      }
    );

    test(
      'detecta intenções ausentes',
      () => {
        const examples:
          TrainingExample[] = [
          {
            text: 'olá',
            intent: 'greeting',
          },
          {
            text: 'bom dia',
            intent: 'greeting',
          },
          {
            text: 'salve',
            intent: 'greeting',
          },
        ];

        const result =
          analyzeDatasetQuality(
            examples
          );

        assert.ok(
          result.missingIntents.includes(
            'roman'
          )
        );

        assert.ok(
          result.missingIntents.includes(
            'question'
          )
        );
      }
    );

    test(
      'detecta classe dominante',
      () => {
        const examples:
          TrainingExample[] = [
          ...Array.from(
            {
              length: 10,
            },
            (_, index) => ({
              text:
                `mensagem ${index}`,
              intent:
                'greeting' as const,
            })
          ),
          {
            text: 'tchau',
            intent: 'farewell',
          },
          {
            text: 'até mais',
            intent: 'farewell',
          },
          {
            text: 'falou',
            intent: 'farewell',
          },
        ];

        const result =
          analyzeDatasetQuality(
            examples
          );

        assert.equal(
          result.isBalanced,
          false
        );

        assert.ok(
          result.warnings.some(
            warning =>
              warning.includes(
                'greeting'
              )
          )
        );
      }
    );

    test(
      'validateDataset lança para dataset inválido',
      () => {
        const examples:
          TrainingExample[] = [
          {
            text: 'olá',
            intent: 'greeting',
          },
          {
            text: 'olá',
            intent: 'question',
          },
        ];

        assert.throws(
          () =>
            validateDataset(
              examples
            )
        );
      }
    );

    test(
      'gera relatório',
      () => {
        const examples:
          TrainingExample[] = [
          {
            text: 'oi',
            intent: 'greeting',
          },
          {
            text: 'bom dia',
            intent: 'greeting',
          },
          {
            text: 'salve',
            intent: 'greeting',
          },
        ];

        const result =
          analyzeDatasetQuality(
            examples
          );

        const report =
          formatDatasetQualityReport(
            result
          );

        assert.match(
          report,
          /Dataset Quality Report/
        );

        assert.match(
          report,
          /greeting/
        );

        assert.match(
          report,
          /Total de exemplos/
        );
      }
    );
  }
);