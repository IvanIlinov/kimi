import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Card } from './ui';

const pageNames = ['Итоги', 'Прогресс', 'Ближайшие цели'];

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

    function goTo(index: number) {
        const page = track.current?.children[index] as HTMLElement | undefined;
        if (track.current && page) track.current.scrollLeft = page.offsetLeft;
    }

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
            <div class="swipe-card-navigation">
                {hasLeading && (
                    <button class="swipe-card-arrow" type="button" aria-label="Предыдущая страница"
                        disabled={active === 0} onClick={() => goTo(active - 1)} />
                )}
                <div class="swipe-card-dots" aria-hidden={hasLeading ? undefined : 'true'}>
                    {pages.map((_, index) => {
                        const cls = index === active ? 'active' : '';
                        return hasLeading ? (
                            <button key={index} class={cls} type="button" aria-label={pageNames[index]}
                                aria-current={index === active ? 'true' : undefined} onClick={() => goTo(index)} />
                        ) : <span key={index} class={cls} />;
                    })}
                </div>
                {hasLeading && (
                    <button class="swipe-card-arrow swipe-card-arrow-next" type="button" aria-label="Следующая страница"
                        disabled={active === pages.length - 1} onClick={() => goTo(active + 1)} />
                )}
            </div>
        </Card>
    );
}
