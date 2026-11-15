import { db } from './db.ts';

const MAX_PER_STEP = 50; // за раз не больше 50 задач

const insertLog = db.prepare(
    'INSERT INTO task_log (user_id, amount, created_at) VALUES (?, ?, ?)',
);
const totalOf = db.prepare(
    'SELECT COALESCE(SUM(amount), 0) AS total FROM task_log WHERE user_id = ? AND cancelled = 0',
);

// Добавляет (или убавляет, если amount < 0) решённые задачи. Возвращает новый итог.
export function addTasks(userId: number, amount: number): number {
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

    insertLog.run(userId, amount, Date.now());
    return total + amount;
}

// Балл пробника: 0..100 или null (ещё не внесён)
export function setExam(userId: number, exam: number | null): void {
    if (exam !== null && (!Number.isInteger(exam) || exam < 0 || exam > 100)) {
        throw new Error('Балл пробника должен быть целым числом от 0 до 100');
    }
    db.prepare('UPDATE users SET exam = ? WHERE id = ?').run(exam, userId);
}

const STATUSES = ['done', 'learning', 'todo'] as const;
type Status = (typeof STATUSES)[number];

// Статус задания: 'done' (изучено), 'learning' (в процессе), 'todo' (надо изучить)
export function setTopicStatus(userId: number, topicNo: number, status: Status): void {
    if (!Number.isInteger(topicNo) || topicNo < 1 || topicNo > 27) {
        throw new Error('Номер задания должен быть от 1 до 27');
    }
    if (!STATUSES.includes(status)) {
        throw new Error(`Неизвестный статус: ${status}`);
    }
    db.prepare(`
        INSERT INTO topic_status (user_id, topic_no, status) VALUES (?, ?, ?)
        ON CONFLICT (user_id, topic_no) DO UPDATE SET status = excluded.status
    `).run(userId, topicNo, status);
}