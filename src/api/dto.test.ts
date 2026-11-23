import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rank } from '../logic.ts';
import type { Person } from '../logic.ts';
import type { WeekStat } from '../store.ts';
import { arenaDto, weekDto } from './dto.ts';

const now = new Date('2026-09-20T12:00:00Z');

function person(id: number, overrides: Partial<Person> = {}): Person {
    return {
        id, tgId: id + 100, name: `Игрок ${id}`, exam: null, tasksTotal: 0, tasksWeek: 0,
        done: [], reinforced: [], learning: [], comment: '',
        ...overrides,
    };
}

test('global and monthly standings choose their own leaders before selecting the top ten', () => {
    const others = Array.from({ length: 10 }, (_, i) => person(i + 3, { tasksTotal: 2000 }));
    const globalLeader = person(1, { tasksTotal: 900, exam: 20 });
    const monthLeader = person(2, { tasksTotal: 104, exam: 40, reinforced: [1, 2, 3, 4, 5, 6] });
    const ranked = rank([...others, globalLeader, monthLeader]);
    assert.ok(ranked.slice(0, 10).every(({ person }) => person.id > 2));

    const global = arenaDto(ranked, monthLeader.tgId, 'global', now);
    assert.equal(global.rows[0].id, globalLeader.id);
    assert.equal(global.leader?.name, globalLeader.name);
    assert.equal(global.rows.length, 11);
    assert.equal(global.rows.at(-1)?.id, monthLeader.id);

    const month = arenaDto(ranked, monthLeader.tgId, 'month', now);
    assert.equal(month.rows[0].id, monthLeader.id);
    assert.equal(month.leader?.name, monthLeader.name);
    assert.equal(month.rows[0].pct, 100);
    assert.equal(month.rows.length, 10);
    for (const mode of ['global', 'month'] as const) {
        assert.equal(arenaDto(ranked, -1, mode, now, true).rows.length, ranked.length);
    }
});

test('weekly standings sort by tasks then reinforced delta before selecting the top ten', () => {
    const people = Array.from({ length: 13 }, (_, i) => person(i + 1, { tasksTotal: 1000 - i, exam: 90 - i }));
    const stats = new Map<number, WeekStat>([
        [1, { userId: 1, tasks: 8, topics: 5, active: true }],
        [12, { userId: 12, tasks: 10, topics: 1, active: true }],
        [13, { userId: 13, tasks: 10, topics: 2, active: true }],
        [99, { userId: 99, tasks: 100, topics: 10, active: true }],
    ]);
    const week = weekDto(rank(people), people[10].tgId, stats);

    assert.deepEqual(week.rows.slice(0, 3).map((row) => row.id), [13, 12, 1]);
    assert.equal(week.leader?.name, people[12].name);
    assert.equal(week.leader?.exam, 78);
    assert.equal(week.leader?.topics, 2);
    assert.equal(week.leader?.tasks, 10);
    assert.equal(week.rows.length, 11);
    assert.equal(week.rows.at(-1)?.id, 11);
});
