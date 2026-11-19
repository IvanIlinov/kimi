import { useEffect, useState } from 'preact/hooks';
import { api } from '../api/client';
import type { HistoryDay } from '../api/types';
import { Card, Empty, Loading, Screen } from '../components/ui';
import { cap, sgn } from '../lib/format';

const PAGE_SIZE = 14;
const DAY_MS = 86_400_000;
const MOSCOW_OFFSET_MS = 3 * 3_600_000;
const shortDate = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });

function dayLabel(day: number, today: number): string {
    if (day === today) return 'Сегодня';
    if (day === today - 1) return 'Вчера';
    return shortDate.format(day * DAY_MS);
}

export function HistoryPage() {
    const [days, setDays] = useState<HistoryDay[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [hasMore, setHasMore] = useState(false);
    const today = Math.floor((Date.now() + MOSCOW_OFFSET_MS) / DAY_MS);

    async function load(offset: number) {
        setLoading(true);
        setError('');
        try {
            const page = await api<{ days: HistoryDay[]; hasMore: boolean }>(`/api/admin/history?limit=${PAGE_SIZE}&offset=${offset}`);
            setDays((old) => offset === 0 ? page.days : [...old, ...page.days]);
            setHasMore(page.hasMore);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void load(0);
    }, []);

    return (
        <Screen hideTitle title="История" className="layout-history">
            <Card class="history-days">
                {error && <p class="warn" role="alert">{error}</p>}
                {days.length === 0 && !loading && !error && <Empty text="Изменений пока нет" />}
                {days.map(({ day, rows }) => (
                    <section key={day} class="history-day">
                        <h2>{dayLabel(day, today)}</h2>
                        {rows.map((row) => {
                            const examBefore = row.examBefore ?? 0;
                            const exam = row.examAfter ?? 0;
                            const change = exam - examBefore;
                            const examTone = change > 0 ? ' improved' : change < 0 ? ' declined' : '';
                            const examStatus = change > 0 ? 'балл вырос' : change < 0 ? 'балл снизился' : 'балл без изменений';
                            return (
                                <div class="history-row between" key={row.id}>
                                    <strong>{cap(row.name)}</strong>
                                    <span class="stats">
                                        <b aria-label={`Прогресс: ${sgn(row.pct)}%`}>{sgn(row.pct)}%</b>
                                        <b aria-label={`Задачи: ${sgn(row.tasks)}`}>{sgn(row.tasks)}</b>
                                        <b aria-label={`Закреплённые задания: ${sgn(row.topics)}`}>{sgn(row.topics)}</b>
                                        <b class={`history-exam${examTone}`} aria-label={`Пробник: ${exam}, ${examStatus}`}>{exam}</b>
                                    </span>
                                </div>
                            );
                        })}
                    </section>
                ))}
                {loading && <Loading />}
                {!loading && (hasMore || error) && (
                    <button class="chip" onClick={() => void load(days.length)}>
                        {error ? 'Повторить' : 'Загрузить ещё'}
                    </button>
                )}
            </Card>
        </Screen>
    );
}
