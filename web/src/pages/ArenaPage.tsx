import { useState } from 'preact/hooks';
import { useApi } from '../api/useApi';
import type { Arena, ArenaMode } from '../api/types';
import { Card, Empty, Label, Loading, Pill, Row, Screen, SegmentBar } from '../components/ui';
import { cap } from '../lib/format';

// fixedMode задан у гостя (режимы вынесены в нижнее меню), у ученика есть переключатель
export function ArenaPage({ fixedMode, onOpen }: { fixedMode?: ArenaMode; onOpen: (id: number) => void }) {
    const [picked, setPicked] = useState<ArenaMode>('month');
    const mode = fixedMode ?? picked;
    const { data, error } = useApi<Arena>(`/api/arena?mode=${mode}`);

    if (error) return <Screen title="Арена"><Empty text={error} /></Screen>;
    if (!data) return <Screen title="Арена"><Loading /></Screen>;

    const l = data.leader;
    return (
        <Screen title="Арена">
            {!fixedMode && (
                <div class="segmented" role="tablist">
                    <button class={mode === 'global' ? 'on' : ''} onClick={() => setPicked('global')}>🌍</button>
                    <button class={mode === 'month' ? 'on' : ''} onClick={() => setPicked('month')}>💯</button>
                </div>
            )}

            {l && (
                <Card class="leader">
                    <Label>👑 Лидер года</Label>
                    <strong class="leader-name">{cap(l.name)}</strong>
                    <div class="kpis">
                        <Kpi label="Прогресс" value={`${l.pct}%`} />
                        <Kpi label="Успеваемость" value={`${l.monthPct}%`} />
                        <Kpi label="Пробник" value={l.exam ?? '—'} />
                        <Kpi label="Задания" value={l.topics} />
                        <Kpi label="Задачи" value={l.tasks} />
                    </div>
                </Card>
            )}

            <Card class="list">
                {data.rows.length === 0 && <Empty text="Пока никого нет" />}
                {data.rows.map((r) => (
                    <Row
                        key={r.id}
                        name={r.name}
                        bar={<SegmentBar value={r.pct} segments={12} />}
                        right={
                            <span class="stats">
                                <span>{r.pct}%</span>
                                <Pill standing={r.standing} />
                            </span>
                        }
                        onClick={() => onOpen(r.id)}
                    />
                ))}
            </Card>
        </Screen>
    );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
    return (
        <div class="kpi">
            <b>{value}</b>
            <span>{label}</span>
        </div>
    );
}
