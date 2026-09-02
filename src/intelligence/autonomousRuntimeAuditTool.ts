import {
  ToolRegistry,
} from './toolRegistry';

import {
  AutonomousRuntimeAuditService,
  AutonomousRuntimeAuditEventType,
} from './autonomousRuntimeAuditService';

const AUDIT_EVENT_TYPES:
  AutonomousRuntimeAuditEventType[] = [
    'runtime_enabled',
    'runtime_disabled',
    'kill_switch_enabled',
    'kill_switch_disabled',
    'runtime_started',
    'runtime_shutdown',
    'runtime_reset',
  ];

export interface AutonomousRuntimeAuditToolOptions {
  auditService:
    AutonomousRuntimeAuditService;
}

export class AutonomousRuntimeAuditTool {
  private readonly registry:
    ToolRegistry;

  private readonly audit:
    AutonomousRuntimeAuditService;

  public constructor(
    registry: ToolRegistry,
    options:
      AutonomousRuntimeAuditToolOptions,
  ) {
    if (!registry) {
      throw new TypeError(
        'ToolRegistry é obrigatório.',
      );
    }

    if (
      !options ||
      !options.auditService
    ) {
      throw new TypeError(
        'AutonomousRuntimeAuditService é obrigatório.',
      );
    }

    this.registry =
      registry;

    this.audit =
      options.auditService;
  }

  public register(): void {
    if (
      this.registry.has(
        'runtime_audit',
      )
    ) {
      return;
    }

    this.registry.register({
      name:
        'runtime_audit',

      description:
        'Consulta o histórico administrativo do runtime autônomo.',

      riskLevel:
        'low',

      parameters: [
        {
          name:
            'limit',
          description:
            'Quantidade máxima de eventos retornados.',
          type:
            'number',
          required:
            false,
          defaultValue:
            20,
        },

        {
          name:
            'type',
          description:
            'Filtra os eventos por tipo.',
          type:
            'string',
          required:
            false,
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
            : 20;

        const rawType =
          parameters.type;

        const type =
          typeof rawType ===
          'string'
            ? rawType.trim()
            : '';

        if (
          type.length > 0
        ) {
          if (
            !AUDIT_EVENT_TYPES.includes(
              type as
                AutonomousRuntimeAuditEventType,
            )
          ) {
            throw new Error(
              `Tipo de evento de auditoria inválido: "${type}".`,
            );
          }

          return {
            events:
              this.audit
                .getByType(
                  type as
                    AutonomousRuntimeAuditEventType,
                )
                .slice(
                  -limit,
                ),
          };
        }

        return {
          events:
            this.audit.getRecent(
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

  public isRegistered(): boolean {
    return this.registry.has(
      'runtime_audit',
    );
  }
}