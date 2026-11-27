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

    const { name, place, pct, daysLeft, month, week, totals } = profile;

    const recaps = leadingPage ?? (profile.weeklyRecap && (
        <PeriodRecaps week={profile.weeklyRecap} currentWeek={profile.currentWeekRecap} study={profile.studyRecaps} autoOpen={autoOpenWeeklyRecap} />
    ));

    return (
        <Screen hideTitle title={title} className="student-home">
            <div class="student-frame">
                <Card class="student-identity">
                    <div class="student-identity-copy">
                        <strong class="student-name">{cap(name)}</strong>
                        <span class="pill"><NavIcon name="trophy" /> {place}-е место</span>
                    </div>
                    <div class="student-ring" role="progressbar" aria-label="Общий прогресс" aria-valuenow={pct}
                        style={{ '--progress': `${pct}%` }}>
                        <strong>{pct}%</strong>
                        <small>Прогресс</small>
                    </div>
                </Card>
                <Card class="student-totals">
                    <div class="metric-tiles">
                        <MetricTile inlineValue icon="clipboard-list" label="Балл пробника" value={totals.exam ?? 0} />
                        <MetricTile inlineValue icon="calendar-days" label="Решено задач" value={totals.tasks} />
                        <MetricTile inlineValue icon="target" label="Изучено заданий" value={totals.topics} />
                    </div>
                </Card>
                <SwipeCard
                    label={recaps ? "Ближайшие цели и итоги" : "Ближайшие цели"}
                    pageNames={["Ближайшие цели", "Итоги"]}
                    second={recaps}
                    first={
                        <>
                            {monthAction}
                            <Goal icon="target" label="Изучено заданий" value={month.topics.value} max={month.topics.goal} />
                            <Goal icon="calendar-days" label="Решено задач за неделю" value={week.tasks} max={week.goal} />
                            <Goal icon="clipboard-list" label="Балл пробника" value={month.exam.value ?? 0} max={month.exam.goal} />
                            {daysLeft != null && (
                                <p class="student-countdown">
                                    <strong>{daysLeft} {plural(daysLeft, ['день', 'дня', 'дней'])}</strong>
                                    <span>до начала экзаменов</span>
                                </p>
                            )}
                        </>
                    }
                />
            </div>
        </Screen>
    );
}

function Goal({ icon, label, value, max }: { icon: string; label: string; value: number; max: number }) {
    return (
        <div class="student-goal" role="group" aria-label={label}>
            <NavIcon name={icon} />
            <SegmentBar value={value} max={max} />
            <strong>{value}/{max}</strong>
        </div>
    );
}
