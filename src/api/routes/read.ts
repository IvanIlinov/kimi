import { recapPeriods } from '../../recap-periods.ts';
import { monthGoal, monthPct } from '../../logic.ts';
import { arenaDto, membersDto, profileDto, weekDto, weeklyRecapDto } from '../dto.ts';
import type { ArenaMode } from '../dto.ts';
import { loadRanked } from '../context.ts';
import { HttpError } from '../errors.ts';
import type { Router } from '../router.ts';
import { getWeekStats, studyRecapStats } from '../../store.ts';

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
        const ranked = loadRanked();
        const r = ranked.find((x) => x.person.id === id);
        if (!r) throw new HttpError(404, 'Участник не найден');
        const now = Date.now();
        const currentWeekStats = getWeekStats(now);
        const week = currentWeekStats.find((s) => s.userId === r.person.id);
        const profile = profileDto(r, week, new Date(now), viewer.personId === r.person.id);
        const { week: closedWeek, season, year, currentFall, currentYear } = recapPeriods(now);
        profile.weeklyRecap = weeklyRecapDto(
            ranked, r, getWeekStats(closedWeek.start, closedWeek.end), closedWeek.start, closedWeek.end,
        );
        const nextWeek = closedWeek.end + (closedWeek.end - closedWeek.start);
        profile.currentWeekRecap = weeklyRecapDto(ranked, r, currentWeekStats, closedWeek.end, nextWeek);
        const studyRecap = ({ start, end }: { start: number; end: number }, studyStart: number, goalAt = end - 1) => {
            const stats = studyRecapStats(r.person, studyStart, end);
            const date = new Date(goalAt);
            const pct = monthPct({ ...r, person: { ...r.person, monthResults: stats } }, date);
            return { start, end, ...stats, goals: monthGoal(date), pct };
        };
        profile.studyRecaps = {
            year: studyRecap(year, year.start),
            currentYear: currentYear
                ? { ...studyRecap(currentYear, currentYear.start, currentYear.goalAt), inProgress: true }
                : undefined,
            season: currentFall
                ? { ...studyRecap(currentFall, currentFall.start, currentFall.goalAt), inProgress: true }
                : studyRecap(season, season.studyStart),
        };
        return profile;
    });

    router.get('/api/week', ({ viewer }) => {
        const options = { ownTasksOnly: true };
        const week = new Map(getWeekStats(undefined, null, options).map((s) => [s.userId, s]));
        return weekDto(loadRanked(options), viewer.tgId, week, viewer.role !== 'student');
    });

    router.get('/api/arena', ({ viewer, query }) => {
        const mode: ArenaMode = query.get('mode') === 'global' ? 'global' : 'month';
        return arenaDto(loadRanked({ ownTasksOnly: true }), viewer.tgId, mode, new Date(), viewer.role !== 'student');
    });
}
