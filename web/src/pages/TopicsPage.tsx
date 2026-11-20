import { useRef, useState } from 'preact/hooks';
import { api } from '../api/client';
import { useApi } from '../api/useApi';
import type { RankSector, SelfData } from '../api/types';
import { NavIcon } from '../components/NavIcon';
import { RankPanel } from '../components/RankPanel';
import { Card, Empty, Label, Loading, Screen, SegmentBar } from '../components/ui';
import { MissionPractice } from './MissionPractice';
import { MissionChallenge } from './MissionChallenge';
import { haptic } from '../lib/telegram';

const STATUS_LABEL = {
    todo: 'Не изучено',
    learning: 'Изучается',
    done: 'Изучено',
    reinforced: 'Закреплено',
};

const AMOUNTS = [-1, 1, 3, 5, 10];

// Секторы следуют учебному маршруту из роадмапа.
const LEGACY_SECTORS: RankSector[] = [
    { name: 'Врата', missions: [4, 7, 11, 1] },
    { name: 'Кристальный архив', missions: [18, 3, 22, 10, 6, 12] },
    { name: 'Узел связи', missions: [17, 9, 8] },
    { name: 'Рунный реактор', missions: [14, 13, 2, 15, 5] },
    { name: 'Башня алгоритмов', missions: [16, 23, 19, 20, 21] },
    { name: 'Орбитальный рубеж', missions: [25, 27] },
    { name: 'Сердце цитадели', missions: [24, 26] },
];

const STATUS_ACTION = {
    todo: 'Начать изучение',
    learning: 'Отметить как изученное',
    done: 'Закрепить задание',
    reinforced: 'Сбросить статус',
};

