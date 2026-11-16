import { BOT_TOKEN, GROUP_CHAT_ID } from './config.ts';
import { TASKS_GOAL } from './logic.ts';
import { getPersons } from './store.ts';
import { setMemberTag } from './telegram.ts';

// Формат: «пробник [задачи/цель]», например «30 [35/900]»
export const tagFor = (exam: number | null, tasks: number) =>
    `${exam ?? '—'} [${tasks}/${TASKS_GOAL}]`.slice(0, 16);

export async function syncTag(tgId: number, exam: number | null, tasks: number): Promise<void> {
    if (!GROUP_CHAT_ID) return;
    try {
        await setMemberTag(BOT_TOKEN, GROUP_CHAT_ID, tgId, tagFor(exam, tasks));
    } catch (e) {
        console.log('[tag] не установлен для', tgId, String(e));
    }
}

// Обновляем всех участников при старте и раз в час
export function startTagSync(): void {
    if (!GROUP_CHAT_ID) return;
    const all = async () => {
        for (const p of getPersons()) await syncTag(p.tgId, p.exam, p.tasksTotal);
    };
    void all();
    setInterval(all, 60 * 60 * 1000);
}