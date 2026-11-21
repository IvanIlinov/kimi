import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { api } from '../api/client';
import { useApi } from '../api/useApi';
import type { ChallengeProgress, SelfData, TopicStatus } from '../api/types';
import { NavIcon } from '../components/NavIcon';
import { SegmentBar } from '../components/ui';
import { haptic } from '../lib/telegram';
import './mission-challenge.css';

interface ChallengeReply {
    challenge: ChallengeProgress;
    self: SelfData;
}

interface AnswerReply extends ChallengeReply {
    result: 'solved' | 'wrong' | 'stale' | 'expired';
    explanation: string | null;
    credited: boolean;
}

export function MissionChallenge({ mission, status, onOpen, onUpdated, onTasksSaved, studyEntry = false, studySummary }: {
    mission: number;
    status: TopicStatus;
    onOpen: () => void;
    onUpdated: (self: SelfData) => void;
    onTasksSaved?: () => void;
    studyEntry?: boolean;
    studySummary?: (progress: ChallengeProgress) => ComponentChildren;
}) {
    const path = `/api/self/challenges/${mission}`;
    const { data, error, reload, setData } = useApi<ChallengeProgress>(path);
    const [busy, setBusy] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [expiredAttempt, setExpiredAttempt] = useState<number | null>(null);
    const [answer, setAnswer] = useState('');
    const [issue, setIssue] = useState('');
    const [review, setReview] = useState<{ text: string; phase: 'lesson' | 'practice' } | null>(null);
    const dialog = useRef<HTMLDialogElement>(null);
    const title = useRef<HTMLHeadingElement>(null);

    if (error) return <div role="alert"><p class="warn">{error}</p><button class="chip" onClick={reload}>Повторить</button></div>;
    if (!data) return <p class="muted" role="status">Загружаем испытание…</p>;

    const phase = review?.phase ?? data.phase;
    const practicing = phase !== 'lesson';
    const count = practicing ? data.practice : data.lesson;
    const expired = data.phase === 'lesson' && (data.expired || (data.timer && data.timer.startedAt === expiredAttempt));
    const challengeLabel = data.phase === 'complete' ? 'Итоги испытания'
        : data.phase === 'practice' ? 'Практика'
            : expired ? 'Начать заново'
                : data.timer || data.lesson.solved || status === 'learning' ? 'Продолжить испытание' : 'Начать испытание';
    const label = studyEntry && data.phase !== 'complete' && !expired
        ? data.phase === 'lesson' && !data.timer && !data.lesson.solved && status === 'todo'
            ? 'Начать изучение' : 'Продолжить изучение'
        : challengeLabel;
    const valid = /^\d+$/.test(answer.trim()) && Number.isSafeInteger(Number(answer));
    const exercise = data.exercise;

    function resetQuestion() {
        setReview(null);
        setIssue('');
        setAnswer('');
    }

    async function open(restart = false) {
        if (busy) return;
        onOpen();
        resetQuestion();
        if (data?.phase === 'lesson') {
            setBusy(true);
            try {
                const reply = await api<ChallengeReply>(`${path}/start`, { method: 'POST', body: { restart } });
                onUpdated(reply.self);
                setData(reply.challenge);
            } catch (e) {
                setIssue((e as Error).message);
                return;
            } finally {
                setBusy(false);
            }
        }
        if (!dialog.current?.open) dialog.current?.showModal();
        setDialogOpen(true);
    }

    async function check() {
        if (!valid || busy || expired || !exercise || phase === 'complete') return;
        setBusy(true);
        setIssue('');
        try {
            const reply = await api<AnswerReply>(`${path}/answer`, {
                method: 'POST', body: { exercise: exercise.id, answer: Number(answer), startedAt: data?.timer?.startedAt },
            });
            onUpdated(reply.self);
            setData(reply.challenge);
            if (reply.result === 'solved' && reply.explanation) {
                setReview({ text: reply.explanation, phase });
                haptic.ok();
                if (reply.credited) onTasksSaved?.();
            } else if (reply.result === 'expired') {
                resetQuestion();
            } else if (reply.result === 'wrong' && reply.challenge.exercise?.id === exercise.id) {
                setIssue('Ответ пока не сходится. Проверь вычисления или открой подсказку.');
                haptic.error();
            } else {
                setAnswer('');
                setIssue('Прогресс обновился. Продолжай с текущей задачи.');
            }
        } catch (e) {
            setIssue((e as Error).message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div class="mission-challenge">
            {studySummary ? studySummary(data) : <div class="challenge-summary">
                <span>{data.title}{data.phase === 'lesson' && !data.timer && <small>Лимит {formatTime(data.limitMs)}</small>}</span>
                <strong>{data.phase === 'lesson' ? `${data.lesson.solved}/${data.lesson.total}`
                    : `${data.practice.solved}/${data.practice.total}`}</strong>
            </div>}
            <button class="mission-action" type="button" aria-haspopup="dialog" disabled={busy} onClick={() => void open(Boolean(expired))}>
                {studyEntry ? (
                    <>
                        <span class="tablet-ring challenge-study-play" data-complete={data.phase === 'complete'} aria-hidden="true">
                            {data.phase === 'complete' && <NavIcon name="check" />}
                        </span>
                        <span>{label}</span>
                    </>
                ) : <>{label}<NavIcon name={data.phase === 'complete' ? 'check' : 'arrow-right'} /></>}
            </button>
            {issue && !dialog.current?.open && <p class="warn" role="alert">{issue}</p>}
            <dialog class="challenge-dialog" aria-labelledby="challenge-title" ref={dialog}
                onClose={() => { setDialogOpen(false); resetQuestion(); }}>
                <div class="challenge-content">
                    <header>
                        <span class="student-brand">Задание №{mission} · {practicing ? 'Практика' : 'Испытание'}</span>
                        <h2 id="challenge-title" ref={title} tabIndex={-1}>{data.title}</h2>
                        <form method="dialog"><button class="challenge-close" aria-label="Закрыть" autofocus>×</button></form>
                    </header>
                    <div class="challenge-progress">
                        <div class="between"><span>{practicing ? 'Практические задачи' : 'Цепочка испытания'}</span>
                            {dialogOpen && !practicing && data.timer && <ChallengeTimer key={data.timer.asOf}
                                timer={data.timer} onExpire={setExpiredAttempt} />}
                            <strong>{count.solved}/{count.total}</strong></div>
                        <SegmentBar value={count.solved} max={count.total} segments={count.total} tone="good" />
                    </div>
                    {expired ? (
                        <section class="challenge-review" role="status">
                            <strong>Время вышло</strong>
                            <p>В этой попытке решено {count.solved}/{count.total}. В новой попытке цепочка начнётся с первой задачи.</p>
                            <button class="mission-action" type="button" disabled={busy} onClick={() => void open(true)}>
                                Начать заново <NavIcon name="arrow-right" />
                            </button>
                            {issue && <p class="warn" role="alert">{issue}</p>}
                        </section>
                    ) : review ? (
                        <section class="challenge-review" aria-live="polite">
                            <strong><NavIcon name="check" /> Верно</strong>
                            <p>{review.text}</p>
                            {review.phase === 'lesson' && data.timer?.finishedAt != null &&
                                <p>Время прохождения · <strong>{formatTime(data.timer.finishedAt - data.timer.startedAt, Math.floor)}</strong></p>}
                            {data.phase === 'complete' ? (
                                <><p>Практика пройдена. Задание закреплено.</p>
                                    <form method="dialog"><button class="mission-action">Готово</button></form></>
                            ) : <button class="mission-action" type="button" onClick={() => {
                                resetQuestion();
                                title.current?.focus();
                            }}>{review.phase === 'lesson' && data.phase === 'practice' ? 'Практика' : 'Следующая задача'}
                                <NavIcon name="arrow-right" />
                            </button>}
                        </section>
                    ) : exercise ? (
                        <section class="challenge-exercise" key={exercise.id}>
                            <h3>{exercise.title}</h3>
                            <p>{exercise.prompt}</p>
                            <details class="challenge-hint">
                                <summary>Подсказка</summary>
                                <p>{exercise.hint}</p>
                            </details>
                            <form class="exam" onSubmit={(event) => { event.preventDefault(); void check(); }}>
                                <input aria-label="Ответ" placeholder="Число" inputMode="numeric" value={answer} disabled={busy}
                                    onInput={(event) => { setAnswer(event.currentTarget.value); setIssue(''); }} />
                                <button class="chip primary" disabled={!valid || busy}>Проверить</button>
                            </form>
                            {issue && <p class="warn" role="alert">{issue}</p>}
                        </section>
                    ) : (
                        <section class="challenge-review">
                            <strong><NavIcon name="check" /> Практика пройдена</strong>
                            <p>Решено {data.practice.solved} из {data.practice.total} практических задач.</p>
                            <form method="dialog"><button class="mission-action">Готово</button></form>
                        </section>
                    )}
                </div>
            </dialog>
        </div>
    );
}

function formatTime(milliseconds: number, round = Math.ceil) {
    const seconds = Math.max(0, round(milliseconds / 1000));
    return [Math.floor(seconds / 60), seconds % 60].map((part) => String(part).padStart(2, '0')).join(':');
}

function ChallengeTimer({ timer, onExpire }: {
    timer: NonNullable<ChallengeProgress['timer']>;
    onExpire: (startedAt: number) => void;
}) {
    const received = useRef(performance.now());
    const [sinceReceipt, setSinceReceipt] = useState(0);

    useEffect(() => {
        if (timer.finishedAt !== null) return;
        const interval = window.setInterval(() => {
            const elapsed = performance.now() - received.current;
            setSinceReceipt(elapsed);
            if (timer.asOf + elapsed >= timer.deadline) {
                window.clearInterval(interval);
                onExpire(timer.startedAt);
            }
        }, 200);
        return () => window.clearInterval(interval);
    }, [timer, onExpire]);

    const end = timer.finishedAt ?? (timer.asOf + sinceReceipt);
    const remaining = timer.deadline - end;
    const clock = formatTime(remaining);
    return <span class="challenge-timer" data-urgent={remaining <= 60_000} role="timer" aria-label={`Осталось ${clock}`}>
        <NavIcon name="hourglass" />{clock}
    </span>;
}
