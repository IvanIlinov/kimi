import { db } from './db.ts';
import { MAX_TASKS_PER_ENTRY, monthStartMs, weekPct, weekStartMs } from './logic.ts';
import type { Person } from './logic.ts';
export { weekStartMs } from './logic.ts';

interface UserRow {
    id: number;
    tg_id: number;
    name: string;
    exam: number | null;
    comment: string;
    month_exam: number | null;
}

export function getPersons(): Person[] {
    const users = db
        .prepare(`
            SELECT id, tg_id, name, exam, comment,
                CASE WHEN EXISTS (SELECT 1 FROM exam_log c WHERE c.user_id = u.id AND c.is_correction = 1)
                    THEN (SELECT CASE WHEN e.is_correction = 1 THEN e.from_exam ELSE e.to_exam END
                          FROM exam_log e WHERE e.user_id = u.id
                          ORDER BY e.is_correction,
                              CASE WHEN e.is_correction = 1 THEN e.id ELSE -e.id END LIMIT 1)
                    ELSE exam END AS month_exam
            FROM users u WHERE removed = 0 ORDER BY id
        `)
        .all() as unknown as UserRow[];

    // Статусы всех заданий одним запросом
    const statuses = db
        .prepare('SELECT user_id, topic_no, status FROM topic_status')
        .all() as unknown as { user_id: number; topic_no: number; status: string }[];

    // Стартовые суммы в старых данных превышают лимит записи и входят только в накопительные показатели.
    // Текущая неделя начинается в понедельник в 00:00 по Москве.
    const now = Date.now();
    const totals = db
        .prepare(`
            SELECT user_id,
                   SUM(amount) AS total,
                   SUM(CASE WHEN source <> 'admin' THEN amount ELSE 0 END) AS month_total,
                   SUM(CASE
                       WHEN created_at BETWEEN ? AND ?
                        AND source <> 'admin'
                        AND ABS(amount) <= ?
                        AND (actor_tg_id IS NULL OR actor_tg_id = (
                            SELECT tg_id FROM users WHERE id = task_log.user_id
                        ))
                       THEN amount ELSE 0
                   END) AS tasks_this_month,
                   SUM(CASE
                       WHEN created_at >= ?
                        AND source <> 'admin'
                        AND ABS(amount) <= ?
                        AND (actor_tg_id IS NULL OR actor_tg_id = (
                            SELECT tg_id FROM users WHERE id = task_log.user_id
                        ))
                       THEN amount ELSE 0
                   END) AS week
            FROM task_log
            WHERE cancelled = 0
            GROUP BY user_id
        `)
        .all(monthStartMs(now), now, MAX_TASKS_PER_ENTRY, weekStartMs(now), MAX_TASKS_PER_ENTRY) as unknown as {
            user_id: number; total: number; week: number; month_total: number; tasks_this_month: number;
        }[];

    const totalsById = new Map(totals.map((t) => [t.user_id, t]));

    return users.map((u) => {
        const mine = statuses.filter((s) => s.user_id === u.id);
        const pick = (st: string) => mine.filter((s) => s.status === st).map((s) => s.topic_no);
        const t = totalsById.get(u.id);
        const reinforced = pick('reinforced');

        return {
            id: u.id,
            tgId: u.tg_id,
            name: u.name,
            exam: u.exam,
            comment: u.comment,
            done: pick('done'),
            reinforced,
            learning: pick('learning'),
            tasksTotal: Number(t?.total ?? 0),
            tasksWeek: Number(t?.week ?? 0),
            tasksThisMonth: Math.max(0, Number(t?.tasks_this_month ?? 0)),
            monthResults: {
                tasks: Math.max(0, Number(t?.month_total ?? 0)),
                topics: reinforced.length,
                exam: u.month_exam,
            },
        };
    });
}

export interface WeekStat {
    userId: number;
    tasks: number;   // решено задач за неделю (с учётом отмен)
    topics: number;  // изменение числа закреплённых заданий за неделю
    active: boolean; // было ли хоть одно действие
}

// Статус до правки для подсчёта работы ученика без административных корректировок.
const creditedTopicFromStatus = `CASE WHEN EXISTS (
    SELECT 1 FROM topic_log c
    WHERE c.user_id = t.user_id AND c.topic_no = t.topic_no
      AND c.id < t.id AND c.is_correction = 1
) THEN (
    SELECT CASE WHEN p.is_correction = 1 THEN p.from_status ELSE p.to_status END
    FROM topic_log p
    WHERE p.user_id = t.user_id AND p.topic_no = t.topic_no AND p.id < t.id
    ORDER BY p.is_correction,
             CASE WHEN p.is_correction = 1 THEN p.id ELSE -p.id END
    LIMIT 1
) ELSE t.from_status END`;

