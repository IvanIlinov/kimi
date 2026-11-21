import { MONTH_GOALS } from './logic.ts';

const stages = [
    { name: 'Неофит', sector: 'Врата', missions: [4, 7, 11, 1], month: 0 },
    { name: 'Практик', sector: 'Кристальный архив', missions: [18, 3, 22, 10, 6, 12], month: 1 },
    { name: 'Эксперт', sector: 'Узел связи', missions: [17, 9, 8], month: 2 },
    { name: 'Мастер', sector: 'Рунный реактор', missions: [14, 13, 2, 15, 5], month: 3 },
    { name: 'Магистр', sector: 'Башня алгоритмов', missions: [16, 23, 19, 20, 21], month: 4, exam: 76 },
    { name: 'Архимаг', sector: 'Орбитальный рубеж', missions: [25, 27], month: 5, exam: 77 },
    { name: 'Гранд', sector: 'Сердце цитадели', missions: [24, 26], month: 7, exam: 78 },
    { name: 'Король', sector: null, missions: [], month: 8, exam: 79 },
];

export const KING_CLASSES = [
    { label: 'B', min: 0 },
    { label: 'A', min: 80 },
    { label: 'S', min: 95 },
    { label: 'SSS', min: 100 },
] as const;

export type KingClass = typeof KING_CLASSES[number]['label'];

export const RANK_ROUTE = stages.flatMap(({ name, sector, missions }) =>
    sector === null ? [] : [{ rank: name, name: sector, missions }],
);

export const RANK_REQUIREMENTS = stages.map(({ name, month, exam }, index) => ({
    level: index + 1,
    name,
    missions: stages.slice(0, index + 1).flatMap(({ missions }) => missions),
    tasks: MONTH_GOALS[month].tasks,
    exam: exam ?? MONTH_GOALS[month].exam,
}));

export function rankProgress(reinforced: readonly number[], tasks: number, exam: number | null) {
    const secured = new Set(reinforced);
    const score = exam ?? 0;
    let current = { level: 0, name: 'Пыль' };
    for (const rank of RANK_REQUIREMENTS) {
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
    const kingClass = KING_CLASSES.reduce<KingClass>((label, tier) => score >= tier.min ? tier.label : label, 'B');
    return { current: { ...current, kingClass }, next: null };
}