export function TopicsPage({ readOnly = false, studentMode = true, onTasksSaved }: {
    readOnly?: boolean; studentMode?: boolean; onTasksSaved?: () => void;
}) {
    const { data, error, setData } = useApi<SelfData>('/api/self');
    const [busy, setBusy] = useState(false);
    const [note, setNote] = useState<{ path: string; message: string } | null>(null);
    const [studyOrder, setStudyOrder] = useState(true);
    const [selected, setSelected] = useState<number | null>(null);
    const selection = useRef<HTMLHeadingElement>(null);
    const logHeading = useRef<HTMLHeadingElement>(null);

    if (error) return <Screen hideTitle title="Миссии" className="layout-topics mission-screen"><Empty text={error} /></Screen>;
    if (!data) return <Screen hideTitle title="Миссии" className="layout-topics mission-screen"><Loading /></Screen>;

    // Любое изменение: запрос, обновление данных из ответа, вибрация, ошибка текстом
    async function run(path: string, body?: unknown, onSaved?: () => void) {
        if (readOnly || busy) return;
        setBusy(true);
        setNote(null);
        try {
            setData(await api<SelfData>(path, { method: 'POST', body }));
            haptic.tap();
            onSaved?.();
        } catch (e) {
            setNote({ path, message: (e as Error).message });
            haptic.error();
        } finally {
            setBusy(false);
        }
    }

    const rankRoute = data.rankRoute ?? LEGACY_SECTORS;
    const sectors: RankSector[] = studyOrder ? rankRoute : [{ name: 'Все задания', missions: data.topics.map((_, i) => i + 1) }];
    const route = rankRoute.flatMap(({ missions }) => missions);
    const next = route.find((number) => data.topics[number - 1] !== 'reinforced');
    const mission = selected ?? next;
    const status = mission === undefined ? undefined : data.topics[mission - 1];
    const guided = mission !== undefined && studentMode && !readOnly && data.challengeTopics?.includes(mission);
    const secured = data.topics.filter((item) => item === 'reinforced').length;

    return (
        <Screen hideTitle title="Миссии" className="layout-topics mission-screen">
            <header class="mission-map-heading">
                <span class="student-brand"><NavIcon name="map" /> Маршрут подготовки</span>
                <div class="between">
                    <h1>Карта миссий</h1>
                    <button type="button" class="chip mission-log-link" onClick={() => logHeading.current?.focus()}>Журнал задач</button>
                </div>
                <div class="between"><span>Закреплено</span><strong>{secured}/{data.limits.topics}</strong></div>
                <SegmentBar value={secured} max={data.limits.topics} segments={data.limits.topics} tone="good" />
            </header>

            <Card class="mission-current">
                <div class="between">
                    <div>
                        <span class="student-brand">{mission === next && next !== undefined ? 'Следующая по маршруту' : 'Текущая миссия'}</span>
                        <h2 ref={selection} tabIndex={-1}>{mission === undefined ? 'Маршрут завершён' : `Задание №${mission}`}</h2>
                    </div>
                    <span class="mission-emblem"><NavIcon name={mission === undefined || status === 'reinforced' ? 'check' : 'crystal'} /></span>
                </div>
                {mission !== undefined && status && (
                    <>
                        <div class="mission-status" aria-live="polite">{STATUS_LABEL[status]}</div>
                        {guided ? (
                            <MissionChallenge key={mission} mission={mission} status={status} onUpdated={setData}
                                onOpen={() => setSelected(mission)}
                                onTasksSaved={onTasksSaved} />
                        ) : <MissionPractice key={mission} mission={mission} />}
                        {!readOnly && !guided && (
                            <button class="mission-action" type="button" disabled={busy}
                                onClick={() => {
                                    void run(`/api/self/topics/${mission}/cycle`);
                                    setSelected(mission);
                                }}>
                                {STATUS_ACTION[status]} <NavIcon name="arrow-right" />
                            </button>
                        )}
                    </>
                )}
                {next !== undefined && mission !== next && (
                    <button class="chip" type="button" onClick={() => setSelected(null)}>К следующей миссии</button>
                )}
                {note?.path.startsWith('/api/self/topics/') && <p class="warn" role="alert">{note.message}</p>}
            </Card>

            {data.rank && <RankPanel rank={data.rank} />}

            <div class="mission-map-tools between">
                <div class="mission-legend" aria-label="Обозначения">
                    <span class="learning">В работе</span><span class="done">Изучено</span><span class="reinforced">Закреплено</span>
                </div>
                <button type="button" class="chip" aria-pressed={!studyOrder} onClick={() => setStudyOrder((current) => !current)}>
                    {studyOrder ? 'По номерам' : 'По маршруту'}
                </button>
            </div>

            {sectors.map(({ name, rank, missions }) => {
                const count = missions.filter((number) => data.topics[number - 1] === 'reinforced').length;
                return <Card class={`mission-sector${count === missions.length ? ' mission-sector-complete' : ''}`} key={name}>
                    <div class="between">
                        <div>
                            <h2><NavIcon name={count === missions.length ? 'check' : 'crystal'} /> {name}</h2>
                            {rank && <span class="mission-sector-rank">Ступень «{rank}»</span>}
                        </div>
                        <span>{count}/{missions.length}</span>
                    </div>
                    <div class="grid">
                        {missions.map((number) => {
                            const state = data.topics[number - 1];
                            return (
                                <button key={number} type="button" class={`cell ${state}`}
                                    aria-label={`Задание ${number}. ${STATUS_LABEL[state]}`}
                                    aria-pressed={number === mission}
                                    onClick={() => {
                                        setSelected(number);
                                        selection.current?.focus();
                                    }}>
                                    <b>{number}</b>
                                    {state === 'reinforced' && <NavIcon name="check" />}
                                </button>
                            );
                        })}
                    </div>
                </Card>;
            })}

            <Card class="mission-log">
                <h2 class="label" ref={logHeading} tabIndex={-1}>Журнал решённых задач</h2>
                <div class="amounts">
                    {AMOUNTS.map((n) => (
                        <button key={n} type="button" class="chip" disabled={readOnly || busy}
                            aria-label={`${n > 0 ? 'Добавить' : 'Вычесть'} ${Math.abs(n)}`}
                            onClick={() => run('/api/self/tasks', { amount: n }, n > 0 ? onTasksSaved : undefined)}>
                            {n > 0 ? `+${n}` : n}
                        </button>
                    ))}
                </div>
                {data.limits.week > 0 && (
                    <div class="tasks-week">
                        <div class="between"><span>Миссия недели</span><strong>{data.tasksWeek}/{data.limits.week}</strong></div>
                        <SegmentBar value={data.tasksWeek} max={data.limits.week} tone="good" />
                    </div>
                )}
                {note?.path === '/api/self/tasks' && <p class="warn" role="alert">{note.message}</p>}
            </Card>

            <ExamCard error={note?.path === '/api/self/exam' ? note.message : undefined} exam={data.exam} max={data.limits.exam} busy={busy} readOnly={readOnly} onSave={(v) => run('/api/self/exam', { value: v })} />
        </Screen>
    );
}

function ExamCard({ error, exam, max, busy, readOnly, onSave }: {
    error?: string;
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
                    aria-label="Балл пробника"
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
            {error && <p class="warn" role="alert">{error}</p>}
        </Card>
    );
}
