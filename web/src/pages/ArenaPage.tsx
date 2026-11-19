import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { api } from '../api/client';
import { useApi } from '../api/useApi';
import type { Arena, ArenaMode } from '../api/types';
import { Card, Empty, Label, Loading, Pill, Row, Screen, SegmentBar } from '../components/ui';
import { cap } from '../lib/format';
import { NavIcon } from '../components/NavIcon';
import { WeekResults } from './WeekPage';

const MODES = [
    { id: 'global', label: 'Глобальный' },
    { id: 'month', label: 'Месяц' },
    { id: 'week', label: 'Неделя' },
] as const;

export function ArenaPage({ onOpen, onEdit }: {
    onOpen: (id: number) => void;
    onEdit?: (id: number) => void;
}) {
    const [mode, setMode] = useState<(typeof MODES)[number]['id']>('global');
    const [adding, setAdding] = useState(false);
    const [version, setVersion] = useState(0);
    const [removing, setRemoving] = useState(false);
    const [removeError, setRemoveError] = useState('');

    async function remove(id: number, name: string) {
        if (removing || !window.confirm(`Удалить участника «${cap(name)}» из рейтинга?`)) return;
        setRemoving(true);
        setRemoveError('');
        try {
            await api(`/api/admin/members/${id}/remove`, { method: 'POST' });
            setVersion((value) => value + 1);
        } catch (e) {
            setRemoveError((e as Error).message);
        } finally {
            setRemoving(false);
        }
    }

    const addAction = onEdit && (
        <button type="button" class="chip primary arena-icon arena-add" onClick={() => setAdding(true)}
            aria-label="Добавить участника" title="Добавить участника"><NavIcon name="plus" /></button>
    );
    const rowActions = onEdit && ((id: number, name: string) => (
        <div class="arena-row-actions">
            <button type="button" class="arena-icon" onClick={() => onEdit(id)}
                aria-label={`Редактировать задания: ${cap(name)}`} title="Редактировать задания">
                <NavIcon name="pencil" />
            </button>
            <button type="button" class="arena-icon arena-remove" onClick={() => void remove(id, name)}
                disabled={removing} aria-label={`Удалить: ${cap(name)}`} title="Удалить участника">
                <NavIcon name="trash" />
            </button>
        </div>
    ));


    return (
        <Screen hideTitle title="Рейтинг" className="layout-ranking">
            <div class="segmented" role="group" aria-label="Период рейтинга">
                {MODES.map(({ id, label }) => (
                    <button key={id} type="button" class={mode === id ? 'on' : ''} aria-pressed={mode === id} onClick={() => setMode(id)}>
                        {label}
                    </button>
                ))}
            </div>
            {removeError && <p class="warn" role="alert">{removeError}</p>}
            {mode === 'week'
                ? <WeekResults key={version} onOpen={onOpen} addAction={addAction} rowActions={rowActions} />
                : <ArenaResults key={`${mode}-${version}`} mode={mode} onOpen={onOpen}
                    addAction={addAction} rowActions={rowActions} />}
            {adding && <AddParticipant onClose={() => setAdding(false)} onSaved={() => {
                setAdding(false);
                setVersion((value) => value + 1);
            }} />}
        </Screen>
    );
}

function AddParticipant({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
    const [tgId, setTgId] = useState('');
    const [name, setName] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const valid = /^\d+$/.test(tgId) && Number.isSafeInteger(Number(tgId)) && Number(tgId) > 0 && !!name.trim();

    async function submit() {
        if (busy || !valid) return;
        setBusy(true);
        setError('');
        try {
            await api('/api/admin/members', { method: 'POST', body: { tgId: Number(tgId), name } });
            onSaved();
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div class="modal-backdrop" onClick={() => !busy && onClose()}>
            <div class="modal-dialog" role="dialog" aria-modal="true" aria-label="Добавить участника"
                onClick={(e) => e.stopPropagation()}>
                <Card>
                    <form class="modal-form" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
                        <div class="between">
                            <Label>Добавить участника</Label>
                            <button type="button" class="chip modal-close" onClick={onClose} disabled={busy} aria-label="Закрыть">✕</button>
                        </div>
                        <label>Telegram ID
                            <input required inputMode="numeric" value={tgId} onInput={(e) => setTgId(e.currentTarget.value)} />
                        </label>
                        <label>Имя ученика
                            <input required maxLength={30} value={name} onInput={(e) => setName(e.currentTarget.value)} />
                        </label>
                        {error && <p class="warn" role="alert">{error}</p>}
                        <div class="chips"><button class="chip primary" disabled={busy || !valid}>Добавить</button></div>
                    </form>
                </Card>
            </div>
        </div>
    );
}

function ArenaResults({ mode, onOpen, addAction, rowActions }: {
    mode: ArenaMode;
    onOpen: (id: number) => void;
    addAction?: ComponentChildren;
    rowActions?: (id: number, name: string) => ComponentChildren;
}) {
    const { data, error } = useApi<Arena>(`/api/arena?mode=${mode}`);

    if (error) return <Empty text={error} />;
    if (!data) return <Loading />;

    const l = data.leader;
    const monthTaskGoal = mode === 'month' ? data.monthTaskGoal : undefined;
    return (
        <>
            {(l || addAction) && (
                <Card class="leader">
                    <div class="between leader-heading">
                        <Label>{!l ? 'Лидер пока не определён' : mode === 'global' ? 'Лидер по общему прогрессу' : 'Лидер месяца'}</Label>
                        {addAction}
                    </div>
                    {l && <>
                        <strong class="leader-name">{cap(l.name)}</strong>
                        <div class="kpis">
                            <Kpi label="Прогресс" value={`${l.pct}%`} />
                            <Kpi label="Программа" value={`${l.monthPct}%`} />
                            <Kpi label="Пробник" value={l.exam ?? 0} />
                            <Kpi label="Задания" value={l.topics} />
                            <Kpi label="Задачи" value={monthTaskGoal ? `${l.tasks}/${monthTaskGoal}` : l.tasks} />
                        </div>
                    </>}
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
                                {monthTaskGoal
                                    ? <span aria-label={`Решено задач: ${r.tasks} из ${monthTaskGoal}`}>{r.tasks}/{monthTaskGoal}</span>
                                    : <span>{r.pct}%</span>}
                                <Pill standing={r.standing} />
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

function Kpi({ label, value }: { label: string; value: string | number }) {
    return (
        <div class="kpi">
            <b>{value}</b>
            <span>{label}</span>
        </div>
    );
}
