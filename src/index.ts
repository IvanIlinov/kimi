import { ADMIN_IDS, BOT_TOKEN } from './config.ts';
import {
    answerCallbackQuery,
    callApi,
    deleteMessage,
    editMessageText,
    editRich,
    getUpdates,
    sendMessage,
    sendRich,
    setReaction
} from './telegram.ts';
import type { CallbackQuery, Update } from './telegram.ts';
import {
    leadParts, planTasks, planTopics, rank,
    TASKS_GOAL, TOPICS_TOTAL, sgn, weekPct, WEEK_GOAL
} from './logic.ts';
import type { Person, Ranked } from './logic.ts';
import {
    cap, renderArena, renderArenaRich, renderStudentRich,
    renderHelpProgress, renderJournal, renderProfile, renderJournalRich
} from './render.ts';
import { getPersons, getWeekStats, getJournal } from './store.ts';
import type { WeekStat } from './store.ts';
import { addTasks, setExam, setTopicStatus } from './write.ts';
import { addUser, removeUser, renameUser } from './admin.ts';
import { startWeeklySummary } from './weekly.ts';



type TopicStatus = 'done' | 'learning' | 'todo';
type Btn = { text: string; callback_data: string };
type Reply = { text: string; rich?: string; parse_mode?: 'HTML'; keyboard?: unknown };

const NOT_MEMBER = 'В Арене супер интересно!';
// RICH_UI=0 в .env возвращает текстовый вариант главной
const RICH_UI = process.env.RICH_UI !== '0';

const ADMIN_HELP =
    'Команды админа:\n' +
    '/add <tg_id> <имя>\n' +
    '/rename <id> <имя>\n' +
    '/remove <id>\n' +
    '/exam <id> <балл>\n' +
    '/as <tg_id> — смотреть глазами участника (без изменений)' +
    '/as off — выйти\n>\n' +
    '/id — узнать свой Telegram id';

const ICON: Record<TopicStatus, string> = { done: '🟢', learning: '🟡', todo: '🔴' };
const TOPICS_LEGEND =
    '🟢 изучено · 🟡 в процессе · 🔴 не изучено\n' +
    'Нажмите номер, статус сменится: 🔴 → 🟡 → 🟢 → 🔴';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const withNote = (note: string, body: string) => (note ? `${note}\n\n${body}` : body);
const warn = (err: string | null) => (err ? `⚠️ ${err}` : '');

// Полоска из 10 клеток по проценту недели (0..100)
const homeBar = (pct: number) => {
    const n = Math.max(0, Math.min(10, Math.round(pct / 10)));
    return '▰'.repeat(n) + '▱'.repeat(10 - n);
};

const isAdmin = (id: number) => ADMIN_IDS.includes(id);
const all = () => rank(getPersons());
const findByTg = (tgId: number) => all().find((r) => r.person.tgId === tgId);
const findById = (id: number) => all().find((r) => r.person.id === id);
const isGuest = (viewerId: number) => !findByTg(viewerId) && !isAdmin(viewerId);

const addRow = (base: string): Btn[] =>
    [-1, 1, 5, 10].map((n) => ({ text: n > 0 ? `+${n}` : `${n}`, callback_data: `${base}:${n}` }));

// Кнопки под своим профилем
const PANEL_KEYBOARD = {
    inline_keyboard: [
        addRow('add'),
        [
            { text: '👤 Профиль', callback_data: 'show:me' },
            { text: '📘 Задания', callback_data: 'show:topics' },
            { text: '✨ Арена', callback_data: 'show:arena' },
        ],
    ],
};

// Кнопки главной ученика (в Rich они встроены в сообщение, в тексте идут как reply_markup)
const STUDENT_KB = {
    inline_keyboard: [
        [
            { text: '+1', callback_data: 'add:1' },
            { text: '+3', callback_data: 'add:3' },
            { text: '+5', callback_data: 'add:5' },
            { text: '+10', callback_data: 'add:10' },
        ],
        [
            { text: '📘 Задания', callback_data: 'show:topics' },
            { text: '✨ Арена', callback_data: 'show:arena' },
            { text: '🧾 Шпаргалки', callback_data: 'show:cheat' },
        ],
    ],
};

