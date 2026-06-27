import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

type SubscriberRow = {
  chat_id: string;
};

export type TelegramChat = {
  id: number;
  type?: string;
  username?: string;
  first_name?: string;
};

const defaultDbPath = process.env.VERCEL
  ? "/tmp/subscribers.db"
  : path.join(process.cwd(), "data", "subscribers.db");
const dbPath = process.env.SUBSCRIBERS_DB_PATH || defaultDbPath;

let db: Database.Database | null = null;
let upsertStmt: Database.Statement | null = null;
let deactivateStmt: Database.Statement | null = null;
let listActiveStmt: Database.Statement<[], SubscriberRow> | null = null;

// Fallback cache keeps webhook from failing if SQLite cannot be used on a runtime.
const memorySubscribers = new Set<string>();

try {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS telegram_subscribers (
      chat_id TEXT PRIMARY KEY,
      chat_type TEXT,
      username TEXT,
      first_name TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  upsertStmt = db.prepare(`
    INSERT INTO telegram_subscribers (chat_id, chat_type, username, first_name, is_active, updated_at)
    VALUES (@chat_id, @chat_type, @username, @first_name, 1, CURRENT_TIMESTAMP)
    ON CONFLICT(chat_id)
    DO UPDATE SET
      chat_type = excluded.chat_type,
      username = excluded.username,
      first_name = excluded.first_name,
      is_active = 1,
      updated_at = CURRENT_TIMESTAMP;
  `);

  deactivateStmt = db.prepare(`
    UPDATE telegram_subscribers
    SET is_active = 0, updated_at = CURRENT_TIMESTAMP
    WHERE chat_id = ?;
  `);

  listActiveStmt = db.prepare<[], SubscriberRow>(`
    SELECT chat_id
    FROM telegram_subscribers
    WHERE is_active = 1;
  `);
} catch (error) {
  console.warn(
    `Subscriber DB disabled, using in-memory fallback. Path: ${dbPath}. Reason: ${
      error instanceof Error ? error.message : "unknown"
    }`,
  );
}

export function upsertSubscriber(chat: TelegramChat): void {
  const chatId = String(chat.id);
  if (!upsertStmt) {
    memorySubscribers.add(chatId);
    return;
  }

  upsertStmt.run({
    chat_id: chatId,
    chat_type: chat.type ?? "unknown",
    username: chat.username ?? null,
    first_name: chat.first_name ?? null,
  });
}

export function deactivateSubscriber(chatId: number | string): void {
  const id = String(chatId);
  if (!deactivateStmt) {
    memorySubscribers.delete(id);
    return;
  }

  deactivateStmt.run(id);
}

export function getActiveSubscriberIds(): string[] {
  if (!listActiveStmt) {
    return Array.from(memorySubscribers);
  }

  return listActiveStmt.all().map((row) => row.chat_id);
}
