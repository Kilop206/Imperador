import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  ToolRegistry,
} from '../src/intelligence/toolRegistry';

import {
  AutonomousRuntimeAuditService,
} from '../src/intelligence/autonomousRuntimeAuditService';

import {
  AutonomousRuntimeAuditTool,
} from '../src/intelligence/autonomousRuntimeAuditTool';

function createEnvironment() {
  const directory =
    fs.mkdtempSync(
      path.join(
        os.tmpdir(),
        'imperador-runtime-audit-tool-',
      ),
    );

  const storagePath =
    path.join(
      directory,
      'audit.json',
    );

  const registry =
    new ToolRegistry();

  const audit =
    new AutonomousRuntimeAuditService({
      storageFilePath:
        storagePath,
    });

  audit.initialize();

  const tool =
    new AutonomousRuntimeAuditTool(
      registry,
      {
        auditService:
          audit,
      },
    );

  return {
    directory,
    storagePath,
    registry,
    audit,
    tool,
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
    // Ignora erros de limpeza.
  }
}

test(
  'registra runtime_audit como ferramenta de baixo risco',
  () => {
    const {
      directory,
      registry,
      tool,
    } =
      createEnvironment();

    try {
      tool.register();

      const definition =
        registry.get(
          'runtime_audit',
        );

      assert.ok(
        definition,
      );

      assert.equal(
        definition?.riskLevel,
        'low',
      );

      assert.equal(
        definition?.enabled,
        true,
      );

      assert.equal(
        tool.isRegistered(),
        true,
      );
    } finally {
      cleanup(
        directory,
      );
    }
  },
);

test(
  'não substitui uma ferramenta runtime_audit existente',
  () => {
    const {
      directory,
      registry,
      tool,
    } =
      createEnvironment();

    try {
      const customResult = {
        custom:
          true,
      };

      registry.register({
        name:
          'runtime_audit',
        description:
          'Implementação customizada.',
        riskLevel:
          'low',
        parameters: [],
        execute: () =>
          customResult,
      });

      tool.register();

      assert.equal(
        registry.getToolCount(),
        1,
      );

      return registry
        .execute(
          'runtime_audit',
          {},
        )
        .then(result => {
          assert.equal(
            result.success,
            true,
          );

          assert.deepEqual(
            result.result,
            customResult,
          );
        });
    } finally {
      cleanup(
        directory,
      );
    }
  },
);

test(
  'retorna os eventos recentes',
  async () => {
    const {
      directory,
      registry,
      audit,
      tool,
    } =
      createEnvironment();

    try {
      audit.record(
        'runtime_started',
        'system',
        {
          timestamp:
            1_000,
        },
      );

      audit.record(
        'runtime_enabled',
        'discord-command',
        {
          actor:
            'administrator',
          timestamp:
            2_000,
        },
      );

      audit.record(
        'runtime_disabled',
        'discord-command',
        {
          actor:
            'administrator',
          timestamp:
            3_000,
        },
      );

      tool.register();

      const result =
        await registry.execute(
          'runtime_audit',
          {
            limit:
              2,
          },
        );

      assert.equal(
        result.success,
        true,
      );

      const payload =
        result.result as {
          events: Array<{
            type: string;
            timestamp: number;
          }>;
        };

      assert.equal(
        payload.events.length,
        2,
      );

      assert.equal(
        payload.events[0].type,
        'runtime_enabled',
      );

      assert.equal(
        payload.events[1].type,
        'runtime_disabled',
      );
    } finally {
      cleanup(
        directory,
      );
    }
  },
);

test(
  'limita o número máximo de eventos',
  async () => {
    const {
      directory,
      registry,
      audit,
      tool,
    } =
      createEnvironment();

    try {
      for (
        let index = 0;
        index < 100;
        index += 1
      ) {
        audit.record(
          'runtime_started',
          'system',
          {
            timestamp:
              index,
          },
        );
      }

      tool.register();

      const result =
        await registry.execute(
          'runtime_audit',
          {
            limit:
              10_000,
          },
        );

      assert.equal(
        result.success,
        true,
      );

      const payload =
        result.result as {
          events: unknown[];
        };

      assert.equal(
        payload.events.length,
        50,
      );
    } finally {
      cleanup(
        directory,
      );
    }
  },
);

test(
  'filtra por tipo de evento',
  async () => {
    const {
      directory,
      registry,
      audit,
      tool,
    } =
      createEnvironment();

    try {
      audit.record(
        'runtime_started',
        'system',
      );

      audit.record(
        'runtime_enabled',
        'discord-command',
      );

      audit.record(
        'runtime_disabled',
        'discord-command',
      );

      audit.record(
        'runtime_enabled',
        'discord-command',
      );

      tool.register();

      const result =
        await registry.execute(
          'runtime_audit',
          {
            type:
              'runtime_enabled',
            limit:
              10,
          },
        );

      assert.equal(
        result.success,
        true,
      );

      const payload =
        result.result as {
          events: Array<{
            type: string;
          }>;
        };

      assert.equal(
        payload.events.length,
        2,
      );

      assert.equal(
        payload.events.every(
          event =>
            event.type ===
            'runtime_enabled',
        ),
        true,
      );
    } finally {
      cleanup(
        directory,
      );
    }
  },
);

test(
  'rejeita tipo de evento inválido',
  async () => {
    const {
      directory,
      registry,
      tool,
    } =
      createEnvironment();

    try {
      tool.register();

      const result =
        await registry.execute(
          'runtime_audit',
          {
            type:
              'invalid-event',
          },
        );

      assert.equal(
        result.success,
        false,
      );

      assert.match(
        result.error ?? '',
        /Tipo de evento de auditoria inválido/,
      );
    } finally {
      cleanup(
        directory,
      );
    }
  },
);

test(
  'usa limite padrão quando nenhum limite é informado',
  async () => {
    const {
      directory,
      registry,
      audit,
      tool,
    } =
      createEnvironment();

    try {
      for (
        let index = 0;
        index < 30;
        index += 1
      ) {
        audit.record(
          'runtime_started',
          'system',
          {
            timestamp:
              index,
          },
        );
      }

      tool.register();

      const result =
        await registry.execute(
          'runtime_audit',
          {},
        );

      assert.equal(
        result.success,
        true,
      );

      const payload =
        result.result as {
          events: unknown[];
        };

      assert.equal(
        payload.events.length,
        20,
      );
    } finally {
      cleanup(
        directory,
      );
    }
  },
);

test(
  'rejeita dependência ausente',
  () => {
    const registry =
      new ToolRegistry();

    assert.throws(
      () =>
        new AutonomousRuntimeAuditTool(
          registry,
          {} as {
            auditService:
              AutonomousRuntimeAuditService;
          },
        ),
      /AutonomousRuntimeAuditService/,
    );
  },
);