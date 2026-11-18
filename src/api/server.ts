import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { ALLOWED_ORIGINS, API_HOST, API_PORT, BOT_TOKEN } from '../config.ts';
import { verifyInitData } from './auth.ts';
import { resolveViewer } from './context.ts';
import { HttpError } from './errors.ts';
import { Router } from './router.ts';
import { registerRead } from './routes/read.ts';
import { registerSelf } from './routes/self.ts';

const MAX_BODY = 10_000;

const router = new Router();
router.get('/api/health', () => ({ ok: true }));
registerRead(router);
registerSelf(router);

function send(res: ServerResponse, status: number, payload: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(payload));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
    let size = 0;
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
        size += (chunk as Buffer).length;
        if (size > MAX_BODY) throw new HttpError(413, 'Слишком большой запрос');
        chunks.push(chunk as Buffer);
    }
    if (size === 0) return {};
    try {
        return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
        throw new HttpError(400, 'Некорректный JSON');
    }
}

function applyCors(req: IncomingMessage, res: ServerResponse): void {
    const origin = req.headers.origin;
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Max-Age', '600');
    }
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    applyCors(req, res);
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    let url: URL;
    try {
        url = new URL(req.url ?? '/', 'http://localhost');
    } catch {
        throw new HttpError(400, 'Некорректный URL');
    }

    let route;
    try {
        route = router.match(req.method ?? 'GET', url.pathname);
    } catch (e) {
        if (e instanceof URIError) {
            throw new HttpError(400, 'Некорректный параметр URL');
        }
        throw e;
    }
    if (!route) throw new HttpError(404, 'Не найдено');

    // Здоровье сервиса проверяется без подписи, остальное только с ней
    let viewer = null;
    if (url.pathname !== '/api/health') {
        const header = req.headers.authorization ?? '';
        const user = header.startsWith('tma ') ? verifyInitData(header.slice(4), BOT_TOKEN) : null;
        if (!user) throw new HttpError(401, 'Нужно открыть через Telegram');
        viewer = resolveViewer(user);
    }

    const body = req.method === 'POST' ? await readJson(req) : {};
    const result = await route.handler({ viewer: viewer!, params: route.params, query: url.searchParams, body });
    send(res, 200, result);
}

export function startApi(): void {
    if (!API_PORT) {
        console.log('[api] API_PORT не задан, API выключен');
        return;
    }

    const server = createServer((req, res) => {
        handle(req, res).catch((e) => {
            if (e instanceof HttpError) return send(res, e.status, { error: e.message });
            console.error('[api]', req.method, req.url, e);
            send(res, 500, { error: 'Внутренняя ошибка' });
        });
    });

    server.on('error', (e) => {
        console.error('[api] ошибка HTTP-сервера:', e);
    });

    server.listen(API_PORT, API_HOST, () => console.log(`[api] слушает ${API_HOST}:${API_PORT}`));
}
