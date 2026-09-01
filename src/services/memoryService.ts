import { DatabaseSync } from 'node:sqlite';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface WordMemory {
  word: string;
  count: number;
  lastSeen: number;
}

export interface UserMemory {
  userId: string;
  username: string;
  firstSeen: number;
  lastSeen: number;
  messageCount: number;
}

export interface ConversationMemory {
  id: number;
  userId: string;
  topic: string;
  summary: string;
  importance: number;
  createdAt: number;
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

    let resolvedPath = databasePath;

    if (!resolvedPath) {
      const dataDirectory = path.join(
        process.cwd(),
        'data'
      );

      fs.mkdirSync(
        dataDirectory,
        { recursive: true }
      );

      resolvedPath = path.join(
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

      CREATE TABLE IF NOT EXISTS user_memory (
        user_id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        first_seen INTEGER NOT NULL,
        last_seen INTEGER NOT NULL,
        message_count INTEGER NOT NULL DEFAULT 0
      ) STRICT;

      CREATE TABLE IF NOT EXISTS conversation_memory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        topic TEXT NOT NULL,
        summary TEXT NOT NULL,
        importance INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        last_seen INTEGER NOT NULL
      ) STRICT;

      CREATE INDEX IF NOT EXISTS idx_conversation_user
      ON conversation_memory(user_id);

      CREATE INDEX IF NOT EXISTS idx_conversation_topic
      ON conversation_memory(topic);

      CREATE INDEX IF NOT EXISTS idx_conversation_importance
      ON conversation_memory(importance DESC);
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

  static upsertUser(
    userId: string,
    username: string
  ): UserMemory {
    this.ensureInitialized();

    const now = Date.now();

    const statement =
      this.database!.prepare(`
        INSERT INTO user_memory (
          user_id,
          username,
          first_seen,
          last_seen,
          message_count
        )
        VALUES (?, ?, ?, ?, 1)
        ON CONFLICT(user_id)
        DO UPDATE SET
          username = excluded.username,
          last_seen = excluded.last_seen,
          message_count = message_count + 1
      `);

    statement.run(
      userId,
      username,
      now,
      now
    );

    return this.getUser(
      userId
    )!;
  }

  static getUser(
    userId: string
  ): UserMemory | null {
    this.ensureInitialized();

    const statement =
      this.database!.prepare(`
        SELECT
          user_id AS userId,
          username,
          first_seen AS firstSeen,
          last_seen AS lastSeen,
          message_count AS messageCount
        FROM user_memory
        WHERE user_id = ?
      `);

    const result =
      statement.get(
        userId
      ) as
        | UserMemory
        | undefined;

    return result ?? null;
  }

  static saveConversation(
    userId: string,
    topic: string,
    summary: string,
    importance = 1
  ): ConversationMemory {
    this.ensureInitialized();

    const normalizedTopic =
      topic.trim().toLowerCase();

    const normalizedSummary =
      summary.trim();

    if (
      !userId ||
      !normalizedTopic ||
      !normalizedSummary
    ) {
      throw new Error(
        'userId, topic e summary são obrigatórios.'
      );
    }

    const safeImportance = Math.min(
      10,
      Math.max(
        1,
        Math.floor(importance)
      )
    );

    const now = Date.now();

    const existing =
      this.findConversation(
        userId,
        normalizedTopic
      );

    if (existing) {
      const statement =
        this.database!.prepare(`
          UPDATE conversation_memory
          SET
            summary = ?,
            importance = MAX(importance, ?),
            last_seen = ?
          WHERE id = ?
        `);

      statement.run(
        normalizedSummary,
        safeImportance,
        now,
        existing.id
      );

      return this.getConversation(
        existing.id
      )!;
    }

    const statement =
      this.database!.prepare(`
        INSERT INTO conversation_memory (
          user_id,
          topic,
          summary,
          importance,
          created_at,
          last_seen
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `);

    const result =
      statement.run(
        userId,
        normalizedTopic,
        normalizedSummary,
        safeImportance,
        now,
        now
      );

    return this.getConversation(
      Number(result.lastInsertRowid)
    )!;
  }

  static findConversation(
    userId: string,
    topic: string
  ): ConversationMemory | null {
    this.ensureInitialized();

    const statement =
      this.database!.prepare(`
        SELECT
          id,
          user_id AS userId,
          topic,
          summary,
          importance,
          created_at AS createdAt,
          last_seen AS lastSeen
        FROM conversation_memory
        WHERE user_id = ?
          AND topic = ?
        ORDER BY importance DESC, last_seen DESC
        LIMIT 1
      `);

    const result =
      statement.get(
        userId,
        topic.trim().toLowerCase()
      ) as
        | ConversationMemory
        | undefined;

    return result ?? null;
  }

  static getUserConversations(
    userId: string,
    limit = 10
  ): ConversationMemory[] {
    this.ensureInitialized();

    const safeLimit = Math.max(
      1,
      Math.floor(limit)
    );

    const statement =
      this.database!.prepare(`
        SELECT
          id,
          user_id AS userId,
          topic,
          summary,
          importance,
          created_at AS createdAt,
          last_seen AS lastSeen
        FROM conversation_memory
        WHERE user_id = ?
        ORDER BY
          importance DESC,
          last_seen DESC
        LIMIT ?
      `);

    return statement.all(
      userId,
      safeLimit
    ) as unknown as ConversationMemory[];
  }

  static forgetConversation(
    id: number
  ): void {
    this.ensureInitialized();

    const statement =
      this.database!.prepare(`
        DELETE FROM conversation_memory
        WHERE id = ?
      `);

    statement.run(id);
  }

  static clear(): void {
    this.ensureInitialized();

    this.database!.exec(`
      DELETE FROM conversation_memory;
      DELETE FROM user_memory;
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

  private static getConversation(
    id: number
  ): ConversationMemory | null {
    const statement =
      this.database!.prepare(`
        SELECT
          id,
          user_id AS userId,
          topic,
          summary,
          importance,
          created_at AS createdAt,
          last_seen AS lastSeen
        FROM conversation_memory
        WHERE id = ?
      `);

    const result =
      statement.get(
        id
      ) as
        | ConversationMemory
        | undefined;

    return result ?? null;
  }

  private static ensureInitialized(): void {
    if (!this.database) {
      this.initialize();
    }
  }
}