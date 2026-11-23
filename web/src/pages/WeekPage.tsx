import type { ComponentChildren } from 'preact';
import { useApi } from '../api/useApi';
import type { Week } from '../api/types';
import { Card, Empty, Label, Loading, Row, SegmentBar } from '../components/ui';
import { cap, plural, sgn } from '../lib/format';

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
                    {data.leader && <>
                        <strong class="leader-name">{cap(data.leader.name)}</strong>
                        <span class="stats week-leader-stats">
                            <b>{sgn(data.leader.pct)}%</b>
                            <b>{sgn(data.leader.tasks)} {plural(data.leader.tasks, ['задача', 'задачи', 'задач'])}</b>
                            <b>{sgn(data.leader.topics)} {plural(data.leader.topics, ['задание', 'задания', 'заданий'])}</b>
                        </span>
                    </>}
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
                        actions={rowActions?.(r.id, r.name)}
                    />
                ))}
            </Card>
        </>
    );
}
