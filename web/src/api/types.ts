// Формы ответов API. Зеркало src/api/dto.ts на сервере: при изменении правятся оба файла.

export type Role = 'admin' | 'student' | 'guest';
export type Standing = 'ontrack' | 'behind';
export type TopicStatus = 'done' | 'learning' | 'todo' | 'reinforced';

export interface Me {
    role: Role;
    name: string;
    personId: number | null;
}

export interface Member {
    id: number;
    name: string;
}

export interface Profile {
    id: number;
    name: string;
    place: number;
    pct: number;
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
}

export interface Week {
    leader: { name: string; pct: number; tasks: number; topics: number; goalPct?: number } | null;
    rows: { id: number; name: string; tasks: number; topics: number; goalPct: number }[];
}

export type ArenaMode = 'global' | 'month';

export interface Arena {
    mode: ArenaMode;
    monthTaskGoal: number;
    monthTopicGoal?: number;
    monthExamGoal?: number;
    leader: { name: string; pct: number; monthPct: number; exam: number | null; topics: number; tasks: number } | null;
    rows: { id: number; name: string; pct: number; tasks: number; standing: Standing }[];
}

export interface SelfData {
    topics: TopicStatus[];
    tasksTotal: number;
    tasksWeek: number;
    exam: number | null;
    limits: { topics: number; tasks: number; week: number; exam: number };
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
