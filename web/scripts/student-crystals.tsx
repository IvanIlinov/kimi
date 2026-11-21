import { useEffect, useRef, useState } from 'preact/hooks';
import { CrystalMesh } from './crystal-mesh';
import './student-crystals.css';

const questions = [
    { text: 'Сколько бит нужно для кодирования одного символа из алфавита из 33 знаков?', answer: 6 },
    { text: 'Сколько единиц в двоичной записи числа 13?', answer: 3 },
    { text: 'Алгоритм трижды удваивает число 5. Какое число получится?', answer: 40 },
];
const openedPortals = new Set<string>();
const DAY = 86_400_000;
const MOSCOW_OFFSET = 3 * 3_600_000;

function hasOpenedPortal(key: string) {
    try { return openedPortals.has(key) || localStorage.getItem(key) === '1'; }
    catch { return openedPortals.has(key); }
}

function rememberPortal(key: string) {
    openedPortals.add(key);
    try { localStorage.setItem(key, '1'); }
    catch { /* The in-memory record still covers navigation in this demo. */ }
}

export function StudentCrystals({ week }: { week: { tasks: number; goal: number } }) {
    const [star, setStar] = useState(false);
    const exam = useRef<HTMLDialogElement>(null);
    const moscow = new Date(Date.now() + MOSCOW_OFFSET);
    const days = new Date(Date.UTC(moscow.getUTCFullYear(), moscow.getUTCMonth() + 1, 0)).getUTCDate();
    const preview = new URLSearchParams(location.search);
    const timeline = document.body.dataset.studentLayout === 'crystal-timeline';
    const previewDay = Number(preview.get('portalDay'));
    const forced = preview.get('portal') === '1';
    const simulated = timeline || forced || (Number.isInteger(previewDay) && previewDay >= 1 && previewDay <= days);
    const [day, setDay] = useState(() => timeline ? 1 : forced ? days - 6
        : Number.isInteger(previewDay) && previewDay >= 1 && previewDay <= days ? previewDay : moscow.getUTCDate());
    const portal = day >= days - 6;
    const mesh = preview.get('crystal') === 'mesh';
    const monthKey = `arena-demo-portal:${moscow.getUTCFullYear()}-${moscow.getUTCMonth() + 1}${forced || previewDay ? ':preview' : ''}`;
    const [opening, setOpening] = useState(() => !timeline && portal && !hasOpenedPortal(monthKey));
    const charge = portal ? 1 : (day - 1) / (days - 7);
    const closeAt = Date.UTC(moscow.getUTCFullYear(), moscow.getUTCMonth() + 1, 1) - MOSCOW_OFFSET
        - (simulated ? (day - moscow.getUTCDate()) * DAY : 0);

    useEffect(() => {
        if (!portal || !opening) return;
        if (!timeline) rememberPortal(monthKey);
        const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
        const timer = window.setTimeout(() => setOpening(false), reduced ? 0 : 2250);
        return () => window.clearTimeout(timer);
    }, [portal, opening, monthKey, timeline]);

    function showDay(nextDay: number) {
        if (nextDay < 1 || nextDay > days) return;
        if (nextDay < days - 6) setOpening(false);
        else if (day < days - 6) setOpening(true);
        setDay(nextDay);
    }

    return (
        <section class="tablet-crystals" aria-label="Кристаллы календаря">
            <div class="tablet-crystal-card" data-tone="aqua">
                <Crystal tone="aqua" fill={week.tasks / week.goal} mesh={mesh} />
                <strong>Неделя</strong>
                <small>{week.tasks}/{week.goal} задач</small>
            </div>
            <button type="button" class="tablet-crystal-card" data-tone="gold" disabled={star}
                onClick={() => setStar(true)}>
                <Crystal tone="gold" fill={star ? 1 : 0.24} mesh={mesh} />
                <strong>Звезда дня</strong>
                <small aria-live="polite">{star ? 'Получено' : 'Доступно'}</small>
            </button>
            <button type="button" class="tablet-crystal-card" data-tone="violet" disabled={!portal || opening}
                aria-haspopup={portal ? 'dialog' : undefined} onClick={() => exam.current?.showModal()}>
                <span class="tablet-portal-scene" data-opening={opening} aria-hidden="true">
                    {portal && <span class="tablet-crystal tablet-portal-visual"><span class="tablet-portal-depth" /></span>}
                    {(!portal || opening) && <span class="tablet-shell">
                        <Crystal tone="violet" fill={charge} mesh={mesh && !opening} />
                    </span>}
                    {opening && <span class="tablet-portal-seed" />}
                </span>
                <strong>Пробник</strong>
                {opening ? <small role="status">Открывается…</small> : portal ? (
                    <PortalCountdown deadline={closeAt} />
                ) : <small>Закрыто</small>}
            </button>
            <DemoExam dialog={exam} />
            {timeline && <div class="tablet-crystal-timeline">
                <label for="crystal-day">День месяца <strong>{day}/{days}</strong></label>
                <div class="tablet-crystal-timeline-controls">
                    <button class="chip" type="button" aria-label="Предыдущий день" disabled={day === 1}
                        onClick={() => showDay(day - 1)}>‹</button>
                    <input id="crystal-day" type="range" min={1} max={days} value={day}
                        onInput={(event) => showDay(Number(event.currentTarget.value))} />
                    <button class="chip" type="button" aria-label="Следующий день" disabled={day === days}
                        onClick={() => showDay(day + 1)}>›</button>
                </div>
                <button class="chip" type="button" onClick={() => showDay(days - 7)}>Накануне открытия</button>
            </div>}
        </section>
    );
}

