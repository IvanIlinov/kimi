import { useState } from 'preact/hooks';
import { useApi } from './api/useApi';
import { setPreviewAs } from './api/client';
import type { Me } from './api/types';
import { TabBar } from './components/TabBar';
import type { Tab } from './components/TabBar';
import { Empty, Loading, Screen } from './components/ui';
import { ArenaPage } from './pages/ArenaPage';
import { AdminPage } from './pages/AdminPage';
import { MembersPage } from './pages/MembersPage';
import { ProfilePage } from './pages/ProfilePage';
import { TopicsPage } from './pages/TopicsPage';
import { StudentHomePage } from './pages/StudentHomePage';
import { WeekPage } from './pages/WeekPage';
import { insideTelegram, useBackButton } from './lib/telegram';

type TabId = 'home' | 'week' | 'topics' | 'arena' | 'members' | 'adminMembers' | 'adminJournal' | 'adminPreview';

const STUDENT_TABS: Tab<TabId>[] = [
    { id: 'arena', icon: 'trophy', label: 'Рейтинг' },
    { id: 'home', icon: 'user-round', label: 'Главная' },
    { id: 'topics', icon: 'target', label: 'Задания' },
];

const GUEST_TABS: Tab<TabId>[] = [
    { id: 'members', icon: 'users-round', label: 'Профили' },
    { id: 'week', icon: 'calendar-days', label: 'Главная' },
    { id: 'arena', icon: 'trophy', label: 'Рейтинг' },
];

const ADMIN_TABS: Tab<TabId>[] = [
    { id: 'week', icon: 'calendar-days', label: 'Главная' },
    { id: 'arena', icon: 'trophy', label: 'Рейтинг' },
    { id: 'adminMembers', icon: 'users-round', label: 'Участники' },
    { id: 'adminJournal', icon: 'clipboard-list', label: 'Журнал' },
    { id: 'adminPreview', icon: 'eye', label: 'Предпросмотр' },
];

type Preview =
    | { mode: 'student'; id: number; name: string }
    | { mode: 'guest' };

export function App() {
    const [preview, setPreview] = useState<Preview | null>(null);
    const me = useApi<Me>(preview ? `/api/me?preview=${preview.mode === 'guest' ? 'guest' : preview.id}` : '/api/me');
    const [tab, setTab] = useState<TabId | null>(null);
    const [openId, setOpenId] = useState<number | null>(null);

    useBackButton(openId !== null ? () => setOpenId(null) : null);

    const startPreview = (id: number, name: string) => {
        setPreviewAs(String(id));
        setPreview({ mode: 'student', id, name });
        setOpenId(null);
        setTab('home');
    };

    const startGuestPreview = () => {
        setPreviewAs('guest');
        setPreview({ mode: 'guest' });
        setOpenId(null);
        setTab('members');
    };

    const stopPreview = () => {
        setPreviewAs(null);
        setPreview(null);
        setOpenId(null);
        setTab('adminPreview');
    };

    if (!insideTelegram) return <Screen title="Арена"><Empty text="Откройте Арену через Telegram-бота" /></Screen>;
    if (me.error) {
        return (
            <Screen title="Арена">
                <Empty text={me.error} />
                {preview && <button class="chip" onClick={stopPreview}>Выйти из предпросмотра</button>}
            </Screen>
        );
    }
    if (!me.data) return <Screen title="Арена"><Loading /></Screen>;

    const tabs = preview?.mode === 'guest'
        ? GUEST_TABS
        : preview
            ? STUDENT_TABS
            : me.data.role === 'admin'
                ? ADMIN_TABS
                : me.data.personId !== null ? STUDENT_TABS : GUEST_TABS;

    const defaultTab = tabs === STUDENT_TABS ? 'home' : tabs[0].id;
    const active = tab && tabs.some((t) => t.id === tab) ? tab : defaultTab;
    const open = (id: number) => setOpenId(id);

    const go = (id: TabId) => {
        setOpenId(null);
        setTab(id);
    };

    let page;
    if (openId !== null) page = <ProfilePage id={openId} />;
    else if (active === 'week') page = <WeekPage onOpen={open} />;
    else if (active === 'adminMembers') page = <AdminPage section="members" />;
    else if (active === 'adminJournal') page = <AdminPage section="journal" />;
    else if (active === 'adminPreview') page = <AdminPage section="preview" onPreview={startPreview} onGuestPreview={startGuestPreview} />;
    else if (active === 'home') page = <StudentHomePage />;
    else if (active === 'topics') page = <TopicsPage readOnly={preview !== null} />;
    else if (active === 'arena') page = <ArenaPage onOpen={open} />;
    else page = <MembersPage onOpen={open} />;

    return (
        <>
            {preview && (
                <button class="preview-exit" onClick={stopPreview}>
                    Выйти из просмотра
                </button>
            )}
            {page}
            <TabBar tabs={tabs} active={openId !== null ? null : active} onChange={go} />
        </>
    );
}
