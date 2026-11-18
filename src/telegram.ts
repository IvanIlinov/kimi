const API_BASE = 'https://api.telegram.org';

interface ApiResponse<T> {
    ok: boolean;
    result?: T;
    description?: string;
}

export async function callApi<T = unknown>(
    token: string,
    method: string,
    params: Record<string, unknown> = {},
): Promise<T> {
    const t0 = Date.now();
    // getUpdates держит соединение до 30 с (long polling), остальные вызовы должны отвечать быстро
    const limit = method === 'getUpdates' ? 45_000 : 15_000;

    const response = await fetch(`${API_BASE}/bot${token}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(limit),
    });

    const data = (await response.json()) as ApiResponse<T>;

    const ms = Date.now() - t0;
    if (method !== 'getUpdates' && ms > 2000) console.log(`[api] ${method}: медленно, ${ms} мс`);

    if (!data.ok || data.result === undefined) {
        throw new Error(`Telegram ${method}: ${data.description ?? 'неизвестная ошибка'}`);
    }

    return data.result;
}

export interface CallbackQuery {
    id: string;
    from: { id: number; first_name: string };
    data?: string;
    message?: { message_id: number; chat: { id: number } };
}

export interface Update {
    update_id: number;
    message?: {
        message_id: number;
        chat: { id: number; type?: string };
        from?: { id: number; first_name: string };
        text?: string;
    };
    callback_query?: CallbackQuery;
}

export const getUpdates = (token: string, offset: number) =>
    callApi<Update[]>(token, 'getUpdates', {
        offset,
        timeout: 30,
        allowed_updates: ['message', 'callback_query'],
    });

export const sendMessage = (
    token: string,
    chat_id: number,
    text: string,
    extra: { reply_markup?: unknown; parse_mode?: 'HTML' } = {},
) => callApi<{ message_id: number }>(token, 'sendMessage', { chat_id, text, ...extra });

export const deleteMessage = (token: string, chat_id: number, message_id: number) =>
    callApi(token, 'deleteMessage', { chat_id, message_id });

// Убирает «часики» на нажатой кнопке
export const answerCallbackQuery = (token: string, callback_query_id: string) =>
    callApi(token, 'answerCallbackQuery', { callback_query_id });

export const sendRich = (token: string, chat_id: number, html: string) =>
    callApi<{ message_id: number }>(token, 'sendRichMessage', {
        chat_id,
        rich_message: { html },
    });

export const editRich = (token: string, chat_id: number, message_id: number, html: string) =>
    callApi(token, 'editMessageText', {
        chat_id,
        message_id,
        rich_message: { html },
    });

// Тихая реакция на сообщение: без текста, без ответа в чат
export const setReaction = (token: string, chat_id: number, message_id: number, emoji: string) =>
    callApi(token, 'setMessageReaction', {
        chat_id,
        message_id,
        reaction: [{ type: 'emoji', emoji }],
    });

// Тег участника беседки: до 16 символов, без эмодзи. Пустая строка — удалить.
export const setMemberTag = (token: string, chat_id: number, user_id: number, tag: string) =>
    callApi(token, 'setChatMemberTag', { chat_id, user_id, tag });

// Постоянная кнопка Mini App в меню Telegram
export const setChatMenuButton = (token: string, url: string) =>
    callApi(token, 'setChatMenuButton', {
        menu_button: {
            type: 'web_app',
            text: 'Открыть',
            web_app: { url },
        },
    });
