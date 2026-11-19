import { haptic } from '../lib/telegram';
import { NavIcon } from './NavIcon';

export interface Tab<Id extends string> {
    id: Id;
    icon: string;
    label: string; // для скринридеров
}

export function TabBar<Id extends string>({ tabs, active, onChange, exit }: {
    tabs: Tab<Id>[];
    active: Id | null;
    onChange: (id: Id) => void;
    exit?: { label: string; onClick: () => void };
}) {
    return (
        <nav class="tabbar" aria-label="Разделы">
            {exit && (
                <button type="button" class="tab tabbar-exit" aria-label={exit.label} title={exit.label}
                    onClick={() => {
                        haptic.tap();
                        exit.onClick();
                    }}>
                    <NavIcon name="arrow-left" />
                </button>
            )}
            {tabs.map((t) => (
                <button
                    key={t.id}
                    class={t.id === active ? 'tab active' : 'tab'}
                    aria-label={t.label}
                    aria-current={t.id === active ? 'page' : undefined}
                    onClick={() => {
                        haptic.tap();
                        onChange(t.id);
                    }}
                >
                    <NavIcon name={t.icon} />
                </button>
            ))}
        </nav>
    );
}
