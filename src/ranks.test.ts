import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TOPICS_TOTAL } from './logic.ts';
import { rankProgress, RANK_ROUTE } from './ranks.ts';

const all = RANK_ROUTE.flatMap(({ missions }) => missions);
const first = RANK_ROUTE[0].missions;

test('rank route contains every exam mission exactly once', () => {
    assert.deepEqual([...all].sort((a, b) => a - b), Array.from({ length: TOPICS_TOTAL }, (_, i) => i + 1));
});

test('first rank requires the designated missions, practice and exam score', () => {
    const differentMissions = [2, 3, 5, 6];
    const unqualified = rankProgress(differentMissions, 104, 40);
    assert.equal(unqualified.current.name, 'Пыль');
    assert.deepEqual(unqualified.next?.topics, { value: 0, goal: 4 });
    assert.equal(rankProgress(first, 103, 40).current.name, 'Пыль');
    assert.equal(rankProgress(first, 104, 39).current.name, 'Пыль');
    assert.equal(rankProgress(first, 104, null).current.name, 'Пыль');
    assert.equal(rankProgress(first, 104, 40).current.name, 'Неофит');
});

test('Grand requires all mission stages, 900 solved tasks and a score of 100', () => {
    assert.equal(rankProgress(all.slice(0, -1), 900, 100).current.name, 'Младший Магистр');
    assert.equal(rankProgress(all, 899, 100).current.name, 'Старший Магистр');
    assert.equal(rankProgress(all, 900, 99).current.name, 'Младший Магистр');
    assert.deepEqual(rankProgress(all, 900, 100), { current: { level: 8, name: 'Гранд' }, next: null });
});
