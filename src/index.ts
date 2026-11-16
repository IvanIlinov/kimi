import { ADMIN_IDS, BOT_TOKEN } from './config.ts';
import {
    answerCallbackQuery,
    callApi,
    deleteMessage,
    editRich,
    getUpdates,
    sendMessage,
    sendRich,
    setReaction,
} from './telegram.ts';
import type { CallbackQuery, Update } from './telegram.ts';
import { rank, WEEK_GOAL } from './logic.ts';
import type { Person, Ranked } from './logic.ts';
import {
    cap,
    escHtml,
    renderArenaRich,
    renderHelpRich,
    renderJournalRich,
    renderStudentRich,
    renderAdminHomeRich
} from './render.ts';
import type { ArenaMode } from './render.ts';
import { getJournal, getPersons, getWeekStats } from './store.ts';
import { addTasks, setExam, setTopicStatus } from './write.ts';
import { addUser, removeUser, renameUser } from './admin.ts';
import { startWeeklySummary } from './weekly.ts';
import { startTagSync, syncTag } from './tags.ts';

type TopicStatus = 'done' | 'learning' | 'todo';
type Btn = { text: string; callback_data: string };
type Reply = string; // готовый Rich-HTML

const NOT_MEMBER = 'В Арене супер интересно!';
const GUEST_VIEW = -1;

const ADMIN_HELP = [
    '/add <tg_id> <имя>',
    '/rename <id> <имя>',
    '/remove <id>',
    '/exam <id> <балл>',
    '/as <tg_id> — смотреть глазами участника (без изменений)',
    '/as guest — смотреть глазами гостя',
    '/as off — выйти',
    '/id — узнать свой Telegram id',
];

const ICON: Record<TopicStatus, string> = { done: '🟢', learning: '🟡', todo: '🔴' };

const isAdmin = (id: number) => ADMIN_IDS.includes(id);
const all = () => rank(getPersons());
const findByTg = (tgId: number) => all().find((r) => r.person.tgId === tgId);
const findById = (id: number) => all().find((r) => r.person.id === id);
const isGuest = (viewerId: number) => !findByTg(viewerId) && !isAdmin(viewerId);

// ---- Кнопки ----

// Кнопки встроены в Rich-сообщение
const richButtons = (rows: Btn[][]) =>
    rows
        .map(
            (r) =>
                `<tg-button-row align="center">${r
                    .map((b) => `<tg-button type="callback_data" data="${b.callback_data}">${escHtml(b.text)}</tg-button>`)
                    .join('')}</tg-button-row>`,
        )
        .join('\n');

const withNote = (note: string, html: string) => (note ? `<p>${escHtml(note)}</p>\n${html}` : html);
const warn = (err: string | null) => (err ? `⚠️ ${err}` : '');

// Короткое сообщение: текст и, если нужно, кнопки
const notice = (text: string, rows: Btn[][] = []) =>
    [`<p>${escHtml(text)}</p>`, richButtons(rows)].filter(Boolean).join('\n');

const addRow = (base: string): Btn[] =>
    [-1, 1, 5, 10].map((n) => ({ text: n > 0 ? `+${n}` : `${n}`, callback_data: `${base}:${n}` }));

const ARENA_BACK: Btn = { text: '← Арена', callback_data: 'show:arena' };
const SELF_BACK: Btn = { text: '← Профиль', callback_data: 'show:me' };

// Главная ученика
const STUDENT_ROWS: Btn[][] = [
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
];

// Нижние вкладки админа
const ADMIN_TABS: Btn[] = [
    { text: '🏠 Главная', callback_data: 'adm:home' },
    { text: '📒 Журнал', callback_data: 'adm:log' },
    { text: '✨ Арена', callback_data: 'show:arena' },
];
const ADMIN_ROWS: Btn[][] = [ADMIN_TABS];

// Под профилем чужого участника (для обычного ученика)
const BACK_ROWS: Btn[][] = [[ARENA_BACK], [{ text: '👤 Профиль', callback_data: 'show:me' }]];

