import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ToolRegistry,
} from '../src/intelligence/toolRegistry';

import {
  SafetyPermissionEngine,
} from '../src/intelligence/safetyPermissionEngine';

function createRegistry(): ToolRegistry {
  const registry =
    new ToolRegistry();

  registry.register({
    name: 'safe',
    description:
      'Ferramenta segura.',
    riskLevel: 'low',
    parameters: [],
    execute: () => ({
      ok: true,
    }),
  });

  registry.register({
    name: 'medium',
    description:
      'Ferramenta de risco médio.',
    riskLevel: 'medium',
    parameters: [],
    execute: () => ({
      ok: true,
    }),
  });

  registry.register({
    name: 'high',
    description:
      'Ferramenta de alto risco.',
    riskLevel: 'high',
    parameters: [],
    execute: () => ({
      ok: true,
    }),
  });

  registry.register({
    name: 'critical',
    description:
      'Ferramenta crítica.',
    riskLevel: 'critical',
    parameters: [],
    execute: () => ({
      ok: true,
    }),
  });

  return registry;
}

test(
  'SafetyPermissionEngine permite ferramenta low por padrão',
  () => {
    const engine =
      new SafetyPermissionEngine(
        createRegistry(),
      );

    const result =
      engine.authorize(
        'safe',
        {
          source:
            'autonomous',
        },
      );

    assert.equal(
      result.approved,
      true,
    );

    assert.equal(
      result.decision,
      'approved',
    );
  },
);

test(
  'SafetyPermissionEngine permite medium dentro do limite autônomo',
  () => {
    const engine =
      new SafetyPermissionEngine(
        createRegistry(),
      );

    const result =
      engine.authorize(
        'medium',
        {
          source:
            'autonomous',
        },
      );

    assert.equal(
      result.approved,
      true,
    );
  },
);

test(
  'SafetyPermissionEngine bloqueia high sem aprovação humana',
  () => {
    const engine =
      new SafetyPermissionEngine(
        createRegistry(),
      );

    const result =
      engine.authorize(
        'high',
        {
          source:
            'autonomous',
        },
      );

    assert.equal(
      result.approved,
      false,
    );

    assert.equal(
      result.decision,
      'permission-denied',
    );

    assert.match(
      result.reason,
      /aprovação humana/i,
    );
  },
);

test(
  'SafetyPermissionEngine permite high com aprovação humana',
  () => {
    const engine =
      new SafetyPermissionEngine(
        createRegistry(),
      );

    const result =
      engine.authorize(
        'high',
        {
          source:
            'administrator',
          approvedByHuman:
            true,
        },
      );

    assert.equal(
      result.approved,
      true,
    );
  },
);

test(
  'SafetyPermissionEngine sempre exige aprovação humana para critical',
  () => {
    const engine =
      new SafetyPermissionEngine(
        createRegistry(),
      );

    const denied =
      engine.authorize(
        'critical',
        {
          source:
            'autonomous',
        },
      );

    assert.equal(
      denied.approved,
      false,
    );

    const approved =
      engine.authorize(
        'critical',
        {
          source:
            'administrator',
          approvedByHuman:
            true,
        },
      );

    assert.equal(
      approved.approved,
      true,
    );
  },
);

test(
  'SafetyPermissionEngine aplica kill switch',
  () => {
    const engine =
      new SafetyPermissionEngine(
        createRegistry(),
      );

    engine.enableKillSwitch();

    const result =
      engine.authorize(
        'safe',
        {
          source:
            'autonomous',
        },
      );

    assert.equal(
      result.approved,
      false,
    );

    assert.equal(
      result.decision,
      'kill-switch',
    );

    engine.disableKillSwitch();

    const after =
      engine.authorize(
        'safe',
        {
          source:
            'autonomous',
        },
      );

    assert.equal(
      after.approved,
      true,
    );
  },
);

test(
  'SafetyPermissionEngine bloqueia origem explicitamente negada',
  () => {
    const engine =
      new SafetyPermissionEngine(
        createRegistry(),
      );

    engine.setPolicy({
      denySources: [
        'untrusted',
      ],
    });

    const result =
      engine.authorize(
        'safe',
        {
          source:
            'untrusted',
        },
      );

    assert.equal(
      result.approved,
      false,
    );

    assert.equal(
      result.decision,
      'permission-denied',
    );
  },
);

