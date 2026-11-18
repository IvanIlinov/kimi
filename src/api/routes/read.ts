import { arenaDto, membersDto, profileDto, weekDto } from '../dto.ts';
import type { ArenaMode } from '../dto.ts';
import { loadRanked } from '../context.ts';
import { HttpError } from '../errors.ts';
import type { Router } from '../router.ts';
import { getWeekStats } from '../../store.ts';

// Чтение: доступно всем ролям
export function registerRead(router: Router): void {
    router.get('/api/me', ({ viewer }) => ({
        role: viewer.role,
        name: viewer.firstName,
        personId: viewer.personId,
    }));

    router.get('/api/members', ({ viewer }) => membersDto(loadRanked(), viewer.tgId));

    router.get('/api/profile/:id', ({ viewer, params }) => {
        const id = params.id === 'me' ? viewer.personId : Number(params.id);
        const r = loadRanked().find((x) => x.person.id === id);
        if (!r) throw new HttpError(404, 'Участник не найден');
        const week = getWeekStats().find((s) => s.userId === r.person.id);
        return profileDto(r, week, new Date(), viewer.personId === r.person.id);
    });

    router.get('/api/week', ({ viewer }) => {
        const week = new Map(getWeekStats().map((s) => [s.userId, s]));
        return weekDto(loadRanked(), viewer.tgId, week);
    });

    router.get('/api/arena', ({ viewer, query }) => {
        const mode: ArenaMode = query.get('mode') === 'global' ? 'global' : 'month';
        return arenaDto(loadRanked(), viewer.tgId, mode, new Date());
    });
}
