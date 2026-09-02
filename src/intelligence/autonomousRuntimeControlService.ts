import {
  AutonomousAgentOrchestrator,
  AutonomousAgentOrchestratorStatus,
} from './autonomousAgentOrchestrator';

import {
  SafetyPermissionEngine,
  SafetyRuntimeStatus,
} from './safetyPermissionEngine';

export interface AutonomousRuntimeStatus {
  enabled: boolean;
  orchestrator:
    AutonomousAgentOrchestratorStatus;
  safety:
    SafetyRuntimeStatus;
  killSwitchEnabled: boolean;
}

export class AutonomousRuntimeControlService {
  private readonly orchestrator:
    AutonomousAgentOrchestrator;

  private readonly safety:
    SafetyPermissionEngine;

  public constructor(
    orchestrator:
      AutonomousAgentOrchestrator,
    safety:
      SafetyPermissionEngine,
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

    this.orchestrator =
      orchestrator;

    this.safety =
      safety;
  }

  public enable(): void {
    this.safety.enable();
    this.safety.disableKillSwitch();
    this.orchestrator.setEnabled(
      true,
    );
  }

  public disable(): void {
    this.orchestrator.setEnabled(
      false,
    );
  }

  public enableKillSwitch(): void {
    this.safety.enableKillSwitch();
    this.orchestrator.setEnabled(
      false,
    );
  }

  public disableKillSwitch(): void {
    this.safety.disableKillSwitch();
  }

  public isEnabled(): boolean {
    return (
      this.orchestrator.isEnabled()
    );
  }

  public isKillSwitchEnabled(): boolean {
    return this.safety.isKillSwitchEnabled();
  }

  public resetRuntimeState(): void {
    this.orchestrator.resetRuntimeState();
    this.safety.resetRuntimeState();
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
    };
  }
}