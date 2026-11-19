import { useApi } from '../api/useApi';
import type { Profile } from '../api/types';
import { Card, Empty, Label, Loading, Pill, Screen, SegmentBar } from '../components/ui';
import { cap, plural, toneFor } from '../lib/format';

export function ProfilePage({ id }: { id: number | 'me' }) {
    const { data: p, error } = useApi<Profile>(`/api/profile/${id}`);

    if (error) return <Screen hideTitle title="Профиль"><Empty text={error} /></Screen>;
    if (!p) return <Screen hideTitle title="Профиль"><Loading /></Screen>;

    const { month: m, week: w } = p;
    const exam = p.totals.exam ?? 0;
    const examLine = `Сейчас пишем пробник на ${exam} ${plural(exam, ['балл', 'балла', 'баллов'])}!`;

    return (
        <Screen title={`${cap(p.name)} 🎖${p.place}`} className="layout-profile">
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
                <Goal icon="📕" value={m.exam.value ?? 0} goal={m.exam.goal} />
            </Card>

            <Card class="notes">
                <p>
                    Решил {w.tasks} {plural(w.tasks, ['задачу', 'задачи', 'задач'])} за эту неделю
                </p>
                <p>
                    Закрепил {p.totals.topics} {plural(p.totals.topics, ['задание', 'задания', 'заданий'])} (по плану{' '}
                    {m.topics.goal})
                </p>
                <p>{examLine}</p>
            </Card>
        </Screen>
    );
}

function Goal({ icon, value, goal }: { icon: string; value: number; goal: number }) {
    const tone = toneFor(goal > 0 ? (value / goal) * 100 : 0);
    return (
        <div class="metric">
            <span class="metric-name">{icon}</span>
            <SegmentBar value={value} max={goal} tone={tone} />
            <span class="metric-val">
                {value}/{goal}
            </span>
        </div>
    );
}
