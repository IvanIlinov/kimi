import { useState } from 'preact/hooks';
import { api } from '../api/client';
import type { AdminHome, AdminMember, Lesson, LessonStatus } from '../api/types';
import { useApi } from '../api/useApi';
import { Card, Empty, Label, Loading, Screen, SegmentBar } from '../components/ui';
import { cap } from '../lib/format';

const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const STATUS_LABELS: Record<LessonStatus, string> = {
    planned: 'Ещё не проведено',
    held: 'Проведено',
    paid: 'Оплачено',
};

export function AdminHomePage({ onPreview, onGuestPreview }: {
    onPreview: (id: number) => void;
    onGuestPreview: () => void;
}) {
    const { data, error, reload } = useApi<AdminHome>('/api/admin/home');
    const [choosingStudent, setChoosingStudent] = useState(false);
    const [editing, setEditing] = useState(false);
    const [lesson, setLesson] = useState<Partial<Lesson> | null>(null);

    return (
        <Screen hideTitle title="Главная" className="layout-admin-home">
            <Card class="admin-preview-actions">
                <Label>Предпросмотр</Label>
                <div class="chips">
                    <button class="chip" onClick={onGuestPreview}>Как гость</button>
                    <button class="chip" aria-expanded={choosingStudent}
                        onClick={() => setChoosingStudent(!choosingStudent)}>Как ученик</button>
                </div>
            </Card>
            {choosingStudent ? <StudentPicker onPreview={onPreview} /> : (
                <>
                    {error && <Empty text={error} />}
                    {!data && !error && <Loading />}
                    {data && (
                        <>
                            <Card class="admin-attendance">
                                <Label>Посещаемость за неделю</Label>
                                <div class="between"><span>Запусков бота</span><b>{data.attendance.visits}</b></div>
                                <SegmentBar value={data.attendance.visits} max={data.attendance.participants} tone="good" />
                                <small class="muted">Ориентир — один запуск на участника</small>
                                <div class="between"><span>Ученики, которые заходили</span>
                                    <b>{data.attendance.visitors} / {data.attendance.participants}</b>
                                </div>
                                <SegmentBar value={data.attendance.visitors} max={data.attendance.participants} tone="good" />
                            </Card>
                            <Card class="admin-schedule">
                                <div class="between">
                                    <Label>Расписание недели · МСК</Label>
                                    <button class="chip" aria-pressed={editing}
                                        onClick={() => setEditing(!editing)}>{editing ? 'Готово' : 'Изменить'}</button>
                                </div>
                                <div class="admin-schedule-list">
                                    <div class="admin-calendar">
                                        {DAYS.map((day, weekday) => {
                                            const lessons = data.lessons.filter((item) => item.weekday === weekday);
                                            return (
                                                <div class="admin-schedule-day" key={day}>
                                                    <h3>{day}</h3>
                                                    {lessons.length === 0 && <span class="muted admin-calendar-empty" aria-label="Нет занятий">—</span>}
                                                    {lessons.map((item) => {
                                                        const content = (
                                                            <>
                                                                <time dateTime={item.time}>{item.time}</time>
                                                                <b>{item.name}</b>
                                                                <span class="visually-hidden">{STATUS_LABELS[item.status]}</span>
                                                            </>
                                                        );
                                                        return editing ? (
                                                            <button type="button" class={`admin-lesson ${item.status}`} key={item.id}
                                                                onClick={() => setLesson(item)}
                                                                aria-label={`Изменить занятие: ${item.name}, ${day} ${item.time}, ${STATUS_LABELS[item.status]}`}>
                                                                {content}
                                                            </button>
                                                        ) : (
                                                            <div class={`admin-lesson ${item.status}`} key={item.id}>{content}</div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                {editing && <button class="chip primary" onClick={() => setLesson({})}>Добавить занятие</button>}
                            </Card>
                        </>
                    )}
                </>
            )}
            {data && lesson && (
                <LessonEditor lesson={lesson} weekStart={data.weekStart} onClose={() => setLesson(null)}
                    onSaved={() => { setLesson(null); reload(); }} />
            )}
        </Screen>
    );
}

function StudentPicker({ onPreview }: { onPreview: (id: number) => void }) {
    const { data, error } = useApi<AdminMember[]>('/api/admin/members');
    const active = data?.filter((member) => !member.removed);
    return (
        <Card class="admin-schedule">
            <Label>Выберите ученика</Label>
            {error && <Empty text={error} />}
            {!data && !error && <Loading />}
            {active?.length === 0 && <Empty text="Нет активных участников" />}
            <div class="admin-list admin-schedule-list">
                {active?.map((member) => (
                    <button key={member.id} class="admin-member" onClick={() => onPreview(member.id)}>
                        <b>{cap(member.name)}</b>
                        <span aria-hidden="true">›</span>
                    </button>
                ))}
            </div>
        </Card>
    );
}

function LessonEditor({ lesson, weekStart, onClose, onSaved }: {
    lesson: Partial<Lesson>;
    weekStart: number;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [weekday, setWeekday] = useState(lesson.weekday ?? 0);
    const [time, setTime] = useState(lesson.time ?? '16:30');
    const [name, setName] = useState(lesson.name ?? '');
    const [status, setStatus] = useState<LessonStatus>(lesson.status ?? 'planned');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    async function submit(path: string, body?: unknown) {
        if (busy) return;
        setBusy(true);
        setError('');
        try {
            await api(path, { method: 'POST', body });
            onSaved();
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div class="modal-backdrop" onClick={() => !busy && onClose()}>
            <div class="modal-dialog" role="dialog" aria-modal="true" aria-label="Занятие"
                onClick={(e) => e.stopPropagation()}>
                <Card>
                    <form class="lesson-form" onSubmit={(e) => {
                        e.preventDefault();
                        void submit('/api/admin/lessons', { id: lesson.id, weekStart, weekday, time, name, status });
                    }}>
                        <div class="between">
                            <Label>{lesson.id ? 'Изменить занятие' : 'Добавить занятие'}</Label>
                            <button type="button" class="chip modal-close" onClick={onClose} disabled={busy} aria-label="Закрыть">✕</button>
                        </div>
                        <label>День
                            <select value={weekday} onChange={(e) => setWeekday(Number(e.currentTarget.value))}>
                                {DAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}
                            </select>
                        </label>
                        <label>Время по Москве
                            <input type="time" required value={time} onInput={(e) => setTime(e.currentTarget.value)} />
                        </label>
                        <label>Имя ученика
                            <input required maxLength={80} value={name} onInput={(e) => setName(e.currentTarget.value)} />
                        </label>
                        <label>Статус
                            <select value={status} onChange={(e) => setStatus(e.currentTarget.value as LessonStatus)}>
                                {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                            </select>
                        </label>
                        {error && <p class="warn" role="alert">{error}</p>}
                        <div class="chips">
                            <button class="chip primary" disabled={busy || !name.trim()}>Сохранить</button>
                            {lesson.id && <button type="button" class="chip danger" disabled={busy}
                                onClick={() => {
                                    if (window.confirm('Удалить это занятие из расписания?')) {
                                        void submit(`/api/admin/lessons/${lesson.id}/remove`);
                                    }
                                }}>Удалить</button>}
                        </div>
                    </form>
                </Card>
            </div>
        </div>
    );
}
