import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { Card } from './ui';

export function SwipeCard({ label, first, second }: {
    label: string;
    first: ComponentChildren;
    second: ComponentChildren;
}) {
    const [secondActive, setSecondActive] = useState(false);

    return (
        <Card class="swipe-card">
            <div class="swipe-card-track" tabIndex={0} role="region" aria-label={label}
                onScroll={({ currentTarget }) => {
                    const { scrollLeft, clientWidth } = currentTarget;
                    setSecondActive(scrollLeft > clientWidth / 2);
                }}>
                <div class="swipe-card-page">{first}</div>
                <div class="swipe-card-page">{second}</div>
            </div>
            <div class="swipe-card-dots" aria-hidden="true">
                <span class={secondActive ? '' : 'active'} />
                <span class={secondActive ? 'active' : ''} />
            </div>
        </Card>
    );
}
