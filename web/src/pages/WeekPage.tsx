import { useApi } from '../api/useApi';
import type { Week } from '../api/types';
import { Card, Empty, Label, Loading, Row, Screen, SegmentBar } from '../components/ui';
import { cap, sgn } from '../lib/format';

export function WeekPage({ onOpen }: { onOpen: (id: number) => void }) {
    const { data, error } = useApi<Week>('/api/week');

    if (error) return <Screen title="Неделя"><Empty text={error} /></Screen>;
    if (!data) return <Screen title="Неделя"><Loading /></Screen>;

    return (
        <Screen title="Неделя">
            {data.leader && (
                <Card class="leader">
                    <Label>👑 Лидер недели</Label>
                    <div class="between">
                        <strong>{cap(data.leader.name)}</strong>
                        <span class="stats">
                            <b>{sgn(data.leader.pct)}%</b>
                            <b>{sgn(data.leader.tasks)}</b>
                            <b>{sgn(data.leader.topics)}</b>
                        </span>
                    </div>
                </Card>
            )}

            <Card class="list">
                {data.rows.length === 0 && <Empty text="Пока никого нет" />}
                {data.rows.map((r) => (
                    <Row
                        key={r.id}
                        name={r.name}
                        bar={<SegmentBar value={Math.min(r.goalPct, 100)} segments={12} />}
                        right={
                            <span class="stats">
                                <span>{sgn(r.tasks)}</span>
                                <span>{sgn(r.topics)}</span>
                            </span>
                        }
                        onClick={() => onOpen(r.id)}
                    />
                ))}
            </Card>
        </Screen>
    );
}
