import { db } from './db.ts';

interface Input {
    name: string;
    tgId: number;
    done: number[];
    learning: number[];
    tasksTotal: number;
    tasksWeek: number;
    exam: number;
    comment: string;
}

const range = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => from + i);

const PEOPLE: Input[] = [
    { name: 'ваня', tgId: 2024854134, done: [...range(1, 18), 22, 23], learning: [19, 20, 21], tasksTotal: 590, tasksWeek: 0, exam: 75, comment: '' },
    { name: 'егор', tgId: 7468044193, done: [1, 3, 4, 5, 6, 7, 11, 12, 14, 17, 18, 22], learning: [9], tasksTotal: 90, tasksWeek: 0, exam: 43, comment: '' },
    { name: 'лёша', tgId: 6850523714, done: [1, 2, 3, 4, 5, 6, 7, 11, 12, 14, 16, 18, 22], learning: [17, 9, 8], tasksTotal: 90, tasksWeek: 0, exam: 54, comment: '' },
    { name: 'ника', tgId: 785826438, done: [1, 3, 4, 6, 7, 11, 12, 18, 22], learning: [17, 9, 8], tasksTotal: 40, tasksWeek: 0, exam: 0, comment: '' },
    { name: 'кирилл', tgId: 1961889124, done: [1, 4, 7, 11], learning: [18, 22], tasksTotal: 30, tasksWeek: 0, exam: 0, comment: '' },
    { name: 'вова', tgId: 1814782338, done: [1, 4, 7, 11, 18, 22], learning: [6], tasksTotal: 55, tasksWeek: 0, exam: 40, comment: '' },
    { name: 'саня', tgId: 1782801806, done: [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 13], learning: [18, 12, 22], tasksTotal: 55, tasksWeek: 0, exam: 40, comment: '' },
    { name: 'андрей', tgId: 1809349886, done: [1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 13, 14, 15, 18, 19, 20, 21, 23], learning: [16, 17], tasksTotal: 105, tasksWeek: 0, exam: 56, comment: '' },
];

// 1 сентября 2026, 00:00 по Москве (UTC+3)
const PROGRAM_START = Date.UTC(2026, 7, 31, 21, 0, 0);

// Собирает статус каждого задания и падает, если данные противоречат друг другу
function buildStatuses(p: Input): Map<number, 'done' | 'learning'> {
    const map = new Map<number, 'done' | 'learning'>();
    const add = (topic: number, status: 'done' | 'learning') => {
        if (topic < 1 || topic > 27) throw new Error(`${p.name}: задание ${topic} вне 1..27`);
        if (map.has(topic)) throw new Error(`${p.name}: задание ${topic} указано дважды (${map.get(topic)} и ${status})`);
        map.set(topic, status);
    };
    p.done.forEach((t) => add(t, 'done'));
    p.learning.forEach((t) => add(t, 'learning'));
    return map;
}

// Проверяем всё до записи в базу
const plans = PEOPLE.map((p) => {
    if (p.tasksWeek > p.tasksTotal) throw new Error(`${p.name}: за неделю больше, чем всего`);
    return { p, statuses: buildStatuses(p) };
});

const existing = db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
if (existing.n > 0) throw new Error('В базе уже есть пользователи, seed не запускаю');

const insertUser = db.prepare('INSERT INTO users (tg_id, name, exam, comment) VALUES (?, ?, ?, ?)');
const insertStatus = db.prepare('INSERT INTO topic_status (user_id, topic_no, status) VALUES (?, ?, ?)');
const insertLog = db.prepare('INSERT INTO task_log (user_id, amount, created_at) VALUES (?, ?, ?)');

db.exec('BEGIN');
try {
    for (const { p, statuses } of plans) {
        const { lastInsertRowid } = insertUser.run(p.tgId, p.name, p.exam, p.comment);
        const userId = Number(lastInsertRowid);

        // Все 27 заданий: не указанные становятся 'todo'
        for (let topic = 1; topic <= 27; topic++) {
            insertStatus.run(userId, topic, statuses.get(topic) ?? 'todo');
        }

        // Задачи до текущей недели — стартовая запись на 1 сентября,
        // за текущую неделю — отдельная запись сейчас
        const before = p.tasksTotal - p.tasksWeek;
        if (before > 0) insertLog.run(userId, before, PROGRAM_START);
        if (p.tasksWeek > 0) insertLog.run(userId, p.tasksWeek, Date.now());
    }
    db.exec('COMMIT');
} catch (e) {
    db.exec('ROLLBACK');
    throw e;
}

console.log(`Записано учеников: ${PEOPLE.length}`);