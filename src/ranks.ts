import { MONTH_GOALS } from './logic.ts';

const stages = [
    { name: 'Неофит', sector: 'Врата', missions: [4, 7, 11, 1], month: 0 },
    { name: 'Студент', sector: 'Кристальный архив', missions: [18, 3, 22, 10, 6, 12], month: 1 },
    { name: 'Практик', sector: 'Узел связи', missions: [17, 9, 8], month: 2 },
    { name: 'Эксперт', sector: 'Рунный реактор', missions: [14, 13, 2, 15, 5], month: 3 },
    { name: 'Мастер', sector: 'Башня алгоритмов', missions: [16, 23, 19, 20, 21], month: 4 },
    { name: 'Младший Магистр', sector: 'Орбитальный рубеж', missions: [25, 27], month: 5 },
    { name: 'Старший Магистр', sector: 'Сердце цитадели', missions: [24, 26], month: 7 },
    { name: 'Гранд', sector: null, missions: [], month: 8 },
];

export const RANK_ROUTE = stages.flatMap(({ name, sector, missions }) =>
    sector === null ? [] : [{ rank: name, name: sector, missions }],
);

const ranks = stages.map(({ name, month }, index) => ({
    level: index + 1,
    name,
    missions: stages.slice(0, index + 1).flatMap(({ missions }) => missions),
    tasks: MONTH_GOALS[month].tasks,
    exam: MONTH_GOALS[month].exam,
}));

export function rankProgress(reinforced: readonly number[], tasks: number, exam: number | null) {
    const secured = new Set(reinforced);
    const score = exam ?? 0;
    let current = { level: 0, name: 'Пыль' };
    for (const rank of ranks) {
        const topics = rank.missions.filter((number) => secured.has(number)).length;
        if (topics < rank.missions.length || tasks < rank.tasks || score < rank.exam) {
            return {
                current,
                next: {
                    name: rank.name,
                    topics: { value: topics, goal: rank.missions.length },
                    tasks: { value: tasks, goal: rank.tasks },
                    exam: { value: score, goal: rank.exam },
                },
            };
        }
        current = { level: rank.level, name: rank.name };
    }
    return { current, next: null };
}
