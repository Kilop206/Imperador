import fs from 'node:fs';
import path from 'node:path';

export type AutonomousRuntimeAuditEventType =
  | 'runtime_enabled'
  | 'runtime_disabled'
  | 'kill_switch_enabled'
  | 'kill_switch_disabled'
  | 'runtime_started'
  | 'runtime_shutdown'
  | 'runtime_reset';

export interface AutonomousRuntimeAuditEvent {
  id: string;
  type: AutonomousRuntimeAuditEventType;
  timestamp: number;
  source: string;
  actor?: string;
  details?: Record<string, unknown>;
}

export interface AutonomousRuntimeAuditOptions {
  storageFilePath?: string;
  maximumEntries?: number;
}

interface PersistedAuditData {
  version: 1;
  entries: AutonomousRuntimeAuditEvent[];
}

const DEFAULT_STORAGE_FILE =
  path.join(
    process.cwd(),
    'data',
    'autonomous-runtime-audit.json',
  );

const DEFAULT_MAXIMUM_ENTRIES =
  1000;

export class AutonomousRuntimeAuditService {
  private readonly storageFilePath:
    string;

  private readonly maximumEntries:
    number;

  private entries:
    AutonomousRuntimeAuditEvent[] = [];

  private initialized =
    false;

  public constructor(
    options:
      AutonomousRuntimeAuditOptions = {},
  ) {
    const storageFilePath =
      options.storageFilePath ??
      DEFAULT_STORAGE_FILE;

    const maximumEntries =
      options.maximumEntries ??
      DEFAULT_MAXIMUM_ENTRIES;

    if (
      typeof storageFilePath !==
        'string' ||
      storageFilePath.trim().length ===
        0
    ) {
      throw new TypeError(
        'storageFilePath deve ser uma string não vazia.',
      );
    }

    if (
      !Number.isFinite(
        maximumEntries,
      ) ||
      maximumEntries <= 0
    ) {
      throw new RangeError(
        'maximumEntries deve ser maior que zero.',
      );
    }

    this.storageFilePath =
      path.resolve(
        storageFilePath,
      );

    this.maximumEntries =
      Math.floor(
        maximumEntries,
      );
  }

  public initialize(): void {
    if (
      this.initialized
    ) {
      return;
    }

    this.ensureParentDirectory();

    if (
      !fs.existsSync(
        this.storageFilePath,
      )
    ) {
      this.entries = [];

      this.persist();

      this.initialized =
        true;

      return;
    }

    try {
      const raw =
        fs.readFileSync(
          this.storageFilePath,
          'utf8',
        );

      const parsed:
        unknown =
        JSON.parse(
          raw,
        );

      if (
        !this.isPersistedAuditData(
          parsed,
        )
      ) {
        throw new Error(
          'Formato do arquivo de auditoria inválido.',
        );
      }

      this.entries =
        parsed.entries
          .slice(
            -this.maximumEntries,
          );

      this.initialized =
        true;
    } catch (error) {
      throw new Error(
        `Não foi possível inicializar o audit trail autônomo: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`,
      );
    }
  }

  public record(
    type:
      AutonomousRuntimeAuditEventType,
    source: string,
    options: {
      actor?: string;
      timestamp?: number;
      details?: Record<string, unknown>;
    } = {},
  ): AutonomousRuntimeAuditEvent {
    this.ensureInitialized();

    const normalizedSource =
      source.trim();

    if (
      normalizedSource.length ===
      0
    ) {
      throw new TypeError(
        'source deve ser uma string não vazia.',
      );
    }

    const timestamp =
      options.timestamp ??
      Date.now();

    if (
      !Number.isFinite(
        timestamp,
      )
    ) {
      throw new RangeError(
        'timestamp deve ser um número finito.',
      );
    }

    const event:
      AutonomousRuntimeAuditEvent = {
      id:
        this.generateId(
          timestamp,
        ),
      type,
      timestamp,
      source:
        normalizedSource,
    };

    if (
      options.actor &&
      options.actor.trim().length >
        0
    ) {
      event.actor =
        options.actor.trim();
    }

    if (
      options.details
    ) {
      event.details =
        this.sanitizeDetails(
          options.details,
        );
    }

    this.entries.push(
      event,
    );

    if (
      this.entries.length >
      this.maximumEntries
    ) {
      this.entries =
        this.entries.slice(
          -this.maximumEntries,
        );
    }

    this.persist();

    return {
      ...event,
      details:
        event.details
          ? {
              ...event.details,
            }
          : undefined,
    };
  }

  public getAll():
    AutonomousRuntimeAuditEvent[] {
    this.ensureInitialized();

    return this.entries.map(
      entry => ({
        ...entry,
        details:
          entry.details
            ? {
                ...entry.details,
              }
            : undefined,
      }),
    );
  }

  public getRecent(
    limit = 20,
  ): AutonomousRuntimeAuditEvent[] {
    this.ensureInitialized();

    const safeLimit =
      Math.min(
        Math.max(
          1,
          Math.floor(
            limit,
          ),
        ),
        this.maximumEntries,
      );

    return this.entries
      .slice(
        -safeLimit,
      )
      .map(
        entry => ({
          ...entry,
          details:
            entry.details
              ? {
                  ...entry.details,
                }
              : undefined,
        }),
      );
  }

