import { weekStartMs } from './logic.ts';

export function recapPeriods(now: number) {
    const moscow = new Date(now + 3 * 3600e3);
    const year = moscow.getUTCFullYear();
    const month = moscow.getUTCMonth();
    const midnight = (y: number, m: number) => Date.UTC(y, m, 1) - 3 * 3600e3;
    const yearEnd = midnight(month >= 5 ? year : year - 1, 5);
    const yearStart = midnight(month >= 5 ? year - 1 : year - 2, 8);
    const seasonYear = month < 2 ? year - 1 : year;
    const seasonMonth = month >= 11 || month < 2 ? 11 : month >= 5 ? 5 : 2;
    const seasonEnd = midnight(seasonYear, seasonMonth);
    const seasonStart = midnight(seasonYear, seasonMonth - 3);
    const studyStart = midnight(seasonMonth === 11 ? seasonYear : seasonYear - 1, 8);
    const weekEnd = weekStartMs(now);
    const fallInProgress = month >= 8 && month <= 10;
    const currentFall = fallInProgress ? { start: midnight(year, 8), end: now, goalAt: midnight(year, 11) - 1 } : null;
    return {
        currentFall,
        year: { start: yearStart, end: yearEnd },
        season: { start: seasonStart, end: seasonEnd, studyStart },
        week: { start: weekStartMs(weekEnd - 1), end: weekEnd },
    };
}
