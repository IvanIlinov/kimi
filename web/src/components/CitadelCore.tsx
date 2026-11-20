import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { CoreCrystal, CrystalCelebrationData, StudyCore } from '../api/types';
import { cap, plural } from '../lib/format';
import { NavIcon } from './NavIcon';
import { haptic } from '../lib/telegram';
import './citadel-core.css';

const SEASONS = ['Осень', 'Зима', 'Весна'];
const monthFormat = new Intl.DateTimeFormat('ru-RU', { month: 'long', timeZone: 'Europe/Moscow' });
const dayFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', timeZone: 'Europe/Moscow' });
const crystalLabels: Record<CoreCrystal['state'], string> = {
    future: 'Впереди',
    charging: 'Заряжается',
    lit: 'Зажжён',
    missed: 'Не зажжён',
};

export function CitadelCore({ core, previous }: { core: StudyCore; previous?: StudyCore }) {
    const dialog = useRef<HTMLDialogElement>(null);
    const [selected, setSelected] = useState<number | null>(null);
    const [archive, setArchive] = useState(false);
    const displayed = archive && previous ? previous : core;
    const months = displayed.seasons.flatMap(({ months }) => months);
    const now = displayed.asOf;
    const active = months.findIndex(({ crystals }) => crystals.some((week) => week.start <= now && now < week.end));
    const current = active === -1 ? months.length - 1 : active;
    const index = selected ?? current;
    const month = months[index];
    const season = Math.floor(index / 3);
    const activeCrystal = month.crystals.find((week) => week.start <= now && now < week.end);
    const count = crystalCount(core);

    return (
        <div class="citadel-preview">
            <button type="button" class="citadel-trigger" aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>
                <CorePattern core={core} />
                <span class="citadel-preview-text">
                    <strong>Ядро Цитадели</strong>
                    <small>{core.closed ? `Узор года · ${count}` : `Зажжено: ${count}`}</small>
                </span>
            </button>
            <dialog class="citadel-dialog" ref={dialog} aria-labelledby="citadel-title"
                onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
                <div class="citadel-content">
                    <header>
                        <span class="student-brand">Учебный год {yearLabel(displayed)}</span>
                        <h2 id="citadel-title">Ядро Цитадели</h2>
                        <form method="dialog"><button class="citadel-close" aria-label="Закрыть">×</button></form>
                    </header>
                    {previous && (
                        <div class="citadel-years" role="group" aria-label="Учебный год">
                            {[core, previous].map((year) => (
                                <button type="button" key={year.year} aria-pressed={displayed.year === year.year}
                                    onClick={() => { setArchive(year === previous); setSelected(null); }}>
                                    {yearLabel(year)}
                                </button>
                            ))}
                        </div>
                    )}
                    <CoreFigure core={displayed} />
                    <div class="citadel-seasons" role="group" aria-label="Сезон">
                        {displayed.seasons.map(({ closed }, i) => (
                            <button type="button" key={SEASONS[i]} aria-pressed={i === season}
                                onClick={() => setSelected(i === Math.floor(current / 3) ? current : i * 3)}>
                                {SEASONS[i]}{closed && <NavIcon name="check" />}
                            </button>
                        ))}
                    </div>
                    <div class="citadel-months" role="group" aria-label="Месяц">
                        {months.slice(season * 3, season * 3 + 3).map((item, i) => (
                            <button type="button" key={item.start} aria-pressed={item.start === month.start}
                                onClick={() => setSelected(season * 3 + i)}>
                                {cap(monthFormat.format(item.start))}
                            </button>
                        ))}
                    </div>
                    <section class="citadel-month" aria-label={cap(monthFormat.format(month.start))}>
                        <div class="between">
                            <strong>{month.closed ? 'Руна вплетена' : 'Руна месяца'}</strong>
                            <span>{litCount(month.crystals)}/{month.crystals.length} зажжено</span>
                        </div>
                        <ul class="citadel-crystals">
                            {month.crystals.map((week) => (
                                <li key={week.start} data-state={week.state}>
                                    <NavIcon name="crystal" />
                                    <strong>{week.tasks}/{week.goal}</strong>
                                    <small>{dateRange(week)}</small>
                                    <span>{crystalLabels[week.state]}</span>
                                </li>
                            ))}
                        </ul>
                        {activeCrystal && <p aria-live="polite">{activeCrystal.state === 'lit' ? 'Кристалл этой недели горит.' :
                            `До зажигания кристалла — ещё ${activeCrystal.goal - activeCrystal.tasks}.`}</p>}
                    </section>
                    <p class="citadel-rule">Недельная цель зажигает кристалл. В конце месяца кристаллы вплетаются в руну. Три руны образуют сегмент сезона, а три сегмента — Ядро.</p>
                </div>
            </dialog>
        </div>
    );
}

