import { useEffect, useRef } from 'preact/hooks';

type Point = [number, number, number];
const sides = 6;
const profile = [[-0.93, 0.046], [-0.48, 0.389], [-0.36, 0.43], [0.38, 0.414], [0.49, 0.378], [0.94, 0.044]];
const vertices: Point[] = profile.flatMap(([height, radius]) => Array.from({ length: sides }, (_, side): Point => {
    const angle = side / sides * Math.PI * 2 + Math.sin(side * 2.3) * 0.035;
    const width = radius * (1 + Math.sin(side * 4.1) * 0.045);
    return [Math.cos(angle) * width + height * 0.035, height, Math.sin(angle) * width];
}));
const top = vertices.length;
vertices.push([-0.035, -1, 0], [0.035, 1, 0]);
const faces: number[][] = Array.from({ length: sides }, (_, index) => {
    const next = (index + 1) % sides;
    const rings = profile.slice(1).map((_, ring) => {
        const offset = ring * sides;
        return [offset + index, offset + sides + index, offset + sides + next, offset + next];
    });
    const last = (profile.length - 1) * sides;
    return [[top, index, next], ...rings, [last + index, top + 1, last + next]];
}).flat();

const palettes: Record<string, Point> = {
    aqua: [91, 229, 255],
    gold: [255, 194, 105],
    violet: [183, 155, 255],
};

export function CrystalMesh({ fill, tone }: { fill: number; tone: string }) {
    const canvas = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const node = canvas.current;
        const context = node?.getContext('2d');
        if (!node || !context) return;
        const motion = matchMedia('(prefers-reduced-motion: reduce)');
        const scale = Math.min(devicePixelRatio || 1, 2);
        node.width = 64 * scale;
        node.height = 66 * scale;
        context.scale(scale, scale);
        const phase = Math.max(0, Object.keys(palettes).indexOf(tone)) * 1.35;
        let frame = 0;
        let last = -Infinity;
        function paint(now: number) {
            if (motion.matches || now - last >= 1000 / 30) {
                last = now;
                const angle = phase + 0.42 + (motion.matches ? 0 : now / 2100);
                const hover = motion.matches ? 0 : Math.sin(now / 1000 + phase) * 1.5;
                drawCrystal(context!, angle, hover, fill, palettes[tone] ?? palettes.aqua);
            }
            if (!motion.matches && !document.hidden) frame = requestAnimationFrame(paint);
        }
        function refresh() {
            cancelAnimationFrame(frame);
            if (!document.hidden) paint(performance.now());
        }
        motion.addEventListener('change', refresh);
        document.addEventListener('visibilitychange', refresh);
        refresh();
        return () => {
            cancelAnimationFrame(frame);
            motion.removeEventListener('change', refresh);
            document.removeEventListener('visibilitychange', refresh);
        };
    }, [fill, tone]);
    return <canvas class="tablet-crystal-mesh" ref={canvas} aria-hidden="true" />;
}

function drawCrystal(ctx: CanvasRenderingContext2D, angle: number, hover: number, fill: number, color: Point) {
    ctx.clearRect(0, 0, 64, 66);
    const turn = Math.cos(angle);
    const slope = Math.sin(angle);
    const rotated: Point[] = vertices.map(([x, y, z]) => {
        const depth = z * turn - x * slope;
        return [x * turn + z * slope, y * 0.986 - depth * 0.167, y * 0.167 + depth * 0.986];
    });
    const cutoff = 1 - 2 * Math.min(1, Math.max(0, fill));

    function paint(points: Point[]) {
        ctx.beginPath();
        points.forEach(([x, y, z], index) => {
            const scale = 26 / (1 - z * 0.18);
            const px = 32 + x * scale;
            const py = 33 + y * scale + hover;
            if (index === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        });
        ctx.closePath();
    }

    for (const indices of [...faces].sort((a, b) => depth(a) - depth(b))) {
        const points = indices.map((index) => rotated[index]);
        const [a, b, c] = points;
        const [ux, uy, uz] = b.map((value, index) => value - a[index]);
        const [vx, vy, vz] = c.map((value, index) => value - a[index]);
        const nx = uy * vz - uz * vy;
        const ny = uz * vx - ux * vz;
        const nz = ux * vy - uy * vx;
        if (nz <= 0) continue;
        const diffuse = Math.max(0, (-0.55 * nx - 0.48 * ny + 0.68 * nz) / Math.hypot(nx, ny, nz));
        const light = 0.68 + diffuse * 0.34;
        paint(points);
        const unchargedGlass = ctx.createLinearGradient(20, 9 + hover, 49, 58 + hover);
        unchargedGlass.addColorStop(0, tint([100, 135, 180], light));
        unchargedGlass.addColorStop(0.45, tint([46, 63, 103], light));
        unchargedGlass.addColorStop(1, tint([18, 35, 70], light));
        ctx.fillStyle = unchargedGlass;
        ctx.fill();
        const charged = clipCharge(indices, rotated, cutoff);
        if (charged.length >= 3) {
            paint(charged);
            const innerLight = ctx.createLinearGradient(23, 57 + hover, 45, 15 + hover);
            innerLight.addColorStop(0, tint(color, light * 0.69));
            innerLight.addColorStop(0.46, tint(color, light * 1.07));
            innerLight.addColorStop(0.72, tint(color, light * 0.89));
            innerLight.addColorStop(1, tint(color, light * 0.61));
            ctx.fillStyle = innerLight;
            ctx.fill();
        }
        const mainFacet = indices.length === 4 && vertices[indices[1]][1] - vertices[indices[0]][1] > 0.6;
        if (mainFacet) {
            ctx.save();
            paint(points);
            ctx.clip();
            const shimmer = ctx.createLinearGradient(19, 18 + hover, 44, 46 + hover);
            shimmer.addColorStop(0.2, '#e5f5ff00');
            shimmer.addColorStop(0.51, '#e5f5ff16');
            shimmer.addColorStop(0.59, '#e5f5ff04');
            shimmer.addColorStop(1, '#e5f5ff00');
            ctx.fillStyle = shimmer;
            ctx.fillRect(12, 6, 40, 54);
            ctx.restore();
        }
        paint(points);
        if (mainFacet) {
            ctx.strokeStyle = `rgba(225,240,255,${0.04 + diffuse * 0.15})`;
            ctx.lineJoin = 'round';
            ctx.lineWidth = 0.48;
            ctx.stroke();
        }
    }

    function depth(indices: number[]) {
        return indices.reduce((sum, index) => sum + rotated[index][2], 0) / indices.length;
    }
}

function tint(color: Point, light: number) {
    return `rgb(${color.map((channel) => Math.min(255, Math.round(channel * light))).join(',')})`;
}

function clipCharge(indices: number[], rotated: Point[], cutoff: number) {
    const result: Point[] = [];
    indices.forEach((index, i) => {
        const previous = indices[(i + indices.length - 1) % indices.length];
        const start = vertices[previous][1];
        const end = vertices[index][1];
        if ((start >= cutoff) !== (end >= cutoff)) {
            const fraction = (cutoff - start) / (end - start);
            const a = rotated[previous];
            const b = rotated[index];
            result.push([
                a[0] + (b[0] - a[0]) * fraction,
                a[1] + (b[1] - a[1]) * fraction,
                a[2] + (b[2] - a[2]) * fraction,
            ]);
        }
        if (end >= cutoff) result.push(rotated[index]);
    });
    return result;
}