  public getByType(
    type:
      AutonomousRuntimeAuditEventType,
  ): AutonomousRuntimeAuditEvent[] {
    this.ensureInitialized();

    return this.entries
      .filter(
        entry =>
          entry.type ===
          type,
      )
      .map(
        entry => ({
          ...entry,
          details:
            entry.details
              ? {
                  ...entry.details,
                }
              : undefined,
        }),
      );
  }

  public getCount(): number {
    this.ensureInitialized();

    return this.entries.length;
  }

  public clear(): void {
    this.ensureInitialized();

    this.entries = [];

    this.persist();
  }

  private ensureInitialized(): void {
    if (
      !this.initialized
    ) {
      this.initialize();
    }
  }

  private ensureParentDirectory(): void {
    const directory =
      path.dirname(
        this.storageFilePath,
      );

    fs.mkdirSync(
      directory,
      {
        recursive:
          true,
      },
    );
  }

  private persist(): void {
    this.ensureParentDirectory();

    const data:
      PersistedAuditData = {
      version: 1,
      entries:
        this.entries,
    };

    const temporaryPath =
      `${this.storageFilePath}.tmp-${process.pid}-${Date.now()}-${Math.floor(
        Math.random() * 1_000_000,
      )}`;

    const serialized =
      JSON.stringify(
        data,
        null,
        2,
      );

    try {
      fs.writeFileSync(
        temporaryPath,
        serialized,
        'utf8',
      );

      fs.renameSync(
        temporaryPath,
        this.storageFilePath,
      );
    } catch (error) {
      try {
        if (
          fs.existsSync(
            temporaryPath,
          )
        ) {
          fs.unlinkSync(
            temporaryPath,
          );
        }
      } catch {
        // Ignora erro de limpeza.
      }

      throw new Error(
        `Falha ao persistir audit trail autônomo: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`,
      );
    }
  }

  private generateId(
    timestamp: number,
  ): string {
    return [
      'runtime',
      timestamp,
      process.pid,
      Math.floor(
        Math.random() *
          1_000_000,
      ),
    ].join('_');
  }

  private sanitizeDetails(
    details:
      Record<string, unknown>,
  ): Record<string, unknown> {
    const result:
      Record<string, unknown> = {};

    for (
      const [
        key,
        value,
      ] of Object.entries(
        details,
      )
    ) {
      if (
        typeof value ===
          'string' ||
        typeof value ===
          'number' ||
        typeof value ===
          'boolean' ||
        value === null
      ) {
        if (
          typeof value ===
          'number' &&
          !Number.isFinite(
            value,
          )
        ) {
          result[key] =
            null;
        } else {
          result[key] =
            value;
        }

        continue;
      }

      if (
        Array.isArray(
          value,
        )
      ) {
        result[key] =
          value
            .slice(0, 50)
            .map(
              item =>
                this.sanitizeValue(
                  item,
                  1,
                ),
            );

        continue;
      }

      if (
        typeof value ===
        'object'
      ) {
        result[key] =
          this.sanitizeValue(
            value,
            1,
          );

        continue;
      }

      result[key] =
        String(value);
    }

    return result;
  }

  private sanitizeValue(
    value: unknown,
    depth: number,
  ): unknown {
    if (
      depth > 3
    ) {
      return '[depth-limit]';
    }

    if (
      value === null ||
      typeof value ===
        'string' ||
      typeof value ===
        'boolean'
    ) {
      return value;
    }

    if (
      typeof value ===
      'number'
    ) {
      return Number.isFinite(
        value,
      )
        ? value
        : null;
    }

    if (
      Array.isArray(
        value,
      )
    ) {
      return value
        .slice(0, 50)
        .map(
          item =>
            this.sanitizeValue(
              item,
              depth + 1,
            ),
        );
    }

    if (
      typeof value ===
      'object'
    ) {
      const object:
        Record<string, unknown> = {};

      for (
        const [
          key,
          nested,
        ] of Object.entries(
          value as Record<
            string,
            unknown
          >,
        ).slice(
          0,
          50,
        )
      ) {
        object[key] =
          this.sanitizeValue(
            nested,
            depth + 1,
          );
      }

      return object;
    }

    return String(
      value,
    );
  }

  private isPersistedAuditData(
    value: unknown,
  ): value is PersistedAuditData {
    if (
      !value ||
      typeof value !==
        'object'
    ) {
      return false;
    }

    const record =
      value as Record<
        string,
        unknown
      >;

    if (
      record.version !==
      1
    ) {
      return false;
    }

    if (
      !Array.isArray(
        record.entries,
      )
    ) {
      return false;
    }

    return record.entries.every(
      entry =>
        this.isAuditEvent(
          entry,
        ),
    );
  }

  private isAuditEvent(
    value: unknown,
  ): value is AutonomousRuntimeAuditEvent {
    if (
      !value ||
      typeof value !==
        'object'
    ) {
      return false;
    }

    const record =
      value as Record<
        string,
        unknown
      >;

    return (
      typeof record.id ===
        'string' &&
      typeof record.type ===
        'string' &&
      typeof record.timestamp ===
        'number' &&
      Number.isFinite(
        record.timestamp,
      ) &&
      typeof record.source ===
        'string'
    );
  }
}