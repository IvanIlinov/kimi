import type { Viewer } from './context.ts';

export interface Ctx {
    viewer: Viewer;
    params: Record<string, string>;
    query: URLSearchParams;
    body: unknown;
}

export type Handler = (ctx: Ctx) => unknown | Promise<unknown>;

interface Route {
    method: string;
    re: RegExp;
    keys: string[];
    handler: Handler;
}

// Минимальный роутер: пути вида /api/profile/:id
export class Router {
    private routes: Route[] = [];

    add(method: string, path: string, handler: Handler): void {
        const keys: string[] = [];
        const pattern = path.replace(/:(\w+)/g, (_, key: string) => {
            keys.push(key);
            return '([^/]+)';
        });
        this.routes.push({ method, re: new RegExp(`^${pattern}$`), keys, handler });
    }

    get = (path: string, handler: Handler) => this.add('GET', path, handler);
    post = (path: string, handler: Handler) => this.add('POST', path, handler);

    match(method: string, pathname: string): { handler: Handler; params: Record<string, string> } | null {
        for (const r of this.routes) {
            if (r.method !== method) continue;
            const m = r.re.exec(pathname);
            if (!m) continue;

            const params: Record<string, string> = {};
            try {
                r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
            } catch {
                throw new URIError('Некорректный параметр URL');
            }

            return { handler: r.handler, params };
        }
        return null;
    }
}