// Нижние вкладки админа
const ADMIN_TABS: Btn[] = [
    { text: '🏠 Главная', callback_data: 'adm:home' },
    { text: '📒 Журнал', callback_data: 'adm:log' },
    { text: '✨ Арена', callback_data: 'show:arena' },
];
const ADMIN_KEYBOARD = { inline_keyboard: [ADMIN_TABS] };

// Кнопки под профилем чужого участника (для обычного ученика)
const BACK_KEYBOARD = {
    inline_keyboard: [
        [{ text: '← Арена', callback_data: 'show:arena' }],
        [{ text: '👤 Профиль', callback_data: 'show:me' }],
    ],
};

const SELF_BACK: Btn = { text: '← Профиль', callback_data: 'show:me' };

// Кнопки админа под профилем участника
function adminUserKeyboard(id: number) {
    return {
        inline_keyboard: [
            addRow(`a:${id}:add`),
            [
                { text: '📘 Задания', callback_data: `a:${id}:topics` },
                { text: '🔄 Обновить', callback_data: `a:${id}:me` },
            ],
            [{ text: '← Арена', callback_data: 'show:arena' }],
        ],
    };
}

// Кнопки для Rich-сообщения: та же раскладка, что у arenaKeyboard
const richButtons = (rows: Btn[][]) =>
    rows
        .map(
            (r) =>
                `<tg-button-row align="center">${r
                    .map((b) => `<tg-button type="callback_data" data="${b.callback_data}">${esc(b.text)}</tg-button>`)
                    .join('')}</tg-button-row>`,
        )
        .join('\n');

// Кнопки арены: по одной на участника топ-10 и на смотрящего. Кнопка профиля только у участников.
function arenaKeyboard(ranked: Ranked[], viewerId: number) {
    const top = ranked.slice(0, 10);
    const mine = ranked.find((r) => r.person.tgId === viewerId);
    const shown = mine && !top.includes(mine) ? [...top, mine] : top;

    const rows: Btn[][] = [];
    for (let i = 0; i < shown.length; i += 3) {
        rows.push(
            shown.slice(i, i + 3).map((r) => ({
                text: cap(r.person.name),
                callback_data: `show:user:${r.person.id}`,
            })),
        );
    }
    if (isAdmin(viewerId)) rows.push(ADMIN_TABS);
    else if (!isGuest(viewerId)) rows.push([{ text: '← Профиль', callback_data: 'show:me' }]);
    return { inline_keyboard: rows };
}

// Статусы заданий
function statusOf(p: Person, topic: number): TopicStatus {
    if (p.studied.includes(topic)) return 'done';
    if (p.learning.includes(topic)) return 'learning';
    return 'todo';
}

const nextStatus = (s: TopicStatus): TopicStatus =>
    s === 'todo' ? 'learning' : s === 'learning' ? 'done' : 'todo';

// Экран заданий. prefix определяет, чьи задания меняются: 'topic' или 'a:<id>:topic'
function topicsKeyboard(p: Person, prefix: string, back: Btn) {
    const rows: Btn[][] = [];
    for (let from = 1; from <= 27; from += 6) {
        const row: Btn[] = [];
        for (let n = from; n < from + 6 && n <= 27; n++) {
            row.push({ text: `${ICON[statusOf(p, n)]}${n}`, callback_data: `${prefix}:${n}` });
        }
        rows.push(row);
    }
    rows.push([back]);
    return { inline_keyboard: rows };
}

// Экраны

