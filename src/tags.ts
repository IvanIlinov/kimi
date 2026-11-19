import { BOT_TOKEN, GROUP_CHAT_ID } from './config.ts';
import { TASKS_GOAL } from './logic.ts';
import { db } from './db.ts';
import { setMemberTag } from './telegram.ts';

// Формат: «пробник [задачи/цель]», например «30 [35/900]»
export const tagFor = (exam: number | null, tasks: number) =>
    `${exam ?? '—'} [${tasks}/${TASKS_GOAL}]`.slice(0, 16);

const readTagData = db.prepare(`
    SELECT tg_id, exam,
        (SELECT COALESCE(SUM(amount), 0) FROM task_log
         WHERE user_id = users.id AND cancelled = 0) AS tasks
    FROM users WHERE id = ? AND removed = 0
`);
const activeIds = db.prepare('SELECT id FROM users WHERE removed = 0 ORDER BY id');
const pending = new Map<number, Promise<void>>();

export function syncTag(userId: number): Promise<void> {
    if (!GROUP_CHAT_ID) return Promise.resolve();

    const update = (pending.get(userId) ?? Promise.resolve()).then(async () => {
        try {
            const person = readTagData.get(userId) as
                | { tg_id: number; exam: number | null; tasks: number }
                | undefined;
            if (person) {
                await setMemberTag(BOT_TOKEN, GROUP_CHAT_ID, person.tg_id, tagFor(person.exam, person.tasks));
            }
        } catch (e) {
            console.log('[tag] не установлен для участника', userId, String(e));
        }
    }).finally(() => {
        if (pending.get(userId) === update) pending.delete(userId);
    });
    pending.set(userId, update);
    return update;
}

// Обновляем всех участников при старте и раз в час.
export function startTagSync(): void {
    if (!GROUP_CHAT_ID) return;
    const all = async () => {
        for (const { id } of activeIds.all()) await syncTag(Number(id));
    };
    void all();
    setInterval(all, 60 * 60 * 1000);
}
