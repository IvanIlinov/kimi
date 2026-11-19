
import { addUser, renameUser, removeUser, restoreUser } from '../../admin.ts';
import { db } from '../../db.ts';
import { setTasksTotal, setExam, setTopicStatus } from '../../write.ts';
import { getAdminMembers, getAdminJournal, weekStartMs } from '../../store.ts';
import { HttpError } from '../errors.ts';
import type { Router } from '../router.ts';

type Status = 'done' | 'learning' | 'todo' | 'reinforced';

function requireAdmin(viewer: { role: string }): void {
    if (viewer.role !== 'admin') {
        throw new HttpError(403, 'Требуются права администратора');
    }
}

function objectBody(body: unknown): Record<string, unknown> {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new HttpError(400, 'Некорректное тело запроса');
    }
    return body as Record<string, unknown>;
}

function positiveId(value: string): number {
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id <= 0) {
        throw new HttpError(400, 'Некорректный ID участника');
    }
    return id;
}

function audit(
    actorTgId: number,
    targetUserId: number | null,
    action: string,
    details = '',
): void {
    db.prepare(`
        INSERT INTO admin_log (actor_tg_id, target_user_id, action, details, created_at)
        VALUES (?, ?, ?, ?, ?)
    `).run(actorTgId, targetUserId, action, details, Date.now());
}




function atomicAdmin<T>(
    actorTgId: number,
    targetUserId: number | null,
    action: string,
    details: string,
    fn: () => T,
): T {
    db.exec('SAVEPOINT admin_api_action');

    try {
        const result = fn();

        audit(actorTgId, targetUserId, action, details);

        db.exec('RELEASE SAVEPOINT admin_api_action');
        return result;
    } catch (e) {
        db.exec('ROLLBACK TO SAVEPOINT admin_api_action');
        db.exec('RELEASE SAVEPOINT admin_api_action');
        throw e;
    }
}

function activeUser(id: number): void {
    const row = db.prepare(
        'SELECT id FROM users WHERE id = ? AND removed = 0',
    ).get(id);

    if (!row) throw new HttpError(404, 'Активный участник не найден');
}

function guard<T>(fn: () => T): T {
    try {
        return fn();
    } catch (e) {
        if (e instanceof HttpError) throw e;
        throw new HttpError(400, e instanceof Error ? e.message : 'Ошибка');
    }
}

