import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  AutonomousRuntimeAuditService,
} from '../src/intelligence/autonomousRuntimeAuditService';

function createTemporaryStoragePath(): string {
  const directory =
    fs.mkdtempSync(
      path.join(
        os.tmpdir(),
        'imperador-runtime-audit-',
      ),
    );

  return path.join(
    directory,
    'audit.json',
  );
}

function cleanup(
  storagePath: string,
): void {
  try {
    fs.rmSync(
      path.dirname(
        storagePath,
      ),
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
  'cria arquivo de auditoria e inicializa vazio',
  () => {
    const storagePath =
      createTemporaryStoragePath();

    try {
      const service =
        new AutonomousRuntimeAuditService({
          storageFilePath:
            storagePath,
        });

      service.initialize();

      assert.equal(
        service.getCount(),
        0,
      );

      assert.equal(
        fs.existsSync(
          storagePath,
        ),
        true,
      );
    } finally {
      cleanup(
        storagePath,
      );
    }
  },
);

test(
  'persiste eventos e consegue carregá-los novamente',
  () => {
    const storagePath =
      createTemporaryStoragePath();

    try {
      const first =
        new AutonomousRuntimeAuditService({
          storageFilePath:
            storagePath,
        });

      first.record(
        'runtime_enabled',
        'discord-command',
        {
          actor:
            'administrator',
          timestamp:
            1_000,
          details: {
            command:
              '!autonomia on',
          },
        },
      );

      first.record(
        'kill_switch_enabled',
        'discord-command',
        {
          actor:
            'administrator',
          timestamp:
            2_000,
        },
      );

      const second =
        new AutonomousRuntimeAuditService({
          storageFilePath:
            storagePath,
        });

      second.initialize();

      const entries =
        second.getAll();

      assert.equal(
        entries.length,
        2,
      );

      assert.equal(
        entries[0].type,
        'runtime_enabled',
      );

      assert.equal(
        entries[0].actor,
        'administrator',
      );

      assert.equal(
        entries[1].type,
        'kill_switch_enabled',
      );
    } finally {
      cleanup(
        storagePath,
      );
    }
  },
);

test(
  'limita o histórico ao máximo configurado',
  () => {
    const storagePath =
      createTemporaryStoragePath();

    try {
      const service =
        new AutonomousRuntimeAuditService({
          storageFilePath:
            storagePath,
          maximumEntries:
            3,
        });

      service.initialize();

      service.record(
        'runtime_started',
        'system',
        {
          timestamp:
            1,
        },
      );

      service.record(
        'runtime_enabled',
        'system',
        {
          timestamp:
            2,
        },
      );

      service.record(
        'runtime_disabled',
        'system',
        {
          timestamp:
            3,
        },
      );

      service.record(
        'runtime_started',
        'system',
        {
          timestamp:
            4,
        },
      );

      const entries =
        service.getAll();

      assert.equal(
        entries.length,
        3,
      );

      assert.equal(
        entries[0].timestamp,
        2,
      );

      assert.equal(
        entries[2].timestamp,
        4,
      );
    } finally {
      cleanup(
        storagePath,
      );
    }
  },
);

test(
  'getRecent retorna somente a quantidade solicitada',
  () => {
    const storagePath =
      createTemporaryStoragePath();

    try {
      const service =
        new AutonomousRuntimeAuditService({
          storageFilePath:
            storagePath,
        });

      service.record(
        'runtime_started',
        'system',
        {
          timestamp:
            1,
        },
      );

      service.record(
        'runtime_enabled',
        'system',
        {
          timestamp:
            2,
        },
      );

      service.record(
        'runtime_disabled',
        'system',
        {
          timestamp:
            3,
        },
      );

      const recent =
        service.getRecent(
          2,
        );

      assert.equal(
        recent.length,
        2,
      );

      assert.equal(
        recent[0].timestamp,
        2,
      );

      assert.equal(
        recent[1].timestamp,
        3,
      );
    } finally {
      cleanup(
        storagePath,
      );
    }
  },
);

test(
  'getByType filtra corretamente',
  () => {
    const storagePath =
      createTemporaryStoragePath();

    try {
      const service =
        new AutonomousRuntimeAuditService({
          storageFilePath:
            storagePath,
        });

      service.record(
        'runtime_enabled',
        'system',
      );

      service.record(
        'kill_switch_enabled',
        'system',
      );

      service.record(
        'runtime_enabled',
        'discord-command',
      );

      const entries =
        service.getByType(
          'runtime_enabled',
        );

      assert.equal(
        entries.length,
        2,
      );
    } finally {
      cleanup(
        storagePath,
      );
    }
  },
);

test(
  'sanitiza detalhes profundos',
  () => {
    const storagePath =
      createTemporaryStoragePath();

    try {
      const service =
        new AutonomousRuntimeAuditService({
          storageFilePath:
            storagePath,
        });

      const event =
        service.record(
          'runtime_reset',
          'system',
          {
            details: {
              normal:
                'ok',
              nested: {
                level1: {
                  level2: {
                    level3: {
                      level4:
                        'blocked',
                    },
                  },
                },
              },
            },
          },
        );

      const details =
        event.details as {
          normal: string;
          nested: {
            level1: {
              level2: {
                level3: string;
              };
            };
          };
        };

      assert.equal(
        details.normal,
        'ok',
      );

      assert.equal(
        details.nested
          .level1
          .level2
          .level3,
        '[depth-limit]',
      );
    } finally {
      cleanup(
        storagePath,
      );
    }
  },
);

test(
  'clear remove todos os eventos persistidos',
  () => {
    const storagePath =
      createTemporaryStoragePath();

    try {
      const service =
        new AutonomousRuntimeAuditService({
          storageFilePath:
            storagePath,
        });

      service.record(
        'runtime_started',
        'system',
      );

      assert.equal(
        service.getCount(),
        1,
      );

      service.clear();

      assert.equal(
        service.getCount(),
        0,
      );

      const reloaded =
        new AutonomousRuntimeAuditService({
          storageFilePath:
            storagePath,
        });

      reloaded.initialize();

      assert.equal(
        reloaded.getCount(),
        0,
      );
    } finally {
      cleanup(
        storagePath,
      );
    }
  },
);

test(
  'rejeita storage path inválido',
  () => {
    assert.throws(
      () =>
        new AutonomousRuntimeAuditService({
          storageFilePath:
            '',
        }),
      /storageFilePath/,
    );
  },
);

test(
  'rejeita maximumEntries inválido',
  () => {
    assert.throws(
      () =>
        new AutonomousRuntimeAuditService({
          maximumEntries:
            0,
        }),
      /maximumEntries/,
    );
  },
);

test(
  'rejeita arquivo persistido com formato inválido',
  () => {
    const storagePath =
      createTemporaryStoragePath();

    try {
      fs.mkdirSync(
        path.dirname(
          storagePath,
        ),
        {
          recursive:
            true,
        },
      );

      fs.writeFileSync(
        storagePath,
        JSON.stringify({
          version:
            999,
          entries: [],
        }),
        'utf8',
      );

      const service =
        new AutonomousRuntimeAuditService({
          storageFilePath:
            storagePath,
        });

      assert.throws(
        () =>
          service.initialize(),
        /Formato do arquivo de auditoria inválido/,
      );
    } finally {
      cleanup(
        storagePath,
      );
    }
  },
);