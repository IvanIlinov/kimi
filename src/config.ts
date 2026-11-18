function need(name: string): string {
    const v = process.env[name];
    if (!v) throw new Error(`Нет переменной ${name}. Проверьте файл .env`);
    return v;
}

export const BOT_TOKEN = need('BOT_TOKEN');
export const MINIAPP_URL = process.env.MINIAPP_URL ?? '';
export const ADMIN_IDS = need('ADMIN_IDS').split(',').map((s) => Number(s.trim()));
export const GROUP_CHAT_ID = Number(process.env.GROUP_CHAT_ID ?? 0);
// API для MiniApp. API_PORT=0 или не задан: API выключен.
export const API_PORT = Number(process.env.API_PORT ?? 0);
export const API_HOST = process.env.API_HOST ?? '127.0.0.1';
// Адреса, с которых разрешены запросы (например, https://arena.vercel.app), через запятую
export const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
