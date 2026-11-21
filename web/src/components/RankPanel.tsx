import type { RankMetric, StudyRank } from '../api/types';
import { NavIcon } from './NavIcon';
import { Card } from './ui';

const EMBLEMS = [
    <path d="M12 3c0 5-4 9-9 9 5 0 9 4 9 9 0-5 4-9 9-9-5 0-9-4-9-9Z" />,
    <path d="m12 2 7 6v8l-7 6-7-6V8Zm0 0 3 9-3 11-3-11Zm-7 6 4 3h6l4-3" />,
    <path d="m12 3 7 4v7l-7 6-7-6V7Zm-3 9 3-4 3 4-3 4Zm-6 2 2 2m16-2-2 2M9 20l3 2 3-2" />,
    <path d="m18 6 3 6-3 6-6 3-6-3-3-6 3-6 6-3Zm-6 1v3m0 4v3m-5-5h3m4 0h3m-5-2 2 2-2 2-2-2Z" />,
    <path d="m12 2 4 5 4-1-1 5 2 3-5 3-4 5-4-5-5-3 2-3-1-5 4 1Zm0 6 3 5-3 4-3-4Z" />,
    <path d="M12 12c-2-3-5-4-9-3v8c4-1 7 0 9 3 2-3 5-4 9-3V9c-4-1-7 0-9 3Zm0 0v8m0-17 2 2-2 2-2-2Z" />,
    <path d="m3 7 5 4 4-7 4 7 5-4-2 10H5L3 7Zm3 13h12" />,
    <path d="m12 2 5 6-5 6-5-6Zm0 12v7m-2-4h4M3 7l2 7 4 3m12-10-2 7-4 3M4 20l4-1m12 1-4-1" />,
    <path d="m3 7 5 3 4-7 4 7 5-3-2 10H5Zm3 13h12m-6-10 2 3-2 3-2-3Z" />,
];

export function rankName(rank: StudyRank['current']) {
    return rank.kingClass ? `${rank.name} · ${rank.kingClass}` : rank.name;
}

export function RankEmblem({ rank }: { rank: StudyRank['current'] }) {
    return <span class="rank-emblem" data-level={rank.level}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            {EMBLEMS[rank.level] ?? EMBLEMS[1]}
        </svg>
    </span>;
}

export function RankBadge({ rank }: { rank?: StudyRank['current'] }) {
    return rank ? <span class="rank-badge">
        <RankEmblem rank={rank} />
        <span>{rankName(rank)}</span>
    </span> : null;
}

export function RankPanel({ rank, showHeading = true }: { rank: StudyRank; showHeading?: boolean }) {
    const { current, next } = rank;
    return (
        <Card class="rank-panel">
            {showHeading && <div class="rank-heading">
                <RankEmblem rank={current} />
                <div>
                    <span class="student-brand">Ранг подготовки</span>
                    <h2 aria-live="polite">{rankName(current)}</h2>
                </div>
                <span class="rank-level">{current.level}/{EMBLEMS.length - 1}</span>
            </div>}
            {next ? (
                <>
                    <div class="rank-next">Следующий ранг <strong>{next.name}</strong></div>
                    <div class="rank-metrics">
                        <Requirement label="Закреплено" metric={next.topics} />
                        <Requirement label="Задачи" metric={next.tasks} />
                        <Requirement label="Пробник" metric={next.exam} />
                    </div>
                </>
            ) : <p class="rank-complete"><NavIcon name="check" /> Все условия ранга выполнены</p>}
        </Card>
    );
}

function Requirement({ label, metric }: { label: string; metric: RankMetric }) {
    const done = metric.value >= metric.goal;
    return (
        <div class="rank-metric" data-done={done}>
            <span>{label}</span>
            <strong>{metric.value}/{metric.goal}{done && <NavIcon name="check" />}</strong>
            <progress aria-label={label} value={Math.min(metric.value, metric.goal)} max={metric.goal} />
        </div>
    );
}