function litCount(weeks: CoreCrystal[]) {
    return weeks.filter(({ state }) => state === 'lit').length;
}

function crystalCount(core: StudyCore) {
    const count = litCount(core.seasons.flatMap(({ months }) => months.flatMap(({ crystals }) => crystals)));
    return `${count} ${plural(count, ['кристалл', 'кристалла', 'кристаллов'])}`;
}

function yearLabel(core: StudyCore) {
    return `${core.year}/${String(core.year + 1).slice(-2)}`;
}

function dateRange(week: CoreCrystal) {
    return `${dayFormat.format(week.start)} – ${dayFormat.format(week.end - 1)}`;
}

function CoreFigure({ core, weaveWeek }: { core: StudyCore; weaveWeek?: number }) {
    const closed = core.seasons.filter(({ closed }) => closed).length;
    return (
        <figure class="citadel-figure">
            <CorePattern core={core} weaveWeek={weaveWeek} />
            <figcaption><strong>{crystalCount(core)}</strong> <span>·</span> Сегменты <strong>{closed}/3</strong></figcaption>
        </figure>
    );
}

function CorePattern({ core, weaveWeek }: { core: StudyCore; weaveWeek?: number }) {
    const charged = core.seasons.some(({ months }) => months.some((month) => litCount(month.crystals) > 0));
    return (
        <span class="citadel-pattern" data-complete={core.closed && charged} aria-hidden="true">
            <span class="citadel-orbit" />
            {core.seasons.map((season, i) => (
                <span class="citadel-blade" key={i} style={{ '--angle': `${i * 120}deg` }} data-season={i}
                    data-sealed={season.closed} data-charged={season.months.some((month) => litCount(month.crystals) > 0)}>
                    <span class="citadel-blade-face" />
                    {season.months.map((month, monthIndex) => (
                        <span class="citadel-rune" key={month.start} data-woven={month.closed}
                            style={{ '--rune-position': `${64 - monthIndex * 17}%` }}>
                            {month.crystals.map((crystal, index, weeks) => (
                                <span class="citadel-week-gem" key={crystal.start} style={{ gridColumn: crystalColumn(index, weeks.length) }}
                                    data-state={crystal.state}
                                    data-weaving={crystal.start === weaveWeek}>
                                    {crystal.start === weaveWeek && <span class="citadel-flying-gem"
                                        onAnimationEnd={() => haptic.ok()}><NavIcon name="crystal" /></span>}
                                </span>
                            ))}
                        </span>
                    ))}
                </span>
            ))}
            <span class="citadel-heart"><NavIcon name="spark" /></span>
        </span>
    );
}

// Odd rows use the middle socket. Even rows leave it open and mirror around it.
function crystalColumn(index: number, count: number) {
    return 1 + Math.floor((7 - count) / 2) + index + Number(count % 2 === 0 && index >= count / 2);
}

export function CrystalCelebration({ data, onClose }: { data: CrystalCelebrationData; onClose: () => void }) {
    const dialog = useRef<HTMLDialogElement>(null);
    const month = data.core.seasons.flatMap(({ months }) => months)
        .find(({ crystals }) => crystals.some(({ start }) => start === data.week));
    const crystal = month?.crystals.find(({ start }) => start === data.week);

    useLayoutEffect(() => {
        const node = dialog.current;
        if (!node) return;
        const open = () => {
            if (node.open || document.querySelector('dialog[open]')) return;
            node.showModal();
            if (matchMedia('(prefers-reduced-motion: reduce)').matches) haptic.ok();
        };
        document.addEventListener('close', open, true);
        open();
        return () => document.removeEventListener('close', open, true);
    }, []);

    return (
        <dialog class="citadel-dialog citadel-celebration" ref={dialog} aria-labelledby="crystal-title" onClose={onClose}>
            <div class="citadel-content">
                <header>
                    <span class="student-brand">Миссия недели выполнена</span>
                    <h2 id="crystal-title">Кристалл зажжён</h2>
                    <form method="dialog"><button class="citadel-close" aria-label="Закрыть">×</button></form>
                </header>
                <CoreFigure core={data.core} weaveWeek={data.week} />
                {crystal && month && <p class="citadel-weave-note">
                    <strong>{crystal.tasks}/{crystal.goal} задач</strong>
                    <span>{dateRange(crystal)} · {cap(monthFormat.format(month.start))}</span>
                </p>}
                <form method="dialog">
                    <button type="submit" class="mission-action citadel-done">Продолжить <NavIcon name="arrow-right" /></button>
                </form>
            </div>
        </dialog>
    );
}
