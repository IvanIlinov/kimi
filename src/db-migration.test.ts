import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tempDir = mkdtempSync(join(tmpdir(), 'arena-reinforced-migration-'));
const dbPath = join(tempDir, 'legacy.db');

// Создаём базу старой версии: CHECK ещё не разрешает reinforced.
const legacy = new DatabaseSync(dbPath);
legacy.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        tg_id INTEGER NOT NULL UNIQUE,
        name TEXT NOT NULL,
        exam INTEGER,
        comment TEXT NOT NULL DEFAULT '',
        removed INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE topic_status (
        user_id INTEGER NOT NULL REFERENCES users(id),
        topic_no INTEGER NOT NULL CHECK (topic_no BETWEEN 1 AND 27),
        status TEXT NOT NULL CHECK (status IN ('done', 'learning', 'todo')),
        PRIMARY KEY (user_id, topic_no)
    );

    INSERT INTO users (id, tg_id, name) VALUES (1, 700001, 'Старый участник');

    INSERT INTO topic_status (user_id, topic_no, status)
    VALUES
        (1, 1, 'done'),
        (1, 2, 'learning'),
        (1, 3, 'todo');
`);
legacy.close();

process.env.DB_PATH = dbPath;

const { db } = await import('./db.ts');

after(() => {
    db.close();
    rmSync(tempDir, { recursive: true, force: true });
});

test('миграция разрешает reinforced и сохраняет старые статусы', () => {
    const rows = db.prepare(
        'SELECT topic_no, status FROM topic_status WHERE user_id = 1 ORDER BY topic_no',
    ).all().map((row) => ({
        topic_no: Number(row.topic_no),
        status: String(row.status),
    }));

    assert.deepEqual(rows, [
        { topic_no: 1, status: 'done' },
        { topic_no: 2, status: 'learning' },
        { topic_no: 3, status: 'todo' },
    ]);

    db.prepare(
        'INSERT INTO topic_status (user_id, topic_no, status) VALUES (1, 4, ?)',
    ).run('reinforced');

    assert.equal(
        db.prepare('SELECT status FROM topic_status WHERE user_id = 1 AND topic_no = 4')
            .get()?.status,
        'reinforced',
    );

    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
});
