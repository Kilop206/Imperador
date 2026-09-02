import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AutonomousRuntimeControlService,
} from '../src/intelligence/autonomousRuntimeControlService';

import {
  AutonomousAgentOrchestrator,
} from '../src/intelligence/autonomousAgentOrchestrator';

import {
  SafetyPermissionEngine,
} from '../src/intelligence/safetyPermissionEngine';

import {
  ObservationEngine,
} from '../src/intelligence/observationEngine';

import {
  ToolRegistry,
} from '../src/intelligence/toolRegistry';

function createEnvironment() {
  const registry =
    new ToolRegistry();

  const safety =
    new SafetyPermissionEngine(
      registry,
    );

  const observations =
    new ObservationEngine();

  const orchestrator =
    new AutonomousAgentOrchestrator(
      safety,
      observations,
      {
        enabled:
          false,
        minimumCycleIntervalMs:
          0,
        maximumCyclesPerWindow:
          30,
        cycleWindowMs:
          60 * 60 * 1000,
      },
    );

  const control =
    new AutonomousRuntimeControlService(
      orchestrator,
      safety,
    );

  return {
    registry,
    safety,
    observations,
    orchestrator,
    control,
  };
}

test(
  'inicia o runtime autônomo',
  () => {
    const {
      control,
      orchestrator,
      safety,
    } =
      createEnvironment();

    assert.equal(
      orchestrator.isEnabled(),
      false,
    );

    assert.equal(
      safety.isKillSwitchEnabled(),
      false,
    );

    control.enable();

    assert.equal(
      orchestrator.isEnabled(),
      true,
    );

    assert.equal(
      safety.isKillSwitchEnabled(),
      false,
    );

    assert.equal(
      control.isEnabled(),
      true,
    );
  },
);

test(
  'desabilita somente o orquestrador',
  () => {
    const {
      control,
      orchestrator,
      safety,
    } =
      createEnvironment();

    control.enable();
    control.disable();

    assert.equal(
      orchestrator.isEnabled(),
      false,
    );

    assert.equal(
      safety.isKillSwitchEnabled(),
      false,
    );
  },
);

test(
  'kill switch desabilita o agente',
  () => {
    const {
      control,
      orchestrator,
      safety,
    } =
      createEnvironment();

    control.enable();

    control.enableKillSwitch();

    assert.equal(
      orchestrator.isEnabled(),
      false,
    );

    assert.equal(
      safety.isKillSwitchEnabled(),
      true,
    );

    assert.equal(
      control.isKillSwitchEnabled(),
      true,
    );
  },
);

test(
  'desativar kill switch não inicia automaticamente o agente',
  () => {
    const {
      control,
      orchestrator,
    } =
      createEnvironment();

    control.enable();

    control.enableKillSwitch();

    control.disableKillSwitch();

    assert.equal(
      orchestrator.isEnabled(),
      false,
    );

    assert.equal(
      control.isKillSwitchEnabled(),
      false,
    );
  },
);

test(
  'retorna estado combinado de runtime e segurança',
  () => {
    const {
      control,
    } =
      createEnvironment();

    const status =
      control.getStatus(
        1_000,
      );

    assert.equal(
      status.enabled,
      false,
    );

    assert.equal(
      status.killSwitchEnabled,
      false,
    );

    assert.equal(
      status.orchestrator.enabled,
      false,
    );

    assert.equal(
      status.safety.enabled,
      true,
    );

    assert.equal(
      status.safety.executionsInWindow,
      0,
    );

    assert.equal(
      status.safety.auditEntries,
      0,
    );
  },
);

test(
  'resetRuntimeState limpa os contadores operacionais',
  async () => {
    const {
      control,
      orchestrator,
      safety,
    } =
      createEnvironment();

    control.enable();

    const tick =
      await orchestrator.tick(
        1_000,
      );

    assert.equal(
      tick.decision,
      'idle',
    );

    assert.equal(
      orchestrator.getStatus()
        .cycleCount,
      1,
    );

    control.resetRuntimeState();

    const status =
      control.getStatus(
        2_000,
      );

    assert.equal(
      status.orchestrator
        .cycleCount,
      0,
    );

    assert.equal(
      status.safety
        .executionsInWindow,
      0,
    );

    assert.equal(
      status.safety
        .auditEntries,
      0,
    );
  },
);

test(
  'enable reativa segurança antes do agente',
  () => {
    const {
      control,
      orchestrator,
      safety,
    } =
      createEnvironment();

    safety.disable();

    control.enable();

    assert.equal(
      safety.getStatus().enabled,
      true,
    );

    assert.equal(
      orchestrator.isEnabled(),
      true,
    );
  },
);