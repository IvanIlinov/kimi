import { db } from './db.ts';

export function carryScheduleForward(weekStart: number): number {
    db.exec('BEGIN IMMEDIATE');
    try {
        const initialized = db.prepare('INSERT OR IGNORE INTO schedule_weeks (week_start) VALUES (?)').run(weekStart);
        let copied = 0;
        if (initialized.changes) {
            const result = db.prepare(`
                INSERT INTO lessons (week_start, weekday, time, name, status, price_kopecks)
                SELECT ?, weekday, time, name, 'planned', price_kopecks
                FROM lessons
                WHERE week_start = (
                    SELECT MAX(week_start) FROM (
                        SELECT week_start FROM schedule_weeks WHERE week_start < ?
                        UNION ALL
                        SELECT week_start FROM lessons WHERE week_start < ?
                    )
                )
                AND NOT EXISTS (SELECT 1 FROM lessons WHERE week_start = ?)
            `).run(weekStart, weekStart, weekStart, weekStart);
            copied = Number(result.changes);
        }
        db.exec('COMMIT');
        return copied;
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
}
