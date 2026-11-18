import { useState } from 'preact/hooks';
import { api } from '../api/client';
import { useApi } from '../api/useApi';
import type { SelfData } from '../api/types';
import { Card, Empty, Label, Loading, Screen } from '../components/ui';
import { haptic } from '../lib/telegram';

const AMOUNTS = [-1, 1, 3, 5, 10];

export function TopicsPage({ readOnly = false }: { readOnly?: boolean }) {
    const { data, error, setData } = useApi<SelfData>('/api/self');
    const [busy, setBusy] = useState(false);
    const [note, setNote] = useState('');

    if (error) return <Screen title="Задания"><Empty text={error} /></Screen>;
    if (!data) return <Screen title="Задания"><Loading /></Screen>;

    // Любое изменение: запрос, обновление данных из ответа, вибрация, ошибка текстом
    async function run(path: string, body?: unknown) {
        if (readOnly || busy) return;
        setBusy(true);
        setNote('');
        try {
            setData(await api<SelfData>(path, { method: 'POST', body }));
            haptic.tap();
        } catch (e) {
            setNote((e as Error).message);
            haptic.error();
        } finally {
            setBusy(false);
        }
    }

    return (
        <Screen title="Задания">
            {readOnly && <p class="muted">Режим предпросмотра — изменения отключены.</p>}
            <Card>
                <div class="between">
                    <Label>Задачи</Label>
                    <span class="muted">
                        за неделю {data.tasksWeek} · всего {data.tasksTotal}
                    </span>
                </div>
                <div class="amounts">
                    {AMOUNTS.map((n) => (
                        <button
                            key={n}
                            class="chip"
                            disabled={readOnly || busy}
                            onClick={() => run('/api/self/tasks', { amount: n })}
                        >
                            {n > 0 ? `+${n}` : n}
                        </button>
                    ))}
                </div>
                {note && <p class="warn">⚠️ {note}</p>}
            </Card>

            <Card>
                <Label>Задания: нажмите, чтобы сменить статус</Label>
                <div class="grid">
                    {data.topics.map((status, i) => (
                        <button
                            key={i}
                            class={`cell ${status}`}
                            disabled={readOnly || busy}
                            onClick={() => run(`/api/self/topics/${i + 1}/cycle`)}
                        >
                            <span class={`status-dot ${status}`} aria-hidden="true" />
                            <b>{i + 1}</b>
                        </button>
                    ))}
                </div>
            </Card>

            <ExamCard exam={data.exam} max={data.limits.exam} busy={busy} readOnly={readOnly} onSave={(v) => run('/api/self/exam', { value: v })} />
        </Screen>
    );
}

function ExamCard({ exam, max, busy, readOnly, onSave }: {
    exam: number | null;
    max: number;
    busy: boolean;
    readOnly: boolean;
    onSave: (value: number) => void;
}) {
    const [value, setValue] = useState(exam === null ? '' : String(exam));
    const valid = value !== '' && Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= max;

    return (
        <Card>
            <Label>Балл пробника</Label>
            <div class="exam">
                <input
                    type="number"
                    disabled={readOnly}
                    inputMode="numeric"
                    min={0}
                    max={max}
                    value={value}
                    placeholder={`0–${max}`}
                    onInput={(e) => setValue((e.target as HTMLInputElement).value)}
                />
                <button class="chip primary" disabled={readOnly || busy || !valid} onClick={() => onSave(Number(value))}>
                    Сохранить
                </button>
            </div>
        </Card>
    );
}
