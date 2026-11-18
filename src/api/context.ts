import { ADMIN_IDS } from '../config.ts';
import { rank } from '../logic.ts';
import type { Ranked } from '../logic.ts';
import { getPersons } from '../store.ts';
import type { TgUser } from './auth.ts';

export type Role = 'admin' | 'student' | 'guest';

export interface Viewer {
    tgId: number;
    firstName: string;
    role: Role;
    personId: number | null; // id участника в базе, если он в рейтинге
}

export const loadRanked = (): Ranked[] => rank(getPersons());

// Роль определяет только сервер, по Telegram id из проверенной подписи
export function resolveViewer(user: TgUser, ranked: Ranked[] = loadRanked()): Viewer {
    const me = ranked.find((r) => r.person.tgId === user.id);
    const role: Role = ADMIN_IDS.includes(user.id) ? 'admin' : me ? 'student' : 'guest';
    return { tgId: user.id, firstName: user.firstName, role, personId: me?.person.id ?? null };
}
