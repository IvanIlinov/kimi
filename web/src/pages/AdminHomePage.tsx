import { useState } from 'preact/hooks';
import { api } from '../api/client';
import type { AdminHome, Arena, Lesson, LessonStatus } from '../api/types';
import { useApi } from '../api/useApi';
import { cap } from '../lib/format';
import { SwipeCard } from '../components/SwipeCard';
import { Card, Empty, Label, Loading, MetricTile, Screen, SegmentBar } from '../components/ui';

const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const STATUS_LABELS: Record<LessonStatus, string> = {
    planned: 'Ещё не проведено',
    held: 'Проведено',
    paid: 'Оплачено',
};

const rubles = new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
});

const monthName = new Intl.DateTimeFormat('ru-RU', { month: 'long', timeZone: 'Europe/Moscow' });

export function AdminHomePage({ onPreview, onGuestPreview }: {
    onPreview: (id: number) => void;
    onGuestPreview: () => void;
}) {
    const { data, error, reload, setData } = useApi<AdminHome>('/api/admin/home');
    const [openingPreview, setOpeningPreview] = useState(false);
    const [previewError, setPreviewError] = useState('');
    const [editing, setEditing] = useState(false);
    const [lesson, setLesson] = useState<Partial<Lesson> | null>(null);
    const [cycling, setCycling] = useState(false);
    const [cycleError, setCycleError] = useState('');

    async function previewLeader() {
        if (openingPreview || !data?.previewEnabled) return;
        setOpeningPreview(true);
        setPreviewError('');
        try {
            const { rows } = await api<Arena>('/api/arena?mode=global');
            const leader = rows[0];
            if (leader) onPreview(leader.id);
            else setPreviewError('В рейтинге пока нет участников');
        } catch (e) {
            setPreviewError((e as Error).message);
        } finally {
            setOpeningPreview(false);
        }
    }

    async function cycleLesson(id: number) {
        if (!data || cycling) return;
        setCycling(true);
        setCycleError('');
        try {
            const { status } = await api<{ status: LessonStatus }>(`/api/admin/lessons/${id}/cycle`, { method: 'POST' });
            setData({ ...data, lessons: data.lessons.map((item) => item.id === id ? { ...item, status } : item) });
            reload();
        } catch (e) {
            setCycleError((e as Error).message);
        } finally {
            setCycling(false);
        }
    }

    const held = data?.lessons.filter((item) => item.status !== 'planned').length ?? 0;
    const earned = data?.lessons.reduce((sum, item) => sum + (item.status === 'paid' ? item.priceKopecks : 0), 0) ?? 0;

    return (
        <Screen hideTitle title="Главная" className="layout-admin-home">
            {data?.previewEnabled && (
                <Card class="admin-preview-actions">
                    <Label>Предпросмотр</Label>
                    <div class="chips">
                        <button class="chip" disabled={openingPreview} onClick={onGuestPreview}>Как гость</button>
                        <button class="chip" disabled={openingPreview} onClick={previewLeader}>Как ученик</button>
                    </div>
                    {previewError && <p class="warn" role="alert">{previewError}</p>}
                </Card>
            )}
            {error && <Empty text={error} />}
            {!data && !error && <Loading />}
            {data && (
                <>
                    <SwipeCard label="Статистика занятий и посещаемость"
                        first={
                            <>
                                <h2 class="admin-lesson-month">{cap(monthName.format(data.month.start))}</h2>
                                <div class="metric-tiles admin-lesson-metrics">
                                    <MetricTile icon="calendar-days" label="Всего занятий" value={data.lessons.length} />
                                    <MetricTile icon="clipboard-list" label="Проведено" value={held} />
                                    <MetricTile icon="wallet" label="За неделю" value={rubles.format(earned / 100)} />
                                    <MetricTile icon="wallet" label="За месяц" value={rubles.format(data.month.earnedKopecks / 100)} />
                                </div>
                            </>
                        }
                        second={
                            <div class="admin-attendance">
                                <Label>Посещаемость за неделю</Label>
                                <div class="between"><span>Запусков бота</span><b>{data.attendance.visits}</b></div>
                                <SegmentBar value={data.attendance.visits} max={data.attendance.participants} tone="good" />
                                <div class="between"><span>Ученики, которые заходили</span>
                                    <b>{data.attendance.visitors} / {data.attendance.participants}</b>
                                </div>
                                <SegmentBar value={data.attendance.visitors} max={data.attendance.participants} tone="good" />
                            </div>
                        }
                    />
                    <Card class="admin-schedule">
                        <div class="between">
                            <Label>Расписание недели · МСК</Label>
                            <button class="chip" aria-pressed={editing} disabled={cycling}
                                onClick={() => setEditing(!editing)}>{editing ? 'Готово' : 'Изменить'}</button>
                        </div>
                        {cycleError && <p class="warn" role="alert">{cycleError}</p>}
                        <div class="admin-schedule-list">
                            <div class="admin-calendar">
                                {DAYS.map((day, weekday) => {
                                    const lessons = data.lessons.filter((item) => item.weekday === weekday);
                                    return (
                                        <div class="admin-schedule-day" key={day}>
                                            <h3>{day}</h3>
                                            {lessons.length === 0 && <span class="muted admin-calendar-empty" aria-label="Нет занятий">—</span>}
                                            {lessons.map((item) => (
                                                <button type="button" class={`admin-lesson ${item.status}`} key={item.id}
                                                    disabled={cycling}
                                                    onClick={() => editing ? setLesson(item) : void cycleLesson(item.id)}
                                                    aria-label={`${editing ? 'Изменить занятие' : 'Сменить статус'}: ${item.name}, ${day} ${item.time}, ${STATUS_LABELS[item.status]}`}>
                                                    <time dateTime={item.time}>{item.time}</time>
                                                    <b>{item.name}</b>
                                                </button>
                                            ))}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        {editing && <button class="chip primary" onClick={() => setLesson({})}>Добавить занятие</button>}
                    </Card>
                </>
            )}
            {data && lesson && (
                <LessonEditor lesson={lesson} weekStart={data.weekStart} onClose={() => setLesson(null)}
                    onSaved={() => { setLesson(null); reload(); }} />
            )}
        </Screen>
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
    const [price, setPrice] = useState(lesson.priceKopecks ? String(lesson.priceKopecks / 100).replace('.', ',') : '');
    const [whole, fraction = ''] = price.split(/[.,]/);
    const priceKopecks = Number(whole + fraction.padEnd(2, '0'));
    const validPrice = /^\d*(?:[.,]\d{1,2})?$/.test(price) && Number.isSafeInteger(priceKopecks);
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
                    <form class="modal-form" onSubmit={(e) => {
                        e.preventDefault();
                        if (validPrice) void submit('/api/admin/lessons', { id: lesson.id, weekStart, weekday, time, name, status, priceKopecks });
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
                        <label>Стоимость урока, ₽
                            <input inputMode="decimal" value={price} placeholder="0" aria-invalid={!validPrice}
                                onInput={(e) => setPrice(e.currentTarget.value)} />
                        </label>
                        {!validPrice && <p class="warn">Укажите сумму в рублях, до двух знаков после запятой</p>}
                        <label>Статус
                            <select value={status} onChange={(e) => setStatus(e.currentTarget.value as LessonStatus)}>
                                {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                            </select>
                        </label>
                        {error && <p class="warn" role="alert">{error}</p>}
                        <div class="chips">
                            <button class="chip primary" disabled={busy || !name.trim() || !validPrice}>Сохранить</button>
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
