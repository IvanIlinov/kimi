import type { ComponentChildren } from 'preact';
import { cap, toneFor } from '../lib/format';
import type { Tone } from '../lib/format';
import type { Standing } from '../api/types';

// Сегментная шкала: вертикальные штрихи вместо сплошной полосы
export function SegmentBar({ value, max = 100, segments = 18, tone }: {
    value: number;
    max?: number;
    segments?: number;
    tone?: Tone;
}) {
    const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
    const filled = Math.round(ratio * segments);
    const color = tone ?? toneFor(ratio * 100);
    return (
        <div class="seg" role="img" aria-label={`${Math.round(ratio * 100)}%`}>
            {Array.from({ length: segments }, (_, i) => (
                <i key={i} class={i < filled ? `on ${color}` : ''} />
            ))}
        </div>
    );
}

export function Card({ children, class: cls = '' }: { children: ComponentChildren; class?: string }) {
    return <section class={`card ${cls}`}>{children}</section>;
}

// Подпись над блоком: мелкая, приглушённая
export const Label = ({ children }: { children: ComponentChildren }) => <div class="label">{children}</div>;

export function Pill({ standing }: { standing: Standing }) {
    return standing === 'ontrack' ? (
        <span class="pill good">В плане</span>
    ) : (
        <span class="pill bad">Отстаёт</span>
    );
}

// Строка списка: имя, шкала, значение; нажатие открывает профиль
export function Row({ name, bar, right, onClick }: {
    name: string;
    bar?: ComponentChildren;
    right: ComponentChildren;
    onClick?: () => void;
}) {
    return (
        <button class="row" onClick={onClick} disabled={!onClick}>
            <span class="row-name">{cap(name)}</span>
            <span class="row-bar">{bar}</span>
            <span class="row-right">{right}</span>
        </button>
    );
}

export function Screen({ title, hideTitle = false, children, className = '' }: {
    title: string;
    hideTitle?: boolean;
    children: ComponentChildren;
    className?: string;
}) {
    return (
        <main class={`page ${className}`} aria-label={hideTitle ? title : undefined}>
            {!hideTitle && <h1 class="display">{title}</h1>}
            {children}
        </main>
    );
}

export function Empty({ text }: { text: string }) {
    return <p class="empty">{text}</p>;
}

export function Loading() {
    return <div class="skeleton" aria-busy="true" />;
}
