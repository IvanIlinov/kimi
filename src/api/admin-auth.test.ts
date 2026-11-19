import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tempDir = mkdtempSync(join(tmpdir(), 'kimi-admin-auth-test-'));
process.env.DB_PATH = join(tempDir, 'test.db');

const { db } = await import('../db.ts');
const { registerAdmin } = await import('./routes/admin.ts');
const { Router } = await import('./router.ts');
const { HttpError } = await import('./errors.ts');

after(() => {
    db.close();
    rmSync(tempDir, { recursive: true, force: true });
});

test('все административные маршруты запрещены student и guest', () => {
    const router = new Router();
    registerAdmin(router);

    const routes = [
        ['GET', '/api/admin/home'],
        ['POST', '/api/admin/lessons'],
        ['POST', '/api/admin/lessons/1/remove'],
        ['GET', '/api/admin/members'],
        ['GET', '/api/admin/journal'],
        ['POST', '/api/admin/members'],
        ['POST', '/api/admin/members/1/rename'],
        ['POST', '/api/admin/members/1/remove'],
        ['POST', '/api/admin/members/1/restore'],
        ['POST', '/api/admin/members/1/tasks'],
        ['POST', '/api/admin/members/1/exam'],
        ['POST', '/api/admin/members/1/topics/1'],
    ] as const;

    for (const role of ['student', 'guest'] as const) {
        for (const [method, path] of routes) {
            const match = router.match(method, path);
            assert.ok(match, `Маршрут не найден: ${method} ${path}`);

            assert.throws(
                () => match.handler({
                    viewer: {
                        tgId: 700001,
                        firstName: 'Тест',
                        role,
                        personId: null,
                    },
                    params: match.params,
                    query: new URLSearchParams(),
                    body: {},
                }),
                (error: unknown) =>
                    error instanceof HttpError && error.status === 403,
                `${role} должен получить 403: ${method} ${path}`,
            );
        }
    }
});


test('администратор выполняет операции, а действия попадают в журнал', () => {
    const router = new Router();
    registerAdmin(router);

    const viewer = {
        tgId: 900001,
        firstName: 'Администратор',
        role: 'admin' as const,
        personId: null,
    };

    function call(method: string, path: string, body: unknown = {}) {
        const match = router.match(method, path);
        assert.ok(match, `Маршрут не найден: ${method} ${path}`);

        return match.handler({
            viewer,
            params: match.params,
            query: new URLSearchParams(),
            body,
        });
    }

    const created = call('POST', '/api/admin/members', {
        tgId: 700001,
        name: 'Тестовый ученик',
    }) as { ok: boolean; id: number };

    assert.equal(created.ok, true);
    assert.ok(created.id > 0);

    const id = created.id;

    assert.deepEqual(
        call('POST', `/api/admin/members/${id}/rename`, {
            name: 'Новое имя',
        }),
        { ok: true },
    );

    assert.deepEqual(
        call('POST', `/api/admin/members/${id}/tasks`, { total: 12 }),
        { ok: true, total: 12 },
    );

    assert.deepEqual(
        call('POST', `/api/admin/members/${id}/exam`, { value: 85 }),
        { ok: true },
    );

    assert.deepEqual(
        call('POST', `/api/admin/members/${id}/topics/3`, {
            status: 'done',
        }),
        { ok: true },
    );

    assert.deepEqual(
        call('POST', `/api/admin/members/${id}/remove`),
        { ok: true },
    );

    assert.deepEqual(
        call('POST', `/api/admin/members/${id}/restore`),
        { ok: true },
    );

    const members = call('GET', '/api/admin/members') as Array<{
        id: number;
        name: string;
        removed: boolean;
        tasksTotal: number;
        exam: number | null;
        topics: string[];
    }>;

    const member = members.find(item => item.id === id);
    assert.ok(member);
    assert.equal(member.name, 'Новое имя');
    assert.equal(member.removed, false);
    assert.equal(member.tasksTotal, 12);
    assert.equal(member.exam, 85);
    assert.equal(member.topics[2], 'done');

    const journal = db.prepare(`
        SELECT action, actor_tg_id, target_user_id
        FROM admin_log
        WHERE target_user_id = ?
        ORDER BY id
    `).all(id) as Array<{
        action: string;
        actor_tg_id: number;
        target_user_id: number;
    }>;

    assert.deepEqual(
        journal.map(entry => entry.action),
        [
            'add_user',
            'rename_user',
            'set_tasks_total',
            'set_exam',
            'set_topic_status',
            'remove_user',
            'restore_user',
        ],
    );

    for (const entry of journal) {
        assert.equal(entry.actor_tg_id, viewer.tgId);
        assert.equal(entry.target_user_id, id);
    }

    const journalApi = call('GET', '/api/admin/journal') as Array<{
        targetId: number | null;
        actorTgId: number | null;
    }>;

    assert.ok(journalApi.some(
        entry => entry.targetId === id && entry.actorTgId === viewer.tgId,
    ));
});

test('главная считает посещения текущей недели и редактирует её расписание', () => {
    const router = new Router();
    registerAdmin(router);
    const viewer = { tgId: 900001, firstName: 'Администратор', role: 'admin' as const, personId: null };
    function call(method: string, path: string, body: unknown = {}) {
        const match = router.match(method, path);
        assert.ok(match);
        return match.handler({ viewer, params: match.params, query: new URLSearchParams(), body });
    }
    function home() {
        return call('GET', '/api/admin/home') as {
            weekStart: number;
            attendance: { visits: number; visitors: number; participants: number };
            lessons: { id: number; status: string }[];
        };
    }

    const before = home();
    const user = db.prepare('INSERT INTO users (tg_id, name) VALUES (?, ?)').run(810001, 'Ученик');
    const visit = db.prepare('INSERT INTO bot_visits (user_id, message_id, created_at) VALUES (?, ?, ?)');
    visit.run(user.lastInsertRowid, 1, before.weekStart - 1);
    visit.run(user.lastInsertRowid, 2, before.weekStart);
    visit.run(user.lastInsertRowid, 3, before.weekStart + 1);
    assert.deepEqual({ ...home().attendance }, {
        visits: before.attendance.visits + 2,
        visitors: before.attendance.visitors + 1,
        participants: before.attendance.participants + 1,
    });

    const lesson = { weekStart: before.weekStart, weekday: 0, time: '16:30', name: 'Ученик', status: 'planned' };
    assert.throws(() => call('POST', '/api/admin/lessons', { ...lesson, time: '24:00' }),
        (error: unknown) => error instanceof HttpError && error.status === 400);
    assert.throws(() => call('POST', '/api/admin/lessons', { ...lesson, weekStart: before.weekStart - 1 }),
        (error: unknown) => error instanceof HttpError && error.status === 409);
    call('POST', '/api/admin/lessons', lesson);
    const [saved] = home().lessons;
    assert.equal(saved.status, 'planned');
    call('POST', '/api/admin/lessons', { ...lesson, id: saved.id, status: 'paid' });
    assert.equal(home().lessons[0].status, 'paid');
    call('POST', `/api/admin/lessons/${saved.id}/remove`);
    assert.deepEqual(home().lessons, []);
});
