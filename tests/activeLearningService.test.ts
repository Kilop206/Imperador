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
  ActiveLearningService,
} from '../src/intelligence/activeLearningService';

import {
  IntentCandidateService,
} from '../src/intelligence/intentCandidateService';

describe(
  'ActiveLearningService',
  () => {
    const temporaryDirectory =
      fs.mkdtempSync(
        path.join(
          os.tmpdir(),
          'imperador-active-learning-'
        )
      );

    const filePath =
      path.join(
        temporaryDirectory,
        'candidates.json'
      );

    beforeEach(() => {
      IntentCandidateService.reset();

      if (
        fs.existsSync(
          filePath
        )
      ) {
        fs.unlinkSync(
          filePath
        );
      }

      IntentCandidateService.initialize(
        filePath
      );
    });

    after(() => {
      fs.rmSync(
        temporaryDirectory,
        {
          recursive: true,
          force: true,
        }
      );
    });

    test(
      'atribui alta utilidade para previsão incerta',
      () => {
        const result =
          ActiveLearningService.score(
            'mensagem ambígua',
            {
              intent: 'neutral',
              confidence: 0.30,
              probabilities: {
                aggressive: 0.05,
                compliment: 0.05,
                question: 0.20,
                greeting: 0.05,
                farewell: 0.05,
                humor: 0.10,
                serious: 0.10,
                nostalgic: 0.10,
                philosophical: 0.10,
                roman: 0.10,
                neutral: 0.10,
              },
            }
          );

        assert.ok(
          result.uncertainty > 0
        );

        assert.ok(
          result.score >= 0
        );

        assert.ok(
          result.score <= 1
        );
      }
    );

    test(
      'considera mensagem muito nova como prioritária',
      () => {
        const result =
          ActiveLearningService.consider(
            'uma mensagem totalmente nova',
            {
              intent: 'neutral',
              confidence: 0.30,
              probabilities: {
                aggressive: 0.05,
                compliment: 0.05,
                question: 0.20,
                greeting: 0.05,
                farewell: 0.05,
                humor: 0.10,
                serious: 0.10,
                nostalgic: 0.10,
                philosophical: 0.10,
                roman: 0.10,
                neutral: 0.10,
              },
            }
          );

        assert.equal(
          result.shouldCollect,
          true
        );

        assert.equal(
          IntentCandidateService
            .getPendingCount(),
          1
        );
      }
    );

    test(
      'reduz novidade para mensagem muito semelhante',
      () => {
        const prediction = {
          intent: 'neutral' as const,
          confidence: 0.20,
          probabilities: {
            aggressive: 0.05,
            compliment: 0.05,
            question: 0.20,
            greeting: 0.05,
            farewell: 0.05,
            humor: 0.10,
            serious: 0.10,
            nostalgic: 0.10,
            philosophical: 0.10,
            roman: 0.10,
            neutral: 0.10,
          },
        };

        ActiveLearningService.consider(
          'roma possui legiões poderosas',
          prediction
        );

        const result =
          ActiveLearningService.score(
            'roma possui legiões poderosas',
            prediction
          );

        assert.equal(
          result.novelty,
          0
        );
      }
    );

    test(
      'não coleta previsão claramente confiante',
      () => {
        const result =
          ActiveLearningService.consider(
            'viva roma',
            {
              intent: 'roman',
              confidence: 0.95,
              probabilities: {
                aggressive: 0,
                compliment: 0,
                question: 0.01,
                greeting: 0,
                farewell: 0,
                humor: 0,
                serious: 0,
                nostalgic: 0,
                philosophical: 0,
                roman: 0.95,
                neutral: 0.04,
              },
            }
          );

        assert.equal(
          result.shouldCollect,
          false
        );

        assert.equal(
          IntentCandidateService
            .getPendingCount(),
          0
        );
      }
    );
  }
);