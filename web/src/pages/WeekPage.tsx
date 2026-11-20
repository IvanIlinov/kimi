import type { ComponentChildren } from 'preact';
import { useApi } from '../api/useApi';
import type { Week } from '../api/types';
import { Card, Empty, Label, Loading, Row, SegmentBar } from '../components/ui';
import { RankBadge } from '../components/RankPanel';
import { cap, sgn } from '../lib/format';

export function WeekResults({ onOpen, addAction, rowActions }: {
    onOpen: (id: number) => void;
    addAction?: ComponentChildren;
    rowActions?: (id: number, name: string) => ComponentChildren;
}) {
    const { data, error } = useApi<Week>('/api/week');

    if (error) return <Empty text={error} />;
    if (!data) return <Loading />;

    return (
        <>
            {(data.leader || addAction) && (
                <Card class="leader">
                    <div class="between leader-heading">
                        <Label>{data.leader ? '👑 Лидер недели' : 'Лидер недели пока не определён'}</Label>
                        {addAction}
                    </div>
                    {data.leader && <div class="between">
                        <div class="leader-identity">
                            <strong>{cap(data.leader.name)}</strong>
                            <RankBadge rank={data.leader.rank} />
                        </div>
                        <span class="stats">
                            <b>{sgn(data.leader.pct)}%</b>
                            <b>{sgn(data.leader.tasks)}</b>
                            <b>{sgn(data.leader.topics)}</b>
                        </span>
                    </div>}
                </Card>
            )}

            <Card class="list">
                {data.rows.length === 0 && <Empty text="Пока никого нет" />}
                {data.rows.map((r) => (
                    <Row
                        key={r.id}
                        name={r.name}
                        subtitle={r.rank && <RankBadge rank={r.rank} />}
                        bar={<SegmentBar value={Math.min(r.goalPct, 100)} segments={12} />}
                        right={
                            <span class="stats">
                                <span>{sgn(r.tasks)}</span>
                                <span>{sgn(r.topics)}</span>
                            </span>
                        }
                        onClick={() => onOpen(r.id)}
                        actions={rowActions?.(r.id, r.name)}
                    />
                ))}
            </Card>
        </>
    );
}