export function registerAdmin(router: Router): void {
    router.get('/api/admin/home', ({ viewer }) => {
        requireAdmin(viewer);
        const weekStart = weekStartMs(Date.now());
        const attendance = db.prepare(`
            SELECT COUNT(v.message_id) AS visits,
                   COUNT(DISTINCT v.user_id) AS visitors,
                   COUNT(DISTINCT u.id) AS participants
            FROM users u
            LEFT JOIN bot_visits v ON v.user_id = u.id
                AND v.created_at >= ? AND v.created_at < ?
            WHERE u.removed = 0
        `).get(weekStart, weekStart + 7 * 86_400_000);
        const lessons = db.prepare(`
            SELECT id, weekday, time, name, status
            FROM lessons WHERE week_start = ?
            ORDER BY weekday, time, id
        `).all(weekStart);
        return { weekStart, attendance, lessons };
    });

    router.post('/api/admin/lessons', ({ viewer, body }) => {
        requireAdmin(viewer);
        const data = objectBody(body);
        const weekStart = weekStartMs(Date.now());
        if (data.weekStart !== weekStart) {
            throw new HttpError(409, 'Неделя сменилась. Обновите расписание.');
        }
        const { id, weekday, time, status } = data;
        const name = typeof data.name === 'string' ? data.name.trim() : '';
        if (typeof weekday !== 'number' || !Number.isInteger(weekday) || weekday < 0 || weekday > 6 ||
            typeof time !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time) ||
            !name || name.length > 80 || (status !== 'planned' && status !== 'held' && status !== 'paid')) {
            throw new HttpError(400, 'Проверьте день, время, имя и статус занятия');
        }
        if (id === undefined) {
            db.prepare(`
                INSERT INTO lessons (week_start, weekday, time, name, status) VALUES (?, ?, ?, ?, ?)
            `).run(weekStart, weekday, time, name, status);
        } else {
            const result = db.prepare(`
                UPDATE lessons SET weekday = ?, time = ?, name = ?, status = ?
                WHERE id = ? AND week_start = ?
            `).run(weekday, time, name, status, positiveId(String(id)), weekStart);
            if (!result.changes) throw new HttpError(404, 'Занятие не найдено');
        }
        return { ok: true };
    });

    router.post('/api/admin/lessons/:id/remove', ({ viewer, params }) => {
        requireAdmin(viewer);
        const id = positiveId(params.id);
        const result = db.prepare('DELETE FROM lessons WHERE id = ? AND week_start = ?')
            .run(id, weekStartMs(Date.now()));
        if (!result.changes) throw new HttpError(404, 'Занятие не найдено на этой неделе');
        return { ok: true };
    });

    router.get('/api/admin/members', ({ viewer }) => {
        requireAdmin(viewer);
        return getAdminMembers();
    });

    router.get('/api/admin/journal', ({ viewer, query }) => {
        requireAdmin(viewer);

        const rawLimit = Number(query.get('limit') ?? 50);
        const rawOffset = Number(query.get('offset') ?? 0);

        if (
            !Number.isInteger(rawLimit) ||
            rawLimit < 1 ||
            rawLimit > 100 ||
            !Number.isInteger(rawOffset) ||
            rawOffset < 0
        ) {
            throw new HttpError(400, 'Некорректные параметры журнала');
        }

        return getAdminJournal(rawLimit, rawOffset);
    });

    router.post('/api/admin/members', ({ viewer, body }) => {
        requireAdmin(viewer);
        const data = objectBody(body);
        const tgId = Number(data.tgId);
        const name = typeof data.name === 'string' ? data.name : '';

        return guard(() => {
            db.exec('SAVEPOINT admin_api_action');

            try {
                const previous = db.prepare(
                    'SELECT id, removed FROM users WHERE tg_id = ?',
                ).get(tgId) as { id: number; removed: number } | undefined;

                const id = addUser(tgId, name);

                const action = previous?.removed ? 'restore_user' : 'add_user';
                const details = previous?.removed
                    ? `Восстановлен через добавление: ${name.trim()}`
                    : `Участник: ${name.trim()}`;

                audit(viewer.tgId, id, action, details);

                db.exec('RELEASE SAVEPOINT admin_api_action');

                return { ok: true, id };
            } catch (e) {
                db.exec('ROLLBACK TO SAVEPOINT admin_api_action');
                db.exec('RELEASE SAVEPOINT admin_api_action');
                throw e;
            }
        });
    });

    router.post('/api/admin/members/:id/rename', ({ viewer, params, body }) => {
        requireAdmin(viewer);
        const id = positiveId(params.id);
        const data = objectBody(body);
        const name = typeof data.name === 'string' ? data.name : '';

        return guard(() =>
            atomicAdmin(viewer.tgId, id, 'rename_user', `Новое имя: ${name.trim()}`, () => {
                renameUser(id, name);
                return { ok: true };
            }),
        );
    });

    router.post('/api/admin/members/:id/remove', ({ viewer, params }) => {
        requireAdmin(viewer);
        const id = positiveId(params.id);

        return guard(() =>
            atomicAdmin(viewer.tgId, id, 'remove_user', '', () => {
                removeUser(id);
                return { ok: true };
            }),
        );
    });

    router.post('/api/admin/members/:id/restore', ({ viewer, params }) => {
        requireAdmin(viewer);
        const id = positiveId(params.id);

        return guard(() =>
            atomicAdmin(viewer.tgId, id, 'restore_user', '', () => {
                restoreUser(id);
                return { ok: true };
            }),
        );
    });

    router.post('/api/admin/members/:id/tasks', ({ viewer, params, body }) => {
        requireAdmin(viewer);
        const id = positiveId(params.id);
        const data = objectBody(body);
        const total = data.total;

        return guard(() =>
            atomicAdmin(viewer.tgId, id, 'set_tasks_total', `Итого: ${total}`, () => {
                activeUser(id);
                if (typeof total !== 'number' || !Number.isSafeInteger(total) || total < 0) {
                    throw new Error('Общее число задач должно быть целым числом не меньше нуля');
                }

                const result = setTasksTotal(id, total, viewer.tgId);
                return { ok: true, total: result };
            }),
        );
    });

    router.post('/api/admin/members/:id/exam', ({ viewer, params, body }) => {
        requireAdmin(viewer);
        const id = positiveId(params.id);
        const data = objectBody(body);
        const value = data.value;

        return guard(() =>
            atomicAdmin(viewer.tgId, id, 'set_exam', `Балл: ${value ?? 'не указан'}`, () => {
                activeUser(id);
                if (
                    value !== null &&
                    (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 100)
                ) {
                    throw new Error('Балл пробника должен быть целым числом от 0 до 100 или null');
                }

                setExam(id, value as number | null, viewer.tgId);
                return { ok: true };
            }),
        );
    });

    router.post('/api/admin/members/:id/topics/:n', ({ viewer, params, body }) => {
        requireAdmin(viewer);
        const id = positiveId(params.id);
        const topicNo = Number(params.n);
        const data = objectBody(body);
        const status = data.status;

        return guard(() =>
            atomicAdmin(viewer.tgId, id, 'set_topic_status', `Задание ${topicNo}: ${status}`, () => {
                activeUser(id);
                if (!Number.isInteger(topicNo) || topicNo < 1 || topicNo > 27) {
                    throw new Error('Номер задания должен быть от 1 до 27');
                }
                if (status !== 'done' && status !== 'learning' && status !== 'todo' && status !== 'reinforced') {
                    throw new Error('Неизвестный статус задания');
                }

                setTopicStatus(id, topicNo, status as Status, viewer.tgId);
                return { ok: true };
            }),
        );
    });
}
