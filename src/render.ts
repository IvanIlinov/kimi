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
    weekPct,
    progressPct
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

const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const tr = (cells: string[], align: string[], bold = false) =>
    `<tr>${cells.map((c, i) => `<td align="${align[i]}">${bold ? `<b>${c}</b>` : c}</td>`).join('')}</tr>`;
const table = (rows: string) => `<table bordered striped compact>${rows}</table>`;

const ARENA_CELLS = 10;

// Полоска для арены: 0..100%, шкала ограничена 100%
const arenaBar = (pct: number) => {
    const n = Math.max(0, Math.min(ARENA_CELLS, Math.round((Math.min(pct, 100) / 100) * ARENA_CELLS)));
    return '▰'.repeat(n) + '▱'.repeat(ARENA_CELLS - n);
};

export function renderArenaRich(
    ranked: Ranked[],
    viewerId: number | undefined,
    week: Map<number, WeekStat>,
    buttonsHtml: string,
    mode: 'global' | 'week' = 'global',
    now: Date = new Date(),
): string {
    if (ranked.length === 0) return `<h3>✨ Арена</h3><p>Пока никого нет.</p>${buttonsHtml}`;

    const top = ranked.slice(0, 10);
    const mine = ranked.find((r) => r.person.tgId === viewerId);
    const shown = mine && !top.includes(mine) ? [...top, mine] : top;

    // Лидер недели: по заданиям, при равенстве по задачам
    const active = [...week.values()].filter((s) => s.active);
    const best = [...active].sort((a, b) => b.topics - a.topics || b.tasks - a.tasks)[0];
    const bestName = best ? ranked.find((r) => r.person.id === best.userId)?.person.name : undefined;
    const leader =
        best && bestName
            ? `<h3>👑 Лидер недели</h3>${table(
                tr(
                    [escHtml(cap(bestName)), `${sgn(Math.round(weekPct(best)))}%`, sgn(best.tasks), sgn(best.topics)],
                    ['left', 'right', 'right', 'right'],
                    true,
                ),
            )}`
            : '';

    let body: string;

    if (mode === 'global') {
        // Глобальный прогресс: место, имя, шкала, процент, статус
        const rows = shown
            .map((r) =>
                tr(
                    [
                        `${r.place} ${escHtml(cap(r.person.name))}`,
                        arenaBar(r.pct),
                        `${r.pct}%`,
                        onTrack(r, now) ? '🟢' : '🔴',
                    ],
                    ['left', 'left', 'right', 'left'],
                ),
            )
            .join('');
        body = table(rows);
    } else {
        // Неделя: выполнение (задачи / 25), прирост прогресса справа. Сортировка по выполнению.
        const rows = shown
            .map((r) => {
                const w = week.get(r.person.id) ?? { userId: r.person.id, tasks: 0, topics: 0, active: false };
                return { name: escHtml(cap(r.person.name)), w, goal: Math.round((w.tasks / WEEK_GOAL) * 100) };
            })
            .sort((a, b) => b.w.tasks - a.w.tasks || b.w.topics - a.w.topics)
            .map((x) =>
                tr(
                    [
                        x.name,
                        arenaBar(x.goal),
                        `${x.goal}%`,
                        `${sgn(Math.round(weekPct(x.w)))}%`,
                    ],
                    ['left', 'left', 'right', 'right'],
                ),
            )
            .join('');
        body = table(rows);
    }

    return ['<h3>✨ Арена</h3>', leader, body, buttonsHtml].filter(Boolean).join('\n');
}

// ---- Главная ученика (Rich) ----
const BAR_CELLS = 17;
const TOPIC_RANGE = 3; // шкала по заданиям: ±3 от плана — край
const TASK_RANGE = 50; // шкала по задачам: ±50 от плана — край

// Полоска прогресса 0..100%
const pctBar = (pct: number) => {
    const n = Math.max(0, Math.min(BAR_CELLS, Math.round((pct / 100) * BAR_CELLS)));
    return '▰'.repeat(n) + '▱'.repeat(BAR_CELLS - n);
};

// Шкала отклонения: ┃ — план, вправо впереди, влево позади
const devBar = (dev: number, range: number) => {
    const half = BAR_CELLS / 2;
    const n = Math.round(Math.min(1, Math.abs(dev) / range) * half);
    const left = dev < 0 ? '▰'.repeat(n).padStart(half, '▱') : '▱'.repeat(half);
    const right = dev > 0 ? '▰'.repeat(n).padEnd(half, '▱') : '▱'.repeat(half);
    return `${left}┃${right}`;
};

export function renderStudentRich(
    r: Ranked,
    week: WeekStat | undefined,
    now: Date,
    buttonsHtml: string,
): string {
    const p = r.person;
    const w = week ?? { userId: p.id, tasks: 0, topics: 0, active: false };
    const lead = leadParts(p, now);
    const goal = Math.round((w.tasks / WEEK_GOAL) * 100); // выполнение недели, может быть > 100
    const dot = (ok: boolean) => (ok ? '🟢' : '🔴');
    const sp = '&nbsp;&nbsp;&nbsp;';
    const blank = '<p>&nbsp;</p>';

    // Шкала отклонения без подписи: шкала, значение и точка в одной строке
    const devLine = (dev: number | null, range: number) =>
        dev === null
            ? `<p>${devBar(0, range)} ✅ 100%</p>`
            : `<p>${devBar(dev, range)} ${dot(dev >= 0)} ${sgn(dev)}</p>`;

    return [
        `<h3>${escHtml(cap(p.name))} 🎖${r.place}</h3>`,
        blank,
        `<p> ${pctBar(r.pct)} ${r.pct}%</p>`,
        `<p> ${pctBar(Math.min(goal, 100))} ${goal}%</p>`,
        blank,
        `<p>📕 ${p.exam ?? '—'}${sp}📒 ${p.studied.length}${sp}📒 ${p.tasksTotal}</p>`,
        blank,
        devLine(lead.topics, TOPIC_RANGE),
        devLine(lead.tasks, TASK_RANGE),
        blank,
        buttonsHtml,
    ].join('\n');
}