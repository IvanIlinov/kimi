import { useEffect, useRef } from 'preact/hooks';
import type { Profile, RankMetric } from '../src/api/types';
import { Card } from '../src/components/ui';
import { RankEmblem } from '../src/components/RankPanel';
import './student-stats-radar.css';

interface Stat {
    label: string;
    metric: RankMetric;
    ratio: number;
}
const AXIS_COLORS = ['#b2a2ff', '#68ead9', '#86b9ff'];

export function StudentStatsRadar({ profile }: { profile: Profile }) {
    const next = profile.rank?.next;
    const stats: Stat[] = next ? [
        rankStat('Закрепить задания', next.topics),
        rankStat('Решить задачи', next.tasks),
        rankStat('Баллы пробника', next.exam),
    ] : [];
    const canvas = useRef<HTMLCanvasElement>(null);
    const ratios = stats.map(({ ratio }) => Math.max(0, Math.min(1, ratio || 0))).join(',');

    useEffect(() => {
        const node = canvas.current;
        if (!node || !ratios) return;
        const draw = () => drawRadar(node, ratios.split(',').map(Number));
        const observer = new ResizeObserver(draw);
        observer.observe(node);
        draw();
        return () => observer.disconnect();
    }, [ratios]);

    if (!profile.rank) return null;
    if (!next) return (
        <Card class="tablet-stats">
            <h2>Ранг «{profile.rank.current.name}»</h2>
            <p class="muted">Все условия высшего ранга выполнены.</p>
        </Card>
    );
    return (
        <Card class="tablet-stats">
            <header class="tablet-rank-heading">
                <RankEmblem rank={{ level: profile.rank.current.level + 1, name: next.name }} />
                <h2>Ранг «{next.name}»</h2>
            </header>
            <div class="tablet-stats-content">
                <canvas ref={canvas} class="tablet-stats-radar" aria-hidden="true" />
                <dl class="tablet-stats-list">
                    {stats.map(({ label, metric, ratio }, index) => (
                        <div key={label} style={{ '--axis-color': AXIS_COLORS[index], '--axis-progress': `${Math.min(1, Math.max(0, ratio)) * 100}%` }}>
                            <dt><i aria-hidden="true">{index + 1}</i>{label}</dt>
                            <dd class="tablet-rank-value" data-ready={metric.value >= metric.goal}>
                                {metric.value}/{metric.goal}
                            </dd>
                        </div>
                    ))}
                </dl>
            </div>
        </Card>
    );
}

function rankStat(label: string, metric: RankMetric): Stat {
    return { label, metric, ratio: metric.value / metric.goal };
}

function drawRadar(canvas: HTMLCanvasElement, ratios: number[]) {
    const { width, height } = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx || !width || !height) return;
    const scale = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    ctx.scale(scale, scale);
    const radius = Math.min(width * 0.38, height * 0.35);
    const angles = ratios.map((_, index) => index * 2 * Math.PI / ratios.length - Math.PI / 2);
    const axisExtent = radius + 9;
    const verticalOffsets = angles.map((angle) => Math.sin(angle) * axisExtent);
    const x = width / 2;
    // Center the visible bounds, including the labels, before drawing the three axes.
    const y = height / 2 - (Math.min(...verticalOffsets) + Math.max(...verticalOffsets)) / 2;
    const point = (angle: number, size: number): [number, number] => [x + Math.cos(angle) * size, y + Math.sin(angle) * size];

    function polygon(sizes: number[]) {
        ctx!.beginPath();
        angles.forEach((angle, index) => {
            const [px, py] = point(angle, sizes[index] * radius);
            if (index === 0) ctx!.moveTo(px, py);
            else ctx!.lineTo(px, py);
        });
        ctx!.closePath();
    }

    ctx.beginPath();
    ctx.arc(x, y, radius * 1.03, 0, Math.PI * 2);
    ctx.strokeStyle = '#698bd64d';
    ctx.setLineDash([2, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    for (const size of [0.25, 0.5, 0.75, 1]) {
        polygon(angles.map(() => size));
        ctx.strokeStyle = size === 1 ? '#a7bafe94' : '#5b8bc052';
        ctx.stroke();
    }
    for (const angle of angles) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(...point(angle, radius));
        ctx.strokeStyle = '#9ac2ff5c';
        ctx.stroke();
    }

    polygon(ratios);
    const fill = ctx.createLinearGradient(x - radius, y - radius, x + radius, y + radius);
    fill.addColorStop(0, '#6d90ff98');
    fill.addColorStop(1, '#34e9e554');
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#66d7ff';
    ctx.strokeStyle = '#b2efff';
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.font = '600 10px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    angles.forEach((angle, index) => {
        const [px, py] = point(angle, radius * ratios[index]);
        ctx.beginPath();
        ctx.arc(px, py, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = AXIS_COLORS[index];
        ctx.fill();
        ctx.fillText(String(index + 1), ...point(angle, axisExtent));
    });
}
