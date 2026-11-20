import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { challengeFor } from '../challenge-catalog.ts';
import type { Viewer } from './context.ts';
import type { SelfDto } from './dto.ts';

process.env.DB_PATH = ':memory:';
process.env.BOT_TOKEN = 'test-token';
process.env.ADMIN_IDS = '900001';
process.env.GROUP_CHAT_ID = '0';

const { db } = await import('../db.ts');
const { Router } = await import('./router.ts');
const { registerSelf } = await import('./routes/self.ts');
const { HttpError } = await import('./errors.ts');

after(() => db.close());

test('task 11 preserves the timer, unlocks practice and credits each exercise once', (t) => {
    const clock = Date.now();
    t.mock.timers.enable({ apis: ['Date'], now: clock });
    db.exec("INSERT INTO users (id, tg_id, name) VALUES (1, 700001, 'Лера'), (2, 700002, 'Саша')");
    const router = new Router();
    registerSelf(router);
    const student: Viewer = { role: 'student', personId: 1, tgId: 700001, firstName: 'Лера' };
    const other: Viewer = { role: 'student', personId: 2, tgId: 700002, firstName: 'Саша' };
    const path = '/api/self/challenges/11';

    function call(method: string, path: string, body: unknown = {}, viewer = student) {
        const route = router.match(method, path);
        assert.ok(route);
        return route.handler({ viewer, params: route.params, query: new URLSearchParams(), body });
    }
    let attemptStartedAt = clock;
    function answer(exercise: { id: string; answer: number }, value = exercise.answer, startedAt = attemptStartedAt) {
        return call('POST', path + '/answer', { exercise: exercise.id, answer: value, startedAt }) as {
            result: string; credited: boolean; self: SelfDto; explanation: string | null;
        };
    }

    const course = challengeFor(11)!;
    assert.throws(() => call('POST', '/api/self/topics/11/cycle'), (err) => err instanceof HttpError && err.status === 403);
    assert.throws(() => call('GET', path, {}, { ...student, role: 'guest' }), (err) => err instanceof HttpError && err.status === 403);
    assert.equal(answer(course.practice[0]).result, 'stale');

    const started = call('POST', path + '/start') as { self: SelfDto; challenge: { timer: object } };
    assert.equal(started.self.topics[10], 'learning');
    assert.deepEqual(started.challenge.timer, { startedAt: clock, deadline: clock + course.limitMs, finishedAt: null, asOf: clock });
    t.mock.timers.tick(12_000);
    const resumed = call('POST', path + '/start') as typeof started;
    assert.deepEqual(resumed.challenge.timer, { startedAt: clock, deadline: clock + course.limitMs, finishedAt: null, asOf: clock + 12_000 });
    const wrong = answer(course.lesson[0], 0);
    assert.equal(wrong.result, 'wrong');
    assert.equal(wrong.explanation, null);
    const initial = call('GET', path) as { exercise: object };
    assert.equal('answer' in initial.exercise, false);
    assert.equal(answer(course.lesson[0]).result, 'solved');
    t.mock.timers.tick(course.limitMs - 12_000);
    assert.equal(answer(course.lesson[1]).result, 'expired');
    const expired = call('POST', path + '/start') as { challenge: { expired: boolean; exercise: null } };
    assert.equal(expired.challenge.expired, true);
    assert.equal(expired.challenge.exercise, null);
    const restarted = call('POST', path + '/start', { restart: true }) as {
        challenge: { expired: boolean; lesson: { solved: number }; timer: { startedAt: number } };
    };
    assert.equal(restarted.challenge.expired, false);
    assert.equal(restarted.challenge.lesson.solved, 0);
    attemptStartedAt = restarted.challenge.timer.startedAt;
    assert.equal(answer(course.lesson[0], course.lesson[0].answer, clock).result, 'stale');

    for (const exercise of course.lesson) assert.equal(answer(exercise).credited, false);
    t.mock.timers.tick(9_000);
    const lesson = call('GET', path) as { phase: string; practice: { solved: number }; timer: object };
    assert.equal(lesson.phase, 'practice');
    assert.equal(lesson.practice.solved, 0);
    assert.deepEqual(lesson.timer, {
        startedAt: attemptStartedAt, deadline: attemptStartedAt + course.limitMs,
        finishedAt: attemptStartedAt, asOf: attemptStartedAt + 9_000,
    });
    assert.equal((call('GET', '/api/self') as SelfDto).topics[10], 'done');

    for (const [i, exercise] of course.practice.entries()) {
        const success = answer(exercise);
        assert.equal(success.credited, true);
        assert.equal(success.self.tasksTotal, i + 1);
        assert.equal(success.self.topics[10], i === 9 ? 'reinforced' : 'done');
        assert.equal(answer(exercise).credited, false);
    }
    assert.equal((call('GET', path) as { phase: string }).phase, 'complete');
    assert.equal((call('GET', path, {}, other) as { phase: string }).phase, 'lesson');
    assert.equal((call('GET', '/api/self') as SelfDto).tasksTotal, 10);
});
