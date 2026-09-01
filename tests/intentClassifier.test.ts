import {
  describe,
  test,
} from 'node:test';

import assert from 'node:assert/strict';

import {
  IntentClassifier,
} from '../src/intelligence/intentClassifier';

import {
  INTENT_DATASET,
} from '../src/intelligence/intentDataset';

describe(
  'IntentClassifier',
  () => {
    test(
      'treina o modelo',
      () => {
        IntentClassifier.reset();

        IntentClassifier.train(
          INTENT_DATASET
        );

        assert.equal(
          IntentClassifier.isTrained(),
          true
        );

        assert.ok(
          IntentClassifier.getVocabularySize() >
            0
        );

        assert.equal(
          IntentClassifier.getTrainingExampleCount(),
          INTENT_DATASET.length
        );
      }
    );

    test(
      'classifica mensagens conhecidas',
      () => {
        IntentClassifier.reset();

        IntentClassifier.train(
          INTENT_DATASET
        );

        const prediction =
          IntentClassifier.predict(
            'você é muito inteligente'
          );

        assert.equal(
          prediction.intent,
          'compliment'
        );

        assert.ok(
          prediction.confidence > 0
        );
      }
    );

    test(
      'generaliza para uma frase diferente',
      () => {
        IntentClassifier.reset();

        IntentClassifier.train(
          INTENT_DATASET
        );

        const prediction =
          IntentClassifier.predict(
            'eu sinto muita saudade dos tempos antigos'
          );

        assert.equal(
          prediction.intent,
          'nostalgic'
        );
      }
    );

    test(
      'retorna probabilidades válidas',
      () => {
        IntentClassifier.reset();

        IntentClassifier.train(
          INTENT_DATASET
        );

        const prediction =
          IntentClassifier.predict(
            'roma e suas legiões'
          );

        const total =
          Object.values(
            prediction.probabilities
          ).reduce(
            (sum, value) =>
              sum + value,
            0
          );

        assert.ok(
          Math.abs(total - 1) <
            0.000001
        );
      }
    );

    test(
      'exporta e importa o modelo',
      () => {
        IntentClassifier.reset();

        IntentClassifier.train(
          INTENT_DATASET
        );

        const serialized =
          IntentClassifier.exportModel();

        IntentClassifier.reset();

        assert.equal(
          IntentClassifier.isTrained(),
          false
        );

        IntentClassifier.importModel(
          serialized
        );

        const prediction =
          IntentClassifier.predict(
            'viva roma'
          );

        assert.equal(
          prediction.intent,
          'roman'
        );
      }
    );

    test(
      'não permite previsão antes do treino',
      () => {
        IntentClassifier.reset();

        assert.throws(() =>
          IntentClassifier.predict(
            'olá'
          )
        );
      }
    );
  }
);