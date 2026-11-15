export const TOPICS_TOTAL = 27; // всего заданий
export const TASKS_GOAL = 900; // цель по решённым задачам
export const EXAM_MAX = 100; // максимальный балл пробника
export const WEEK_GOAL = 25; // задач в неделю по плану
export const MONTH_TOPICS = [6, 6, 4, 3, 3, 2, 2, 1]; // сен, окт, ноя, дек, янв, фев, март, апр

export interface Person {
    id: number;
    tgId: number;
    name: string;
    exam: number | null; // балл пробника, пока не внесён: null
    tasksTotal: number; // решено всего
    tasksWeek: number; // решено на этой неделе
    studied: number[]; // номера изученных заданий (1..27)
    learning: number[]; // номера заданий, которые изучаются сейчас
    comment: string;
}

export interface Ranked {
    person: Person;
    xp: number;
    pct: number;
    place: number;
}

const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);

// Прогресс в процентах: 100%, когда 27 заданий, 900 задач и 100 баллов.
export function progressPct(p: Person): number {
    const k =
        0.4 * clamp01(p.studied.length / TOPICS_TOTAL) +
        0.4 * clamp01(p.tasksTotal / TASKS_GOAL) +
        0.2 * clamp01((p.exam ?? 0) / EXAM_MAX);
    return Math.round(k * 100);
}

// Очки рейтинга (ХП).
export function xp(p: Person): number {
    return 100 * p.studied.length + p.tasksTotal + 3 * (p.exam ?? 0);
}

// Дата по Москве (UTC+3, без перехода на летнее время).
function moscow(now: Date) {
    const d = new Date(now.getTime() + 3 * 3600e3);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth(), day: d.getUTCDate() };
}

// Сколько заданий должно быть изучено на сегодня: внутри месяца нарастает линейно.
export function planTopics(now: Date): number {
    const { y, m, day } = moscow(now);
    const idx = (m - 8 + 12) % 12; // 0 = сентябрь
    if (idx >= MONTH_TOPICS.length) return TOPICS_TOTAL; // после апреля только задачи
    const before = MONTH_TOPICS.slice(0, idx).reduce((a, b) => a + b, 0);
    const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const plan = before + MONTH_TOPICS[idx] * (day / daysInMonth);
    return Math.min(TOPICS_TOTAL, Math.round(plan)); // план не выше 27
}

// Сколько задач должно быть решено на сегодня: 25 в неделю от 1 сентября, потолок 900.
export function planTasks(now: Date): number {
    const { y, m, day } = moscow(now);
    const startYear = m >= 8 ? y : y - 1;
    const days = (Date.UTC(y, m, day) - Date.UTC(startYear, 8, 1)) / 864e5;
    return Math.min(TASKS_GOAL, Math.round((WEEK_GOAL * days) / 7));
}

const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);

// Опережение или отставание: "+3 | +100". Когда цель достигнута, число заменяется на 100%.
export function leadText(p: Person, now: Date): string {
    const a = p.studied.length >= TOPICS_TOTAL ? '100%' : sign(p.studied.length - planTopics(now));
    const b = p.tasksTotal >= TASKS_GOAL ? '100%' : sign(p.tasksTotal - planTasks(now));
    return `${a} | ${b}`;
}

// Рейтинг: по убыванию очков, при равных очках место одинаковое.
export function rank(people: Person[]): Ranked[] {
    const sorted = people
        .map((person) => ({ person, xp: xp(person), pct: progressPct(person) }))
        .sort((a, b) => b.xp - a.xp || a.person.name.localeCompare(b.person.name));
    let place = 0;
    let prev: number | null = null;
    return sorted.map((r, i) => {
        if (r.xp !== prev) {
            place = i + 1;
            prev = r.xp;
        }
        return { ...r, place };
    });
}

export function leadParts(p: Person, now: Date): { topics: number | null; tasks: number | null } {
    return {
        topics: p.studied.length >= TOPICS_TOTAL ? null : p.studied.length - planTopics(now),
        tasks: p.tasksTotal >= TASKS_GOAL ? null : p.tasksTotal - planTasks(now),
    };
}