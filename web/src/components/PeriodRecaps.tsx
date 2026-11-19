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

export function PeriodRecaps({ week, study, autoOpen }: {
    week: WeeklyRecap;
    study: Profile['studyRecaps'];
    autoOpen: boolean;
}) {
    const modal = useRef<HTMLDialogElement>(null);
    const [active, setActive] = useState<Kind | null>(null);
    const yearEnd = study?.year.end;
    const seasonEnd = study?.season.end;
    const weekEnd = week.end;

    useEffect(() => {
        if (!autoOpen) return;
        let attached = true;
        void api<{ open: Kind | null }>('/api/self/recaps/open', {
            method: 'POST', body: { week: weekEnd, season: seasonEnd, year: yearEnd },
        }).then(({ open }) => {
            if (open && attached) setActive((current) => current ?? open);
        }).catch(() => {});
        return () => { attached = false; };
    }, [autoOpen, weekEnd, seasonEnd, yearEnd]);

    useLayoutEffect(() => {
        if (active && modal.current && !modal.current.open) modal.current.showModal();
    }, [active]);

    const recaps = { week, ...study };
    const kinds: Kind[] = study ? ['week', 'season', 'year'] : ['week'];
    const recap = active ? recaps[active] : undefined;
    const period = (value: WeeklyRecap | StudyRecap) => date.formatRange(value.start, value.end - 1);
    const season = study ? seasonNames[new Date(study.season.start + 3 * 3600e3).toISOString().slice(5, 7)] : undefined;

    return (
        <section class="swipe-card-recaps" aria-label="Итоги">
            <div class="period-recap-entries">
                {kinds.map((kind) => (
                    <button key={kind} type="button" class="weekly-recap-entry" data-kind={kind} aria-haspopup="dialog"
                        onClick={() => setActive(kind)}>
                        <strong>{labels[kind]}</strong>
                        <span>{kind === 'season' && season ? `${season} · ` : ''}{period(recaps[kind]!)}</span>
                    </button>
                ))}
            </div>

            <dialog class="weekly-recap" ref={modal} data-kind={active ?? undefined} onClose={() => setActive(null)} aria-labelledby="weekly-recap-title"
                onClick={(event) => {
                    if (event.target === event.currentTarget) event.currentTarget.close();
                }}>
                {active && recap && <form method="dialog">
                    <header>
                        <p>{period(recap)}</p>
                        <h2 id="weekly-recap-title">{titles[active]}</h2>
                    </header>
                    <button class="weekly-recap-close" aria-label="Закрыть" autofocus>×</button>
                    {'goals' in recap ? (
                        <>
                            <section class="weekly-recap-goal" aria-labelledby="weekly-recap-goal">
                                <p id="weekly-recap-goal">{active === 'year' ? 'Общий прогресс' : 'Цель к концу сезона'}</p>
                                <strong>{recap.pct}%</strong>
                                <progress aria-labelledby="weekly-recap-goal" max={100} value={recap.pct} />
                                {active === 'season' && <p>Показатели с начала учебного года</p>}
                            </section>
                            <dl>
                                <div><dt>Решено задач</dt><dd>{recap.tasks} из {recap.goals.tasks}</dd></div>
                                <div><dt>Изучено заданий</dt><dd>{recap.topics} из {recap.goals.topics}</dd></div>
                                <div><dt>Балл пробника</dt><dd>{recap.examBefore} → {recap.exam}</dd></div>
                            </dl>
                        </>
                    ) : (
                        <WeekResult week={week} />
                    )}
                    <button class="weekly-recap-done">Готово</button>
                </form>}
            </dialog>
        </section>
    );
}

function WeekResult({ week }: { week: WeeklyRecap }) {
    const difference = week.tasks - week.goal;
    const differenceLabel = `${Math.abs(difference)} ${plural(difference, ['задача', 'задачи', 'задач'])}`;
    const goalNote = difference > 0 ? `Сверх цели — ${differenceLabel}`
        : difference < 0 ? `До цели — ${differenceLabel}` : 'Недельная цель выполнена';
    return (
        <>
            <section class="weekly-recap-goal" aria-labelledby="weekly-recap-goal">
                <p id="weekly-recap-goal">Решено за неделю</p>
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
