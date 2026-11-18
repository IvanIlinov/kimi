import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyInitData } from './auth.ts';

const TOKEN = '123456:TEST';

// Собирает подписанную строку initData так же, как это делает Telegram
function sign(fields: Record<string, string>, token = TOKEN): string {
    const check = Object.entries(fields)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([k, v]) => `${k}=${v}`)
        .join('\n');
    const secret = createHmac('sha256', 'WebAppData').update(token).digest();
    const hash = createHmac('sha256', secret).update(check).digest('hex');
    return new URLSearchParams({ ...fields, hash }).toString();
}

const now = Date.now();
const fresh = () => ({
    auth_date: String(Math.floor(now / 1000)),
    user: JSON.stringify({ id: 42, first_name: 'Ваня' }),
});

test('принимает правильную подпись', () => {
    assert.deepEqual(verifyInitData(sign(fresh()), TOKEN, now), { id: 42, firstName: 'Ваня' });
});

test('отклоняет подпись другого бота', () => {
    assert.equal(verifyInitData(sign(fresh(), 'other:TOKEN'), TOKEN, now), null);
});

test('отклоняет подменённые данные', () => {
    const tampered = sign(fresh()).replace(encodeURIComponent('"id":42'), encodeURIComponent('"id":7'));
    assert.equal(verifyInitData(tampered, TOKEN, now), null);
});

test('отклоняет старую подпись', () => {
    const old = { ...fresh(), auth_date: String(Math.floor(now / 1000) - 3 * 24 * 3600) };
    assert.equal(verifyInitData(sign(old), TOKEN, now), null);
});

test('отклоняет пустую строку и строку без hash', () => {
    assert.equal(verifyInitData('', TOKEN, now), null);
    assert.equal(verifyInitData('auth_date=1&user=%7B%7D', TOKEN, now), null);
});

test('отклоняет auth_date более чем на 60 секунд в будущем', () => {
    const future = {
        ...fresh(),
        auth_date: String(Math.floor(now / 1000) + 61),
    };
    assert.equal(verifyInitData(sign(future), TOKEN, now), null);
});

test('принимает auth_date на 30 секунд в будущем', () => {
    const slightlyFuture = {
        ...fresh(),
        auth_date: String(Math.floor(now / 1000) + 30),
    };
    assert.deepEqual(
        verifyInitData(sign(slightlyFuture), TOKEN, now),
        { id: 42, firstName: 'Ваня' },
    );
});

test('отклоняет некорректный формат hash', () => {
    const signed = sign(fresh());
    const malformed = signed.replace(/hash=[^&]+/, 'hash=xyz');
    assert.equal(verifyInitData(malformed, TOKEN, now), null);
});

test('отклоняет отрицательный Telegram ID', () => {
    const invalid = { ...fresh(), user: JSON.stringify({ id: -42 }) };
    assert.equal(verifyInitData(sign(invalid), TOKEN, now), null);
});

test('отклоняет дробный Telegram ID', () => {
    const invalid = { ...fresh(), user: JSON.stringify({ id: 42.5 }) };
    assert.equal(verifyInitData(sign(invalid), TOKEN, now), null);
});
