import {
  describe,
  test,
} from 'node:test';

import assert from 'node:assert/strict';

import {
  INTENT_DATASET,
} from '../src/intelligence/intentDataset';

import {
  evaluateIntentClassifier,
  formatEvaluationReport,
  splitDataset,
} from '../src/intelligence/intentEvaluation';

describe(
  'Intent evaluation',
  () => {
    test(
      'divide o dataset de forma determinística',
      () => {
        const first =
          splitDataset(
            INTENT_DATASET,
            0.2,
            42
          );

        const second =
          splitDataset(
            INTENT_DATASET,
            0.2,
            42
          );

        assert.deepEqual(
          first,
          second
        );

        assert.ok(
          first.train.length > 0
        );

        assert.ok(
          first.test.length > 0
        );
      }
    );

    test(
      'mantém todos os dados sem duplicação',
      () => {
        const {
          train,
          test,
        } = splitDataset(
          INTENT_DATASET,
          0.2,
          42
        );

        assert.equal(
          train.length +
            test.length,
          INTENT_DATASET.length
        );

        const allTexts = [
          ...train,
          ...test,
        ].map(
          example => example.text
        );

        assert.equal(
          new Set(allTexts).size,
          allTexts.length
        );
      }
    );

    test(
      'gera métricas de avaliação',
      () => {
        const {
          train,
          test,
        } = splitDataset(
          INTENT_DATASET,
          0.2,
          42
        );

        const result =
          evaluateIntentClassifier(
            train,
            test
          );

        assert.equal(
          result.totalExamples,
          test.length
        );

        assert.ok(
          result.correct >= 0
        );

        assert.ok(
          result.accuracy >= 0
        );

        assert.ok(
          result.accuracy <= 1
        );

        assert.equal(
          result.classes.length,
          11
        );
      }
    );

    test(
      'possui matriz de confusão completa',
      () => {
        const {
          train,
          test,
        } = splitDataset(
          INTENT_DATASET,
          0.2,
          42
        );

        const result =
          evaluateIntentClassifier(
            train,
            test
          );

        assert.equal(
          Object.keys(
            result.confusionMatrix
          ).length,
          11
        );

        for (
          const row of Object.values(
            result.confusionMatrix
          )
        ) {
          assert.equal(
            Object.keys(row).length,
            11
          );
        }
      }
    );

    test(
      'gera um relatório legível',
      () => {
        const {
          train,
          test,
        } = splitDataset(
          INTENT_DATASET,
          0.2,
          42
        );

        const result =
          evaluateIntentClassifier(
            train,
            test
          );

        const report =
          formatEvaluationReport(
            result
          );

        assert.match(
          report,
          /Intent Classifier Evaluation/
        );

        assert.match(
          report,
          /Accuracy:/
        );

        assert.match(
          report,
          /Precision/
        );

        assert.match(
          report,
          /Recall/
        );

        assert.match(
          report,
          /F1/
        );
      }
    );
  }
);