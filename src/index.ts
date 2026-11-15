import { ADMIN_IDS, BOT_TOKEN } from './config.ts';
import {
    answerCallbackQuery,
    callApi,
    deleteMessage,
    editMessageText,
    getUpdates,
    sendMessage,
} from './telegram.ts';
import type { CallbackQuery, Update } from './telegram.ts';
import { leadParts, planTasks, planTopics, rank, TASKS_GOAL, TOPICS_TOTAL, sgn, weekPct } from './logic.ts';
import type { Person, Ranked } from './logic.ts';
import { cap, renderArena, renderHelpProgress, renderProfile } from './render.ts';
import { getPersons, getWeekStats } from './store.ts';
import type { WeekStat } from './store.ts';
import { addTasks, setExam, setTopicStatus } from './write.ts';
import { addUser, removeUser, renameUser } from './admin.ts';

type TopicStatus = 'done' | 'learning' | 'todo';
type Btn = { text: string; callback_data: string };
type Reply = { text: string; parse_mode?: 'HTML'; keyboard?: unknown };

const NOT_MEMBER = 'В Арене супер интересно!';

const ADMIN_HELP =
    'Команды админа:\n' +
    '/add <tg_id> <имя>\n' +
    '/rename <id> <имя>\n' +
    '/remove <id>\n' +
    '/exam <id> <балл>\n' +
    '/id — узнать свой Telegram id';

const ICON: Record<TopicStatus, string> = { done: '🟢', learning: '🟡', todo: '🔴' };
const TOPICS_LEGEND =
    '🟢 изучено · 🟡 в процессе · 🔴 не изучено\n' +
    'Нажмите номер, статус сменится: 🔴 → 🟡 → 🟢 → 🔴';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const withNote = (note: string, body: string) => (note ? `${note}\n\n${body}` : body);
const warn = (err: string | null) => (err ? `⚠️ ${err}` : '');

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

