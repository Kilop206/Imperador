import { strict as assert } from 'node:assert';
import {
  beforeEach,
  test,
} from 'node:test';

import { TriggerManager } from '../src/services/triggerManager';
import { ModeManager } from '../src/services/modeManager';
import {
  resetRuntimeState,
  runtimeState,
} from '../src/state/runtimeState';

beforeEach(() => {
  ModeManager.resetToNormal();
  resetRuntimeState();
});

test(
  'ativa modo após três triggers',
  () => {
    const now = 1_000_000;

    TriggerManager.checkTriggers(
      'cerveja',
      now
    );

    TriggerManager.checkTriggers(
      'cerveja',
      now + 1
    );

    assert.equal(
      ModeManager.getMode(),
      'normal'
    );

    TriggerManager.checkTriggers(
      'cerveja',
      now + 2
    );

    assert.equal(
      ModeManager.getMode(),
      'drunk'
    );
  }
);

test(
  'cooldown reinicia contador corretamente',
  () => {
    const now = 1_000_000;

    TriggerManager.checkTriggers(
      'cerveja',
      now
    );

    TriggerManager.checkTriggers(
      'cerveja',
      now + 1
    );

    assert.equal(
      runtimeState.triggerCounts.get(
        'drunk'
      ),
      2
    );

    ModeManager.resetToNormal();

    TriggerManager.checkTriggers(
      'cerveja',
      now + 300_001
    );

    assert.equal(
      ModeManager.getMode(),
      'normal'
    );

    assert.equal(
      runtimeState.triggerCounts.get(
        'drunk'
      ),
      1
    );
  }
);