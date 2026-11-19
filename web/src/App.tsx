import { useState } from 'preact/hooks';
import { useApi } from './api/useApi';
import { setPreviewAs } from './api/client';
import type { Me } from './api/types';
import { TabBar } from './components/TabBar';
import type { Tab } from './components/TabBar';
import { Empty, Loading, Screen } from './components/ui';
import { ArenaPage } from './pages/ArenaPage';
import { HistoryPage } from './pages/HistoryPage';
import { AdminHomePage } from './pages/AdminHomePage';
import { ProfilePage } from './pages/ProfilePage';
import { TopicsPage } from './pages/TopicsPage';
import { StudentHomePage } from './pages/StudentHomePage';
import { insideTelegram, useBackButton } from './lib/telegram';

type TabId = 'home' | 'week' | 'topics' | 'arena' | 'adminHistory';

const STUDENT_TABS: Tab<TabId>[] = [
    { id: 'arena', icon: 'trophy', label: 'Рейтинг' },
    { id: 'home', icon: 'user-round', label: 'Главная' },
    { id: 'topics', icon: 'target', label: 'Задания' },
];

const GUEST_TABS: Tab<TabId>[] = [
    { id: 'arena', icon: 'trophy', label: 'Главная' },
];

const ADMIN_TABS: Tab<TabId>[] = [
    { id: 'arena', icon: 'trophy', label: 'Рейтинг' },
    { id: 'week', icon: 'calendar-days', label: 'Главная' },
    { id: 'adminHistory', icon: 'clipboard-list', label: 'История' },
];

type Preview = { mode: 'student'; id: number; editing: boolean } | { mode: 'guest' };

export function App() {
    const [preview, setPreview] = useState<Preview | null>(null);
    const me = useApi<Me>(preview ? `/api/me?preview=${preview.mode === 'guest' ? 'guest' : preview.id}` : '/api/me');
    const [tab, setTab] = useState<TabId | null>(null);
    const [openId, setOpenId] = useState<number | null>(null);

    const startPreview = (id: number, editing = false, initialTab: 'home' | 'topics' = 'home') => {
        setPreviewAs(editing ? `edit:${id}` : String(id));
        setPreview({ mode: 'student', id, editing });
        setOpenId(null);
        setTab(initialTab);
    };

    const startGuestPreview = () => {
        setPreviewAs('guest');
        setPreview({ mode: 'guest' });
        setOpenId(null);
        setTab('arena');
    };

    const stopPreview = () => {
        setPreviewAs(null);
        setPreview(null);
        setOpenId(null);
        setTab(preview?.mode === 'student' && preview.editing ? 'arena' : 'week');
    };

    useBackButton(openId !== null ? () => setOpenId(null) : preview ? stopPreview : null);

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

    const defaultTab = tabs === STUDENT_TABS ? 'home' : tabs === ADMIN_TABS ? 'week' : tabs[0].id;
    const active = tab && tabs.some((t) => t.id === tab) ? tab : defaultTab;
    const editingStudent = preview?.mode === 'student' && preview.editing;
    const open = (id: number) => setOpenId(id);

    const go = (id: TabId) => {
        setOpenId(null);
        setTab(id);
    };

    let page;
    if (openId !== null) page = <ProfilePage id={openId} />;
    else if (active === 'week') page = <AdminHomePage onPreview={startPreview} onGuestPreview={startGuestPreview} />;
    else if (active === 'adminHistory') page = <HistoryPage />;
    else if (active === 'home') page = <StudentHomePage />;
    else if (active === 'topics') page = <TopicsPage correction={editingStudent} readOnly={preview !== null && !editingStudent} />;
    else {
        const admin = tabs === ADMIN_TABS;
        page = <ArenaPage onOpen={admin ? (id) => startPreview(id, true) : open}
            onEdit={admin ? (id) => startPreview(id, true, 'topics') : undefined} />;
    }

    return (
        <>
            {page}
            <TabBar tabs={tabs} active={openId !== null ? null : active} onChange={go}
                exit={preview ? {
                    label: editingStudent ? 'Вернуться в рейтинг' : 'Выйти из просмотра',
                    onClick: stopPreview,
                } : undefined} />
        </>
    );
}
