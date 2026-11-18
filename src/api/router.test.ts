import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Router } from './router.ts';

test('находит маршрут и декодирует параметр', () => {
    const router = new Router();
    const handler = () => ({ ok: true });

    router.get('/api/profile/:id', handler);

    const result = router.match('GET', '/api/profile/42');

    assert.ok(result);
    assert.equal(result.params.id, '42');
    assert.equal(result.handler, handler);
});

test('возвращает null для неизвестного маршрута', () => {
    const router = new Router();

    assert.equal(router.match('GET', '/unknown'), null);
});

test('отклоняет некорректный URL-параметр', () => {
    const router = new Router();

    router.get('/api/profile/:id', () => ({}));

    assert.throws(
        () => router.match('GET', '/api/profile/%E0%A4%A'),
        URIError,
    );
});
