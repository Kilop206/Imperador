import {
  AutonomousAgentOrchestrator,
  AutonomousAgentOrchestratorStatus,
} from './autonomousAgentOrchestrator';

import {
  SafetyPermissionEngine,
  SafetyRuntimeStatus,
} from './safetyPermissionEngine';

import {
  AutonomousRuntimeAuditService,
  AutonomousRuntimeAuditEvent,
} from './autonomousRuntimeAuditService';

export interface AutonomousRuntimeStatus {
  enabled: boolean;

  orchestrator:
    AutonomousAgentOrchestratorStatus;

  safety:
    SafetyRuntimeStatus;

  killSwitchEnabled: boolean;

  auditEntries: number;
}

export class AutonomousRuntimeControlService {
  private readonly orchestrator:
    AutonomousAgentOrchestrator;

  private readonly safety:
    SafetyPermissionEngine;

  private readonly audit:
    AutonomousRuntimeAuditService;

  public constructor(
    orchestrator:
      AutonomousAgentOrchestrator,
    safety:
      SafetyPermissionEngine,
    audit:
      AutonomousRuntimeAuditService,
  ) {
    if (!orchestrator) {
      throw new TypeError(
        'AutonomousAgentOrchestrator é obrigatório.',
      );
    }

    if (!safety) {
      throw new TypeError(
        'SafetyPermissionEngine é obrigatório.',
      );
    }

    if (!audit) {
      throw new TypeError(
        'AutonomousRuntimeAuditService é obrigatório.',
      );
    }

    this.orchestrator =
      orchestrator;

    this.safety =
      safety;

    this.audit =
      audit;

    this.audit.initialize();
  }

  public enable(
    actor?: string,
  ): void {
    this.safety.enable();

    this.safety.disableKillSwitch();

    this.orchestrator.setEnabled(
      true,
    );

    this.audit.record(
      'runtime_enabled',
      'runtime-control',
      {
        actor,
        details: {
          safetyEnabled:
            true,
          killSwitchEnabled:
            false,
          orchestratorEnabled:
            true,
        },
      },
    );
  }

  public disable(
    actor?: string,
  ): void {
    this.orchestrator.setEnabled(
      false,
    );

    this.audit.record(
      'runtime_disabled',
      'runtime-control',
      {
        actor,
        details: {
          safetyEnabled:
            this.safety.getStatus()
              .enabled,
          killSwitchEnabled:
            this.safety.isKillSwitchEnabled(),
          orchestratorEnabled:
            false,
        },
      },
    );
  }

  public enableKillSwitch(
    actor?: string,
  ): void {
    this.safety.enableKillSwitch();

    this.orchestrator.setEnabled(
      false,
    );

    this.audit.record(
      'kill_switch_enabled',
      'runtime-control',
      {
        actor,
        details: {
          killSwitchEnabled:
            true,
          orchestratorEnabled:
            false,
        },
      },
    );
  }

  public disableKillSwitch(
    actor?: string,
  ): void {
    this.safety.disableKillSwitch();

    this.audit.record(
      'kill_switch_disabled',
      'runtime-control',
      {
        actor,
        details: {
          killSwitchEnabled:
            false,
          orchestratorEnabled:
            this.orchestrator.isEnabled(),
        },
      },
    );
  }

  public markRuntimeStarted(
    actor = 'system',
  ): void {
    this.audit.record(
      'runtime_started',
      'system',
      {
        actor,
        details: {
          orchestratorEnabled:
            this.orchestrator.isEnabled(),
          killSwitchEnabled:
            this.safety.isKillSwitchEnabled(),
        },
      },
    );
  }

  public markRuntimeShutdown(
    actor = 'system',
  ): void {
    this.audit.record(
      'runtime_shutdown',
      'system',
      {
        actor,
        details: {
          orchestratorEnabled:
            this.orchestrator.isEnabled(),
          killSwitchEnabled:
            this.safety.isKillSwitchEnabled(),
        },
      },
    );
  }

  public isEnabled(): boolean {
    return (
      this.orchestrator.isEnabled()
    );
  }

  public isKillSwitchEnabled(): boolean {
    return this.safety.isKillSwitchEnabled();
  }

  public resetRuntimeState(
    actor?: string,
  ): void {
    this.orchestrator.resetRuntimeState();

    this.safety.resetRuntimeState();

    this.audit.record(
      'runtime_reset',
      'runtime-control',
      {
        actor,
        details: {
          orchestratorReset:
            true,
          safetyReset:
            true,
        },
      },
    );
  }

  public getAuditEntries():
    AutonomousRuntimeAuditEvent[] {
    return this.audit.getAll();
  }

  public getRecentAuditEntries(
    limit = 20,
  ): AutonomousRuntimeAuditEvent[] {
    return this.audit.getRecent(
      limit,
    );
  }

  public getStatus(
    currentTime = Date.now(),
  ): AutonomousRuntimeStatus {
    return {
      enabled:
        this.orchestrator.isEnabled(),

      orchestrator:
        this.orchestrator.getStatus(),

      safety:
        this.safety.getStatus(
          currentTime,
        ),

      killSwitchEnabled:
        this.safety.isKillSwitchEnabled(),

      auditEntries:
        this.audit.getCount(),
    };
  }
}