import { WEEK_GOAL, weekStartMs } from './logic.ts';
import { recapPeriods } from './recap-periods.ts';

const DAY = 86_400_000;
const WEEK = 7 * DAY;
const MOSCOW_OFFSET = 3 * 3_600_000;

export function coreStudyBounds(now: number) {
    const { currentYear, year } = recapPeriods(now);
    return currentYear ? { start: currentYear.start, end: currentYear.goalAt + 1 } : year;
}

export function studyCore(now: number, tasksByWeek: ReadonlyMap<number, number>) {
    const { start, end } = coreStudyBounds(now);
    const year = new Date(start + MOSCOW_OFFSET).getUTCFullYear();
    const weeks: { start: number; end: number; goal: number; tasks: number }[] = [];

    for (let monday = weekStartMs(start); monday < end; monday += WEEK) {
        const from = Math.max(start, monday);
        const to = Math.min(end, monday + WEEK);
        weeks.push({
            start: from,
            end: to,
            goal: Math.ceil(WEEK_GOAL * ((to - from) / WEEK)),
            tasks: Math.max(0, tasksByWeek.get(monday) ?? 0),
        });
    }

    const seasons = Array.from({ length: 3 }, (_, season) => {
        const months = Array.from({ length: 3 }, (_, index) => {
            const month = 8 + season * 3 + index;
            const from = Date.UTC(year, month, 1) - MOSCOW_OFFSET;
            const to = Date.UTC(year, month + 1, 1) - MOSCOW_OFFSET;
            return {
                start: from,
                closed: now >= to,
                crystals: weeks.filter((week) => week.end > from && week.end <= to).map((week) => ({
                    ...week,
                    state: now < week.start ? 'future' as const
                        : week.tasks >= week.goal ? 'lit' as const
                        : now >= week.end ? 'missed' as const : 'charging' as const,
                })),
            };
        });
        return { months, closed: months.every((month) => month.closed) };
    });

    return { year, asOf: now, closed: now >= end, seasons };
}
