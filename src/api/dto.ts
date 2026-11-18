// Формы ответов API. Зеркало этих типов лежит в web/src/api/types.ts.
import { EXAM_MAX, TASKS_GOAL, TOPICS_TOTAL, WEEK_GOAL, monthGoal, monthPct, onTrack, visible, weekPct } from '../logic.ts';
import type { Ranked } from '../logic.ts';
import type { WeekStat } from '../store.ts';
import { statusOf } from '../status.ts';
import type { TopicStatus } from '../status.ts';

export type Standing = 'ontrack' | 'behind';

const standing = (r: Ranked, now: Date): Standing => (onTrack(r, now) ? 'ontrack' : 'behind');
const emptyWeek = (id: number): WeekStat => ({ userId: id, tasks: 0, topics: 0, active: false });

export interface MemberDto {
    id: number;
    name: string;
}

export const membersDto = (ranked: Ranked[], viewerTgId: number): MemberDto[] =>
    visible(ranked, viewerTgId).map((r) => ({ id: r.person.id, name: r.person.name }));

export interface ProfileDto {
    id: number;
    name: string;
    place: number;
    pct: number; // глобальный прогресс
    standing: Standing;
    week: { tasks: number; topics: number; goalPct: number }; // goalPct может быть больше 100
    month: {
        topics: { value: number; goal: number };
        tasks: { value: number; goal: number };
        exam: { value: number | null; goal: number };
    };
    canEdit: boolean;
}

export function profileDto(r: Ranked, week: WeekStat | undefined, now: Date, canEdit: boolean): ProfileDto {
    const p = r.person;
    const w = week ?? emptyWeek(p.id);
    const m = monthGoal(now);
    return {
        id: p.id,
        name: p.name,
        place: r.place,
        pct: r.pct,
        standing: standing(r, now),
        week: { tasks: w.tasks, topics: w.topics, goalPct: Math.round((w.tasks / WEEK_GOAL) * 100) },
        month: {
            topics: { value: p.reinforced.length, goal: m.topics },
            tasks: { value: p.tasksTotal, goal: m.tasks },
            exam: { value: p.exam, goal: m.exam },
        },
        canEdit,
    };
}

export interface WeekDto {
    leader: { name: string; pct: number; tasks: number; topics: number } | null;
    rows: { id: number; name: string; tasks: number; topics: number; goalPct: number }[];
}

export function weekDto(ranked: Ranked[], viewerTgId: number, week: Map<number, WeekStat>): WeekDto {
    // Лидер недели: по заданиям, при равенстве по задачам
    const best = [...week.values()]
        .filter((s) => s.active)
        .sort((a, b) => b.topics - a.topics || b.tasks - a.tasks)[0];
    const bestPerson = best ? ranked.find((r) => r.person.id === best.userId)?.person : undefined;

    const rows = visible(ranked, viewerTgId)
        .map((r) => {
            const w = week.get(r.person.id) ?? emptyWeek(r.person.id);
            return { id: r.person.id, name: r.person.name, tasks: w.tasks, topics: w.topics, goalPct: Math.round((w.tasks / WEEK_GOAL) * 100) };
        })
        .sort((a, b) => b.tasks - a.tasks || b.topics - a.topics);

    return {
        leader:
            best && bestPerson
                ? { name: bestPerson.name, pct: Math.round(weekPct(best)), tasks: best.tasks, topics: best.topics }
                : null,
        rows,
    };
}

export type ArenaMode = 'global' | 'month';

export interface ArenaDto {
    mode: ArenaMode;
    // Лидер года: первое место рейтинга
    leader: { name: string; pct: number; monthPct: number; exam: number | null; topics: number; tasks: number } | null;
    rows: { id: number; name: string; pct: number; standing: Standing }[];
}

export function arenaDto(ranked: Ranked[], viewerTgId: number, mode: ArenaMode, now: Date): ArenaDto {
    const first = ranked[0];
    return {
        mode,
        leader: first
            ? {
                  name: first.person.name,
                  pct: first.pct,
                  monthPct: monthPct(first, now),
                  exam: first.person.exam,
                  topics: first.person.reinforced.length,
                  tasks: first.person.tasksTotal,
              }
            : null,
        rows: visible(ranked, viewerTgId).map((r) => ({
            id: r.person.id,
            name: r.person.name,
            pct: mode === 'global' ? r.pct : monthPct(r, now),
            standing: standing(r, now),
        })),
    };
}

export interface SelfDto {
    topics: TopicStatus[]; // статусы заданий 1..27
    tasksTotal: number;
    tasksWeek: number;
    exam: number | null;
    limits: { topics: number; tasks: number; exam: number };
}

export function selfDto(r: Ranked): SelfDto {
    const p = r.person;
    return {
        topics: Array.from({ length: TOPICS_TOTAL }, (_, i) => statusOf(p, i + 1)),
        tasksTotal: p.tasksTotal,
        tasksWeek: p.tasksWeek,
        exam: p.exam,
        limits: { topics: TOPICS_TOTAL, tasks: TASKS_GOAL, exam: EXAM_MAX },
    };
}
