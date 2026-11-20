// Формы ответов API. Зеркало src/api/dto.ts на сервере: при изменении правятся оба файла.

export type Role = 'admin' | 'student' | 'guest';
export type Standing = 'ontrack' | 'behind';
export type TopicStatus = 'done' | 'learning' | 'todo' | 'reinforced';

export interface StudyRank {
    current: { level: number; name: string };
    next: {
        name: string;
        topics: RankMetric;
        tasks: RankMetric;
        exam: RankMetric;
    } | null;
}

export interface RankMetric {
    value: number;
    goal: number;
}

export interface RankSector {
    name: string;
    rank?: string;
    missions: number[];
}

export interface CoreCrystal {
    start: number;
    end: number;
    goal: number;
    tasks: number;
    state: 'future' | 'charging' | 'lit' | 'missed';
}

export interface CoreMonth {
    start: number;
    closed: boolean;
    crystals: CoreCrystal[];
}

export interface StudyCore {
    year: number;
    asOf: number;
    closed: boolean;
    seasons: { closed: boolean; months: CoreMonth[] }[];
}

export interface CrystalCelebrationData {
    core: StudyCore;
    week: number;
}

export interface Me {
    role: Role;
    name: string;
    personId: number | null;
}

export interface Member {
    id: number;
    name: string;
}

export interface WeeklyRecap {
    start: number;
    end: number;
    tasks: number;
    topics: number;
    goal: number;
    place: number | null;
}

export interface StudyRecap {
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

export interface Profile {
    id: number;
    name: string;
    place: number;
    pct: number;
    rank?: StudyRank;
    core?: StudyCore;
    previousCore?: StudyCore;
    standing: Standing;
    monthPct: number;
    totals: { tasks: number; topics: number; exam: number | null };
    daysLeft: number;
    week: { tasks: number; topics: number; goal: number; goalPct: number };
    month: {
        name: string;
        topics: { value: number; goal: number };
        tasks: { value: number; goal: number };
        exam: { value: number | null; goal: number };
    };
    canEdit: boolean;
    weeklyRecap?: WeeklyRecap;
    currentWeekRecap?: WeeklyRecap;
    studyRecaps?: { year: StudyRecap; season: StudyRecap; currentYear?: StudyRecap };
}

export interface Week {
    leader: { name: string; pct: number; tasks: number; topics: number; goalPct?: number; rank?: StudyRank['current'] } | null;
    rows: { id: number; name: string; tasks: number; topics: number; goalPct: number; rank?: StudyRank['current'] }[];
}

export type ArenaMode = 'global' | 'month';

export interface Arena {
    mode: ArenaMode;
    monthTaskGoal: number;
    monthTopicGoal?: number;
    monthExamGoal?: number;
    leader: { name: string; pct: number; monthPct: number; exam: number | null; topics: number; tasks: number; rank?: StudyRank['current'] } | null;
    rows: { id: number; name: string; pct: number; tasks: number; rank?: StudyRank['current'] }[];
}

export interface SelfData {
    topics: TopicStatus[];
    challengeTopics?: number[];
    tasksTotal: number;
    tasksWeek: number;
    exam: number | null;
    rank?: StudyRank;
    rankRoute?: RankSector[];
    limits: { topics: number; tasks: number; week: number; exam: number };
}

export interface ChallengeProgress {
    title: string;
    phase: 'lesson' | 'practice' | 'complete';
    lesson: { solved: number; total: number };
    practice: { solved: number; total: number };
    limitMs: number;
    expired: boolean;
    timer: { startedAt: number; finishedAt: number | null; deadline: number; asOf: number } | null;
    exercise: { id: string; title: string; prompt: string; hint: string } | null;
}

export interface AdminMember {
    id: number;
    tgId: number;
    name: string;
    exam: number | null;
    removed: boolean;
    tasksTotal: number;
    topics: TopicStatus[];
}

export interface HistoryDay {
    day: number;
    rows: {
        id: number;
        name: string;
        pct: number;
        tasks: number;
        topics: number;
        examBefore: number | null;
        examAfter: number | null;
    }[];
}

export type LessonStatus = 'planned' | 'held' | 'paid';

export interface Lesson {
    id: number;
    weekday: number;
    time: string;
    name: string;
    status: LessonStatus;
    priceKopecks: number;
}

export interface AdminHome {
    previewEnabled: boolean;
    weekStart: number;
    month: { start: number; earnedKopecks: number; plannedKopecks?: number };
    attendance: { visits: number; visitors: number; participants: number };
    lessons: Lesson[];
}
