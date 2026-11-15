function need(name: string): string {
    const v = process.env[name];
    if (!v) throw new Error(`Нет переменной ${name}. Проверьте файл .env`);
    return v;
}

export const BOT_TOKEN = need('BOT_TOKEN');
export const ADMIN_IDS = need('ADMIN_IDS').split(',').map((s) => Number(s.trim()));