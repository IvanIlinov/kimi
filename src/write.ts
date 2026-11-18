import { db } from './db.ts';

const MAX_PER_STEP = 50; // за раз не больше 50 задач

const insertLog = db.prepare(
    'INSERT INTO task_log (user_id, amount, created_at, source, actor_tg_id) VALUES (?, ?, ?, ?, ?)',
);
const totalOf = db.prepare(
    'SELECT COALESCE(SUM(amount), 0) AS total FROM task_log WHERE user_id = ? AND cancelled = 0',
);

// source: 'bot' — личка и панель, 'group' — беседка
export function addTasks(
    userId: number,
    amount: number,
    source: 'bot' | 'group' = 'bot',
    actorTgId: number | null = null,
): number {
    if (!Number.isInteger(amount) || amount === 0) {
        throw new Error('Число задач должно быть целым и не равным нулю');
    }
    if (Math.abs(amount) > MAX_PER_STEP) {
        throw new Error(`За раз не больше ${MAX_PER_STEP} задач`);
    }

    const { total } = totalOf.get(userId) as unknown as { total: number };
    if (total + amount < 0) {
        throw new Error('Всего задач не может стать меньше нуля');
    }

    insertLog.run(userId, amount, Date.now(), source, actorTgId);
    return total + amount;
}

// Устанавливает точное общее количество задач.
 // Корректировка сохраняется отдельными записями admin и не считается учебной активностью.
export function setTasksTotal(
    userId: number,
    targetTotal: number,
    actorTgId: number,
): number {
    if (!Number.isInteger(targetTotal) || targetTotal < 0) {
        throw new Error('Общее число задач должно быть целым числом не меньше нуля');
    }

    const user = db.prepare(
        'SELECT id FROM users WHERE id = ? AND removed = 0',
    ).get(userId);

    if (!user) throw new Error('Активный участник не найден');

    const current = Number((totalOf.get(userId) as { total: number }).total);
    let remaining = targetTotal - current;

    if (remaining === 0) return current;

    db.exec('SAVEPOINT set_tasks_total');
    try {
        while (remaining !== 0) {
            const amount = Math.sign(remaining) * Math.min(MAX_PER_STEP, Math.abs(remaining));
            insertLog.run(userId, amount, Date.now(), 'admin', actorTgId);
            remaining -= amount;
        }
        db.exec('RELEASE SAVEPOINT set_tasks_total');
    } catch (e) {
        db.exec('ROLLBACK TO SAVEPOINT set_tasks_total');
        db.exec('RELEASE SAVEPOINT set_tasks_total');
        throw e;
    }

    return targetTotal;
}

// Балл пробника: 0..100 или null (ещё не внесён).
// Каждое реальное изменение сохраняется в exam_log.
export function setExam(
    userId: number,
    exam: number | null,
    actorTgId: number | null = null,
): void {
    if (exam !== null && (!Number.isInteger(exam) || exam < 0 || exam > 100)) {
        throw new Error('Балл пробника должен быть целым числом от 0 до 100');
    }

    const current = db.prepare('SELECT exam FROM users WHERE id = ?').get(userId) as
        | { exam: number | null }
        | undefined;

    if (!current) throw new Error('Участник не найден');
    if (current.exam === exam) return;

    db.exec('SAVEPOINT set_exam');
    try {
        db.prepare('UPDATE users SET exam = ? WHERE id = ?').run(exam, userId);
        db.prepare(`
            INSERT INTO exam_log (user_id, actor_tg_id, from_exam, to_exam, created_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(userId, actorTgId, current.exam, exam, Date.now());
        db.exec('RELEASE SAVEPOINT set_exam');
    } catch (e) {
        db.exec('ROLLBACK TO SAVEPOINT set_exam');
        db.exec('RELEASE SAVEPOINT set_exam');
        throw e;
    }
}

const STATUSES = ['done', 'learning', 'todo'] as const;
type Status = (typeof STATUSES)[number];

const getStatus = db.prepare('SELECT status FROM topic_status WHERE user_id = ? AND topic_no = ?');
const upsertStatus = db.prepare(`
    INSERT INTO topic_status (user_id, topic_no, status) VALUES (?, ?, ?)
    ON CONFLICT (user_id, topic_no) DO UPDATE SET status = excluded.status
`);
const insertTopicLog = db.prepare(`
    INSERT INTO topic_log (user_id, actor_tg_id, topic_no, from_status, to_status, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
`);

// Меняет статус задания и пишет запись в журнал. actorTgId — кто нажал (ученик или админ).
export function setTopicStatus(
    userId: number,
    topicNo: number,
    status: Status,
    actorTgId: number | null = null,
): void {
    if (!Number.isInteger(topicNo) || topicNo < 1 || topicNo > 27) {
        throw new Error('Номер задания должен быть от 1 до 27');
    }
    if (!STATUSES.includes(status)) {
        throw new Error(`Неизвестный статус: ${status}`);
    }

    const row = getStatus.get(userId, topicNo) as { status: Status } | undefined;
    const from: Status = row?.status ?? 'todo';

    // Не создаём запись в истории, если статус не изменился.
    if (row && row.status === status) return;

    db.exec('SAVEPOINT set_topic_status');
    try {
        upsertStatus.run(userId, topicNo, status);
        insertTopicLog.run(userId, actorTgId, topicNo, from, status, Date.now());
        db.exec('RELEASE SAVEPOINT set_topic_status');
    } catch (e) {
        db.exec('ROLLBACK TO SAVEPOINT set_topic_status');
        db.exec('RELEASE SAVEPOINT set_topic_status');
        throw e;
    }
}