import {
  GoalEngine,
} from './goalEngine';

import {
  ObservationEngine,
} from './observationEngine';

import {
  SelfEvaluationEngine,
} from './selfEvaluationEngine';

import {
  ModeManager,
} from '../services/modeManager';

import {
  AIRuntimeService,
} from './aiRuntimeService';

import {
  ToolRegistry,
} from './toolRegistry';

export interface AutonomousToolCatalogOptions {
  observationEngine: ObservationEngine;
}

export class AutonomousToolCatalog {
  private readonly registry:
    ToolRegistry;

  private readonly observations:
    ObservationEngine;

  public constructor(
    registry: ToolRegistry,
    options:
      AutonomousToolCatalogOptions,
  ) {
    if (!registry) {
      throw new TypeError(
        'ToolRegistry é obrigatório.',
      );
    }

    if (
      !options ||
      !options.observationEngine
    ) {
      throw new TypeError(
        'ObservationEngine é obrigatório.',
      );
    }

    this.registry =
      registry;

    this.observations =
      options.observationEngine;
  }

  public registerDefaults(): void {
    this.registerSystemHealth();
    this.registerActiveGoals();
    this.registerRecentObservations();
  }

  public registerSystemHealth(): void {
    if (
      this.registry.has(
        'system_health',
      )
    ) {
      return;
    }

    this.registry.register({
      name:
        'system_health',
      description:
        'Consulta o estado operacional atual do Imperador e suas métricas internas.',
      riskLevel:
        'low',
      parameters: [],
      execute: () => ({
        mode:
          ModeManager.getMode(),
        ai:
          AIRuntimeService.getStatus(),
        evaluation:
          SelfEvaluationEngine.getAggregateMetrics(),
      }),
      enabled:
        true,
      timeoutMs:
        5_000,
    });
  }

  public registerActiveGoals(): void {
    if (
      this.registry.has(
        'active_goals',
      )
    ) {
      return;
    }

    this.registry.register({
      name:
        'active_goals',
      description:
        'Lista os objetivos autônomos atualmente ativos ou pendentes.',
      riskLevel:
        'low',
      parameters: [],
      execute: () => ({
        goals:
          GoalEngine.getActiveGoals(),
      }),
      enabled:
        true,
      timeoutMs:
        5_000,
    });
  }

  public registerRecentObservations(): void {
    if (
      this.registry.has(
        'recent_observations',
      )
    ) {
      return;
    }

    this.registry.register({
      name:
        'recent_observations',
      description:
        'Consulta observações recentes produzidas pelo sistema, ferramentas e agente.',
      riskLevel:
        'low',
      parameters: [
        {
          name:
            'limit',
          description:
            'Quantidade máxima de observações retornadas.',
          type:
            'number',
          required:
            false,
          defaultValue:
            10,
        },
      ],
      execute: parameters => {
        const rawLimit =
          parameters.limit;

        const limit =
          typeof rawLimit ===
          'number'
            ? Math.min(
                Math.max(
                  1,
                  Math.floor(
                    rawLimit,
                  ),
                ),
                50,
              )
            : 10;

        return {
          observations:
            this.observations.getRecent(
              limit,
            ),
        };
      },
      enabled:
        true,
      timeoutMs:
        5_000,
    });
  }

  public getRegistry():
    ToolRegistry {
    return this.registry;
  }

  public getRegisteredTools() {
    return this.registry.list();
  }
}