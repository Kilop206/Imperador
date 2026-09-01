import {
  describe,
  test,
} from 'node:test';

import assert from 'node:assert/strict';

import {
  trainAndEvaluateIntentModel,
} from '../src/intelligence/intentTraining';

describe(
  'Intent training pipeline',
  () => {
    test(
      'treina e avalia o modelo',
      () => {
        const result =
          trainAndEvaluateIntentModel();

        assert.ok(
          result.trainingExamples > 0
        );

        assert.ok(
          result.testExamples > 0
        );

        assert.ok(
          result.accuracy >= 0
        );

        assert.ok(
          result.accuracy <= 1
        );

        assert.ok(
          result.report.length > 0
        );
      }
    );

    test(
      'produz resultado reproduzível',
      () => {
        const first =
          trainAndEvaluateIntentModel(
            0.2,
            42
          );

        const second =
          trainAndEvaluateIntentModel(
            0.2,
            42
          );

        assert.equal(
          first.accuracy,
          second.accuracy
        );

        assert.equal(
          first.report,
          second.report
        );
      }
    );
  }
);