function screenArena(viewerId: number, note = '', mode: 'global' | 'week' = 'global'): Reply {
    const ranked = all();
    const week = new Map(getWeekStats().map((s) => [s.userId, s]));

    // Переключатель режима: текущий отмечен точкой
    const modeRow: Btn[] = [
        {
            text: mode === 'global' ? '• 🌍 Глобально' : '🌍 Глобально',
            callback_data: 'show:arena:global',
        },
        {
            text: mode === 'week' ? '• 📅 Неделя' : '📅 Неделя',
            callback_data: 'show:arena:week',
        },
    ];
    const navRows = arenaKeyboard(ranked, viewerId).inline_keyboard;
    const kb = { inline_keyboard: [modeRow, ...navRows] };

    // Текстовый вариант (запасной)
    const leader = weekLeaderLine();
    const body = renderArena(ranked, viewerId, week);
    const text = leader ? `✨ Арена\n\n${leader}\n\n${body.replace(/^✨ Арена\n\n/, '')}` : body;

    // Rich-вариант: режим и навигация отдельными блоками, между ними пустые строки
    const rich = renderArenaRich(
        ranked,
        viewerId,
        week,
        richButtons([modeRow]),
        richButtons(navRows),
        mode,
    );

    return {
        text: withNote(note, text),
        rich: note ? `<p>${esc(note)}</p>\n${rich}` : rich,
        keyboard: kb,
    };
}

// Стабильный недельный процент: сколько прогресса дают нормативы за 7 дней
function stablePct(now: Date): number {
    const weekAgo = new Date(now.getTime() - 7 * 864e5);
    const dTopics = planTopics(now) - planTopics(weekAgo);
    const dTasks = planTasks(now) - planTasks(weekAgo);
    return 100 * (0.4 * dTopics / TOPICS_TOTAL + 0.4 * dTasks / TASKS_GOAL);
}

// Лидер недели для арены: по заданиям, при равенстве по задачам
function weekLeaderLine(): string {
    const active = getWeekStats().filter((s) => s.active);
    if (active.length === 0) return '';
    const best = [...active].sort((a, b) => b.topics - a.topics || b.tasks - a.tasks)[0];
    const name = all().find((r) => r.person.id === best.userId)?.person.name ?? '—';
    return `👑 Лидер недели 👑 ${cap(name)} 👑\n👑 ${sgn(Math.round(weekPct(best)))}% ${sgn(best.tasks)} задач ${sgn(best.topics)} заданий`;
}

// Главная админа: приветствие и индикатор недели по каждому участнику (в порядке рейтинга)
// 🟢 — норматив по задачам выполнен, 🟡 — хотя бы одна задача, 🔴 — не приступали
function screenAdminHome(firstName: string): Reply {
    const week = new Map(getWeekStats().map((s) => [s.userId, s]));
    const icon = (r: Ranked) => {
        const tasks = week.get(r.person.id)?.tasks ?? 0;
        return tasks >= WEEK_GOAL ? '🟢' : tasks > 0 ? '🟡' : '🔴';
    };
    const row = all().map(icon).join(' ');

    const rich = [
        `<h3>👑 Привет, ${esc(firstName)}!</h3>`,
        '<p>&nbsp;</p>',
        `<p>${row}</p>`,
        '<p>&nbsp;</p>',
        richButtons(ADMIN_KEYBOARD.inline_keyboard),
    ].join('\n');

    return {
        text: `👑 Привет, ${firstName}!\n\n${row}`,
        rich,
        keyboard: ADMIN_KEYBOARD,
    };
}

const JOURNAL_PAGE = 15;

function screenAdminLog(offset = 0): Reply {
    const rows = getJournal(JOURNAL_PAGE + 1, offset);
    const hasMore = rows.length > JOURNAL_PAGE;
    const entries = rows.slice(0, JOURNAL_PAGE);

    const nav: Btn[] = [];
    if (offset > 0) nav.push({ text: '◀ Новее', callback_data: `adm:log:${Math.max(0, offset - JOURNAL_PAGE)}` });
    if (hasMore) nav.push({ text: 'Старее ▶', callback_data: `adm:log:${offset + JOURNAL_PAGE}` });

    const navRows: Btn[][] = nav.length ? [nav] : [];
    const tabs = ADMIN_KEYBOARD.inline_keyboard;

    return {
        text: renderJournal(entries),
        rich: renderJournalRich(entries, richButtons(navRows), richButtons(tabs)),
        keyboard: { inline_keyboard: [...navRows, ...tabs] },
    };
}

