import { BOT_TOKEN, GROUP_CHAT_ID } from './config.ts';
import { db } from './db.ts';
import { cap, renderSummaryRich } from './render.ts';
import { sgn } from './logic.ts';
import { getPersons, getWeekStats, weekStartMs } from './store.ts';
import { sendMessage, sendRich } from './telegram.ts';

const KEY = 'weekly_sent_for';
const CHECK_EVERY_MS = 60_000;

type SummaryRow = { name: string; tasks: number; topics: number };

const getMeta = (key: string): string | undefined =>
    (db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string } | undefined)?.value;

const setMeta = (key: string, value: string) =>
    db
        .prepare(`INSERT INTO meta (key, value) VALUES (?, ?)
                  ON CONFLICT (key) DO UPDATE SET value = excluded.value`)
        .run(key, value);

// Итоги недели, которая закончилась в момент endMs (понедельник 00:00 по Москве)
function buildRows(endMs: number): SummaryRow[] {
    const names = new Map(getPersons().map((p) => [p.id, p.name]));
    return getWeekStats(endMs - 1)
        .filter((s) => s.tasks > 0)
        .sort((a, b) => b.tasks - a.tasks || b.topics - a.topics)
        .map((s) => ({ name: names.get(s.userId) ?? '—', tasks: s.tasks, topics: s.topics }));
}

// Текстовый вариант, если Rich-сообщение не ушло
function buildText(rows: SummaryRow[]): string {
    const lines = rows.map((x, i) => `${i + 1}. ${cap(x.name)} ${sgn(x.tasks)} задач`);
    return ['Итоги недели', '', ...(lines.length ? lines : ['На этой неделе задач не было.'])].join('\n');
}

export function startWeeklySummary(): void {
    if (!GROUP_CHAT_ID) {
        console.log('[weekly] GROUP_CHAT_ID не задан, итоги недели отключены');
        return;
    }

    // Первый запуск: запоминаем текущую неделю и ничего не отправляем
    if (!getMeta(KEY)) setMeta(KEY, String(weekStartMs(Date.now())));

    setInterval(async () => {
        const boundary = weekStartMs(Date.now());
        if (String(boundary) === getMeta(KEY)) return;
        try {
            const rows = buildRows(boundary);
            try {
                await sendRich(BOT_TOKEN, GROUP_CHAT_ID, renderSummaryRich(rows));
            } catch (e) {
                console.log('[weekly] Rich не отправлен, шлю текст:', String(e));
                await sendMessage(BOT_TOKEN, GROUP_CHAT_ID, buildText(rows));
            }
            setMeta(KEY, String(boundary)); // отмечаем только после успешной отправки
            console.log('[weekly] итоги отправлены');
        } catch (e) {
            console.log('[weekly] не отправлено, повторю через минуту:', String(e));
        }
    }, CHECK_EVERY_MS);
}