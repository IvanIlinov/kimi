export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// plural(5, ['задача', 'задачи', 'задач']) -> 'задач'
export function plural(n: number, [one, few, many]: [string, string, string]): string {
    const a = Math.abs(n) % 100;
    const b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b === 1) return one;
    if (b >= 2 && b <= 4) return few;
    return many;
}

export const sgn = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

export type Tone = 'good' | 'warn' | 'bad';

// Цвет шкалы по проценту выполнения
export const toneFor = (pct: number): Tone => (pct >= 75 ? 'good' : pct >= 40 ? 'warn' : 'bad');