test(
  'SafetyPermissionEngine pode exigir allowlist de origem',
  () => {
    const engine =
      new SafetyPermissionEngine(
        createRegistry(),
      );

    engine.setPolicy({
      allowSources: [
        'administrator',
      ],
    });

    const denied =
      engine.authorize(
        'safe',
        {
          source:
            'autonomous',
        },
      );

    assert.equal(
      denied.approved,
      false,
    );

    const approved =
      engine.authorize(
        'safe',
        {
          source:
            'administrator',
        },
      );

    assert.equal(
      approved.approved,
      true,
    );
  },
);

test(
  'SafetyPermissionEngine aplica limite de execuções',
  async () => {
    const registry =
      createRegistry();

    const engine =
      new SafetyPermissionEngine(
        registry,
      );

    engine.setPolicy({
      maximumExecutionsPerWindow:
        2,
      executionWindowMs:
        60_000,
    });

    const first =
      await engine.execute(
        'safe',
        {},
        {
          source:
            'autonomous',
        },
      );

    const second =
      await engine.execute(
        'safe',
        {},
        {
          source:
            'autonomous',
        },
      );

    const third =
      await engine.execute(
        'safe',
        {},
        {
          source:
            'autonomous',
        },
      );

    assert.equal(
      first.success,
      true,
    );

    assert.equal(
      second.success,
      true,
    );

    assert.equal(
      third.success,
      false,
    );

    assert.match(
      third.error ?? '',
      /limite/i,
    );
  },
);

test(
  'SafetyPermissionEngine aplica orçamento',
  async () => {
    const engine =
      new SafetyPermissionEngine(
        createRegistry(),
      );

    engine.setPolicy({
      maximumBudgetPerWindow:
        10,
    });

    const first =
      await engine.execute(
        'safe',
        {},
        {
          source:
            'autonomous',
          budgetCost:
            6,
        },
      );

    const second =
      await engine.execute(
        'safe',
        {},
        {
          source:
            'autonomous',
          budgetCost:
            5,
        },
      );

    assert.equal(
      first.success,
      true,
    );

    assert.equal(
      second.success,
      false,
    );

    assert.match(
      second.error ?? '',
      /orçamento/i,
    );
  },
);

test(
  'SafetyPermissionEngine gera audit log',
  async () => {
    const engine =
      new SafetyPermissionEngine(
        createRegistry(),
      );

    await engine.execute(
      'safe',
      {},
      {
        source:
          'autonomous',
      },
    );

    const log =
      engine.getAuditLog();

    assert.equal(
      log.length,
      1,
    );

    assert.equal(
      log[0].toolName,
      'safe',
    );

    assert.equal(
      log[0].success,
      true,
    );

    assert.equal(
      log[0].source,
      'autonomous',
    );
  },
);

test(
  'SafetyPermissionEngine bloqueia ferramenta inexistente',
  () => {
    const engine =
      new SafetyPermissionEngine(
        createRegistry(),
      );

    const result =
      engine.authorize(
        'unknown',
        {
          source:
            'autonomous',
        },
      );

    assert.equal(
      result.approved,
      false,
    );

    assert.equal(
      result.decision,
      'denied',
    );
  },
);

test(
  'SafetyPermissionEngine pode ser desativado',
  () => {
    const engine =
      new SafetyPermissionEngine(
        createRegistry(),
      );

    engine.disable();

    const result =
      engine.authorize(
        'safe',
        {
          source:
            'autonomous',
        },
      );

    assert.equal(
      result.approved,
      false,
    );

    assert.match(
      result.reason,
      /desativado/i,
    );
  },
);

test(
  'SafetyPermissionEngine retorna status operacional',
  async () => {
    const engine =
      new SafetyPermissionEngine(
        createRegistry(),
      );

    await engine.execute(
      'safe',
      {},
      {
        source:
          'autonomous',
        budgetCost:
          3,
      },
    );

    const status =
      engine.getStatus();

    assert.equal(
      status.enabled,
      true,
    );

    assert.equal(
      status.killSwitchEnabled,
      false,
    );

    assert.equal(
      status.executionsInWindow,
      1,
    );

    assert.equal(
      status.budgetUsedInWindow,
      3,
    );

    assert.equal(
      status.auditEntries,
      1,
    );
  },
);