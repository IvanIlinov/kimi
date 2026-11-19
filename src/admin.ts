import { db } from './db.ts';
import { normalizeName } from './names.ts';

// Имя от 1 до 30 символов и не занято другим активным участником
function checkName(name: string, exceptId: number | null = null): string {
    const clean = normalizeName(name);
    if (!clean || clean.length > 30) throw new Error('Имя от 1 до 30 символов');
    const dup = db
        .prepare('SELECT id FROM users WHERE name = ? AND removed = 0 AND id IS NOT ?')
        .get(clean, exceptId) as { id: number } | undefined;
    if (dup) throw new Error('Такое имя уже занято');
    return clean;
}

// Добавляет участника по Telegram id. Если он уже был убран, возвращает его обратно.
export function addUser(tgId: number, name: string): number {
    if (!Number.isInteger(tgId) || tgId <= 0) throw new Error('Некорректный Telegram id');

    const existing = db
        .prepare('SELECT id, removed FROM users WHERE tg_id = ?')
        .get(tgId) as { id: number; removed: number } | undefined;

    if (existing && !existing.removed) throw new Error('Этот участник уже в рейтинге');

    if (existing) {
        const clean = checkName(name, existing.id);
        db.prepare('UPDATE users SET removed = 0, name = ? WHERE id = ?').run(clean, existing.id);
        return existing.id;
    }

    const clean = checkName(name);
    db.exec('SAVEPOINT add_user');
    try {
        const { lastInsertRowid } = db
            .prepare('INSERT INTO users (tg_id, name, exam) VALUES (?, ?, 0)')
            .run(tgId, clean);
        const userId = Number(lastInsertRowid);
        const insert = db.prepare(
            'INSERT INTO topic_status (user_id, topic_no, status) VALUES (?, ?, ?)',
        );
        for (let topic = 1; topic <= 27; topic++) insert.run(userId, topic, 'todo');
        db.exec('RELEASE SAVEPOINT add_user');
        return userId;
    } catch (e) {
        db.exec('ROLLBACK TO SAVEPOINT add_user');
        db.exec('RELEASE SAVEPOINT add_user');
        throw e;
    }
}

export function renameUser(userId: number, name: string): void {
    const clean = checkName(name, userId);
    const { changes } = db
        .prepare('UPDATE users SET name = ? WHERE id = ? AND removed = 0')
        .run(clean, userId);
    if (Number(changes) === 0) throw new Error('Участник не найден');
}

// Мягкое удаление: участник скрыт из рейтинга, данные остаются
export function removeUser(userId: number): void {
    const { changes } = db.prepare('UPDATE users SET removed = 1 WHERE id = ?').run(userId);
    if (Number(changes) === 0) throw new Error('Участник не найден');
}

// Восстанавливает ранее удалённого участника.
export function restoreUser(userId: number): void {
    const user = db
        .prepare('SELECT id, name, removed FROM users WHERE id = ?')
        .get(userId) as { id: number; name: string; removed: number } | undefined;

    if (!user) throw new Error('Участник не найден');
    if (!user.removed) throw new Error('Участник уже активен');

    checkName(user.name, userId);

    db.prepare('UPDATE users SET removed = 0 WHERE id = ?').run(userId);
}