function screenSelf(viewerId: number, note = ''): Reply {
    const r = findByTg(viewerId);
    if (!r) return { text: NOT_MEMBER };
    const now = new Date();
    const week = getWeekStats().find((s) => s.userId === r.person.id);
    const rich = renderStudentRich(r, week, now, richButtons(STUDENT_KB.inline_keyboard));
    return {
        text: withNote(note, renderProfile(r, now)),
        rich: note ? `<p>${esc(note)}</p>\n${rich}` : rich,
        keyboard: STUDENT_KB,
    };
}

function screenUser(id: number, viewerId: number, note = ''): Reply {
    const r = findById(id);
    if (!r) return { text: 'Участник не найден.' };
    const now = new Date();
    const week = getWeekStats().find((s) => s.userId === r.person.id);
    const profile = renderProfile(r, now);

    // Админ: карточка в Rich-формате, кнопки управления внизу
    if (isAdmin(viewerId)) {
        const kb = adminUserKeyboard(id);
        const buttons = `<p>👑 Режим админа</p>\n${richButtons(kb.inline_keyboard)}`;
        const rich = renderStudentRich(r, week, now, buttons);
        return {
            text: withNote(note, profile + '\n\n👑 Режим админа'),
            rich: note ? `<p>${esc(note)}</p>\n${rich}` : rich,
            keyboard: kb,
        };
    }

    // Гость: только возврат в арену
    if (isGuest(viewerId)) {
        const kb = { inline_keyboard: [[{ text: '← Арена', callback_data: 'show:arena' }]] };
        const rich = renderStudentRich(r, week, now, richButtons(kb.inline_keyboard));
        return {
            text: withNote(note, profile),
            rich: note ? `<p>${esc(note)}</p>\n${rich}` : rich,
            keyboard: kb,
        };
    }

    // Участник: карточка друга с кнопками назад
    const rich = renderStudentRich(r, week, now, richButtons(BACK_KEYBOARD.inline_keyboard));
    return {
        text: withNote(note, profile),
        rich: note ? `<p>${esc(note)}</p>\n${rich}` : rich,
        keyboard: BACK_KEYBOARD,
    };
}

function screenTopics(p: Person, prefix: string, back: Btn, note = '', title = ''): Reply {
    // Текстовый вариант (запасной)
    const text = withNote(note, `📘 Задания${title}\n${TOPICS_LEGEND}`);

    // Сетка заданий: 27 кнопок по 8 в ряд
    const cells: Btn[] = Array.from({ length: 27 }, (_, i) => {
        const n = i + 1;
        return { text: `${ICON[statusOf(p, n)]}${n}`, callback_data: `${prefix}:${n}` };
    });
    const grid: Btn[][] = [];
    for (let i = 0; i < cells.length; i += 8) grid.push(cells.slice(i, i + 8));

    const rich = [
        `<h3>📘 Задания${esc(title)}</h3>`,
        note ? `<p>${esc(note)}</p>` : '',
        '<p>&nbsp;</p>',
        richButtons(grid),
        '<p>&nbsp;</p>',
        richButtons([[back]]),
    ]
        .filter(Boolean)
        .join('\n');

    return {
        text,
        rich,
        keyboard: topicsKeyboard(p, prefix, back),
    };
}


function applyChange(
    personId: number,
    op: string,
    arg: string,
    actorTgId: number,
    source: 'bot' | 'group' = 'bot',
): string | null {
    try {
        if (op === 'add') addTasks(personId, Number(arg), source);
        else if (op === 'exam') setExam(personId, Number(arg));
        else if (op === 'topic') {
            const p = findById(personId)!.person;
            const n = Number(arg);
            setTopicStatus(personId, n, nextStatus(statusOf(p, n)), actorTgId);
        }
        return null;
    } catch (e) {
        return (e as Error).message;
    }
}

