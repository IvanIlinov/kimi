import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tempDir = mkdtempSync(join(tmpdir(), 'kimi-admin-auth-test-'));
process.env.DB_PATH = join(tempDir, 'test.db');
process.env.BOT_TOKEN = 'test-token';
process.env.ADMIN_IDS = '900001';

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
        ['GET', '/api/admin/history'],
        ['POST', '/api/admin/lessons'],
        ['POST', '/api/admin/lessons/1/remove'],
        ['POST', '/api/admin/lessons/1/cycle'],
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
            month: { start: number; earnedKopecks: number };
            attendance: { visits: number; visitors: number; participants: number };
            lessons: { id: number; status: string; priceKopecks: number }[];
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
    const [legacy] = home().lessons;
    assert.equal(legacy.priceKopecks, 0);
    call('POST', `/api/admin/lessons/${legacy.id}/remove`);
    assert.throws(() => call('POST', '/api/admin/lessons', { ...lesson, priceKopecks: -1 }),
        (error: unknown) => error instanceof HttpError && error.status === 400);
    call('POST', '/api/admin/lessons', { ...lesson, priceKopecks: 150050 });
    const [saved] = home().lessons;
    assert.equal(saved.status, 'planned');
    assert.equal(saved.priceKopecks, 150050);
    for (const status of ['held', 'paid', 'planned']) {
        const changed = call('POST', `/api/admin/lessons/${saved.id}/cycle`) as { status: string };
        assert.equal(changed.status, status);
        assert.equal(home().lessons[0].status, status);
        assert.equal(home().lessons[0].priceKopecks, 150050);
    }
    call('POST', '/api/admin/lessons', { ...lesson, id: saved.id, status: 'paid' });
    assert.equal(home().lessons[0].status, 'paid');
    assert.equal(home().lessons[0].priceKopecks, 150050);
    call('POST', '/api/admin/lessons', { ...lesson, id: saved.id, status: 'paid', priceKopecks: 175000 });
    assert.equal(home().lessons[0].priceKopecks, 175000);
    call('POST', `/api/admin/lessons/${saved.id}/remove`);
    assert.deepEqual(home().lessons, []);

    const dayMs = 86_400_000;
    const monthEnd = new Date(before.month.start + 3 * 3_600_000);
    monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
    const nextMonth = monthEnd.getTime() - 3 * 3_600_000;
    const insert = db.prepare(`
        INSERT INTO lessons (week_start, weekday, time, name, status, price_kopecks)
        VALUES (?, ?, '16:30', 'Ученик', ?, ?)
    `);
    function insertOn(date: number, status: string, price: number) {
        const weekday = (new Date(date + 3 * 3_600_000).getUTCDay() + 6) % 7;
        insert.run(date - weekday * dayMs, weekday, status, price);
    }
    insertOn(before.month.start - dayMs, 'paid', 400000);
    insertOn(before.month.start, 'paid', 160000);
    insertOn(nextMonth - dayMs, 'paid', 200000);
    insertOn(nextMonth - dayMs, 'held', 300000);
    insertOn(nextMonth, 'paid', 500000);
    assert.equal(home().month.earnedKopecks, 360000);
});

test('админские правки статуса учитываются в месячной цели по заданиям', async () => {
    const { registerSelf } = await import('./routes/self.ts');
    const { getPersons, getWeekStats } = await import('../store.ts');
    const { monthlyResults } = await import('../logic.ts');
    const { addUser } = await import('../admin.ts');
    const { setTopicStatus } = await import('../write.ts');
    const router = new Router();
    registerSelf(router);
    const tgId = 810002;
    const id = addUser(tgId, 'Ученик с правками');
    setTopicStatus(id, 1, 'done', tgId);
    const student = { tgId, role: 'student' as const, firstName: 'Ученик', personId: id };
    const admin = { ...student, correctionActorTgId: 900001 };
    function post(path: string, body: unknown, viewer: typeof student & { correctionActorTgId?: number } = admin) {
        const match = router.match('POST', path);
        assert.ok(match);
        return match.handler({ viewer, params: match.params, query: new URLSearchParams(), body });
    }
    const person = () => getPersons().find((p) => p.id === id)!;

    post('/api/self/tasks', { amount: 10 });
    post('/api/self/exam', { value: 70 });
    post('/api/self/topics/1/cycle', {});
    const edited = person();
    assert.equal(edited.tasksTotal, 10);
    assert.equal(edited.tasksWeek, 0);
    assert.equal(edited.exam, 70);
    assert.deepEqual(edited.reinforced, [1]);
    assert.deepEqual(monthlyResults(edited), { tasks: 0, topics: 1, exam: 0 });
    assert.equal(getWeekStats().find((s) => s.userId === id)?.topics, 0);

    post('/api/self/tasks', { amount: 3 }, student);
    post('/api/self/topics/1/cycle', {}, student);
    post('/api/self/exam', { value: 80 }, student);
    assert.deepEqual(monthlyResults(person()), { tasks: 3, topics: 0, exam: 80 });
    const week = getWeekStats().find((s) => s.userId === id);
    assert.deepEqual(week, { userId: id, tasks: 3, topics: 0, active: true });
});

test('история группирует изменения по московским датам и показывает балл на тот день', async () => {
    const { addUser } = await import('../admin.ts');
    const { getAdminHistory } = await import('../store.ts');
    const tgId = 810003;
    const id = addUser(tgId, 'Миша');
    const midnight = Date.UTC(2030, 10, 19) - 3 * 3_600_000;
    const day = Date.UTC(2030, 10, 19) / 86_400_000;
    const task = db.prepare('INSERT INTO task_log (user_id, amount, created_at, source, actor_tg_id) VALUES (?, ?, ?, ?, ?)');
    task.run(id, 5, midnight - 1, 'bot', tgId);
    task.run(id, 20, midnight, 'bot', tgId);
    task.run(id, 7, midnight + 1, 'bot', tgId);
    task.run(id, 100, midnight + 1, 'bot', tgId);
    db.prepare('UPDATE task_log SET cancelled = 1 WHERE user_id = ? AND amount = 100').run(id);
    const topic = db.prepare(`
        INSERT INTO topic_log (user_id, topic_no, from_status, to_status, created_at, actor_tg_id)
        VALUES (?, ?, 'done', 'reinforced', ?, ?)
    `);
    topic.run(id, 1, midnight, tgId);
    topic.run(id, 2, midnight, tgId);
    const exam = db.prepare(`
        INSERT INTO exam_log (user_id, actor_tg_id, from_exam, to_exam, created_at)
        VALUES (?, ?, ?, ?, ?)
    `);
    exam.run(id, tgId, 35, 36, midnight + 1);
    exam.run(id, tgId, 36, 37, midnight + 1);
    const [today] = getAdminHistory(1, 0);
    assert.deepEqual(today, {
        day, rows: [{ id, name: 'Миша', pct: 4, tasks: 27, topics: 2, examBefore: 35, examAfter: 37 }],
    });
    const [yesterday] = getAdminHistory(1, 1);
    assert.deepEqual(yesterday, {
        day: day - 1, rows: [{ id, name: 'Миша', pct: 0, tasks: 5, topics: 0, examBefore: 35, examAfter: 35 }],
    });

    task.run(id, 10, midnight + 2, 'admin', 900001);
    const [corrected] = getAdminHistory(1, 0);
    assert.equal(corrected.rows[0].tasks, 37);
    assert.equal(corrected.rows[0].pct, 4);
});
