import { DatabaseSync } from 'node:sqlite';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface WordMemory {
  word: string;
  count: number;
  lastSeen: number;
}

export class MemoryService {
  private static database: DatabaseSync | null = null;

  static initialize(
    databasePath?: string
  ): void {
    if (this.database) {
      return;
    }

    let resolvedPath =
      databasePath;

    if (!resolvedPath) {
      const dataDirectory =
        path.join(
          process.cwd(),
          'data'
        );

      fs.mkdirSync(
        dataDirectory,
        { recursive: true }
      );

      resolvedPath =
        path.join(
          dataDirectory,
          'memory.db'
        );
    }

    this.database =
      new DatabaseSync(
        resolvedPath
      );

    this.database.exec(`
      PRAGMA journal_mode = WAL;

      PRAGMA busy_timeout = 5000;

      CREATE TABLE IF NOT EXISTS word_memory (
        word TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 0,
        last_seen INTEGER NOT NULL
      ) STRICT;

      CREATE INDEX IF NOT EXISTS idx_word_memory_count
      ON word_memory(count);

      CREATE INDEX IF NOT EXISTS idx_word_memory_last_seen
      ON word_memory(last_seen);
    `);
  }

  static incrementWord(
    word: string
  ): number {
    this.ensureInitialized();

    const normalizedWord =
      word.trim().toLowerCase();

    if (!normalizedWord) {
      return 0;
    }

    const now = Date.now();

    const statement =
      this.database!.prepare(`
        INSERT INTO word_memory (
          word,
          count,
          last_seen
        )
        VALUES (?, 1, ?)
        ON CONFLICT(word)
        DO UPDATE SET
          count = count + 1,
          last_seen = excluded.last_seen
      `);

    statement.run(
      normalizedWord,
      now
    );

    return this.getWordCount(
      normalizedWord
    );
  }

  static getWordCount(
    word: string
  ): number {
    this.ensureInitialized();

    const normalizedWord =
      word.trim().toLowerCase();

    if (!normalizedWord) {
      return 0;
    }

    const statement =
      this.database!.prepare(`
        SELECT count
        FROM word_memory
        WHERE word = ?
      `);

    const result =
      statement.get(
        normalizedWord
      ) as
        | { count: number }
        | undefined;

    return result?.count ?? 0;
  }

  static getWordMemory(
    word: string
  ): WordMemory | null {
    this.ensureInitialized();

    const normalizedWord =
      word.trim().toLowerCase();

    const statement =
      this.database!.prepare(`
        SELECT
          word,
          count,
          last_seen AS lastSeen
        FROM word_memory
        WHERE word = ?
      `);

    const result =
      statement.get(
        normalizedWord
      ) as
        | WordMemory
        | undefined;

    return result ?? null;
  }

  static getMostMentionedWords(
    limit = 10
  ): WordMemory[] {
    this.ensureInitialized();

    const safeLimit = Math.max(
      1,
      Math.floor(limit)
    );

    const statement =
      this.database!.prepare(`
        SELECT
          word,
          count,
          last_seen AS lastSeen
        FROM word_memory
        ORDER BY count DESC, last_seen DESC
        LIMIT ?
      `);

    return statement.all(
      safeLimit
    ) as unknown as WordMemory[];
  }

  static forgetWord(
    word: string
  ): void {
    this.ensureInitialized();

    const normalizedWord =
      word.trim().toLowerCase();

    if (!normalizedWord) {
      return;
    }

    const statement =
      this.database!.prepare(`
        DELETE FROM word_memory
        WHERE word = ?
      `);

    statement.run(
      normalizedWord
    );
  }

  static clear(): void {
    this.ensureInitialized();

    this.database!.exec(`
      DELETE FROM word_memory;
    `);
  }

  static close(): void {
    if (!this.database) {
      return;
    }

    this.database.close();
    this.database = null;
  }

  private static ensureInitialized(): void {
    if (!this.database) {
      this.initialize();
    }
  }
}