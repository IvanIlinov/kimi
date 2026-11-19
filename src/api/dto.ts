// Формы ответов API. Зеркало этих типов лежит в web/src/api/types.ts.
import { EXAM_MAX, TASKS_GOAL, TOPICS_TOTAL, WEEK_GOAL, monthGoal, monthPct, monthlyResults, onTrack, studyPeriod, visible, weekPct } from '../logic.ts';
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

export interface WeeklyRecapDto {
    start: number;
    end: number;
    tasks: number;
    topics: number;
    goal: number;
    place: number | null;
}

export function weeklyRecapDto(ranked: Ranked[], person: Ranked, stats: WeekStat[], start: number, end: number): WeeklyRecapDto {
    const week = new Map(stats.map((stat) => [stat.userId, stat]));
    const stat = week.get(person.person.id);
    const rows = weekDto(ranked, person.person.tgId, week, true).rows;
    return {
        start, end, goal: WEEK_GOAL,
        tasks: stat?.tasks ?? 0,
        topics: stat?.topics ?? 0,
        place: stat?.active ? rows.findIndex((row) => row.id === person.person.id) + 1 : null,
    };
}

export interface StudyRecapDto {
    start: number;
    end: number;
    tasks: number;
    topics: number;
    inProgress?: boolean;
    examBefore: number;
    exam: number;
    goals: { tasks: number; topics: number; exam: number };
    pct: number;
}

export interface ProfileDto {
    id: number;
    name: string;
    place: number;
    pct: number; // глобальный прогресс
    standing: Standing;
    monthPct: number;
    totals: { tasks: number; topics: number; exam: number | null };
    daysLeft: number;
    week: { tasks: number; topics: number; goal: number; goalPct: number }; // goalPct может быть больше 100
    month: {
        name: string;
        topics: { value: number; goal: number };
        tasks: { value: number; goal: number };
        exam: { value: number | null; goal: number };
    };
    canEdit: boolean;
    weeklyRecap?: WeeklyRecapDto;
    currentWeekRecap?: WeeklyRecapDto;
    studyRecaps?: { year: StudyRecapDto; season: StudyRecapDto; currentYear?: StudyRecapDto };
}

export function profileDto(r: Ranked, week: WeekStat | undefined, now: Date, canEdit: boolean): ProfileDto {
    const p = r.person;
    const w = week ?? emptyWeek(p.id);
    const m = monthGoal(now);
    const results = monthlyResults(p);
    const period = studyPeriod(now);
    return {
        id: p.id,
        name: p.name,
        place: r.place,
        pct: r.pct,
        standing: standing(r, now),
        monthPct: monthPct(r, now),
        totals: { tasks: p.tasksTotal, topics: p.reinforced.length, exam: p.exam },
        daysLeft: period.daysLeft,
        week: { tasks: w.tasks, topics: w.topics, goal: WEEK_GOAL, goalPct: Math.round((w.tasks / WEEK_GOAL) * 100) },
        month: {
            name: period.monthName,
            topics: { value: results.topics, goal: m.topics },
            tasks: { value: results.tasks, goal: m.tasks },
            exam: { value: results.exam, goal: m.exam },
        },
        canEdit,
    };
}

export interface WeekDto {
    leader: { name: string; pct: number; tasks: number; topics: number; goalPct: number } | null;
    rows: { id: number; name: string; tasks: number; topics: number; goalPct: number }[];
}

export function weekDto(ranked: Ranked[], viewerTgId: number, week: Map<number, WeekStat>, showAll = false): WeekDto {
    const ordered = ranked
        .map(({ person }) => ({ person, stat: week.get(person.id) ?? emptyWeek(person.id) }))
        .sort((a, b) => b.stat.tasks - a.stat.tasks || b.stat.topics - a.stat.topics);
    const first = ordered[0];
    const rows = (showAll ? ordered : visible(ordered, viewerTgId)).map(({ person, stat }) => ({
        id: person.id,
        name: person.name,
        tasks: stat.tasks,
        topics: stat.topics,
        goalPct: Math.round((stat.tasks / WEEK_GOAL) * 100),
    }));
    return {
        leader: first
            ? {
                  name: first.person.name,
                  pct: Math.round(weekPct(first.stat)),
                  tasks: first.stat.tasks,
                  topics: first.stat.topics,
                  goalPct: (first.stat.tasks / WEEK_GOAL) * 100,
              }
            : null,
        rows,
    };
}

export type ArenaMode = 'global' | 'month';

export interface ArenaDto {
    mode: ArenaMode;
    monthTaskGoal: number;
    monthTopicGoal: number;
    monthExamGoal: number;
    // Первое место в выбранном режиме
    leader: { name: string; pct: number; monthPct: number; exam: number | null; topics: number; tasks: number } | null;
    rows: { id: number; name: string; pct: number; tasks: number; standing: Standing }[];
}

export function arenaDto(ranked: Ranked[], viewerTgId: number, mode: ArenaMode, now: Date, showAll = false): ArenaDto {
    const ordered = ranked
        .map((r) => ({ ...r, monthPct: monthPct(r, now) }))
        .sort((a, b) => mode === 'global' ? b.pct - a.pct : b.monthPct - a.monthPct);
    const first = ordered[0];
    const results = first && (mode === 'month' ? monthlyResults(first.person) : {
        tasks: first.person.tasksTotal, topics: first.person.reinforced.length, exam: first.person.exam,
    });
    const goals = monthGoal(now);
    return {
        mode,
        monthTaskGoal: goals.tasks,
        monthTopicGoal: goals.topics,
        monthExamGoal: goals.exam,
        leader: first && results
            ? {
                  name: first.person.name,
                  pct: first.pct,
                  monthPct: first.monthPct,
                  exam: results.exam,
                  topics: results.topics,
                  tasks: mode === 'month' ? first.person.tasksThisMonth ?? 0 : results.tasks,
              }
            : null,
        rows: (showAll ? ordered : visible(ordered, viewerTgId)).map((r) => ({
            id: r.person.id,
            name: r.person.name,
            pct: mode === 'global' ? r.pct : r.monthPct,
            tasks: mode === 'month' ? r.person.tasksThisMonth ?? 0 : r.person.tasksTotal,
            standing: standing(r, now),
        })),
    };
}

export interface SelfDto {
    topics: TopicStatus[]; // статусы заданий 1..27
    tasksTotal: number;
    tasksWeek: number;
    exam: number | null;
    limits: { topics: number; tasks: number; week: number; exam: number };
}

export function selfDto(r: Ranked): SelfDto {
    const p = r.person;
    return {
        topics: Array.from({ length: TOPICS_TOTAL }, (_, i) => statusOf(p, i + 1)),
        tasksTotal: p.tasksTotal,
        tasksWeek: p.tasksWeek,
        exam: p.exam,
        limits: { topics: TOPICS_TOTAL, tasks: TASKS_GOAL, week: WEEK_GOAL, exam: EXAM_MAX },
    };
}
