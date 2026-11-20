import { recapPeriods } from '../../recap-periods.ts';
import { db } from '../../db.ts';
import { coreWeekTasks, weekStartMs } from '../../store.ts';
import { coreStudyBounds, studyCore } from '../../study-core.ts';
import { selfDto } from '../dto.ts';
import { loadRanked } from '../context.ts';
import type { Viewer } from '../context.ts';
import { HttpError } from '../errors.ts';
import type { Router } from '../router.ts';
import { nextStatus, statusOf } from '../../status.ts';
import { addTasks, setExam, setTopicStatus } from '../../write.ts';
import { syncTag } from '../../tags.ts';
import { challengeFor } from '../../challenge-catalog.ts';
import { openChallenge, submitChallengeAnswer, timedChallengeView } from '../../challenges.ts';

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
    return claimPeriod(key, personId, end);
}

function claimPeriod(key: string, personId: number, end: number): boolean {
    return db.prepare(`
        INSERT INTO meta (key, value) VALUES (?, ?)
        ON CONFLICT (key) DO UPDATE SET value = excluded.value
        WHERE CAST(meta.value AS INTEGER) < CAST(excluded.value AS INTEGER)
    `).run(`${key}:${personId}`, String(end)).changes > 0;
}

function studentChallenge(viewer: Viewer, topic: number) {
    if (viewer.role !== 'student' || viewer.personId === null || viewer.correctionActorTgId !== undefined) {
        throw new HttpError(403, 'Доступно только ученикам');
    }
    const course = challengeFor(topic);
    if (!course) throw new HttpError(404, 'Испытание ещё недоступно');
    return { userId: viewer.personId, course };
}

export function registerSelf(router: Router): void {
    router.get('/api/self', ({ viewer }) => selfDto(me(viewer)));

    router.get('/api/self/challenges/:n', ({ viewer, params }) => {
        const topic = Number(params.n);
        const { userId, course } = studentChallenge(viewer, topic);
        return timedChallengeView(userId, topic, course);
    });

    router.post('/api/self/challenges/:n/start', ({ viewer, params, body }) => {
        const topic = Number(params.n);
        const { userId } = studentChallenge(viewer, topic);
        const challenge = openChallenge(userId, topic, viewer.tgId, asObject(body).restart === true);
        return { challenge, self: selfDto(me(viewer)) };
    });

    router.post('/api/self/challenges/:n/answer', ({ viewer, params, body }) => {
        const topic = Number(params.n);
        const { userId } = studentChallenge(viewer, topic);
        const { exercise, answer, startedAt } = asObject(body);
        if (typeof exercise !== 'string' || typeof answer !== 'number' || !Number.isSafeInteger(answer) || answer < 0) {
            throw new HttpError(400, 'Введи целое неотрицательное число');
        }
        const result = submitChallengeAnswer(userId, topic, viewer.tgId, exercise, answer,
            typeof startedAt === 'number' && Number.isSafeInteger(startedAt) ? startedAt : null);
        if (result.credited) void syncTag(userId);
        return { ...result, self: selfDto(me(viewer)) };
    });

    router.post('/api/self/core/celebration', ({ viewer }) => {
        if (viewer.role !== 'student' || viewer.personId === null || viewer.correctionActorTgId !== undefined) {
            throw new HttpError(403, 'Доступно только ученикам');
        }
        const { personId } = viewer;
        const now = Date.now();
        const bounds = coreStudyBounds(now);
        const core = studyCore(now, coreWeekTasks(personId, bounds.start, Math.min(now + 1, bounds.end)));
        const oldest = weekStartMs(now) - 7 * 86_400_000;
        const crystal = core.seasons.flatMap(({ months }) => months.flatMap(({ crystals }) => crystals))
            .reverse().find((week) => week.start >= oldest && week.state === 'lit');
        return {
            celebration: crystal && claimPeriod('core_crystal_seen', personId, crystal.end)
                ? { core, week: crystal.start }
                : null,
        };
    });

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
        void syncTag(r.person.id);
        return selfDto(me(viewer));
    });

    router.post('/api/self/exam', ({ viewer, body }) => {
        const r = me(viewer);
        const value = asObject(body).value;
        guard(() => setExam(r.person.id, value === null ? null : Number(value),
            viewer.correctionActorTgId ?? viewer.tgId, viewer.correctionActorTgId !== undefined));
        void syncTag(r.person.id);
        return selfDto(me(viewer));
    });

    router.post('/api/self/topics/:n/cycle', ({ viewer, params }) => {
        const r = me(viewer);
        const n = Number(params.n);
        if (challengeFor(n) && viewer.role === 'student' && viewer.correctionActorTgId === undefined) {
            throw new HttpError(403, 'Пройди испытание и практику в Mini App');
        }
        guard(() => setTopicStatus(r.person.id, n, nextStatus(statusOf(r.person, n)),
            viewer.correctionActorTgId ?? viewer.tgId, viewer.correctionActorTgId !== undefined));
        return selfDto(me(viewer));
    });
}
