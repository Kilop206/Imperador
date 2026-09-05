import assert from 'node:assert/strict';
import test from 'node:test';

import {
  GeneratedResponseTrainingRuntimeService,
} from '../src/intelligence/generatedResponseTrainingRuntimeService';

import { AIRuntimeService } from '../src/intelligence/aiRuntimeService';

function result() {
  return {
    learning: {
      scanned: 3,
      applied: 2,
      skipped: 1,
      appliedFeedbackIds: ['one', 'two'],
    },
    trainingSentenceCount: 161,
    vocabularySize: 80,
  };
}

test('não inicia quando está desabilitado', () => {
  const runtime =
    new GeneratedResponseTrainingRuntimeService({
      enabled: false,
      train: () => result(),
    });

  assert.equal(runtime.start(), false);
  assert.equal(runtime.getStatus().running, false);
});

test('inicia e interrompe o scheduler', () => {
  const runtime =
    new GeneratedResponseTrainingRuntimeService({
      enabled: true,
      intervalMs: 5 * 60 * 1000,
      train: () => result(),
    });

  assert.equal(runtime.start(), true);
  assert.equal(runtime.start(), false);
  assert.equal(runtime.getStatus().running, true);

  assert.equal(runtime.stop(), true);
  assert.equal(runtime.stop(), false);
  assert.equal(runtime.getStatus().running, false);
});

test('executa um ciclo manual e registra métricas', async () => {
  let calls = 0;

  const runtime =
    new GeneratedResponseTrainingRuntimeService({
      enabled: true,
      batchSize: 10,
      train: limit => {
        calls += 1;
        assert.equal(limit, 10);
        return result();
      },
    });

  const output = await runtime.runNow();

  assert.deepEqual(output, result());
  assert.equal(calls, 1);

  const status = runtime.getStatus();

  assert.equal(status.cycleCount, 1);
  assert.equal(status.skippedCycles, 0);
  assert.ok(status.lastRunAt);
  assert.deepEqual(status.lastResult, result());
  assert.equal(status.lastError, null);
});

test('bloqueia ciclos excessivamente frequentes', async () => {
  let calls = 0;

  const runtime =
    new GeneratedResponseTrainingRuntimeService({
      enabled: true,
      minimumIntervalMs: 5 * 60 * 1000,
      train: () => {
        calls += 1;
        return result();
      },
    });

  const first = await runtime.runNow();
  const second = await runtime.runNow();

  assert.ok(first);
  assert.equal(second, null);
  assert.equal(calls, 1);
  assert.equal(runtime.getStatus().cycleCount, 1);
  assert.equal(runtime.getStatus().skippedCycles, 1);
});

test('captura erros do ciclo sem derrubar o scheduler', async () => {
  const runtime =
    new GeneratedResponseTrainingRuntimeService({
      enabled: true,
      train: () => {
        throw new Error('falha de treinamento');
      },
    });

  const output = await runtime.runNow();

  assert.equal(output, null);
  assert.equal(runtime.getStatus().cycleCount, 0);
  assert.equal(runtime.getStatus().lastError, 'falha de treinamento');
});

test('AIRuntimeService expõe o estado do runtime de treinamento', () => {
  AIRuntimeService.initialize();

  const status =
    AIRuntimeService
      .getGeneratedResponseTrainingRuntimeStatus();

  assert.equal(
    typeof status.enabled,
    'boolean',
  );

  assert.equal(
    typeof status.running,
    'boolean',
  );

  assert.equal(
    typeof status.cycleCount,
    'number',
  );

  AIRuntimeService.reset();
});
