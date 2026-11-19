import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Viewer } from './context.ts';
import type { ArenaDto, ProfileDto } from './dto.ts';

process.env.DB_PATH = ':memory:';
process.env.BOT_TOKEN = 'test-token';
process.env.ADMIN_IDS = '900001';

const { db } = await import('../db.ts');
const { registerRead } = await import('./routes/read.ts');
const { registerSelf } = await import('./routes/self.ts');
const { Router } = await import('./router.ts');
const { HttpError } = await import('./errors.ts');

after(() => db.close());

test('итоги закрываются в понедельник по Москве и автоматически открываются один раз для ученика', (t) => {
    const router = new Router();
    registerRead(router);
    registerSelf(router);
    const end = Date.parse('2026-11-15T21:00:00Z');
    const start = Date.parse('2026-11-08T21:00:00Z');
    t.mock.timers.enable({ apis: ['Date'], now: end - 1 });

    db.exec("INSERT INTO users (id, tg_id, name) VALUES (1, 700001, 'Лера'), (2, 700002, 'Саша')");
    const task = db.prepare('INSERT INTO task_log (user_id, amount, created_at, source, cancelled) VALUES (?, ?, ?, ?, ?)');
    task.run(1, 12, start - 1, 'bot', 0);
    task.run(1, 25, start, 'bot', 0);
    task.run(1, 765, start, 'bot', 0);
    task.run(1, 7, end - 1, 'bot', 0);
    task.run(1, 50, end - 1, 'admin', 0);
    task.run(1, 10, end - 1, 'bot', 1);
    task.run(1, 5, end, 'bot', 0);
    task.run(2, 35, end - 1, 'bot', 0);
    const topic = db.prepare(`
        INSERT INTO topic_log (user_id, actor_tg_id, topic_no, from_status, to_status, created_at)
        VALUES (1, 700001, ?, 'done', 'reinforced', ?)
    `);
    topic.run(1, end - 1);
    topic.run(2, end);

    const student = { tgId: 700001, personId: 1, firstName: 'Лера', role: 'student' as const };
    function call(method: string, path: string, body: unknown = {}, viewer: Viewer = student) {
        const [pathname, query] = path.split('?');
        const route = router.match(method, pathname);
        assert.ok(route);
        return route.handler({ viewer, params: route.params, query: new URLSearchParams(query), body });
    }
    const profile = () => call('GET', '/api/profile/me') as ProfileDto;
    const open = (end: number, viewer = student) => call('POST', '/api/self/weekly-recap/open', { end }, viewer);

    assert.equal(profile().weeklyRecap?.end, start);
    assert.deepEqual(open(end), { open: false });

    t.mock.timers.tick(1);
    assert.deepEqual(profile().weeklyRecap, { start, end, tasks: 32, topics: 1, goal: 25, place: 2 });
    assert.equal(profile().week.tasks, 5);
    assert.equal(profile().currentWeekRecap?.tasks, 5);
    assert.equal(profile().currentWeekRecap?.topics, 1);
    assert.equal(profile().currentWeekRecap?.start, end);
    const guest = { ...student, role: 'guest', personId: null } as const;
    const guestProfile = call('GET', '/api/profile/1', {}, guest) as ProfileDto;
    assert.deepEqual(guestProfile.weeklyRecap, profile().weeklyRecap);
    assert.deepEqual(guestProfile.currentWeekRecap, profile().currentWeekRecap);
    assert.equal(guestProfile.studyRecaps?.season.inProgress, true);
    assert.equal(guestProfile.studyRecaps?.season.goals.tasks, 321);
    assert.equal(guestProfile.totals.tasks, 864);
    assert.deepEqual(open(end), { open: true });
    assert.deepEqual(open(end), { open: false });
    assert.equal(profile().weeklyRecap?.tasks, 32);
    assert.deepEqual(open(end, { ...student, tgId: 700002, personId: 2 }), { open: true });
    assert.throws(
        () => call('POST', '/api/self/weekly-recap/open', { end }, { ...student, role: 'guest', personId: null }),
        (error: unknown) => error instanceof HttpError && error.status === 403,
    );

    t.mock.timers.tick(end - start);
    assert.deepEqual(open(end), { open: false });
    assert.deepEqual(open(profile().weeklyRecap!.end), { open: true });
});

