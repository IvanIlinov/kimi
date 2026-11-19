import { useApi } from '../api/useApi';
import type { Profile } from '../api/types';
import { NavIcon } from '../components/NavIcon';
import { SwipeCard } from '../components/SwipeCard';
import { Card, Empty, Loading, MetricTile, Screen, SegmentBar } from '../components/ui';
import { cap, plural } from '../lib/format';

export function StudentHomePage() {
    const { data: profile, error } = useApi<Profile>('/api/profile/me');
    if (error) return <Screen hideTitle title="Главная"><Empty text={error} /></Screen>;
    if (!profile) return <Screen hideTitle title="Главная"><Loading /></Screen>;

    const { name, place, pct, monthPct, daysLeft, month, week, totals } = profile;
    const topicsLeft = Math.max(0, month.topics.goal - month.topics.value);
    const tasksLeft = Math.max(0, week.goal - week.tasks);
    const exam = month.exam.value ?? 0;
    const examLeft = Math.max(0, month.exam.goal - exam);

    return (
        <Screen hideTitle title="Главная" className="student-home">
            <Card class="student-summary">
                <div class="between">
                    <strong>{cap(name)}</strong>
                    <span class="pill"><NavIcon name="trophy" /> {place}-е место</span>
                </div>
                <div class="student-progress">
                    <div class="student-ring" role="progressbar" aria-label="Общий прогресс" aria-valuenow={pct}
                        style={{ '--progress': `${pct}%` }}>
                        <strong>{pct}%</strong>
                    </div>
                    <span>Общий прогресс</span>
                </div>
                <div class="metric-tiles">
                    <MetricTile icon="clipboard-list" label="Балл пробника" value={totals.exam ?? 0} />
                    <MetricTile icon="calendar-days" label="Решено задач" value={totals.tasks} />
                    <MetricTile icon="target" label="Изучено заданий" value={totals.topics} />
                </div>
            </Card>
            <SwipeCard
                label="Прогресс и ближайшие цели"
                first={
                    <>
                        <Goal label={month.name ? cap(month.name) : 'Прогресс месяца'} value={monthPct} />
                        <Goal label="Прогресс недели" value={week.goalPct} />
                        {daysLeft != null && (
                            <div class="student-countdown">
                                <strong>{daysLeft} {plural(daysLeft, ['день', 'дня', 'дней'])}</strong>
                                <small>до конца учебного плана</small>
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

function Goal({ icon, label, value, max, note }: {
    icon?: string;
    label: string;
    value: number;
    max?: number;
    note?: string;
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
                    <div class="between"><span>{label}</span><strong>{shown}</strong></div>
                    <SegmentBar value={value} max={max} />
                </>
            )}
            {note && <small>{note}</small>}
        </div>
    );
}
