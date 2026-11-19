import { useState } from 'preact/hooks';
import { useApi } from '../api/useApi';
import type { Arena, ArenaMode } from '../api/types';
import { Card, Empty, Label, Loading, Pill, Row, Screen, SegmentBar } from '../components/ui';
import { cap } from '../lib/format';
import { WeekResults } from './WeekPage';

const MODES = [
    { id: 'global', label: 'Глобальный' },
    { id: 'month', label: 'Месяц' },
    { id: 'week', label: 'Неделя' },
] as const;

export function ArenaPage({ onOpen }: { onOpen: (id: number) => void }) {
    const [mode, setMode] = useState<(typeof MODES)[number]['id']>('global');

    return (
        <Screen title="Рейтинг" className="layout-ranking">
            <div class="segmented" role="group" aria-label="Период рейтинга">
                {MODES.map(({ id, label }) => (
                    <button key={id} type="button" class={mode === id ? 'on' : ''} aria-pressed={mode === id} onClick={() => setMode(id)}>
                        {label}
                    </button>
                ))}
            </div>
            {mode === 'week' ? <WeekResults onOpen={onOpen} /> : <ArenaResults key={mode} mode={mode} onOpen={onOpen} />}
        </Screen>
    );
}

function ArenaResults({ mode, onOpen }: { mode: ArenaMode; onOpen: (id: number) => void }) {
    const { data, error } = useApi<Arena>(`/api/arena?mode=${mode}`);

    if (error) return <Empty text={error} />;
    if (!data) return <Loading />;

    const l = data.leader;
    return (
        <>
            {l && (
                <Card class="leader">
                    <Label>{mode === 'global' ? 'Лидер по общему прогрессу' : 'Лидер месяца'}</Label>
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
        </>
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
