import {
    EXAM_MAX,
    MONTH_TOPICS,
    TASKS_GOAL,
    TOPICS_TOTAL,
    WEEK_GOAL,
    leadParts,
    planTasks,
    planTopics,
    sgn,
    weekPct
} from './logic.ts';
import type { Ranked } from './logic.ts';
import type { WeekStat, JournalEntry } from './store.ts';

const ALL = Array.from({ length: TOPICS_TOTAL }, (_, i) => i + 1);
const nums = (a: number[]) => (a.length ? [...a].sort((x, y) => x - y).join(' ') : '—');
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Полоска прогресса из 10 клеток: 21% -> ██░░░░░░░░
const bar = (pct: number, cells = 10) => {
    const filled = Math.round((Math.min(Math.max(pct, 0), 100) / 100) * cells);
    return '█'.repeat(filled) + '░'.repeat(cells - filled);
};
// null означает «цель достигнута», тогда показываем 100%
const delta = (n: number | null) => (n === null ? '100%' : n > 0 ? `+${n}` : `${n}`);

export function renderProfile(r: Ranked, now: Date): string {
    const p = r.person;
    const toLearn = ALL.filter((n) => !p.studied.includes(n) && !p.learning.includes(n));
    const lead = leadParts(p, now);

    const lines = [
        `⚡️${cap(p.name)}⚡️`,
        '',
        `${bar(r.pct)} ${r.pct}%`,
        `💎${p.exam ?? '—'}  🎖${r.place}   ⚔️${p.studied.length}`,
        '',
        `📕 Неделя: ${p.tasksWeek}/${WEEK_GOAL}`,
        `📗 Задачи: ${p.tasksTotal}/${TASKS_GOAL} (${delta(lead.tasks)})`,
        `📘 Задания: ${p.studied.length}/${TOPICS_TOTAL} (${delta(lead.topics)})`,
        '',
        `🟢 ${nums(p.studied)}`,
        `🟡 ${nums(p.learning)}`,
        `🔴 ${nums(toLearn)}`,
    ];

    if (p.comment) lines.push('', `✍️ ${p.comment.replace(/\n/g, ' ')}`);

    return lines.join('\n');
}

// Экранирование для parse_mode: 'HTML'
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// 🟢 — не отстаём ни по заданиям, ни по задачам; иначе 🔴
const onTrack = (r: Ranked, now: Date) => {
    const lead = leadParts(r.person, now);
    return (lead.topics ?? 0) >= 0 && (lead.tasks ?? 0) >= 0;
};

export function renderArena(
    ranked: Ranked[],
    viewerId?: number,
    week: Map<number, WeekStat> = new Map(),
    now: Date = new Date(),
): string {
    if (ranked.length === 0) return '✨ Арена\n\nПока никого нет.';

    const top = ranked.slice(0, 10);
    const mine = ranked.find((r) => r.person.tgId === viewerId);
    const shown = mine && !top.includes(mine) ? [...top, mine] : top;

    // Группы: топ-3 (💎), середина (⚡️), последние два при 6+ участниках (🔥)
    const tailStart = shown.length > 5 ? shown.length - 2 : shown.length;
    const iconFor = (i: number) => (i < 3 ? '💎' : i >= tailStart ? '🔥' : '⚡️');

    const lines = shown.map((r, i) => {
        const w = week.get(r.person.id) ?? { tasks: 0, topics: 0 };
        const pct = Math.round(weekPct(w));
        const status = onTrack(r, now) ? '🟢' : '🔴';
        return `${iconFor(i)} ${r.place} ${cap(r.person.name)} ${status} ${sgn(pct)}% ${sgn(w.tasks)} задач ${sgn(w.topics)} заданий`;
    });

    const body = [lines.slice(0, 3), lines.slice(3, tailStart), lines.slice(tailStart)]
        .filter((g) => g.length > 0)
        .map((g) => g.join('\n'))
        .join('\n\n');

    return ['✨ Арена', '', body].join('\n');
}

const MONTH_NAMES = ['сен', 'окт', 'ноя', 'дек', 'янв', 'фев', 'март', 'апр'];

// Справка: прогресс по программе
export function renderHelpProgress(now: Date): string {
    let acc = 0;
    const schedule = MONTH_TOPICS.map((n, i) => {
        acc += n;
        return `• ${MONTH_NAMES[i]} — ${acc}`;
    }).join('\n');

    return [
        '💎 Как считается прогресс?',
        '[-/27 заданий] + [-/900 задач] + [-/100 баллов]',
        '',
        '✨ Арена',
        '🟢 — не отстаём ни по заданиям, ни по задачам',
        '🔴 — отстаём хотя бы по одному показателю',
        '',
        '⚡️ Сколько заданий нужно решать',
        schedule,
        '',
        '⚡️ Сегодня:',
        `• заданий ${planTopics(now)}`,
        `• задач ${planTasks(now)}`,
    ].join('\n');
}

const JOURNAL_ICON: Record<string, string> = { done: '🟢', learning: '🟡', todo: '🔴' };

// Время по Москве: 15.11 15:42
const mskTime = (ms: number) => {
    const d = new Date(ms + 3 * 3600e3);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
};

export function renderJournal(entries: JournalEntry[]): string {
    if (entries.length === 0) return '📒 Журнал\n\nПока пусто.';

    const lines = entries.map((e) => {
        const who = cap(e.name);
        const time = mskTime(e.at);
        if (e.kind === 'task') {
            return `${time} ${who}: ${sgn(e.amount)} задач`;
        }
        // Отметка 👑, если статус меняли не сам участник
        const byAdmin = e.actorTgId !== null && e.actorTgId !== e.tgId ? ' 👑' : '';
        return `${time} ${who}: задание ${e.topicNo} ${JOURNAL_ICON[e.from]} → ${JOURNAL_ICON[e.to]}${byAdmin}`;
    });

    return ['📒 Журнал', '', ...lines].join('\n');
}