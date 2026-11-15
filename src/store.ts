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
function weekStartMs(now: number): number {
    const msk = new Date(now + 3 * 3600e3);
    const dow = (msk.getUTCDay() + 6) % 7; // понедельник = 0
    return Date.UTC(msk.getUTCFullYear(), msk.getUTCMonth(), msk.getUTCDate() - dow) - 3 * 3600e3;
}