// Единое место, где меняются данные и собирается ответ на действие из кнопки или текста
function applyAction(viewerId: number, action: string, firstName = 'Вань!'): Reply {
    const [kind, a, b, c] = action.split(':');

    if (isAdmin(viewerId) && (kind === 'adm' || (kind === 'show' && (a === undefined || a === 'me')))) {
        if (kind === 'adm' && a === 'log') return screenAdminLog(Number(b) || 0);
        if (kind === 'adm' && a === 'arena') return screenArena(viewerId);
        if (kind === 'adm' || kind === 'show') return screenAdminHome(firstName);
    }

    // Гость видит только арену и профили участников, всё остальное возвращает в арену
    if (isGuest(viewerId) && !(kind === 'show' && (a === 'arena' || a === 'user'))) {
        return screenArena(viewerId, kind === 'show' ? '' : 'Это доступно только участникам рейтинга.');
    }

    if (a === 'help') return {
        text: renderHelpProgress(new Date()),
        keyboard: { inline_keyboard: [[SELF_BACK]] }
    };

    if (kind === 'show') {
        if (a === 'arena') return screenArena(viewerId, '', b === 'week' ? 'week' : 'global');
        if (a === 'user') return screenUser(Number(b), viewerId);
        if (a === 'topics') {
            const r = findByTg(viewerId);
            if (!r) return { text: NOT_MEMBER };
            return screenTopics(r.person, 'topic', SELF_BACK);
        }
        if (a === 'cheat') {
            const back = [[SELF_BACK]];
            return {
                text: '🧾 Шпаргалки скоро появятся',
                rich: `<h3>🧾 Шпаргалки</h3>\n<p>Скоро появятся.</p>\n${richButtons(back)}`,
                keyboard: { inline_keyboard: back },
            };
        }
        return screenSelf(viewerId);
    }

    // Свои данные: участник меняет только себя
    if (kind === 'add' || kind === 'exam' || kind === 'topic') {
        const r = findByTg(viewerId);
        if (!r) return { text: NOT_MEMBER };
        const err = applyChange(r.person.id, kind, a, viewerId);
        if (kind === 'topic') {
            return screenTopics(findById(r.person.id)!.person, 'topic', SELF_BACK, warn(err));
        }
        return screenSelf(viewerId, warn(err));
    }

    // Админ: a:<id>:<op>[:arg]
    if (kind === 'a') {
        if (!isAdmin(viewerId)) return { text: 'Недостаточно прав.' };
        const id = Number(a);
        const target = findById(id);
        if (!target) return { text: 'Участник не найден.' };

        if (b === 'me') return screenUser(id, viewerId);
        if (b === 'topics') {
            return screenTopics(target.person, `a:${id}:topic`, { text: '← Игрок', callback_data: `a:${id}:me` }, '', `: ${target.person.name}`);
        }

        const err = applyChange(id, b, c, viewerId);
        if (b === 'topic') {
            return screenTopics(findById(id)!.person, `a:${id}:topic`, { text: '← Игрок', callback_data: `a:${id}:me` }, warn(err), `: ${target.person.name}`);
        }
        return screenUser(id, viewerId, warn(err));
    }

    return screenSelf(viewerId);
}

// Админские текстовые команды. Возвращает null, если сообщение не админская команда.
function adminCommand(viewerId: number, text: string): Reply | null {
    if (!isAdmin(viewerId) || !text.startsWith('/')) return null;
    const [cmd, ...rest] = text.split(/\s+/);

    try {
        switch (cmd) {
            case '/add': {
                const name = rest.slice(1).join(' ');
                addUser(Number(rest[0]), name);
                return screenArena(viewerId, `✅ Добавлен: ${name}`);
            }
            case '/rename': {
                const id = Number(rest[0]);
                if (!findById(id)) throw new Error('Участник не найден');
                const name = rest.slice(1).join(' ');
                renameUser(id, name);
                return screenArena(viewerId, `✅ Переименован: ${name}`);
            }
            case '/remove': {
                const id = Number(rest[0]);
                if (!findById(id)) throw new Error('Участник не найден');
                removeUser(id);
                return screenArena(viewerId, '✅ Убран из рейтинга');
            }
            case '/exam': {
                const id = Number(rest[0]);
                if (!findById(id)) throw new Error('Участник не найден');
                setExam(id, Number(rest[1]));
                return screenArena(viewerId, '✅ Пробник обновлён');
            }
            case '/start':
                return null;
            default:
                return { text: ADMIN_HELP, keyboard: PANEL_KEYBOARD };
        }
    } catch (e) {
        return screenArena(viewerId, `⚠️ ${(e as Error).message}`);
    }
}

