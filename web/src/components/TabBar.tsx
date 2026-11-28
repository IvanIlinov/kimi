import { haptic } from '../lib/telegram';
import { NavIcon } from './NavIcon';

export interface Tab<Id extends string> {
    id: Id;
    icon: string;
    label: string;
}

export function TabBar<Id extends string>({ tabs, active, onChange, exit, link }: {
    tabs: Tab<Id>[];
    active: Id | null;
    onChange: (id: Id) => void;
    exit?: { label: string; onClick: () => void };
    link?: { label: string; icon: string; href: string };
}) {
    return (
        <nav class="tabbar" aria-label="Разделы">
            <div class="tabbar-tabs">
                {exit && (
                    <button type="button" class="tab tabbar-exit" data-edge="start" aria-label={exit.label} title={exit.label}
                        onClick={() => {
                            haptic.tap();
                            exit.onClick();
                        }}>
                        <NavIcon name="arrow-left" />
                    </button>
                )}
                {tabs.map((t, index) => (
                    <button
                        key={t.id}
                        class={t.id === active ? 'tab active' : 'tab'}
                        data-edge={tabs.length === 1 && !link ? 'both' : index === 0 ? 'start' : index === tabs.length - 1 && !link ? 'end' : 'both'}
                        aria-label={t.label}
                        aria-current={t.id === active ? 'page' : undefined}
                        onClick={() => {
                            haptic.tap();
                            onChange(t.id);
                        }}
                    >
                        <NavIcon name={t.icon} />
                        <span class="tab-label">{t.label}</span>
                    </button>
                ))}
                {link && (
                    <a class="tab tabbar-link" data-edge="end" href={link.href} onClick={() => haptic.tap()}>
                        <NavIcon name={link.icon} />
                        <span class="tab-label">{link.label}</span>
                    </a>
                )}
            </div>
        </nav>
    );
}
