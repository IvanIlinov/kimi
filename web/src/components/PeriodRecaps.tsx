import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { api } from '../api/client';
import type { Profile, WeeklyRecap, StudyRecap } from '../api/types';
import { plural, sgn } from '../lib/format';
import './weekly-recap.css';

const date = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
});

type Kind = 'week' | 'season' | 'year';
const labels = { week: 'Неделя', season: 'Сезон', year: 'Год' };
const titles = { week: 'Итоги недели', season: 'Итоги сезона', year: 'Итоги года' };
const seasonNames = { '03': 'Весна', '09': 'Осень', '12': 'Зима' } as Record<string, string>;

export function PeriodRecaps({ week, currentWeek, study, autoOpen, onAutoDone }: {
    week: WeeklyRecap;
    currentWeek?: WeeklyRecap;
    study: Profile['studyRecaps'];
    autoOpen: boolean;
    onAutoDone?: () => void;
}) {
    const modal = useRef<HTMLDialogElement>(null);
    const gesture = useRef<{ id: number; x: number; y: number } | null>(null);
    const [selection, setSelection] = useState<{ kind: Kind; completed: boolean; completedYear?: boolean } | null>(null);
    const active = selection?.kind;
    const showingCompletedWeek = !currentWeek || selection?.completed === true;
    const keepKeyboardFocus = useRef(false);
    const autoRecapPending = useRef(false);
    const yearEnd = study?.year.end;
    const seasonEnd = study?.season.inProgress ? undefined : study?.season.end;
    const weekEnd = week.end;

    useEffect(() => {
        if (!autoOpen) return;
        let attached = true;
        void api<{ open: Kind | null }>('/api/self/recaps/open', {
            method: 'POST', body: { week: weekEnd, season: seasonEnd, year: yearEnd },
        }).then(({ open }) => {
            if (!attached) return;
            if (open) {
                autoRecapPending.current = true;
                setSelection((current) => current ?? { kind: open, completed: true, completedYear: open === 'year' });
            } else onAutoDone?.();
        }).catch(() => { if (attached) onAutoDone?.(); });
        return () => { attached = false; };
    }, [autoOpen, onAutoDone, weekEnd, seasonEnd, yearEnd]);

    useLayoutEffect(() => {
        const dialog = modal.current;
        if (!active || !dialog) return;
        if (dialog.open) dialog.scrollTop = 0;
        else dialog.showModal();
    }, [active, showingCompletedWeek]);

    const recaps = { week, ...study, year: selection?.completedYear ? study?.year : study?.currentYear ?? study?.year };
    const kinds: Kind[] = study ? ['week', 'season', 'year'] : ['week'];
    const recap = active === 'week'
        ? (showingCompletedWeek ? week : currentWeek)
        : active ? recaps[active] : undefined;
    const period = (value: WeeklyRecap | StudyRecap) => date.formatRange(value.start, value.end - 1);
    const season = study ? seasonNames[new Date(study.season.start + 3 * 3600e3).toISOString().slice(5, 7)] : undefined;

    function step(direction: 1 | -1) {
        if (!selection || kinds.length < 2) return;
        const index = kinds.indexOf(selection.kind);
        setSelection({ ...selection, kind: kinds[(index + direction + kinds.length) % kinds.length], completedYear: false });
    }

    return (
        <section class="swipe-card-recaps" aria-label="Итоги">
            <div class="period-recap-entries">
                {kinds.map((kind) => (
                    <button key={kind} type="button" class="weekly-recap-entry" data-kind={kind} aria-haspopup="dialog"
                        onClick={(event) => {
                            keepKeyboardFocus.current = event.detail === 0;
                            setSelection({ kind, completed: false });
                        }}>
                        <strong>{labels[kind]}</strong>
                        <span>{kind === 'season' && season ? `${season} · ` : ''}{period(kind === 'week' && currentWeek ? currentWeek : recaps[kind]!)}</span>
                    </button>
                ))}
            </div>

            <dialog class="weekly-recap" ref={modal} data-kind={active ?? undefined}
                aria-labelledby="weekly-recap-title"
                onClose={() => {
                    const focused = document.activeElement;
                    const track = modal.current?.closest('.swipe-card-track');
                    if (!keepKeyboardFocus.current && focused instanceof HTMLElement && track?.contains(focused)) {
                        focused.blur();
                    }
                    keepKeyboardFocus.current = false;
                    gesture.current = null;
                    setSelection(null);
                    if (autoRecapPending.current) {
                        autoRecapPending.current = false;
                        onAutoDone?.();
                    }
                }}
                onPointerDown={(event) => {
                    if (!event.isPrimary || event.pointerType === 'mouse') return;
                    const target = event.target as Element;
                    if (!target.closest('form') || target.closest('button')) return;
                    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
                }}
                onPointerCancel={(event) => {
                    if (gesture.current?.id === event.pointerId) gesture.current = null;
                }}
                onPointerUp={(event) => {
                    const start = gesture.current;
                    if (start?.id !== event.pointerId) return;
                    gesture.current = null;
                    const dx = event.clientX - start.x;
                    const dy = event.clientY - start.y;
                    if (Math.abs(dx) >= 45 && Math.abs(dx) > Math.abs(dy) * 1.25) step(dx < 0 ? 1 : -1);
                }}
                onKeyDown={(event) => {
                    if (kinds.length < 2 || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
                    event.preventDefault();
                    step(event.key === 'ArrowRight' ? 1 : -1);
                }}
                onClick={(event) => {
                    if (event.target === event.currentTarget) event.currentTarget.close();
                }}>
                {active && recap && <form method="dialog">
                    <header>
                        <p>{period(recap)}</p>
                        <h2 id="weekly-recap-title" tabIndex={-1} autofocus aria-live="polite">{titles[active]}</h2>
                    </header>
                    <button class="weekly-recap-close" aria-label="Закрыть">×</button>
                    {'goals' in recap ? (
                        <>
                            <section class="weekly-recap-goal" aria-labelledby="weekly-recap-goal">
                                <p id="weekly-recap-goal">{active === 'year' ? 'Общий прогресс' : 'Цель к концу сезона'}</p>
                                <strong>{recap.pct}%</strong>
                                <progress aria-labelledby="weekly-recap-goal" max={100} value={recap.pct} />
                                {active === 'year' && recap.inProgress && <p>Учебный год ещё идёт</p>}
                                {active === 'season' && <p>{recap.inProgress ? 'Сезон ещё идёт' : 'Показатели с начала учебного года'}</p>}
                            </section>
                            <dl>
                                <div><dt>Решено задач</dt><dd>{recap.tasks} из {recap.goals.tasks}</dd></div>
                                <div><dt>Изучено заданий</dt><dd>{recap.topics} из {recap.goals.topics}</dd></div>
                                <div><dt>Балл пробника</dt><dd>{recap.examBefore} → {recap.exam}</dd></div>
                            </dl>
                        </>
                    ) : (
                        <>
                            <WeekResult week={recap} completed={showingCompletedWeek} />
                            {currentWeek && <button type="button" class="weekly-recap-switch" onClick={() =>
                                setSelection({ kind: 'week', completed: !showingCompletedWeek })}>
                                {showingCompletedWeek ? 'Текущая неделя' : 'Прошлая неделя'}
                            </button>}
                        </>
                    )}
                    <button class="weekly-recap-done">Готово</button>
                </form>}
            </dialog>
        </section>
    );
}

function WeekResult({ week, completed }: { week: WeeklyRecap; completed: boolean }) {
    const difference = week.tasks - week.goal;
    const differenceLabel = `${Math.abs(difference)} ${plural(difference, ['задача', 'задачи', 'задач'])}`;
    const goalNote = difference > 0 ? `Сверх цели — ${differenceLabel}`
        : difference < 0 ? `До цели — ${differenceLabel}` : 'Недельная цель выполнена';
    return (
        <>
            <section class="weekly-recap-goal" aria-labelledby="weekly-recap-goal">
                <p id="weekly-recap-goal">{completed ? 'Решено за завершённую неделю' : 'Решено за текущую неделю'}</p>
                <strong>{week.tasks} / {week.goal}</strong>
                <progress aria-labelledby="weekly-recap-goal" max={week.goal}
                    value={Math.max(0, Math.min(week.tasks, week.goal))} />
                <p>{goalNote}</p>
            </section>
            <dl>
                <div><dt>Изучено заданий</dt><dd>{week.topics ? sgn(week.topics) : '0'}</dd></div>
                {week.place !== null && <div><dt>Место в рейтинге недели</dt><dd>{week.place}-е</dd></div>}
            </dl>
        </>
    );
}
