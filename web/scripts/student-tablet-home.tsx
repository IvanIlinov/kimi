import { useEffect, useRef, useState } from 'preact/hooks';
import { KING_CLASSES, RANK_REQUIREMENTS, RANK_ROUTE } from '../../src/ranks';
import { useApi } from '../src/api/useApi';
import type { ChallengeProgress, Profile, SelfData, StudyRank } from '../src/api/types';
import { CitadelCore } from '../src/components/CitadelCore';
import { NavIcon } from '../src/components/NavIcon';
import { RankEmblem, rankName } from '../src/components/RankPanel';
import { Card, Empty, Loading, Screen } from '../src/components/ui';
import { cap } from '../src/lib/format';
import { MissionChallenge } from '../src/pages/MissionChallenge';
import { StudentCrystals } from './student-crystals';
import { useStudentDialogViewport } from './student-dialog-viewport';
import { reviewQuestions } from './student-review-questions';
import './student-tablet-home.css';
import './student-tablet-variants.css';

const showMiniPath = false;

export function StudentTabletHome({ staging = false, autoOpenWeeklyRecap = false, onRecapsReady }: {
    staging?: boolean;
    autoOpenWeeklyRecap?: boolean;
    onRecapsReady?: () => void;
} = {}) {
    const { data, error, reload } = useApi<Profile>('/api/profile/me');
    const layout = document.body.dataset.studentLayout;
    const modernLayout = layout === 'hq-modern';
    const gameLayout = layout === 'hq-game' || modernLayout;
    const coreYear = data?.core?.year;
    useStudentDialogViewport(modernLayout);

    useEffect(() => {
        if (staging && autoOpenWeeklyRecap && coreYear !== undefined) onRecapsReady?.();
    }, [staging, autoOpenWeeklyRecap, coreYear, onRecapsReady]);

    return (
        <Screen title="Штаб" hideTitle className="student-home tablet-home">
            {error ? <Empty text={error} /> : !data ? <Loading /> : (
                <>
                    <Card class="student-summary tablet-identity">
                        <div class="tablet-player">
                            {modernLayout && <span class="tablet-plate-glint" aria-hidden="true" />}
                            <div class="tablet-avatar">
                                <span class="tablet-avatar-portrait" aria-hidden="true" />
                                {!modernLayout && data.rank && <span class="tablet-avatar-crest"><RankEmblem rank={data.rank.current} /></span>}
                                {!modernLayout && <span class="tablet-avatar-place" aria-label={`${data.place}-е место в рейтинге`}>{data.place}</span>}
                            </div>
                            <div class="tablet-player-status">
                                <h1>{cap(data.name)}</h1>
                                {modernLayout && <span class="tablet-standing-place">
                                    <NavIcon name="trophy" /> {data.place}-е место
                                </span>}
                                {!modernLayout && data.rank && <dl class="tablet-rank">
                                    <dt>Ранг</dt>
                                    <dd>{rankName(data.rank.current)}</dd>
                                </dl>}
                            </div>
                        </div>
                        {modernLayout ? data.rank && <RankGuide rank={data.rank} place={data.rankPlace} />
                            : data.core && <CitadelCore key={data.core.year} core={data.core} previous={data.previousCore} label="Скрижаль" />}
                    </Card>
                    {gameLayout && <StudentCrystals week={data.week} />}
                    <Card class="tablet-metrics">
                        <MetricRing tone="cyan" label="Готовность" value={data.pct} max={100} unit="%" />
                        <MetricRing tone="violet" label="Пробник" value={data.totals.exam ?? 0} max={100} />
                        <MetricRing tone="blue" label="Решено задач" value={data.totals.tasks} max={900} />
                        <MetricRing tone="mint" label="Закреплено" value={data.totals.topics} max={27} />
                    </Card>
                    <CurrentAssignment onProgress={reload} onTasksSaved={onRecapsReady}
                        preview={staging && !autoOpenWeeklyRecap} />
                    {!gameLayout && <StudentCrystals week={data.week} />}
                    <ReviewQueue staging={staging} />
                    {showMiniPath && <MiniPath />}
                </>
            )}
        </Screen>
    );
}