test('сезонные и годовые итоги закрываются по московскому времени и получают приоритет', (t) => {
    const router = new Router();
    registerRead(router);
    registerSelf(router);
    db.exec("INSERT INTO users (id, tg_id, name, exam) VALUES (3, 700003, 'Миша', 85)");
    const viewer = { tgId: 700003, personId: 3, firstName: 'Миша', role: 'student' as const };
    function call(method: string, path: string, body: unknown = {}) {
        const [pathname, query] = path.split('?');
        const route = router.match(method, pathname);
        assert.ok(route);
        return route.handler({ viewer, params: route.params, query: new URLSearchParams(query), body });
    }
    const fallEnd = Date.parse('2026-11-30T21:00:00Z');
    const winterEnd = Date.parse('2027-02-28T21:00:00Z');
    const yearEnd = Date.parse('2027-05-31T21:00:00Z');
    const fallStart = Date.parse('2026-08-31T21:00:00Z');
    const task = db.prepare('INSERT INTO task_log (user_id, amount, created_at) VALUES (3, ?, ?)');
    task.run(50, fallStart - 1);
    task.run(50, fallStart);
    task.run(50, fallStart);
    task.run(10, fallEnd);
    const exam = db.prepare('INSERT INTO exam_log (user_id, from_exam, to_exam, created_at) VALUES (3, ?, ?, ?)');
    exam.run(30, 55, fallEnd - 1);
    exam.run(55, 85, fallEnd);
    db.exec("INSERT INTO topic_status VALUES (3, 1, 'reinforced'), (3, 2, 'reinforced')");
    db.prepare(`INSERT INTO topic_log (user_id, topic_no, from_status, to_status, created_at)
        VALUES (3, 2, 'done', 'reinforced', ?)`).run(fallEnd);

    t.mock.timers.enable({ apis: ['Date'], now: fallEnd - 1 });
    const profile = () => call('GET', '/api/profile/me') as ProfileDto;
    function open() {
        const current = profile();
        return call('POST', '/api/self/recaps/open', {
            week: current.weeklyRecap?.end,
            season: current.studyRecaps?.season.end,
            year: current.studyRecaps?.year.end,
        });
    }
    assert.equal(profile().studyRecaps?.season.inProgress, true);
    assert.equal(profile().studyRecaps?.season.tasks, 100);
    const monthRanking = () => call('GET', '/api/arena?mode=month') as ArenaDto;
    const monthTasks = () => monthRanking().rows.find((row) => row.id === 3)?.tasks;
    assert.equal(monthTasks(), 0);
    assert.equal(profile().studyRecaps?.currentYear?.topics, 1);
    assert.equal(profile().studyRecaps?.currentYear?.goals.topics, 27);
    assert.equal(profile().studyRecaps?.currentYear?.inProgress, true);
    t.mock.timers.tick(1);
    assert.deepEqual(profile().studyRecaps?.season, {
        start: fallStart, end: fallEnd, tasks: 100, topics: 1, examBefore: 30, exam: 55,
        goals: { tasks: 321, topics: 16, exam: 67 }, pct: 31,
    });
    assert.equal(monthTasks(), 10);
    assert.equal(profile().studyRecaps?.currentYear?.topics, 2);
    assert.deepEqual(open(), { open: 'season' });
    assert.deepEqual(open(), { open: null });

    t.mock.timers.tick(winterEnd - fallEnd);
    assert.equal(profile().studyRecaps?.season.end, winterEnd);
    assert.equal(profile().studyRecaps?.season.start, fallEnd);
    assert.equal(profile().studyRecaps?.season.tasks, 110);
    assert.deepEqual(open(), { open: 'season' });

    t.mock.timers.tick(yearEnd - winterEnd);
    assert.equal(profile().studyRecaps?.season.end, yearEnd);
    assert.equal(profile().studyRecaps?.year.end, yearEnd);
    assert.equal(profile().studyRecaps?.year.start, fallStart);
    assert.equal(profile().studyRecaps?.year.topics, 2);
    assert.equal(profile().studyRecaps?.currentYear, undefined);
    assert.deepEqual(open(), { open: 'year' });
    assert.deepEqual(open(), { open: null });
    t.mock.timers.tick(7 * 86400_000);
    assert.deepEqual(open(), { open: 'week' });
});
