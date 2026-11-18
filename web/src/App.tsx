import { useState } from 'preact/hooks';
import { useApi } from './api/useApi';
import type { Me } from './api/types';
import { TabBar } from './components/TabBar';
import type { Tab } from './components/TabBar';
import { Empty, Loading, Screen } from './components/ui';
import { ArenaPage } from './pages/ArenaPage';
import { MembersPage } from './pages/MembersPage';
import { ProfilePage } from './pages/ProfilePage';
import { TopicsPage } from './pages/TopicsPage';
import { WeekPage } from './pages/WeekPage';
import { insideTelegram, useBackButton } from './lib/telegram';

type TabId = 'profile' | 'week' | 'topics' | 'arena' | 'members' | 'month' | 'global';

// Как в боте: у ученика пять вкладок, у гостя четыре и стартовая — список профилей
const STUDENT_TABS: Tab<TabId>[] = [
    { id: 'profile', icon: '👤', label: 'Профиль' },
    { id: 'week', icon: '📅', label: 'Неделя' },
    { id: 'topics', icon: '📘', label: 'Задания' },
    { id: 'arena', icon: '✨', label: 'Арена' },
    { id: 'members', icon: '👥', label: 'Участники' },
];
const GUEST_TABS: Tab<TabId>[] = [
    { id: 'members', icon: '👥', label: 'Профили' },
    { id: 'week', icon: '📅', label: 'Неделя' },
    { id: 'month', icon: '💯', label: 'Успеваемость' },
    { id: 'global', icon: '🌍', label: 'Глобальный прогресс' },
];

export function App() {
    const me = useApi<Me>('/api/me');
    const [tab, setTab] = useState<TabId | null>(null);
    const [openId, setOpenId] = useState<number | null>(null); // открытый чужой профиль

    useBackButton(openId !== null ? () => setOpenId(null) : null);

    if (!insideTelegram) {
        return <Screen title="Арена"><Empty text="Откройте Арену через Telegram-бота" /></Screen>;
    }
    if (me.error) return <Screen title="Арена"><Empty text={me.error} /></Screen>;
    if (!me.data) return <Screen title="Арена"><Loading /></Screen>;

    const tabs = me.data.personId !== null ? STUDENT_TABS : GUEST_TABS;
    const active = tab ?? tabs[0].id;
    const open = (id: number) => setOpenId(id);

    const go = (id: TabId) => {
        setOpenId(null);
        setTab(id);
    };

    let page;
    if (openId !== null) page = <ProfilePage id={openId} />;
    else if (active === 'profile') page = <ProfilePage id="me" />;
    else if (active === 'week') page = <WeekPage onOpen={open} />;
    else if (active === 'topics') page = <TopicsPage />;
    else if (active === 'arena') page = <ArenaPage onOpen={open} />;
    else if (active === 'month') page = <ArenaPage fixedMode="month" onOpen={open} />;
    else if (active === 'global') page = <ArenaPage fixedMode="global" onOpen={open} />;
    else page = <MembersPage onOpen={open} />;

    return (
        <>
            {page}
            <TabBar tabs={tabs} active={openId !== null ? null : active} onChange={go} />
        </>
    );
}
