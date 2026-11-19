import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const DB_PATH = process.env.DB_PATH ?? 'data/arena.db';

mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA foreign_keys = ON;');

// Базовая схема. CREATE IF NOT EXISTS безопасен при повторном запуске.
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
  status   TEXT NOT NULL CHECK (status IN ('done', 'learning', 'todo', 'reinforced')),
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
  actor_tg_id  INTEGER,
  topic_no     INTEGER NOT NULL,
  from_status  TEXT NOT NULL,
  to_status    TEXT NOT NULL,
  created_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

// Добавляет статус reinforced в CHECK старой таблицы, сохраняя все записи.
const topicStatusSchema = db.prepare(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'topic_status'",
).get() as { sql: string } | undefined;

if (!topicStatusSchema?.sql.toLowerCase().includes("'reinforced'")) {
    db.exec('BEGIN IMMEDIATE');
    try {
        db.exec(`
            CREATE TABLE topic_status_new (
                user_id  INTEGER NOT NULL REFERENCES users(id),
                topic_no INTEGER NOT NULL CHECK (topic_no BETWEEN 1 AND 27),
                status   TEXT NOT NULL CHECK (status IN ('done', 'learning', 'todo', 'reinforced')),
                PRIMARY KEY (user_id, topic_no)
            );

            INSERT INTO topic_status_new (user_id, topic_no, status)
            SELECT user_id, topic_no, status FROM topic_status;

            DROP TABLE topic_status;
            ALTER TABLE topic_status_new RENAME TO topic_status;
        `);
        db.exec('COMMIT');
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
}

// Проверяет наличие колонки и добавляет её только при необходимости.
function addColumnIfMissing(
    table: string,
    column: string,
    definition: string,
): void {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all() as {
        name: string;
    }[];

    if (!columns.some((item) => item.name === column)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
}

// Источник записи и Telegram ID того, кто её создал.
addColumnIfMissing('task_log', 'source', "TEXT NOT NULL DEFAULT 'bot'");
addColumnIfMissing('task_log', 'actor_tg_id', 'INTEGER');

// История изменений балла пробника.
db.exec(`
CREATE TABLE IF NOT EXISTS exam_log (
  id           INTEGER PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id),
  actor_tg_id  INTEGER,
  from_exam    INTEGER,
  to_exam      INTEGER,
  created_at   INTEGER NOT NULL
);
`);

// Аудит административных действий.
db.exec(`
CREATE TABLE IF NOT EXISTS admin_log (
  id              INTEGER PRIMARY KEY,
  actor_tg_id     INTEGER NOT NULL,
  target_user_id  INTEGER REFERENCES users(id),
  action          TEXT NOT NULL,
  details         TEXT NOT NULL DEFAULT '',
  created_at      INTEGER NOT NULL
);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS bot_visits (
  user_id    INTEGER NOT NULL REFERENCES users(id),
  message_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, message_id)
);
CREATE INDEX IF NOT EXISTS bot_visits_created_at ON bot_visits(created_at);

CREATE TABLE IF NOT EXISTS lessons (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  week_start INTEGER NOT NULL,
  weekday    INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  time       TEXT NOT NULL,
  name       TEXT NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('planned', 'held', 'paid'))
);
CREATE INDEX IF NOT EXISTS lessons_week ON lessons(week_start, weekday, time);
`);

addColumnIfMissing('lessons', 'price_kopecks', 'INTEGER NOT NULL DEFAULT 0 CHECK (price_kopecks >= 0)');
addColumnIfMissing('topic_log', 'is_correction', 'INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('exam_log', 'is_correction', 'INTEGER NOT NULL DEFAULT 0');
db.exec(`
CREATE INDEX IF NOT EXISTS topic_log_user_topic ON topic_log(user_id, topic_no, id);
CREATE INDEX IF NOT EXISTS exam_log_user ON exam_log(user_id, id);
`);
