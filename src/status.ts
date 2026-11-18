import type { Person } from './logic.ts';

export type TopicStatus = 'done' | 'learning' | 'todo';

export function statusOf(p: Person, topic: number): TopicStatus {
    if (p.studied.includes(topic)) return 'done';
    if (p.learning.includes(topic)) return 'learning';
    return 'todo';
}

// Круг статусов при нажатии: todo → learning → done → todo
export const nextStatus = (s: TopicStatus): TopicStatus =>
    s === 'todo' ? 'learning' : s === 'learning' ? 'done' : 'todo';
