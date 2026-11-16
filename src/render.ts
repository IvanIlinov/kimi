import {
    EXAM_MAX,
    MONTH_TOPICS,
    TASKS_GOAL,
    TOPICS_TOTAL,
    WEEK_GOAL,
    leadParts,
    monthGoal,
    planTasks,
    planTopics,
    sgn,
    weekPct,
} from './logic.ts';
import type { Ranked } from './logic.ts';
import type { JournalEntry, WeekStat } from './store.ts';

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---- Общие кирпичики ----

const BLANK = '<p>&nbsp;</p>';

const tr = (cells: string[], align: string[], bold = false) =>
    `<tr>${cells.map((c, i) => `<td align="${align[i]}">${bold ? `<b>${c}</b>` : c}</td>`).join('')}</tr>`;
const table = (rows: string) => `<table bordered striped compact>${rows}</table>`;

// Полоска 0..100% с заданным числом клеток
const pctBar = (pct: number, cells: number) => {
    const n = Math.max(0, Math.min(cells, Math.round((pct / 100) * cells)));
    return '▰'.repeat(n) + '▱'.repeat(cells - n);
};

// Склонение по числу: plural(1, ['задача', 'задачи', 'задач']) -> 'задача'
const plural = (n: number, [one, few, many]: [string, string, string]) => {
    const a = Math.abs(n) % 100;
    const b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b === 1) return one;
    if (b >= 2 && b <= 4) return few;
    return many;
};

// 🟢 — не отстаём ни по заданиям, ни по задачам; иначе 🔴
const onTrack = (r: Ranked, now: Date) => {
    const lead = leadParts(r.person, now);
    return (lead.topics ?? 0) >= 0 && (lead.tasks ?? 0) >= 0;
};

// Успеваемость по целям месяца

// Насколько участник укладывается в цели месяца. Веса те же, что в общем прогрессе (40/40/20).
// Каждая доля ограничена единицей: 100% значит, что все три цели месяца выполнены.
const monthPct = (r: Ranked, now: Date) => {
    const m = monthGoal(now);
    const p = r.person;
    const share = (value: number, goal: number) => Math.min(1, value / goal);
    return Math.round(
        100 *
        (0.4 * share(p.studied.length, m.topics) +
            0.4 * share(p.tasksTotal, m.tasks) +
            0.2 * share(p.exam ?? 0, m.exam)),
    );
};

// Невидимая таблица из трёх полей по центру: цели месяца (задания, задачи, пробник)
const goalsTable = (now: Date) => {
    const m = monthGoal(now);
    return `<table>${tr([`${m.topics}`, `${m.tasks}`, `${m.exam}`], ['center', 'center', 'center'])}</table>`;
};

// Строки таблицы: место и имя, полоска по центру, процент, кружок
const monthRows = (list: Ranked[], now: Date) =>
    list
        .map((r) => {
            const pct = monthPct(r, now);
            return tr(
                [
                    `${r.place} ${escHtml(cap(r.person.name))}`,
                    pctBar(pct, ARENA_CELLS),
                    `${pct}%`,
                    onTrack(r, now) ? '🟢' : '🔴',
                ],
                ['left', 'center', 'right', 'left'],
            );
        })
        .join('');

// ---- Арена ----

const ARENA_CELLS = 10;

export type ArenaMode = 'global' | 'week' | 'month';

