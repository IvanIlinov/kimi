import { useApi } from '../api/useApi';
import type { Profile } from '../api/types';
import { NavIcon } from '../components/NavIcon';
import { SwipeCard } from '../components/SwipeCard';
import { Card, Empty, Loading, Screen, SegmentBar } from '../components/ui';
import { plural } from '../lib/format';

export function StudentHomePage() {
    const { data: profile, error } = useApi<Profile>('/api/profile/me');
    if (error) return <Screen hideTitle title="Главная"><Empty text={error} /></Screen>;
    if (!profile) return <Screen hideTitle title="Главная"><Loading /></Screen>;

    const { name, place, pct, monthPct, month, week } = profile;
    const topicsLeft = Math.max(0, month.topics.goal - month.topics.value);
    const tasksLeft = Math.max(0, week.goal - week.tasks);
    const examLeft = Math.max(0, month.exam.goal - (month.exam.value ?? 0));

    return (
        <Screen hideTitle title="Главная" className="student-home">
            <Card class="student-summary">
                <div class="between">
                    <strong>{name}</strong>
                    <span class="pill"><NavIcon name="trophy" /> {place}-е место</span>
                </div>
                <div class="student-progress">
                    <div class="student-ring" role="progressbar" aria-label="Общий прогресс" aria-valuenow={pct}
                        style={{ '--progress': `${pct}%` }}>
                        <strong>{pct}%</strong>
                    </div>
                    <span>Общий прогресс</span>
                </div>
                <div class="student-metrics">
                    <Metric icon="clipboard-list" label="Балл пробника" value={month.exam.value ?? '—'} />
                    <Metric icon="calendar-days" label="Решено задач" value={month.tasks.value} />
                    <Metric icon="target" label="Закреплено заданий" value={month.topics.value} />
                </div>
            </Card>
            <SwipeCard
                label="Прогресс и ближайшие цели"
                first={
                    <>
                        <Goal label="Прогресс месяца" value={monthPct} />
                        <Goal label="Прогресс недели" value={week.goalPct} />
                    </>
                }
                second={
                    <>
                        <Goal label="Закрепить за месяц" value={month.topics.value} max={month.topics.goal}
                            note={remaining(topicsLeft, ['задание', 'задания', 'заданий'])} />
                        <Goal label="Решить за неделю" value={week.tasks} max={week.goal}
                            note={remaining(tasksLeft, ['задача', 'задачи', 'задач'])} />
                        <Goal label="Балл за пробник" value={month.exam.value} max={month.exam.goal}
                            note={month.exam.value === null ? 'Балл ещё не внесён' : remaining(examLeft, ['балл', 'балла', 'баллов'])} />
                    </>
                }
            />
        </Screen>
    );
}

function remaining(value: number, forms: [string, string, string]) {
    return value ? `Осталось: ${value} ${plural(value, forms)}` : 'Цель выполнена';
}

function Metric({ icon, label, value }: { icon: string; label: string; value: number | string }) {
    return (
        <div class="student-metric">
            <NavIcon name={icon} />
            <strong>{value}</strong>
            <span>{label}</span>
        </div>
    );
}

function Goal({ label, value, max, note }: { label: string; value: number | null; max?: number; note?: string }) {
    return (
        <div class="student-goal">
            <div class="between">
                <span>{label}</span>
                <strong>{max === undefined ? `${value}%` : `${value ?? '—'}/${max}`}</strong>
            </div>
            <SegmentBar value={value ?? 0} max={max} />
            {note && <small>{note}</small>}
        </div>
    );
}
