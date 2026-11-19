import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Card } from './ui';

export function SwipeCard({ label, first, second, leading }: {
    label: string;
    first: ComponentChildren;
    second: ComponentChildren;
    leading?: ComponentChildren;
}) {
    const hasLeading = leading != null;
    const track = useRef<HTMLDivElement>(null);
    const [active, setActive] = useState(hasLeading ? 1 : 0);
    const pages = hasLeading ? [leading, first, second] : [first, second];

    useLayoutEffect(() => {
        if (hasLeading && track.current) {
            track.current.scrollLeft = (track.current.children[1] as HTMLElement).offsetLeft;
        }
    }, [hasLeading]);

    return (
        <Card class={hasLeading ? 'swipe-card swipe-card-with-leading' : 'swipe-card'}>
            <div class="swipe-card-track" ref={track} tabIndex={0} role="region" aria-label={label}
                onScroll={({ currentTarget }) => {
                    const { scrollLeft, scrollWidth, clientWidth } = currentTarget;
                    const travel = scrollWidth - clientWidth;
                    if (travel > 0) setActive(Math.round(scrollLeft / travel * (pages.length - 1)));
                }}>
                {pages.map((page, index) => <div class="swipe-card-page" key={index}>{page}</div>)}
            </div>
            <div class="swipe-card-dots" aria-hidden={hasLeading ? undefined : 'true'}>
                {pages.map((_, index) => {
                    const cls = index === active ? 'active' : '';
                    return hasLeading ? (
                        <button key={index} class={cls} type="button"
                            aria-label={['Итоги', 'Прогресс', 'Ближайшие цели'][index]}
                            aria-current={index === active ? 'true' : undefined}
                            onClick={() => {
                                if (track.current) track.current.scrollLeft = (track.current.children[index] as HTMLElement).offsetLeft;
                            }} />
                    ) : <span key={index} class={cls} />;
                })}
            </div>
        </Card>
    );
}