function PortalCountdown({ deadline }: { deadline: number }) {
    const [now, setNow] = useState(Date.now);
    useEffect(() => {
        const interval = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(interval);
    }, []);
    const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor(seconds / 3600) % 24;
    const minutes = Math.floor(seconds / 60) % 60;
    const clock = [hours, minutes, seconds % 60].map((part) => String(part).padStart(2, '0')).join(':');
    const value = days > 0 ? `${days} дн ${clock}` : clock;
    return <small class="tablet-portal-countdown" role="timer" aria-label={`До закрытия пробника ${value}`}>{value}</small>;
}

function Crystal({ fill, tone, mesh }: { fill: number; tone: string; mesh: boolean }) {
    const charge = Math.min(1, Math.max(0, fill));
    return (
        <span class="tablet-crystal" aria-hidden="true">
            <span class="tablet-crystal-aura" />
            {mesh ? <CrystalMesh fill={fill} tone={tone} />
                : <span class="tablet-crystal-art" style={{ '--charge': `${charge * 100}%`, '--energy': charge }} />}
        </span>
    );
}

function DemoExam({ dialog }: { dialog: { current: HTMLDialogElement | null } }) {
    const [index, setIndex] = useState(0);
    const [value, setValue] = useState('');
    const [score, setScore] = useState(0);
    const task = questions[index];

    return (
        <dialog class="challenge-dialog" ref={dialog} aria-labelledby="tablet-exam-title">
            <div class="challenge-content">
                <header>
                    <span class="student-brand">Портал месяца</span>
                    <h2 id="tablet-exam-title">Демо-пробник</h2>
                    <form method="dialog"><button class="challenge-close" aria-label="Закрыть" autofocus>×</button></form>
                </header>
                {task ? <form class="tablet-exam-form" onSubmit={(event) => {
                    event.preventDefault();
                    if (!/^\d+$/.test(value.trim())) return;
                    if (Number(value) === task.answer) setScore(score + 1);
                    setValue('');
                    setIndex(index + 1);
                }}>
                    <p>Задание {index + 1} из {questions.length}</p>
                    <p>{task.text}</p>
                    <div class="exam">
                        <input aria-label="Ответ" inputMode="numeric" value={value} onInput={(event) => setValue(event.currentTarget.value)} />
                        <button class="chip primary" disabled={!/^\d+$/.test(value.trim())}>Ответить</button>
                    </div>
                </form> : <div class="tablet-exam-form">
                    <p role="status">Верных ответов: {score} из {questions.length}</p>
                    <button class="chip" type="button" onClick={() => { setIndex(0); setScore(0); }}>Пройти заново</button>
                </div>}
            </div>
        </dialog>
    );
}
