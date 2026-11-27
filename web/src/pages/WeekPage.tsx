import type { ComponentChildren } from 'preact';
import { useApi } from '../api/useApi';
import type { Me, Week } from '../api/types';
import { ArenaLeader } from '../components/ArenaLeader';
import { Card, Empty, Loading, Row, SegmentBar } from '../components/ui';
import { plural } from '../lib/format';

const WEEK_TASK_GOAL = 25;

export function WeekResults({ viewer, onOpen, addAction, rowActions }: {
    viewer: Me;
    onOpen: (id: number) => void;
    addAction?: ComponentChildren;
    rowActions?: (id: number, name: string) => ComponentChildren;
}) {
    const { data, error } = useApi<Week>('/api/week');

    if (error) return <Empty text={error} />;
    if (!data) return <Loading />;

    const leader = data.leader;
    return (
        <>
            {(leader || addAction) && (
                <ArenaLeader title={leader ? 'Лидер недели' : 'Лидер недели пока не определён'}
                    name={leader?.name} action={addAction} metrics={leader ? [
                        { label: 'Пробник', value: leader.exam ?? 0 },
                        { label: plural(leader.topics, ['задание', 'задания', 'заданий']), value: leader.topics },
                        { label: plural(leader.tasks, ['задача', 'задачи', 'задач']), value: leader.tasks },
                    ] : undefined}
                />
            )}

            <Card class="list">
                <div class="ranking-scroll">
                    {data.rows.length === 0 && <Empty text="Пока никого нет" />}
                    {data.rows.map((r, index) => (
                        <Row
                            key={r.id}
                            name={r.name}
                            place={viewer.role !== 'student' || index < 10 ? index + 1 : undefined}
                            current={r.id === viewer.personId}
                            bar={<SegmentBar value={Math.min(r.goalPct, 100)} segments={12} />}
                            right={<span aria-label={`Решено задач за неделю: ${r.tasks} из ${WEEK_TASK_GOAL}`}>
                                {r.tasks}/{WEEK_TASK_GOAL}
                            </span>}
                            onClick={() => onOpen(r.id)}
                            actions={rowActions?.(r.id, r.name)}
                        />
                    ))}
                </div>
            </Card>
        </>
    );
}