// Текст сообщения → действие. Всё нераспознанное (в том числе /start) показывает профиль.
function actionFromText(text: string): string {
    if (text === '?') return 'show:help';
    if (text === '👤 Профиль') return 'show:me';
    if (text === '📘 Задания') return 'show:topics';
    if (text === '✨ Арена') return 'show:arena';

    const add = text.match(/^([+-])\s*(\d+)$/);
    if (add) return `add:${Number(add[2]) * (add[1] === '-' ? -1 : 1)}`;

    const exam = text.match(/^=\s*(\d+)$/);
    if (exam) return `exam:${exam[1]}`;

    return 'show:me';
}

// Состояние интерфейса
const panel = new Map<number, number>(); // chatId -> message_id единственной панели
const keyboardCleared = new Set<number>(); // чаты, где уже убрали старую reply-клавиатуру

// adminTgId -> tgId участника, которого админ сейчас смотрит
const viewAsMap = new Map<number, number>();

// Ответ с учётом режима просмотра. В режиме просмотра изменения отключены.
function respond(viewerId: number, action: string, firstName: string): Reply {
    const targetTg = viewAsMap.get(viewerId);
    if (targetTg === undefined) return applyAction(viewerId, action, firstName);

    const target = findByTg(targetTg);
    if (!target) {
        viewAsMap.delete(viewerId);
        return applyAction(viewerId, action, firstName);
    }

    const kind = action.split(':')[0];
    const banner = `👁 Вы смотрите как ${cap(target.person.name)} · /as off — выйти`;

    // Изменения и админские действия в режиме просмотра не выполняем
    if (kind === 'add' || kind === 'exam' || kind === 'topic' || kind === 'a' || kind === 'adm') {
        const base = applyAction(targetTg, 'show:me', firstName);
        return { ...base, text: `${banner}\n⛔ Изменения отключены\n\n${base.text}` };
    }

    const r = applyAction(targetTg, action, firstName);
    return { ...r, text: `${banner}\n\n${r.text}` };
}

async function deleteQuietly(chatId: number, messageId: number): Promise<void> {
    try {
        await deleteMessage(BOT_TOKEN, chatId, messageId);
    } catch {
        // Не страшно, если удалить не получилось
    }
}

async function showPanel(chatId: number, reply: Reply): Promise<void> {
    const useRich = RICH_UI && !!reply.rich;
    const opts = { parse_mode: reply.parse_mode, reply_markup: reply.keyboard ?? PANEL_KEYBOARD };
    const id = panel.get(chatId);

    if (id) {
        try {
            if (useRich) await editRich(BOT_TOKEN, chatId, id, reply.rich!);
            else await editMessageText(BOT_TOKEN, chatId, id, reply.text, opts);
            return;
        } catch (e) {
            if (String(e).includes('not modified')) return;
            console.log('[panel] редактирование не удалось:', String(e));
            await deleteQuietly(chatId, id);
        }
    }

    const sent = useRich
        ? await sendRich(BOT_TOKEN, chatId, reply.rich!)
        : await sendMessage(BOT_TOKEN, chatId, reply.text, opts);
    panel.set(chatId, sent.message_id);
}

async function handleCallback(q: CallbackQuery): Promise<void> {
    await answerCallbackQuery(BOT_TOKEN, q.id).catch(() => { });

    const msg = q.message;
    if (!msg || !q.data) return;

    panel.set(msg.chat.id, msg.message_id);
    await showPanel(msg.chat.id, respond(q.from.id, q.data, q.from.first_name));
}

