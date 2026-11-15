import { db } from './db.ts';
import type { Person } from './logic.ts';

interface UserRow {
    id: number;
    tg_id: number;
    name: string;
    exam: number | null;
    comment: string;
}

export function getPersons(): Person[] {
    const users = db
        .prepare('SELECT id, tg_id, name, exam, comment FROM users WHERE removed = 0 ORDER BY id')
        .all() as unknown as UserRow[];

    // Статусы всех заданий одним запросом
    const statuses = db
        .prepare('SELECT user_id, topic_no, status FROM topic_status')
        .all() as unknown as { user_id: number; topic_no: number; status: string }[];

    // Сумма решённых задач: всего и за текущую неделю (с понедельника 00:00 по Москве)
    const totals = db
        .prepare(`
            SELECT user_id,
                   SUM(amount) AS total,
                   SUM(CASE WHEN created_at >= ? THEN amount ELSE 0 END) AS week
            FROM task_log
            WHERE cancelled = 0
            GROUP BY user_id
        `)
        .all(weekStartMs(Date.now())) as unknown as { user_id: number; total: number; week: number }[];

    const totalsById = new Map(totals.map((t) => [t.user_id, t]));

    return users.map((u) => {
        const mine = statuses.filter((s) => s.user_id === u.id);
        const pick = (st: string) => mine.filter((s) => s.status === st).map((s) => s.topic_no);
        const t = totalsById.get(u.id);

        return {
            id: u.id,
            tgId: u.tg_id,
            name: u.name,
            exam: u.exam,
            comment: u.comment,
            studied: pick('done'),
            learning: pick('learning'),
            tasksTotal: Number(t?.total ?? 0),
            tasksWeek: Number(t?.week ?? 0),
        };
    });
}

// Начало текущей недели: понедельник 00:00 по Москве, в UTC-миллисекундах
export function weekStartMs(now: number): number {
    const msk = new Date(now + 3 * 3600e3);
    const dow = (msk.getUTCDay() + 6) % 7; // понедельник = 0
    return Date.UTC(msk.getUTCFullYear(), msk.getUTCMonth(), msk.getUTCDate() - dow) - 3 * 3600e3;
}

export interface WeekStat {
    userId: number;
    tasks: number;   // решено задач за неделю (с учётом отмен)
    topics: number;  // изменение числа изученных заданий за неделю
    active: boolean; // было ли хоть одно действие
}

export function getWeekStats(now: number = Date.now()): WeekStat[] {
    const from = weekStartMs(now);
    const stats = new Map<number, WeekStat>();

    const get = (userId: number): WeekStat => {
        let s = stats.get(userId);
        if (!s) {
            s = { userId, tasks: 0, topics: 0, active: false };
            stats.set(userId, s);
        }
        return s;
    };

    const taskRows = db
        .prepare(`
            SELECT user_id, SUM(amount) AS total, COUNT(*) AS n
            FROM task_log
            WHERE cancelled = 0 AND created_at >= ?
            GROUP BY user_id
        `)
        .all(from) as unknown as { user_id: number; total: number; n: number }[];

    for (const r of taskRows) {
        const s = get(r.user_id);
        s.tasks = Number(r.total);
        s.active ||= Number(r.n) > 0;
    }

    // Изучено: +1 при переходе в done, −1 при уходе из done
    const topicRows = db
        .prepare(`
            SELECT user_id,
                   SUM(CASE WHEN to_status = 'done' THEN 1 ELSE 0 END)
                 - SUM(CASE WHEN from_status = 'done' THEN 1 ELSE 0 END) AS delta,
                   COUNT(*) AS n
            FROM topic_log
            WHERE created_at >= ?
            GROUP BY user_id
        `)
        .all(from) as unknown as { user_id: number; delta: number; n: number }[];

    for (const r of topicRows) {
        const s = get(r.user_id);
        s.topics = Number(r.delta);
        s.active ||= Number(r.n) > 0;
    }

    return [...stats.values()];
}