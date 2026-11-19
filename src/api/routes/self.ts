import { recapPeriods } from '../../recap-periods.ts';
import { db } from '../../db.ts';
import { weekStartMs } from '../../store.ts';
import { selfDto } from '../dto.ts';
import { loadRanked } from '../context.ts';
import type { Viewer } from '../context.ts';
import { HttpError } from '../errors.ts';
import type { Router } from '../router.ts';
import { nextStatus, statusOf } from '../../status.ts';
import { addTasks, setExam, setTopicStatus } from '../../write.ts';

// Свой участник: только тот, чей Telegram id пришёл в подписи
function me(viewer: Viewer) {
    const r = loadRanked().find((x) => x.person.id === viewer.personId);
    if (!r) throw new HttpError(403, 'Доступно только участникам рейтинга');
    return r;
}

const asObject = (body: unknown): Record<string, unknown> =>
    body && typeof body === 'object' ? (body as Record<string, unknown>) : {};

// Правила проверки живут в write.ts, их текст отдаём клиенту как есть
function guard<T>(fn: () => T): T {
    try {
        return fn();
    } catch (e) {
        throw new HttpError(400, e instanceof Error ? e.message : 'Ошибка');
    }
}

function claimRecap(kind: 'week' | 'season' | 'year', personId: number, end: number): boolean {
    const key = kind === 'week' ? 'weekly_recap_seen' : `${kind}_recap_seen`;
    return db.prepare(`
        INSERT INTO meta (key, value) VALUES (?, ?)
        ON CONFLICT (key) DO UPDATE SET value = excluded.value
        WHERE CAST(meta.value AS INTEGER) < CAST(excluded.value AS INTEGER)
    `).run(`${key}:${personId}`, String(end)).changes > 0;
}

export function registerSelf(router: Router): void {
    router.get('/api/self', ({ viewer }) => selfDto(me(viewer)));

    router.post('/api/self/weekly-recap/open', ({ viewer, body }) => {
        if (viewer.role !== 'student' || viewer.personId === null) {
            throw new HttpError(403, 'Доступно только ученикам');
        }
        const end = weekStartMs(Date.now());
        if (asObject(body).end !== end) return { open: false };
        return { open: claimRecap('week', viewer.personId, end) };
    });

    router.post('/api/self/recaps/open', ({ viewer, body }) => {
        if (viewer.role !== 'student' || viewer.personId === null) {
            throw new HttpError(403, 'Доступно только ученикам');
        }
        const periods = recapPeriods(Date.now());
        const supplied = asObject(body);
        const { personId } = viewer;
        const longer = periods.year.end >= periods.season.end ? ['year', 'season'] as const : ['season', 'year'] as const;
        let open: 'year' | 'season' | 'week' | null = null;

        db.exec('BEGIN IMMEDIATE');
        try {
            for (const kind of [...longer, 'week'] as const) {
                const { end } = periods[kind];
                if (supplied[kind] !== end) continue;
                if (claimRecap(kind, personId, end)) open ??= kind;
            }
            db.exec('COMMIT');
        } catch (error) {
            db.exec('ROLLBACK');
            throw error;
        }
        return { open };
    });

    router.post('/api/self/tasks', ({ viewer, body }) => {
        const r = me(viewer);
        guard(() => addTasks(r.person.id, Number(asObject(body).amount),
            viewer.correctionActorTgId === undefined ? 'bot' : 'admin', viewer.correctionActorTgId ?? viewer.tgId));
        return selfDto(me(viewer));
    });

    router.post('/api/self/exam', ({ viewer, body }) => {
        const r = me(viewer);
        const value = asObject(body).value;
        guard(() => setExam(r.person.id, value === null ? null : Number(value),
            viewer.correctionActorTgId ?? viewer.tgId, viewer.correctionActorTgId !== undefined));
        return selfDto(me(viewer));
    });

    router.post('/api/self/topics/:n/cycle', ({ viewer, params }) => {
        const r = me(viewer);
        const n = Number(params.n);
        guard(() => setTopicStatus(r.person.id, n, nextStatus(statusOf(r.person, n)),
            viewer.correctionActorTgId ?? viewer.tgId, viewer.correctionActorTgId !== undefined));
        return selfDto(me(viewer));
    });
}
