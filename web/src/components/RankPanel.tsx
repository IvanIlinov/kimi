import type { RankMetric, StudyRank } from '../api/types';
import { NavIcon } from './NavIcon';
import { Card } from './ui';

const EMBLEMS = ['spark', 'crystal', 'crystal', 'award', 'award', 'award', 'crown', 'crown', 'crown'];

export function RankEmblem({ rank }: { rank: StudyRank['current'] }) {
    return <span class="rank-emblem" data-level={rank.level}>
        <NavIcon name={EMBLEMS[rank.level] ?? 'crystal'} />
    </span>;
}

export function RankBadge({ rank }: { rank?: StudyRank['current'] }) {
    return rank ? <span class="rank-badge">
        <RankEmblem rank={rank} />
        <span>{rank.name}</span>
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
                    <h2 aria-live="polite">{current.name}</h2>
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