export function renderArenaRich(
    ranked: Ranked[],
    viewerId: number | undefined,
    week: Map<number, WeekStat>,
    modeHtml: string,
    navHtml: string,
    mode: ArenaMode = 'week',
    now: Date = new Date(),
): string {
    if (ranked.length === 0) {
        return ['<h3>✨ Арена</h3>', '<p>Пока никого нет.</p>', BLANK, modeHtml, BLANK, navHtml].join('\n');
    }

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
        const rows = shown
            .map((r) =>
                tr(
                    [
                        `${r.place} ${escHtml(cap(r.person.name))}`,
                        pctBar(r.pct, ARENA_CELLS),
                        `${r.pct}%`,
                        onTrack(r, now) ? '🟢' : '🔴',
                    ],
                    ['left', 'center', 'right', 'left'],
                ),
            )
            .join('');
        body = table(rows);
    } else if (mode === 'week') {
        const rows = shown
            .map((r) => {
                const w = week.get(r.person.id) ?? { userId: r.person.id, tasks: 0, topics: 0, active: false };
                return { name: escHtml(cap(r.person.name)), w, goal: Math.round((w.tasks / WEEK_GOAL) * 100) };
            })
            .sort((a, b) => b.w.tasks - a.w.tasks || b.w.topics - a.w.topics)
            .map((x) =>
                tr(
                    [x.name, pctBar(x.goal, ARENA_CELLS), sgn(x.w.tasks), sgn(x.w.topics)],
                    ['left', 'center', 'right', 'right'],
                ),
            )
            .join('');
        body = table(rows);
    } else {
        // Месяц: успеваемость каждого по целям месяца
        body = table(monthRows(shown, now));
    }

    return [
        '<h3>✨ Арена</h3>',
        BLANK,
        leader,
        leader ? BLANK : '',
        body,
        BLANK,
        modeHtml,
        BLANK,
        navHtml,
    ]
        .filter(Boolean)
        .join('\n');
}

// ---- Главная админа ----

export function renderAdminHomeRich(
    firstName: string,
    ranked: Ranked[],
    buttonsHtml: string,
    now: Date = new Date(),
): string {
    return [
        `<h3>👑 Привет, ${escHtml(firstName)}!</h3>`,
        goalsTable(now),
        ranked.length ? table(monthRows(ranked, now)) : '<p>Пока никого нет.</p>',
        BLANK,
        buttonsHtml,
    ].join('\n');
}

// ---- Справка ----

const MONTH_NAMES = ['сен', 'окт', 'ноя', 'дек', 'янв', 'фев', 'март', 'апр'];

export function renderHelpRich(now: Date, buttonsHtml: string): string {
    let acc = 0;
    const schedule = MONTH_TOPICS.map((n, i) => {
        acc += n;
        return `• ${MONTH_NAMES[i]} — ${acc}`;
    }).join('<br>');

    return [
        '<h3>💎 Как считается прогресс?</h3>',
        `<p>[-/${TOPICS_TOTAL} заданий] + [-/${TASKS_GOAL} задач] + [-/${EXAM_MAX} баллов]</p>`,
        '<hr>',
        '<p><b>✨ Арена</b></p>',
        '<p>🟢 — не отстаём ни по заданиям, ни по задачам<br>🔴 — отстаём хотя бы по одному показателю</p>',
        '<hr>',
        '<p><b>⚡️ Сколько заданий нужно решать</b></p>',
        `<p>${schedule}</p>`,
        '<hr>',
        '<p><b>⚡️ Сегодня</b></p>',
        `<p>• заданий ${planTopics(now)}<br>• задач ${planTasks(now)}</p>`,
        buttonsHtml,
    ].join('\n');
}

// ---- Главная ученика ----

const GLOBAL_CELLS = 6;
const WEEK_CELLS = 10;
const MONTH_CELLS = 15;

// Полоска месячной цели: value/goal, не больше полной
const monthBar = (value: number, goal: number) =>
    pctBar(goal > 0 ? Math.min(1, value / goal) * 100 : 0, MONTH_CELLS);

