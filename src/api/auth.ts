import { createHmac, timingSafeEqual } from 'node:crypto';

export interface TgUser {
    id: number;
    firstName: string;
}

const MAX_AGE_SEC = 24 * 3600; // подпись старше суток не принимаем
const MAX_FUTURE_SEC = 60;

// Проверка подписи initData по описанию Telegram:
// secret = HMAC_SHA256("WebAppData", botToken), hash = HMAC_SHA256(secret, строка полей)
export function verifyInitData(initData: string, botToken: string, nowMs = Date.now()): TgUser | null {
    if (!initData) return null;

    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) return null;
    params.delete('hash');

    const check = [...params.entries()]
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => `${k}=${v}`)
        .join('\n');

    const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
    const expected = createHmac('sha256', secret).update(check).digest();

    const given = Buffer.from(hash, 'hex');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

    const authDate = Number(params.get('auth_date'));
    const nowSec = nowMs / 1000;

    if (
        !Number.isFinite(authDate) ||
        nowSec - authDate > MAX_AGE_SEC ||
        authDate - nowSec > MAX_FUTURE_SEC
    ) {
        return null;
    }

    try {
        const user = JSON.parse(params.get('user') ?? '') as { id?: unknown; first_name?: unknown };
        if (typeof user.id !== 'number' || !Number.isSafeInteger(user.id) || user.id <= 0) return null;
        return { id: user.id, firstName: typeof user.first_name === 'string' ? user.first_name : '' };
    } catch {
        return null;
    }
}
