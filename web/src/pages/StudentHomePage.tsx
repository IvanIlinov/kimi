import type { ComponentChildren } from 'preact';
import { useApi } from '../api/useApi';
import type { Profile } from '../api/types';
import { NavIcon } from '../components/NavIcon';
import { SwipeCard } from '../components/SwipeCard';
import { PeriodRecaps } from '../components/PeriodRecaps';
import { Card, Empty, Loading, MetricTile, Screen, SegmentBar } from '../components/ui';
import { cap, plural } from '../lib/format';

export function StudentHomePage({ id = 'me', monthAction, leadingPage, autoOpenWeeklyRecap = false }: {
    id?: number | 'me';
    monthAction?: ComponentChildren;
    leadingPage?: ComponentChildren;
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
        <PeriodRecaps week={profile.weeklyRecap} currentWeek={profile.currentWeekRecap} study={profile.studyRecaps} autoOpen={autoOpenWeeklyRecap} />
    ));

    return (
        <Screen hideTitle title={title} className="student-home">
            <div class="student-overview">
                <Card class="student-identity">
                    <strong class="student-name">{cap(name)}</strong>
                    <span class="pill"><NavIcon name="trophy" /> {place}-е место</span>
                </Card>
                <Card class="student-progress">
                    <strong id="student-progress-label">Общий прогресс</strong>
                    <div class="student-ring" role="progressbar" aria-labelledby="student-progress-label" aria-valuenow={pct}
                        style={{ '--progress': `${pct}%` }}>
                        <strong>{pct}%</strong>
                    </div>
                </Card>
                <Card class="student-totals">
                    <div class="metric-tiles">
                        <MetricTile icon="clipboard-list" label="Балл пробника" value={totals.exam ?? 0} />
                        <MetricTile icon="calendar-days" label="Решено задач" value={totals.tasks} />
                        <MetricTile icon="target" label="Изучено заданий" value={totals.topics} />
                    </div>
                </Card>
            </div>
            <SwipeCard
                label={recaps ? "Ближайшие цели, прогресс и итоги" : "Прогресс и ближайшие цели"}
                leading={recaps}
                first={
                    <>
                        <Goal label={month.name ? cap(month.name) : 'Прогресс месяца'} value={monthPct} action={monthAction} />
                        <Goal label="Прогресс недели" value={week.goalPct} />
                        {daysLeft != null && (
                            <div class="student-countdown">
                                <strong>{daysLeft} {plural(daysLeft, ['день', 'дня', 'дней'])}</strong>
                                <small>до начала экзаменов</small>
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
