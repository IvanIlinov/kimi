import type { Person } from './logic.ts';

export type TopicStatus = 'done' | 'learning' | 'todo' | 'reinforced';

export function statusOf(p: Person, topic: number): TopicStatus {
    if (p.reinforced.includes(topic)) return 'reinforced';
    if (p.done.includes(topic)) return 'done';
    if (p.learning.includes(topic)) return 'learning';
    return 'todo';
}

// Круг статусов: todo → learning → done → reinforced → todo.
export const nextStatus = (s: TopicStatus): TopicStatus =>
    s === 'todo'
        ? 'learning'
        : s === 'learning'
          ? 'done'
          : s === 'done'
            ? 'reinforced'
            : 'todo';