// Под профилем участника для админа
const adminUserRows = (id: number): Btn[][] => [
    addRow(`a:${id}:add`),
    [
        { text: '📘 Задания', callback_data: `a:${id}:topics` },
        { text: '🔄 Обновить', callback_data: `a:${id}:me` },
    ],
    [ARENA_BACK],
];

// Куда вести человека из служебных сообщений
const homeRows = (viewerId: number): Btn[][] =>
    isAdmin(viewerId) ? ADMIN_ROWS : isGuest(viewerId) ? [[ARENA_BACK]] : [[SELF_BACK]];

// Кнопки арены: по одной на участника топ-10 и на смотрящего, отдельно нижние вкладки
function arenaRows(ranked: Ranked[], viewerId: number): { names: Btn[][]; tabs: Btn[] | null } {
    const top = ranked.slice(0, 10);
    const mine = ranked.find((r) => r.person.tgId === viewerId);
    const shown = mine && !top.includes(mine) ? [...top, mine] : top;

    const names: Btn[][] = [];
    for (let i = 0; i < shown.length; i += 3) {
        names.push(
            shown.slice(i, i + 3).map((r) => ({
                text: cap(r.person.name),
                callback_data: `show:user:${r.person.id}`,
            })),
        );
    }

    const tabs = isAdmin(viewerId) ? ADMIN_TABS : !isGuest(viewerId) ? [SELF_BACK] : null;
    return { names, tabs };
}

// ---- Статусы заданий ----

function statusOf(p: Person, topic: number): TopicStatus {
    if (p.studied.includes(topic)) return 'done';
    if (p.learning.includes(topic)) return 'learning';
    return 'todo';
}

const nextStatus = (s: TopicStatus): TopicStatus =>
    s === 'todo' ? 'learning' : s === 'learning' ? 'done' : 'todo';

// ---- Экраны ----

function screenArena(viewerId: number, note = '', mode: ArenaMode = 'week'): Reply {
    const ranked = all();
    const week = new Map(getWeekStats().map((s) => [s.userId, s]));

    // Переключатель режима: только эмодзи
    const modeRow: Btn[] = [
        { text: '🌍', callback_data: 'show:arena:global' },
        { text: '📅', callback_data: 'show:arena:week' },
        { text: '💯', callback_data: 'show:arena:month' },
    ];

    // Кнопки с именами, отступ, затем вкладки основного меню
    const { names, tabs } = arenaRows(ranked, viewerId);
    const nav = [
        richButtons(names),
        tabs ? '<p>&nbsp;</p>' : '',
        tabs ? richButtons([tabs]) : '',
    ]
        .filter(Boolean)
        .join('\n');

    const rich = renderArenaRich(ranked, viewerId, week, richButtons([modeRow]), nav, mode);
    return withNote(note, rich);
}

// Главная админа: приветствие и индикатор недели по каждому участнику (в порядке рейтинга)
// 🟢 — норматив по задачам выполнен, 🟡 — хотя бы одна задача, 🔴 — не приступали
// Главная админа: цели месяца и успеваемость каждого участника
function screenAdminHome(firstName: string): Reply {
    return renderAdminHomeRich(firstName, all(), richButtons(ADMIN_ROWS));
}

const JOURNAL_PAGE = 15;

function screenAdminLog(offset = 0): Reply {
    const rows = getJournal(JOURNAL_PAGE + 1, offset);
    const hasMore = rows.length > JOURNAL_PAGE;
    const entries = rows.slice(0, JOURNAL_PAGE);

    const nav: Btn[] = [];
    if (offset > 0) nav.push({ text: '◀ Новее', callback_data: `adm:log:${Math.max(0, offset - JOURNAL_PAGE)}` });
    if (hasMore) nav.push({ text: 'Старее ▶', callback_data: `adm:log:${offset + JOURNAL_PAGE}` });

    return renderJournalRich(entries, richButtons(nav.length ? [nav] : []), richButtons(ADMIN_ROWS));
}

