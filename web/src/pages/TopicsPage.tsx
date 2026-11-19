import { useState } from 'preact/hooks';
import { api } from '../api/client';
import { useApi } from '../api/useApi';
import type { SelfData } from '../api/types';
import { NavIcon } from '../components/NavIcon';
import { Card, Empty, Label, Loading, Screen, SegmentBar } from '../components/ui';
import { haptic } from '../lib/telegram';

const STATUS_LABEL = {
    todo: 'Не изучено',
    learning: 'Изучается',
    done: 'Изучено',
    reinforced: 'Закреплено',
};

const AMOUNTS = [-1, 1, 3, 5, 10];

// Порядок заданий внутри рангов и между рангами из роадмапа v5.
const STUDY_ORDER = [
    4, 7, 11, 1,
    18, 3, 22, 10, 6, 12,
    17, 9, 8,
    14, 13, 2, 15, 5,
    16, 23, 19, 20, 21,
    25, 27,
    24, 26,
];

export function TopicsPage({ readOnly = false }: { readOnly?: boolean }) {
    const { data, error, setData } = useApi<SelfData>('/api/self');
    const [busy, setBusy] = useState(false);
    const [note, setNote] = useState('');
    const [studyOrder, setStudyOrder] = useState(false);

    if (error) return <Screen hideTitle title="Задания" className="layout-topics"><Empty text={error} /></Screen>;
    if (!data) return <Screen hideTitle title="Задания" className="layout-topics"><Loading /></Screen>;

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

    const topicNumbers = studyOrder ? STUDY_ORDER : data.topics.map((_, index) => index + 1);

    return (
        <Screen hideTitle title="Задания" className="layout-topics">
            <Card>
                <Label>Задачи</Label>
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
                {data.limits.week > 0 && (
                    <div class="tasks-week" role="group"
                        aria-label={`Решено за неделю: ${data.tasksWeek} из ${data.limits.week}`}>
                        <SegmentBar value={data.tasksWeek} max={data.limits.week} />
                    </div>
                )}
                {note && <p class="warn">⚠️ {note}</p>}
            </Card>

            <Card>
                <Label>Задания: нажмите, чтобы сменить статус</Label>
                <div class="grid">
                    {topicNumbers.map((number) => {
                        const status = data.topics[number - 1];
                        return (
                            <button
                                key={number}
                                class={`cell ${status}`}
                                aria-label={`Задание ${number}. ${STATUS_LABEL[status]}`}
                                disabled={readOnly || busy}
                                onClick={() => run(`/api/self/topics/${number}/cycle`)}
                            >
                                <b>{number}</b>
                            </button>
                        );
                    })}
                    <button type="button" class="topic-order-toggle" aria-label="По порядку изучения"
                        aria-pressed={studyOrder} title={studyOrder ? 'Вернуть порядок по номерам' : 'По порядку изучения'}
                        onClick={() => setStudyOrder((current) => !current)}>
                        <NavIcon name="arrow-down-up" />
                        <span>По плану</span>
                    </button>
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
    const [value, setValue] = useState(String(exam ?? 0));
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
