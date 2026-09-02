"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryService = void 0;
const node_sqlite_1 = require("node:sqlite");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
class MemoryService {
    static initialize(databasePath) {
        if (this.database) {
            return;
        }
        let resolvedPath = databasePath;
        if (!resolvedPath) {
            const dataDirectory = path.join(process.cwd(), 'data');
            fs.mkdirSync(dataDirectory, { recursive: true });
            resolvedPath = path.join(dataDirectory, 'memory.db');
        }
        this.database = new node_sqlite_1.DatabaseSync(resolvedPath);
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

      CREATE TABLE IF NOT EXISTS memory_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        importance INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL
      ) STRICT;

      CREATE INDEX IF NOT EXISTS idx_memory_events_user
      ON memory_events(user_id);

      CREATE INDEX IF NOT EXISTS idx_memory_events_type
      ON memory_events(type);

      CREATE INDEX IF NOT EXISTS idx_memory_events_importance
      ON memory_events(importance DESC);

      CREATE INDEX IF NOT EXISTS idx_memory_events_created
      ON memory_events(created_at DESC);

      CREATE TABLE IF NOT EXISTS emotion_state (
        key   TEXT PRIMARY KEY,
        value REAL NOT NULL DEFAULT 0
      ) STRICT;
    `);
    }
    static incrementWord(word) {
        this.ensureInitialized();
        const normalizedWord = word.trim().toLowerCase();
        if (!normalizedWord) {
            return 0;
        }
        const now = Date.now();
        const statement = this.database.prepare(`
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
        statement.run(normalizedWord, now);
        return this.getWordCount(normalizedWord);
    }
    static getWordCount(word) {
        this.ensureInitialized();
        const normalizedWord = word.trim().toLowerCase();
        if (!normalizedWord) {
            return 0;
        }
        const statement = this.database.prepare(`
        SELECT count
        FROM word_memory
        WHERE word = ?
      `);
        const result = statement.get(normalizedWord);
        return result?.count ?? 0;
    }
    static getWordMemory(word) {
        this.ensureInitialized();
        const normalizedWord = word.trim().toLowerCase();
        const statement = this.database.prepare(`
        SELECT
          word,
          count,
          last_seen AS lastSeen
        FROM word_memory
        WHERE word = ?
      `);
        const result = statement.get(normalizedWord);
        return result ?? null;
    }
    static getMostMentionedWords(limit = 10) {
        this.ensureInitialized();
        const safeLimit = Math.max(1, Math.floor(limit));
        const statement = this.database.prepare(`
        SELECT
          word,
          count,
          last_seen AS lastSeen
        FROM word_memory
        ORDER BY count DESC, last_seen DESC
        LIMIT ?
      `);
        return statement.all(safeLimit);
    }
    static forgetWord(word) {
        this.ensureInitialized();
        const normalizedWord = word.trim().toLowerCase();
        if (!normalizedWord) {
            return;
        }
        const statement = this.database.prepare(`
        DELETE FROM word_memory
        WHERE word = ?
      `);
        statement.run(normalizedWord);
    }
    static upsertUser(userId, username) {
        this.ensureInitialized();
        const now = Date.now();
        const statement = this.database.prepare(`
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
        statement.run(userId, username, now, now);
        return this.getUser(userId);
    }
    static getUser(userId) {
        this.ensureInitialized();
        const statement = this.database.prepare(`
        SELECT
          user_id AS userId,
          username,
          first_seen AS firstSeen,
          last_seen AS lastSeen,
          message_count AS messageCount
        FROM user_memory
        WHERE user_id = ?
      `);
        const result = statement.get(userId);
        return result ?? null;
    }
    static saveConversation(userId, topic, summary, importance = 1) {
        this.ensureInitialized();
        const normalizedTopic = topic.trim().toLowerCase();
        const normalizedSummary = summary.trim();
        if (!userId ||
            !normalizedTopic ||
            !normalizedSummary) {
            throw new Error('userId, topic e summary são obrigatórios.');
        }
        const safeImportance = Math.min(10, Math.max(1, Math.floor(importance)));
        const now = Date.now();
        const existing = this.findConversation(userId, normalizedTopic);
        if (existing) {
            const statement = this.database.prepare(`
          UPDATE conversation_memory
          SET
            summary = ?,
            importance = MAX(importance, ?),
            last_seen = ?
          WHERE id = ?
        `);
            statement.run(normalizedSummary, safeImportance, now, existing.id);
            return this.getConversation(existing.id);
        }
        const statement = this.database.prepare(`
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
        const result = statement.run(userId, normalizedTopic, normalizedSummary, safeImportance, now, now);
        return this.getConversation(Number(result.lastInsertRowid));
    }
    static findConversation(userId, topic) {
        this.ensureInitialized();
        const statement = this.database.prepare(`
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
        ORDER BY
          importance DESC,
          last_seen DESC
        LIMIT 1
      `);
        const result = statement.get(userId, topic.trim().toLowerCase());
        return result ?? null;
    }
    static getUserConversations(userId, limit = 10) {
        this.ensureInitialized();
        const safeLimit = Math.max(1, Math.floor(limit));
        const statement = this.database.prepare(`
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
        return statement.all(userId, safeLimit);
    }
    static saveEvent(userId, type, content, importance = 1) {
        this.ensureInitialized();
        const normalizedContent = content.trim();
        if (!userId ||
            !normalizedContent) {
            throw new Error('userId e content são obrigatórios.');
        }
        const safeImportance = Math.min(10, Math.max(1, Math.floor(importance)));
        const now = Date.now();
        const statement = this.database.prepare(`
        INSERT INTO memory_events (
          user_id,
          type,
          content,
          importance,
          created_at
        )
        VALUES (?, ?, ?, ?, ?)
      `);
        const result = statement.run(userId, type, normalizedContent, safeImportance, now);
        return this.getEvent(Number(result.lastInsertRowid));
    }
    static getEvent(id) {
        this.ensureInitialized();
        const statement = this.database.prepare(`
        SELECT
          id,
          user_id AS userId,
          type,
          content,
          importance,
          created_at AS createdAt
        FROM memory_events
        WHERE id = ?
      `);
        const result = statement.get(id);
        return result ?? null;
    }
    static getUserEvents(userId, limit = 20) {
        this.ensureInitialized();
        const safeLimit = Math.max(1, Math.floor(limit));
        const statement = this.database.prepare(`
        SELECT
          id,
          user_id AS userId,
          type,
          content,
          importance,
          created_at AS createdAt
        FROM memory_events
        WHERE user_id = ?
        ORDER BY
          created_at DESC
        LIMIT ?
      `);
        return statement.all(userId, safeLimit);
    }
    static getImportantUserEvents(userId, minimumImportance = 5, limit = 10) {
        this.ensureInitialized();
        const safeImportance = Math.min(10, Math.max(1, Math.floor(minimumImportance)));
        const safeLimit = Math.max(1, Math.floor(limit));
        const statement = this.database.prepare(`
        SELECT
          id,
          user_id AS userId,
          type,
          content,
          importance,
          created_at AS createdAt
        FROM memory_events
        WHERE user_id = ?
          AND importance >= ?
        ORDER BY
          importance DESC,
          created_at DESC
        LIMIT ?
      `);
        return statement.all(userId, safeImportance, safeLimit);
    }
    static deleteEvent(id) {
        this.ensureInitialized();
        const statement = this.database.prepare(`
        DELETE FROM memory_events
        WHERE id = ?
      `);
        statement.run(id);
    }
    static forgetConversation(id) {
        this.ensureInitialized();
        const statement = this.database.prepare(`
        DELETE FROM conversation_memory
        WHERE id = ?
      `);
        statement.run(id);
    }
    static saveEmotions(state) {
        this.ensureInitialized();
        const statement = this.database.prepare(`
        INSERT INTO emotion_state (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value
      `);
        for (const [key, value] of Object.entries(state)) {
            statement.run(key, value);
        }
    }
    static loadEmotions() {
        this.ensureInitialized();
        const statement = this.database.prepare(`
        SELECT key, value FROM emotion_state
      `);
        const rows = statement.all();
        const result = {};
        for (const row of rows) {
            result[row.key] = row.value;
        }
        return result;
    }
    static clear() {
        this.ensureInitialized();
        this.database.exec(`
      DELETE FROM memory_events;
      DELETE FROM conversation_memory;
      DELETE FROM user_memory;
      DELETE FROM word_memory;
      DELETE FROM emotion_state;
    `);
    }
    static close() {
        if (!this.database) {
            return;
        }
        this.database.close();
        this.database = null;
    }
    static getConversation(id) {
        const statement = this.database.prepare(`
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
        const result = statement.get(id);
        return result ?? null;
    }
    static ensureInitialized() {
        if (!this.database) {
            this.initialize();
        }
    }
}
exports.MemoryService = MemoryService;
MemoryService.database = null;