function screenSelf(viewerId: number, note = ''): Reply {
    const r = findByTg(viewerId);
    if (!r) return notice(NOT_MEMBER);
    const week = getWeekStats().find((s) => s.userId === r.person.id);
    return withNote(note, renderStudentRich(r, week, new Date(), richButtons(STUDENT_ROWS)));
}

function screenUser(id: number, viewerId: number, note = ''): Reply {
    const r = findById(id);
    if (!r) return notice('Участник не найден.');
    const week = getWeekStats().find((s) => s.userId === r.person.id);

    const admin = isAdmin(viewerId);
    const rows = admin ? adminUserRows(id) : isGuest(viewerId) ? [[ARENA_BACK]] : BACK_ROWS;
    const buttons = (admin ? '<p>👑 Режим админа</p>\n' : '') + richButtons(rows);

    return withNote(note, renderStudentRich(r, week, new Date(), buttons));
}

// prefix определяет, чьи задания меняются: 'topic' или 'a:<id>:topic'
function screenTopics(p: Person, prefix: string, back: Btn, note = '', title = ''): Reply {
    // Сетка заданий: 27 кнопок по 8 в ряд
    const cells: Btn[] = Array.from({ length: 27 }, (_, i) => {
        const n = i + 1;
        return { text: `${ICON[statusOf(p, n)]}${n}`, callback_data: `${prefix}:${n}` };
    });
    const grid: Btn[][] = [];
    for (let i = 0; i < cells.length; i += 8) grid.push(cells.slice(i, i + 8));

    return [
        `<h3>📘 Задания${escHtml(title)}</h3>`,
        note ? `<p>${escHtml(note)}</p>` : '',
        '<p>&nbsp;</p>',
        richButtons(grid),
        '<p>&nbsp;</p>',
        richButtons([[back]]),
    ]
        .filter(Boolean)
        .join('\n');
}

