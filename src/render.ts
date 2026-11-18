import {
    EXAM_MAX,
    MONTH_TOPICS,
    TASKS_GOAL,
    TOPICS_TOTAL,
    WEEK_GOAL,
    isSleeping,
    monthGoal,
    monthPct,
    onTrack,
    planTasks,
    planTopics,
    sgn,
    visible,
    weekPct,
} from './logic.ts';
import type { Ranked } from './logic.ts';
import type { JournalEntry, WeekStat } from './store.ts';

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---- Общие кирпичики ----

const BLANK = '<p>&nbsp;</p>';
const ARENA_CELLS = 10;

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

// ---- Успеваемость по целям месяца ----

// Невидимая таблица из трёх полей по центру: цели месяца (задания, задачи, пробник)
const goalsTable = (now: Date) => {
    const m = monthGoal(now);
    return `<table>${tr([`${m.topics}`, `${m.tasks}`, `${m.exam}`], ['center', 'center', 'center'])}</table>`;
};

// Строки таблицы: имя (с местом или без), полоска по центру, процент, кружок.
// Если передано время последней активности, давно молчащим вместо кружка ставится 💤.
const monthRows = (
    list: Ranked[],
    now: Date,
    lastActive?: Map<number, number>,
    withPlace = true,
) =>
    list
        .map((r) => {
            const pct = monthPct(r, now);
            const status =
                lastActive && isSleeping(lastActive.get(r.person.id), now)
                    ? '💤'
                    : onTrack(r, now)
                      ? '🟢'
                      : '🔴';
            const name = escHtml(cap(r.person.name));
            return tr(
                [withPlace ? `${r.place} ${name}` : name, pctBar(pct, ARENA_CELLS), `${pct}%`, status],
                ['left', 'center', 'right', 'left'],
            );
        })
        .join('');

// ---- Главная админа ----

export function renderAdminHomeRich(
    firstName: string,
    ranked: Ranked[],
    buttonsHtml: string,
    lastActive: Map<number, number>,
    now: Date = new Date(),
): string {
    return [
        `<h3>👑 Привет, ${escHtml(firstName)}!</h3>`,
        goalsTable(now),
        ranked.length ? table(monthRows(ranked, now, lastActive, false)) : '<p>Пока никого нет.</p>',
        BLANK,
        buttonsHtml,
    ].join('\n');
}

// ---- Арена: глобально и успеваемость ----

export type ArenaMode = 'global' | 'month';

export function renderArenaRich(
    ranked: Ranked[],
    viewerId: number | undefined,
    modeHtml: string,
    navHtml: string,
    mode: ArenaMode = 'month',
    now: Date = new Date(),
): string {
    if (ranked.length === 0) {
        return ['<h3>✨ Арена</h3>', '<p>Пока никого нет.</p>', BLANK, modeHtml, BLANK, navHtml].join('\n');
    }

    const shown = visible(ranked, viewerId);

    // Лидер года: первое место рейтинга.
    // Имя, глобальный прогресс, успеваемость по целям месяца, пробник, задания, задачи
    const r = ranked[0];
    const p = r.person;
    const leader = `<h3>👑 Лидер года</h3>${table(
        tr(
            [
                escHtml(cap(p.name)),
                `${r.pct}%`,
                `${monthPct(r, now)}%`,
                `${p.exam ?? '—'}`,
                `${p.studied.length}`,
                `${p.tasksTotal}`,
            ],
            ['left', 'center', 'center', 'center', 'center', 'center'],
        ),
    )}`;

    let body: string;
    if (mode === 'global') {
        body = table(
            shown
                .map((x) =>
                    tr(
                        [
                            escHtml(cap(x.person.name)),
                            pctBar(x.pct, ARENA_CELLS),
                            `${x.pct}%`,
                            onTrack(x, now) ? '🟢' : '🔴',
                        ],
                        ['left', 'center', 'right', 'left'],
                    ),
                )
                .join(''),
        );
    } else {
        body = table(monthRows(shown, now, undefined, false));
    }

    return [
        '<h3>✨ Арена</h3>',
        BLANK,
        leader,
        BLANK,
        body,
        BLANK,
        ...(modeHtml ? [modeHtml, BLANK] : []), // у гостя переключателя нет
        navHtml,
    ].join('\n');
}

// ---- Неделя ----

export function renderWeekRich(
    ranked: Ranked[],
    viewerId: number | undefined,
    week: Map<number, WeekStat>,
    navHtml: string,
): string {
    if (ranked.length === 0) {
        return ['<h3>📅 Неделя</h3>', '<p>Пока никого нет.</p>', BLANK, navHtml].join('\n');
    }

    const shown = visible(ranked, viewerId);

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

    // Полоска выполнения (задачи / норма), затем задачи и задания за неделю
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

    return ['<h3>📅 Неделя</h3>', BLANK, leader, leader ? BLANK : '', table(rows), BLANK, navHtml]
        .filter(Boolean)
        .join('\n');
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
        BLANK,
        buttonsHtml,
    ].join('\n');
}

// ---- Профиль ученика ----

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
        BLANK,
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
                const byAdmin = e.actorTgId !== null && e.actorTgId !== e.tgId;
                const actorMark = byAdmin || e.source === 'admin' ? ' 👑' : '';
                return tr([time, who + actorMark, `${sgn(e.amount)} задач`], ['left', 'left', 'right']);
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