// Кнопки арены: по одной на участника топ-10 и на смотрящего
// Кнопки арены: по одной на участника топ-10 и на смотрящего, внизу — возврат в профиль
// Кнопки арены: по одной на участника топ-10 и на смотрящего. Кнопка профиля только у участников.
function arenaKeyboard(ranked: Ranked[], viewerId: number) {
    const top = ranked.slice(0, 10);
    const mine = ranked.find((r) => r.person.tgId === viewerId);
    const shown = mine && !top.includes(mine) ? [...top, mine] : top;

    const rows: Btn[][] = [];
    for (let i = 0; i < shown.length; i += 2) {
        rows.push(
            shown.slice(i, i + 2).map((r) => ({
                text: r.person.name,
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

function screenArena(viewerId: number, note = ''): Reply {
    const ranked = all();
    const week = new Map(getWeekStats().map((s) => [s.userId, s]));
    const leader = weekLeaderLine();
    const body = renderArena(ranked, viewerId, week);
    const text = leader ? `✨ Арена\n\n${leader}\n\n${body.replace(/^✨ Арена\n\n/, '')}` : body;
    return {
        text: withNote(note, text),
        keyboard: arenaKeyboard(ranked, viewerId),
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

function screenAdminHome(firstName: string): Reply {
    const now = new Date();
    const stable = stablePct(now);
    const byId = new Map(getWeekStats().map((s) => [s.userId, s]));

    const rows = all().map((r) => {
        const s = byId.get(r.person.id) ?? { userId: r.person.id, tasks: 0, topics: 0, active: false };
        return { name: cap(r.person.name), person: r.person, s, pct: weekPct(s) };
    });

    const active = rows.filter((x) => x.s.active);
    const idle = rows.filter((x) => !x.s.active);
    const tops = active.filter((x) => x.pct >= stable).sort((a, b) => b.pct - a.pct);
    const lost = active.filter((x) => x.pct < stable).sort((a, b) => b.pct - a.pct);

    const line = (x: (typeof rows)[number]) =>
        `${x.name}: ${sgn(Math.round(x.pct))}% ${sgn(x.s.tasks)} задач ${sgn(x.s.topics)} заданий`;

    // Лидер недели: по заданиям, при равенстве по задачам
    const leader = [...active].sort((a, b) => b.s.topics - a.s.topics || b.s.tasks - a.s.tasks)[0];

    const behind = rows.filter((x) => {
        const lead = leadParts(x.person, now);
        return (lead.topics ?? 0) < 0 || (lead.tasks ?? 0) < 0;
    }).length;

    const parts: string[] = [
        `👑 Привет, ${firstName}!`,
        '',
        `Активны: ${active.length}/${rows.length}`,
        `Отстают: ${behind}/${rows.length}`,
    ];

    if (leader) {
        parts.push(
            '',
            `🏆 Лидер ${leader.name}`,
            `🏆 ${sgn(Math.round(leader.pct))}% ${sgn(leader.s.tasks)} задач ${sgn(leader.s.topics)} заданий`,
        );
    }
    if (tops.length) parts.push('', '⚡️ Топы', ...tops.map((x) => `⚡️ ${line(x)}`));
    if (lost.length) parts.push('', '🐼 Теряем', ...lost.map((x) => `🐼 ${line(x)}`));
    if (idle.length) parts.push('', '🐾 Не заходили', ...idle.map((x) => `🐾 ${x.name}`));

    return { text: parts.join('\n'), keyboard: ADMIN_KEYBOARD };
}

function screenAdminLog(): Reply {
    return { text: '📒 Журнал\n\nЗаписи появятся на следующем шаге.', keyboard: ADMIN_KEYBOARD };
}

function screenSelf(viewerId: number, note = ''): Reply {
    const r = findByTg(viewerId);
    if (!r) return { text: NOT_MEMBER };
    return { text: withNote(note, renderProfile(r, new Date())), keyboard: PANEL_KEYBOARD };
}

function screenUser(id: number, viewerId: number, note = ''): Reply {
    const r = findById(id);
    if (!r) return { text: 'Участник не найден.' };
    const profile = renderProfile(r, new Date());
    if (isAdmin(viewerId)) {
        return {
            text: withNote(note, profile + '\n\n👑 Режим админа'),
            keyboard: adminUserKeyboard(id),
        };
    }
    const keyboard = isGuest(viewerId)
        ? { inline_keyboard: [[{ text: '← Арена', callback_data: 'show:arena' }]] }
        : BACK_KEYBOARD;
    return { text: withNote(note, profile), keyboard };
}

function screenTopics(p: Person, prefix: string, back: Btn, note = '', title = ''): Reply {
    return {
        text: withNote(note, `📘 Задания${title}\n${TOPICS_LEGEND}`),
        keyboard: topicsKeyboard(p, prefix, back),
    };
}


function applyChange(personId: number, op: string, arg: string, actorTgId: number): string | null {
    try {
        if (op === 'add') addTasks(personId, Number(arg));
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
        if (kind === 'adm' && a === 'log') return screenAdminLog();
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
        if (a === 'arena') return screenArena(viewerId);
        if (a === 'user') return screenUser(Number(b), viewerId);
        if (a === 'topics') {
            const r = findByTg(viewerId);
            if (!r) return { text: NOT_MEMBER };
            return screenTopics(r.person, 'topic', SELF_BACK);
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

async function deleteQuietly(chatId: number, messageId: number): Promise<void> {
    try {
        await deleteMessage(BOT_TOKEN, chatId, messageId);
    } catch {
        // Не страшно, если удалить не получилось
    }
}

async function showPanel(chatId: number, reply: Reply): Promise<void> {
    const opts = {
        parse_mode: reply.parse_mode,
        reply_markup: reply.keyboard ?? PANEL_KEYBOARD,
    };
    const id = panel.get(chatId);

    if (id) {
        try {
            await editMessageText(BOT_TOKEN, chatId, id, reply.text, opts);
            return;
        } catch (e) {
            if (String(e).includes('not modified')) return;
            console.log('[panel] редактирование не удалось:', String(e));
            await deleteQuietly(chatId, id);
        }
    }

    const sent = await sendMessage(BOT_TOKEN, chatId, reply.text, opts);
    panel.set(chatId, sent.message_id);
}

async function handleCallback(q: CallbackQuery): Promise<void> {
    await answerCallbackQuery(BOT_TOKEN, q.id).catch(() => { });

    const msg = q.message;
    if (!msg || !q.data) return;

    panel.set(msg.chat.id, msg.message_id);
    await showPanel(msg.chat.id, applyAction(q.from.id, q.data));
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

    const adminReply = adminCommand(viewerId, text);
    if (adminReply) {
        await showPanel(chatId, adminReply);
        return;
    }

    await showPanel(chatId, applyAction(viewerId, actionFromText(text)));
}

const me = await callApi<{ username: string }>(BOT_TOKEN, 'getMe');
console.log(`Бот @${me.username} запущен`);

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