// ---- Действия ----

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
function applyAction(viewerId: number, action: string, firstName: string): Reply {
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

    if (a === 'help') return renderHelpRich(new Date(), richButtons([[SELF_BACK]]));

    if (kind === 'show') {
        if (a === 'arena') {
            const mode: ArenaMode = b === 'global' ? 'global' : b === 'month' ? 'month' : 'week';
            return screenArena(viewerId, '', mode);
        }
        if (a === 'user') return screenUser(Number(b), viewerId);
        if (a === 'topics') {
            const r = findByTg(viewerId);
            if (!r) return notice(NOT_MEMBER);
            return screenTopics(r.person, 'topic', SELF_BACK);
        }
        if (a === 'cheat') {
            return `<h3>🧾 Шпаргалки</h3>\n<p>Скоро появятся.</p>\n${richButtons([[SELF_BACK]])}`;
        }
        return screenSelf(viewerId);
    }

    // Свои данные: участник меняет только себя
    if (kind === 'add' || kind === 'exam' || kind === 'topic') {
        const r = findByTg(viewerId);
        if (!r) return notice(NOT_MEMBER);
        const err = applyChange(r.person.id, kind, a, viewerId);
        if (kind === 'topic') {
            return screenTopics(findById(r.person.id)!.person, 'topic', SELF_BACK, warn(err));
        }
        return screenSelf(viewerId, warn(err));
    }

    // Админ: a:<id>:<op>[:arg]
    if (kind === 'a') {
        if (!isAdmin(viewerId)) return notice('Недостаточно прав.');
        const id = Number(a);
        const target = findById(id);
        if (!target) return notice('Участник не найден.');

        const back: Btn = { text: '← Игрок', callback_data: `a:${id}:me` };
        const title = `: ${target.person.name}`;

        if (b === 'me') return screenUser(id, viewerId);
        if (b === 'topics') return screenTopics(target.person, `a:${id}:topic`, back, '', title);

        const err = applyChange(id, b, c, viewerId);
        if (b === 'topic') {
            return screenTopics(findById(id)!.person, `a:${id}:topic`, back, warn(err), title);
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
                return [
                    '<h3>Команды админа</h3>',
                    `<p>${ADMIN_HELP.map(escHtml).join('<br>')}</p>`,
                    richButtons(ADMIN_ROWS),
                ].join('\n');
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

// ---- Состояние интерфейса ----

const panel = new Map<number, number>(); // chatId -> message_id единственной панели
const keyboardCleared = new Set<number>(); // чаты, где уже убрали старую reply-клавиатуру

// adminTgId -> tgId участника, которого админ сейчас смотрит
const viewAsMap = new Map<number, number>();

// Ответ с учётом режима просмотра. В режиме просмотра изменения отключены.
function respond(viewerId: number, action: string, firstName: string): Reply {
    const targetTg = viewAsMap.get(viewerId);
    if (targetTg === undefined) return applyAction(viewerId, action, firstName);

    const guestView = targetTg === GUEST_VIEW;
    const target = guestView ? undefined : findByTg(targetTg);
    if (!guestView && !target) {
        viewAsMap.delete(viewerId);
        return applyAction(viewerId, action, firstName);
    }

    const label = guestView ? 'Гость' : cap(target!.person.name);
    const banner = `<p>👁 Вы смотрите как ${escHtml(label)} · /as off — выйти</p>`;

    // Изменения и админские действия в режиме просмотра не выполняем
    const kind = action.split(':')[0];
    if (kind === 'add' || kind === 'exam' || kind === 'topic' || kind === 'a' || kind === 'adm') {
        const base = applyAction(targetTg, 'show:me', firstName);
        return `${banner}\n<p>⛔ Изменения отключены</p>\n${base}`;
    }

    return `${banner}\n${applyAction(targetTg, action, firstName)}`;
}

async function deleteQuietly(chatId: number, messageId: number): Promise<void> {
    try {
        await deleteMessage(BOT_TOKEN, chatId, messageId);
    } catch {
        // Не страшно, если удалить не получилось
    }
}

async function showPanel(chatId: number, html: Reply): Promise<void> {
    const id = panel.get(chatId);

    if (id) {
        try {
            await editRich(BOT_TOKEN, chatId, id, html);
            return;
        } catch (e) {
            if (String(e).includes('not modified')) return;
            console.log('[panel] редактирование не удалось:', String(e));
            await deleteQuietly(chatId, id);
        }
    }

    const sent = await sendRich(BOT_TOKEN, chatId, html);
    panel.set(chatId, sent.message_id);
}

// ---- Обработчики ----

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
        await showPanel(chatId, notice(`Твой id: ${viewerId}`, homeRows(viewerId)));
        return;
    }

    if (isAdmin(viewerId) && /^\/as(\s|$)/.test(text)) {
        const arg = text.split(/\s+/)[1];
        if (!arg || arg === 'off') {
            viewAsMap.delete(viewerId);
            await showPanel(
                chatId,
                withNote('👁 Режим просмотра выключен', respond(viewerId, 'show:me', m.from.first_name)),
            );
            return;
        }
        if (arg === 'guest') {
            viewAsMap.set(viewerId, GUEST_VIEW);
            await showPanel(chatId, respond(viewerId, 'show:me', m.from.first_name));
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

// Беседка: +N и =N от участников. Сообщение не удаляем, на успешную запись ставим реакцию.
// Ошибки уходят участнику в личку. Остальное игнорируем, гостей не трогаем.
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

    const fresh = findByTg(viewerId)!.person;
    void syncTag(viewerId, fresh.exam, fresh.tasksTotal);

    try {
        await setReaction(BOT_TOKEN, m.chat.id, m.message_id, '✍');
    } catch (e) {
        console.log('[group] реакция не поставлена:', String(e));
    }
}

// ---- Запуск ----

const bot = await callApi<{ username: string }>(BOT_TOKEN, 'getMe');
console.log(`Бот @${bot.username} запущен`);
startWeeklySummary();
startTagSync();

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