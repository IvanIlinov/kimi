import type { ComponentChildren } from 'preact';
import { cap } from '../lib/format';
import { Card, Label } from './ui';

export function ArenaLeader({ title, name, metrics = [], action }: {
    title: string;
    name?: string;
    metrics?: { label: string; value: string | number }[];
    action?: ComponentChildren;
}) {
    return (
        <Card class="leader">
            <div class="between leader-heading">
                <Label>{title}</Label>
                {action}
            </div>
            {name !== undefined && <>
                <strong class="leader-name">{cap(name)}</strong>
                <div class={metrics.length === 3 ? 'kpis kpis-three' : 'kpis'}>
                    {metrics.map(({ label, value }) => (
                        <div class="kpi" key={label}>
                            <b>{value}</b>
                            <span>{label}</span>
                        </div>
                    ))}
                </div>
            </>}
        </Card>
    );
}
