import { useApi } from '../api/useApi';
import type { Member } from '../api/types';
import { Card, Empty, Loading, Screen } from '../components/ui';
import { cap } from '../lib/format';

export function MembersPage({ onOpen }: { onOpen: (id: number) => void }) {
    const { data, error } = useApi<Member[]>('/api/members');

    if (error) return <Screen title="Участники"><Empty text={error} /></Screen>;
    if (!data) return <Screen title="Участники"><Loading /></Screen>;

    return (
        <Screen title="Участники">
            <Card class="chips">
                {data.length === 0 && <Empty text="Пока никого нет" />}
                {data.map((m) => (
                    <button key={m.id} class="chip" onClick={() => onOpen(m.id)}>
                        {cap(m.name)}
                    </button>
                ))}
            </Card>
        </Screen>
    );
}
