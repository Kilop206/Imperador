import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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

import {
  AutonomousRuntimeAuditService,
} from '../src/intelligence/autonomousRuntimeAuditService';

function createEnvironment() {
  const directory =
    fs.mkdtempSync(
      path.join(
        os.tmpdir(),
        'imperador-runtime-control-',
      ),
    );

  const storagePath =
    path.join(
      directory,
      'runtime-audit.json',
    );

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

  const audit =
    new AutonomousRuntimeAuditService({
      storageFilePath:
        storagePath,
      maximumEntries:
        100,
    });

  const control =
    new AutonomousRuntimeControlService(
      orchestrator,
      safety,
      audit,
    );

  return {
    directory,
    storagePath,
    registry,
    safety,
    observations,
    orchestrator,
    audit,
    control,
  };
}

function cleanup(
  directory: string,
): void {
  try {
    fs.rmSync(
      directory,
      {
        recursive:
          true,
        force:
          true,
      },
    );
  } catch {
    // Ignora erros.
  }
}

test(
  'registra habilitação do runtime',
  () => {
    const {
      directory,
      control,
      audit,
      orchestrator,
    } =
      createEnvironment();

    try {
      control.enable(
        'admin-123',
      );

      assert.equal(
        orchestrator.isEnabled(),
        true,
      );

      const entries =
        audit.getAll();

      assert.equal(
        entries.length,
        1,
      );

      assert.equal(
        entries[0].type,
        'runtime_enabled',
      );

      assert.equal(
        entries[0].actor,
        'admin-123',
      );

      assert.equal(
        entries[0].source,
        'runtime-control',
      );
    } finally {
      cleanup(
        directory,
      );
    }
  },
);

test(
  'registra desligamento do runtime',
  () => {
    const {
      directory,
      control,
      audit,
      orchestrator,
    } =
      createEnvironment();

    try {
      control.enable();

      control.disable(
        'admin-456',
      );

      assert.equal(
        orchestrator.isEnabled(),
        false,
      );

      const entries =
        audit.getAll();

      assert.equal(
        entries.length,
        2,
      );

      assert.equal(
        entries[1].type,
        'runtime_disabled',
      );

      assert.equal(
        entries[1].actor,
        'admin-456',
      );
    } finally {
      cleanup(
        directory,
      );
    }
  },
);

test(
  'kill switch desabilita o agente e registra evento',
  () => {
    const {
      directory,
      control,
      audit,
      orchestrator,
      safety,
    } =
      createEnvironment();

    try {
      control.enable();

      control.enableKillSwitch(
        'admin-kill',
      );

      assert.equal(
        orchestrator.isEnabled(),
        false,
      );

      assert.equal(
        safety.isKillSwitchEnabled(),
        true,
      );

      const entries =
        audit.getAll();

      assert.equal(
        entries.length,
        2,
      );

      assert.equal(
        entries[1].type,
        'kill_switch_enabled',
      );

      assert.equal(
        entries[1].actor,
        'admin-kill',
      );
    } finally {
      cleanup(
        directory,
      );
    }
  },
);

test(
  'não permite religar o agente enquanto o kill switch estiver ativo',
  () => {
    const {
      directory,
      control,
      audit,
      orchestrator,
      safety,
    } =
      createEnvironment();

    try {
      control.enable(
        'admin-start',
      );

      control.enableKillSwitch(
        'admin-kill',
      );

      assert.throws(
        () =>
          control.enable(
            'admin-bypass',
          ),
        /kill switch estiver ativo/,
      );

      assert.equal(
        safety.isKillSwitchEnabled(),
        true,
      );

      assert.equal(
        orchestrator.isEnabled(),
        false,
      );

      const entries =
        audit.getAll();

      assert.equal(
        entries.length,
        2,
      );

      assert.equal(
        entries[0].type,
        'runtime_enabled',
      );

      assert.equal(
        entries[1].type,
        'kill_switch_enabled',
      );
    } finally {
      cleanup(
        directory,
      );
    }
  },
);

