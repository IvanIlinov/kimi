import type { ComponentChildren } from 'preact';
import { useApi } from '../api/useApi';
import type { Profile } from '../api/types';
import { NavIcon } from '../components/NavIcon';
import { SwipeCard } from '../components/SwipeCard';
import { PeriodRecaps } from '../components/PeriodRecaps';
import { RankEmblem, RankPanel } from '../components/RankPanel';
import { CitadelCore } from '../components/CitadelCore';
import { Card, Empty, Loading, MetricTile, Screen, SegmentBar } from '../components/ui';
import { cap, plural } from '../lib/format';

export function StudentHomePage({ id = 'me', monthAction, leadingPage, onMissions, onRecapsReady, autoOpenWeeklyRecap = false }: {
    id?: number | 'me';
    monthAction?: ComponentChildren;
    leadingPage?: ComponentChildren;
    onMissions?: () => void;
    onRecapsReady?: () => void;
    autoOpenWeeklyRecap?: boolean;
}) {
    const { data: profile, error } = useApi<Profile>(`/api/profile/${id}`);
    const title = id === 'me' ? 'Главная' : 'Профиль';
    if (error) return <Screen hideTitle title={title}><Empty text={error} /></Screen>;
    if (!profile) return <Screen hideTitle title={title}><Loading /></Screen>;

    const { name, place, pct, monthPct, daysLeft, month, week, totals } = profile;
    const topicsLeft = Math.max(0, month.topics.goal - month.topics.value);
    const tasksLeft = Math.max(0, week.goal - week.tasks);
    const exam = month.exam.value ?? 0;
    const examLeft = Math.max(0, month.exam.goal - exam);

    const recaps = leadingPage ?? (profile.weeklyRecap && (
        <PeriodRecaps week={profile.weeklyRecap} currentWeek={profile.currentWeekRecap} study={profile.studyRecaps}
            autoOpen={autoOpenWeeklyRecap} onAutoDone={profile.core ? onRecapsReady : undefined} />
    ));

    return (
        <Screen hideTitle title={title} className="student-home">
            <header class="student-heading">
                <div>
                    <div class="student-brand"><NavIcon name="crystal" /> Арена · ЕГЭ Информатика</div>
                    <h1>{cap(name)}</h1>
                </div>
                <span class="pill student-rank"><NavIcon name="trophy" /> {place}-е место</span>
            </header>
            <Card class="student-summary">
                {profile.rank && <div class="student-hero-rank">
                    <RankEmblem rank={profile.rank.current} />
                    <div>
                        <span class="student-brand">Ранг подготовки</span>
                        <h2>{profile.rank.current.name}</h2>
                    </div>
                </div>}
                {profile.core && <CitadelCore key={profile.core.year} core={profile.core} previous={profile.previousCore} />}
            </Card>
            <Card class="student-readiness">
                <div class="between">
                    <span>Готовность к ЕГЭ</span>
                    <strong>{pct}%</strong>
                </div>
                <progress aria-label="Общий прогресс" value={pct} max={100} />
            </Card>
            <div class="metric-tiles student-metrics">
                <MetricTile icon="clipboard-list" label="Балл пробника" value={totals.exam ?? 0} />
                <MetricTile icon="layers" label="Решено задач" value={totals.tasks} />
                <MetricTile icon="crystal" label="Закреплено" value={`${totals.topics}/27`} />
            </div>
            {profile.rank && <RankPanel rank={profile.rank} showHeading={false} />}
            {onMissions && (
                <Card class="mission-brief">
                    <div class="mission-brief-heading">
                        <span class="mission-emblem"><NavIcon name={tasksLeft ? 'bolt' : 'check'} /></span>
                        <div>
                            <span class="student-brand">Миссия недели</span>
                            <h2>{tasksLeft ? `Решить ещё ${tasksLeft} ${plural(tasksLeft, ['задачу', 'задачи', 'задач'])}` : 'Недельная цель выполнена'}</h2>
                        </div>
                        <strong>{week.tasks}/{week.goal}</strong>
                    </div>
                    <SegmentBar value={week.tasks} max={week.goal} tone="good" />
                    <button type="button" class="mission-action" onClick={onMissions}>
                        Открыть карту миссий <NavIcon name="arrow-right" />
                    </button>
                </Card>
            )}
            <SwipeCard
                label={recaps ? "Итоги, прогресс и ближайшие цели" : "Прогресс и ближайшие цели"}
                leading={recaps}
                first={
                    <>
                        <Goal label={month.name ? cap(month.name) : 'Прогресс месяца'} value={monthPct} action={monthAction} />
                        <Goal label="Прогресс недели" value={week.goalPct} />
                        {daysLeft != null && (
                            <div class="student-countdown">
                                <NavIcon name="hourglass" />
                                <div>
                                    <strong>{daysLeft} {plural(daysLeft, ['день', 'дня', 'дней'])}</strong>
                                    <small>до начала экзаменов</small>
                                </div>
                            </div>
                        )}
                    </>
                }
                second={
                    <>
                        <Goal icon="target" label="Изучено" value={month.topics.value} max={month.topics.goal}
                            note={remaining(topicsLeft, ['задание', 'задания', 'заданий'])} />
                        <Goal icon="calendar-days" label="Решено" value={week.tasks} max={week.goal}
                            note={remaining(tasksLeft, ['задача', 'задачи', 'задач'])} />
                        <Goal icon="clipboard-list" label="Пробник" value={exam} max={month.exam.goal}
                            note={remaining(examLeft, ['балл', 'балла', 'баллов'])} />
                    </>
                }
            />
        </Screen>
    );
}

function remaining(value: number, forms: [string, string, string]) {
    return value ? `Осталось: ${value} ${plural(value, forms)}` : 'Цель выполнена';
}

function Goal({ icon, label, value, max, note, action }: {
    icon?: string;
    label: string;
    value: number;
    max?: number;
    note?: string;
    action?: ComponentChildren;
}) {
    const shown = max === undefined ? `${value}%` : `${value}/${max}`;

    return (
        <div class="student-goal" role={icon ? 'group' : undefined} aria-label={icon ? label : undefined}>
            {icon ? (
                <div class="student-goal-with-icon">
                    <NavIcon name={icon} />
                    <SegmentBar value={value} max={max} />
                    <strong>{shown}</strong>
                </div>
            ) : (
                <>
                    {action ? <div class="between"><span>{label}</span>{action}</div> : <span>{label}</span>}
                    <div class="student-goal-progress">
                        <SegmentBar value={value} max={max} />
                        <strong>{shown}</strong>
                    </div>
                </>
            )}
            {note && <small>{note}</small>}
        </div>
    );
}
