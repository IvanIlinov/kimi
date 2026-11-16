import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const DB_PATH = 'data/arena.db';

mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id       INTEGER PRIMARY KEY,
  tg_id    INTEGER NOT NULL UNIQUE,
  name     TEXT NOT NULL,
  exam     INTEGER CHECK (exam IS NULL OR exam BETWEEN 0 AND 100),
  comment  TEXT NOT NULL DEFAULT '' CHECK (length(comment) <= 300),
  removed  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS topic_status (
  user_id  INTEGER NOT NULL REFERENCES users(id),
  topic_no INTEGER NOT NULL CHECK (topic_no BETWEEN 1 AND 27),
  status   TEXT NOT NULL CHECK (status IN ('done', 'learning', 'todo')),
  PRIMARY KEY (user_id, topic_no)
);

CREATE TABLE IF NOT EXISTS task_log (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  amount     INTEGER NOT NULL CHECK (amount <> 0),
  created_at INTEGER NOT NULL,
  cancelled  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS topic_log (
  id           INTEGER PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id),
  actor_tg_id  INTEGER,                 -- кто сделал: Telegram id ученика или админа
  topic_no     INTEGER NOT NULL,
  from_status  TEXT NOT NULL,
  to_status    TEXT NOT NULL,
  created_at   INTEGER NOT NULL         -- Unix-время в миллисекундах
);

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

const taskCols = db.prepare('PRAGMA table_info(task_log)').all() as unknown as { name: string }[];
if (!taskCols.some((c) => c.name === 'source')) {
  db.exec("ALTER TABLE task_log ADD COLUMN source TEXT NOT NULL DEFAULT 'bot'");
}