async function handle(u: Update): Promise<void> {
    if (u.callback_query) {
        await handleCallback(u.callback_query);
        return;
    }

    const m = u.message;
    if (!m?.text || !m.from) return;

    const chatId = m.chat.id;
    const viewerId = m.from.id;
    const text = m.text.trim();

    // Беседка: отдельный обработчик, панель и вкладки здесь не используются
    if (m.chat.type === 'group' || m.chat.type === 'supergroup') {
        console.log('[group] chat id:', m.chat.id); // временно, чтобы узнать id беседки
        await handleGroup(m, text);
        return;
    }

    await deleteQuietly(chatId, m.message_id); // ваши сообщения не остаются в чате

    // Снимаем старую reply-клавиатуру один раз
    if (!keyboardCleared.has(chatId)) {
        keyboardCleared.add(chatId);
        const tmp = await sendMessage(BOT_TOKEN, chatId, '⌨️', {
            reply_markup: { remove_keyboard: true },
        });
        await deleteQuietly(chatId, tmp.message_id);
    }

    if (text === '/id') {
        await showPanel(chatId, { text: `Твой id: ${viewerId}`, keyboard: PANEL_KEYBOARD });
        return;
    }

    if (isAdmin(viewerId) && /^\/as(\s|$)/.test(text)) {
        const arg = text.split(/\s+/)[1];
        if (!arg || arg === 'off') {
            viewAsMap.delete(viewerId);
            await showPanel(chatId, screenSelf(viewerId, '👁 Режим просмотра выключен'));
            return;
        }
        const targetTg = Number(arg);
        if (!findByTg(targetTg)) {
            await showPanel(chatId, screenArena(viewerId, `⚠️ Участника с id ${arg} нет`));
            return;
        }
        viewAsMap.set(viewerId, targetTg);
        await showPanel(chatId, respond(viewerId, 'show:me', m.from.first_name));
        return;
    }

    const adminReply = adminCommand(viewerId, text);
    if (adminReply) {
        await showPanel(chatId, adminReply);
        return;
    }

    await showPanel(chatId, respond(viewerId, actionFromText(text), m.from.first_name));
}

// В беседке принимаем только +N и =N от участников. Остальное игнорируем, гостей не трогаем.
// Беседка: +N и =N от участников. Ответа в чат не отправляем: сообщение удаляется,
// ошибки уходят участнику в личку.
// Беседка: +N и =N от участников. Сообщение не удаляем, на успешную запись ставим реакцию.
// Ошибки уходят участнику в личку.
async function handleGroup(m: NonNullable<Update['message']>, text: string): Promise<void> {
    const addMatch = text.match(/^([+-])\s*(\d+)$/);
    const examMatch = text.match(/^=\s*(\d+)$/);
    if (!addMatch && !examMatch) return;

    const viewerId = m.from!.id;
    const me = findByTg(viewerId);
    if (!me) return; // гости не трогаем

    const op = addMatch ? 'add' : 'exam';
    const arg = addMatch
        ? String(Number(addMatch[2]) * (addMatch[1] === '-' ? -1 : 1))
        : examMatch![1];
    const err = applyChange(me.person.id, op, arg, viewerId, 'group');

    if (err) {
        try {
            await sendMessage(BOT_TOKEN, viewerId, `⚠️ ${err}`);
        } catch (e) {
            console.log('[group] личка не отправлена:', String(e));
        }
        return;
    }

    try {
        await setReaction(BOT_TOKEN, m.chat.id, m.message_id, '✍');
    } catch (e) {
        console.log('[group] реакция не поставлена:', String(e));
    }
}

const me = await callApi<{ username: string }>(BOT_TOKEN, 'getMe');
console.log(`Бот @${me.username} запущен`);
startWeeklySummary();

let offset = 0;
for (; ;) {
    try {
        for (const u of await getUpdates(BOT_TOKEN, offset)) {
            offset = u.update_id + 1;
            await handle(u).catch((e) => console.error('handle:', e));
        }
    } catch (e) {
        console.error('getUpdates:', e);
        await new Promise((r) => setTimeout(r, 3000));
    }
}