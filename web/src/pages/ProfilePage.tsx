import { useApi } from '../api/useApi';
import type { Profile } from '../api/types';
import { Card, Empty, Label, Loading, Pill, Screen, SegmentBar } from '../components/ui';
import { cap, plural, toneFor } from '../lib/format';

export function ProfilePage({ id }: { id: number | 'me' }) {
    const { data: p, error } = useApi<Profile>(`/api/profile/${id}`);

    if (error) return <Screen title="Профиль"><Empty text={error} /></Screen>;
    if (!p) return <Screen title="Профиль"><Loading /></Screen>;

    const { month: m, week: w } = p;
    const examLine =
        m.exam.value === null
            ? `Пробник пока не внесён (по плану ${m.exam.goal})`
            : `Сейчас пишем пробник на ${m.exam.value} ${plural(m.exam.value, ['балл', 'балла', 'баллов'])}!`;

    return (
        <Screen title={`${cap(p.name)} 🎖${p.place}`}>
            <Card>
                <div class="between">
                    <Label>Прогресс</Label>
                    <Pill standing={p.standing} />
                </div>
                <div class="metric">
                    <span class="metric-name">Global</span>
                    <SegmentBar value={p.pct} />
                    <span class="metric-val">{p.pct}%</span>
                </div>
                <div class="metric">
                    <span class="metric-name">Week</span>
                    <SegmentBar value={Math.min(w.goalPct, 100)} />
                    <span class="metric-val">{w.goalPct}%</span>
                </div>
            </Card>

            <Card>
                <Label>Цели месяца</Label>
                <Goal icon="📗" value={m.topics.value} goal={m.topics.goal} />
                <Goal icon="📘" value={m.tasks.value} goal={m.tasks.goal} />
                <Goal icon="📕" value={m.exam.value ?? 0} goal={m.exam.goal} shown={m.exam.value ?? '—'} />
            </Card>

            <Card class="notes">
                <p>
                    Решил {w.tasks} {plural(w.tasks, ['задачу', 'задачи', 'задач'])} за эту неделю
                </p>
                <p>
                    Изучил {m.topics.value} {plural(m.topics.value, ['задание', 'задания', 'заданий'])} (по плану{' '}
                    {m.topics.goal})
                </p>
                <p>{examLine}</p>
            </Card>
        </Screen>
    );
}

function Goal({ icon, value, goal, shown }: { icon: string; value: number; goal: number; shown?: number | string }) {
    const tone = toneFor(goal > 0 ? (value / goal) * 100 : 0);
    return (
        <div class="metric">
            <span class="metric-name">{icon}</span>
            <SegmentBar value={value} max={goal} tone={tone} />
            <span class="metric-val">
                {shown ?? value}/{goal}
            </span>
        </div>
    );
}
