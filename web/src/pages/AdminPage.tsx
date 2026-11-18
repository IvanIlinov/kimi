import { useEffect, useState } from 'preact/hooks';
import { api } from '../api/client';
import { useApi } from '../api/useApi';
import type { AdminMember, AdminJournalEntry, TopicStatus } from '../api/types';
import { Card, Empty, Label, Loading, Screen } from '../components/ui';
import { haptic } from '../lib/telegram';

const STATUS: Record<TopicStatus, { icon: string; next: TopicStatus }> = {
    done: { icon: '🟢', next: 'learning' },
    learning: { icon: '🟡', next: 'todo' },
    todo: { icon: '🔴', next: 'done' },
};

const STATUS_NAME: Record<TopicStatus, string> = {
    done: 'Готово',
    learning: 'Изучает',
    todo: 'Не начато',
};

type Section = 'members' | 'journal' | 'preview';

export function AdminPage({ section, onPreview }: {
    section: Section;
    onPreview?: (id: number, name: string) => void;
}) {
    if (section === 'journal') return <JournalPage />;
    if (section === 'preview') return <PreviewPage onPreview={onPreview!} />;
    return <MembersAdminPage />;
}

function PreviewPage({ onPreview }: {
    onPreview: (id: number, name: string) => void;
}) {
    const { data, error } = useApi<AdminMember[]>('/api/admin/members');

    if (error) return <Screen title="Предпросмотр"><Empty text={error} /></Screen>;
    if (!data) return <Screen title="Предпросмотр"><Loading /></Screen>;

    const active = data.filter((member) => !member.removed);

    return (
        <Screen title="Предпросмотр ученика">
            <Card>
                <Label>Как видит Арену ученик</Label>
                <p class="muted">Выберите участника. Откроется весь интерфейс с его данными, без возможности что-либо изменить.</p>
            </Card>
            <Card>
                <Label>Активные участники · {active.length}</Label>
                {active.length === 0 && <Empty text="Нет активных участников" />}
                <div class="admin-list">
                    {active.map((member) => (
                        <button
                            key={member.id}
                            class="admin-member"
                            onClick={() => onPreview(member.id, member.name)}
                        >
                            <span>
                                <b>{member.name}</b>
                                <small>{member.tasksTotal} задач · пробник: {member.exam ?? '—'}</small>
                            </span>
                            <span class="muted">Открыть ›</span>
                        </button>
                    ))}
                </div>
            </Card>
        </Screen>
    );
}

function MembersAdminPage() {
    const { data, error, reload } = useApi<AdminMember[]>('/api/admin/members');
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [tgId, setTgId] = useState('');
    const [newName, setNewName] = useState('');
    const [busy, setBusy] = useState(false);
    const [note, setNote] = useState('');

    async function run(path: string, body?: unknown): Promise<boolean> {
        if (busy) return false;
        setBusy(true);
        setNote('');
        try {
            await api(path, { method: 'POST', body });
            reload();
            haptic.ok();
            return true;
        } catch (e) {
            setNote((e as Error).message);
            haptic.error();
            return false;
        } finally {
            setBusy(false);
        }
    }

    if (error) return <Screen title="Участники"><Empty text={error} /></Screen>;
    if (!data) return <Screen title="Участники"><Loading /></Screen>;

    const selected = data.find((m) => m.id === selectedId) ?? null;
    const active = data.filter((m) => !m.removed);
    const removed = data.filter((m) => m.removed);

    return (
        <Screen title="Участники">
            <Card>
                <div class="between">
                    <Label>Добавить участника</Label>
                    <span class="muted">{active.length} активных</span>
                </div>
                <input
                    class="admin-input"
                    value={tgId}
                    onInput={(e) => setTgId((e.target as HTMLInputElement).value)}
                    placeholder="Telegram ID"
                    inputMode="numeric"
                    type="number"
                />
                <input
                    class="admin-input"
                    value={newName}
                    onInput={(e) => setNewName((e.target as HTMLInputElement).value)}
                    placeholder="Имя участника"
                />
                <button
                    class="chip primary"
                    disabled={busy || !tgId.trim() || !newName.trim() || !Number.isSafeInteger(Number(tgId)) || Number(tgId) <= 0}
                    onClick={async () => {
                        const success = await run('/api/admin/members', { tgId: Number(tgId), name: newName });
                        if (success) {
                            setTgId('');
                            setNewName('');
                        }
                    }}
                >
                    Добавить
                </button>
                {note && <p class="warn">{note}</p>}
            </Card>

            <Card>
                <Label>Активные участники · {active.length}</Label>
                {active.length === 0 && <Empty text="Пока нет участников" />}
                <div class="admin-list">
                    {active.map((m) => (
                        <button
                            key={m.id}
                            class={selectedId === m.id ? 'admin-member selected' : 'admin-member'}
                            onClick={() => setSelectedId(m.id)}
                        >
                            <span>
                                <b>{m.name}</b>
                                <small>{m.tasksTotal} задач · пробник: {m.exam ?? '—'}</small>
                            </span>
                            <span class="muted">›</span>
                        </button>
                    ))}
                </div>
            </Card>

            {removed.length > 0 && (
                <Card>
                    <Label>Удалённые · {removed.length}</Label>
                    <div class="admin-list">
                        {removed.map((m) => (
                            <button
                                key={m.id}
                                class={selectedId === m.id ? 'admin-member selected' : 'admin-member'}
                                onClick={() => setSelectedId(m.id)}
                            >
                                <span>
                                    <b>{m.name}</b>
                                    <small>Telegram ID: {m.tgId}</small>
                                </span>
                                <span class="muted">›</span>
                            </button>
                        ))}
                    </div>
                </Card>
            )}

            {selected && (
                <MemberEditor
                    key={selected.id}
                    member={selected}
                    busy={busy}
                    run={run}
                />
            )}
        </Screen>
    );
}

