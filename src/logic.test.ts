import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    progressPct,
    xp,
    rank,
    leadParts,
    monthPct,
    onTrack,
    type Person,
} from './logic.ts';

const base: Person = {
    id: 1,
    tgId: 1001,
    name: 'Тест',
    exam: null,
    tasksTotal: 0,
    tasksWeek: 0,
    done: [],
    reinforced: [],
    learning: [],
    comment: '',
};

const now = new Date('2026-11-18T12:00:00Z');

test('зелёные done не учитываются в итоговом прогрессе и рейтинге', () => {
    const empty = { ...base };
    const green = { ...base, done: Array.from({ length: 27 }, (_, i) => i + 1) };

    assert.equal(progressPct(green), progressPct(empty));
    assert.equal(xp(green), xp(empty));
    assert.deepEqual(leadParts(green, now), leadParts(empty, now));
    assert.equal(monthPct(rank([green])[0], now), monthPct(rank([empty])[0], now));
    assert.equal(onTrack(rank([green])[0], now), onTrack(rank([empty])[0], now));
});

test('синие reinforced учитываются в прогрессе, XP и месячной цели', () => {
    const blue = { ...base, reinforced: [1] };

    assert.equal(xp(blue) - xp(base), 100);
    assert.ok(progressPct(blue) > progressPct(base));
    assert.ok(monthPct(rank([blue])[0], now) > monthPct(rank([base])[0], now));
    const blueLead = leadParts(blue, now).topics;
    const baseLead = leadParts(base, now).topics;
    assert.notEqual(blueLead, null);
    assert.notEqual(baseLead, null);
    assert.equal(blueLead! - baseLead!, 1);
});

test('зелёные и синие статусы хранятся независимо', () => {
    const person = {
        ...base,
        done: [1, 2],
        reinforced: [3],
        learning: [4],
    };

    assert.equal(progressPct(person), progressPct({ ...base, reinforced: [3] }));
    assert.equal(xp(person), xp({ ...base, reinforced: [3] }));
});