export function getWeekStats(now: number = Date.now(), until: number | null = null): WeekStat[] {
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
            SELECT t.user_id, SUM(t.amount) AS total, COUNT(*) AS n
            FROM task_log t
            JOIN users u ON u.id = t.user_id
            WHERE t.cancelled = 0
              AND t.created_at >= ?
              AND (? IS NULL OR t.created_at < ?)
              AND t.source <> 'admin'
              AND ABS(t.amount) <= ?
              AND (t.actor_tg_id IS NULL OR t.actor_tg_id = u.tg_id)
            GROUP BY t.user_id
        `)
        .all(from, until, until, MAX_TASKS_PER_ENTRY) as unknown as { user_id: number; total: number; n: number }[];

    for (const r of taskRows) {
        const s = get(r.user_id);
        s.tasks = Number(r.total);
        s.active ||= Number(r.n) > 0;
    }

    // Закреплено: +1 при переходе в reinforced, −1 при уходе из reinforced
    const topicRows = db
        .prepare(`
            SELECT t.user_id,
                   SUM(CASE WHEN t.to_status = 'reinforced' THEN 1 ELSE 0 END)
                 - SUM(CASE WHEN ${creditedTopicFromStatus} = 'reinforced' THEN 1 ELSE 0 END) AS delta,
                   COUNT(*) AS n
            FROM topic_log t
            JOIN users u ON u.id = t.user_id
            WHERE t.created_at >= ?
              AND (? IS NULL OR t.created_at < ?)
              AND t.is_correction = 0
              AND (t.actor_tg_id IS NULL OR t.actor_tg_id = u.tg_id)
            GROUP BY t.user_id
        `)
        .all(from, until, until) as unknown as { user_id: number; delta: number; n: number }[];

    for (const r of topicRows) {
        const s = get(r.user_id);
        s.topics = Number(r.delta);
        s.active ||= Number(r.n) > 0;
    }

    return [...stats.values()];
}

export interface JournalEntry {
    at: number;
    name: string;
    tgId: number;
    kind: 'task' | 'topic';
    amount: number;
    topicNo: number;
    from: string;
    to: string;
    actorTgId: number | null;
    source: 'bot' | 'group' | 'admin';
}

export function getJournal(limit: number, offset: number): JournalEntry[] {
    const rows = db
        .prepare(`
            SELECT j.at, u.name, u.tg_id, j.kind, j.amount, j.topic_no,
                   j.from_status, j.to_status, j.actor_tg_id, j.source
            FROM (
                SELECT created_at AS at, user_id, 'task' AS kind, amount,
                       NULL AS topic_no, NULL AS from_status, NULL AS to_status,
                       actor_tg_id, source
                FROM task_log
                WHERE cancelled = 0
                UNION ALL
                SELECT created_at, user_id, 'topic', 0,
                       topic_no, from_status, to_status, actor_tg_id, 'bot'
                FROM topic_log
            ) AS j
            JOIN users u ON u.id = j.user_id
            ORDER BY j.at DESC
            LIMIT ? OFFSET ?
        `)
        .all(limit, offset) as unknown as {
            at: number; name: string; tg_id: number; kind: 'task' | 'topic';
            amount: number; topic_no: number | null;
            from_status: string | null; to_status: string | null;
            actor_tg_id: number | null; source: string;
        }[];

    return rows.map((r) => ({
        at: Number(r.at),
        name: r.name,
        tgId: r.tg_id,
        kind: r.kind,
        amount: Number(r.amount),
        topicNo: Number(r.topic_no ?? 0),
        from: r.from_status ?? '',
        to: r.to_status ?? '',
        actorTgId: r.actor_tg_id,
        source: r.source === 'group' ? 'group' : r.source === 'admin' ? 'admin' : 'bot',
    }));
}

// Время последнего действия каждого участника: задачи или смена статуса задания
export function getLastActivity(): Map<number, number> {
    const rows = db
        .prepare(`
            SELECT user_id, MAX(at) AS last
            FROM (
                SELECT t.user_id, t.created_at AS at
                FROM task_log t
                JOIN users u ON u.id = t.user_id
                WHERE t.cancelled = 0
                  AND t.source <> 'admin'
                  AND (t.actor_tg_id IS NULL OR t.actor_tg_id = u.tg_id)
                UNION ALL
                SELECT t.user_id, t.created_at AS at
                FROM topic_log t
                JOIN users u ON u.id = t.user_id
                WHERE t.is_correction = 0
                  AND (t.actor_tg_id IS NULL OR t.actor_tg_id = u.tg_id)
            )
            GROUP BY user_id
        `)
        .all() as unknown as { user_id: number; last: number }[];

    return new Map(rows.map((r) => [r.user_id, Number(r.last)]));
}

export interface AdminMember {
    id: number;
    tgId: number;
    name: string;
    exam: number | null;
    removed: boolean;
    tasksTotal: number;
    topics: string[];
}

export function getAdminMembers(): AdminMember[] {
    const users = db.prepare(`
        SELECT id, tg_id, name, exam, removed
        FROM users
        ORDER BY removed ASC, name COLLATE NOCASE ASC
    `).all() as unknown as {
        id: number;
        tg_id: number;
        name: string;
        exam: number | null;
        removed: number;
    }[];

    const statuses = db.prepare(`
        SELECT user_id, topic_no, status
        FROM topic_status
        ORDER BY topic_no
    `).all() as unknown as {
        user_id: number;
        topic_no: number;
        status: string;
    }[];

    const totals = db.prepare(`
        SELECT user_id, COALESCE(SUM(amount), 0) AS total
        FROM task_log
        WHERE cancelled = 0
        GROUP BY user_id
    `).all() as unknown as {
        user_id: number;
        total: number;
    }[];

    const totalsById = new Map(totals.map((r) => [r.user_id, Number(r.total)]));

    return users.map((u) => ({
        id: u.id,
        tgId: u.tg_id,
        name: u.name,
        exam: u.exam,
        removed: Boolean(u.removed),
        tasksTotal: totalsById.get(u.id) ?? 0,
        topics: statuses
            .filter((s) => s.user_id === u.id)
            .sort((a, b) => a.topic_no - b.topic_no)
            .map((s) => s.status),
    }));
}

export interface AdminJournalEntry {
    id: number;
    at: number;
    kind: 'task' | 'topic' | 'exam' | 'admin';
    targetId: number | null;
    targetName: string;
    targetTgId: number | null;
    actorTgId: number | null;
    details: string;
}

export function getAdminJournal(limit: number, offset: number): AdminJournalEntry[] {
    const rows = db.prepare(`
        SELECT *
        FROM (
            SELECT
                t.id AS id,
                t.created_at AS at,
                'task' AS kind,
                u.id AS target_id,
                u.name AS target_name,
                u.tg_id AS target_tg_id,
                t.actor_tg_id AS actor_tg_id,
                CASE
                    WHEN t.source = 'admin' THEN 'Корректировка задач: ' || t.amount
                    WHEN t.source = 'group' THEN 'Задачи из группы: ' || t.amount
                    ELSE 'Изменение задач: ' || t.amount
                END AS details
            FROM task_log t
            JOIN users u ON u.id = t.user_id
            WHERE t.cancelled = 0

            UNION ALL

            SELECT
                t.id,
                t.created_at,
                'topic',
                u.id,
                u.name,
                u.tg_id,
                t.actor_tg_id,
                'Задание ' || t.topic_no || ': ' ||
                    t.from_status || ' → ' || t.to_status
            FROM topic_log t
            JOIN users u ON u.id = t.user_id

            UNION ALL

            SELECT
                e.id,
                e.created_at,
                'exam',
                u.id,
                u.name,
                u.tg_id,
                e.actor_tg_id,
                'Пробник: ' || COALESCE(CAST(e.from_exam AS TEXT), '—') ||
                    ' → ' || COALESCE(CAST(e.to_exam AS TEXT), '—')
            FROM exam_log e
            JOIN users u ON u.id = e.user_id

            UNION ALL

            SELECT
                a.id,
                a.created_at,
                'admin',
                a.target_user_id,
                COALESCE(u.name, '—'),
                u.tg_id,
                a.actor_tg_id,
                a.action || CASE
                    WHEN a.details = '' THEN ''
                    ELSE ': ' || a.details
                END
            FROM admin_log a
            LEFT JOIN users u ON u.id = a.target_user_id
        )
        ORDER BY at DESC, id DESC, kind ASC
        LIMIT ? OFFSET ?
    `).all(limit, offset) as unknown as {
        id: number;
        at: number;
        kind: AdminJournalEntry['kind'];
        target_id: number | null;
        target_name: string;
        target_tg_id: number | null;
        actor_tg_id: number | null;
        details: string;
    }[];

    return rows.map((r) => ({
        id: r.id,
        at: Number(r.at),
        kind: r.kind,
        targetId: r.target_id,
        targetName: r.target_name,
        targetTgId: r.target_tg_id,
        actorTgId: r.actor_tg_id,
        details: r.details,
    }));
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

export function getAdminHistory(limit: number, offset: number): HistoryDay[] {
    const rows = db.prepare(`
        WITH changes AS (
            SELECT t.user_id, t.created_at AS at, t.amount AS tasks, 0 AS topics,
                   CASE WHEN t.source <> 'admin' AND (t.actor_tg_id IS NULL OR t.actor_tg_id = u.tg_id)
                        THEN t.amount ELSE 0 END AS credited_tasks, 0 AS credited_topics
            FROM task_log t JOIN users u ON u.id = t.user_id
            WHERE t.cancelled = 0

            UNION ALL

            SELECT t.user_id, t.created_at, 0,
                   (t.to_status = 'reinforced') - (t.from_status = 'reinforced'),
                   0,
                   CASE WHEN t.is_correction = 0 AND (t.actor_tg_id IS NULL OR t.actor_tg_id = u.tg_id)
                        THEN (t.to_status = 'reinforced') - (${creditedTopicFromStatus} = 'reinforced')
                        ELSE 0 END
            FROM topic_log t JOIN users u ON u.id = t.user_id

            UNION ALL

            SELECT user_id, created_at, 0, 0, 0, 0 FROM exam_log
        ),
        dated AS (
            SELECT *, CAST((at + 10800000) / 86400000 AS INTEGER) AS day FROM changes
        ),
        page AS (
            SELECT DISTINCT day FROM dated ORDER BY day DESC LIMIT ? OFFSET ?
        ),
        grouped AS (
            SELECT day, user_id, MAX(at) AS last_at, SUM(tasks) AS tasks, SUM(topics) AS topics,
                   SUM(credited_tasks) AS credited_tasks, SUM(credited_topics) AS credited_topics,
                   day * 86400000 - 10800000 AS day_start
            FROM dated WHERE day IN (SELECT day FROM page)
            GROUP BY day, user_id
        )
        SELECT g.*, u.name,
            COALESCE(
                (SELECT json_array(e.to_exam) FROM exam_log e
                 WHERE e.user_id = g.user_id AND e.created_at < g.day_start
                 ORDER BY e.created_at DESC, e.id DESC LIMIT 1),
                (SELECT json_array(e.from_exam) FROM exam_log e WHERE e.user_id = g.user_id
                 ORDER BY e.created_at, e.id LIMIT 1),
                json_array(u.exam)
            ) AS exam_before,
            COALESCE(
                (SELECT json_array(e.to_exam) FROM exam_log e
                 WHERE e.user_id = g.user_id AND e.created_at < g.day_start + 86400000
                 ORDER BY e.created_at DESC, e.id DESC LIMIT 1),
                (SELECT json_array(e.from_exam) FROM exam_log e WHERE e.user_id = g.user_id
                 ORDER BY e.created_at, e.id LIMIT 1),
                json_array(u.exam)
            ) AS exam_after
        FROM grouped g JOIN users u ON u.id = g.user_id
        ORDER BY g.day DESC, g.last_at DESC, g.user_id
    `).all(limit, offset) as unknown as {
        day: number; user_id: number; name: string; tasks: number; topics: number;
        credited_tasks: number; credited_topics: number; exam_before: string; exam_after: string;
    }[];
    const days = new Map<number, HistoryDay>();
    for (const row of rows) {
        const day = days.get(row.day) ?? { day: row.day, rows: [] };
        day.rows.push({
            id: row.user_id,
            name: row.name,
            pct: Math.round(weekPct({ tasks: row.credited_tasks, topics: row.credited_topics })),
            tasks: row.tasks,
            topics: row.topics,
            examBefore: JSON.parse(row.exam_before)[0],
            examAfter: JSON.parse(row.exam_after)[0],
        });
        days.set(row.day, day);
    }
    return [...days.values()];
}

export function studyRecapStats(person: Person, start: number, end: number) {
    const tasks = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) AS value FROM task_log
        WHERE user_id = ? AND created_at >= ? AND created_at < ?
          AND cancelled = 0 AND source <> 'admin'
          AND ABS(amount) <= ?
          AND (actor_tg_id IS NULL OR actor_tg_id = ?)
    `).get(person.id, start, end, MAX_TASKS_PER_ENTRY, person.tgId) as { value: number };
    const laterTopics = db.prepare(`
        SELECT COALESCE(SUM((to_status = 'reinforced') - (from_status = 'reinforced')), 0) AS value
        FROM topic_log WHERE user_id = ? AND created_at >= ?
    `).get(person.id, end) as { value: number };
    const examAt = (boundary: number) => {
        const previous = db.prepare(`
            SELECT to_exam FROM exam_log WHERE user_id = ? AND created_at < ? AND is_correction = 0
            ORDER BY created_at DESC, id DESC LIMIT 1
        `).get(person.id, boundary) as { to_exam: number | null } | undefined;
        if (previous) return previous.to_exam ?? 0;
        const first = db.prepare(`
            SELECT from_exam FROM exam_log WHERE user_id = ?
            ORDER BY created_at, id LIMIT 1
        `).get(person.id) as { from_exam: number | null } | undefined;
        return (first ? first.from_exam : person.exam) ?? 0;
    };
    return {
        tasks: Math.max(0, tasks.value),
        topics: Math.max(0, person.reinforced.length - laterTopics.value),
        examBefore: examAt(start),
        exam: examAt(end),
    };
}
