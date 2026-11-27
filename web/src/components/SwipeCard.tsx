import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Card } from './ui';

export function SwipeCard({ label, first, second, pageNames }: {
    label: string;
    first: ComponentChildren;
    second?: ComponentChildren;
    pageNames?: readonly [string, string];
}) {
    const hasSecond = second != null;
    const interactive = hasSecond && pageNames != null;
    const track = useRef<HTMLDivElement>(null);
    const [active, setActive] = useState(0);
    const touchStart = useRef<{ x: number; y: number; index: number } | null>(null);
    const pages = hasSecond ? [first, second] : [first];

    function goTo(index: number) {
        const scroller = track.current;
        const next = (index + pages.length) % pages.length;
        const page = scroller?.children[next] as HTMLElement | undefined;
        if (!scroller || !page) return;
        scroller.scrollLeft = page.offsetLeft;
        setActive(next);
    }

    useLayoutEffect(() => {
        if (track.current) track.current.scrollLeft = 0;
        setActive(0);
    }, [hasSecond]);

    return (
        <Card class={interactive ? 'swipe-card swipe-card-interactive' : 'swipe-card'}>
            <div class="swipe-card-track" ref={track} tabIndex={0} role="region" aria-label={label}
                onTouchStart={(event) => {
                    touchStart.current = null;
                    if (!interactive || event.touches.length !== 1 || (event.target as Element).closest('dialog')) return;
                    const { scrollLeft, scrollWidth, clientWidth } = event.currentTarget;
                    const index = scrollLeft <= 1 ? 0
                        : scrollLeft >= scrollWidth - clientWidth - 1 ? pages.length - 1 : -1;
                    const { clientX: x, clientY: y } = event.touches[0];
                    touchStart.current = { x, y, index };
                }}
                onTouchCancel={() => { touchStart.current = null; }}
                onTouchEnd={(event) => {
                    const start = touchStart.current;
                    touchStart.current = null;
                    if (!start || event.touches.length !== 0) return;
                    const dx = event.changedTouches[0].clientX - start.x;
                    const dy = event.changedTouches[0].clientY - start.y;
                    if (Math.abs(dx) < 40 || Math.abs(dx) <= Math.abs(dy)) return;
                    if (start.index === 0 && dx > 0) goTo(-1);
                    if (start.index === pages.length - 1 && dx < 0) goTo(pages.length);
                }}
                onScroll={({ currentTarget }) => {
                    const { scrollLeft, scrollWidth, clientWidth } = currentTarget;
                    const travel = scrollWidth - clientWidth;
                    if (travel > 0) setActive(Math.round(scrollLeft / travel * (pages.length - 1)));
                }}>
                {pages.map((page, index) => <div class="swipe-card-page" key={index}>{page}</div>)}
            </div>
            {hasSecond && (
                <div class="swipe-card-navigation">
                    {interactive && (
                        <button class="swipe-card-arrow" type="button" aria-label="Предыдущая страница"
                            onClick={() => goTo(active - 1)} />
                    )}
                    <div class="swipe-card-dots" aria-hidden={interactive ? undefined : 'true'}>
                        {pages.map((_, index) => {
                            const cls = index === active ? 'active' : '';
                            return interactive ? (
                                <button key={index} class={cls} type="button" aria-label={pageNames[index]}
                                    aria-current={index === active ? 'true' : undefined} onClick={() => goTo(index)} />
                            ) : <span key={index} class={cls} />;
                        })}
                    </div>
                    {interactive && (
                        <button class="swipe-card-arrow swipe-card-arrow-next" type="button" aria-label="Следующая страница"
                            onClick={() => goTo(active + 1)} />
                    )}
                </div>
            )}
        </Card>
    );
}