export function renderStudentRich(
    r: Ranked,
    week: WeekStat | undefined,
    now: Date,
    buttonsHtml: string,
): string {
    const p = r.person;
    const w = week ?? { userId: p.id, tasks: 0, topics: 0, active: false };
    const goal = Math.round((w.tasks / WEEK_GOAL) * 100); // выполнение недели, может быть > 100
    const m = monthGoal(now);
    const hr = '<hr>';

    const notes = [
        `Нарешано ${w.tasks} ${plural(w.tasks, ['задача', 'задачи', 'задач'])} из ${WEEK_GOAL}`,
        `Изучили ${p.studied.length} ${plural(p.studied.length, ['задание', 'задания', 'заданий'])} из ${m.topics}`,
        p.exam === null
            ? `Пробник пока не внесён, цель ${m.exam} ${plural(m.exam, ['балл', 'балла', 'баллов'])}`
            : `Сейчас пишем пробник на ${p.exam} ${plural(p.exam, ['балл', 'балла', 'баллов'])} из ${m.exam}`,
    ].join('<br>');

    return [
        `<h3>${escHtml(cap(p.name))} 🎖${r.place}</h3>`,
        hr,
        `<p>Global ${pctBar(r.pct, GLOBAL_CELLS)} ${r.pct}%</p>`,
        `<p>Week ${pctBar(Math.min(goal, 100), WEEK_CELLS)} ${goal}%</p>`,
        hr,
        `<blockquote>${notes}</blockquote>`,
        hr,
        '<p><b>Month</b></p>',
        `<p>📗 ${monthBar(p.studied.length, m.topics)} ${p.studied.length}/${m.topics}</p>`,
        `<p>📘 ${monthBar(p.tasksTotal, m.tasks)} ${p.tasksTotal}/${m.tasks}</p>`,
        `<p>📕 ${monthBar(p.exam ?? 0, m.exam)} ${p.exam ?? '—'}/${m.exam}</p>`,
        buttonsHtml,
    ].join('\n');
}

// ---- Журнал ----

const JOURNAL_ICON: Record<string, string> = { done: '🟢', learning: '🟡', todo: '🔴' };

// Время по Москве: 15.11 15:42
const mskTime = (ms: number) => {
    const d = new Date(ms + 3 * 3600e3);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
};

// Время, имя, событие. Кнопки навигации и вкладки передаются готовым HTML
export function renderJournalRich(entries: JournalEntry[], navHtml: string, tabsHtml: string): string {
    if (entries.length === 0) {
        return ['<h3>📒 Журнал</h3>', '<p>Пока пусто.</p>', BLANK, tabsHtml].join('\n');
    }

    const body = entries
        .map((e) => {
            const time = mskTime(e.at);
            const who = escHtml(cap(e.name)) + (e.source === 'group' ? ' ⛺' : '');
            if (e.kind === 'task') {
                return tr([time, who, `${sgn(e.amount)} задач`], ['left', 'left', 'right']);
            }
            // Отметка 👑, если статус меняли не сам участник
            const byAdmin = e.actorTgId !== null && e.actorTgId !== e.tgId ? ' 👑' : '';
            const event = `${e.topicNo} ${JOURNAL_ICON[e.from]} → ${JOURNAL_ICON[e.to]}${byAdmin}`;
            return tr([time, who, event], ['left', 'left', 'right']);
        })
        .join('');

    return ['<h3>📒 Журнал</h3>', BLANK, table(body), BLANK, navHtml, BLANK, tabsHtml]
        .filter(Boolean)
        .join('\n');
}

// ---- Итоги недели в беседку ----

export function renderSummaryRich(rows: { name: string; tasks: number; topics: number }[]): string {
    const head = '<h3>🏆 Итоги недели</h3>';
    if (rows.length === 0) {
        return [head, BLANK, '<p>На этой неделе задач не было.</p>'].join('\n');
    }
    const header = tr(['№', 'Участник', 'Задачи', 'Задания'], ['left', 'left', 'right', 'right'], true);
    const body = rows
        .map((x, i) =>
            tr(
                [`${i + 1}`, escHtml(cap(x.name)), sgn(x.tasks), sgn(x.topics)],
                ['left', 'left', 'right', 'right'],
            ),
        )
        .join('');
    return [head, BLANK, table(header + body)].join('\n');
}