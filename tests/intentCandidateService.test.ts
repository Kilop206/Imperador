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
  IntentCandidateService,
} from '../src/intelligence/intentCandidateService';

describe(
  'IntentCandidateService',
  () => {
    const temporaryDirectory =
      fs.mkdtempSync(
        path.join(
          os.tmpdir(),
          'imperador-candidates-'
        )
      );

    const filePath =
      path.join(
        temporaryDirectory,
        'candidates.json'
      );

    beforeEach(
        () => {
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
      'coleta previsão com baixa confiança',
      () => {
        const candidate =
          IntentCandidateService.collect(
            'uma mensagem desconhecida',
            {
              intent: 'neutral',
              confidence: 0.2,
              probabilities: {
                aggressive: 0,
                compliment: 0,
                question: 0,
                greeting: 0,
                farewell: 0,
                humor: 0,
                serious: 0,
                nostalgic: 0,
                philosophical: 0.2,
                roman: 0.3,
                neutral: 0.5,
              },
            }
          );

        assert.ok(
          candidate
        );

        assert.equal(
          candidate.id,
          1
        );

        assert.equal(
          IntentCandidateService
            .getPendingCount(),
          1
        );
      }
    );

    test(
      'não coleta previsão com alta confiança',
      () => {
        const candidate =
          IntentCandidateService.collect(
            'roma',
            {
              intent: 'roman',
              confidence: 0.9,
              probabilities: {
                aggressive: 0,
                compliment: 0,
                question: 0,
                greeting: 0,
                farewell: 0,
                humor: 0,
                serious: 0,
                nostalgic: 0,
                philosophical: 0,
                roman: 0.9,
                neutral: 0.1,
              },
            }
          );

        assert.equal(
          candidate,
          null
        );

        assert.equal(
          IntentCandidateService
            .getPendingCount(),
          0
        );
      }
    );

    test(
      'evita candidatos duplicados',
      () => {
        const prediction = {
          intent: 'neutral' as const,
          confidence: 0.2,
          probabilities: {
            aggressive: 0,
            compliment: 0,
            question: 0,
            greeting: 0,
            farewell: 0,
            humor: 0,
            serious: 0,
            nostalgic: 0,
            philosophical: 0,
            roman: 0,
            neutral: 1,
          },
        };

        const first =
          IntentCandidateService.collect(
            'teste repetido',
            prediction
          );

        const second =
          IntentCandidateService.collect(
            'TESTE REPETIDO',
            prediction
          );

        assert.ok(
          first
        );

        assert.equal(
          second,
          null
        );

        assert.equal(
          IntentCandidateService
            .getPendingCount(),
          1
        );
      }
    );

    test(
      'marca candidato como revisado',
      () => {
        const candidate =
          IntentCandidateService.collect(
            'teste',
            {
              intent: 'neutral',
              confidence: 0.1,
              probabilities: {
                aggressive: 0,
                compliment: 0,
                question: 0,
                greeting: 0,
                farewell: 0,
                humor: 0,
                serious: 0,
                nostalgic: 0,
                philosophical: 0,
                roman: 0,
                neutral: 1,
              },
            }
          );

        assert.ok(
          candidate
        );

        assert.equal(
          IntentCandidateService
            .markReviewed(
              candidate.id
            ),
          true
        );

        assert.equal(
          IntentCandidateService
            .getPendingCount(),
          0
        );
      }
    );

    test(
      'persiste candidatos',
      () => {
        IntentCandidateService.collect(
          'persistência',
          {
            intent: 'neutral',
            confidence: 0.1,
            probabilities: {
              aggressive: 0,
              compliment: 0,
              question: 0,
              greeting: 0,
              farewell: 0,
              humor: 0,
              serious: 0,
              nostalgic: 0,
              philosophical: 0,
              roman: 0,
              neutral: 1,
            },
          }
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
          /persistência/
        );
      }
    );
  }
);