function MemberEditor({ member, busy, run }: {
    member: AdminMember;
    busy: boolean;
    run: (path: string, body?: unknown) => Promise<boolean>;
}) {
    const [name, setName] = useState(member.name);
    const [tasks, setTasks] = useState(String(member.tasksTotal));
    const [exam, setExam] = useState(member.exam === null ? '' : String(member.exam));
    const examUnchanged = exam === ''
        ? member.exam === null
        : /^\d+$/.test(exam) && Number(exam) === member.exam;

    const base = `/api/admin/members/${member.id}`;

    return (
        <Card>
            <div class="between">
                <Label>Карточка участника</Label>
                <span class="muted">ID: {member.id}</span>
            </div>
            <p class="muted">Telegram ID: {member.tgId}</p>

            <Label>Имя</Label>
            {member.removed ? (
                <p>{member.name}</p>
            ) : (
                <div class="exam">
                    <input class="admin-input" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
                    <button class="chip" disabled={busy || !name.trim() || name.trim() === member.name}
                        onClick={() => run(`${base}/rename`, { name })}>Сохранить</button>
                </div>
            )}

            {!member.removed && (
                <>
                    <Label>Всего решено задач</Label>
                    <div class="exam">
                        <input class="admin-input" type="number" min="0" step="1" value={tasks}
                            onInput={(e) => setTasks((e.target as HTMLInputElement).value)} />
                        <button class="chip" disabled={busy || !/^\d+$/.test(tasks) || Number(tasks) === member.tasksTotal}
                            onClick={() => run(`${base}/tasks`, { total: Number(tasks) })}>Сохранить</button>
                    </div>

                    <Label>Балл пробника (0–100)</Label>
                    <div class="exam">
                        <input class="admin-input" type="number" min="0" max="100" step="1"
                            placeholder="Не указан" value={exam}
                            onInput={(e) => setExam((e.target as HTMLInputElement).value)} />
                        <button class="chip" disabled={busy || examUnchanged || (exam !== '' && (!/^\d+$/.test(exam) || Number(exam) > 100))}
                            onClick={() => run(`${base}/exam`, { value: exam === '' ? null : Number(exam) })}>
                            Сохранить
                        </button>
                    </div>

                    <Label>Статусы заданий</Label>
                    <div class="grid">
                        {member.topics.map((status, i) => (
                            <button
                                key={i}
                                class={`cell ${status}`}
                                disabled={busy}
                                title={STATUS_NAME[status]}
                                onClick={() => run(`${base}/topics/${i + 1}`, { status: STATUS[status].next })}
                            >
                                <span>{STATUS[status].icon}</span>
                                <b>{i + 1}</b>
                            </button>
                        ))}
                    </div>
                    <p class="muted">Нажмите на задание, чтобы переключить его статус.</p>
                </>
            )}

            <div class="chips">
                {member.removed ? (
                    <button class="chip primary" disabled={busy} onClick={() => run(`${base}/restore`)}>
                        Восстановить
                    </button>
                ) : (
                    <button class="chip danger" disabled={busy} onClick={() => run(`${base}/remove`)}>
                        Удалить участника
                    </button>
                )}
            </div>
        </Card>
    );
}

function JournalPage() {
    const [offset, setOffset] = useState(0);
    const [entries, setEntries] = useState<AdminJournalEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [hasMore, setHasMore] = useState(false);

    async function load(nextOffset: number) {
        setLoading(true);
        setError('');
        try {
            const rows = await api<AdminJournalEntry[]>(`/api/admin/journal?limit=50&offset=${nextOffset}`);
            setEntries((old) => nextOffset === 0 ? rows : [...old, ...rows]);
            setOffset(nextOffset);
            setHasMore(rows.length === 50);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    }

    // Начальная загрузка журнала после первого рендера
    useEffect(() => {
        void load(0);
    }, []);

    return (
        <Screen title="Журнал">
            <Card>
                <Label>История изменений</Label>
                {error && <p class="warn">{error}</p>}
                {entries.length === 0 && loading && <Loading />}
                {entries.length === 0 && !loading && <Empty text="Записей пока нет" />}
                <div class="admin-journal">
                    {entries.map((entry) => (
                        <article class="journal-entry" key={`${entry.kind}-${entry.id}`}>
                            <div class="between">
                                <b>{entry.targetName}</b>
                                <span class="muted">{new Date(entry.at).toLocaleString('ru-RU')}</span>
                            </div>
                            <p>{entry.details}</p>
                            <small class="muted">
                                {entry.kind} · {entry.actorTgId === null ? 'автор неизвестен' : entry.actorTgId === entry.targetTgId ? 'ученик' : 'администратор'} · {entry.actorTgId ?? '—'}
                            </small>
                        </article>
                    ))}
                </div>
                {loading && entries.length > 0 && <Loading />}
                {!loading && hasMore && (
                    <button class="chip" onClick={() => void load(offset + 50)}>Загрузить ещё</button>
                )}
            </Card>
        </Screen>
    );
}
