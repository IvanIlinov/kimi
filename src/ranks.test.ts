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

test('King requires the complete route, 900 solved tasks and at least 79 on the mock exam', () => {
    assert.equal(rankProgress(all.slice(0, -1), 900, 100).current.name, 'Архимаг');
    assert.equal(rankProgress(all, 899, 100).current.name, 'Гранд');
    assert.equal(rankProgress(all, 900, 78).current.name, 'Гранд');
});

test('King classes change at 80, 95 and exactly 100', () => {
    for (const [score, kingClass] of [[79, 'B'], [80, 'A'], [94, 'A'], [95, 'S'], [99, 'S'], [100, 'SSS']] as const) {
        assert.deepEqual(rankProgress(all, 900, score), {
            current: { level: 8, name: 'Король', kingClass },
            next: null,
        });
    }
});