test(
  'remover kill switch não religa o agente',
  () => {
    const {
      directory,
      control,
      audit,
      orchestrator,
      safety,
    } =
      createEnvironment();

    try {
      control.enable();

      control.enableKillSwitch();

      control.disableKillSwitch(
        'admin-unkill',
      );

      assert.equal(
        safety.isKillSwitchEnabled(),
        false,
      );

      assert.equal(
        orchestrator.isEnabled(),
        false,
      );

      const entries =
        audit.getAll();

      assert.equal(
        entries.length,
        3,
      );

      assert.equal(
        entries[2].type,
        'kill_switch_disabled',
      );

      assert.equal(
        entries[2].actor,
        'admin-unkill',
      );
    } finally {
      cleanup(
        directory,
      );
    }
  },
);

test(
  'registra início e encerramento do runtime',
  () => {
    const {
      directory,
      control,
      audit,
    } =
      createEnvironment();

    try {
      control.markRuntimeStarted();

      control.markRuntimeShutdown();

      const entries =
        audit.getAll();

      assert.equal(
        entries.length,
        2,
      );

      assert.equal(
        entries[0].type,
        'runtime_started',
      );

      assert.equal(
        entries[1].type,
        'runtime_shutdown',
      );
    } finally {
      cleanup(
        directory,
      );
    }
  },
);

test(
  'persiste eventos através de nova instância',
  () => {
    const {
      directory,
      storagePath,
      control,
    } =
      createEnvironment();

    try {
      control.enable(
        'administrator',
      );

      const reloadedAudit =
        new AutonomousRuntimeAuditService({
          storageFilePath:
            storagePath,
        });

      reloadedAudit.initialize();

      const entries =
        reloadedAudit.getAll();

      assert.equal(
        entries.length,
        1,
      );

      assert.equal(
        entries[0].type,
        'runtime_enabled',
      );

      assert.equal(
        entries[0].actor,
        'administrator',
      );
    } finally {
      cleanup(
        directory,
      );
    }
  },
);

test(
  'expõe status com quantidade de auditoria',
  () => {
    const {
      directory,
      control,
    } =
      createEnvironment();

    try {
      let status =
        control.getStatus(
          1_000,
        );

      assert.equal(
        status.enabled,
        false,
      );

      assert.equal(
        status.auditEntries,
        0,
      );

      control.enable(
        'administrator',
      );

      status =
        control.getStatus(
          2_000,
        );

      assert.equal(
        status.enabled,
        true,
      );

      assert.equal(
        status.auditEntries,
        1,
      );
    } finally {
      cleanup(
        directory,
      );
    }
  },
);

test(
  'resetRuntimeState limpa runtime e mantém audit trail',
  () => {
    const {
      directory,
      control,
      orchestrator,
      safety,
      audit,
    } =
      createEnvironment();

    try {
      control.enable(
        'administrator',
      );

      control.resetRuntimeState(
        'administrator',
      );

      assert.equal(
        orchestrator.getStatus()
          .cycleCount,
        0,
      );

      assert.equal(
        safety.getStatus()
          .auditEntries,
        0,
      );

      const entries =
        audit.getAll();

      assert.equal(
        entries.length,
        2,
      );

      assert.equal(
        entries[1].type,
        'runtime_reset',
      );
    } finally {
      cleanup(
        directory,
      );
    }
  },
);

test(
  'permite consultar eventos recentes',
  () => {
    const {
      directory,
      control,
    } =
      createEnvironment();

    try {
      control.markRuntimeStarted();
      control.enable();
      control.disable();
      control.markRuntimeShutdown();

      const recent =
        control.getRecentAuditEntries(
          2,
        );

      assert.equal(
        recent.length,
        2,
      );

      assert.equal(
        recent[0].type,
        'runtime_disabled',
      );

      assert.equal(
        recent[1].type,
        'runtime_shutdown',
      );
    } finally {
      cleanup(
        directory,
      );
    }
  },
);