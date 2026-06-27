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

const dbPath = process.env.SUBSCRIBERS_DB_PATH || path.join(process.cwd(), "data", "subscribers.db");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
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

const upsertStmt = db.prepare(`
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

const deactivateStmt = db.prepare(`
  UPDATE telegram_subscribers
  SET is_active = 0, updated_at = CURRENT_TIMESTAMP
  WHERE chat_id = ?;
`);

const listActiveStmt = db.prepare<[], SubscriberRow>(`
  SELECT chat_id
  FROM telegram_subscribers
  WHERE is_active = 1;
`);

export function upsertSubscriber(chat: TelegramChat): void {
  upsertStmt.run({
    chat_id: String(chat.id),
    chat_type: chat.type ?? "unknown",
    username: chat.username ?? null,
    first_name: chat.first_name ?? null,
  });
}

export function deactivateSubscriber(chatId: number | string): void {
  deactivateStmt.run(String(chatId));
}

export function getActiveSubscriberIds(): string[] {
  return listActiveStmt.all().map((row) => row.chat_id);
}
