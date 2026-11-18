import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Важно: путь задаётся до импорта модулей, которые подключают БД.
const tempDir = mkdtempSync(join(tmpdir(), 'kimi-admin-test-'));
process.env.DB_PATH = join(tempDir, 'test.db');

const { db } = await import('./db.ts');
const { addUser, renameUser, removeUser, restoreUser } = await import('./admin.ts');
const { setTasksTotal, setExam, setTopicStatus } = await import('./write.ts');
const { getAdminMembers, getAdminJournal } = await import('./store.ts');

after(() => {
    db.close();
    rmSync(tempDir, { recursive: true, force: true });
});

test('административные операции работают на изолированной базе', () => {
    // Добавление участника и создание 27 начальных статусов.
    const alice = addUser(700001, 'Тестовая Алиса');

    assert.equal(
        Number(db.prepare('SELECT COUNT(*) AS n FROM topic_status WHERE user_id = ?')
            .get(alice)?.n),
        27,
    );

    assert.throws(() => addUser(700001, 'Дубликат'));
    assert.throws(() => addUser(-1, 'Некорректный ID'));

    // Переименование и проверка уникальности имени.
    const bob = addUser(700002, 'Тестовый Боб');

    renameUser(alice, 'Алиса Новая');

    assert.throws(() => renameUser(alice, 'Тестовый Боб'));

    // Установка точного количества задач с разбивкой на части не более 50.
    assert.equal(setTasksTotal(alice, 123, 900001), 123);

    const firstTaskLogs = db.prepare(
        'SELECT amount FROM task_log WHERE user_id = ? ORDER BY id',
    ).all(alice) as { amount: number }[];

    assert.deepEqual(firstTaskLogs.map((row) => row.amount), [50, 50, 23]);

    assert.equal(setTasksTotal(alice, 17, 900001), 17);

    const memberAfterTasks = getAdminMembers().find((item) => item.id === alice);
    assert.equal(memberAfterTasks?.tasksTotal, 17);

    assert.throws(() => setTasksTotal(alice, -1, 900001));
    assert.throws(() => setTasksTotal(alice, 1.5, 900001));

    // Балл пробника: повторная установка того же значения не создаёт новую запись.
    setExam(alice, 95, 900001);
    setExam(alice, 95, 900001);

    assert.equal(
        Number(db.prepare('SELECT COUNT(*) AS n FROM exam_log WHERE user_id = ?')
            .get(alice)?.n),
        1,
    );

    setExam(alice, null, 900001);

    assert.equal(
        db.prepare('SELECT exam FROM users WHERE id = ?').get(alice)?.exam,
        null,
    );

    assert.throws(() => setExam(alice, 101, 900001));

    // Статусы заданий.
    setTopicStatus(alice, 1, 'done', 900001);
    setTopicStatus(alice, 1, 'done', 900001);

    const topicLogs = Number(
        db.prepare('SELECT COUNT(*) AS n FROM topic_log WHERE user_id = ?')
            .get(alice)?.n,
    );

    // Повторная установка того же статуса не должна создавать фиктивный переход.
    assert.equal(topicLogs, 1);

    assert.equal(
        db.prepare('SELECT status FROM topic_status WHERE user_id = ? AND topic_no = 1')
            .get(alice)?.status,
        'done',
    );

    assert.throws(() => setTopicStatus(alice, 28, 'done', 900001));

    // Мягкое удаление сохраняет данные, восстановление возвращает участника.
    removeUser(alice);

    assert.equal(
        getAdminMembers().find((item) => item.id === alice)?.removed,
        true,
    );

    restoreUser(alice);

    const restored = getAdminMembers().find((item) => item.id === alice);

    assert.equal(restored?.removed, false);
    assert.equal(restored?.name, 'Алиса Новая');
    assert.equal(restored?.tasksTotal, 17);
    assert.equal(restored?.exam, null);
    assert.equal(restored?.topics[0], 'done');

    assert.throws(() => restoreUser(alice));

    // Повторное добавление удалённого Telegram ID восстанавливает прежнюю запись.
    removeUser(bob);
    const restoredBob = addUser(700002, 'Боб Возвращённый');

    assert.equal(restoredBob, bob);
    assert.equal(
        getAdminMembers().find((item) => item.id === bob)?.name,
        'Боб Возвращённый',
    );

    // Журнал объединяет историю задач, статусов и пробников.
    const journal = getAdminJournal(100, 0);
    const kinds = new Set(journal.map((entry) => entry.kind));

    assert.ok(kinds.has('task'));
    assert.ok(kinds.has('topic'));
    assert.ok(kinds.has('exam'));

    // Журнал должен сохранять Telegram ID участника и автора действия.
    const aliceJournal = journal.filter((entry) => entry.targetId === alice);

    assert.ok(aliceJournal.length > 0);
    assert.ok(aliceJournal.every((entry) => entry.targetTgId === 700001));
    assert.ok(aliceJournal.every((entry) => entry.actorTgId === 900001));
});
