import { challengeFor, challengeSession, challengeView } from './challenge-catalog.ts';
import { db } from './db.ts';
import { addTasks, setTopicStatus } from './write.ts';

const getSolved = db.prepare('SELECT exercise_id FROM challenge_solutions WHERE user_id = ? AND topic_no = ?');
const insertSolution = db.prepare('INSERT INTO challenge_solutions (user_id, topic_no, exercise_id) VALUES (?, ?, ?)');
const getStatus = db.prepare('SELECT status FROM topic_status WHERE user_id = ? AND topic_no = ?');
const getAttempt = db.prepare('SELECT started_at, finished_at FROM challenge_attempts WHERE user_id = ? AND topic_no = ?');
const startAttempt = db.prepare(`
    INSERT INTO challenge_attempts (user_id, topic_no, started_at) VALUES (?, ?, ?)
    ON CONFLICT (user_id, topic_no) DO UPDATE SET started_at = excluded.started_at, finished_at = NULL
`);
const clearSolution = db.prepare('DELETE FROM challenge_solutions WHERE user_id = ? AND topic_no = ? AND exercise_id = ?');
const finishAttempt = db.prepare('UPDATE challenge_attempts SET finished_at = ? WHERE user_id = ? AND topic_no = ? AND finished_at IS NULL');

function solvedExercises(userId: number, topic: number): Set<string> {
    const rows = getSolved.all(userId, topic) as { exercise_id: string }[];
    return new Set(rows.map(({ exercise_id }) => exercise_id));
}

export function openChallenge(userId: number, topic: number, actor: number, restart: boolean) {
    const course = challengeFor(topic);
    if (!course) throw new Error('Испытание ещё недоступно');

    db.exec('BEGIN IMMEDIATE');
    try {
        const now = Date.now();
        const solved = solvedExercises(userId, topic);
        const current = timedChallengeView(userId, topic, course, solved, now);
        if (current.phase === 'lesson' && (!current.timer || (current.expired && restart))) {
            if (current.expired) {
                for (const { id } of course.lesson) {
                    clearSolution.run(userId, topic, id);
                    solved.delete(id);
                }
            }
            startAttempt.run(userId, topic, now);
            if ((getStatus.get(userId, topic)?.status ?? 'todo') === 'todo') {
                setTopicStatus(userId, topic, 'learning', actor);
            }
        }
        const updated = timedChallengeView(userId, topic, course, solved, now);
        db.exec('COMMIT');
        return updated;
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
}

export function timedChallengeView(userId: number, topic: number, course: NonNullable<ReturnType<typeof challengeFor>>,
    solved = solvedExercises(userId, topic), now = Date.now(),
) {
    const attempt = getAttempt.get(userId, topic) as { started_at: number; finished_at: number | null } | undefined;
    return challengeSession(course, solved,
        attempt ? { startedAt: attempt.started_at, finishedAt: attempt.finished_at } : null, now);
}

export function submitChallengeAnswer(
    userId: number, topic: number, actor: number, exerciseId: string, answer: number, attemptStartedAt: number | null,
) {
    const course = challengeFor(topic);
    if (!course) throw new Error('Испытание ещё недоступно');

    db.exec('BEGIN IMMEDIATE');
    try {
        const solved = solvedExercises(userId, topic);
        const now = Date.now();
        const current = timedChallengeView(userId, topic, course, solved, now);
        const item = [...course.lesson, ...course.practice].find(({ id }) => id === exerciseId);
        let result: 'wrong' | 'solved' | 'stale' | 'expired' = current.expired ? 'expired' : 'stale';
        let explanation: string | null = null;
        let credited = false;

        const activeAttempt = current.phase !== 'lesson' || current.timer?.startedAt === attemptStartedAt;
        if (!current.expired && activeAttempt && item && (solved.has(exerciseId) || current.exercise?.id === exerciseId)) {
            result = item.answer === answer ? 'solved' : 'wrong';
            if (result === 'solved') {
                explanation = item.explanation;
                if (!solved.has(exerciseId)) {
                    insertSolution.run(userId, topic, exerciseId);
                    solved.add(exerciseId);
                    const updated = challengeView(course, solved);
                    const status = getStatus.get(userId, topic)?.status ?? 'todo';
                    if (current.phase === 'practice') {
                        addTasks(userId, 1, 'bot', actor);
                        credited = true;
                        if (updated.phase === 'complete') setTopicStatus(userId, topic, 'reinforced', actor);
                    } else if (updated.phase === 'practice') {
                        finishAttempt.run(now, userId, topic);
                        if (status !== 'reinforced') setTopicStatus(userId, topic, 'done', actor);
                    } else if (status === 'todo') {
                        setTopicStatus(userId, topic, 'learning', actor);
                    }
                }
            }
        }

        const challenge = timedChallengeView(userId, topic, course, solved);
        db.exec('COMMIT');
        return { result, explanation, credited, challenge };
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
}
