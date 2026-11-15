import type { Person } from './logic.ts';

const mk = (
    id: number, name: string, studied: number, learning: number[],
    tasksTotal: number, tasksWeek: number, exam: number | null, comment = '',
): Person => ({
    id, tgId: id, name, exam, tasksTotal, tasksWeek, comment, learning,
    studied: Array.from({ length: studied }, (_, i) => i + 1),
});

export const MOCK: Person[] = [
    mk(1, 'ваня', 7, [8, 9], 421, 20, 35, 'Повторить 2 и 4'),
    mk(2, 'петя', 9, [10], 520, 25, 52),
    mk(3, 'маша', 27, [], 950, 25, 100, 'Всё сдано!'),
    mk(4, 'аня', 20, [21], 800, 25, 90),
    mk(5, 'боря', 15, [16, 17], 600, 22, 70),
    mk(6, 'вика', 18, [19], 700, 25, 85),
    mk(7, 'гоша', 12, [13], 480, 15, 60),
    mk(8, 'даша', 22, [23, 24], 850, 25, 95),
    mk(9, 'егор', 10, [11], 500, 18, 55),
    mk(10, 'женя', 14, [15], 560, 20, 65),
    mk(11, 'зоя', 8, [9], 450, 10, 40),
    mk(12, 'ира', 16, [17], 640, 25, 72),
];