function RankGuide({ rank, place }: { rank: StudyRank; place?: number }) {
    const dialog = useRef<HTMLDialogElement>(null);
    const requirements = rank.next ? [
        { label: 'Задания', ...rank.next.topics },
        { label: 'Задачи', ...rank.next.tasks },
        { label: 'Пробник', ...rank.next.exam },
    ] : [];
    const rankFill = requirements.length
        ? requirements.reduce((sum, { value, goal }) => sum + Math.min(1, value / goal), 0) / requirements.length
        : 1;

    return (
        <>
            <span class="tablet-rank-watermark" aria-hidden="true">
                <span class="tablet-plate-glint" />
                <RankEmblem rank={rank.current} engraved />
            </span>
            <button type="button" class="tablet-profile-standing" aria-haspopup="dialog"
                aria-label={`Таблица рангов. Текущий ранг: ${rankName(rank.current)}`}
                aria-describedby={rank.next ? 'tablet-profile-rank-progress' : undefined}
                onClick={() => dialog.current?.showModal()}>
                <span class="tablet-plate-glint" aria-hidden="true" />
                <span class="tablet-standing-label">
                    <strong>{rankName(rank.current)}</strong>
                    {place !== undefined && <span class="tablet-standing-place" aria-label={`${place}-е место в ранге`}>
                        {place}-е место <NavIcon name="trophy" />
                    </span>}
                </span>
                <span class="tablet-standing-progress" aria-hidden="true" data-done={!rank.next}
                    style={{ '--rank-fill': `${rankFill * 100}%` }} />
            </button>
            {rank.next && <span hidden id="tablet-profile-rank-progress">
                До ранга «{rank.next.name}». {requirements.map(({ label, value, goal }) => `${label}: ${value} из ${goal}`).join('. ')}
            </span>}
            <dialog ref={dialog} class="tablet-rank-guide" aria-labelledby="tablet-rank-guide-title"
                onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
                <div class="tablet-rank-guide-content">
                    <header>
                        <h2 id="tablet-rank-guide-title">Ранги подготовки</h2>
                        <form method="dialog"><button type="submit" aria-label="Закрыть" class="challenge-close" autofocus>×</button></form>
                    </header>
                    <p class="tablet-rank-next">
                        {rank.next ? <>Следующий ранг <strong>{rank.next.name}</strong> · закреплено {rank.next.topics.value}/{rank.next.topics.goal}</>
                            : 'Все ранги пройдены'}
                    </p>
                    <table>
                        <thead><tr><th scope="col">Ранг</th><th scope="col">Задания</th><th scope="col">Задачи</th><th scope="col">Пробник</th></tr></thead>
                        <tbody>
                            {[{ level: 0, name: 'Пыль', missions: [], tasks: 0, exam: 0 }, ...RANK_REQUIREMENTS].map((entry) => {
                                const current = entry.level === rank.current.level;
                                return (
                                    <tr key={entry.level} aria-current={current ? 'step' : undefined}>
                                        <th scope="row">
                                            <span class="tablet-rank-guide-name"><RankEmblem rank={entry} /><span>{current ? rankName(rank.current) : entry.name}
                                                {current && <small>Текущий</small>}
                                            </span></span>
                                        </th>
                                        <td>{entry.missions.length}</td>
                                        <td>{entry.tasks || '—'}</td>
                                        <td>{entry.exam || '—'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <div class="tablet-king-classes" aria-label="Классы Короля по баллу пробника">
                        <strong>Класс Короля</strong>
                        {KING_CLASSES.map(({ label, min }, index) => {
                            const next = KING_CLASSES[index + 1];
                            const range = !next ? `${min}` : min ? `${min}–${next.min - 1}` : `<${next.min}`;
                            return <span key={label} data-active={rank.current.kingClass === label}><b>{label}</b> {range}</span>;
                        })}
                    </div>
                </div>
            </dialog>
        </>
    );
}

const initialLapses = [36, 18, 61, 22, 82, 74, 15, 52, 11, 68, 58, 87, 43, 31, 78, 27, 50, 84, 14, 67, 39, 71, 23, 90, 46, 76, 56];

function reviewStatus(lapse: number) {
    if (lapse >= 70) return { tone: 'amber', label: 'Пора повторить' };
    if (lapse >= 40) return { tone: 'blue', label: 'Скоро' };
    return { tone: 'mint', label: 'В памяти' };
}

function ReviewQueue({ staging }: { staging: boolean }) {
    const dialog = useRef<HTMLDialogElement>(null);
    const [selected, setSelected] = useState(4);
    const [lapses, setLapses] = useState(initialLapses);
    const [answer, setAnswer] = useState('');
    const [feedback, setFeedback] = useState('');
    const [solved, setSolved] = useState(false);
    const [topic, question, correctAnswer, hint] = reviewQuestions[selected];
    const selectedLapse = lapses[selected];

    return (
        <Card class="tablet-reviews">
            <div class="tablet-reviews-heading">
                <h2><NavIcon name="crystal" /> Повторение</h2>
                <span>{staging ? 'Демо · шкала забывания' : 'Шкала забывания'}</span>
            </div>
            <ul class="tablet-review-list" aria-label="Выбор задания для повторения">
                {lapses.map((lapse, index) => {
                    const mission = index + 1;
                    const { tone, label } = reviewStatus(lapse);
                    return (
                        <li key={mission}>
                            <button type="button" class="tablet-review-tile" data-tone={tone}
                                style={{ '--review-lapse': `${lapse}%` }}
                                aria-pressed={index === selected} aria-label={`Задание ${mission}. ${label}`}
                                onClick={() => setSelected(index)}>{mission}</button>
                        </li>
                    );
                })}
            </ul>
            <div class="mission-legend tablet-review-legend" aria-label="Цвета шкалы забывания">
                <span data-tone="mint">В памяти</span>
                <span data-tone="blue">Скоро</span>
                <span data-tone="amber">Пора повторить</span>
            </div>
            <div class="tablet-recall-row">
                <button type="button" class="tablet-recall" aria-haspopup="dialog"
                    data-tone={reviewStatus(selectedLapse).tone} style={{ '--review-lapse': `${selectedLapse}%` }} onClick={() => {
                        setAnswer('');
                        setFeedback('');
                        setSolved(false);
                        dialog.current?.showModal();
                    }}>Вспомнить</button>
            </div>
            <dialog ref={dialog} class="tablet-recall-dialog" aria-labelledby="tablet-recall-title">
                <header>
                    <h2 id="tablet-recall-title">Вспомнить задание {selected + 1}</h2>
                    <form method="dialog"><button type="submit" class="tablet-recall-close" aria-label="Закрыть" autofocus>×</button></form>
                </header>
                <p class="tablet-recall-topic">{topic}</p>
                <p>{question}</p>
                <form onSubmit={(event) => {
                    event.preventDefault();
                    if (answer.trim() && Number(answer) === correctAnswer) {
                        setLapses((previous) => previous.map((value, index) => index === selected ? 0 : value));
                        setSolved(true);
                        setFeedback('Верно! Задание снова в памяти.');
                        event.currentTarget.querySelector('input')?.blur();
                    } else {
                        setFeedback(hint);
                    }
                }}>
                    <label for="tablet-recall-answer">Ответ</label>
                    <input id="tablet-recall-answer" inputMode="numeric" required value={answer} readOnly={solved}
                        onInput={(event) => setAnswer(event.currentTarget.value)} />
                    <button type="submit" class="tablet-recall" disabled={solved}>Проверить</button>
                </form>
                <p role="status">{feedback}</p>
            </dialog>
        </Card>
    );
}

function MiniPath() {
    return (
        <Card class="tablet-path">
            <h2>Карта пути</h2>
            <ol>
                <li data-step="done"><span>Освоено</span><strong>Задание 8</strong></li>
                <li aria-current="step"><span>Сейчас</span><strong>Задание 11</strong></li>
                <li><span>Дальше</span><strong>Задание 12</strong></li>
            </ol>
        </Card>
    );
}

function CurrentAssignment({ onProgress, onTasksSaved, preview }: {
    onProgress: () => void;
    onTasksSaved?: () => void;
    preview: boolean;
}) {
    const [mission, setMission] = useState(11);
    const picker = useRef<HTMLDialogElement>(null);
    const { data, error, reload, setData } = useApi<SelfData>('/api/self');
    const official = !preview && (data?.challengeTopics ?? [11]).includes(mission);

    return (
        <Card class="tablet-current-assignment">
            <button type="button" class="tablet-ring tablet-assignment-number" aria-haspopup="dialog"
                aria-label={`Выбрать задание. Сейчас задание ${mission}`}
                onClick={() => picker.current?.showModal()}>{mission}</button>
            {official ? (
                <div class="tablet-assignment-action">
                    {error ? <button type="button" class="chip" onClick={reload}>Повторить загрузку</button> : data ? (
                        <MissionChallenge key={mission} mission={mission} status={data.topics[mission - 1]} studyEntry onTasksSaved={onTasksSaved}
                            studySummary={(progress) => <AssignmentProgress progress={progress} />} onOpen={() => {}}
                            onUpdated={(updated) => {
                                if (data.topics[mission - 1] !== updated.topics[mission - 1] || data.tasksTotal !== updated.tasksTotal) onProgress();
                                setData(updated);
                            }} />
                    ) : <span class="muted" role="status">Загружаем…</span>}
                </div>
            ) : <PreviewAssignment key={mission} mission={mission} />}
            <dialog ref={picker} class="tablet-rank-guide tablet-study-picker" aria-labelledby="tablet-study-picker-title"
                onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
                <div class="tablet-rank-guide-content">
                    <header>
                        <h2 id="tablet-study-picker-title">Выбрать задание</h2>
                        <form method="dialog"><button type="submit" aria-label="Закрыть" class="challenge-close" autofocus>×</button></form>
                    </header>
                    <div class="tablet-study-picker-sectors">
                        {(data?.rankRoute ?? RANK_ROUTE).map((sector) => (
                            <div class="tablet-study-picker-sector" key={sector.name}>
                                <h3>{sector.rank ?? sector.name}</h3>
                                <div class="tablet-study-picker-options">
                                    {sector.missions.map((number) => (
                                        <button type="button" key={number} aria-label={`Задание ${number}`}
                                            aria-pressed={mission === number} data-status={data?.topics[number - 1]}
                                            onClick={() => {
                                                setMission(number);
                                                picker.current?.close();
                                            }}>{number}</button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </dialog>
        </Card>
    );
}

function PreviewAssignment({ mission }: { mission: number }) {
    const dialog = useRef<HTMLDialogElement>(null);
    const [value, setValue] = useState('');
    const [feedback, setFeedback] = useState('');
    const [solved, setSolved] = useState(false);
    const [topic, question, answer, hint] = reviewQuestions[mission - 1];

    return (
        <>
            <div class="tablet-assignment-progress" role="progressbar" aria-label="Демо-прогресс изучения"
                aria-valuemin={0} aria-valuemax={1} aria-valuenow={solved ? 1 : 0}>
                <span data-lit={solved} />
            </div>
            <div class="tablet-assignment-action">
                <div class="mission-challenge">
                    <button type="button" class="mission-action" aria-haspopup="dialog" onClick={() => {
                        setValue('');
                        setFeedback('');
                        dialog.current?.showModal();
                    }}>
                        <span class="tablet-ring challenge-study-play" aria-hidden="true" />
                        <span>Начать изучение</span>
                    </button>
                </div>
            </div>
            <dialog ref={dialog} class="tablet-recall-dialog" aria-labelledby="tablet-study-preview-title">
                <header>
                    <h2 id="tablet-study-preview-title">{topic}</h2>
                    <form method="dialog"><button type="submit" class="tablet-recall-close" aria-label="Закрыть" autofocus>×</button></form>
                </header>
                <p class="tablet-recall-topic">Демо · задание {mission}</p>
                <p>{question}</p>
                <form onSubmit={(event) => {
                    event.preventDefault();
                    if (value.trim() && Number(value) === answer) {
                        setSolved(true);
                        setFeedback('Верно!');
                        event.currentTarget.querySelector('input')?.blur();
                    } else {
                        setFeedback(hint);
                    }
                }}>
                    <label for="tablet-study-preview-answer">Ответ</label>
                    <input id="tablet-study-preview-answer" inputMode="numeric" required value={value}
                        onInput={(event) => setValue(event.currentTarget.value)} />
                    <button type="submit" class="tablet-recall">Проверить</button>
                </form>
                <p role="status">{feedback}</p>
            </dialog>
        </>
    );
}

function AssignmentProgress({ progress }: { progress: ChallengeProgress }) {
    const learning = progress.phase === 'lesson';
    const { solved, total } = learning ? progress.lesson : progress.practice;
    const label = learning ? 'Изучение' : 'Практика';
    return (
        <div class="tablet-assignment-progress" role="progressbar" aria-label={label}
            aria-valuemin={0} aria-valuemax={total} aria-valuenow={solved} aria-valuetext={`${solved} из ${total}`}>
            {Array.from({ length: total }, (_, index) => <span key={index} data-lit={index < solved} aria-hidden="true" />)}
        </div>
    );
}

function MetricRing({ tone, label, value, max, unit }: {
    tone: string; label: string; value: number; max: number; unit?: string;
}) {
    const progress = Math.min(max, Math.max(0, value));
    return (
        <div class="tablet-metric" data-tone={tone} style={{ '--fill': `${progress / max * 100}%` }}>
            <div class="tablet-ring" role="progressbar" aria-label={label} aria-valuenow={progress} aria-valuemax={max}
                aria-valuetext={unit ? `${value}%` : `${value} из ${max}`}>
                <div class="tablet-ring-reading" aria-hidden="true">
                    <strong>{value}{unit && <small>{unit}</small>}</strong>
                    {!unit && <small>/ {max}</small>}
                </div>
            </div>
            <span>{label}</span>
        </div>
    );
}
