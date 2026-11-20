import { test } from 'node:test';
import assert from 'node:assert/strict';
import { studyCore } from './study-core.ts';

const time = (date: string) => Date.parse(`${date}T00:00:00+03:00`);

test('a week belongs to the month containing its last study day', () => {
    const monday = time('2026-09-28');
    const totals = new Map([[monday, 25]]);
    const { seasons: [fall] } = studyCore(time('2026-10-01'), totals);
    const [september, october] = fall.months;
    assert.equal(september.closed, true);
    assert.equal(september.crystals.some(({ start }) => start === monday), false);
    assert.deepEqual(october.crystals[0], {
        start: monday, end: time('2026-10-05'), goal: 25, tasks: 25, state: 'lit',
    });
    assert.equal(october.closed, false);
});

test('academic year closes at Moscow midnight, with prorated boundary weeks and three finished segments', () => {
    const firstStart = time('2026-09-01');
    const firstWeek = time('2026-08-31');
    const lastWeek = time('2027-05-31');
    const end = time('2027-06-01');
    const totals = new Map([[firstWeek, 21], [lastWeek, 4]]);
    const active = studyCore(end - 1, totals);
    assert.equal(active.closed, false);
    assert.equal(active.seasons[0].months[0].crystals[0].start, firstStart);
    assert.equal(active.seasons[0].months[0].crystals[0].goal, 22);
    assert.equal(active.seasons[0].months[0].crystals[0].state, 'missed');
    const finished = studyCore(end, totals);
    assert.equal(finished.year, 2026);
    assert.equal(finished.closed, true);
    assert.equal(finished.seasons.every(({ closed }) => closed), true);
    assert.deepEqual(finished.seasons[2].months[2].crystals.at(-1), {
        start: lastWeek, end, goal: 4, tasks: 4, state: 'lit',
    });
    assert.equal(studyCore(time('2027-09-01'), new Map()).year, 2027);
});
