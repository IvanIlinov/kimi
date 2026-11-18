import { initData } from '../lib/telegram';

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

let previewAs: string | null = null;

export function setPreviewAs(id: string | null): void {
    previewAs = id;
}

export class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
    const hasBody = opts.body !== undefined;
    let res: Response;
    try {
        res = await fetch(BASE + path, {
            method: opts.method ?? 'GET',
            headers: {
                Authorization: `tma ${initData}`,
                ...(previewAs !== null ? { 'X-Arena-Preview': previewAs } : {}),
                ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
            },
            body: hasBody ? JSON.stringify(opts.body) : undefined,
        });
    } catch {
        throw new ApiError(0, 'Нет связи с сервером');
    }

    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) throw new ApiError(res.status, data?.error ?? 'Ошибка запроса');
    return data as T;
}
